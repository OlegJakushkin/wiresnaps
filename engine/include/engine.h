// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "simulator.h"
#include "mcu.h"
#include "e-resistor.h"
#include <nlohmann/json.hpp>
namespace ws {
using Json=nlohmann::json;
class Branch: public eResistor {
    double emf_=0;
public:
    Branch(Simulator& s,std::string id):eResistor(s,std::move(id)){initEpins();}
    void set(double resistance,double emf=0){setRes(resistance);emf_=emf;stampCurrent(emf_/res());}
    void stamp() override {eResistor::stamp();stampCurrent(emf_/res());}
    void updateVI() override {m_current=(getEpin(0)->getVolt()-getEpin(1)->getVolt()-emf_)/res();}
};
struct Part {
    std::string id,model;
    Json parameters,control,definition;
    std::vector<eNode*> terminals;
    std::vector<std::unique_ptr<eElement>> elements;
    std::vector<Branch*> branches;
    eResistor* electrical=nullptr;
    std::unique_ptr<Mcu> mcu;
    std::string firmware;
    double cycleRemainder=0;
    std::vector<unsigned> gpio;
    double temperature=20,stress=0,speed=0,current=0,voltage=0,power=0,brightness=0,torque=0,phase=0;
    bool failed=false,tripped=false;
    std::string failure;
    double value(const char* key,double fallback) const;
};
class Engine {
    double dt_;
    std::unique_ptr<Simulator> sim_;
    std::vector<std::unique_ptr<eNode>> nodes_;
    std::vector<std::unique_ptr<Part>> parts_;
    std::vector<std::unique_ptr<eResistor>> anchors_;
    Json circuit_,events_=Json::array(),lastValid_=Json::object();
    std::string diagnostic_;
    bool guided_=true,paused_=false,powered_=true;
    double ambient_=20,light_=1,sound_=0,wind_=0;
    uint64_t tick_=0;
    void clear();
    Part& find(const std::string& id);
    Branch* branch(Part& p,size_t a,size_t b,double resistance,double emf=0);
    void construct(Part& p);
    void before(Part& p);
    void observe(Part& p);
    void integrate(Part& p);
    Json state();
public:
    explicit Engine(double stepUs);
    ~Engine();
    void load(const Json& document,Engine* previous=nullptr);
    void controls(const Json& command);
    bool advance(uint32_t steps);
    void firmware(const std::string& id,std::string_view hex);
    void reset();
    void repair(const std::string& id);
    Json snapshot();
    bool valid() const {return diagnostic_.empty();}
    void fail(const std::string& code){diagnostic_=code;paused_=true;}
};
}
