import {byId} from './catalogue';
import {canPlace} from './construction';
import {electricalCircuit,place,worldPoint} from './project';
import {obscuresBody,traceWire} from './wiring';
import {uniqueId} from './id';
import type {Connection,Instance,Project,Vec3} from './types';
// Route authored demos at build time. Every proposed rigid route must preserve
// the original circuit connectivity and pass the same body test as hand building.
function groups(p:Project,original:Instance[]){
 const circuit=electricalCircuit(p),parent=new Map<string,string>();
 const root=(n:string):string=>{const a=parent.get(n);return a&&a!==n?root(a):n;};
 for(const part of circuit.parts)if(part.model==='wire')parent.set(root(part.terminals[0]),root(part.terminals[1]));
 const keys=original.flatMap(o=>{const part=circuit.parts.find(p=>p.id===o.id)!;return part.terminals.map(root);});
 return keys.map((key,i)=>keys.findIndex(k=>k===key)).join(',');
}
function at(p:Project,end:Connection['from']){const part=p.parts.find(p=>p.id===end.part)!,d=byId[part.definition];return worldPoint(part,end.snap===undefined?d.terminals.find(t=>t.id===end.terminal)!.position:d.snaps[end.snap].position);}
function route(p:Project,wire:Connection,waypoints:Vec3[],layer:number,flip:number):Project|undefined{
 const parts=[...p.parts],added:Instance[]=[];let firstLayer=layer,lastLayer=layer,segment=0;
 const append=(part:Instance)=>{if(parts.length>=256||!canPlace(part,parts)||byId[part.definition].model==='wire'&&obscuresBody(part,p.parts))return false;parts.push(part);added.push(part);return true;};
 for(let i=1;i<waypoints.length;i++){
  const start=waypoints[i-1],end=waypoints[i];const dx=end[0]-start[0],dz=end[2]-start[2];if(!dx&&!dz)continue;
  const length=Math.abs(dx+dz),direction=dx?dx>0?0:2:dz>0?1:3;let done=0;
  while(done<length){const span=Math.min(6,length-done),level=layer+(segment%2)*flip;if(level<0||level>8)return;
   if(!segment)firstLayer=level;lastLayer=level;
   const pos:Vec3=[start[0]+Math.sign(dx)*done,level,start[2]+Math.sign(dz)*done];
   if(!append(place('6SC0'+(span+1),pos,direction)))return;segment++;done+=span;
  }
 }
 if(!segment)return;
 for(const [point,endLayer] of [[waypoints[0],firstLayer],[waypoints[waypoints.length-1],lastLayer]] as const){
  // A rigid wire engages the top snap one layer below it.
  if(endLayer<=point[1])return;
  for(let y=point[1]+1;y<endLayer;y++){
   const there:Vec3=[point[0],y,point[2]];
   if(parts.some(p=>byId[p.definition].snaps.some(s=>worldPoint(p,s.position).every((v,i)=>Math.abs(v-there[i])<.01))))continue;
   if(!append(place('6SC01',there)))return;
  }
 }
 const result={...p,parts,connections:p.connections.filter(c=>c.id!==wire.id)};
 return groups(result,p.parts)===groups(p,p.parts)?result:undefined;
}
// A net authored as a star need not look like one. Connect nearby terminals in
// a minimum-length tree before choosing pieces, preserving exactly the nets.
function nearbyConnections(p:Project):Project{
 const remaining=p.connections.filter(c=>c.kind==='wire'),out=p.connections.filter(c=>c.kind!=='wire');
 const key=(e:Connection['from'])=>e.part+':'+e.terminal;
 while(remaining.length){const first=remaining.shift()!,ends=new Map([[key(first.from),first.from],[key(first.to),first.to]]),ids=[first.id];let changed=true;
  while(changed){changed=false;for(let i=remaining.length-1;i>=0;i--){const c=remaining[i];if(ends.has(key(c.from))||ends.has(key(c.to))){ends.set(key(c.from),c.from);ends.set(key(c.to),c.to);ids.push(c.id);remaining.splice(i,1);changed=true;}}}
  const todo=[...ends.values()],done=[todo.shift()!];let n=0;
  while(todo.length){let best={i:0,from:done[0],cost:Infinity};for(const from of done)for(let i=0;i<todo.length;i++){const a=at(p,from),b=at(p,todo[i]),cost=Math.abs(a[0]-b[0])+Math.abs(a[2]-b[2])+Math.abs(a[1]-b[1]);if(cost<best.cost)best={i,from,cost};}
   const to=todo.splice(best.i,1)[0];out.push({id:ids[n++],kind:'wire',from:best.from,to});done.push(to);
  }
 }
 return {...p,connections:out};
}
export function preferSnapConnectors(original:Project,only?:string):Project{
 let p=only?original:nearbyConnections(original);
 // Short connections first leave more clear corridors for the larger loops.
 const wires=p.connections.filter(c=>c.kind==='wire'&&(!only||c.id===only)).sort((a,b)=>{const length=(w:Connection)=>{const x=at(p,w.from),y=at(p,w.to);return Math.abs(x[0]-y[0])+Math.abs(x[2]-y[2]);};return length(a)-length(b);});
 for(const wire of wires){const a=at(p,wire.from),b=at(p,wire.to);if([...a,...b].some(x=>!Number.isInteger(x)))continue;
  const candidates:Vec3[][]=[[a,[b[0],0,a[2]],b],[a,[a[0],0,b[2]],b]];
  for(let x=0;x<=12;x++)candidates.push([a,[x,0,a[2]],[x,0,b[2]],b]);
  for(let z=0;z<=9;z++)candidates.push([a,[a[0],0,z],[b[0],0,z],b]);
  const length=(path:Vec3[])=>path.reduce((sum,v,i)=>i?sum+Math.abs(v[0]-path[i-1][0])+Math.abs(v[2]-path[i-1][2]):sum,0);
  candidates.sort((a,b)=>length(a)-length(b));
  let found:Project|undefined;
  // Tall blue scaffolds hide the experiment. Use a slim, automatically routed
  // cable when two low layers cannot fit a clear snap path.
  for(let layer=Math.max(a[1],b[1])+1;layer<=Math.min(7,Math.max(a[1],b[1])+2)&&!found;layer++)for(const path of candidates){for(const flip of [1,-1]){found=route(p,wire,path,layer,flip);if(found)break;}if(found)break;}
  if(found)p=found;
 }
 return p;
}
export function connectTerminals(p:Project,from:Connection['from'],to:Connection['to'],flexible=false):Project{
 const wire:Connection={id:uniqueId(),kind:'wire',from,to};const next={...p,connections:[...p.connections,wire]};
 return flexible?next:preferSnapConnectors(next,wire.id);
}

export function coveredConnectors(p:Project){return p.parts.filter(q=>byId[q.definition].model==='wire'&&obscuresBody(q,p.parts));}

// Rebuild only obstructing nets in a saved layout. Functional parts, supports,
// controls, damage, workspaces and firmware keep their identities and positions.
// The caller records this as one ordinary, reversible construction edit.
export function tidyWiring(p:Project):Project{
 const seen=new Set<string>(),traces=[];
 for(const wire of coveredConnectors(p)){if(seen.has(wire.id))continue;const trace=traceWire(p,wire.id);trace.parts.forEach(id=>seen.add(id));traces.push(trace);}
 const remove=new Set<string>();
 for(const trace of traces){
  // A failed connector may split the physical net. Retain the whole path rather
  // than accidentally bypassing that failure while changing its layout.
  if(trace.parts.some(id=>p.parts.find(q=>q.id===id)?.damage?.failed))continue;
  for(const id of trace.parts){const part=p.parts.find(q=>q.id===id)!;
   if(byId[part.definition].model==='wire'&&!p.connections.some(c=>c.kind==='mechanical'&&(c.from.part===id||c.to.part===id)))remove.add(id);
  }
 }
 if(!remove.size)return p;
 const affected=traces.filter(t=>t.parts.some(id=>remove.has(id))),cables=new Set(affected.flatMap(t=>t.wires));
 let next:Project={...p,parts:p.parts.filter(q=>!remove.has(q.id)),connections:p.connections.filter(c=>!cables.has(c.id)&&!remove.has(c.from.part)&&!remove.has(c.to.part))};
 for(const trace of affected){
  const ends=[...trace.terminals,...trace.parts.filter(id=>!remove.has(id)).map(id=>({part:id,terminal:byId[p.parts.find(q=>q.id===id)!.definition].terminals[0].id}))];
  for(let i=1;i<ends.length;i++)next.connections.push({id:uniqueId(),kind:'wire',from:ends[0],to:ends[i]});
 }
 // Engaged support snaps can already join endpoints; don't add duplicate leads.
 for(const wire of [...next.connections].filter(c=>c.kind==='wire')){
  const without={...next,connections:next.connections.filter(c=>c.id!==wire.id)};
  if(groups(next,next.parts)===groups(without,next.parts))next=without;
 }
 next=preferSnapConnectors(next);
 if(groups(p,next.parts.filter(q=>p.parts.some(old=>old.id===q.id)))!==groups(next,next.parts.filter(q=>p.parts.some(old=>old.id===q.id))))throw Error('The wiring could not be tidied without changing a connection.');
 return next;
}
