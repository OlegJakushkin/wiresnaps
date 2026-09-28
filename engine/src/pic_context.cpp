// SPDX-License-Identifier: GPL-3.0-or-later
#include "pic_context.h"
#include <stdexcept>
namespace {
thread_local ws::PicContext* active = nullptr;
ws::PicContext& context() {
    if (!active) throw std::logic_error("PIC operation outside its simulation context");
    return *active;
}
}
ws::PicScope::PicScope(PicContext& next) : previous_(active) { active=&next; }
ws::PicScope::~PicScope() { active=previous_; }
Cycle_Counter& get_cycles() { return context().cycles; }
Breakpoints& get_bp() { return context().breakpoints; }
void ws::picSerial(int port, unsigned value) { if(context().serial) context().serial(port,value); }
