/// <reference lib="webworker" />
import { electricalCircuit } from './project';
import { Mechanics } from './mechanics';
import type { Project,Snapshot,WorkerCommand,WorkerReply,Controls } from './types';
import {validateConstruction} from './construction';
import {simulationEnvironment} from './environment';
type Wasm={ccall:(name:string,result:string|null,args:string[],values:unknown[])=>any};
let wasm:Wasm;let handle=0,project:Project|undefined,running=false,queued=false;
let generation=0;
let detached=new Set<string>();
let detachedWires=new Set<string>();
let profiles:{id:string;traceAddress:number;errorAddress:number}[]=[];
let lastWall=performance.now();
const serialLog=new Map<string,string>();
const mechanics=new Mechanics();
const send=(reply:WorkerReply,transfer:Transferable[]=[])=>self.postMessage(reply,transfer);
const call=(name:string,args:string[]=[],values:unknown[]=[])=>wasm.ccall(name,'number',['number',...args],[handle,...values]);
const controls=(value:object)=>call('ws_control',['string'],[JSON.stringify(value)]);
function applyControls(value:Controls){
 if(project){
  if(value.environment)project.environment={...project.environment,...value.environment};
  if(value.night!==undefined)project.presentation={...project.presentation,night:value.night};
  if(value.mode)project.mode=value.mode;
  for(const update of value.parts??[]){const part=project.parts.find(p=>p.id===update.id);if(part)part.control={...part.control,...update.control};}
 }
 const {night,...physical}=value;
 if(project&&(value.environment||night!==undefined))physical.environment=simulationEnvironment(project);
 controls(physical);
}
const read=():Snapshot=>JSON.parse(wasm.ccall('ws_snapshot','string',['number'],[handle]));
function captureSerial(snapshot:Snapshot){for(const part of snapshot.parts)if(part.serial)serialLog.set(part.id,((serialLog.get(part.id)??'')+part.serial).slice(-4096));}
function publish(snapshot=read(),speed=0,requestId?:number){snapshot.speed=speed;for(const part of snapshot.parts)part.serial=serialLog.get(part.id)??'';snapshot.trace=Object.fromEntries(snapshot.parts?.filter(p=>p.trace!==undefined).map(p=>[p.id,p.trace!])??[]);const values=new Float64Array(snapshot.parts?.flatMap(p=>[p.voltage,p.current,p.temperature,p.angularVelocity])??[]);send({version:2,projectId:project?.id??'',generation,type:'snapshot',snapshot,values,requestId},[values.buffer]);}
function tick(){
 queued=false;if(!running||!project)return;
 const start=performance.now();const before=read().time;let snapshot=read();const events:Snapshot['events']=[];
 // 1 ms coupling cadence is independent of messages and the display refresh rate.
 for(let i=0;i<10;i++){
  const ok=call('ws_advance',['number'],[100]);snapshot=read();events.push(...snapshot.events);captureSerial(snapshot);
  if(!ok||snapshot.diagnostics.length||snapshot.paused){running=false;break;}
  controls({...mechanics.step(snapshot,project),settle:false});
 }
 snapshot.events=events;const now=performance.now();publish(snapshot,(snapshot.time-before)/Math.max(.000001,(now-lastWall)/1000));lastWall=now;
 if(running){queued=true;setTimeout(tick,Math.max(0,10-(performance.now()-start)));}
}
function schedule(){if(!queued){queued=true;setTimeout(tick,0);}}
function loadCircuit(p:Project,preserveState:boolean){
 const circuit=electricalCircuit(p,detached,detachedWires);
 for(const part of circuit.parts)if(part.model==='mcu'){const profile=profiles.find(p=>p.id===part.parameters.profile);if(profile)part.parameters={...part.parameters,traceAddress:profile.traceAddress,errorAddress:profile.errorAddress};}
 if(!call('ws_load',['string'],[JSON.stringify({...circuit,preserveState})]))throw Error(read().diagnostics.map(d=>d.code).join(', ')||'The circuit could not be connected.');
}
function setRunning(value:boolean){running=value;controls({paused:!value});lastWall=performance.now();if(value)schedule();}
async function boot(){
 try{
  const url=new URL(/* @vite-ignore */ '../engine/wiresnaps.mjs',import.meta.url);
  // Vite leaves the locally bundled C ABI wrapper intact.
  const module=await import(/* @vite-ignore */ url.href);
  wasm=await module.default({locateFile:(name:string)=>new URL(name,url).href});
  await Mechanics.init();handle=wasm.ccall('ws_create','number',['number'],[10]);if(!handle)throw Error('The electrical engine could not start.');
  profiles=(await (await fetch(new URL(/* @vite-ignore */ '../firmware/profiles.json',import.meta.url))).json()).profiles;
  send({version:2,type:'ready'});
 }catch(e){send({version:2,projectId:'',generation,type:'error',message:String(e)});}
}
self.onmessage=({data}:{data:WorkerCommand})=>{
 try{
  if(data.version!==2)throw Error('This saved message uses a different engine version.');
  if(data.type!=='load'&&(data.projectId!==project?.id||data.generation!==generation))return;
  switch(data.type){
   case 'load':{
    const previous=project,retain=previous?.id===data.project.id,wasRunning=running,old=retain?read():undefined;
    running=false;project=data.project;generation=data.generation;detached.clear();detachedWires.clear();if(!retain)serialLog.clear();
    loadCircuit(project,retain);mechanics.load(project,old);
    for(const [id,hex] of Object.entries(project.firmware))if(!retain||previous?.firmware[id]!==hex)call('ws_load_firmware',['string','string'],[id,hex]);
    setRunning((retain?wasRunning:data.autoRun!==false)&&!validateConstruction(project.parts).length);publish();break;
   }
   case 'detach':if(project){const wasRunning=running;detached=new Set(data.parts);detachedWires=new Set(data.wires??[]);loadCircuit(project,true);setRunning(wasRunning);publish();}break;
   case 'run':if(project&&validateConstruction(project.parts).length)throw Error('Move the highlighted overlapping parts before running.');setRunning(true);publish();break;
   case 'pause':running=false;controls({paused:true});publish(read(),0,data.requestId);break;
   case 'step':{if(project&&validateConstruction(project.parts).length)throw Error('Fix the construction before stepping.');running=false;controls({paused:false});call('ws_advance',['number'],[100]);const snapshot=read();captureSerial(snapshot);if(project&&!snapshot.paused&&!snapshot.diagnostics.length)controls({...mechanics.step(snapshot,project),settle:false});controls({paused:true});publish();break;}
   case 'control':applyControls(data.controls);publish();break;
   case 'reset':{const resume=running;serialLog.clear();call('ws_reset');if(project)mechanics.load(project);setRunning(resume);publish();break;}
   case 'repair':{const resume=running;call('ws_repair',['string'],[data.id]);if(project)mechanics.load(project);setRunning(resume);publish();break;}
   case 'firmware':if(!call('ws_load_firmware',['string','string'],[data.id,data.hex]))throw Error('This firmware could not be loaded.');if(project)project.firmware[data.id]=data.hex;publish();break;
   case 'diagnostics':publish();break;
  }
 }catch(e){running=false;send({version:2,projectId:project?.id??'',generation,type:'error',message:String(e)});}
};
void boot();
