import {describe,it,expect} from 'vitest';
import {electricalCircuit,emptyProject,place,parseProject,History,canPlace,snapped,worldPoint,starter} from '../src/project';
import {catalogue,byId} from '../src/catalogue';
describe('physical construction',()=>{
 it('connects only engaged adjacent snaps, never overlapping pictures',()=>{
  const p=emptyProject();const a=place('6SCR1',[0,0,0]),b=place('6SCR2',[0,0,0]);p.parts=[a,b];let net=electricalCircuit(p);expect(net.parts[0].terminals[0]).not.toBe(net.parts[1].terminals[0]);
  b.position[1]=1;net=electricalCircuit(p);expect(net.parts[0].terminals[0]).toBe(net.parts[1].terminals[0]);
  b.position[1]=2;net=electricalCircuit(p);expect(net.parts[0].terminals[0]).not.toBe(net.parts[1].terminals[0]);
 });
 it('keeps explicit wires connected when a part moves',()=>{const p=emptyProject();const a=place('6SCR1',[0,0,0]),b=place('6SCR2',[5,0,5]);p.parts=[a,b];p.connections=[{id:'w',kind:'wire',from:{part:a.id,terminal:'a'},to:{part:b.id,terminal:'b'}}];const n=electricalCircuit(p);expect(n.parts[0].terminals[0]).toBe(n.parts[1].terminals[1]);});
 it('lifting disengages external snaps while retaining internal snaps, flexible leads and physical models',()=>{
  const p=emptyProject(),a=place('6SCR1',[0,0,0]),b=place('6SCR2',[0,1,0]),c=place('6SCR1',[5,0,5]);p.parts=[a,b,c];p.connections=[{id:'w',kind:'wire',from:{part:a.id,terminal:'b'},to:{part:c.id,terminal:'a'}}];
  const live=electricalCircuit(p),lifted=electricalCircuit(p,new Set([a.id]));expect(live.parts[0].terminals[0]).toBe(live.parts[1].terminals[0]);expect(lifted.parts[0].terminals[0]).not.toBe(lifted.parts[1].terminals[0]);expect(lifted.parts[0].terminals[1]).toBe(lifted.parts[2].terminals[0]);expect(lifted.parts.map(p=>p.id)).toEqual(live.parts.map(p=>p.id));expect(electricalCircuit(p,new Set([a.id,b.id]))).toEqual(live);expect(electricalCircuit(p)).toEqual(live);
 });
 it('rotation changes real terminal positions',()=>{const a=place('6SCR1',[3,2,4],1);expect(worldPoint(a,[2,0,0])).toEqual([3,2,6]);expect(snapped([3,2,6],[3,3,6])).toBe(true);});
 it('checks tall bodies across layers and permits genuinely clear layers',()=>{const a=place('6SCR1',[4,0,4]),b=place('6SCR2',[4,0,4]);expect(canPlace(a,[b])).toBe(false);a.position[1]=1;expect(canPlace(a,[b])).toBe(false);a.position[1]=2;expect(canPlace(a,[b])).toBe(true);});
 it('round trips damage, environment, blocks and connections',()=>{const p=starter();p.parts[0].damage={failed:true,failure:'open',temperature:90,stress:2};p.workspaces[p.parts[0].id]={blocks:{languageVersion:0}};expect(parseProject(JSON.stringify(p))).toEqual(p);});
 it('rejects unknown components and incompatible project versions',()=>{const p=emptyProject();p.parts=[place('unknown',[0,0,0])];expect(()=>parseProject(JSON.stringify(p))).toThrow('unknown');expect(()=>parseProject(JSON.stringify({...p,schemaVersion:999}))).toThrow();});
 it('undo and redo retain separate copies',()=>{const a=emptyProject(),b=starter();const history=new History();const next=history.commit(a,b);const previous=history.undo(next);expect(previous.parts).toEqual([]);const again=history.redo(previous);expect(again.parts).toEqual(b.parts);});
});
describe('exposed catalogue contracts',()=>{
 it('each entry has original guidance, geometry, terminals and model parameters',()=>{expect(new Set(catalogue.map(p=>p.id)).size).toBe(catalogue.length);for(const d of catalogue){expect(d.guidance.does.length).toBeGreaterThan(20);expect(d.guidance.needs.length).toBeGreaterThan(15);expect(d.guidance.try.length).toBeGreaterThan(15);expect(d.size.every(n=>n>0)).toBe(true);for(const s of d.snaps)expect(d.terminals.some(t=>t.id===s.terminal)).toBe(true);expect(byId[d.id]).toBe(d);}});
});
