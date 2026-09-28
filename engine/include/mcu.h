// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <vector>
namespace ws {
struct McuPin { bool output=false; bool high=false; bool pullup=false; double resistance=25; };
class Mcu {
public:
    virtual ~Mcu()=default;
    virtual void loadHex(std::string_view hex)=0;
    virtual void advance(uint64_t cycles)=0;
    virtual void reset()=0;
    virtual McuPin pin(unsigned pin)=0;
    virtual void voltage(unsigned pin,double volts)=0;
    virtual void supply(double volts)=0;
    virtual uint64_t cycles()=0;
    virtual uint32_t pc()=0;
    virtual uint8_t memory(unsigned address)=0;
    virtual std::string takeSerial()=0;
    static std::unique_ptr<Mcu> create(const std::string& profile);
};
struct HexByte { uint32_t address; uint8_t value; };
std::vector<HexByte> parseHex(std::string_view source);
}
