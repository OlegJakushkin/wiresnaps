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

#include <math.h>

#include "e-adc.h"

eADC::eADC(Simulator& sim, std::string id )
    : eLogicDevice(sim, id )
{
}
eADC::~eADC()
{ 
}

void eADC::stamp()
{
    eNode* enode = m_input[0]->getEpin()->getEnode();
    if( enode ) enode->addToChangedFast(this);

    eLogicDevice::stamp();
}

void eADC::setVChanged()
{
    double volt = m_input[0]->getVolt();

    int address = (int)(volt*m_maxAddr/m_maxVolt+0.1);
    
    for( int i=0; i<m_numOutputs; i++ )
    {
        
        eLogicDevice::setOut( m_numOutputs-1-i, address & 1 );
        address >>= 1;
    }
}
