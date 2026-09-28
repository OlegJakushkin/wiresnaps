import {beforeAll,describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {compile,packageFirmware,type Target,type Statement} from '../src/programming/compiler';
import {Mechanics} from '../src/mechanics';
import {emptyProject,place,electricalCircuit} from '../src/project';
import {attach} from '../src/construction';
import type {Snapshot} from '../src/types';

let module:any;
beforeAll(async()=>{
 // The same exported C ABI used by the dedicated browser worker.
 const path=new URL('../public/engine/wiresnaps.mjs',import.meta.url).href;
 const factory=(await import(/* @vite-ignore */ path)).default;
 module=await factory({wasmBinary:await readFile(new URL('../public/engine/wiresnaps.wasm',import.meta.url)),print:()=>{}});
 await Mechanics.init();
},30000);
function engine(document:object){
 const handle=module.ccall('ws_create','number',['number'],[10]);
 const call=(name:string,types:string[]=[],values:unknown[]=[])=>module.ccall(name,'number',['number',...types],[handle,...values]);
 const read=():Snapshot=>JSON.parse(module.ccall('ws_snapshot','string',['number'],[handle]));
 expect(call('ws_load',['string'],[JSON.stringify(document)])).toBe(1);
 return {call,read,close:()=>module.ccall('ws_destroy',null,['number'],[handle])};
}
describe.each(['atmega328p','pic16f877a'] as Target[])('%s compiler to electrical pins',target=>{
 it('executes loops, conditions, arithmetic, timing, ADC, GPIO and serial through the actual emulator',async()=>{
  const pin=target==='atmega328p'?13:0;
  const actualPin=target==='atmega328p'?13:33,adcPin=target==='atmega328p'?14:2;
  const n=(value:number)=>({kind:'number' as const,value});
  const start:Statement[]=[
   {id:'count',kind:'set',slot:0,value:n(0)},
   {id:'loop',kind:'repeat',count:n(4),body:[{id:'add',kind:'set',slot:0,value:{kind:'binary',op:'+',left:{kind:'variable',slot:0},right:n(1)}}]},
   {id:'if',kind:'if',condition:{kind:'binary',op:'=',left:{kind:'variable',slot:0},right:n(4)},then:[{id:'ok',kind:'serial',value:n(75)}],otherwise:[{id:'bad',kind:'serial',value:n(88)}]},
   {id:'sensor',kind:'set',slot:1,value:{kind:'adc',pin:0}},
   {id:'adc',kind:'serial',value:{kind:'variable',slot:1}},
   {id:'wait',kind:'wait',milliseconds:2},{id:'out',kind:'write',pin,value:n(1)},
  ];
  const firmware=packageFirmware(await readFile(new URL('../public/firmware/'+(target==='atmega328p'?'avr':'pic')+'-runtime.hex',import.meta.url),'utf8'),compile({version:1,target,start}));
  const e=engine({schemaVersion:1,mode:'experiment',parts:[
   {id:'supply',model:'battery',terminals:['v','0'],parameters:{voltage:5,internalResistance:.2}},
   {id:'cpu',model:'mcu',terminals:['v','0','out','sense'],parameters:{profile:target,gpio:[actualPin,adcPin]}},
   {id:'load',model:'resistor',terminals:['out','0'],parameters:{resistance:1000}},
   {id:'r1',model:'resistor',terminals:['v','sense'],parameters:{resistance:1000}},
   {id:'r2',model:'resistor',terminals:['sense','0'],parameters:{resistance:1000}},
  ]});
  try{
   expect(e.call('ws_load_firmware',['string','string'],['cpu',firmware])).toBe(1);
   let serial='';for(let i=0;i<100;i++){expect(e.call('ws_advance',['number'],[100])).toBe(1);serial+=e.read().parts[1].serial??'';}
   expect(serial[0]).toBe('K');expect(serial.charCodeAt(1)).toBeGreaterThanOrEqual(120);expect(serial.charCodeAt(1)).toBeLessThanOrEqual(135);
   const s=e.read();expect(s.diagnostics).toEqual([]);expect(s.parts[2].voltage).toBeGreaterThan(4.7);
   expect(-s.parts[0].current).toBeGreaterThan(s.parts[2].current); // Pin energy comes from VCC.
   e.call('ws_control',['string'],[JSON.stringify({powered:false})]);e.call('ws_advance',['number'],[100]);expect(e.read().parts[2].voltage).toBeLessThan(.01);
  }finally{e.close();}
 });
});
it('rejects invalid circuit loads while preserving the last valid observations',()=>{
 const e=engine({schemaVersion:1,parts:[{id:'b',model:'battery',terminals:['v','0']}]});
 try{const valid=e.read();expect(e.call('ws_load',['string'],['{"schemaVersion":1,"parts":[{"id":"x","model":"resistor","terminals":["v","0"],"parameters":{"resistance":0}}]}'])).toBe(0);expect(e.read().parts).toEqual(valid.parts);expect(e.read().diagnostics[0].code).toContain('POSITIVE');}finally{e.close();}
});
it('couples a blocked and externally driven motor to Rapier on fixed intervals',()=>{
 let project=emptyProject();project.mode='experiment';const m=place('6SCM1',[4,0,4]),fan=place('6SCM1F',[1,0,1]);project.parts=[m,fan];project=attach(project,fan.id,m.id);
 const mechanics=new Mechanics();mechanics.load(project);const e=engine(electricalCircuit(project));
 try{
  m.control.driveTorque=.003;
  for(let i=0;i<150;i++){e.call('ws_advance',['number'],[100]);e.call('ws_control',['string'],[JSON.stringify(mechanics.step(e.read(),project))]);}
  expect(e.read().parts[0].angularVelocity).toBeGreaterThan(10);expect(e.read().parts[0].voltage).toBeGreaterThan(.05);
  m.control.blocked=true;
  for(let i=0;i<5;i++){e.call('ws_advance',['number'],[100]);e.call('ws_control',['string'],[JSON.stringify(mechanics.step(e.read(),project))]);}
  expect(e.read().parts[0].angularVelocity).toBe(0);
  m.control.blocked=false;m.control.driveTorque=0;project.environment.wind=12;
  for(let i=0;i<100;i++){e.call('ws_advance',['number'],[100]);e.call('ws_control',['string'],[JSON.stringify(mechanics.step(e.read(),project))]);}
  expect(e.read().parts[0].voltage).toBeGreaterThan(.05);
 }finally{e.close();mechanics.dispose();}
});
