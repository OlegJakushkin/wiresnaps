// SPDX-License-Identifier: GPL-3.0-or-later
#include "mcu.h"
#include "pic_context.h"
#include "p16f87x.h"
#include "stimuli.h"
#include <algorithm>
#include <map>
#include <stdexcept>
namespace ws {
class Pic final: public Mcu {
    PicContext context_;
    Processor* chip_=nullptr;
    double volts_=5;
    uint64_t scheduled_=0;
    std::string serial_;
    IOPIN* io(unsigned n) {
        // Physical DIP pin numbers; package supply pins are not GPIO.
        if(n<1||n>40||!chip_->get_pin(n))throw std::invalid_argument("PIC_PIN_RANGE");
        return chip_->get_pin(n);
    }
public:
    Pic() {
        PicScope scope(context_);
        chip_=P16F877A::construct("wiresnaps-pic");
        chip_->set_frequency(4000000);chip_->set_Vdd(5);
        context_.serial=[this](int,unsigned v){if(serial_.size()<4096)serial_.push_back(char(v));};
    }
    ~Pic() override {PicScope scope(context_);delete chip_;}
    void loadHex(std::string_view text) override {
        auto bytes=parseHex(text);std::map<unsigned,unsigned> words;
        for(auto b:bytes){
            unsigned a=b.address/2;
            if(a>=chip_->program_memory_size()&&a!=0x2007&&!(a>=0x2100&&a<0x2200))throw std::invalid_argument("PIC_FLASH_LIMIT");
            words[a]|=unsigned(b.value)<<((b.address%2)*8);
        }
        PicScope scope(context_);
        for(auto [a,v]:words) {
            if(a<chip_->program_memory_size())chip_->init_program_memory_at_index(a,v);
            else if(a==0x2007)chip_->set_config_word(a,v);
            else chip_->set_out_of_range_pm(a,v);
        }
        reset();
    }
    void advance(uint64_t count) override {
        if(count>1000000)throw std::invalid_argument("MCU_STEP_LIMIT");
        if(volts_<4)return;
        PicScope scope(context_);auto target=scheduled_+=count;
        for(uint64_t i=0;context_.cycles.get()<target;++i){
            if(i>count*4+16)throw std::runtime_error("PIC_NO_PROGRESS");
            chip_->step_cycle();
            if(context_.breakpoints.have_halt())throw std::runtime_error("PIC_HALTED");
        }
    }
    void reset() override {PicScope scope(context_);chip_->reset(POR_RESET);scheduled_=context_.cycles.get();serial_.clear();context_.breakpoints.clear_global();}
    McuPin pin(unsigned n) override {PicScope scope(context_);auto* p=io(n);return {p->get_direction()==IOPIN::DIR_OUTPUT,p->getDrivingState(),false,25};}
    void voltage(unsigned n,double v) override {PicScope scope(context_);io(n)->set_nodeVoltage(v);}
    void supply(double v) override {PicScope scope(context_);volts_=std::clamp(v,0.,5.5);chip_->set_Vdd(volts_);}
    uint64_t cycles() override {return context_.cycles.get();}
    uint32_t pc() override {PicScope scope(context_);return chip_->pc->get_value();}
    uint8_t memory(unsigned a) override {PicScope scope(context_);if(a>=chip_->register_memory_size())throw std::invalid_argument("MCU_MEMORY_RANGE");return chip_->registers[a]->get_value();}
    std::string takeSerial() override {auto s=serial_;serial_.clear();return s;}
};
std::unique_ptr<Mcu> createPic(){return std::make_unique<Pic>();}
}
