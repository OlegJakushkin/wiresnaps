import {Circuit} from './lesson-circuit';
import type {Lesson} from './lessons';
import type {Project,Snapshot} from './types';
import {byId} from './catalogue';

type Polarity='npn'|'pnp';
const bright=(s:Snapshot)=>s.parts.some(p=>p.brightness>.02&&!p.failed);
const source={title:'Elenco: Q2 NPN, Q1 PNP and component values',url:'https://www.elenco.com/wp-content/uploads/2017/10/753285-2.pdf'};
function build(type:Polarity,kind:'sensor'|'timer'|'fan'):Project{
 const c=new Circuit(),npn=type==='npn',q=npn?'6SCQ2':'6SCQ1',emitter=npn?'0':'v';
 if(kind==='sensor'){
  c.add('6SCB1',['battery','0'],[1,0,1]);c.add('6SCS1',['battery','v'],[5,0,1]);
  c.add('6SCR4',['v','base'],[9,0,1]);c.add('6SCRP',['base','0'],[9,0,4]);
  c.add(q,['collector',emitter,'base'],[5,0,4]);c.add('6SCR1',[npn?'v':'collector','led'],[1,0,4]);c.add('6SCD1',['led',npn?'collector':'0'],[1,0,7]);
  c.p.presentation.night=npn;
 }else if(kind==='timer'){
  c.add('6SCB1',['v','0'],[1,0,1]);c.add('6SCS2',[npn?'v':'0','button'],[5,0,1]);c.add('6SCR2',['button','memory'],[9,0,1]);
  c.add('6SCC5',npn?['memory','0']:['v','memory'],[9,0,4]);c.add(q,['collector',emitter,'base'],[5,0,4]);c.add('6SCR4',['memory','base'],[1,0,4]);
  c.add('6SCR1',[npn?'v':'collector','led'],[1,0,7]);c.add('6SCD1',['led',npn?'collector':'0'],[5,0,7]);c.add('6SCR3',['memory',emitter],[9,0,7]);
 }else{
  c.add('6SCB1',['battery','0'],[1,0,1]);c.add('6SCS1',['battery','v'],[5,0,1]);c.add('6SCRV',npn?['v','dial','0']:['0','dial','v'],[9,0,1],{position:.05});
  c.add('6SCR2',['dial','base'],[9,0,4]);c.add(q,['collector',emitter,'base'],[1,0,4]);c.add('6SCR4',['base',emitter],[1,0,7]);
  const m=c.add('6SCM1',npn?['v','collector']:['collector','0'],[5,0,6]);c.fan(m);c.add('6SCD3',npn?['collector','v']:['0','collector'],[9,0,7]);
 }
 return c.p;
}
const details:Record<Polarity,{sensor:string;timer:string;fan:string}>={npn:{sensor:'NPN Night Watch',timer:'NPN Porch Timer',fan:'NPN Desk Fan'},pnp:{sensor:'PNP Sunrise Beacon',timer:'PNP Courtesy Light',fan:'PNP Breeze Dial'}};
export const singleTransistorLessons:Lesson[]=(['npn','pnp'] as const).flatMap(type=>(['sensor','timer','fan'] as const).map(kind=>{
 const npn=type==='npn',name=details[type][kind],which=type.toUpperCase();
 const steps:Record<typeof kind,string[]>={
  sensor:[npn?'It starts at night. Watch your automatic night light.':'Sunshine turns on the beacon. It could tell you when it is time to open the curtains.',
   'Press Dark Night to swap between night and day. The light sensor changes the signal at B.',
   npn?'In daylight, the sensor carries the base signal away to −. At night, the resistor lets the NPN turn on.':'In daylight, the sensor pulls the base below the emitter at +. That turns the PNP on. Darkness lets it turn off.'],
  timer:['Hold the yellow button for one or two seconds to fill the capacitor with energy.','Let go. The transistor keeps the light on while the capacitor’s signal slowly fades.',npn?'The capacitor keeps B above the emitter for a while, then the light goes out.':'The capacitor keeps B below the emitter for a while, then the light goes out.'],
  fan:['The fan starts running. Click the slide switch to stop and start it.','Select the dial and slide its handle. Compare a low setting near 0.05 with a setting near 0.6.',`The dial sends a small signal to B. The ${which} carries the motor current; the diode catches the motor’s switch-off pulse.`],
 };
 return {id:type+'-'+kind,name,group:kind==='fan'?'Motion':'Electronics',extra:true,transistorType:type,
  description:kind==='sensor'?(npn?'An automatic night light with just one NPN transistor.':'A daylight signal with just one PNP transistor.'):kind==='timer'?`A useful light that stays on briefly after you release the button. One ${which} does the switching.`:`Use a small dial to control a fan through one ${which} transistor.`,
  steps:steps[kind],expected:kind==='sensor'?(npn?'Darkness turns the LED on; daylight turns it off.':'Daylight turns the LED on; darkness turns it off.'):kind==='timer'?'The LED stays lit briefly after release, then fades out. A longer button press stores more energy.':'The dial changes the motor’s current and speed. The switch stops supplying energy and the fan coasts down.',
  variation:kind==='sensor'?'In daylight, change Sunshine under Surroundings to explore the point where the LED changes.':kind==='timer'?'Compare a short press with a long press. Predict which gives the longer glow.':'Try turning the dial halfway, then almost all the way. Watch the motor’s current as well as its speed.',
  hardware:{sources:[source],note:`Original 3 V circuit using exactly one ${npn?'Q2 NPN':'Q1 PNP'} and no opposite-type transistor or computer. ${kind==='sensor'?'Use RP, R4 (10 kΩ), R1 (100 Ω), S1 and D1.':kind==='timer'?'Use S2, C5 (470 µF), R2 (1 kΩ), R4 (10 kΩ), R3 (5.1 kΩ), R1 (100 Ω) and D1. Keep the capacitor’s + end at the higher voltage.':'Use RV (50 kΩ), R2 (1 kΩ), R4 (10 kΩ), S1, M1 with fan, and D3. Check the diode band and motor current.'} Follow B/C/E and the terminal guide. Kit values, sensor thresholds and timing vary; this is a functional circuit, not a copied manufacturer project or a verified physical layout.`},
  build:()=>build(type,kind),check:kind==='fan'?(s:Snapshot,p:Project)=>s.parts.some(o=>byId[p.parts.find(q=>q.id===o.id)!.definition].model==='motor'&&Math.abs(o.angularVelocity)>10):bright,
 } satisfies Lesson;
}));
