#include "simulator.h"
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

#include <math.h>   // fabs(x,y)
#include <sstream>

#include <ctime>

#include "e-bjt.h"
#include "e-node.h"
#include "simulator.h"

eBJT::eBJT(Simulator& sim, std::string id )
    : eResistor(sim, id )
{
    m_ePin.resize(3);
    
    m_gain = 100;
    m_PNP = false;
    m_BCdiodeOn = false;
    
    std::stringstream ssa;
    ssa << m_elmId << "-BEdiode";
    m_BEdiode = new ePN(*m_simulator,  ssa.str() );
    m_BEdiode->initEpins();
    setBEthr( 0.7 );
    
    std::stringstream ssb;
    ssb << m_elmId << "-BCdiode";
    m_BCdiode = new eDiode(*m_simulator,  ssb.str() );
    m_BCdiode->initEpins();
}
eBJT::~eBJT()
{ 
    delete m_BEdiode;
    delete m_BCdiode;
}

void eBJT::stamp()
{
     // C
    {
        eNode* enod0 = m_ePin[0]->getEnode();
        if( enod0 )
        {
            enod0->addToNoLinList(this);
            enod0->setSwitched( true );
        }
    }
     // E
    {
        eNode* enod1 = m_ePin[1]->getEnode();
        if( enod1 )
        {
            enod1->addToNoLinList(this);
            enod1->setSwitched( true );
        }
    }
     // B
    {
        eNode* enod2 = m_ePin[2]->getEnode();
        if( enod2 ) enod2->addToNoLinList(this);
    }
    eResistor::stamp();
    // Directed conductances stamp gm*(Vbase-Vemitter) in collector KCL
    // and its opposite in emitter KCL, without drawing current from the base.
    const int row[]={0,0,1},column[]={2,1,2};
    for(int i=0;i<3;i++){m_controlPins[i]->setEnode(m_ePin[row[i]]->getEnode());m_controlPins[i]->setEnodeComp(m_ePin[column[i]]->getEnode());m_controlPins[i]->stampAdmitance(i==0?-m_gm:m_gm);}
}

void eBJT::attach()
{
     // C
    {
        eNode* enod0 = m_ePin[0]->getEnode();
        if( m_BCdiodeOn )
        {
            if( m_PNP ) m_BCdiode->getEpin( 0 )->setEnode( enod0 );
            else        m_BCdiode->getEpin( 1 )->setEnode( enod0 );
        }
    }
     // E
    {
        eNode* enod1 = m_ePin[1]->getEnode();
        if( m_PNP ) m_BEdiode->getEpin( 0 )->setEnode( enod1 );
        else        m_BEdiode->getEpin( 1 )->setEnode( enod1 );
    }
     // B
    {
        eNode* enod2 = m_ePin[2]->getEnode();
        if( m_PNP )
        {
            m_BEdiode->getEpin( 1 )->setEnode( enod2 );
            if( m_BCdiodeOn ) m_BCdiode->getEpin( 1 )->setEnode( enod2 );
        }
        else
        {
            m_BEdiode->getEpin( 0 )->setEnode( enod2 );
            if( m_BCdiodeOn ) m_BCdiode->getEpin( 0 )->setEnode( enod2 );
        }
    }
}

void eBJT::resetState()
{
    //eResistor::setRes( 400/m_gain );
    eResistor::setAdmit( 0 );
    eResistor::stamp();

    m_BEdiode->resetState();
    if( m_BCdiodeOn ) m_BCdiode->resetState();

    m_accuracy = m_simulator->NLaccuracy();
    //m_stage = 0;
    m_lastOut = 0;
    m_baseCurr = 0;
    m_gm = 0;
    m_voltE = 0;
    m_Efollow = false;

    // Deterministic relaxation; no wall-clock seed.
}

void eBJT::setVChanged() 
{
    const double sign=m_PNP?-1.:1.;
    const double vce=std::max(0.,sign*(m_ePin[0]->getVolt()-m_ePin[1]->getVolt()));
    const double vbe=sign*(m_ePin[2]->getVolt()-m_ePin[1]->getVolt());
    m_baseCurr=std::max(0.,(vbe-m_BEthr)/.6);
    if(m_baseCurr==0){
        // Cutoff is an exact zero-current branch in this upstream model.
        // Relaxation must not leave a nanoamp Norton source behind: an open
        // collector with teraohm parasitics would turn it into invented volts.
        eResistor::setAdmit(0);m_gm=0;m_lastOut=0;
        for(auto* pin:m_controlPins)pin->stampAdmitance(0);
        m_ePin[0]->stampCurrent(0);m_ePin[1]->stampCurrent(0);
        return;
    }
    // Retain upstream gain, Early-effect and saturation equations. Stamp their
    // local Norton linearisation instead of dividing I by Vce. That fixed-point
    // form becomes arbitrarily slow at the active/saturated transition when an
    // inductive load changes current. Relax both terms deterministically.
    double factor=1.,derivative=0.,baseDerivative=0.;
    if(vbe>0&&vce<vbe){const double ratio=vce/vbe;factor=2*ratio-ratio*ratio;derivative=2*(1-ratio)/vbe;baseDerivative=-2*ratio*(1-ratio)/vbe;}
    const double base=m_baseCurr*m_gain;
    const double current=base*(1+vce/75)*factor;
    const double slope=base*((1+vce/75)*derivative+factor/75);
    const double transconductance=m_baseCurr>0?(m_gain/.6*factor+base*baseDerivative)*(1+vce/75):0;
    const double admit=.5*(m_admit+slope),gm=.5*(m_gm+transconductance);
    const double source=.5*(m_lastOut-sign*(current-slope*vce-transconductance*vbe));
    if(std::abs(admit-m_admit)<m_accuracy&&std::abs(gm-m_gm)<m_accuracy&&std::abs(source-m_lastOut)<m_accuracy)return;
    eResistor::setAdmit(admit);
    m_gm=gm;for(int i=0;i<3;i++)m_controlPins[i]->stampAdmitance(i==0?-gm:gm);
    m_ePin[0]->stampCurrent(source);
    m_ePin[1]->stampCurrent(-source);
    m_lastOut=source;
}

double eBJT::BEthr()
{
    return m_BEthr;
}

void eBJT::setBEthr( double thr )
{
    if( thr == 0 ) thr = 0.7;
    m_BEdiode->setThreshold( thr );
    m_BEthr = thr;
}

void eBJT::setBCd( bool bcd ) 
{ 
    if( !bcd )
    {
        m_BCdiode->getEpin( 0 )->setEnode( 0l );
        m_BCdiode->getEpin( 1 )->setEnode( 0l );
    }
    m_BCdiodeOn = bcd; 
}

void eBJT::initEpins()
{
    std::stringstream sd;
    sd << m_elmId << "-collector";
    m_ePin[0] = m_simulator->createPin( sd.str(), 0 );
    
    std::stringstream ss;
    ss << m_elmId << "-emiter";
    m_ePin[1] = m_simulator->createPin( ss.str(), 1 ); 
    
    std::stringstream sg;
    sg << m_elmId << "-base";
    m_ePin[2] = m_simulator->createPin( sg.str(), 2 );  
    for(int i=0;i<3;i++)m_controlPins[i]=m_simulator->createPin(m_elmId+"-controlled-"+std::to_string(i),i+3);
}

ePin* eBJT::getEpin( std::string pinName )
{
    ePin* pin = 0l;
    if     ( pinName == "collector") pin = m_ePin[0];
    else if( pinName == "emiter")    pin = m_ePin[1];
    else if( pinName == "base")      pin = m_ePin[2];
    return pin;
}
