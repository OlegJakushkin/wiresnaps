import {beforeAll,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import * as Blockly from 'blockly/core';
import {programFromWorkspace} from '../src/programming/blocks';
import {compile} from '../src/programming/compiler';
import {createLesson,prepareLesson,lessons,trafficProgram,dialProgram,workspaceFor} from '../src/lessons';
import {electricalCircuit,parseProject} from '../src/project';
import {reverseTerminals} from '../src/construction';
import {byId} from '../src/catalogue';
import {Mechanics} from '../src/mechanics';
import {simulationEnvironment} from '../src/environment';
import type {Project,Snapshot} from '../src/types';
let module:any;
beforeAll(async()=>{
 const factory=(await import(/* @vite-ignore */new URL('../public/engine/wiresnaps.mjs',import.meta.url).href)).default;
 module=await factory({wasmBinary:await readFile(new URL('../public/engine/wiresnaps.wasm',import.meta.url)),print:()=>{}});await Mechanics.init();
},30000);
function engine(p:Project){
 const h=module.ccall('ws_create','number',['number'],[10]);
 const call=(name:string,args:string[]=[],values:unknown[]=[])=>module.ccall(name,'number',['number',...args],[h,...values]);
 const read=():Snapshot=>JSON.parse(module.ccall('ws_snapshot','string',['number'],[h]));
 expect(call('ws_load',['string'],[JSON.stringify(electricalCircuit(p))])).toBe(1);
 const control=(c:object)=>expect(call('ws_control',['string'],[JSON.stringify(c)])).toBe(1);
 control({environment:simulationEnvironment(p)});for(const [id,hex] of Object.entries(p.firmware))expect(call('ws_load_firmware',['string','string'],[id,hex])).toBe(1);
 return {call,read,control,close:()=>module.ccall('ws_destroy',null,['number'],[h])};
}
const runtime=(target:string)=>readFile(new URL('../public/firmware/'+target+'-runtime.hex',import.meta.url),'utf8');
it.each([trafficProgram,dialProgram])('$target editable blocks compile to the matching supplied program',p=>{
 const w=new Blockly.Workspace();try{Blockly.serialization.workspaces.load(workspaceFor(p),w);expect(compile(programFromWorkspace(w,p.target)).bytes).toEqual(compile(p).bytes);}finally{w.dispose();}
});
it.each(lessons.filter(l=>!l.danger))('$name runs the intended circuit through WebAssembly',async lesson=>{
 const p=await prepareLesson(lesson.id,runtime);
 // Perform the authored lesson's first interaction, using the same input controls as the worker.
 for(const part of p.parts)if(byId[part.definition].interaction==='momentary')part.control.closed=true;
 const e=engine(p),mechanics=new Mechanics();mechanics.load(p);const motors=p.parts.some(p=>byId[p.definition].model==='motor');
 try{
  const duration=lesson.id==='traffic-code'?2.3:lesson.code?.12:motors?.5:.25;
  const lit=new Set<string>();let completed=false;
  for(let tick=0;tick<duration*100000;tick+=motors?100:1000){e.call('ws_advance',['number'],[motors?100:1000]);const s=e.read();expect(s.diagnostics,lesson.id).toEqual([]);expect(s.parts.filter(p=>p.failed),lesson.id).toEqual([]);expect(s.paused,JSON.stringify(s.events)).toBe(false);if(motors)e.control(mechanics.step(s,p));for(const part of s.parts)if(part.brightness>.02)lit.add(part.id);completed||=lesson.check(s,p);}
  expect(completed,JSON.stringify(e.read().parts.map(x=>({id:p.parts.find(y=>y.id===x.id)?.definition,v:x.voltage,bright:x.brightness,speed:x.angularVelocity})))).toBe(true);
  if(lesson.id==='traffic-code')expect(lit.size).toBe(3);
  if(lesson.id==='reverse-fan'||lesson.id==='one-way'){
   const part=p.parts.find(p=>p.definition===(lesson.id==='reverse-fan'?'6SCM1':'6SCD3'))!,reversed=engine(reverseTerminals(p,part.id));
   try{for(let i=0;i<50;i++)reversed.call('ws_advance',['number'],[1000]);const back=reversed.read();expect(back.diagnostics).toEqual([]);expect(back.paused).toBe(false);
    if(lesson.id==='reverse-fan')expect(back.parts.find(p=>p.id===part.id)!.angularVelocity*e.read().parts.find(p=>p.id===part.id)!.angularVelocity).toBeLessThan(0);
    else expect(back.parts.every(p=>p.brightness<.001)).toBe(true);
   }finally{reversed.close();}
  }
  if(lesson.id==='firefly-jar'){const button=p.parts.find(p=>p.definition==='6SCS2')!;e.control({parts:[{id:button.id,control:{closed:false}}]});e.call('ws_advance',['number'],[1000]);const first=e.read().parts.find(x=>byId[p.parts.find(y=>y.id===x.id)!.definition].model==='led')!.brightness;expect(first).toBeGreaterThan(0);for(let i=0;i<12;i++)e.call('ws_advance',['number'],[10000]);expect(e.read().parts.find(x=>byId[p.parts.find(y=>y.id===x.id)!.definition].model==='led')!.brightness).toBeLessThan(first);}
  if(lesson.id==='dial-code'){const button=p.parts.find(p=>p.definition==='6SCS2')!;e.control({parts:[{id:button.id,control:{closed:false}}]});for(let i=0;i<10;i++)e.call('ws_advance',['number'],[1000]);expect(e.read().parts.find(x=>byId[p.parts.find(y=>y.id===x.id)!.definition].model==='led')!.brightness).toBeLessThan(.001);}
  // Repeat actual close/open operations, rather than only testing the initial
  // energized state. This catches floating bases, wrong PNP polarity and stuck
  // relay contacts even when the first screenshot looks right.
  const switches=p.parts.filter(p=>['momentary','toggle'].includes(byId[p.definition].interaction));
  if(switches.length&&lesson.id!=='firefly-jar')for(const closed of [false,true,false,true]){
   e.control({parts:switches.map(part=>({id:part.id,control:{closed}}))});
   let illuminated=false;for(let tick=0;tick<12000;tick+=motors?100:1000){expect(e.call('ws_advance',['number'],[motors?100:1000]),JSON.stringify({closed,events:e.read().events,diagnostics:e.read().diagnostics})).toBe(1);if(motors)e.control(mechanics.step(e.read(),p));illuminated ||= e.read().parts.some(p=>p.brightness>.001);}
   const s=e.read();expect(s.diagnostics).toEqual([]);expect(s.paused).toBe(false);expect(s.parts.every(p=>!p.failed)).toBe(true);
   const read=(definition:string)=>s.parts.find(o=>p.parts.find(q=>q.id===o.id)?.definition===definition)!;
   if(['npn-lantern','pnp-lantern','transistor-team','tap-secret'].includes(lesson.id))expect(s.parts.some(p=>p.brightness>.001)).toBe(closed);
   if(lesson.id==='dial-code')expect(closed?illuminated:s.parts.some(p=>p.brightness>.001)).toBe(closed);
   if(lesson.id==='relay-race'){expect(read('6SCD2').brightness>.001).toBe(closed);expect(read('6SCD1').brightness>.001).toBe(!closed);}
   if(lesson.id==='tiny-switch'){expect(Math.abs(read('6SCQ2').current)>.00001).toBe(closed);if(!closed)expect(Math.abs(read('6SCQ2').current)).toBeLessThan(1e-7);}
   if(lesson.id==='wire-flyover'){expect(read('6SCD1').brightness>.001).toBe(closed);expect(read('6SCL1').brightness).toBeGreaterThan(.05);}
  }
  if(lesson.id==='gear-buddies'){
   const gear=p.parts.find(p=>p.definition==='6SCGEAR2')!,motor=p.parts.find(p=>p.definition==='6SCGM')!,free=e.read().parts.find(p=>p.id===motor.id)!;
   gear.control.blocked=true;
   for(let i=0;i<100;i++){e.call('ws_advance',['number'],[100]);e.control(mechanics.step(e.read(),p));}
   const stuck=e.read().parts.find(p=>p.id===motor.id)!;expect(stuck.angularVelocity).toBe(0);expect(stuck.current).toBeGreaterThan(free.current);expect(stuck.temperature).toBeGreaterThan(free.temperature);
   gear.control.blocked=false;for(let i=0;i<100;i++){e.call('ws_advance',['number'],[100]);e.control(mechanics.step(e.read(),p));}expect(e.read().parts.find(p=>p.id===motor.id)!.angularVelocity).toBeGreaterThan(0);
   const sw=switches[0];e.control({parts:[{id:sw.id,control:{closed:false}}]});
   let previous=Infinity; // Allow the one fixed coupling step already in flight.
   for(let i=0;i<2000;i++){e.call('ws_advance',['number'],[100]);e.control(mechanics.step(e.read(),p));const speed=Math.abs(e.read().parts.find(p=>p.id===motor.id)!.angularVelocity);expect(speed).toBeLessThanOrEqual(previous+1e-6);previous=speed;}
   const stopped=e.read().parts.find(p=>p.id===motor.id)!;expect(stopped.angularVelocity).toBe(0);
   for(let i=0;i<100;i++){e.call('ws_advance',['number'],[100]);e.control(mechanics.step(e.read(),p));}expect(e.read().parts.find(p=>p.id===motor.id)!.angle).toBe(stopped.angle);
   e.control({parts:[{id:sw.id,control:{closed:true}}]});for(let i=0;i<200;i++){e.call('ws_advance',['number'],[100]);e.control(mechanics.step(e.read(),p));}expect(e.read().parts.find(p=>p.id===motor.id)!.angularVelocity).toBeGreaterThan(1);
  }
 }finally{e.close();mechanics.dispose();}
},90000);
it.each(lessons.filter(l=>l.danger))('$name fails its intended component, stays broken and is prevented in Guided mode',async lesson=>{
 const p=createLesson(lesson.id);const target={'break-bulb':'6SCL1','break-led':'6SCD1','break-npn':'6SCQ2','break-motor':'6SCM1'}[lesson.id]!;const part=p.parts.find(x=>x.definition===target)!;
 const e=engine(p);let failed:Snapshot['parts'][number]|undefined;
 try{for(let i=0;i<350;i++){e.call('ws_advance',['number'],[10000]);const s=e.read();expect(s.diagnostics).toEqual([]);failed=s.parts.find(x=>x.id===part.id&&x.failed);if(failed)break;if(i%10===0)await new Promise(resolve=>setTimeout(resolve,0));}
  expect(failed).toBeDefined();e.call('ws_reset');expect(e.read().parts.find(x=>x.id===part.id)?.failed).toBe(true);
  part.damage={failed:true,failure:failed!.failure,temperature:failed!.temperature,stress:failed!.stress};const restored=engine(parseProject(JSON.stringify(p)));try{expect(restored.read().parts.find(x=>x.id===part.id)?.failed).toBe(true);restored.call('ws_repair',['string'],[part.id]);expect(restored.read().parts.find(x=>x.id===part.id)?.failed).toBe(false);}finally{restored.close();}
 }finally{e.close();}
 const guided=createLesson(lesson.id);guided.mode='guided';const safe=engine(guided);try{for(let i=0;i<350&&!safe.read().paused;i++){safe.call('ws_advance',['number'],[10000]);if(i%10===0)await new Promise(resolve=>setTimeout(resolve,0));}const s=safe.read();expect(s.paused).toBe(true);expect(s.parts.every(p=>!p.failed)).toBe(true);expect(s.events.some(e=>e.code==='DAMAGE_PREVENTED')).toBe(true);}finally{safe.close();}
},120000);
