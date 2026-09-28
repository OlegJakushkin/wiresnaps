"""Build firmware and embed test inputs; run exclusively in the engine container."""
import pathlib,subprocess,json,shutil
r=pathlib.Path(__file__).resolve().parents[1]
out=r/'build/firmware';out.mkdir(parents=True,exist_ok=True)
def run(*args):subprocess.run(args,cwd=r,check=True)
run('avr-gcc','-mmcu=atmega328p','-DF_CPU=16000000UL','-Os','-o',str(out/'avr-diagnostic.elf'),'firmware/avr/diagnostic.c')
run('avr-objcopy','-O','ihex','-R','.eeprom',str(out/'avr-diagnostic.elf'),str(out/'avr-diagnostic.hex'))
run('gpasm','-o',str(out/'pic-diagnostic.hex'),'firmware/pic/diagnostic.asm')
run('avr-gcc','-mmcu=atmega328p','-DF_CPU=16000000UL','-Os','-o',str(out/'avr-runtime.elf'),'firmware/avr/runtime.c')
run('avr-objcopy','-O','ihex','-R','.eeprom',str(out/'avr-runtime.elf'),str(out/'avr-runtime.hex'))
run('gpasm','-o',str(out/'pic-runtime.hex'),'firmware/pic/runtime.asm')
h=r/'build/generated';h.mkdir(parents=True,exist_ok=True)
def record(address,data):
    values=[len(data),address>>8,address&255,0,*data]
    return ':'+''.join(f'{v:02X}' for v in [*values,(-sum(values))&255])+'\n'
def package(file,program,pic):
    text=(out/file).read_text().replace(':00000001FF','').strip()+'\n'
    payload=[v for b in program for v in ([b,0x34] if pic else [b])]
    for i in range(0,len(payload),16):text+=record((0x2000 if pic else 0x6000)+i,payload[i:i+16])
    return text+':00000001FF\n'
def program(pic):
    # Arithmetic, variables, logic, serial, GPIO, ADC, PWM, timing, source trace.
    return [20,7,0,1,24,1,3,7,1,2,6,1,1,4,1,9,5,3,0,
        2,0,18,1,2,1,5,8,1,1,9,10,10,14,0 if pic else 13,
        16,0,3,1,1,128,17,16 if pic else 6,13,1,0,20,123,0,19]
fixtures={'avrDiagnostic':(out/'avr-diagnostic.hex').read_text(),'picDiagnostic':(out/'pic-diagnostic.hex').read_text(),
    'avrRuntimeProgram':package('avr-runtime.hex',program(False),False),'picRuntimeProgram':package('pic-runtime.hex',program(True),True)}
symbols=subprocess.check_output(['avr-nm','-n',str(out/'avr-runtime.elf')],text=True)
addresses={line.split()[-1]:int(line.split()[0],16)&0xffff for line in symbols.splitlines() if len(line.split())==3}
header='\n'.join('static const char* '+name+' = R"HEX('+text+')HEX";' for name,text in fixtures.items())
header+='\nstatic constexpr unsigned avrTraceAddress='+str(addresses['ws_trace'])+';\n'
header+='static constexpr unsigned avrErrorAddress='+str(addresses['ws_error'])+';\n'
(h/'firmware_fixtures.h').write_text(header)
public=r/'public/firmware';public.mkdir(parents=True,exist_ok=True)
for name in ('avr-runtime.hex','pic-runtime.hex'):shutil.copyfile(out/name,public/name)
(public/'profiles.json').write_text(json.dumps({'schemaVersion':1,'bytecodeVersion':1,'profiles':[
    {'id':'atmega328p','firmware':'avr-runtime.hex','flashByteOffset':0x6000,'bytesPerInstruction':1,'bytecodeLimit':4096,'variableLimit':16,'stackLimit':32,'traceAddress':addresses['ws_trace'],'errorAddress':addresses['ws_error'],'clockHz':16000000,'gpio':list(range(20)),'pwm':[5,6],'adc':list(range(6))},
    {'id':'pic16f877a','firmware':'pic-runtime.hex','flashByteOffset':0x2000,'bytesPerInstruction':2,'bytecodeLimit':4096,'variableLimit':16,'stackLimit':32,'traceAddress':0x7a,'errorAddress':0x7c,'clockHz':4000000,'gpio':list(range(16)),'pwm':[16],'adc':list(range(8))}
]},indent=2)+'\n')
