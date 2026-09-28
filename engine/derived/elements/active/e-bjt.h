#include "stl_support.h"
/***************************************************************************
 *   Copyright (C) 2018 by santiago González                               *
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

#ifndef EBJT_H
#define EBJT_H

#include "e-pn.h"
#include "e-diode.h"

class eBJT : public eResistor
{
    public:

        eBJT(Simulator& sim, std::string id );
        virtual ~eBJT();

        double baseCurrent() { return m_BEdiode->current(); }
        double collectorCurrent() { return (m_ePin[0]->getVolt()-m_ePin[1]->getVolt())*m_admit+(m_ePin[2]->getVolt()-m_ePin[1]->getVolt())*m_gm-m_lastOut; }
        void openCircuit() override { for(auto* pin:m_controlPins)pin->stampAdmitance(0);m_gm=0;eResistor::openCircuit(); m_BEdiode->openCircuit(); m_BCdiode->openCircuit(); }
        virtual void resetState();
        virtual void attach();
        virtual void stamp();

        virtual void setVChanged();
        
        virtual double gain()              { return m_gain; }
        virtual void setGain( double gain ){ m_gain = gain; }
        
        virtual double BEthr();
        virtual void setBEthr( double thr );
        
        virtual double pnp()              { return m_PNP; }
        virtual void setPnp( double pnp ) { m_PNP = pnp; }
        
        virtual bool BCd()              { return m_BCdiodeOn; }
        virtual void setBCd( bool bcd );
        
        virtual ePin* getEpin( std::string pinName );
        virtual void initEpins();
        
    protected:
        double m_accuracy;
        double m_lastOut;
        double m_baseCurr;
        double m_gm=0;
        ePin* m_controlPins[3]{};
        double m_voltE;
        double m_BEthr;
        
        int m_gain;
        bool m_Efollow;
        
        bool m_PNP;
        bool m_BCdiodeOn;
        
        ePN* m_BEdiode;
        eDiode* m_BCdiode;
};

#endif
