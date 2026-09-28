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

#ifndef ENODE_H
#define ENODE_H

#include "e-element.h"
#include "e-pin.h"

struct PinOrder { bool operator()(const ePin* a, const ePin* b) const { return a->sequence < b->sequence; } };

class eNode
{
  public:
    eNode(Simulator& sim, std::string id);
    ~eNode();

    std::string itemId();

    // void connectorChanged( int c ); // Keep the num of connectors using this
    // eNode
    void addEpin(ePin *epin);
    // void addSubEpin( ePin* epin );
    void remEpin(ePin *epin);

    void addToChangedFast(eElement *el);
    void remFromChangedFast(eElement *el);

    void addToReactiveList(eElement *el);
    void remFromReactiveList(eElement *el);

    void addToNoLinList(eElement *el);
    void remFromNoLinList(eElement *el);

    void stampCurrent(ePin *epin, double data);
    void stampAdmitance(ePin *epin, double data);

    void pinChanged(ePin *epin, int enodeNum);

    int getNodeNumber();
    void setNodeNumber(int n);

    double getVolt();
    void setVolt(double volt);
    bool voltchanged()
    {
        return m_voltChanged;
    }
    void setVoltChanged(bool changed)
    {
        m_voltChanged = changed;
    }

    void solveSingle();

    void initialize();
    void stampMatrix();
    void stampAdmit();
    void stampCurr();

    void setSingle(bool single); // This eNode can calculate it's own Volt
    bool isSingle();

    void setSwitched(bool switched); // This eNode has switches attached
    bool isSwitched();

    void setIsBus(bool bus);
    bool isBus();
    void createBus();
    void addBusPinList(std::vector<ePin *> list, int line);

    std::vector<ePin *> getEpins();
    // std::vector<ePin*> getSubEpins();
    std::vector<int> getConnections();

  private:
    Simulator* m_simulator;
    std::vector<ePin *> m_ePinList;
    // std::vector<ePin*>     m_ePinSubList;  // Used by Connector to find connected
    // dpins

    std::vector<std::vector<ePin *>> m_eBusPinList;
    std::vector<eNode *> m_eNodeList;

    std::vector<eElement *> m_changedFast;
    std::vector<eElement *> m_reactiveList;
    std::vector<eElement *> m_nonLinear;

    std::map<ePin *, double, PinOrder> m_admitList;
    std::map<ePin *, double, PinOrder> m_currList;
    std::map<ePin *, int, PinOrder> m_nodeList;

    std::map<int, double> m_admit;
    std::map<int, double> m_admitPrev;

    double m_totalCurr;
    double m_totalAdmit;

    double m_volt;
    int m_nodeNum;
    int m_numCons;

    std::string m_id;

    bool m_currChanged;
    bool m_admitChanged;
    bool m_voltChanged;
    bool m_changed;
    bool m_single;
    bool m_switched;
    bool m_isBus;
};
#endif
