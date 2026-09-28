import {describe,it,expect} from 'vitest';
import {byId,catalogue} from '../src/catalogue';
import {place,emptyProject,parseProject,History,electricalCircuit,worldPoint} from '../src/project';
import {validateConstruction,canPlace,attach,moveAssembly,reverseTerminals,removeAssembly,bounds} from '../src/construction';
import {createLesson,lessons} from '../src/lessons';
import {belongsToSession} from '../src/engine-client';
describe('solid construction',()=>{
 it('rejects the screenshot battery/motor intersection including rotated and raised parts',()=>{
  const battery=place('6SCB1',[4,0,4]);for(let r=0;r<4;r++)for(const layer of [0,1,2])expect(canPlace(place('6SCM1',[5,layer,4],r),[battery])).toBe(false);
  expect(canPlace(place('6SCM1',[8,0,4]),[battery])).toBe(true);
 });
 it('permits stacked compatible snaps while protecting fan sweep space',()=>{
  expect(canPlace(place('6SC01',[4,1,4]),[place('6SC01',[4,0,4])])).toBe(true);
  let p=emptyProject();const m=place('6SCM1',[4,0,4]),f=place('6SCM1F',[1,0,1]);p.parts=[m,f];p=attach(p,f.id,m.id);expect(validateConstruction(p.parts)).toEqual([]);
  const at=p.parts[1].position;expect(canPlace(place('6SCL1',[at[0]-.5,2,at[2]]),p.parts)).toBe(false);
  const next=moveAssembly(p,m.id,[6,0,4],1);expect(validateConstruction(next.parts)).toEqual([]);expect(next.parts[1].rotation).toBe(1);expect(next.parts[1].position[2]).toBe(5);
 });
 it('deletes dependent attachments, wires and owned programs in one undoable edit',()=>{
  let p=emptyProject();const m=place('6SCM1',[4,0,4]),f=place('6SCM1F',[1,0,1]);p.parts=[m,f];p=attach(p,f.id,m.id);p.workspaces[m.id]={blocks:{}};p.firmware[m.id]='firmware';const h=new History();const next=h.commit(p,removeAssembly(p,m.id));expect(next.parts).toEqual([]);expect(next.connections).toEqual([]);expect(next.workspaces).toEqual({});expect(next.firmware).toEqual({});expect(h.undo(next).parts).toEqual(p.parts);
 });
 it('preserves an overlapping legacy document for repair instead of silently moving it',()=>{
  const p=emptyProject();p.parts=[place('6SCB1',[4,0,4]),place('6SCM1',[4,0,4])];const legacy={...p,schemaVersion:1,presentation:undefined};const restored=parseProject(JSON.stringify(legacy));expect(restored.parts).toEqual(p.parts);expect(restored.presentation).toEqual({night:false,naming:'none',quality:'auto'});expect(validateConstruction(restored.parts).length).toBeGreaterThan(0);
 });
 it('reverses snap-connected motors and diodes without moving their paths or intersecting bodies',()=>{
  for(const [id,definition] of [['reverse-fan','6SCM1'],['one-way','6SCD3']]){
   const p=createLesson(id),part=p.parts.find(p=>p.definition===definition)!,terminals=byId[definition].terminals;
   const next=reverseTerminals(p,part.id),turned=next.parts.find(p=>p.id===part.id)!;
   expect(validateConstruction(next.parts)).toEqual([]);
   expect(worldPoint(turned,terminals[0].position)).toEqual(worldPoint(part,terminals[1].position));
   expect(worldPoint(turned,terminals[1].position)).toEqual(worldPoint(part,terminals[0].position));
   expect(next.parts.filter(p=>byId[p.definition].model==='wire')).toEqual(p.parts.filter(p=>byId[p.definition].model==='wire'));
   expect(reverseTerminals(next,part.id).parts).toEqual(p.parts);
  }
 });
});
describe('catalogue and template contracts',()=>{
 it('every exposed part has finite compound geometry and meaningful markings without false polarity',()=>{
  for(const d of catalogue){expect(d.geometry.length,d.id).toBeGreaterThan(0);for(const shape of d.geometry)expect([...shape.at,...shape.size].every(Number.isFinite),d.id).toBe(true);expect(bounds(place(d.id,[4,0,4])).max.every(Number.isFinite),d.id).toBe(true);
   if(!['accessory','wire','junction'].includes(d.model))expect(d.markings.length,d.id).toBeGreaterThan(0);
   if(['resistor','wire','switch'].includes(d.model))expect(d.terminals.every(t=>!t.polarity),d.id).toBe(true);
   if(d.model==='npn'||d.model==='pnp')expect(d.terminals.map(t=>t.label).sort()).toEqual(['B','C','E']);
   for(const brand of Object.values(d.brands))expect(brand?.source).toMatch(/^https?:\/\//);
  }
  expect(byId['6SCD3'].terminals.map(t=>t.label)).toEqual(['A','K']);expect(byId['6SCM2'].brands.znatok).toBeUndefined();
 });
 it('keeps two starter showcases per group and adds hardware and single-transistor explorations',()=>{
  expect(lessons).toHaveLength(29);expect(lessons.filter(l=>l.extra)).toHaveLength(11);expect(lessons.filter(l=>l.code)).toHaveLength(2);expect(lessons.filter(l=>l.danger)).toHaveLength(4);
  for(const type of ['npn','pnp']){const family=lessons.filter(l=>l.transistorType===type);expect(family).toHaveLength(3);for(const lesson of family){const parts=createLesson(lesson.id).parts.map(p=>byId[p.definition]);expect(parts.filter(p=>p.model==='npn'||p.model==='pnp').map(p=>p.model)).toEqual([type]);expect(parts.some(p=>p.model==='mcu')).toBe(false);}}
  for(const group of ['Power','Lights','Motion','Controls','Electronics','Building','Computers'])expect(lessons.filter(l=>!l.danger&&!l.extra&&l.group===group)).toHaveLength(2);
 });
 it.each(lessons)('$name is a complete, collision-free template',lesson=>{
  const p=createLesson(lesson.id);expect(validateConstruction(p.parts)).toEqual([]);expect(parseProject(JSON.stringify(p))).toEqual(p);expect(p.mode).toBe(lesson.danger?'experiment':'guided');expect(lesson.steps).toHaveLength(3);expect(electricalCircuit(p).parts).toHaveLength(p.parts.length);
 });
 it('ignores observations for an old load even when part IDs and circuit revision match',()=>{
  const event={version:2 as const,type:'error' as const,projectId:'one',generation:4,message:'old error'};
  expect(belongsToSession(event,'two',4)).toBe(false);expect(belongsToSession(event,'one',5)).toBe(false);expect(belongsToSession(event,'one',4)).toBe(true);
 });
});
