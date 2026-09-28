import {it,expect} from 'vitest';
import {emptyProject,place,electricalCircuit,History} from '../src/project';
import {byId} from '../src/catalogue';
import {createLesson,lessons} from '../src/lessons';
import {clearWireRoutes,traceWire,obscuresBody,conductor} from '../src/wiring';
import {connectTerminals,coveredConnectors,tidyWiring} from '../src/snap-routing';
import {validateConstruction,gearsMesh,physicalPoint,shapeBounds} from '../src/construction';
import {rotorDrives} from '../src/gears';
import {Box3,Ray,Vector3} from 'three';

it('traces snap strips, stacks, branches and flexible cables, stopping at component terminals',()=>{
 const p=emptyProject(),a=place('6SC04',[1,0,1]),b=place('6SC03',[4,1,1],1),j=place('6SC01',[4,2,3]),r=place('6SCR1',[4,3,3]),l=place('6SCD1',[8,0,5]),other=place('6SC02',[8,1,5],1);
 p.parts=[a,b,j,r,l,other];p.connections=[{id:'cable',kind:'wire',from:{part:b.id,terminal:'a'},to:{part:l.id,terminal:'b'}}];
 for(const id of [a.id,b.id,j.id,'cable']){const trace=traceWire(p,id);expect(trace.parts.sort()).toEqual([a.id,b.id,j.id].sort());expect(trace.wires).toEqual(['cable']);expect(trace.terminals).toEqual([{part:r.id,terminal:'a'},{part:l.id,terminal:'b'}]);expect(trace.parts).not.toContain(other.id);}
});
it('point-to-point auto wiring produces a clear, collision-free, undoable project edit',()=>{
 const p=emptyProject(),a=place('6SCR1',[1,0,1]),b=place('6SCD1',[5,0,1]);p.parts=[a,b];
 const wired=connectTerminals(p,{part:a.id,terminal:'b'},{part:b.id,terminal:'a'});
 expect(p.parts).toHaveLength(2);expect(p.connections).toHaveLength(0);expect(wired.parts.length).toBeGreaterThan(2);expect(wired.connections).toHaveLength(0);expect(validateConstruction(wired.parts)).toEqual([]);
 const cable=connectTerminals(p,{part:a.id,terminal:'b'},{part:b.id,terminal:'a'},true);expect(cable.parts).toHaveLength(2);expect(clearWireRoutes(cable).values().next().value!.clear).toBe(true);
});
it.each(['6SCB1','6SCS2','6SCR2'])('keeps the entire %s face visible even below its tallest feature',definition=>{
 for(let rotation=0;rotation<4;rotation++){
  const body=place(definition,[5,0,4],rotation),across=place('6SC03',[5,1,4],rotation);
  expect(obscuresBody(across,[body,across])).toBe(true);
  // Approaching the outside of a terminal is still a usable snap connection.
  const dx=Math.round(Math.cos(rotation*Math.PI/2)),dz=Math.round(Math.sin(rotation*Math.PI/2));
  const out=place('6SC02',[5-dx,1,4-dz],rotation);expect(obscuresBody(out,[body,out])).toBe(false);
 }
});
it('tidies an older raised strip without moving components or changing their terminal nets, and undoes in one step',()=>{
 const p=emptyProject(),battery=place('6SCB1',[1,0,1]),button=place('6SCS2',[5,0,1]),resistor=place('6SCR2',[9,0,1]),cover=place('6SC07',[5,3,1]);
 p.parts=[battery,button,resistor,cover];p.connections=[
  {id:'supply',kind:'wire',from:{part:battery.id,terminal:'a'},to:{part:button.id,terminal:'a'}},
  {id:'on',kind:'wire',from:{part:button.id,terminal:'b'},to:{part:cover.id,terminal:'a'}},
  {id:'load',kind:'wire',from:{part:cover.id,terminal:'b'},to:{part:resistor.id,terminal:'a'}}];
 battery.damage={failed:false,failure:'',temperature:30,stress:.2};p.workspaces[button.id]={kept:'workspace'};p.firmware[button.id]='preserved';
 const saved=structuredClone(p),history=new History(),next=tidyWiring(p);
 expect(p).toEqual(saved);expect(coveredConnectors(next)).toHaveLength(0);expect(validateConstruction(next.parts)).toEqual([]);
 for(const part of [battery,button,resistor])expect(next.parts.find(q=>q.id===part.id)).toEqual(part);
 expect(next.workspaces).toEqual(p.workspaces);expect(next.firmware).toEqual(p.firmware);
 const signature=(p:typeof next)=>{const circuit=electricalCircuit(p),parent=new Map<string,string>();const root=(n:string):string=>parent.has(n)?root(parent.get(n)!):n;
  for(const q of circuit.parts)if(q.model==='wire'){const a=root(q.terminals[0]),b=root(q.terminals[1]);if(a!==b)parent.set(a,b);}
  const nodes=[battery,button,resistor].flatMap(q=>circuit.parts.find(c=>c.id===q.id)!.terminals.map(root));return nodes.map(n=>nodes.indexOf(n));};
 expect(signature(next)).toEqual(signature(p));const edited=history.commit(p,next);expect(history.undo(edited).parts).toEqual(p.parts);
});
it('the transistor demo exposes its cells, button and resistor from top and home cameras',()=>{
 const p=createLesson('tiny-switch'),samples:Record<string,number[][]>={
  '6SCB1':[[1,.76,.27],[1,.76,.82]],'6SCS2':[[1,.63,0],[1,.167,.42]],'6SCR2':[[1,.49,0],[1,.17,.56]],'6SCQ2':[[1,.69,.13]]
 };
 const wires=p.parts.filter(q=>byId[q.definition].model==='wire').flatMap(q=>byId[q.definition].geometry.map(s=>{const b=shapeBounds(q,s);return {id:q.id,box:new Box3(new Vector3(...b.min),new Vector3(...b.max))};}));
 for(const eye of [[6,22,4.51],[12,13,17]])for(const part of p.parts)for(const local of samples[part.definition]??[]){
  const at=new Vector3(...physicalPoint(part,local as [number,number,number])),camera=new Vector3(...eye),ray=new Ray(camera,at.clone().sub(camera).normalize()),distance=camera.distanceTo(at);
  for(const wire of wires){const hit=ray.intersectBox(wire.box,new Vector3());expect(hit&&camera.distanceTo(hit)<distance-.02,`${part.definition} hidden from ${eye} by ${wire.id}`).not.toBe(true);}
 }
});
it('tidying never bridges around a failed connector in an obstructing path',()=>{
 const p=emptyProject(),button=place('6SCS2',[5,0,1]),cover=place('6SC07',[5,4,1]),broken=place('6SC02',[2,0,6]);
 broken.damage={failed:true,failure:'open',temperature:35,stress:1};p.parts=[button,cover,broken];p.connections=[{id:'broken-path',kind:'wire',from:{part:cover.id,terminal:'b'},to:{part:broken.id,terminal:'a'}}];
 expect(coveredConnectors(p)).toContain(cover);expect(tidyWiring(p)).toBe(p);
});
it.each(lessons)('$name keeps routed strips off visible bodies and flexible cables clear',lesson=>{
 const p=createLesson(lesson.id);
 for(const part of p.parts.filter(q=>byId[q.definition].model==='wire'))expect(obscuresBody(part,p.parts),part.definition).toBe(false);
 for(const [id,route] of clearWireRoutes(p)){expect(route.clear,lesson.id+': '+id).toBe(true);expect(route.points.length).toBeGreaterThan(1);expect(route.points.flat().every(Number.isFinite)).toBe(true);}
});
it('models a Krona block with different same-end terminals and a physically supported gear ratio',()=>{
 const d=byId['6SCB5'];expect(d.geometry.some(g=>g.kind==='box'&&g.size[0]>1.7&&g.role==='body')).toBe(true);expect(d.geometry.some(g=>g.kind==='cylinder'&&g.sides===6)).toBe(true);
 const p=createLesson('gear-buddies'),gears=p.parts.filter(p=>byId[p.definition].shape==='gear'),drives=rotorDrives(p),motor=p.parts.find(p=>byId[p.definition].model==='motor')!;
 expect(gearsMesh(gears[0],gears[1])).toBe(true);expect(drives.get(gears[0].id)?.driver).toBe(motor.id);expect(drives.get(gears[1].id)?.ratio).toBeCloseTo(-12/22);expect(gears.every(p=>p.position[1]>3)).toBe(true);
 expect(gearsMesh({...gears[0],position:[0,0,0]},gears[1])).toBe(false);expect(p.parts.filter(conductor).length).toBeGreaterThan(0);
});
