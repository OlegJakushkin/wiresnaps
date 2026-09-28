import {it,expect} from 'vitest';
import {emptyProject,place,parseProject,electricalCircuit,History} from '../src/project';
import {rewireConnection,wireEndpointPoint,clearWireRoutes} from '../src/wiring';
import {physicalPoint} from '../src/construction';
import {byId} from '../src/catalogue';

function circuit(){
 const p=emptyProject(),battery=place('6SCB1',[1,0,1]),sw=place('6SCS1',[5,0,1]),lamp=place('6SCL1',[5,0,5]),strip=place('6SC05',[1,0,8]);
 p.parts=[battery,sw,lamp,strip];p.connections=[
  {id:'supply',kind:'wire',from:{part:battery.id,terminal:'a'},to:{part:sw.id,terminal:'a'}},
  {id:'load',kind:'wire',from:{part:sw.id,terminal:'b'},to:{part:lamp.id,terminal:'a'}},
  {id:'return',kind:'wire',from:{part:lamp.id,terminal:'b'},to:{part:battery.id,terminal:'b'}}];
 return {p,battery,sw,lamp,strip};
}
it('moves only one cable end, preserving components, the other end and one-step undo',()=>{
 const {p,sw,lamp,strip}=circuit(),before=structuredClone(p),history=new History(),target={part:strip.id,terminal:byId[strip.definition].snaps[2].terminal,snap:2};
 const next=rewireConnection(p,'load','to',target);expect(next).not.toBe(p);expect(p).toEqual(before);expect(next.parts).toBe(p.parts);
 expect(next.connections.find(c=>c.id==='load')).toEqual({id:'load',kind:'wire',from:{part:sw.id,terminal:'b'},to:target});
 expect(next.connections.filter(c=>c.id!=='load')).toEqual(p.connections.filter(c=>c.id!=='load'));
 expect(parseProject(JSON.stringify(next))).toEqual(next);expect(wireEndpointPoint(next,target)).toEqual(physicalPoint(strip,[2,.31,0]));
 expect(clearWireRoutes(next).get('load')!.points.at(-1)).toEqual(wireEndpointPoint(next,target));
 const edited=history.commit(p,next);expect(history.undo(edited).connections.find(c=>c.id==='load')!.to).toEqual({part:lamp.id,terminal:'a'});expect(history.redo(p).connections).toEqual(next.connections);
});
it('rejects missing snaps and self-connections without changing the project',()=>{
 const {p,sw,lamp}=circuit();
 for(const target of [{part:'missing',terminal:'a'},{part:lamp.id,terminal:'missing'},{part:lamp.id,terminal:'a',snap:90},{part:lamp.id,terminal:'a',snap:1},{part:sw.id,terminal:'b'},{part:lamp.id,terminal:'a',snap:0}])expect(rewireConnection(p,'load','to',target)).toBe(p);
 expect(rewireConnection(p,'missing','to',{part:lamp.id,terminal:'a'})).toBe(p);
 const bad=structuredClone(p);bad.connections[1].to.snap=1;expect(()=>parseProject(JSON.stringify(bad))).toThrow('missing metal snap');
 expect(parseProject(JSON.stringify(p))).toEqual(p);
});
it('unplugs just the dragged cable while all other live connections remain engaged',()=>{
 const {p,battery,sw,lamp}=circuit();
 for(const lifted of [false,true,false]){
  const net=electricalCircuit(p,new Set(),lifted?new Set(['load']):new Set());
  const pins=(id:string)=>net.parts.find(q=>q.id===id)!.terminals;
  expect(pins(battery.id)[0]).toBe(pins(sw.id)[0]);expect(pins(lamp.id)[1]).toBe(pins(battery.id)[1]);
  expect(pins(sw.id)[1]===pins(lamp.id)[0]).toBe(!lifted);
 }
});
