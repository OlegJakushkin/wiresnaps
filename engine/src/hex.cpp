// SPDX-License-Identifier: GPL-3.0-or-later
#include "mcu.h"
#include <map>
#include <stdexcept>
std::vector<ws::HexByte> ws::parseHex(std::string_view text) {
    if(text.size()>2000000) throw std::invalid_argument("HEX_TOO_LARGE");
    std::map<uint32_t,uint8_t> bytes;
    uint32_t base=0; bool ended=false;
    auto nibble=[](char c)->unsigned {
        if(c>='0'&&c<='9') return c-'0'; if(c>='a'&&c<='f')return c-'a'+10;
        if(c>='A'&&c<='F')return c-'A'+10; throw std::invalid_argument("HEX_INVALID_DIGIT");
    };
    while(!text.empty()) {
        auto end=text.find('\n'); auto line=text.substr(0,end);
        text=end==text.npos?std::string_view{}:text.substr(end+1);
        if(!line.empty()&&line.back()=='\r')line.remove_suffix(1);
        if(line.empty())continue;
        if(ended||line.front()!=':'||line.size()<11||line.size()%2!=1)throw std::invalid_argument("HEX_INVALID_RECORD");
        std::vector<uint8_t> r;
        unsigned sum=0;
        for(size_t i=1;i<line.size();i+=2){auto v=nibble(line[i])*16+nibble(line[i+1]);r.push_back(v);sum+=v;}
        if((sum&255)||r.size()!=size_t(r[0])+5)throw std::invalid_argument("HEX_CHECKSUM_OR_LENGTH");
        uint32_t address=uint32_t(r[1])*256+r[2];
        switch(r[3]) {
            case 0: for(unsigned i=0;i<r[0];++i) {
                uint32_t a=base+address+i;
                if(a<base||!bytes.emplace(a,r[4+i]).second)throw std::invalid_argument("HEX_OVERLAP");
            } break;
            case 1: if(r[0]!=0)throw std::invalid_argument("HEX_EOF"); ended=true; break;
            case 2: case 4:
                if(r[0]!=2)throw std::invalid_argument("HEX_ADDRESS");
                base=(uint32_t(r[4])*256+r[5])<<(r[3]==4?16:4); break;
            case 3: case 5: if(r[0]!=4)throw std::invalid_argument("HEX_START"); break;
            default:throw std::invalid_argument("HEX_RECORD_UNSUPPORTED");
        }
    }
    if(!ended||bytes.empty())throw std::invalid_argument("HEX_INCOMPLETE");
    std::vector<HexByte> out; for(auto [a,v]:bytes)out.push_back({a,v}); return out;
}
