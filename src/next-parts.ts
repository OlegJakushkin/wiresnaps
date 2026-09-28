import {byId} from './catalogue';
import {nextPartsText} from './i18n/next-parts.en';
import type {Definition,Project} from './types';

export interface NextPart {definition:Definition;reason:string;}
type Reason=keyof typeof nextPartsText.reasons;
// Authored building ideas, not an automatic wiring or hardware-safety verdict.
// Prefer missing supporting parts; repeated wires and loads remain useful.
export function suggestNextParts(project:Project,focus:Definition):NextPart[]{
 const present=project.parts.filter(p=>!p.damage?.failed).map(p=>byId[p.definition]);
 const source=(d:Definition)=>d.model==='battery'||d.model==='solar';
 const sources=[...present,...(source(focus)?[focus]:[])].filter(source);
 const voltage=Math.max(focus.model==='mcu'?5:3,...sources.map(d=>Number(d.parameters.voltage??0)),focus.model==='led'?Number(focus.parameters.forwardVoltage)+1:0);
 const resistor=voltage>4.5?'6SCR2':'6SCR1',limit:Reason=voltage>4.5?'gentleResistor':'ledResistor';
 const choices:{id:string;reason:Reason}[]=[];
 const add=(id:string,reason:Reason)=>{if(id!==focus.id&&byId[id]&&!choices.some(c=>c.id===id))choices.push({id,reason});};
 switch(focus.model){
  case 'battery':add('6SCS1','switch');add(resistor,limit);add('6SCD1','led');add('6SCM2','meter');break;
  case 'solar':add('6SCM2','meter');add('6SCD1','led');add(resistor,limit);add('6SCS1','switch');break;
  case 'led':add(resistor,limit);add('6SCS1','switch');add('6SCC5','capacitor');break;
  case 'lamp':add('6SCS1','switch');add('6SCM2','meter');break;
  case 'motor':
   if(focus.id==='6SCGM')add('6SCGEAR1','smallGear');else add('6SCM1F','fan');
   add('6SCS1','switch');add('6SCD3','diode');add('6SCM2','meter');break;
  case 'npn':case 'pnp':add('6SCR2','baseResistor');add('6SCR4','pullDown');add('6SCS2','button');add('6SCD1','led');if(focus.model==='pnp')add('6SCQ2','partner');break;
  case 'mcu':add('ws-supply5','supply');add('6SCS2','button');add('6SCRV','dial');add(resistor,limit);add('6SCD1','led');break;
  case 'photoresistor':case 'microphone':case 'thermistor':case 'touch':add('6SCR4','divider');add('6SCR2','baseResistor');add('6SCQ2','transistor');add('snapino','controller');break;
  case 'capacitor':add('6SCR2','charge');add('6SCM2','meter');add('6SCD1','led');add('6SCS2','button');break;
  case 'potentiometer':add('6SCM2','meter');add('snapino','controller');add('6SCD1','led');add(resistor,limit);break;
  case 'relay':add('6SCS1','switch');add('6SCD3','diode');add('6SCD1','led');add(resistor,limit);break;
  case 'resistor':add('6SCD1','led');add('6SCM2','meter');add('6SCC5','capacitor');add('6SCS1','switch');break;
  case 'diode':add('6SCM1','motor');add('6SCS3','relay');add('6SCS1','switch');add('6SCM2','meter');break;
  case 'accessory':
   if(focus.shape==='gear'||focus.shape==='support'){add('6SCGM','gearedMotor');add(focus.id==='6SCGEAR1'?'6SCGEAR2':'6SCGEAR1',focus.id==='6SCGEAR1'?'largeGear':'smallGear');add('6SCBGSUP','support');}
   else {add('6SCM1','motor');add('6SCM2','meter');add('6SCB2','solar');}
   break;
  default:add('6SCD1','led');add(resistor,limit);add('6SCS1','switch');add('6SCM2','meter');
 }
 // A source is useful when one has not been chosen yet. Never suggest a second
 // battery merely because the existing one has a different catalogue ID.
 if(!sources.length&&focus.model!=='accessory'){
  const supply=focus.model==='mcu'||focus.model==='led'&&Number(focus.parameters.forwardVoltage)>3;
  add(supply?'ws-supply5':'6SCB1',focus.model==='mcu'?'supply':supply?'brightSupply':focus.id==='6SCL2'?'sixVolt':'battery');
 }
 if(focus.terminals.length)add('6SC02','connector');
 return choices.map((c,i)=>({...c,score:(!sources.length&&source(byId[c.id])?Math.min(i,1.5):i)+(present.some(p=>p.id===c.id)?6:0)})).sort((a,b)=>a.score-b.score).slice(0,4)
  .map(c=>({definition:byId[c.id],reason:nextPartsText.reasons[c.reason]}));
}
