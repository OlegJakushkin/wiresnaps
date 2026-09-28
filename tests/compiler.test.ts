import {it,expect} from 'vitest';
import {compile,packageFirmware,hexRecord} from '../src/programming/compiler';
import type {Program} from '../src/programming/compiler';
it('compiles typed loops, conditions and tracing into bounded bytecode',()=>{
 const p:Program={version:1,target:'atmega328p',start:[{id:'loop',kind:'repeat',count:{kind:'number',value:3},body:[{id:'pin',kind:'write',pin:6,value:{kind:'number',value:1}},{id:'wait',kind:'wait',milliseconds:500}]}]};
 const out=compile(p);expect(out.bytes.at(-1)).toBe(19);expect(Object.values(out.trace)).toEqual(['loop','pin','wait']);expect(out.bytes).toContain(12);expect(out.bytes).toContain(11);
});
it('rejects unsupported pins, overflow and expressions that exceed memory',()=>{
 expect(()=>compile({version:1,target:'pic16f877a',start:[{id:'dim',kind:'pwm',pin:6,value:{kind:'number',value:5}}]})).toThrow('16');
 expect(()=>compile({version:1,target:'atmega328p',start:[{id:'x',kind:'serial',value:{kind:'number',value:256}}]})).toThrow('255');
 expect(()=>compile({version:1,target:'atmega328p',start:Array.from({length:1000},(_,i)=>({id:String(i),kind:'wait',milliseconds:10}))})).toThrow('4096');
});
it('packages bytes into actual AVR and PIC program memory without compiler downloads',()=>{
 const runtime=hexRecord(0,[1,2,3,4])+'\n:00000001FF\n';const avr=compile({version:1,target:'atmega328p',start:[]});const pic=compile({version:1,target:'pic16f877a',start:[]});
 expect(packageFirmware(runtime,avr)).toContain(hexRecord(0x6000,[19]));expect(packageFirmware(runtime,pic)).toContain(hexRecord(0x2000,[19,0x34]));
 expect(()=>packageFirmware(':00000001FE',avr)).toThrow('checksum');expect(()=>packageFirmware(hexRecord(0x6000,[0])+'\n:00000001FF',avr)).toThrow('overwrite');
});
