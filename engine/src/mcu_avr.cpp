// SPDX-License-Identifier: GPL-3.0-or-later
#include "mcu.h"
extern "C" {
#include "sim_avr.h"
#include "sim_io.h"
#include "sim_irq.h"
#include "avr_ioport.h"
#include "avr_adc.h"
#include "avr_uart.h"
}
#include <algorithm>
#include <cstdlib>
#include <stdexcept>
namespace ws {
std::unique_ptr<Mcu> createPic();
class Avr final: public Mcu {
    avr_t* chip_=nullptr;
    double volts_=5;
    uint64_t scheduled_=0;
    std::string serial_;
    static void noSleep(avr_t*,avr_cycle_count_t) {}
    static void serialOut(avr_irq_t*,uint32_t value,void* self) {
        auto& s=static_cast<Avr*>(self)->serial_; if(s.size()<4096)s.push_back(char(value));
    }
    static std::pair<char,unsigned> address(unsigned n) {
        if(n>19)throw std::invalid_argument("AVR_PIN_RANGE");
        return n<8?std::make_pair('D',n):n<14?std::make_pair('B',n-8):std::make_pair('C',n-14);
    }
public:
    Avr() {
        chip_=avr_make_mcu_by_name("atmega328p");
        if(!chip_||avr_init(chip_))throw std::runtime_error("AVR_INIT");
        chip_->frequency=16000000; chip_->sleep=noSleep; chip_->run_cycle_limit=1;
        chip_->log=0; supply(5);
        uint32_t flags=0; avr_ioctl(chip_,AVR_IOCTL_UART_SET_FLAGS('0'),&flags);
        avr_irq_register_notify(avr_io_getirq(chip_,AVR_IOCTL_UART_GETIRQ('0'),UART_IRQ_OUTPUT),serialOut,this);
    }
    ~Avr() override { if(chip_){avr_terminate(chip_);std::free(chip_);} }
    void loadHex(std::string_view hex) override {
        auto bytes=parseHex(hex);
        for(auto b:bytes)if(b.address>chip_->flashend)throw std::invalid_argument("AVR_FLASH_LIMIT");
        std::fill(chip_->flash,chip_->flash+chip_->flashend+1,0xff);
        for(auto b:bytes)chip_->flash[b.address]=b.value;
        reset();
    }
    void advance(uint64_t count) override {
        if(count>16000000)throw std::invalid_argument("MCU_STEP_LIMIT");
        if(volts_<2.7)return;
        const auto target=scheduled_+=count;
        while(chip_->cycle<target){auto before=chip_->cycle;int state=avr_run(chip_);
            if(state==cpu_Crashed||state==cpu_Done)throw std::runtime_error("AVR_HALTED");
            if(chip_->cycle==before)throw std::runtime_error("AVR_NO_PROGRESS");}
    }
    void reset() override { chip_->cycle=0;scheduled_=0;avr_reset(chip_);chip_->state=cpu_Running;serial_.clear(); }
    McuPin pin(unsigned n) override {
        auto [port,bit]=address(n); avr_ioport_state_t state{};
        avr_ioctl(chip_,AVR_IOCTL_IOPORT_GETSTATE(port),&state);
        // PIN contains peripheral overrides, including hardware PWM.
        return {bool(state.ddr&(1u<<bit)),bool(state.pin&(1u<<bit)),bool(state.port&(1u<<bit)),25};
    }
    void voltage(unsigned n,double v) override {
        auto [port,bit]=address(n);
        // External voltage must not overwrite the output latch/PWM signal.
        // Loading is accounted for by the engine's finite output resistance.
        avr_ioport_state_t state{};
        avr_ioctl(chip_,AVR_IOCTL_IOPORT_GETSTATE(port),&state);
        if(!(state.ddr&(1u<<bit)))avr_raise_irq(avr_io_getirq(chip_,AVR_IOCTL_IOPORT_GETIRQ(port),bit),v>volts_*0.6);
        if(n>=14)avr_raise_irq(avr_io_getirq(chip_,AVR_IOCTL_ADC_GETIRQ,n-14),unsigned(std::clamp(v,0.,volts_)*1000));
    }
    void supply(double v) override { volts_=std::clamp(v,0.,5.5);chip_->vcc=chip_->avcc=chip_->aref=unsigned(volts_*1000); }
    uint64_t cycles() override {return chip_->cycle;}
    uint32_t pc() override {return chip_->pc;}
    uint8_t memory(unsigned a) override {if(a>chip_->ramend)throw std::invalid_argument("MCU_MEMORY_RANGE");return chip_->data[a];}
    std::string takeSerial() override {auto s=serial_;serial_.clear();return s;}
};
std::unique_ptr<Mcu> Mcu::create(const std::string& profile) {
    if(profile=="atmega328p")return std::make_unique<Avr>();
    if(profile=="pic16f877a")return createPic();
    throw std::invalid_argument("UNVERIFIED_DEVICE_PROFILE");
}
}
