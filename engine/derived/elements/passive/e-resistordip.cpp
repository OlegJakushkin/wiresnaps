#include "simulator.h"
#include "stl_support.h"
/***************************************************************************
 *   Copyright (C) 2012 by santiago González                               *
 *   santigoro@gmail.com                                                   *
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation; either version 2 of the License, or     *
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

#include "e-resistordip.h"
#include "simulator.h"

#include <sstream>

eResistorDip::eResistorDip(Simulator& sim, std::string id ) 
            : eElement(sim, id )
{
    m_resist = 100;
}
eResistorDip::~eResistorDip(){ }

void eResistorDip::setRes( double resist )
{
    for( eResistor* res : m_resistor ) res->setRes( resist );
    m_resist = resist;
}

void eResistorDip::initEpins()
{
    m_resistor.resize( m_size );
    m_ePin.resize( m_size*2 );
    
    for( int i=0; i<m_size; i++ )
    {
        int index = i*2;
        std::string reid = std::string( m_elmId );
        reid.append(std::string("-resistor"+std::to_string(i)));
        m_resistor[i] = new eResistor(*m_simulator,  reid );
        
        std::string pinId = reid+"-ePin"+std::to_string(index);
        ePin* epin = m_simulator->createPin( pinId, 0 );
        m_resistor[i]->setEpin( 0, epin );
        m_ePin[index] = epin;

        pinId = reid+"-ePin"+std::to_string(index+1);
        epin = m_simulator->createPin( pinId, 0 );
        m_resistor[i]->setEpin( 1, epin );
        m_ePin[index+1] = epin;
    }
    
    setRes( m_resist );
}

