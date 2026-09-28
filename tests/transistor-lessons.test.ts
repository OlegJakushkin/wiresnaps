import {beforeAll,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createLesson} from '../src/lessons';
import {electricalCircuit} from '../src/project';
import {Mechanics} from '../src/mechanics';
import type {Snapshot} from '../src/types';

let wasm:any;
beforeAll(async()=>{const factory=(await import(/* @vite-ignore */new URL('../public/engine/wiresnaps.mjs',import.meta.url).href)).default;wasm=await factory({wasmBinary:await readFile(new URL('../public/engine/wiresnaps.wasm',import.meta.url)),print:()=>{}});await Mechanics.init();},30000);
function lab(id:string){
 const p=createLesson(id),h=wasm.ccall('ws_create','number',['number'],[10]),mechanics=new Mechanics();mechanics.load(p);
 const call=(name:string,args:string[]=[],values:unknown[]=[])=>wasm.ccall(name,'number',['number',...args],[h,...values]);
 const read=():Snapshot=>JSON.parse(wasm.ccall('ws_snapshot','string',['number'],[h]));
 const control=(controls:object)=>expect(call('ws_control',['string'],[JSON.stringify(controls)])).toBe(1);
 expect(call('ws_load',['string'],[JSON.stringify(electricalCircuit(p))])).toBe(1);
 const part=(definition:string)=>p.parts.find(q=>q.definition===definition)!;
 const observed=(definition:string)=>read().parts.find(q=>q.id===part(definition).id)!;
 const set=(definition:string,key:string,value:number|boolean)=>control({parts:[{id:part(definition).id,control:{[key]:value}}]});
 const advance=(seconds:number)=>{const motor=id.endsWith('fan'),chunk=motor?100:10000;for(let tick=0;tick<Math.round(seconds*100000);tick+=chunk){const ok=call('ws_advance',['number'],[Math.min(chunk,Math.round(seconds*100000)-tick)]);if(ok!==1)throw Error(JSON.stringify(read()));if(motor)control(mechanics.step(read(),p));}const s=read();expect(s.diagnostics).toEqual([]);expect(s.paused,JSON.stringify(s.events)).toBe(false);expect(s.parts.every(q=>!q.failed)).toBe(true);return s;};
 return {p,control,set,advance,observed,close:()=>{call('ws_destroy');mechanics.dispose();}};
}
it.each(['npn','pnp'])('%s sensor switches repeatedly with light, then its master switch disconnects the load',type=>{
 const e=lab(type+'-sensor');try{for(const light of [0,1,0,1]){e.control({environment:{...e.p.environment,light}});e.advance(.05);const bright=e.observed('6SCD1').brightness;expect(bright>.01,JSON.stringify({type,light,bright})).toBe(type==='npn'?light===0:light===1);}
  e.control({environment:{...e.p.environment,light:type==='npn'?0:1}});e.set('6SCS1','closed',false);e.advance(.05);expect(e.observed('6SCD1').brightness).toBeLessThan(.001);e.set('6SCS1','closed',true);e.advance(.05);expect(e.observed('6SCD1').brightness).toBeGreaterThan(.01);
 }finally{e.close();}
});
it.each(['npn','pnp'])('%s timer starts dark, holds a glow after release, fades and can be charged again',async type=>{
 const e=lab(type+'-timer');try{e.advance(.05);expect(e.observed('6SCD1').brightness).toBeLessThan(.001);
  for(let repeat=0;repeat<2;repeat++){e.set('6SCS2','closed',true);e.advance(1.2);const charged=e.observed('6SCD1').brightness;expect(charged).toBeGreaterThan(.02);e.set('6SCS2','closed',false);e.advance(.15);const held=e.observed('6SCD1').brightness;expect(held).toBeGreaterThan(.01);for(let i=0;i<6;i++){e.advance(1);await new Promise(resolve=>setTimeout(resolve,0));}expect(e.observed('6SCD1').brightness).toBeLessThan(.001);}
 }finally{e.close();}
},90000);
it.each(['npn','pnp'])('%s fan responds to its dial and switch without damaging the transistor',async type=>{
 const e=lab(type+'-fan');try{e.advance(.4);const fast=e.observed('6SCM1').angularVelocity;expect(fast).toBeGreaterThan(10);e.set('6SCRV','position',.6);e.advance(.6);const slow=e.observed('6SCM1').angularVelocity;expect(slow,JSON.stringify({fast,slow})).toBeGreaterThan(0);expect(slow).toBeLessThan(fast*.85);
  const coast=async()=>{let prior=Infinity;for(let i=0;i<8;i++){e.advance(1);const speed=e.observed('6SCM1').angularVelocity;expect(speed).toBeLessThan(prior);prior=speed;await new Promise(resolve=>setTimeout(resolve,0));if(speed<1)break;}expect(e.observed('6SCM1').angularVelocity).toBeLessThan(1);};
  e.set('6SCRV','position',.99);await coast();e.set('6SCRV','position',.05);e.advance(.4);expect(e.observed('6SCM1').angularVelocity).toBeGreaterThan(10);e.set('6SCS1','closed',false);await coast();expect(Math.abs(e.observed(type==='npn'?'6SCQ2':'6SCQ1').current)).toBeLessThan(1e-6);
 }finally{e.close();}
},90000);
