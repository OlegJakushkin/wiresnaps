// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
// Electrical terminal callback; no dependency on a view or host I/O.
class PicPin {
public:
    virtual ~PicPin() = default;
    virtual void setState(bool high) = 0;
    virtual void setDirection(bool output) = 0;
    virtual void setPullup(bool enabled) = 0;
    virtual void setExtraSource(double supplyConductance, double groundConductance) = 0;
};
