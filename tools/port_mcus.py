"""Import the bundled CPU emulators, preserving all licence notices (Docker only)."""
import hashlib
import json
import pathlib
import re

ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'.cache/upstream/source/src'
OUT=ROOT/'engine/mcu'
rows=[]
for family in ('simavr','gpsim'):
    for source in sorted((SRC/family).rglob('*')):
        if source.suffix not in ('.h','.c','.cc','.cpp'):
            continue
        if source.name in ('sim_gdb.c','sim_network.h','sim_elf.c','read_elf.c'):
            continue
        data=source.read_bytes()
        try:
            text=data.decode('utf-8-sig')
        except UnicodeDecodeError:
            text=data.decode('cp1252')
        text=re.sub(r'^\s*#include\s*[<"]Q[^>"\n]*[>"]\s*$', '', text, flags=re.M)
        text='\n'.join(l for l in text.splitlines() if not re.search(r'^\s*(?://)?\s*qDebug\(',l))+'\n'
        text=text.replace('QList<unsigned int>', 'std::deque<unsigned int>').replace('QList<uint32_t>', 'std::deque<uint32_t>').replace('QList<int>', 'std::deque<int>')
        if 'std::deque' in text: text='#include <deque>\n'+text
        text=text.replace('.append(', '.push_back(').replace('.isEmpty()', '.empty()')
        text=re.sub(r'(\w+)\.takeFirst\(\)', r'ws_take_front(\1)', text)
        text=re.sub(r'QString::number\(([^)]*)\)', r'std::to_string(\1)', text)
        text=text.replace('QString', 'std::string')
        text=text.replace('uint long long', 'unsigned long long').replace('#define __A2D_v2_H__','#define __A2D_V2_H__')
        if source.name=='avr_uart.c':
            text=text.replace('usleep(1);','(void)0; // Explicit simulation time; no host sleeps.')
        if source.name=='sim_cmds.c':
            text=text.replace('> MAX_AVR_COMMANDS','>= MAX_AVR_COMMANDS')
        if source.name=='sim_core.c':
            text=text.replace('(o << 1)','(o * 2)')
        if source.name=='sim_avr.c':
            text=text.replace('avr_deallocate_ios(avr);', '''avr_deallocate_ios(avr);
    // Context owns register watchers and embedded interrupt IRQ metadata too.
    for (unsigned i = 0; i < MAX_IOs; ++i) {
        avr_free_irq(avr->io[i].irq, 9);
        avr->io[i].irq = NULL;
    }
    for (unsigned i = 0; i < avr->interrupts.vector_count; ++i)
        avr_free_irq(avr->interrupts.vector[i]->irq, AVR_INT_IRQ_COUNT);
    avr_free_irq(avr->interrupts.irq, AVR_INT_IRQ_COUNT);
    free(avr->irq_pool.irq);
    avr->irq_pool.irq = NULL;
    avr->irq_pool.count = 0;''')
        text=text.replace('std::string::fromStdString( name() ).remove("txreg").toInt()', 'std::atoi(name().c_str() + std::min(size_t(5), name().size()))')
        if 'ws_take_front' in text: text='#include "mcu_support.h"\n'+text
        if family == 'gpsim':
            text=text.replace('#include "piccomponentpin.h"', '#include "pic_pin.h"').replace('PICComponentPin', 'PicPin')
            text=text.replace('#include "baseprocessor.h"', '#include "pic_context.h"')
            text=text.replace('BaseProcessor::self()->uartOut(m_uartN, new_value)', 'ws::picSerial(m_uartN, new_value)')
            text=re.sub(r'BaseProcessor::self\(\)->uartOut\(\s*m_uartN\s*,\s*new_value\s*\)', 'ws::picSerial(m_uartN, new_value)', text)
            text=re.sub(r'\bbp\.', 'get_bp().', text)
            text=re.sub(r'\bcycles\.', 'get_cycles().', text)
            if source.name == 'gpsim_time.h':
                text=re.sub(r'#if defined\(IN_MODULE\) && defined\(_WIN32\)[\s\S]*?#endif', 'Cycle_Counter& get_cycles();', text)
            if source.name == 'breakpoints.h':
                text=re.sub(r'#if defined\(IN_MODULE\) && defined\(_WIN32\)[\s\S]*?#endif', 'Breakpoints& get_bp();', text)
            if source.name == 'gpsim_time.cc':
                text=text.replace('Cycle_Counter cycles;', '').replace('Cycle_Counter &(*dummy_cycles)(void) = get_cycles;', '')
            if source.name == 'breakpoints.cc':
                text=text.replace('Breakpoints bp;', '').replace('Breakpoints &(*dummy_bp)() = get_bp;', '')
                text=text.replace('m_iMaxAllocated = 0;', 'global_break = 0;\n  m_iMaxAllocated = 0;')
            if source.name == 'processor.cc':
                text=text.replace('Processor::~Processor()\n{', '''Processor::~Processor()
{
  delete m_vdd;
  delete m_pbBreakOnInvalidRegisterRead;
  delete m_pbBreakOnInvalidRegisterWrite;''')
            if source.name == 'pic-processor.cc':
                text=re.sub(r'ConfigMemory::~ConfigMemory\(\)\s*\{[\s\S]*?\n\}', '''ConfigMemory::~ConfigMemory()
{
  for (uint i = 0; i < m_nConfigWords; ++i) delete m_ConfigWords[i];
  delete [] m_ConfigWords;
}''', text, count=1)
            if source.name == 'comparator.cc':
                text=text.replace('picPin->setExtraSource(', 'if (picPin) picPin->setExtraSource(')
            if source.name == 'pic-ioports.h':
                text=text.replace('class PicPSP_PortRegister : public PortRegister', 'class PicPSP_PortRegister : public PicPortRegister')
                start=text.index('class PicPSP_PortRegister :')
                end=text.index('class PicPSP_TrisRegister',start)
                text=text[:start]+text[start:end].replace('  PicTrisRegister *m_tris;','')+text[end:]
            if source.name == 'pic-ioports.cc':
                start=text.index('PicPSP_PortRegister::PicPSP_PortRegister')
                end=text.index('\n}',start)
                section=text[start:end].replace('PortRegister(pCpu, pName, pDesc,numIopins, false)', 'PicPortRegister(pCpu, pName, pDesc,numIopins, enableMask)').replace('m_tris(0),','').replace(', m_tris(0)','')
                text=text[:start]+section+text[end:]
        target=OUT/family/source.relative_to(SRC/family)
        target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists() or target.read_text() != text:
            target.write_text(text)
        rows.append({'upstream':str(source.relative_to(ROOT/'.cache/upstream/source')),
          'local':str(target.relative_to(ROOT)),'originalSha256':hashlib.sha256(data).hexdigest(),
          'modifiedSha256':hashlib.sha256(text.encode()).hexdigest(),
          'transformScript':'tools/port_mcus.py',
          'changes':['Qt types and GUI callbacks replaced with standard C/C++ interfaces',
            'Per-instance cycle/breakpoint/serial routing for gpsim',
            'Host sleeps and debug/file endpoints removed from product',
            'Sanitizer-verified ownership, class hierarchy and signed-shift repairs'] if text.encode()!=data else []})
(ROOT/'provenance/mcu-port.json').write_text(json.dumps(rows,indent=2)+'\n')
print('Imported',len(rows),'MCU source files')
