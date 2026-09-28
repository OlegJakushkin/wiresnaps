// SPDX-License-Identifier: GPL-3.0-or-later
#include "mcu.h"
#include "firmware_fixtures.h"
#include <iostream>
#include <stdexcept>
void require(bool b,const char* message){if(!b)throw std::runtime_error(message);}
int main(){
    std::cout<<std::unitbuf;
    try {
        auto avr=ws::Mcu::create("atmega328p");avr->loadHex(avrDiagnostic);avr->voltage(14,2.5);avr->advance(100000);
        require(avr->pin(13).output&&avr->pin(13).high,"AVR instruction/GPIO");
        require(avr->pin(4).high,"AVR ADC reads voltage");require(avr->pin(5).high,"AVR timer interrupt");
        require(avr->takeSerial()=="K","AVR UART");
        unsigned high=0;for(int i=0;i<128;++i){avr->advance(17);high+=avr->pin(6).high;}
        require(high>30&&high<95,"AVR hardware PWM");
        std::cout<<"PASS AVR instructions, GPIO, ADC, timer, interrupt, PWM, UART and memory firmware\n";
        auto pic=ws::Mcu::create("pic16f877a");pic->loadHex(picDiagnostic);pic->voltage(2,2.5);pic->advance(10000);
        require(pic->pin(33).output&&pic->pin(33).high,"PIC instruction/GPIO");
        require(pic->pin(34).high,"PIC timer interrupt");require(pic->pin(35).high,"PIC ADC voltage");
        require(pic->takeSerial()=="P","PIC UART");
        std::cout<<"PASS PIC instructions, GPIO, ADC, timer, interrupt, UART and memory firmware\n";
        auto pic2=ws::Mcu::create("pic16f877a");pic2->loadHex(picDiagnostic);
        auto first=pic->cycles();pic2->advance(70);require(pic->cycles()==first,"PIC isolated timers");
        pic->advance(17);require(pic2->cycles()>=70&&pic2->cycles()<75,"PIC contexts do not interfere");
        std::cout<<"PASS independent PIC contexts\n";
        auto avrRuntime=ws::Mcu::create("atmega328p");avrRuntime->loadHex(avrRuntimeProgram);avrRuntime->voltage(14,2.5);avrRuntime->advance(200000);
        require(avrRuntime->pin(13).high,"AVR bytecode GPIO");require(avrRuntime->memory(avrTraceAddress)==123,"AVR bytecode source trace");
        require(avrRuntime->memory(avrErrorAddress)==0,"AVR runtime error");require(avrRuntime->takeSerial()==std::string(1,char(8)),"AVR bytecode arithmetic/serial");
        std::cout<<"PASS AVR bytecode arithmetic, variables, logic, GPIO, ADC, PWM, wait and tracing\n";
        auto picRuntime=ws::Mcu::create("pic16f877a");picRuntime->loadHex(picRuntimeProgram);picRuntime->voltage(2,2.5);picRuntime->advance(20000);
        require(picRuntime->memory(0x7c)==0,"PIC runtime error");require(picRuntime->memory(0x7a)==123,"PIC bytecode source trace");
        require(picRuntime->pin(33).high,"PIC bytecode GPIO");require(picRuntime->takeSerial()==std::string(1,char(8)),"PIC bytecode arithmetic/serial");
        require(picRuntime->memory(0x51)>120&&picRuntime->memory(0x51)<135,"PIC bytecode ADC");
        unsigned picHigh=0;for(int i=0;i<128;++i){picRuntime->advance(17);picHigh+=picRuntime->pin(17).high;}
        require(picHigh>25&&picHigh<100,"PIC hardware PWM duty");
        std::cout<<"PASS PIC bytecode arithmetic, variables, logic, GPIO, ADC, PWM, wait and tracing\n";
        try{ws::parseHex(":00000001FE\n");throw std::runtime_error("Bad HEX accepted");}catch(const std::invalid_argument&){}
        std::cout<<"PASS HEX checksum rejection\n";
        auto split=ws::Mcu::create("atmega328p"),whole=ws::Mcu::create("atmega328p");split->loadHex(avrDiagnostic);whole->loadHex(avrDiagnostic);
        for(unsigned i=0;i<1000;++i)split->advance(11);whole->advance(11000);
        require(split->cycles()==whole->cycles()&&split->pc()==whole->pc(),"AVR cycle budgets drift with batching");
        std::cout<<"PASS MCU cycle budget grouping\n";
    }catch(const std::exception& e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}
}
