#include "simulator.h"
#include "stl_support.h"
/***************************************************************************
 *   Copyright (C) 2012 by santiago González                               *
 *   santigoro@gmail.com                                                   *
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation; either version 3 of the License, or     *
 *   (at your option) any later version.                                   *
 *                                                                         *
 *   This program is distributed in the hope that it will be useful,       *
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of        *
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the         *
 *   GNU General Public License for more details.                          *
 *                                                                         *
 *   You should have received a copy of the GNU General Public License     *
 *   along with this program; if not, see <http://www.gnu.org/licenses/>.  *
 *                                                                         *
 ***************************************************************************/

#include "e-element.h"

#include "simulator.h"

#include <sstream>

eElement::eElement(Simulator& sim, std::string id)
{
    m_simulator = &sim;
    m_elmId = id;

    m_simulator->addToElementList(this);
    
}
eElement::~eElement()
{
    
    // m_elmId );
    m_simulator->remFromElementList(this);
    /*for( ePin* epin : m_ePin )
    {
        delete epin;
    }*/
    m_ePin.clear();
}

void eElement::initEpins()
{
    setNumEpins(2); // by default create 2 ePins
}

void eElement::setNumEpins(int n)
{
    m_ePin.resize(n);
    
    // )<<m_ePin.size();
    for (int i = 0; i < n; i++) {
        
        if (m_ePin[i] == 0) {
            
            std::stringstream ss;
            ss << m_elmId << "-ePin" << i;
            m_ePin[i] = m_simulator->createPin(ss.str(), i);
        }
    }
}

ePin *eElement::getEpin(int pin)
{
    return m_ePin[pin];
}

ePin *eElement::getEpin(std::string pinName)
{
    
    if (pinName == "lPin")
        return m_ePin[0];
    else if (pinName == "rPin")
        return m_ePin[1];
    else if (ws::contains(pinName, "ePin")) {
        int pin = ws::suffix_number(pinName, "ePin");
        return m_ePin[pin];
    }
    return 0l;
}

void eElement::setEpin(int num, ePin *pin)
{
    m_ePin[num] = pin;
}
