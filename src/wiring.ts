import {byId} from './catalogue';
import {physicalPoint,shapeBounds,type Bounds} from './construction';
import {worldPoint,snapped} from './project';
import type {Connection,Endpoint,Instance,Project,Vec3} from './types';

export function wireEndpointPoint(p:Project,end:Endpoint):Vec3{
 const part=p.parts.find(q=>q.id===end.part);if(!part)throw Error('This snap is no longer on the board.');
 const d=byId[part.definition],at=end.snap===undefined?d.terminals.find(t=>t.id===end.terminal)?.position:d.snaps[end.snap]?.position;
 if(!at)throw Error('This metal snap is no longer available.');return physicalPoint(part,[at[0],.31,at[2]]);
}
export function rewireConnection(p:Project,id:string,side:'from'|'to',target:Endpoint):Project{
 const c=p.connections.find(c=>c.id===id&&c.kind==='wire'),part=p.parts.find(p=>p.id===target.part);if(!c||!part)return p;
 const d=byId[part.definition],other=c[side==='from'?'to':'from'];
 if(!d.snaps.some(s=>s.terminal===target.terminal)||target.snap!==undefined&&d.snaps[target.snap]?.terminal!==target.terminal||other.part===target.part&&other.terminal===target.terminal)return p;
 const at=wireEndpointPoint(p,target),old=wireEndpointPoint(p,c[side]);if(c[side].part===target.part&&c[side].terminal===target.terminal&&at.every((v,i)=>v===old[i]))return p;
 return {...p,connections:p.connections.map(q=>q.id===id?{...q,[side]:{...target}}:q)};
}

export const conductor=(p:Instance)=>['wire','junction'].includes(byId[p.definition].model);
const touches=(a:Bounds,b:Bounds,pad=0)=>a.min[0]<b.max[0]+pad&&a.max[0]>b.min[0]-pad&&a.min[2]<b.max[2]+pad&&a.max[2]>b.min[2]-pad;
const segmentBox=(a:Vec3,b:Vec3,r=0):Bounds=>({min:[Math.min(a[0],b[0])-r,0,Math.min(a[2],b[2])-r],max:[Math.max(a[0],b[0])+r,0,Math.max(a[2],b[2])+r]});

// Protect the whole component face, not just the highest shape. Small windows
// around metal snaps let a strip leave outwards, but never cross the face.
// Subtracting rectangular windows keeps this conservative and rotation-safe.
function faceMasks(p:Instance):Bounds[]{
 const d=byId[p.definition],base=d.geometry.find(s=>s.role==='base');if(!base)return [];
 let cells=[{x0:base.at[0]-base.size[0]/2,x1:base.at[0]+base.size[0]/2,z0:base.at[2]-base.size[2]/2,z1:base.at[2]+base.size[2]/2}];
 for(const snap of d.snaps){const [x,,z]=snap.position,x0=x-.43,x1=x+.43,z0=z-.43,z1=z+.43;
  cells=cells.flatMap(b=>{
   const l=Math.max(b.x0,x0),r=Math.min(b.x1,x1),t=Math.max(b.z0,z0),bottom=Math.min(b.z1,z1);if(l>=r||t>=bottom)return [b];
   return [{...b,x1:l},{...b,x0:r},{x0:l,x1:r,z0:b.z0,z1:t},{x0:l,x1:r,z0:bottom,z1:b.z1}].filter(c=>c.x1-c.x0>.001&&c.z1-c.z0>.001);
  });
 }
 return cells.map(b=>shapeBounds(p,{kind:'box',at:[(b.x0+b.x1)/2,.16,(b.z0+b.z1)/2],size:[b.x1-b.x0,.01,b.z1-b.z0],color:''}));
}
const visibilityCache=new WeakMap<Instance,{key:string;rigid:Bounds[];cable:Bounds[]}>();
export function visibilityBounds(p:Instance,rigid=false):Bounds[]{
 const d=byId[p.definition];if(conductor(p))return [];
 const key=p.definition+':'+p.position.join(',')+':'+p.rotation,cached=visibilityCache.get(p);if(cached?.key===key)return rigid?cached.rigid:cached.cable;
 const shapes=d.geometry.filter(s=>s.role!=='snap'&&s.role!=='base'&&(s.role!=='detail'||s.collision===true));
 const bodies=shapes.map(s=>shapeBounds(p,s)),cable=d.model==='mcu'?shapes.filter(s=>s.size[1]>.04).map(s=>shapeBounds(p,s)):[...bodies];
 if(d.model!=='accessory')cable.push(shapeBounds(p,{kind:'box',at:[d.size[0]/2-.32,.169,Math.max(0,d.size[2]-.44)],size:[Math.min(1.25,d.size[0]-.12),.01,.16],color:''}));
 const entry={key,rigid:[...bodies,...faceMasks(p)],cable};visibilityCache.set(p,entry);return rigid?entry.rigid:entry.cable;
}
export function obscuresBody(wire:Instance,parts:Instance[]){
 const strip=shapeBounds(wire,byId[wire.definition].geometry.find(s=>s.role==='base')!);
 return parts.some(p=>p.id!==wire.id&&visibilityBounds(p,true).some(b=>(byId[p.definition].model!=='accessory'||strip.max[1]>b.max[1]-.02)&&touches(strip,b,.02)));
}

export interface WireTrace {parts:string[];wires:string[];terminals:Connection['from'][];}
export function traceWire(p:Project,id:string):WireTrace {
 const parent=new Map<string,string>(),key=(e:Connection['from'])=>e.part+':'+e.terminal;
 const root=(k:string):string=>{const a=parent.get(k);if(!a||a===k)return k;const r=root(a);parent.set(k,r);return r;};
 const join=(a:string,b:string)=>parent.set(root(a),root(b));
 for(const part of p.parts)if(conductor(part)){const ts=byId[part.definition].terminals;for(const t of ts)join(part.id+':'+ts[0].id,part.id+':'+t.id);}
 const snaps=p.parts.flatMap(part=>byId[part.definition].snaps.map(s=>({key:part.id+':'+s.terminal,part:part.id,at:worldPoint(part,s.position)})));
 for(let i=0;i<snaps.length;i++)for(let j=0;j<i;j++)if(snaps[i].part!==snaps[j].part&&snapped(snaps[i].at,snaps[j].at))join(snaps[i].key,snaps[j].key);
 for(const c of p.connections)if(c.kind==='wire')join(key(c.from),key(c.to));
 const part=p.parts.find(q=>q.id===id&&conductor(q)),wire=p.connections.find(c=>c.id===id&&c.kind==='wire');
 const net=part?root(part.id+':'+byId[part.definition].terminals[0].id):wire?root(key(wire.from)):undefined;
 if(!net)return {parts:[],wires:[],terminals:[]};
 return {parts:p.parts.filter(q=>conductor(q)&&root(q.id+':'+byId[q.definition].terminals[0].id)===net).map(q=>q.id),
  wires:p.connections.filter(c=>c.kind==='wire'&&root(key(c.from))===net).map(c=>c.id),
  terminals:p.parts.filter(q=>!conductor(q)).flatMap(q=>byId[q.definition].terminals.filter(t=>root(q.id+':'+t.id)===net).map(t=>({part:q.id,terminal:t.id})))};
}
export function terminalPaths(p:Project){
 const seen=new Set<string>(),paths:WireTrace[]=[];
 for(const id of [...p.parts.filter(conductor).map(p=>p.id),...p.connections.filter(c=>c.kind==='wire').map(c=>c.id)]){
  if(seen.has(id))continue;const trace=traceWire(p,id);[...trace.parts,...trace.wires].forEach(x=>seen.add(x));if(trace.terminals.length>1)paths.push(trace);
 }
 return paths;
}

// Deterministic quarter-pitch A*: no route is allowed through a visible body.
// Congestion costs separate neighbouring cables. Height is resolved afterwards
// against solid geometry, so crossing insulated cables never imply a connection.
const STEP=.25,MIN=-.75,NX=59,NZ=47;
const grid=(x:number,z:number)=>Math.round((z-MIN)/STEP)*NX+Math.round((x-MIN)/STEP);
const point=(i:number):Vec3=>[MIN+i%NX*STEP,0,MIN+Math.floor(i/NX)*STEP];
function search(a:Vec3,b:Vec3,blocked:Uint8Array,used:Float32Array):Vec3[]|undefined{
 const start=grid(a[0],a[2]),end=grid(b[0],b[2]);if(start<0||end<0||start>=NX*NZ||end>=NX*NZ)return;
 const costs=new Float64Array(NX*NZ).fill(Infinity),previous=new Int32Array(NX*NZ).fill(-1),open:number[]=[start],closed=new Uint8Array(NX*NZ);costs[start]=0;
 const heuristic=(i:number)=>Math.abs(i%NX-end%NX)+Math.abs(Math.floor(i/NX)-Math.floor(end/NX));
 while(open.length){let best=0;for(let j=1;j<open.length;j++)if(costs[open[j]]+heuristic(open[j])<costs[open[best]]+heuristic(open[best]))best=j;
  const at=open[best];open.splice(best,1);if(at===end){const out:Vec3[]=[];for(let q=end;q!==-1;q=previous[q])out.push(point(q));out.reverse();out[0]=a;out[out.length-1]=b;return out;}
  if(closed[at])continue;closed[at]=1;
  for(const d of [1,NX,-1,-NX]){const n=at+d;if(n<0||n>=NX*NZ||Math.abs(n%NX-at%NX)>1||closed[n]||blocked[n]&&n!==end)continue;
   const turn=previous[at]>=0&&at-previous[at]!==d?.22:0,next=costs[at]+1+used[n]+turn;
   if(next<costs[n]){costs[n]=next;previous[n]=at;open.push(n);}
  }
 }
}
export interface CableRoute {points:Vec3[];clear:boolean;}
export function clearWireRoutes(p:Project,override?:{id:string;side:'from'|'to';point:Vec3}):Map<string,CableRoute>{
 const routes=new Map<string,CableRoute>(),used=new Float32Array(NX*NZ);
 const masks=p.parts.flatMap(q=>visibilityBounds(q)),solid=p.parts.flatMap(q=>byId[q.definition].geometry.filter(s=>s.collision!==false&&(s.role!=='detail'||s.collision===true)).map(s=>shapeBounds(q,s)));
 const blocked=new Uint8Array(NX*NZ);for(let i=0;i<blocked.length;i++){const v=point(i);blocked[i]=masks.some(b=>touches(segmentBox(v,v,.085),b))?1:0;}
 for(const c of p.connections.filter(c=>c.kind==='wire')){
  const endpoint=(side:'from'|'to')=>override?.id===c.id&&override.side===side?override.point:wireEndpointPoint(p,c[side]);
  const a=endpoint('from'),b=endpoint('to'),path=search(a,b,blocked,used);
  // An imported snap may be trapped underneath another body. Preserve the
  // connection, explicitly report it as obstructed, and lift its cable clear.
  const xy=path??[a,[a[0],0,-.75] as Vec3,[b[0],0,-.75] as Vec3,b];
  const points:Vec3[]=[a];
  for(let i=0;i<xy.length;i++){
   const at=xy[i];let y=Math.max(.42,a[1]+.08,b[1]+.08);
   for(const box of solid)if(touches(segmentBox(xy[Math.max(0,i-1)],xy[Math.min(xy.length-1,i+1)],.07),box))y=Math.max(y,box.max[1]+.1);
   points.push([at[0],y,at[2]]);const n=grid(at[0],at[2]);if(n>=0&&n<used.length)used[n]+=2.5;
  }
  points.push(b);
  const compact=points.filter((v,i)=>{if(!i||i===points.length-1)return true;const a=points[i-1],b=points[i+1];return ![0,1,2].some(axis=>[0,1,2].filter(x=>x!==axis).every(x=>Math.abs(a[x]-v[x])<1e-6&&Math.abs(b[x]-v[x])<1e-6));});
  routes.set(c.id,{points:compact,clear:!!path});
 }
 return routes;
}
