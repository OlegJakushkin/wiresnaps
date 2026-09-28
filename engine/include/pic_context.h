// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include "gpsim_time.h"
#include "breakpoints.h"
#include <functional>
namespace ws {
struct PicContext {
    Cycle_Counter cycles;
    Breakpoints breakpoints;
    std::function<void(int, unsigned)> serial;
};
// Legacy emulator internals resolve state through a bounded entry scope.
// Each processor owns its counters and event queues. Nested calls restore scope.
class PicScope {
    PicContext* previous_;
public:
    explicit PicScope(PicContext& context);
    ~PicScope();
    PicScope(const PicScope&) = delete;
};
void picSerial(int port, unsigned value);
}
