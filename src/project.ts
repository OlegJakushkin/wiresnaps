import { z } from 'zod';
import { uniqueId } from './id';
import { byId, CATALOGUE_VERSION } from './catalogue';
import type { Project,Instance,Vec3,Definition } from './types';
import {preferSnapConnectors} from './snap-routing';
import {simulationEnvironment} from './environment';
export {bounds,canPlace} from './construction';
const vec=z.tuple([z.number().finite(),z.number().finite(),z.number().finite()]);
const instance=z.object({id:z.string().min(1).max(80),definition:z.string(),position:vec,rotation:z.number().int().min(0).max(3),control:z.record(z.string(),z.union([z.number().finite(),z.boolean()])),damage:z.object({failed:z.boolean(),failure:z.string(),temperature:z.number().finite(),stress:z.number().nonnegative()}).optional()});
const endpoint=z.object({part:z.string(),terminal:z.string(),snap:z.number().int().nonnegative().optional()});
export const projectSchema=z.object({schemaVersion:z.literal(2),catalogueVersion:z.literal(CATALOGUE_VERSION),id:z.string().min(1),name:z.string().max(100),revision:z.number().int().nonnegative(),mode:z.enum(['guided','experiment']),parts:z.array(instance).max(256),connections:z.array(z.object({id:z.string(),from:endpoint,to:endpoint,kind:z.enum(['wire','mechanical'])})).max(1024),workspaces:z.record(z.string(),z.record(z.string(),z.unknown())),firmware:z.record(z.string(),z.string().max(2000000)),environment:z.object({light:z.number().min(0).max(2),sound:z.number().min(0).max(1),temperature:z.number().min(-20).max(60),wind:z.number().min(0).max(20)}),presentation:z.object({night:z.boolean(),naming:z.enum(['none','snap','znatok']),quality:z.enum(['auto','high','low'])}),lesson:z.object({templateId:z.string(),version:z.literal(1),step:z.number().int().nonnegative(),completed:z.boolean()}).optional()});
export function parseProject(text:string):Project {
 if(text.length>8_000_000)throw Error('This project file is too large.');
 const raw=JSON.parse(text);if(raw.schemaVersion===1){raw.schemaVersion=2;raw.presentation={night:false,naming:'none',quality:'auto'};}
 const p=projectSchema.parse(raw);const ids=new Set<string>();
 for(const part of p.parts){if(!byId[part.definition])throw Error('This project uses an unknown part.');if(ids.has(part.id))throw Error('Two parts have the same ID.');ids.add(part.id);}
 for(const c of p.connections)for(const end of [c.from,c.to]){const part=p.parts.find(x=>x.id===end.part);if(!part)throw Error('A connection has a missing part.');const d=byId[part.definition];if(!(c.kind==='wire'?d.terminals:d.attachments).some(t=>t.id===end.terminal))throw Error('A connection has a missing snap.');if(end.snap!==undefined&&(c.kind!=='wire'||d.snaps[end.snap]?.terminal!==end.terminal))throw Error('A wire has a missing metal snap.');}
 return p;
}
export function emptyProject():Project{return {schemaVersion:2,catalogueVersion:CATALOGUE_VERSION,id:uniqueId(),name:'My little invention',revision:0,mode:'guided',parts:[],connections:[],workspaces:{},firmware:{},environment:{light:1,sound:0,temperature:20,wind:0},presentation:{night:false,naming:'none',quality:'auto'}};}
export function place(definition:string,position:Vec3,rotation=0):Instance{return {id:uniqueId(),definition,position,rotation,control:{closed:byId[definition]?.interaction!=='momentary'}};}
export function worldPoint(part:Instance,point:Vec3):Vec3 {const [x,y,z]=point;const r=part.rotation*Math.PI/2;return [part.position[0]+Math.round((x*Math.cos(r)-z*Math.sin(r))*1000)/1000,part.position[1]+y,part.position[2]+Math.round((x*Math.sin(r)+z*Math.cos(r))*1000)/1000];}
export function snapped(a:Vec3,b:Vec3){return Math.abs(a[0]-b[0])<.05&&Math.abs(a[2]-b[2])<.05&&Math.abs(Math.abs(a[1]-b[1])-1)<.05;}
export function electricalCircuit(project:Project,detached:ReadonlySet<string>=new Set(),detachedWires:ReadonlySet<string>=new Set()){
 const parent=new Map<string,string>();const key=(p:string,t:string)=>p+':'+t;
 const root=(x:string):string=>{const next=parent.get(x);if(!next){parent.set(x,x);return x;}if(next===x)return x;const r=root(next);parent.set(x,r);return r;};
 const join=(a:string,b:string)=>parent.set(root(a),root(b));
 const snaps=project.parts.flatMap(p=>byId[p.definition].snaps.map(s=>({part:p.id,key:key(p.id,s.terminal),point:worldPoint(p,s.position)})));
 for(let i=0;i<snaps.length;i++)for(let j=i+1;j<snaps.length;j++)if(snaps[i].part!==snaps[j].part&&detached.has(snaps[i].part)===detached.has(snaps[j].part)&&snapped(snaps[i].point,snaps[j].point))join(snaps[i].key,snaps[j].key);
 for(const c of project.connections)if(c.kind==='wire'&&!detachedWires.has(c.id))join(key(c.from.part,c.from.terminal),key(c.to.part,c.to.terminal));
 const supply=project.parts.find(p=>byId[p.definition].model==='battery');const ground=supply?root(key(supply.id,'b')):undefined;
 return {schemaVersion:1,revision:project.revision,mode:project.mode,environment:simulationEnvironment(project),parts:project.parts.map(p=>{const d=byId[p.definition];return {id:p.id,model:d.model,parameters:d.parameters,terminals:d.terminals.map(t=>root(key(p.id,t.id))===ground?'0':root(key(p.id,t.id))),control:p.control,...p.damage};})};
}
export const starter=():Project=>{
 const p=emptyProject();p.name='A little spark';
 // Shared geometry chooses rigid snap routes around the component bodies.
 const b=place('6SCB1',[3,0,3]),s=place('6SCS1',[7,0,3]),l=place('6SCL1',[7,0,6]);
 p.parts=[b,s,l];p.connections=[{id:uniqueId(),kind:'wire',from:{part:b.id,terminal:'a'},to:{part:s.id,terminal:'a'}},{id:uniqueId(),kind:'wire',from:{part:s.id,terminal:'b'},to:{part:l.id,terminal:'a'}},{id:uniqueId(),kind:'wire',from:{part:l.id,terminal:'b'},to:{part:b.id,terminal:'b'}}];return preferSnapConnectors(p);
};
export class History {
 private undoStack:Project[]=[];private redoStack:Project[]=[];
 commit(current:Project,next:Project){this.undoStack.push(structuredClone(current));if(this.undoStack.length>100)this.undoStack.shift();this.redoStack=[];return {...next,revision:current.revision+1};}
 undo(current:Project){const p=this.undoStack.pop();if(!p)return current;this.redoStack.push(structuredClone(current));return {...p,revision:current.revision+1};}
 redo(current:Project){const p=this.redoStack.pop();if(!p)return current;this.undoStack.push(structuredClone(current));return {...p,revision:current.revision+1};}
}
