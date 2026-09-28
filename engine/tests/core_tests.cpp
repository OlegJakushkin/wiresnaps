#include "simulator.h"
#include "e-resistor.h"
#include "e-source.h"
#include "e-capacitor.h"
#include "e-diode.h"
#include "e-bjt.h"
#include "e-clock.h"
#include "e-gate.h"
#include "expression.h"
#include <iostream>
#include <functional>
#include <sstream>

static int passed=0, failed=0;
void check(bool value,const char* message) { if(!value) throw std::runtime_error(message); }
void near(double a,double b,double tol,const char* name) {
    if(!std::isfinite(a)||std::abs(a-b)>tol) { std::ostringstream s; s<<name<<": "<<a<<" != "<<b; throw std::runtime_error(s.str()); }
}
void test(const char* name,std::function<void()> body) {
    try { body(); ++passed; std::cout<<"PASS "<<name<<'\n'; }
    catch(const std::exception& e) { ++failed; std::cout<<"FAIL "<<name<<": "<<e.what()<<'\n'; }
}
struct Circuit {
    Simulator sim{10};
    eNode ground{sim,"ground"}, positive{sim,"positive"}, middle{sim,"middle"};
    eSource source{sim,"supply",sim.createPin("supply.pin",0)};
    eResistor r1{sim,"r1"},r2{sim,"r2"};
    Circuit() {
        sim.remFromEnodeList(&ground,false); ground.setNodeNumber(0);
        source.getEpin()->setEnode(&positive);
        source.setImp(0.1); source.setVoltHigh(5); source.setOut(true);
        r1.initEpins(); r2.initEpins();
        r1.getEpin(0)->setEnode(&positive); r1.getEpin(1)->setEnode(&middle);
        r2.getEpin(0)->setEnode(&middle); r2.getEpin(1)->setEnode(&ground);
        r1.setRes(1000); r2.setRes(1000);
    }
    ~Circuit() { sim.releasePins(); }
};
int main() {
    test("clock timing and digital gate truth table", [] {
        Circuit c;eClock clock(c.sim,"clock");clock.getEpin("out")->setEnode(&c.middle);clock.setFreq(1000);
        eNode output(c.sim,"logic-output");eGate gate(c.sim,"and",2);gate.createPins(2,1);
        gate.getEpin("input0")->setEnode(&c.middle);gate.getEpin("input1")->setEnode(&c.positive);gate.getEpin("output0")->setEnode(&output);
        check(c.sim.startSim(),"digital start");
        for(int i=0;i<49;++i)check(c.sim.advance(),"digital low advance");check(output.getVolt()<1,"clock went high early");
        check(c.sim.advance(),"digital rising edge");check(output.getVolt()>4,"AND rising edge");
        for(int i=0;i<50;++i)check(c.sim.advance(),"digital high advance");check(output.getVolt()<1,"clock period depends on display timing");
    });
    test("singular network produces a diagnostic", [] {
        Simulator sim(10);eNode a(sim,"a"),b(sim,"b");eResistor r(sim,"floating");r.initEpins();r.setRes(1000);r.getEpin(0)->setEnode(&a);r.getEpin(1)->setEnode(&b);
        check(!sim.startSim(),"singular network accepted");check(sim.error()=="SINGULAR_CIRCUIT","missing singular diagnostic");sim.releasePins();
    });
    test("bounded expression evaluation and short circuit", [] {
        ws::Expression expression("vi0 > 2 && i1 ? max(3, vi0 * 2) : (0 && 1/0)");
        near(expression.evaluate([](const std::string& name){return name=="vi0"?2.5:1.;}),5,0,"analog function");
        near(expression.evaluate([](const std::string&){return 0.;}),0,0,"short circuit");
        try{ws::Expression bad("while(true){}");throw std::runtime_error("script allowed");}catch(const std::invalid_argument&){}
        try{ws::Expression bad("1/0");bad.evaluate([](const std::string&){return 0.;});throw std::logic_error("invalid result allowed");}catch(const std::runtime_error& e){check(std::string(e.what())=="EXPRESSION_DIVIDE_BY_ZERO","divide diagnostic");}
    });
    test("series divider and Kirchhoff current", [] {
        Circuit c; check(c.sim.startSim(),"start");
        near(c.middle.getVolt(),5*1000/2000.1,1e-7,"divider");
        near(c.r1.current(),c.r2.current(),1e-10,"current balance");
    });
    test("independent explicit contexts", [] {
        Circuit a,b; b.source.setVoltHigh(9); b.source.setOut(true);
        check(a.sim.startSim() && b.sim.startSim(),"start contexts");
        for(int i=0;i<100;++i) {check(a.sim.advance(),"advance A");check(b.sim.advance(),"advance B");}
        near(a.middle.getVolt(),5*1000/2000.1,1e-7,"A isolation");
        near(b.middle.getVolt(),9*1000/2000.1,1e-7,"B isolation");
    });
    test("capacitor charge follows backward Euler", [] {
        Circuit c;
        c.r2.setRes(1e14);
        eCapacitor cap(c.sim,"cap"); cap.initEpins(); cap.setCap(1e-5);
        cap.getEpin(0)->setEnode(&c.middle); cap.getEpin(1)->setEnode(&c.ground);
        check(c.sim.startSim(),"RC start");
        for(int i=0;i<1000;++i) check(c.sim.advance(),"RC advance");
        near(c.middle.getVolt(),5*(1-std::exp(-0.01/0.010001)),0.01,"RC at one time constant");
    });
    test("diode polarity", [] {
        Circuit c; c.r2.setRes(1e14);
        eDiode d(c.sim,"diode"); d.initEpins(); d.setThreshold(0.7);
        d.getEpin(0)->setEnode(&c.middle); d.getEpin(1)->setEnode(&c.ground);
        check(c.sim.startSim(),"diode start");
        near(c.middle.getVolt(),0.7026,0.01,"forward voltage");
    });
    std::cout<<"RESULT "<<passed<<" passed, "<<failed<<" failed\n";
    return failed ? 1 : 0;
}
