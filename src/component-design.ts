import type {BodyShape,Definition,Marking,Naming,Vec3} from './types';
import {manufacturerMappings} from './manufacturer-mappings';
export const LAYER=.28;
export const BASE_Y=.1;
export const BOARD={minX:-.5,maxX:12.5,minZ:-.5,maxZ:9.5};
export function partLabel(d:Definition,naming:Naming){return naming==='none'?genericCode(d):d.brands[naming]?.code??genericCode(d);}
export function terminalLabel(d:Definition,id:string,naming:Naming){return (naming==='none'?undefined:d.brands[naming]?.terminals?.[id])??d.terminals.find(t=>t.id===id)?.label??id;}
export function genericCode(d:Definition){return d.model==='wire'||d.model==='junction'?d.short:d.model==='resistor'?String(d.parameters.resistance)+'Ω':d.model==='capacitor'?Number((Number(d.parameters.capacitance)*1e6).toPrecision(3))+'µF':d.model==='npn'||d.model==='pnp'?d.model.toUpperCase():d.model==='battery'?String(d.parameters.voltage)+'V':d.model==='mcu'?d.programming==='atmega328p'?'AVR':'PIC':d.model==='led'?'LED':d.model==='lamp'?'BULB':d.name.split(' ')[0].toUpperCase();}
export function design(d:Definition){
 const g:BodyShape[]=[],marks:Marking[]=[];
 const box=(at:Vec3,size:Vec3,color:string,role:BodyShape['role']='body')=>g.push({kind:'box',at,size,color,role});
 const cyl=(at:Vec3,r:number,h:number,color:string,role:BodyShape['role']='body',rotation?:Vec3,metal=0)=>g.push({kind:'cylinder',at,size:[r,h,r],color,role,rotation,metal});
 const sphere=(at:Vec3,r:number,color:string)=>g.push({kind:'sphere',at,size:[r,r,r],color,role:'emitter'});
 const mark=(text:string,at:Vec3,width=.8)=>marks.push({text,at,width});
 const w=d.size[0],depth=d.size[2],cx=w/2-.32,cz=depth/2-.32;
 // All dimensions below are local board-pitch units, including height.
 // They are original educational geometry estimates, not measured hardware CAD.
 if(d.model!=='accessory')box([cx,.075,cz],[w,.15,depth],d.color,'base');
 for(const s of d.snaps)cyl([s.position[0],.22,s.position[2]],.18,.14,'#b7c4cf','snap',undefined,.85);
 d.interaction=d.model==='potentiometer'?'dial':d.id==='6SCS2'?'momentary':d.id==='6SCS1'?'toggle':d.model==='switch'?'sensor':'none';
 if(d.id==='6SCB5'){
  // PP3 / Krona silhouette. Approximate 48.5 × 26.5 × 17.5 mm envelope,
  // with both miniature terminals at the same end (not cylindrical AA cells).
  box([1,.53,.65],[1.82,.68,1.04],'#263c50');box([1.81,.53,.65],[.2,.69,1.05],'#d8ac57');
  cyl([1.97,.53,.4],.085,.12,'#e1e7eb','body',[0,0,Math.PI/2],.8);
  g.push({kind:'cylinder',at:[1.97,.53,.9],size:[.13,.12,.13],color:'#d5dee4',role:'body',rotation:[0,0,Math.PI/2],metal:.8,sides:6});
  cyl([2.035,.53,.9],.072,.006,'#344554','detail',[0,0,Math.PI/2]);
  mark('9 V',[.85,.878,.62],1);marks[marks.length-1].color='#fff2ce';mark('+  −',[1.67,.883,.65],.35);marks[marks.length-1].color='#fff2ce';
 }else if(d.id==='ws-supply5'){
  box([1,.36,.56],[1.34,.4,.86],'#e9eee9');box([1,.567,.56],[.8,.014,.36],'#233e53');mark('5 V DC',[1,.58,.56],.72);
 }else if(d.model==='battery'){
  const count=d.id==='6SCB3'?3:2;
  for(let i=0;i<count;i++){const z=.27+i*.55;cyl([cx,.49,z],.26,1.3,'#273845','body',[0,0,Math.PI/2]);cyl([cx+.52,.49,z],.263,.2,'#e2b45e','body',[0,0,Math.PI/2],.45);}
  mark(String(d.parameters.voltage)+' V',[cx,.77,.48],1);
 }else if(d.model==='lamp'){cyl([1,.3,0],.29,.28,'#becbd2','body',undefined,.7);sphere([1,.69,0],.36,'#fff1bb');box([1,.68,0],[.16,.025,.04],'#f6b34d','detail');}
 else if(d.model==='led'){cyl([1,.26,0],.27,.13,d.color);sphere([1,.47,0],.24,d.color);}
 else if(d.model==='motor'){cyl([1,.42,0],.43,.5,'#8eacbc','body',undefined,.7);cyl([1,.76,0],.09,.2,'#d7e3ec','body',undefined,.85);d.attachments=[{id:'shaft',kind:'axle',position:[1,.91,0]}];}
 else if(d.model==='switch'){box([1,.3,0],[.9,.28,.5],'#204740');box([1,.52,0],[.32,.2,.35],d.interaction==='momentary'?'#ffd451':'#f3fbef','actuator');mark(d.interaction==='momentary'?'PUSH':'OFF   ON',[1,.162,.42],1.1);}
 else if(d.model==='resistor'||d.model==='diode'){
  cyl([1,.34,0],.14,.76,d.model==='diode'?'#243343':'#eed5a3','body',[0,0,Math.PI/2]);
  if(d.model==='diode')cyl([1.24,.34,0],.145,.07,'#eaf5fb','detail',[0,0,Math.PI/2]);
  else {const bands:Record<string,string[]>={R1:['#81512b','#171b21','#81512b'],R2:['#81512b','#171b21','#cf433f'],R3:['#38a558','#81512b','#cf433f'],R4:['#81512b','#171b21','#eb8a28'],R5:['#81512b','#171b21','#eee046']};(bands[d.short]??[]).forEach((c,i)=>cyl([.78+i*.19,.34,0],.145,.055,c,'detail',[0,0,Math.PI/2]));}
 }else if(d.model==='npn'||d.model==='pnp'){box([1,.42,.13],[.55,.52,.4],'#233343');for(const x of [.8,1,1.2])cyl([x,.28,.48],.023,.36,'#a8c1ce','body',undefined,.7);mark(d.model==='npn'?'B ─▶ E':'E ▶─ B',[1,.162,.83],.8);}
 else if(d.model==='capacitor'){if(['C1','C2','C7'].includes(d.short)){cyl([1,.4,0],.28,.46,'#e4a439');}else{cyl([1,.47,0],.27,.61,'#224d65');cyl([1,.78,0],.275,.025,'#bad1dd','detail',undefined,.7);mark('−',[1.16,.799,0],.2);}}
 else if(d.model==='potentiometer'){cyl([1,.32,.25],.32,.32,'#3b5865');cyl([1,.52,.25],.24,.18,'#ffca53','actuator');}
 else if(d.model==='solar'){box([1,.23,.65],[1.25,.14,1.1],'#183c89');for(let i=0;i<4;i++)box([.48+i*.34,.31,.65],[.015,.01,1.05],'#7bbcf1','detail');}
 else if(d.model==='speaker'){cyl([1,.35,.35],.6,.35,'#253b4c');cyl([1,.54,.35],.25,.08,'#465d71','detail');}
 else if(d.model==='meter'){box([1,.33,.35],[1.12,.33,.82],'#ecf6f4');mark('0     3     6',[1,.51,.3],.95);}
 else if(d.model==='mcu'){box([cx,.172,cz],[w-.7,.035,depth-.65],'#147f91');box([2.5,.3,2.5],[.6,.2,.6],'#203341');}
 else if(d.model==='relay'){box([1,.4,.35],[1.15,.5,.8],'#446a92');mark('COIL ↔ SWITCH',[1,.66,.35],1.03);}
 else if(d.model==='photoresistor'||d.model==='microphone'){cyl([1,.34,0],.26,.3,d.model==='photoresistor'?'#e9b158':'#728c9b');mark(d.model==='photoresistor'?'☀':'MIC',[1,.5,0],.35);}
 else if(d.model==='accessory'){
  if(d.shape==='fan'){cyl([0,.03,0],.14,.13,'#ffdb72','rotor');for(let i=0;i<4;i++){const a=i*Math.PI/2;g.push({kind:'box',at:[Math.cos(a)*.48,.02,Math.sin(a)*.48],size:[.85,.055,.25],color:'#a84fef',role:'rotor',rotation:[0,-a,0]});}g.push({kind:'cylinder',at:[0,.03,0],size:[.95,.15,.95],color:d.color,role:'detail',collision:true});}
  else if(d.shape==='gear'){
   const r=Number(d.parameters.pitchRadius),outer=Number(d.parameters.outerRadius),teeth=Number(d.parameters.teeth),color=d.id==='6SCGEAR1'?'#f5ad28':'#ad62d7';
   cyl([0,.09,0],r-.05,.16,color,'rotor');g[g.length-1].collision=false;
   for(let i=0;i<teeth;i++){const a=i*Math.PI*2/teeth;g.push({kind:'box',at:[Math.cos(a)*r,.09,Math.sin(a)*r],size:[(outer-r)*2,.16,.075],color,role:'rotor',rotation:[0,-a,0],collision:false});}
   cyl([0,.19,0],.14,.08,'#e9e1bc','rotor');g[g.length-1].collision=false;
   box([r*.55,.178,0],[.15,.014,.075],'#fff5db','rotor');g[g.length-1].collision=false;
   g.push({kind:'cylinder',at:[0,.1,0],size:[outer,.25,outer],color,role:'detail',collision:true});
  }else if(d.shape==='wheel'){cyl([0,.09,0],.58,.18,'#273c46','rotor');}
  else {box([0,.1,0],[.6,.2,.6],'#d9c77d');cyl([0,.48,0],.12,.7,'#a4b9c3','body',undefined,.6);d.attachments=[{id:'mount',kind:'mount',position:[0,0,0]},{id:'shaft',kind:'axle',position:[0,.91,0]}];}
 }
 const polarized=['battery','led','solar'].includes(d.model)||d.model==='capacitor'&&!['C1','C2','C7'].includes(d.short);
 for(const t of d.terminals){
  delete t.polarity;
  if(polarized){t.polarity=t.id==='b'?'negative':'positive';t.label=d.model==='led'?(t.id==='b'?'− K':'+ A'):t.id==='b'?'−':'+';}
  else if(d.model==='diode')t.label=t.id==='a'?'A':'K';
  else if(d.model==='npn'||d.model==='pnp')t.label=t.id.toUpperCase();
  else if(d.model==='relay')t.label=({a:'COIL A',b:'COIL B',c:'COM',d:'NO',nc:'NC'} as Record<string,string>)[t.id];
  else if(d.model!=='mcu')t.label=t.id.toUpperCase();
  if(!['wire','junction','accessory'].includes(d.model)){mark(t.label,[t.position[0],.166,t.position[2]+.32],d.model==='mcu'?.42:.6);marks[marks.length-1].terminal=t.id;}
 }
 if(['lamp','led','resistor','diode','npn','pnp','capacitor'].includes(d.model)){
  const symbol=d.model==='resistor'?'─▰─':d.model==='diode'?'A ─▷│─ K':d.model==='led'?'↗  ↗':d.model==='capacitor'?'─│ │─':d.model==='lamp'?'⊗':d.model.toUpperCase();
  mark(symbol,[cx,.167,depth-.54],1.05);
 }
 if(d.model==='lamp')mark(d.parameters.voltage+' V · '+d.parameters.ratedPower+' W',[1,.167,.47],1.1);
 if(d.model==='npn'||d.model==='pnp')mark(Number(d.parameters.maxCurrent)*1000+' mA',[1,.167,1.19],.85);
 if(d.model==='led')mark(Number(d.parameters.maxCurrent)*1000+' mA',[1,.167,.47],.65);
 d.geometry=g;d.markings=marks;
 d.brands=manufacturerMappings(d);
}
