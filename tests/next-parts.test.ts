import {it,expect} from 'vitest';
import {byId,catalogue} from '../src/catalogue';
import {emptyProject,place} from '../src/project';
import {suggestNextParts} from '../src/next-parts';

it('every exposed part has up to four distinct, explained building ideas without changing the project',()=>{
 const p=emptyProject(),before=JSON.stringify(p);
 for(const d of catalogue){const ideas=suggestNextParts(p,d);expect(ideas.length).toBeGreaterThan(0);expect(ideas.length).toBeLessThanOrEqual(4);expect(new Set(ideas.map(x=>x.definition.id)).size).toBe(ideas.length);for(const idea of ideas){expect(byId[idea.definition.id]).toBe(idea.definition);expect(idea.definition.id).not.toBe(d.id);expect(idea.reason.length).toBeGreaterThan(25);}}
 expect(JSON.stringify(p)).toBe(before);
});
it('chooses LED protection for the supply and promotes parts still missing from the board',()=>{
 const p=emptyProject();p.parts=[place('6SCB5',[0,0,0])];let ideas=suggestNextParts(p,byId['6SCD1']);expect(ideas[0].definition.id).toBe('6SCR2');expect(ideas.some(i=>i.definition.model==='battery')).toBe(false);expect(ideas.some(i=>i.definition.id==='6SCR1')).toBe(false);
 p.parts.push(place('6SCR2',[5,0,0]));ideas=suggestNextParts(p,byId['6SCD1']);expect(ideas[0].definition.id).not.toBe('6SCR2');
 p.parts[1].damage={failed:true,failure:'open',temperature:20,stress:1};expect(suggestNextParts(p,byId['6SCD1'])[0].definition.id).toBe('6SCR2');
});
it('gives controllers the correct supply and suggests mechanical companions for a gear',()=>{
 const p=emptyProject();for(const id of ['snapino','pic16f877a']){const ideas=suggestNextParts(p,byId[id]);expect(ideas[0].definition.id).toBe('ws-supply5');expect(ideas.some(i=>i.definition.id==='6SCB1'||i.definition.id==='6SCR1')).toBe(false);}
 const gear=suggestNextParts(p,byId['6SCGEAR1']);expect(gear.map(i=>i.definition.id)).toEqual(expect.arrayContaining(['6SCGM','6SCGEAR2','6SCBGSUP']));expect(gear.some(i=>i.definition.model==='wire')).toBe(false);
});
