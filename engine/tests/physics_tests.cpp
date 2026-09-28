// SPDX-License-Identifier: GPL-3.0-or-later
#include "engine.h"
#include "wiresnaps.h"
#include "firmware_fixtures.h"
#include <iostream>
#include <functional>
#include <stdexcept>
using ws::Json;
static int failures=0;
void test(const char* name,std::function<void()> fn){try{fn();std::cout<<"PASS "<<name<<'\n';}catch(const std::exception& e){++failures;std::cerr<<"FAIL "<<name<<": "<<e.what()<<'\n';}}
void check(bool b,const char* text){if(!b)throw std::runtime_error(text);}
Json part(const char* id,const char* model,Json nets,Json parameters=Json::object()){return {{"id",id},{"model",model},{"terminals",nets},{"parameters",parameters}};}
Json circuit(Json parts,const char* mode="experiment"){return {{"schemaVersion",1},{"mode",mode},{"parts",parts}};}
Json lampCircuit(double voltage,const char* mode="experiment") {return circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",voltage},{"internalResistance",.2},{"maxCurrent",100}}),part("l","lamp",{"v","0"},{{"voltage",2.5},{"ratedPower",.75}})}),mode);}
void run(ws::Engine& e,int batches){for(int i=0;i<batches;++i){e.advance(1000);auto s=e.snapshot();check(s["diagnostics"].empty(),s.dump().c_str());}}
int main(){
 test("transactional C ABI rewiring retains state and rejects invalid topology",[]{
    auto* c=ws_create(10);auto doc=lampCircuit(2.5);check(ws_load(c,doc.dump().c_str()),"initial load");check(ws_advance(c,1000),"initial step");auto before=Json::parse(ws_snapshot(c));
    doc["preserveState"]=true;doc["parts"][1]["terminals"]={"open","0"};check(ws_load(c,doc.dump().c_str()),"live reload");auto after=Json::parse(ws_snapshot(c));check(after["time"]==before["time"],"live C ABI reset time");
    doc["parts"][1]["terminals"]={"wrong"};check(!ws_load(c,doc.dump().c_str()),"invalid edit accepted");auto rejected=Json::parse(ws_snapshot(c));check(rejected["parts"]==after["parts"]&&rejected["time"]==after["time"],"failed edit corrupted valid state");ws_destroy(c);
 });
 test("live AVR and PIC rewiring retains firmware, instruction position and cycles",[]{
    for(const char* profile:{"atmega328p","pic16f877a"}){
     bool avr=std::string(profile)=="atmega328p";auto doc=circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",5},{"maxCurrent",100}}),part("cpu","mcu",{"v","0","out"},{{"profile",profile},{"gpio",Json::array({avr?13:33})}}),part("r","resistor",{"out","0"},{{"resistance",1000}})}));
     ws::Engine original(10);original.load(doc);original.firmware("cpu",avr?avrDiagnostic:picDiagnostic);original.advance(2000);auto before=original.snapshot();check(before["diagnostics"].empty(),"MCU setup failed");
     doc["parts"].push_back(part("extra","resistor",{"loose","0"}));ws::Engine rewired(10);rewired.load(doc,&original);auto after=rewired.snapshot();
     check(after["parts"][1]["cycles"]==before["parts"][1]["cycles"],"edit restarted emulator cycles");check(after["parts"][1]["pc"]==before["parts"][1]["pc"],"edit restarted emulator PC");
     check(after["parts"][2]["voltage"]>4,"edit lost physical GPIO output");rewired.advance(1000);check(rewired.snapshot()["parts"][1]["cycles"]>after["parts"][1]["cycles"],"retained program stopped");
    }
 });
 test("opening a live lamp stops current immediately and its visible glow fades promptly",[]{
    auto doc=lampCircuit(6);doc["parts"][1]["parameters"]={{"voltage",6},{"ratedPower",1.2},{"thermalCapacity",.00003}};
    ws::Engine powered(10);powered.load(doc);run(powered,50);auto hot=powered.snapshot();check(hot["parts"][1]["brightness"]>.7,"lamp never lit");
    doc["parts"][1]["terminals"]={"unplugged","0"};ws::Engine open(10);open.load(doc,&powered);auto disconnected=open.snapshot();
    check(disconnected["time"]==hot["time"],"edit reset the clock");check(disconnected["parts"][1]["temperature"]==hot["parts"][1]["temperature"],"edit erased heat");
    check(std::abs(disconnected["parts"][1]["current"].get<double>())<1e-8,"disconnected lamp still consumes current");run(open,10);
    check(open.snapshot()["parts"][1]["brightness"]<.01,"visible glow lasted too long");run(open,40);check(open.snapshot()["parts"][1]["brightness"]<.0001,"cool filament glows visibly");
 });
 test("live capacitor and inductor edits retain stored electrical energy",[]{
    for(const char* model:{"capacitor","inductor"}){
     const bool cap=std::string(model)=="capacitor";auto doc=circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",5},{"internalResistance",1}}),part("r","resistor",{"v","x"},{{"resistance",99}}),part("energy",model,{"x","0"},cap?Json{{"capacitance",.001}}:Json{{"inductance",1}})}));
     ws::Engine original(10);original.load(doc);run(original,5);auto old=original.snapshot();doc["parts"].push_back(part("new","resistor",{"loose","0"}));
     ws::Engine rewired(10);rewired.load(doc,&original);auto next=rewired.snapshot();check(old["time"]==next["time"],"reactive edit reset time");
     const char* value=cap?"voltage":"current";check(std::abs(old["parts"][2][value].get<double>()-next["parts"][2][value].get<double>())<.002,"edit erased stored energy");
     rewired.advance(100);check(rewired.snapshot()["diagnostics"].empty(),"reactive edit failed");
    }
 });
 test("live motor edits preserve motion, heat and permanent failures",[]{
    auto doc=circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",3},{"maxCurrent",100}}),part("m","motor",{"v","0"})}));
    ws::Engine original(10);original.load(doc);run(original,50);const auto old=original.snapshot();doc["parts"][1]["terminals"]={"loose","0"};
    ws::Engine edited(10);edited.load(doc,&original);check(edited.snapshot()["parts"][1]["angularVelocity"]==old["parts"][1]["angularVelocity"],"edit stopped inertia");check(edited.snapshot()["parts"][1]["temperature"]==old["parts"][1]["temperature"],"edit cooled motor");
    ws::Engine burned(10);burned.load(lampCircuit(12));run(burned,150);ws::Engine moved(10);moved.load(lampCircuit(12),&burned);check(moved.snapshot()["parts"][1]["failed"],"rewiring repaired a burned lamp");
 });
 test("cold lamp inrush settles into a warm filament",[]{ws::Engine e(10);e.load(lampCircuit(2.5));double cold=std::abs(e.snapshot()["parts"][1]["current"].get<double>());run(e,200);auto s=e.snapshot()["parts"][1];check(!s["failed"].get<bool>(),"nominal lamp burned");check(s["temperature"]>1000,"lamp did not warm");check(cold>s["current"].get<double>()*3,"no inrush");});
 test("lamp overload opens the circuit; damage survives reset",[]{ws::Engine e(10);e.load(lampCircuit(12));run(e,150);auto s=e.snapshot()["parts"][1];check(s["failed"],"lamp survived excessive power");check(std::abs(s["current"].get<double>())<1e-8,"burned filament still conducts");e.reset();check(e.snapshot()["parts"][1]["failed"],"reset repaired damage");e.repair("l");check(!e.snapshot()["parts"][1]["failed"].get<bool>(),"repair failed");});
 test("guided mode pauses before the same overload fails",[]{ws::Engine e(10);e.load(lampCircuit(12,"guided"));run(e,100);auto s=e.snapshot();check(s["paused"],"no intervention");check(!s["parts"][1]["failed"].get<bool>(),"guided burned lamp");check(!s["events"].empty(),"missing explanation event");});
 test("motor startup, back EMF, stall heat and reversal",[]{
    auto doc=circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",3},{"internalResistance",.2},{"maxCurrent",100}}),part("m","motor",{"v","0"})}));
    ws::Engine e(10);e.load(doc);run(e,100);auto free=e.snapshot()["parts"][1];check(free["angularVelocity"]>100,"motor not spinning");
    e.controls({{"paused",true}});e.advance(100);check(e.snapshot()["parts"][1]["angle"]==free["angle"],"paused rotor advances with render time");e.controls({{"paused",false}});
    e.controls({{"parts",Json::array({{{"id","m"},{"control",{{"blocked",true}}}}})}});run(e,150);auto stalled=e.snapshot()["parts"][1];check(stalled["temperature"]>free["temperature"],"stall did not heat windings");check(stalled["current"]>free["current"],"no stall current");
    doc["parts"][0]["parameters"]["voltage"]=-3;e.load(doc);run(e,100);check(e.snapshot()["parts"][1]["angularVelocity"]< -100,"reverse supply did not reverse motor");
 });
 test("mechanically driven motor generates loaded voltage",[]{ws::Engine e(10);auto m=part("m","motor",{"v","0"});m["control"]={{"angularVelocity",500}};e.load(circuit(Json::array({m,part("r","resistor",{"v","0"},{{"resistance",100}})})));run(e,30);auto s=e.snapshot();check(s["parts"][1]["voltage"]>2,"no generator voltage");check(s["parts"][0]["current"]<0,"generator did not deliver current");});
 test("gearbox friction coasts to rest in either direction and preserves whole revolutions",[]{for(double sign:{1.,-1.}){
    ws::Engine e(100);auto sw=part("sw","switch",{"v","drive"});sw["control"]={{"closed",true}};
    e.load(circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",sign*3}}),sw,part("m","motor",{"drive","0"},{{"resistance",8},{"backEmf",.08},{"torqueConstant",.08},{"inertia",.0002},{"friction",.0002},{"coulombFriction",.003}})})));
    run(e,10);auto moving=e.snapshot()["parts"][2];check(sign*moving["angularVelocity"].get<double>()>10,"geared motor did not spin");check(sign*moving["angle"].get<double>()>6.2831853,"motor angle lost complete turns");
    e.controls({{"parts",Json::array({{{"id","sw"},{"control",{{"closed",false}}}}})}});run(e,1);auto coasting=e.snapshot()["parts"][2];check(sign*coasting["angularVelocity"].get<double>()>0,"inertia disappeared instantly");check(std::abs(coasting["angularVelocity"].get<double>())<std::abs(moving["angularVelocity"].get<double>()),"off gearbox did not slow");
    run(e,20);auto stopped=e.snapshot()["parts"][2];check(stopped["angularVelocity"]==0,"off gearbox never stopped");run(e,5);check(e.snapshot()["parts"][2]["angle"]==stopped["angle"],"stopped gearbox keeps turning");
    e.controls({{"parts",Json::array({{{"id","sw"},{"control",{{"closed",true}}}}})}});run(e,5);check(sign*e.snapshot()["parts"][2]["angularVelocity"].get<double>()>10,"gearbox could not restart");
 }});
 test("ambient darkness reaches solar cells and light sensors, including power restart",[]{
    ws::Engine e(10);auto doc=circuit(Json::array({part("sun","solar",{"solar","0"}),part("load","resistor",{"solar","0"}),part("battery","battery",{"v","0"}),part("sensor","photoresistor",{"v","sense"}),part("sensor-load","resistor",{"sense","0"})}));doc["environment"]={{"light",.7}};e.load(doc);run(e,1);auto day=e.snapshot();check(day["parts"][1]["current"]>.01,"solar daylight current missing");check(day["parts"][3]["current"]>.001,"light sensor did not respond to daylight");
    e.controls({{"environment",{{"light",0}}}});auto dark=e.snapshot();check(std::abs(dark["parts"][1]["current"].get<double>())<1e-10,"solar source still powered in darkness");check(dark["parts"][3]["current"]<.00001,"sensor ignored darkness");e.reset();run(e,1);check(std::abs(e.snapshot()["parts"][1]["current"].get<double>())<1e-10,"restart restored daylight");
    e.controls({{"environment",{{"light",.7}}}});run(e,1);check(std::abs(e.snapshot()["parts"][1]["current"].get<double>()-day["parts"][1]["current"].get<double>())<1e-6,"solar daylight failed to return");
 });
 test("short circuit trips battery protection",[]{ws::Engine e(10);e.load(circuit(Json::array({part("b","battery",{"v","0"}),part("w","wire",{"v","0"})})));run(e,100);check(e.snapshot()["parts"][0]["tripped"],"battery protection never trips");});
 test("frame grouping does not change physical time",[]{ws::Engine a(10),b(10);a.load(lampCircuit(2.5));b.load(lampCircuit(2.5));for(int i=0;i<20;++i)a.advance(1000);for(int i=0;i<200;++i)b.advance(100);check(a.snapshot()["parts"]==b.snapshot()["parts"],"display batching altered physics");});
 test("NPN and PNP switching and persistent open-junction failure",[]{for(const char* model:{"npn","pnp"}){
    const double sign=std::string(model)=="pnp"?-1:1;
    auto doc=circuit(Json::array({part("s","battery",{"v","0"},{{"voltage",sign*5},{"maxCurrent",100}}),part("rc","resistor",{"v","c"},{{"resistance",1000}}),part("rb","resistor",{"v","base"},{{"resistance",10000}}),part("q",model,{"c","0","base"})}));
    ws::Engine e(10);e.load(doc);run(e,1);check(std::abs(e.snapshot()["parts"][1]["current"].get<double>())>.003,"transistor did not switch");
    doc["parts"][3]["parameters"]["maxCurrent"]=.0001;e.load(doc);run(e,20);check(e.snapshot()["parts"][3]["failed"],"transistor overload did not fail");
    run(e,1);check(std::abs(e.snapshot()["parts"][1]["current"].get<double>())<1e-8,"failed collector conducts");check(std::abs(e.snapshot()["parts"][2]["current"].get<double>())<1e-8,"failed base conducts");e.reset();check(e.snapshot()["parts"][3]["failed"],"transistor was repaired by power cycling");
 }});
 test("SPDT relay transfers an isolated circuit between NO and NC",[]{
    ws::Engine e(10);auto sw=part("sw","switch",{"coil-v","coil"});sw["control"]={{"closed",true}};
    auto doc=circuit(Json::array({part("coil-b","battery",{"coil-v","0"},{{"voltage",3}}),sw,part("relay","relay",{"coil","0","v","no","nc"}),part("load-b","battery",{"v","return"},{{"voltage",4.5}}),part("on","resistor",{"no","return"},{{"resistance",1000}}),part("off","resistor",{"nc","return"},{{"resistance",1000}})}));
    e.load(doc);run(e,1);auto on=e.snapshot();check(on["parts"][4]["current"]>.004,"NO did not close");check(std::abs(on["parts"][5]["current"].get<double>())<1e-8,"NC stayed closed");
    e.controls({{"parts",Json::array({{{"id","sw"},{"control",{{"closed",false}}}}})}});run(e,1);auto off=e.snapshot();check(off["parts"][5]["current"]>.004,"NC did not reclose");check(std::abs(off["parts"][4]["current"].get<double>())<1e-8,"NO stayed closed");check(off["diagnostics"].empty(),"relay solver");
    doc["parts"][2]["terminals"].erase(4);e.load(doc);run(e,1);check(e.snapshot()["parts"][4]["current"]>.004,"legacy four-terminal relay rejected");
 });
 test("transistor cutoff cannot create LED reverse voltage from numerical residuals",[]{for(bool pnp:{false,true}){
    auto sw=part("sw","switch",{pnp?"0":"v","input"});sw["control"]={{"closed",true}};
    ws::Engine e(10);auto doc=circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",3}}),sw,part("rb","resistor",{"input","base"},{{"resistance",1000}}),part("pull","resistor",{"base",pnp?"v":"0"},{{"resistance",10000}}),part("q",pnp?"pnp":"npn",{"collector",pnp?"v":"0","base"}),part("r","resistor",{pnp?"collector":"v","led"},{{"resistance",100}}),part("led","led",{"led",pnp?"0":"collector"},{{"forwardVoltage",1.8},{"maxVoltage",5}})}),"guided");
    e.load(doc);for(bool closed:{true,false,true,false}){e.controls({{"parts",Json::array({{{"id","sw"},{"control",{{"closed",closed}}}}})}});run(e,2);auto s=e.snapshot();check(!s["paused"].get<bool>(),"false damage prevention after cutoff");check(s["diagnostics"].empty(),"cutoff solve failed");check(std::abs(s["parts"][6]["voltage"].get<double>())<3.01,"cutoff created impossible LED voltage");check((s["parts"][6]["current"].get<double>()>.001)==closed,"LED did not follow switch");}
 }});
 test("RL rise follows its electrical time constant",[]{ws::Engine e(10);e.load(circuit(Json::array({part("s","battery",{"v","0"},{{"voltage",5},{"internalResistance",1}}),part("r","resistor",{"v","l"},{{"resistance",99}}),part("l","inductor",{"l","0"},{{"inductance",1}})})));e.advance(1000);check(e.snapshot()["diagnostics"].empty(),"RL solver");double current=e.snapshot()["parts"][2]["current"];check(std::abs(current-.05*(1-std::exp(-1.)))<.0002,"RL analytic current");});
 test("BJT motor startup crosses saturation and flyback remains convergent",[]{
    ws::Engine e(10);auto sw=part("sw","switch",{"v","rb"});sw["control"]={{"closed",true}};
    e.load(circuit(Json::array({part("b","battery",{"v","0"},{{"voltage",3},{"internalResistance",.6}}),sw,part("r","resistor",{"rb","base"},{{"resistance",1000}}),part("q","npn",{"c","emitter","base"}),part("m","motor",{"v","c"}),part("d","diode",{"c","v"}),part("lead","wire",{"emitter","0"},{{"resistance",.06}})})));
    run(e,50);auto state=e.snapshot();check(state["parts"][4]["angularVelocity"]>10,"motor failed to start");check(std::abs(state["parts"][3]["current"].get<double>()-state["parts"][4]["current"].get<double>())<1e-6,"collector KCL");
    e.controls({{"parts",Json::array({{{"id","sw"},{"control",{{"closed",false}}}}})}});run(e,20);check(std::abs(e.snapshot()["parts"][3]["current"].get<double>())<1e-7,"off transistor conducts");
 });
 test("power restart retains live safety mode and controls",[]{ws::Engine e(10);e.load(lampCircuit(12));e.controls({{"mode","guided"}});e.reset();run(e,100);check(e.snapshot()["paused"],"restart lost guided mode");check(!e.snapshot()["parts"][1]["failed"].get<bool>(),"restart permitted damage");});
 test("power restart retains changed environmental controls",[]{ws::Engine e(10);auto doc=circuit(Json::array({part("sun","solar",{"v","0"}),part("r","resistor",{"v","0"})}));doc["environment"]={{"light",1}};e.load(doc);e.controls({{"environment",{{"light",0}}}});e.reset();check(std::abs(e.snapshot()["parts"][1]["voltage"].get<double>())<1e-8,"restart reset the environment");});
 test("timestep convergence and disconnected circuits",[]{ws::Engine fine(5),coarse(10);fine.load(lampCircuit(2.5));coarse.load(lampCircuit(2.5));for(int i=0;i<10;++i){fine.advance(2000);coarse.advance(1000);}check(std::abs(fine.snapshot()["parts"][1]["temperature"].get<double>()-coarse.snapshot()["parts"][1]["temperature"].get<double>())<1,"step sensitivity");ws::Engine isolated(10);isolated.load(circuit(Json::array({part("r","resistor",{"a","b"})})));run(isolated,1);check(std::abs(isolated.snapshot()["parts"][0]["current"].get<double>())<1e-10,"disconnected current invented");});
 test("invalid model returns a precise error",[]{ws::Engine e(10);try{e.load(circuit(Json::array({part("x","unimplemented",{"v","0"})})));throw std::runtime_error("unknown model accepted");}catch(const std::invalid_argument& x){check(std::string(x.what()).find("UNSUPPORTED_MODEL")!=std::string::npos,"wrong error");}});
 return failures?1:0;
}
