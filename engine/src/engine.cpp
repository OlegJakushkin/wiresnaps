// SPDX-License-Identifier: GPL-3.0-or-later
#include "engine.h"
#include "e-diode.h"
#include "e-bjt.h"
#include "e-capacitor.h"
#include "e-inductor.h"
#include <set>
namespace ws {
// Retain the extracted backward-Euler models' energy across topology edits.
class LiveCapacitor:public eCapacitor {
public:
    using eCapacitor::eCapacitor;
    double history() const{return m_curSource;}
    void restore(double value){m_curSource=value;getEpin(0)->stampCurrent(value);getEpin(1)->stampCurrent(-value);}
};
class LiveInductor:public eInductor {
public:
    using eInductor::eInductor;
    double history() const{return m_curSource;}
    void restore(double value){m_curSource=value;getEpin(0)->stampCurrent(-value);getEpin(1)->stampCurrent(value);}
};
static double filamentLight(double celsius){
    // Visible-band radiance near the eye's photopic peak, normalized at nominal
    // filament temperature. Cool infrared radiation is not visible light.
    const double kelvin=celsius+273.15;
    if(kelvin<1000)return 0;
    const double visible=std::expm1(26159.6/2673.15)/std::expm1(26159.6/kelvin);
    return visible<1e-5?0:std::clamp(visible,0.,1.);
}
static void finiteTree(const Json& value){
    if(value.is_number()){const double n=value.get<double>();if(!std::isfinite(n)||std::abs(n)>1e14)throw std::invalid_argument("INVALID_VALUE");}
    else if(value.is_structured())for(const auto& child:value)finiteTree(child);
}
double Part::value(const char* key,double fallback) const {
    double v=parameters.value(key,fallback);
    if(!std::isfinite(v)||std::abs(v)>1e14)throw std::invalid_argument("INVALID_PARAMETER");
    return v;
}
Engine::Engine(double stepUs):dt_(stepUs*1e-6) {
    if(!std::isfinite(dt_)||dt_<1e-7||dt_>1e-3)throw std::invalid_argument("STEP_RANGE");
}
Engine::~Engine(){clear();}
void Engine::clear(){
    if(sim_)sim_->releasePins();
    anchors_.clear();parts_.clear();nodes_.clear();sim_.reset();
}
Part& Engine::find(const std::string& id){for(auto& p:parts_)if(p->id==id)return *p;throw std::invalid_argument("UNKNOWN_COMPONENT");}
Branch* Engine::branch(Part& p,size_t a,size_t b,double r,double emf){
    auto part=std::make_unique<Branch>(*sim_,p.id+":"+std::to_string(p.elements.size()));
    auto* result=part.get();
    result->getEpin(0)->setEnode(p.terminals.at(a));result->getEpin(1)->setEnode(p.terminals.at(b));
    result->set(r,emf);p.branches.push_back(result);p.elements.push_back(std::move(part));return result;
}
void Engine::construct(Part& p){
    auto connect=[&](auto& element){element->initEpins();for(size_t i=0;i<p.terminals.size();++i)static_cast<eElement*>(element.get())->getEpin(int(i))->setEnode(p.terminals[i]);p.electrical=element.get();p.elements.push_back(std::move(element));};
    const auto& m=p.model;
    if(m=="accessory"||m=="junction")return;
    if(m=="capacitor") {auto x=std::make_unique<LiveCapacitor>(*sim_,p.id);connect(x);static_cast<eCapacitor*>(p.electrical)->setCap(p.value("capacitance",1e-5));}
    else if(m=="inductor") {auto x=std::make_unique<LiveInductor>(*sim_,p.id);connect(x);static_cast<eInductor*>(p.electrical)->setInd(p.value("inductance",0.01));}
    else if(m=="diode"||m=="led") {auto x=std::make_unique<eDiode>(*sim_,p.id);connect(x);static_cast<eDiode*>(p.electrical)->setThreshold(p.value("forwardVoltage",m=="led"?2.:.7));}
    else if(m=="npn"||m=="pnp") {auto x=std::make_unique<eBJT>(*sim_,p.id);connect(x);auto* b=static_cast<eBJT*>(p.electrical);b->setPnp(m=="pnp");b->setGain(p.value("gain",100));}
    else if(m=="potentiometer") {branch(p,0,1,1000);branch(p,1,2,1000);}
    else if(m=="relay") {branch(p,0,1,p.value("coilResistance",100));branch(p,2,3,1e12);if(p.terminals.size()==5)branch(p,2,4,.05);}
    else if(m=="mcu") {
        branch(p,0,1,1000);
        p.mcu=Mcu::create(p.parameters.value("profile",std::string("atmega328p")));
        p.gpio=p.parameters.at("gpio").get<std::vector<unsigned>>();
        if(p.terminals.size()!=p.gpio.size()+2)throw std::invalid_argument("MCU_PIN_COUNT");
        for(size_t i=0;i<p.gpio.size();++i){branch(p,0,i+2,1e12);branch(p,i+2,1,1e12);}
    }
    else if(m=="resistor"||m=="wire"||m=="battery"||m=="switch"||m=="lamp"||m=="motor"||m=="solar"||m=="fuse"||m=="photoresistor"||m=="thermistor"||m=="speaker"||m=="microphone"||m=="meter"||m=="touch") {
        p.electrical=branch(p,0,1,p.value("resistance",100));
    }else throw std::invalid_argument("UNSUPPORTED_MODEL:"+m);
    before(p);
}
void Engine::load(const Json& document,Engine* previous){
    finiteTree(document);
    if(document.value("schemaVersion",0)!=1)throw std::invalid_argument("CIRCUIT_VERSION");
    if(!document.contains("parts")||!document["parts"].is_array()||document["parts"].size()>256)throw std::invalid_argument("CIRCUIT_SIZE");
    clear();circuit_=document;tick_=0;diagnostic_.clear();events_=Json::array();lastValid_=Json::object();paused_=false;
    guided_=document.value("mode",std::string("guided"))=="guided";powered_=true;
    if(previous){tick_=previous->tick_;powered_=previous->powered_;ambient_=previous->ambient_;light_=previous->light_;sound_=previous->sound_;wind_=previous->wind_;}
    if(document.contains("environment"))controls({{"environment",document["environment"]}});
    std::map<std::string,Part*> retained;
    sim_=std::make_unique<Simulator>(dt_*1e6);
    nodes_.push_back(std::make_unique<eNode>(*sim_,"0"));sim_->remFromEnodeList(nodes_[0].get(),false);
    std::map<std::string,eNode*> nets{{"0",nodes_[0].get()}};std::set<std::string> ids;
    for(const auto& source:document["parts"]){
        auto p=std::make_unique<Part>();p->id=source.at("id");p->model=source.at("model");p->definition=source;
        if(p->id.empty()||!ids.insert(p->id).second)throw std::invalid_argument("DUPLICATE_ID");
        p->parameters=source.value("parameters",Json::object());p->control=source.value("control",Json::object());
        for(const char* key:{"resistance","internalResistance","coilResistance","capacitance","inductance","ratedPower","thermalCapacity","maxTemperature","maxCurrent","maxVoltage","maxPinCurrent","inertia","gain"})
            if(p->parameters.contains(key)&&p->value(key,1)<=0)throw std::invalid_argument(std::string("PARAMETER_MUST_BE_POSITIVE:")+key);
        p->temperature=source.value("temperature",ambient_);p->stress=source.value("stress",0.);p->failed=source.value("failed",false);
        p->failure=source.value("failure",std::string());
        if(previous)for(auto& old:previous->parts_)if(old->id==p->id&&old->model==p->model&&old->parameters==p->parameters){
            retained[p->id]=old.get();p->temperature=old->temperature;p->stress=old->stress;p->failed=old->failed;p->failure=old->failure;p->tripped=old->tripped;
            p->speed=old->speed;p->phase=old->phase;p->current=old->current;p->cycleRemainder=old->cycleRemainder;p->firmware=old->firmware;break;
        }
        auto terminals=source.value("terminals",std::vector<std::string>{});
        size_t required=p->model=="accessory"?0:p->model=="junction"?1:(p->model=="npn"||p->model=="pnp"||p->model=="potentiometer")?3:p->model=="relay"?4:p->model=="mcu"?p->parameters.at("gpio").size()+2:2;
        if(terminals.size()!=required&&!(p->model=="relay"&&terminals.size()==5))throw std::invalid_argument("TERMINAL_COUNT:"+p->id);
        for(auto& net:terminals){
            if(net.empty()||net.size()>128)throw std::invalid_argument("NET_ID");
            if(!nets.count(net)){if(nets.size()>512)throw std::invalid_argument("NET_LIMIT");nodes_.push_back(std::make_unique<eNode>(*sim_,net));nets[net]=nodes_.back().get();}
            p->terminals.push_back(nets[net]);
        }
        parts_.push_back(std::move(p));
    }
    // A declared 1 TΩ parasitic reference prevents an unconnected snap from
    // becoming undefined; it is part of the model, never a LU pivot replacement.
    for(size_t i=1;i<nodes_.size();++i){auto a=std::make_unique<eResistor>(*sim_,"air:"+std::to_string(i));a->initEpins();a->getEpin(0)->setEnode(nodes_[i].get());a->getEpin(1)->setEnode(nodes_[0].get());a->setRes(1e12);anchors_.push_back(std::move(a));}
    for(auto& p:parts_)construct(*p);
    if(!sim_->startSim()){fail(sim_->error());return;}
    std::vector<std::pair<Part*,Part*>> processors;
    for(auto& p:parts_)if(retained.count(p->id)){
        auto* old=retained[p->id];
        if(p->model=="capacitor"&&!p->failed)static_cast<LiveCapacitor*>(p->electrical)->restore(static_cast<LiveCapacitor*>(old->electrical)->history());
        if(p->model=="inductor"&&!p->failed)static_cast<LiveInductor*>(p->electrical)->restore(static_cast<LiveInductor*>(old->electrical)->history());
        if(p->mcu){p->mcu.swap(old->mcu);processors.emplace_back(p.get(),old);}
    }
    try{
        for(auto& p:parts_)before(*p);
        if(!sim_->settle())throw std::runtime_error(sim_->error());
    }catch(...){for(auto [p,old]:processors)p->mcu.swap(old->mcu);throw;}
    for(auto& p:parts_)observe(*p);
    lastValid_=state();
}
void Engine::before(Part& p){
    if(p.model=="accessory"||p.model=="junction")return;
    auto v=[&](const char* key,double fallback){return p.value(key,fallback);};
    auto set=[&](double r,double emf=0){p.branches.at(0)->set(r,emf);};
    if(p.failed){
        for(auto& element:p.elements)if(!element->disabled())element->openCircuit();
        return;
    }
    const auto& m=p.model;
    if(m=="battery")set(p.tripped?1e12:v("internalResistance",.6),powered_?v("voltage",3.):0);
    else if(m=="resistor")set(v("resistance",100));
    else if(m=="wire")set(v("resistance",.015));
    else if(m=="switch")set(p.control.value("closed",true)?v("resistance",.02):1e12);
    else if(m=="potentiometer") {double x=std::clamp(p.control.value("position",.5),0.,1.);p.branches[0]->set(std::max(.1,v("resistance",50000)*x));p.branches[1]->set(std::max(.1,v("resistance",50000)*(1-x)));}
    else if(m=="lamp") {double cold=v("voltage",2.5)*v("voltage",2.5)/v("ratedPower",.75)/(1+.0045*(2400-20));set(cold*(1+.0045*std::max(0.,p.temperature-20)));}
    else if(m=="motor") {
        double r=v("resistance",8)*(1+.0039*(p.temperature-20)),l=v("inductance",.001)/dt_;
        set(r+l,v("backEmf",.006)*p.speed-l*p.current);
    }
    else if(m=="solar")set(v("internalResistance",100),v("voltage",4.5)*std::clamp(light_,0.,1.));
    else if(m=="fuse")set(p.tripped?1e12:.05);
    else if(m=="photoresistor")set(v("darkResistance",1000000)/(1+999*light_));
    else if(m=="thermistor")set(v("resistance",10000)*std::exp(3950*(1/(ambient_+273.15)-1/298.15)));
    else if(m=="speaker")set(v("resistance",8));
    else if(m=="microphone")set(1000+9000*std::clamp(sound_,0.,1.));
    else if(m=="touch")set(p.control.value("touched",false)?v("skinResistance",100000):1e12);
    else if(m=="meter")set(v("resistance",1000000));
    else if(m=="relay"){
        const bool on=std::abs(p.current)>v("pickupCurrent",.02);
        p.branches[1]->set(on?.05:1e12);if(p.branches.size()==3)p.branches[2]->set(on?1e12:.05);
    }
    else if(m=="mcu"){
        double supply=p.terminals[0]->getVolt()-p.terminals[1]->getVolt();p.mcu->supply(supply);
        for(size_t i=0;i<p.gpio.size();++i){auto pin=p.mcu->pin(p.gpio[i]);p.mcu->voltage(p.gpio[i],p.terminals[i+2]->getVolt()-p.terminals[1]->getVolt());
            bool enabled=supply>=(p.parameters.value("profile",std::string())=="pic16f877a"?4.:2.7);
            p.branches[1+i*2]->set(enabled&&((pin.output&&pin.high)||(!pin.output&&pin.pullup))?(pin.output?pin.resistance:50000):1e12);
            p.branches[2+i*2]->set(enabled&&pin.output&&!pin.high?pin.resistance:1e12);}
    }
}
void Engine::observe(Part& p){
    if(p.model=="accessory"||p.model=="junction")return;
    p.voltage=p.terminals[0]->getVolt()-p.terminals[1]->getVolt();
    p.current=p.failed?0:p.electrical?p.electrical->current():p.branches.empty()?0:p.branches[0]->current();
    if(p.model=="npn"||p.model=="pnp")p.current=p.failed?0:static_cast<eBJT*>(p.electrical)->collectorCurrent();
    if(p.model=="inductor")p.current=static_cast<eInductor*>(p.electrical)->indCurrent();
    p.power=std::abs(p.voltage*p.current);
    if(p.model=="mcu"&&!p.failed){
        p.power=std::abs(p.branches[0]->current()*p.voltage);p.current=p.branches[0]->current();
        for(size_t i=0;i<p.gpio.size();++i){auto* high=p.branches[1+i*2];auto* low=p.branches[2+i*2];p.current+=high->current();p.power+=high->current()*high->current()*high->res()+low->current()*low->current()*low->res();}
    }
    if((p.model=="npn"||p.model=="pnp")&&!p.failed)p.power+=std::abs((p.terminals[2]->getVolt()-p.terminals[1]->getVolt())*static_cast<eBJT*>(p.electrical)->baseCurrent());
    p.brightness=p.model=="led"?std::clamp(p.current/.02,0.,1.):p.model=="lamp"?filamentLight(p.temperature):0;
    if(p.failed)p.brightness=0;
    p.torque=p.model=="motor"&&!p.failed?p.value("torqueConstant",.006)*p.current:0;
}
void Engine::integrate(Part& p){
    double heat=p.power, capacity=p.value("thermalCapacity",.3),cooling=p.value("thermalConductance",.015),limit=p.value("maxTemperature",150);
    const auto& m=p.model;
    if(m=="accessory"||m=="junction"||m=="wire"||m=="meter")return;
    // Energy stored in an ideal reactive element is not dissipated as heat.
    // ESR/copper loss belongs in an explicitly declared series resistance.
    if(m=="capacitor"||m=="inductor")heat=p.current*p.current*p.value("lossResistance",0);
    if(m=="battery") {heat=p.current*p.current*p.value("internalResistance",.6);capacity=15;cooling=.08;}
    if(m=="motor") {
        heat=p.current*p.current*p.value("resistance",8)*(1+.0039*(p.temperature-20));
        if(p.control.contains("angularVelocity"))p.speed=p.control["angularVelocity"].get<double>();
        else if(p.control.value("blocked",false))p.speed=0;
        else {
            const double inertia=p.value("inertia",1e-6),free=p.speed+dt_*(p.torque-p.control.value("loadTorque",0.))/inertia;
            // Dry friction stops the shaft without reversing it numerically;
            // viscous drag is implicit for stable, dissipative coast-down.
            p.speed=std::copysign(std::max(0.,std::abs(free)-dt_*std::max(0.,p.value("coulombFriction",0.))/inertia),free)/(1+dt_*std::max(0.,p.value("friction",2e-6))/inertia);
        }
        // A gear ratio cannot be applied to an angle wrapped once per motor
        // revolution. Keep accumulated angle continuous through complete turns.
        p.phase+=dt_*p.speed;
        capacity=p.value("thermalCapacity",.5);cooling=.03;
    }
    double loss=cooling*(p.temperature-ambient_);
    if(m=="lamp") {capacity=p.value("thermalCapacity",.00002);limit=p.value("maxTemperature",2800);double t=p.temperature+273.15,a=ambient_+273.15;loss=p.value("ratedPower",.75)*(std::pow(t,4)-std::pow(a,4))/(std::pow(2673.15,4)-std::pow(293.15,4));}
    if(p.failed)heat=0;
    double next=p.temperature+dt_*(heat-loss)/capacity;
    double currentLimit=p.value("maxCurrent",m=="led"?.03:m=="npn"||m=="pnp"?.2:m=="battery"?2.:100.);
    double voltageLimit=p.value("maxVoltage",m=="led"?5:m=="npn"||m=="pnp"?40:1000);
    double excess=std::max(0.,std::abs(p.current)/currentLimit-1.);
    if(m=="mcu")for(size_t i=1;i<p.branches.size();++i)excess=std::max(excess,std::abs(p.branches[i]->current())/p.value("maxPinCurrent",.04)-1.);
    double stress=p.stress+dt_*(excess*excess+std::max(0.,next/limit-1.)*20);
    bool reverse=(m=="led"||m=="capacitor")&&p.voltage < -voltageLimit;
    bool threat=next>limit*.95||stress>.25||reverse;
    if(guided_&&!p.failed&&threat){paused_=true;events_.push_back({{"code","DAMAGE_PREVENTED"},{"part",p.id},{"time",tick_*dt_},{"temperature",p.temperature},{"current",p.current}});return;}
    p.temperature=std::clamp(next,ambient_-1.,5000.);p.stress=stress;
    if(m=="battery"&&p.stress>.5){p.tripped=true;events_.push_back({{"code","PROTECTION_TRIPPED"},{"part",p.id},{"time",(tick_+1)*dt_}});p.stress=0;}
    else if(m=="fuse"&&(p.stress>.5||next>limit)){p.tripped=true;p.failed=true;p.failure="open";}
    else if(!p.failed&&(next>limit||p.stress>1||reverse)) {p.failed=true;p.failure="open";events_.push_back({{"code","COMPONENT_FAILED"},{"part",p.id},{"time",(tick_+1)*dt_},{"failure","open"}});}
    if(p.mcu&&!p.firmware.empty()&&!p.failed&&powered_){p.cycleRemainder+=dt_*(p.parameters.value("profile",std::string())=="pic16f877a"?1e6:16e6);auto cycles=uint64_t(p.cycleRemainder);p.cycleRemainder-=cycles;p.mcu->advance(cycles);}
}
bool Engine::advance(uint32_t steps){
    if(!sim_||!diagnostic_.empty()||paused_)return false;
    if(steps>10000)throw std::invalid_argument("STEP_BUDGET");
    events_=Json::array();
    for(uint32_t i=0;i<steps;++i){
        for(auto& p:parts_)before(*p);
        if(!sim_->advance()){fail(sim_->error());return false;}
        for(auto& p:parts_)observe(*p);
        for(auto& p:parts_)integrate(*p);
        ++tick_;
        for(auto& p:parts_)if(!std::isfinite(p->temperature)||!std::isfinite(p->speed)||!std::isfinite(p->current)) {fail("NON_FINITE_STATE");return false;}
        if(paused_)break;
    }
    lastValid_=state();return !paused_;
}
void Engine::controls(const Json& command){
    finiteTree(command);
    if(command.contains("mode"))guided_=command["mode"]=="guided";
    if(command.contains("paused"))paused_=command["paused"];
    if(command.contains("powered")){bool next=command["powered"];if(next&&!powered_)for(auto& p:parts_)if(p->mcu)p->mcu->reset();powered_=next;}
    if(command.contains("environment")){auto& e=command["environment"];ambient_=std::clamp(e.value("temperature",ambient_),-20.,60.);light_=std::clamp(e.value("light",light_),0.,2.);sound_=std::clamp(e.value("sound",sound_),0.,1.);wind_=std::clamp(e.value("wind",wind_),0.,20.);}
    for(auto& c:command.value("parts",Json::array()))find(c.at("id")).control.merge_patch(c.at("control"));
    if(sim_&&valid()&&command.value("settle",true)&&(command.contains("parts")||command.contains("powered")||command.contains("environment"))){
        for(auto& p:parts_)before(*p);
        if(!sim_->settle()){fail(sim_->error());return;}
        for(auto& p:parts_)observe(*p);
        lastValid_=state();
    }
}
void Engine::firmware(const std::string& id,std::string_view hex){auto& p=find(id);if(!p.mcu)throw std::invalid_argument("NOT_PROGRAMMABLE");p.mcu->loadHex(hex);p.firmware=std::string(hex);}
void Engine::reset(){
    Json document=circuit_;
    document["mode"]=guided_?"guided":"experiment";
    document["environment"]={{"temperature",ambient_},{"light",light_},{"sound",sound_},{"wind",wind_}};
    std::map<std::string,std::string> firmwareImages;
    for(auto& p:parts_)if(!p->firmware.empty())firmwareImages[p->id]=p->firmware;
    for(auto& p:parts_)for(auto& row:document["parts"])if(row["id"]==p->id){row["control"]=p->control;row["failed"]=p->failed;row["failure"]=p->failure;row["stress"]=p->stress;row["temperature"]=p->temperature;}
    load(document);
    for(auto& [id,hex]:firmwareImages)firmware(id,hex);
}
void Engine::repair(const std::string& id){auto& p=find(id);p.failed=false;p.failure.clear();p.tripped=false;p.stress=0;p.temperature=ambient_;reset();}
Json Engine::state(){
    Json result={{"apiVersion",1},{"time",tick_*dt_},{"revision",circuit_.value("revision",0)},{"paused",paused_},{"mode",guided_?"guided":"experiment"},{"parts",Json::array()}};
    for(auto& p:parts_){Json row={{"id",p->id},{"voltage",p->voltage},{"current",p->current},{"power",p->power},{"temperature",p->temperature},{"stress",p->stress},{"failed",p->failed},{"failure",p->failure},{"tripped",p->tripped},{"brightness",p->brightness},{"angularVelocity",p->speed},{"angle",p->phase},{"torque",p->torque}};
        if(p->mcu){row["pc"]=p->mcu->pc();row["cycles"]=p->mcu->cycles();row["serial"]=p->mcu->takeSerial();if(p->parameters.contains("traceAddress")){unsigned a=p->parameters["traceAddress"];row["trace"]=p->mcu->memory(a)+256*p->mcu->memory(a+1);}}
        result["parts"].push_back(std::move(row));}
    return result;
}
Json Engine::snapshot(){auto result=lastValid_;if(result.empty())result={{"apiVersion",1},{"time",0},{"revision",0},{"parts",Json::array()}};result["diagnostics"]=diagnostic_.empty()?Json::array():Json::array({{{"code",diagnostic_},{"severity","error"}}});result["events"]=events_;result["paused"]=paused_;return result;}
}
