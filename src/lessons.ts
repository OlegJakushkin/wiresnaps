import {byId} from './catalogue';
import {emptyProject,place,electricalCircuit} from './project';
import {attach} from './construction';
import {preferSnapConnectors} from './snap-routing';
import {uniqueId} from './id';
import {Circuit} from './lesson-circuit';
import {singleTransistorLessons} from './transistor-lessons';
import {compile,packageFirmware} from './programming/compiler';
import type {Program,Statement,Expr} from './programming/compiler';
import type {Project,Snapshot,Definition,Instance,Vec3} from './types';
export interface Lesson {id:string;name:string;group:Definition['category'];description:string;steps:string[];expected:string;variation:string;danger?:boolean;code?:boolean;extra?:boolean;transistorType?:'npn'|'pnp';hardware?:{note:string;sources:{title:string;url:string}[]};build:()=>Project;check:(s:Snapshot,p:Project)=>boolean;}
const bright=(s:Snapshot)=>s.parts.some(p=>p.brightness>.02&&!p.failed);
const spinning=(s:Snapshot)=>s.parts.some(p=>Math.abs(p.angularVelocity)>10);
const healthy=(s:Snapshot)=>s.parts.every(p=>!p.failed)&&s.diagnostics.length===0;
function simple(build:(c:Circuit)=>void){return ()=>{const c=new Circuit();build(c);return c.p;};}
const n=(value:number):Expr=>({kind:'number',value});
export const trafficProgram:Program={version:1,target:'atmega328p',start:[{id:'traffic-loop',kind:'forever',body:[4,5,6].flatMap(pin=>[
 {id:'on-'+pin,kind:'write',pin,value:n(1)} as Statement,{id:'wait-'+pin,kind:'wait',milliseconds:pin===5?350:900} as Statement,{id:'off-'+pin,kind:'write',pin,value:n(0)} as Statement])}]};
export const dialProgram:Program={version:1,target:'pic16f877a',start:[{id:'dial-loop',kind:'forever',body:[
 {id:'button-test',kind:'if',condition:{kind:'read',pin:0},then:[{id:'brightness',kind:'pwm',pin:16,value:{kind:'adc',pin:0}}],otherwise:[{id:'dark',kind:'pwm',pin:16,value:n(0)}]},
 {id:'breathe',kind:'wait',milliseconds:10}]}]};
// Workspace and firmware are generated from the same typed program.
export function workspaceFor(program:Program):object {
 const expr=(e:Expr):any=>e.kind==='number'?{type:'ws_number',fields:{VALUE:e.value}}:e.kind==='adc'||e.kind==='read'?{type:e.kind==='adc'?'ws_adc':'ws_read',fields:{PIN:e.pin}}:e.kind==='variable'?{type:'ws_get',fields:{SLOT:e.slot+1}}:e.kind==='not'?{type:'ws_not',inputs:{VALUE:{block:expr(e.value)}}}:{type:'ws_math',fields:{OP:e.op},inputs:{LEFT:{block:expr(e.left)},RIGHT:{block:expr(e.right)}}};
 const list=(statements:Statement[]):any=>{let next:any;for(const s of [...statements].reverse()){const b:any={id:s.id,type:'ws_'+s.kind};
  if(s.kind==='write'||s.kind==='pwm'){b.fields={PIN:s.pin};b.inputs={VALUE:{block:expr(s.value)}};}
  else if(s.kind==='wait')b.fields={MS:s.milliseconds};
  else if(s.kind==='forever')b.inputs={DO:{block:list(s.body)}};
  else if(s.kind==='if')b.inputs={CONDITION:{block:expr(s.condition)},THEN:{block:list(s.then)},ELSE:{block:list(s.otherwise)}};
  else if(s.kind==='repeat')b.inputs={COUNT:{block:expr(s.count)},DO:{block:list(s.body)}};
  else if(s.kind==='set'){b.fields={SLOT:s.slot+1};b.inputs={VALUE:{block:expr(s.value)}};}else b.inputs={VALUE:{block:expr(s.value)}};
  if(next)b.next={block:next};next=b;}return next;};
 return {blocks:{languageVersion:0,blocks:[{type:'ws_start',id:'start',x:25,y:25,inputs:{DO:{block:list(program.start)}}}]}};
}
function programmed(target:'atmega328p'|'pic16f877a'){
 const c=new Circuit(),cpu=c.add(target==='atmega328p'?'snapino':'pic16f877a',[],[1,0,5]);c.index=0;
 const d=byId[cpu.definition];const wire=(terminal:string,net:string)=>{c.nodes.set(net,{part:cpu.id,terminal});};
 wire('vcc','v');wire('gnd','0');
 if(target==='atmega328p'){
  wire('d4','red');wire('d5','yellow');wire('d6','green');c.add('ws-supply5',['v','0'],[9,0,5]);
  ['red','yellow','green'].forEach((colour,i)=>{c.add('6SCR1',[colour,'led'+i],[1+i*4,0,1]);c.add(['6SCD1','6SCD5','6SCD2'][i],['led'+i,'0'],[1+i*4,0,3]);});
 }else{
  wire('d0','button');wire('d16','out');wire('a0','sense');c.add('ws-supply5',['v','0'],[1,0,1]);c.add('6SCRV',['v','sense','0'],[5,0,1],{position:.65});
  c.add('6SCS2',['v','button'],[9,0,1]);c.add('6SCR4',['button','0'],[9,0,3]);c.add('6SCR1',['out','led'],[1,0,3]);c.add('6SCD1',['led','0'],[5,0,3]);
 }
 c.p.workspaces[cpu.id]=workspaceFor(target==='atmega328p'?trafficProgram:dialProgram);return c.p;
}
const entries:Omit<Lesson,'steps'|'expected'|'variation'>[]=[
 {id:'sun-chaser',name:'Sun Chaser',group:'Power',description:'Catch sunshine and make a light shine.',build:simple(c=>{c.add('6SCB2',['v','0']);c.add('6SCR1',['v','led']);c.add('6SCD1',['led','0']);}),check:bright},
 {id:'battery-team',name:'Battery Team',group:'Power',description:'Two battery packs work together for a six-volt bulb.',build:simple(c=>{c.add('6SCB1',['v','mid']);c.add('6SCB1',['mid','0']);c.add('6SCL2',['v','0']);}),check:bright},
 {id:'rainbow-row',name:'Rainbow Row',group:'Lights',description:'Make three colours glow side by side.',build:simple(c=>{c.add('6SCB3',['v','0'],[5,0,6]);['6SCD1','6SCD2','6SCD9'].forEach((id,i)=>{c.add('6SCR1',['v','led'+i],[1+i*4,0,1]);c.add(id,['led'+i,'0'],[1+i*4,0,3]);});}),check:s=>s.parts.filter(p=>p.brightness>.05).length===3},
 {id:'firefly-jar',name:'Firefly Jar',group:'Lights',description:'Store a little energy and watch it fade into light.',build:simple(c=>{c.add('6SCB1',['v','0']);c.add('6SCS2',['v','charge']);c.add('6SCC5',['charge','0']);c.add('6SCR2',['charge','led']);c.add('6SCD1',['led','0']);}),check:bright},
 {id:'reverse-fan',name:'Reverse the Fan',group:'Motion',description:'Change the connections to change the spin.',build:simple(c=>{c.add('6SCB1',['v','0'],[1,0,1]);const m=c.add('6SCM1',['v','0'],[6,0,4]);c.fan(m);}),check:spinning},
 {id:'wind-watts',name:'Wind Makes Watts',group:'Motion',description:'Wind turns a generator into a tiny power station.',build:simple(c=>{const m=c.add('6SCM4',['v','0'],[5,0,4]);c.fan(m);c.add('6SCM2',['v','0'],[1,0,1]);c.p.environment.wind=12;}),check:s=>s.parts.some(p=>p.voltage>.1&&Math.abs(p.angularVelocity)>5)},
 {id:'tap-secret',name:'Tap a Secret',group:'Controls',description:'Send a secret message with short and long flashes.',build:simple(c=>{c.add('6SCB1',['v','0']);c.add('6SCS2',['v','light']);c.add('6SCL1',['light','0']);}),check:bright},
 {id:'dimmer-detective',name:'Dimmer Detective',group:'Controls',description:'Turn the yellow dial to change a light.',build:simple(c=>{c.add('6SCB1',['v','0']);c.add('6SCRV',['v','w','0'],undefined,{position:.02});c.add('6SCR1',['w','led']);c.add('6SCD1',['led','0']);}),check:bright},
 {id:'one-way',name:'One-Way Gate',group:'Electronics',description:'Discover which way a diode lets current flow.',build:simple(c=>{c.add('6SCB1',['v','0']);c.add('6SCD3',['v','path']);c.add('6SCR1',['path','led']);c.add('6SCD1',['led','0']);}),check:bright},
 {id:'tiny-switch',name:'Tiny Switch, Big Job',group:'Electronics',description:'A small button asks a transistor to run a motor.',build:simple(c=>{c.add('6SCB1',['v','0'],[1,0,1]);c.add('6SCS2',['v','button'],[5,0,1]);c.add('6SCR2',['button','base'],[9,0,1]);c.add('6SCQ2',['c','0','base'],[1,0,5]);c.add('6SCR4',['base','0'],[1,0,8]);const m=c.add('6SCM1',['v','c'],[6,0,5]);c.fan(m);c.add('6SCD3',['c','v'],[9,0,7]);}),check:spinning},
 {id:'wire-flyover',name:'Wire Flyover',group:'Building',description:'Let two paths cross while their plastic keeps them apart.',build:simple(c=>{
  const a=c.add('6SC04',['v','lamp'],[4,0,4]),b=c.add('6SC04',['sw','path'],[5,2,3]);b.rotation=1;
  for(const z of [3,6])for(let layer=0;layer<2;layer++)c.add('6SC01',[z===3?'sw':'path'],[5,layer,z]);
  c.add('6SCB1',['v','0'],[1,0,1]);c.add('6SCL1',['lamp','0'],[9,0,1]);c.add('6SCR1',['path','led'],[1,0,7]);c.add('6SCD1',['led','0'],[5,0,7]);c.add('6SCS1',['v','sw'],[9,0,7]);
  void a;}),check:s=>s.parts.filter(p=>p.brightness>.02).length>=2},
 {id:'lighthouse',name:'Lighthouse Tower',group:'Building',description:'Stack connector pairs to lift a beacon above the board.',build:simple(c=>{
  c.add('6SCB1',['v','0'],[1,0,1]);c.add('6SCR1',['v','led'],[1,0,4]);
  for(let layer=0;layer<4;layer++){c.add('6SC01',['led'],[6,layer,4]);c.add('6SC01',['0'],[8,layer,4]);}
  c.add('6SCD1',['led','0'],[6,4,4]);}),check:bright},
 {id:'traffic-code',name:'Traffic-Light Dance',group:'Computers',description:'An AVR follows your blocks to change three traffic lights.',code:true,build:()=>programmed('atmega328p'),check:bright},
 {id:'dial-code',name:'Dial-a-Glow',group:'Computers',description:'A PIC reads a real button and dial, then drives its LED pin.',code:true,build:()=>programmed('pic16f877a'),check:bright},
 {id:'gear-buddies',name:'Gear Buddies',group:'Motion',extra:true,description:'Two supported gears turn together: one slower, one faster.',build:simple(c=>{
  c.add('6SCB1',['v','0'],[1,0,1]);c.add('6SCS1',['v','drive'],[6,0,1]);const m=c.add('6SCGM',['drive','0'],[4,0,4]);
  const small=c.add('6SCGEAR1',[],[0,0,0]),stand=c.add('6SCBGSUP',[],[5,0,5.275]),large=c.add('6SCGEAR2',[],[0,0,0]);c.p=attach(attach(c.p,small.id,m.id),large.id,stand.id);
 }),check:s=>s.parts.some(p=>Math.abs(p.angularVelocity)>1)},
 {id:'relay-race',name:'Relay Light Swap',group:'Electronics',extra:true,description:'An electromagnet chooses between two lights on a separate battery.',build:simple(c=>{
  c.add('6SCB1',['coil+','0'],[1,0,1]);c.add('6SCS1',['coil+','coil'],[5,0,1]);c.add('6SCB1',['v','return'],[9,0,1]);
  c.add('6SCS3',['coil','0','v','no','nc'],[5,0,4]);c.add('6SCD3',['0','coil'],[1,0,4]);
  c.add('6SCR1',['no','green'],[9,0,4]);c.add('6SCD2',['green','return'],[9,0,7]);c.add('6SCR1',['nc','red'],[1,0,7]);c.add('6SCD1',['red','return'],[5,0,7]);
 }),check:bright},
 {id:'npn-lantern',name:'NPN Lantern',group:'Electronics',extra:true,description:'A tiny base current opens the light’s path back to the battery.',build:simple(c=>{
  c.add('6SCB1',['v','0'],[1,0,1]);c.add('6SCS1',['v','button'],[5,0,1]);c.add('6SCR2',['button','base'],[9,0,1]);
  c.add('6SCQ2',['collector','0','base'],[5,0,4]);c.add('6SCR4',['base','0'],[9,0,4]);c.add('6SCR1',['v','led'],[1,0,4]);c.add('6SCD1',['led','collector'],[1,0,7]);
 }),check:bright},
 {id:'pnp-lantern',name:'PNP Lantern',group:'Electronics',extra:true,description:'This transistor switches the light from the battery’s plus side.',build:simple(c=>{
  c.add('6SCB1',['v','0'],[1,0,1]);c.add('6SCS1',['0','button'],[5,0,1]);c.add('6SCR2',['button','base'],[9,0,1]);
  c.add('6SCQ1',['collector','v','base'],[5,0,4]);c.add('6SCR4',['v','base'],[9,0,4]);c.add('6SCR1',['collector','led'],[1,0,4]);c.add('6SCD1',['led','0'],[1,0,7]);
 }),check:bright},
 {id:'transistor-team',name:'NPN + PNP Team',group:'Electronics',extra:true,description:'The NPN asks the PNP to turn on a light. Follow the message!',build:simple(c=>{
  c.add('6SCB1',['v','0'],[0,0,1]);c.add('6SCS1',['v','button'],[3,0,1]);c.add('6SCR2',['button','nb'],[6,0,1]);c.add('6SCQ2',['nc','0','nb'],[9,0,1]);
  c.add('6SCR4',['nb','0'],[9,0,4]);c.add('6SCR2',['pb','nc'],[6,0,4]);c.add('6SCQ1',['out','v','pb'],[3,0,4]);c.add('6SCR4',['v','pb'],[0,0,4]);
  c.add('6SCR1',['out','led'],[3,0,7]);c.add('6SCD1',['led','0'],[6,0,7]);
 }),check:bright},
 {id:'break-bulb',name:'Filament Flash',group:'Lights',description:'Find out why a small bulb cannot take a big electrical push.',danger:true,build:simple(c=>{c.add('6SCB5',['v','0']);c.add('6SCL1',['v','0']);}),check:s=>s.parts.some(p=>p.failed)},
 {id:'break-led',name:'The Missing Resistor',group:'Electronics',description:'Watch an unprotected LED fail, then discover its protector.',danger:true,build:simple(c=>{c.add('6SCB5',['v','0']);c.add('6SCD1',['v','0']);}),check:s=>s.parts.some(p=>p.failed)},
 {id:'break-npn',name:'One Load Too Many',group:'Electronics',description:'Three loads ask an NPN for more current than it can carry.',danger:true,build:simple(c=>{c.add('6SCB5',['v','0']);c.add('6SCR2',['v','base']);c.add('6SCQ2',['collector','0','base']);for(let i=0;i<3;i++)c.add('6SCR1',['v','collector']);}),check:(s,p)=>s.parts.some(o=>o.failed&&p.parts.some(q=>q.id===o.id&&q.definition==='6SCQ2'))},
 {id:'break-motor',name:'The Stuck Motor',group:'Motion',description:'A blocked axle turns electrical energy into too much heat.',danger:true,build:simple(c=>{c.add('6SCB5',['v','0']);c.add('6SCM1',['v','0'],undefined,{blocked:true});}),check:(s,p)=>s.parts.some(o=>o.failed&&p.parts.some(q=>q.id===o.id&&q.definition==='6SCM1'))}
];
const instructions:Record<string,string[]>={
 'sun-chaser':['The circuit is already running: catch the sunshine.','Open Surroundings and move Sunshine down, then up.','Watch the LED change with the available energy.'],
 'battery-team':['Follow the connection between the two battery packs.','Watch the six-volt bulb.','Select each battery to compare its voltage.'],
 'rainbow-row':['Find all three colours.','Turn on Dark Night to see their light spill.','Select each LED and compare the current.'],
 'firefly-jar':['Hold the yellow button for two seconds.','Release the button and watch the little light fade.','The capacitor is giving back its stored energy.'],
 'reverse-fan':['Watch the fan.','Select the motor and choose Swap the two ends. Its blue snap paths stay in place.','Watch the motor slow down and turn the other way.'],
 'wind-watts':['Watch the wind turn the fan.','Move Wind in Surroundings and watch the meter.','The moving motor is making electricity.'],
 'tap-secret':['Hold and release the yellow button.','Try three short flashes, then one long flash.','Ask someone to repeat your message.'],
 'dimmer-detective':['Select the adjustable resistor.','Drag the yellow handle left or right.','A small change near the bright end makes a big difference.'],
 'one-way':['Watch current pass through the diode.','Select the diode and choose Swap the two ends. Its blue snap paths stay in place.','The one-way gate now stops the light.'],
 'tiny-switch':['Hold the yellow button.','Watch the motor turn while the transistor carries its current.','Release the button to stop asking for power.'],
 'wire-flyover':['Use Top view to find the crossing.','Use Exploded layers to see the gap between the paths.','Try the slide switch.'],
 'lighthouse':['Use Exploded layers to count the stacked connectors.','Return to normal view and watch the beacon.','Look at the beacon in Dark Night.'],
 'traffic-code':['Watch the lights take turns.','Open Code and change one waiting time.','Send your blocks to the controller, and watch your new dance.'],
 'dial-code':['Hold the yellow button.','Release it, move the dial, then hold the button again. Compare the glow.','Open Code to see how the input controls the output.']
 ,'gear-buddies':['Click the green slide switch to stop and start the gears.','Follow the white marks: the bigger gear turns slower and the other way.','Select the big gear and hold it still. The motor’s current rises. Release it again.']
 ,'relay-race':['Click the slide switch: green and red take turns.','The coil battery pulls a tiny switch inside the relay. The other battery powers the lights.','Hover over a blue connector or cable to follow its path. The two battery loops stay separate.']
 ,'npn-lantern':['Click the slide switch to turn the lantern off and on.','Find B, C and E on the NPN. The little base signal lets current return through C to E.','The 1 kΩ resistor limits base current; the 10 kΩ resistor makes sure the transistor turns off.']
 ,'pnp-lantern':['Click the slide switch to turn the lantern off and on.','The emitter E is at battery +. A base path towards − turns this PNP on.','Compare with NPN Lantern: the transistor is on the other side of the light.']
 ,'transistor-team':['Click the slide switch and watch the light.','Follow the NPN collector to the PNP base resistor: one transistor asks the other to switch.','Turn it off. Both 10 kΩ resistors help their transistors return to the off state.']
};
const transistorSource={title:'Elenco: NPN and PNP parts and circuits',url:'https://www.elenco.com/wp-content/uploads/2017/10/753285-2.pdf'};
const hardware:Record<string,NonNullable<Lesson['hardware']>>={
 'npn-lantern':{note:'Functional build with B1 (3 V), S1, Q2, R1 (100 Ω), R2 (1 kΩ), R4 (10 kΩ) and D1. Znatok counterparts are shown in Real-life labels. Match B/C/E by label, not by body orientation. Keep the external LED resistor; kit LEDs may also contain protection.',sources:[transistorSource]},
 'pnp-lantern':{note:'Uses the same values as NPN Lantern, with Q1 (PNP). Its emitter goes to battery +. Follow the labelled terminals: exchanging NPN and PNP without rewiring does not work.',sources:[transistorSource]},
 'transistor-team':{note:'Functional build with Q2 + Q1, a 3 V B1, S1, D1, one 100 Ω, two 1 kΩ and two 10 kΩ resistors. Some kits need extra resistors. Match B/C/E and use the terminal guide; this is an original circuit, not a numbered manufacturer project.',sources:[transistorSource]},
 'relay-race':{note:'S3 is a changeover relay: identify its coil, common, normally open and normally closed contacts from your manual. Use two separate 3 V supplies and a 100 Ω resistor for each LED. Our coil resistance, pickup threshold and snap layout are estimates, so this is a functional equivalent, not an exact S3 construction diagram.',sources:[{title:'Elenco STEM: relay and separate coil/contact circuits',url:'https://elenco.com/wp-content/uploads/2017/05/SC_STEM1_manual_PRINT_Small.pdf'}]},
 'gear-buddies':{note:'Elenco lists 1-inch GEAR1 and 1.75-inch GEAR2 parts. Their outer sizes inform these models; tooth counts (12/22), axle adapters, bearing stand and friction are estimates. Use compatible shafts and your kit’s actual tooth counts for a physical build; do not assume the stand is a supplied Snap Circuits part.',sources:[{title:'Elenco parts catalogue: gears and geared motor',url:'https://www.elenco.com/wp-content/uploads/2022/02/Snap-Circuits_Order-Form.pdf'}]},
};
export const lessons:Lesson[]=[...entries.map(e=>({...e,hardware:hardware[e.id],steps:instructions[e.id]??['This is a virtual experiment. Never copy it with real parts.','Press Run and watch the condition and current readings.','Select the broken part, replace it, then try Guided mode.'],expected:e.danger?'The intended part fails and stays broken until you replace it.':e.code?'The controller changes electrical pins and the connected light responds.':e.description,variation:e.danger?'Compare the same circuit in Guided mode: it pauses before damage.':'Change one control or connection, predict the result, then try it.'})),...singleTransistorLessons];
export function lessonFor(p:Project){return lessons.find(l=>l.id===p.lesson?.templateId);}
export function createLesson(id:string):Project{const l=lessons.find(l=>l.id===id);if(!l)throw Error('Unknown project');const p=l.build();p.name=l.name;p.mode=l.danger?'experiment':'guided';p.lesson={templateId:id,version:1,step:0,completed:false};
 // Engaged snaps already conduct. Do not draw redundant flexible wires up
 // through a supported stack; each removal is checked against the actual nets.
 for(const wire of [...p.connections].filter(c=>c.kind==='wire')){const without={...p,connections:p.connections.filter(c=>c.id!==wire.id)},circuit=electricalCircuit(without);const net=(end:typeof wire.from)=>{const i=p.parts.findIndex(q=>q.id===end.part),t=byId[p.parts[i].definition].terminals.findIndex(t=>t.id===end.terminal);return circuit.parts[i].terminals[t];};if(net(wire.from)===net(wire.to))p.connections=without.connections;}
 return preferSnapConnectors(p);
}
export async function prepareLesson(id:string,readFirmware?:(target:string)=>Promise<string>){
 if(!readFirmware&&typeof document!=='undefined'){const response=await fetch(new URL('projects/'+id+'.json',document.baseURI));if(!response.ok)throw Error('This project is missing from the download.');const p=await response.json() as Project;p.id=uniqueId();return p;}
 const p=createLesson(id),l=lessonFor(p)!;if(l.code){const cpu=p.parts.find(p=>byId[p.definition].programming)!;const program=id==='traffic-code'?trafficProgram:dialProgram;
  const file=program.target==='atmega328p'?'avr':'pic';const runtime=readFirmware?await readFirmware(file):await (await fetch(new URL('firmware/'+file+'-runtime.hex',document.baseURI))).text();p.firmware[cpu.id]=packageFirmware(runtime,compile(program));}
 return p;
}
export {healthy};
