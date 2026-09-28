"""Reproducible mechanical extraction. Follow with the checked-in headless adapter.

Run in Docker. Original notices are preserved; every changed file is inventoried.
No Qt compatibility library or Qt-named substitute types are introduced.
"""
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / '.cache/upstream/source/src/simulator'
OUT = ROOT / 'engine/derived'
rows = []
for source in sorted(SRC.rglob('*')):
    if source.suffix not in ('.h', '.cpp') or 'processors' in source.parts:
        continue
    if source.name in ('simulator.h', 'simulator.cpp'):
        continue
    original = source.read_bytes()
    text = original.decode('utf-8-sig')
    # Remove comments containing disabled desktop debug statements, not notices.
    text = '\n'.join(l.split('//',1)[0] if ('//' in l and ('qDebug' in l or 'QString' in l or 'QtCore' in l)) else l for l in text.splitlines()) + '\n'
    text = re.sub(r'^\s*#include\s*[<"](?:Q[^>"\n]*|circuit\.h|component\.h)[>"]\s*$', '', text, flags=re.M)
    text = re.sub(r'^\s*qDebug\(\)[^;]*;\s*$', '', text, flags=re.M)
    text = re.sub(r'^\s*Circuit::self\(\)->[^;]*;\s*$', '', text, flags=re.M)
    text = text.replace('MAINMODULE_EXPORT ', '')
    text = re.sub(r'\buint\b', 'unsigned', text)
    text = text.replace('QString::fromStdString', 'std::string').replace('QString::number', 'std::to_string')
    text = text.replace('QStringList', 'std::vector<std::string>').replace('QString', 'std::string')
    text = text.replace('QList', 'std::vector').replace('QVector', 'std::vector').replace('QHash<', 'std::map<')
    text = text.replace('.toStdString()', '')
    text = re.sub(r'pinName\.split\("-"\)\.last\(\)\.remove\("ePin"\)\.toInt\(\)', 'ws::suffix_number(pinName, "ePin")', text)
    text = re.sub(r'pinName\.remove\("(\w+)"\)\.toInt\(\)', r'ws::suffix_number(pinName, "\1")', text)
    text = re.sub(r'(\w+)\.contains\(([^)]*)\)', r'ws::contains(\1, \2)', text)
    text = re.sub(r'(\w+)->contains\(([^)]*)\)', r'ws::contains(*\1, \2)', text)
    text = re.sub(r'(\w+)\.removeOne\(([^)]*)\)', r'ws::remove_one(\1, \2)', text)
    text = re.sub(r'(\w+)->removeOne\(([^)]*)\)', r'ws::remove_one(*\1, \2)', text)
    text = text.replace('.isEmpty()', '.empty()').replace('.first()', '.front()').replace('.last()', '.back()')
    text = text.replace('->append(', '->push_back(')
    text = re.sub(r'\b(?!reid\b)(\w+)\.append\(', r'\1.push_back(', text)
    text = re.sub(r'(\w+)\.replace\(([^,]+),\s*([^;]+)\);', r'\1.at(\2) = \3;', text)
    text = re.sub(r'(\w+)\.fill\(\s*([^)]*)\)', r'std::fill(\1.begin(), \1.end(), \2)', text)
    # Every element and node explicitly receives its owning simulation context.
    text = re.sub(r'(\b(e\w+)\s*\()\s*std::string id', lambda m: m[1] + ('std::string id' if m[2] == 'ePin' else 'Simulator& sim, std::string id'), text)
    text = re.sub(r'(:\s*e\w+\s*\()\s*id\b', r'\1sim, id', text)
    text = re.sub(r'new (e(?!Pin\b)\w+)\s*\(', r'new \1(*m_simulator, ', text)
    text = re.sub(r'new ePin\s*\(', r'm_simulator->createPin(', text)
    text = text.replace('Simulator::self()->', 'm_simulator->').replace('CircMatrix::self()->', 'm_simulator->matrix().')
    text = text.replace('std::string id = 0', 'std::string id = ""')
    # Pins have one owner: the simulation context registry.
    text = re.sub(r'\bdelete (pin);', r'm_simulator->destroyPin(\1);', text)
    if source.name == 'e-element.h':
        text = text.replace('    virtual void initEpins();', '    bool disabled() const { return m_disabled; }\n    virtual void openCircuit() { m_disabled=true; for(auto* p:m_ePin) if(p) { p->stampAdmitance(0); p->stampCurrent(0); } }\n    virtual void initEpins();')
        text = text.replace('  protected:', '  protected:\n    bool m_disabled = false;')
        text = text.replace('class eElement', 'class Simulator;\n\nclass eElement')
        text = text.replace('  protected:', '  protected:\n    Simulator* m_simulator;')
    if source.name == 'e-element.cpp':
        text = text.replace('m_elmId = id;', 'm_simulator = &sim;\n    m_elmId = id;')
    if source.name == 'e-node.h':
        text = text.replace('class eNode\n', 'struct PinOrder { bool operator()(const ePin* a, const ePin* b) const { return a->sequence < b->sequence; } };\n\nclass eNode\n')
        text = text.replace('std::map<ePin *, double>', 'std::map<ePin *, double, PinOrder>').replace('std::map<ePin *, int>', 'std::map<ePin *, int, PinOrder>')
        text = text.replace('  private:', '  private:\n    Simulator* m_simulator;')
        text = text.replace('std::map<ePin *,', 'std::map<ePin *,')
    if source.name == 'e-node.cpp':
        text = re.sub(r'eNode::~eNode\(\)\s*\{[\s\S]*?\n}', 'eNode::~eNode()\n{\n    m_simulator->detachNode(this);\n    m_simulator->remFromEnodeList(this, false);\n    m_simulator->remFromChangedNodeList(this);\n}', text)
        text = text.replace('m_id      = id;', 'm_simulator = &sim;\n    m_id      = id;')
        text = text.replace('m_switched     = false;', 'm_totalAdmit = 0; m_totalCurr = 0; m_voltChanged = false;\n    m_switched     = false;')
        text = re.sub(r'QHashIterator<ePin \*, double> i\(m_admitList\);[^\n]*\n\s*while \(i.hasNext\(\)\) \{\s*i.next\(\);', 'for (const auto& i : m_admitList) {', text)
        text = re.sub(r'QHashIterator<int, double> ai\(\s*m_admit\);[^\n]*\n\s*while \(ai.hasNext\(\)\) \{\s*ai.next\(\);', 'for (const auto& ai : m_admit) {', text)
        text = text.replace('i.value()', 'i.second').replace('i.key()', 'i.first').replace('ai.value()', 'ai.second').replace('ai.key()', 'ai.first')
        text = text.replace('for (double current : m_currList)\n            m_totalCurr += current;', 'for (const auto& entry : m_currList)\n            m_totalCurr += entry.second;')
        text = text.replace('for (int nodeNum : m_nodeList) {', 'for (const auto& entry : m_nodeList) {\n        int nodeNum = entry.second;')
        text = text.replace('m_admit.clear();', 'for(auto& entry:m_admit) entry.second=0;')
        text = text.replace('void eNode::remEpin(ePin *epin)\n{', 'void eNode::remEpin(ePin *epin)\n{\n    m_admitList.erase(epin); m_currList.erase(epin); m_nodeList.erase(epin);\n    m_admitChanged=true; m_currChanged=true; m_changed=true;\n    m_simulator->addToChangedNodeList(this); m_simulator->matrix().setCircChanged();')
        # Node lifetimes belong to the circuit, not incidental detach operations.
        text = re.sub(r'    // If No epins then remove this enode[\s\S]*?\n}\n', '\n}\n', text)
    if source.name == 'e-pin.h':
        text = text.replace('  public:', '  public:\n    uint64_t sequence = 0; // Stable summation order, assigned by context.')
    if source.name == 'circmatrix.h':
        text = text.replace('void factorMatrix(', 'bool factorMatrix(')
        text = re.sub(r'(?<!~)CircMatrix\(\);', 'CircMatrix(Simulator& sim);', text)
        text = re.sub(r'    static CircMatrix \*self\(\)[\s\S]*?\n    }', '', text)
        text = text.replace('static CircMatrix *m_pSelf;', 'Simulator* m_simulator;')
    if source.name == 'circmatrix.cpp':
        text = text.replace('void CircMatrix::factorMatrix(', 'bool CircMatrix::factorMatrix(')
        text = text.replace('factorMatrix(ny, group);', 'if (!factorMatrix(ny, group)) return false;')
        text = text.replace('factorMatrix(n, i);', 'if (!factorMatrix(n, i)) return false;')
        text = text.replace('if (j != largestRow) // pivoting', 'if (largestRow < 0 || !std::isfinite(largest) || largest < 1e-18) return false;\n        if (j != largestRow) // pivoting')
        text = text.replace('a[j][j] = 1e-18; // avoid zeros', 'return false; // A singular system has no trustworthy solution')
        text = text.replace('m_aFaList.at(group) = a;', 'm_aFaList.at(group) = a;\n    return true;')
        text = text.replace('std::isnan(volt)', '!std::isfinite(volt)')
        text = text.replace('CircMatrix *CircMatrix::m_pSelf = 0l;', '')
        text = text.replace('CircMatrix::CircMatrix()', 'CircMatrix::CircMatrix(Simulator& sim)')
        text = text.replace('m_pSelf     = this;', 'm_simulator = &sim;')
        text = re.sub(r'    std::cout << "\\n  Initializing Matrix:[\s\S]*?std::endl;', '', text)
    if source.name == 'e-bjt.cpp':
        text = text.replace('srand(time(NULL));', '// Deterministic relaxation; no wall-clock seed.')
        text = text.replace('double r = (double)(std::rand() %10+1);', 'const double r = 4.0;')
    if source.name == 'e-bjt.h':
        text = text.replace('        virtual void resetState();', '        double baseCurrent() { return m_BEdiode->current(); }\n        void openCircuit() override { eResistor::openCircuit(); m_BEdiode->openCircuit(); m_BCdiode->openCircuit(); }\n        virtual void resetState();')
    if source.name == 'e-capacitor.cpp':
        text = text.replace('m_resist = m_tStep/m_cap;', 'm_tStep = m_simulator->reaClock()/1e6;\n    m_resist = m_tStep/m_cap;', 1)
    if source.name == 'e-clock.cpp':
        text = text.replace('m_stepsPC = 1e6/freq+0.5;', 'if (!std::isfinite(freq) || freq <= 0) throw std::invalid_argument("CLOCK_FREQUENCY");\n    m_stepsPC = 1e6*m_simulator->stepsPerus()/freq+0.5;')
        text = text.replace('m_freq = 1e6/m_stepsPC;', 'm_freq = 1e6*m_simulator->stepsPerus()/m_stepsPC;')
    if source.name == 'e-gate.h':
        text = text.replace('static bool m_oscCtrl;', 'bool m_oscCtrl = false;')
    if source.name == 'e-gate.cpp':
        text = text.replace('bool eGate::m_oscCtrl = false;', '')
        text = re.sub(r'    if\( step-m_lastStep < 2 \)[\s\S]*?    m_lastStep = step;', '    // Oscillations are bounded by the context and reported as non-convergence.\n    m_lastStep = step;', text)
    if source.name == 'e-i2c.h':
        text = text.replace('virtual void setComponent( Component* comp ) { m_comp = comp; }', 'void setStateCallback(std::function<void(int)> callback) { m_stateCallback = std::move(callback); }')
        text = text.replace('Component* m_comp;', 'std::function<void(int)> m_stateCallback;')
    if source.name == 'e-i2c.cpp':
        text = text.replace('m_comp = 0l;', '').replace('if( m_comp ) m_comp->inStateChanged(', 'if( m_stateCallback ) m_stateCallback(')
    if source.name == 'e-function.h':
        text = '#include "expression.h"\n'+text.replace('QScriptEngine m_engine;', 'std::vector<ws::Expression> m_expressions;')
    if source.name == 'e-function.cpp':
        text = original.decode('utf-8-sig').split('#include "e-function.h"')[0] + (ROOT/'engine/adapters/e-function.inc').read_text()
    # Standard-library includes are explicit and shared, not a compatibility API.
    text = '#include "stl_support.h"\n' + text
    if source.suffix == '.cpp':
        text = '#include "simulator.h"\n' + text
    target = OUT / source.relative_to(SRC)
    target.parent.mkdir(parents=True, exist_ok=True)
    if not target.exists() or target.read_text() != text:
        target.write_text(text)
    rows.append({'upstream': 'src/simulator/' + str(source.relative_to(SRC)), 'local': str(target.relative_to(ROOT)),
                 'originalSha256': hashlib.sha256(original).hexdigest(), 'modifiedSha256': hashlib.sha256(text.encode()).hexdigest(),
                 'changes': ['standard-library types', 'explicit simulation ownership', 'desktop calls removed', 'deterministic stepping integration']})
(ROOT / 'provenance/core-port.json').write_text(json.dumps(rows, indent=2) + '\n')
print(f'Extracted {len(rows)} core files')
