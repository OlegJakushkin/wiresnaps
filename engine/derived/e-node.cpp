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

#include "e-node.h"

#include "e-element.h"
#include "simulator.h"

eNode::eNode(Simulator& sim, std::string id)
{
    m_simulator = &sim;
    m_id      = id;
    m_nodeNum = 0;
    m_numCons = 0;
    m_volt    = 0;
    m_isBus   = false;

    initialize();
    

    m_simulator->addToEnodeList(this);
}
eNode::~eNode()
{
    m_simulator->detachNode(this);
    m_simulator->remFromEnodeList(this, false);
    m_simulator->remFromChangedNodeList(this);
}

void eNode::pinChanged(ePin *epin,
                       int enodeComp) // Add node at other side of pin
{
    
    m_nodeList[epin] = enodeComp;
}

void eNode::initialize()
{
    m_totalAdmit = 0; m_totalCurr = 0; m_voltChanged = false;
    m_switched     = false;
    m_single       = false;
    m_changed      = false;
    m_currChanged  = false;
    m_admitChanged = false;

    m_changedFast.clear();
    m_nonLinear.clear();
    m_reactiveList.clear();
    m_admitList.clear();
    m_currList.clear();
    m_nodeList.clear();

    m_volt = 0;

    if (m_isBus) {
        m_eBusPinList.clear();
        m_eNodeList.clear();
        
    }
}

void eNode::stampCurrent(ePin *epin, double data)
{
    if (m_nodeList[epin] == m_nodeNum)
        return; // Be sure msg doesn't come from this node

    m_currList[epin] = data;

    

    m_currChanged = true;

    if (!m_changed) {
        m_changed = true;
        m_simulator->addToChangedNodeList(this);
    }
}

void eNode::stampAdmitance(ePin *epin, double data)
{
    if (m_nodeList[epin] == m_nodeNum)
        return; // Be sure msg doesn't come from this node

    m_admitList[epin] = data;

    m_admitChanged = true;

    if (!m_changed) {
        m_changed = true;
        m_simulator->addToChangedNodeList(this);
    }
}

void eNode::setNodeNumber(int n)
{
    m_nodeNum = n;
}

void eNode::stampMatrix()
{
    if (m_nodeNum == 0)
        return;

    m_changed = false;

    if (m_admitChanged) {
        for(auto& entry:m_admit) entry.second=0;
        m_totalAdmit = 0;

        for (const auto& i : m_admitList) {

            double adm = i.second;

            ePin *epin = i.first;
            int enode  = m_nodeList[epin];

            m_admit[enode] += adm;
            m_totalAdmit += adm;
        }
        if (!m_single || m_switched)
            stampAdmit();

        m_admitChanged = false;
    }

    if (m_currChanged) {
        m_totalCurr = 0;
        for (const auto& entry : m_currList)
            m_totalCurr += entry.second;

        if (!m_single || m_switched)
            stampCurr();

        m_currChanged = false;
    }
    if (m_single)
        solveSingle();
}

void eNode::stampAdmit()
{
    int nonCero = 0;
    for (const auto& ai : m_admit) {
        int enode    = ai.first;
        double admit = ai.second;
        if (enode > 0)
            m_simulator->matrix().stampMatrix(m_nodeNum, enode, -admit);

        if (m_switched) // Find open/close events
        {
            if (admit > 0)
                nonCero++;
            double admitP = m_admitPrev[enode];

            if ((admit != admitP) && ((admit == 0) || (admitP == 0)))
                m_simulator->matrix().setCircChanged();
        }
    }
    if (m_switched) {
        m_admitPrev = m_admit;
        if (nonCero < 2)
            m_totalAdmit += 1e-12; // pnpBias example error
    }
    m_simulator->matrix().stampMatrix(m_nodeNum, m_nodeNum, m_totalAdmit);
}

void eNode::stampCurr()
{
    m_simulator->matrix().stampCoef(m_nodeNum, m_totalCurr);
}

void eNode::solveSingle()
{
    double volt = 0;

    if (m_totalAdmit > 0)
        volt = m_totalCurr / m_totalAdmit;
    setVolt(volt);
}

std::vector<int> eNode::getConnections()
{
    std::vector<int> cons;
    for (const auto& entry : m_nodeList) {
        int nodeNum = entry.second;
        if (m_admit[nodeNum] > 0)
            cons.push_back(nodeNum);
    }
    return cons;
}

void eNode::setVolt(double v)
{
    
    if (fabs(m_volt - v) > 1e-9) //( m_volt != v )
    {
        
        m_voltChanged = true;
        m_volt        = v;

        for (eElement *el : m_changedFast)
            m_simulator->addToChangedFast(el); // el->setVChanged();
        for (eElement *el : m_reactiveList)
            m_simulator->addToReactiveList(el);
        for (eElement *el : m_nonLinear)
            m_simulator->addToNoLinList(el);
    }
}
double eNode::getVolt()
{
    return m_volt;
}

void eNode::setIsBus(bool bus)
{
    m_isBus = bus;

    m_simulator->remFromEnodeList(this, /*delete=*/false);
    m_simulator->addToEnodeBusList(this);
}

bool eNode::isBus()
{
    return m_isBus;
}

void eNode::createBus()
{
    int busSize = m_eBusPinList.size();

    

    m_eNodeList.clear();
    for (int i = 0; i < busSize; i++) {
        std::vector<ePin *> pinList = m_eBusPinList.at(i);

        eNode *enode = 0l;

        if (!pinList.empty()) {
            enode = new eNode(*m_simulator, m_id + "-eNode-" + std::to_string(i));

            for (ePin *epin : pinList) {
                
                
                epin->setEnode(enode);
            }
        }
        m_eNodeList.push_back(enode);
    }
}

void eNode::addBusPinList(std::vector<ePin *> list, int line)
{
    int size    = line + 1;
    int busSize = m_eBusPinList.size();

    if (size > busSize) {
        for (int i = 0; i < size - busSize; i++) {
            std::vector<ePin *> newList;
            m_eBusPinList.push_back(newList);
        }
    }

    std::vector<ePin *> pinList = m_eBusPinList.at(line);
    for (ePin *epin : list) {
        if (!ws::contains(pinList, epin)) {
            pinList.push_back(epin);
            // epin->setEnode( this );
        }
    }
    
    // busSize<<"\n"<<pinList;
    m_eBusPinList.at(line) = pinList;
}

std::vector<ePin *> eNode::getEpins()
{
    return m_ePinList;
}

void eNode::addEpin(ePin *epin)
{
    
    
    if (!ws::contains(m_ePinList, epin))
        m_ePinList.push_back(epin);
}

void eNode::remEpin(ePin *epin)
{
    m_admitList.erase(epin); m_currList.erase(epin); m_nodeList.erase(epin);
    m_admitChanged=true; m_currChanged=true; m_changed=true;
    m_simulator->addToChangedNodeList(this); m_simulator->matrix().setCircChanged();
    
    
    if (ws::contains(m_ePinList, epin))
        ws::remove_one(m_ePinList, epin);

    
    


}

void eNode::addToChangedFast(eElement *el)
{
    if (!ws::contains(m_changedFast, el))
        m_changedFast.push_back(el);
}

void eNode::remFromChangedFast(eElement *el)
{
    ws::remove_one(m_changedFast, el);
}

void eNode::addToReactiveList(eElement *el)
{
    if (!ws::contains(m_reactiveList, el))
        m_reactiveList.push_back(el);
}

void eNode::remFromReactiveList(eElement *el)
{
    ws::remove_one(m_reactiveList, el);
}

void eNode::addToNoLinList(eElement *el)
{
    if (!ws::contains(m_nonLinear, el))
        m_nonLinear.push_back(el);
}

void eNode::remFromNoLinList(eElement *el)
{
    ws::remove_one(m_nonLinear, el);
}

void eNode::setSingle(bool single)
{
    m_single = single;
} // This eNode can calculate it's own Volt
bool eNode::isSingle()
{
    return m_single;
}

void eNode::setSwitched(bool switched)
{
    m_switched = switched;
} // This eNode has switches attached
bool eNode::isSwitched()
{
    return m_switched;
}

int eNode::getNodeNumber()
{
    return m_nodeNum;
}

std::string eNode::itemId()
{
    return m_id;
}
