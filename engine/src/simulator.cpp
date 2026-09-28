// Derived scheduling semantics from SimulIDE simulator.cpp, Santiago González.
// Copyright (C) 2012 Santiago González; Copyright (C) 2026 WireSnaps contributors.
// SPDX-License-Identifier: GPL-3.0-or-later
#include "simulator.h"
#include <utility>
Simulator::Simulator(double stepUs) : stepUs_(stepUs), matrix_(*this) {
    if (!std::isfinite(stepUs) || stepUs <= 0) throw std::invalid_argument("Invalid simulation step");
}
Simulator::~Simulator() = default;
ePin* Simulator::createPin(std::string id, int index) {
    pins_.push_back(std::make_unique<ePin>(std::move(id), index)); pins_.back()->sequence=++pinSequence_; return pins_.back().get();
}
void Simulator::releasePins() { pins_.clear(); }
void Simulator::destroyPin(ePin* pin) {
    auto it=std::find_if(pins_.begin(),pins_.end(),[&](const auto& p){return p.get()==pin;});
    if(it!=pins_.end()) pins_.erase(it);
}
void Simulator::detachNode(eNode* node) {
    for(auto& p:pins_) if(p->getEnode()==node) p->setEnode(nullptr);
}
template<class T> static void add(std::vector<T*>& v, T* p) { if (!ws::contains(v,p)) v.push_back(p); }
#define NODE_QUEUE(Name, member) \
void Simulator::addTo##Name(eNode* n) { add(member,n); } \
void Simulator::remFrom##Name(eNode* n, bool del) { ws::remove_one(member,n); if(del) delete n; }
NODE_QUEUE(EnodeList, nodes_)
NODE_QUEUE(EnodeBusList, buses_)
void Simulator::addToChangedNodeList(eNode* n) { add(changedNodes_, n); }
void Simulator::remFromChangedNodeList(eNode* n) { ws::remove_one(changedNodes_, n); }
#define ELEMENT_QUEUE(Name, member) \
void Simulator::addTo##Name(eElement* e) { add(member,e); } \
void Simulator::remFrom##Name(eElement* e) { ws::remove_one(member,e); }
ELEMENT_QUEUE(UpdateList, updates_)
ELEMENT_QUEUE(ChangedFast, fast_)
ELEMENT_QUEUE(ReactiveList, reactive_)
ELEMENT_QUEUE(SimuClockList, clocks_)
ELEMENT_QUEUE(NoLinList, nonlinear_)
void Simulator::addToElementList(eElement* e) { add(elements_, e); }
void Simulator::remFromElementList(eElement* e) {
    for (auto* v : {&elements_, &updates_, &fast_, &reactive_, &clocks_, &nonlinear_}) ws::remove_one(*v,e);
}
bool Simulator::solve() {
    auto changed = std::exchange(changedNodes_, {});
    for (auto* n : changed) n->stampMatrix();
    if (!matrix_.solveMatrix()) { error_ = "SINGULAR_CIRCUIT"; running_=false; return false; }
    for (auto* n : nodes_) if (!std::isfinite(n->getVolt()) || std::abs(n->getVolt()) > 1e9) {
        error_="NON_FINITE_SOLUTION"; running_=false; return false;
    }
    return true;
}
bool Simulator::settle() {
    std::vector<double> previous;
    for (auto* n : nodes_) previous.push_back(n->getVolt());
    for (int iteration=0; iteration<512; ++iteration) {
        auto fast = std::exchange(fast_, {});
        auto nonlinear = std::exchange(nonlinear_, {});
        for (auto* e : fast) if(!e->disabled()) e->setVChanged();
        for (auto* e : nonlinear) if(!e->disabled()) e->setVChanged();
        if (!solve()) break;
        if (fast_.empty() && nonlinear_.empty() && changedNodes_.empty()) return true;
    }
    if (error_.empty()) error_="NON_CONVERGENCE";
    running_=false;
    for (size_t i=0;i<nodes_.size();++i) nodes_[i]->setVolt(previous[i]);
    return false;
}
bool Simulator::startSim() {
    error_.clear(); step_=0;
    for (auto* n : buses_) n->initialize();
    for (auto* e : elements_) if(!e->disabled()) { e->resetState(); e->initialize(); }
    for (auto* n : buses_) n->createBus();
    fast_.clear(); nonlinear_.clear(); reactive_.clear(); changedNodes_.clear();
    for (auto* e : elements_) if(!e->disabled()) e->attach();
    for (size_t i=0;i<nodes_.size();++i) { nodes_[i]->initialize(); nodes_[i]->setNodeNumber(int(i)+1); }
    for (auto* e : elements_) if(!e->disabled()) e->stamp();
    matrix_.createMatrix(nodes_); running_=true;
    return settle();
}
bool Simulator::advance() {
    if (!running_) return false;
    ++step_;
    for (auto* e : clocks_) if(!e->disabled()) e->simuClockStep();
    auto reactive = std::exchange(reactive_, {});
    for (auto* e : reactive) if(!e->disabled()) e->setVChanged();
    if (!settle()) return false;
    for (auto* e : updates_) if(!e->disabled()) e->updateStep();
    return true;
}
