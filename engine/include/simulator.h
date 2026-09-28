#pragma once
#include "circmatrix.h"
#include "stl_support.h"

// Headless scheduler for the extracted SimulIDE component models. Each component
// stores this context explicitly. No process-wide simulation singleton exists.
class Simulator {
public:
    explicit Simulator(double stepUs = 10.0);
    ~Simulator();
    Simulator(const Simulator&) = delete;
    Simulator& operator=(const Simulator&) = delete;
    bool startSim();
    bool settle();
    bool advance();
    void pauseSim() { running_ = false; }
    void resumeSim() { running_ = true; }
    void runContinuous() { running_ = true; }
    bool isRunning() const { return running_; }
    bool isPaused() const { return !running_; }
    double reaClock() const { return stepUs_; }
    double stepsPerus() const { return 1.0 / stepUs_; }
    uint64_t step() const { return step_; }
    uint64_t circTime() const { return uint64_t(step_ * stepUs_ * 1000); }
    int circuitRate() const { return std::max(1, int(10000 / stepUs_)); }
    double NLaccuracy() const { return 1e-8; }
    CircMatrix& matrix() { return matrix_; }
    const std::string& error() const { return error_; }
    std::vector<eNode*> geteNodes() const { return nodes_; }
    ePin* createPin(std::string id, int index);
    void destroyPin(ePin* pin);
    void detachNode(eNode* node);
    void releasePins();
    void addToEnodeList(eNode* n);
    void remFromEnodeList(eNode* n, bool del);
    void addToEnodeBusList(eNode* n);
    void remFromEnodeBusList(eNode* n, bool del);
    void addToChangedNodeList(eNode* n);
    void remFromChangedNodeList(eNode* n);
    void addToElementList(eElement* e);
    void remFromElementList(eElement* e);
    void addToUpdateList(eElement* e);
    void remFromUpdateList(eElement* e);
    void addToChangedFast(eElement* e);
    void remFromChangedFast(eElement* e);
    void addToReactiveList(eElement* e);
    void remFromReactiveList(eElement* e);
    void addToSimuClockList(eElement* e);
    void remFromSimuClockList(eElement* e);
    void addToNoLinList(eElement* e);
    void remFromNoLinList(eElement* e);
private:
    bool solve();
    double stepUs_;
    uint64_t step_ = 0;
    uint64_t pinSequence_ = 0;
    bool running_ = false;
    std::string error_;
    CircMatrix matrix_;
    std::vector<eNode*> nodes_, buses_, changedNodes_;
    std::vector<eElement*> elements_, updates_, fast_, reactive_, clocks_, nonlinear_;
    std::vector<std::unique_ptr<ePin>> pins_;
};
