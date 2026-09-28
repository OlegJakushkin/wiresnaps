import {byId} from './catalogue';
import {gearsMesh} from './construction';
import type {Project} from './types';
export interface RotorDrive {driver:string;ratio:number;phase:number;}
// Ideal spur-gear constraint. Only supported, coplanar, matching pitch circles
// mesh. The same signed ratio drives rendering and reflected mechanical load.
export function rotorDrives(project:Project):Map<string,RotorDrive>{
 const edges=new Map<string,{to:string;ratio:number;phase:number}[]>();
 const edge=(a:string,b:string,ratio:number,phase=0)=>{edges.set(a,[...(edges.get(a)??[]),{to:b,ratio,phase}]);edges.set(b,[...(edges.get(b)??[]),{to:a,ratio:1/ratio,phase:-phase/ratio}]);};
 const mounted=new Set<string>();
 for(const c of project.connections.filter(c=>c.kind==='mechanical')){const parent=project.parts.find(p=>p.id===c.from.part),child=project.parts.find(p=>p.id===c.to.part);if(!parent||!child)continue;mounted.add(child.id);if(byId[parent.definition].model==='motor')edge(parent.id,child.id,1);}
 const gears=project.parts.filter(p=>byId[p.definition].shape==='gear'&&mounted.has(p.id));
 for(let i=0;i<gears.length;i++)for(let j=0;j<i;j++)if(gearsMesh(gears[i],gears[j])){
  const a=gears[j],b=gears[i],ta=Number(byId[a.definition].parameters.teeth),tb=Number(byId[b.definition].parameters.teeth),axis=Math.atan2(b.position[2]-a.position[2],b.position[0]-a.position[0]);
  edge(a.id,b.id,-ta/tb,-axis*(1+ta/tb)+Math.PI/tb+(a.rotation*ta/tb+b.rotation)*Math.PI/2);
 }
 const drives=new Map<string,RotorDrive>();
 for(const start of [...project.parts.filter(p=>byId[p.definition].model==='motor'),...gears]){
  if(drives.has(start.id))continue;drives.set(start.id,{driver:start.id,ratio:1,phase:0});const queue=[start.id];
  while(queue.length){const id=queue.shift()!,at=drives.get(id)!;for(const e of edges.get(id)??[])if(!drives.has(e.to)){drives.set(e.to,{driver:at.driver,ratio:at.ratio*e.ratio,phase:at.phase*e.ratio+e.phase});queue.push(e.to);}}
 }
 return drives;
}
