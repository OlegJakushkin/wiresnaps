import {byId} from './catalogue';
import type {Project,Snapshot} from './types';
export interface Hint {title:string;body:string;action?:string;kind:'idea'|'warning'|'success';part?:string;}
export function guidance(project:Project,snapshot?:Snapshot):Hint {
 const problem=snapshot?.diagnostics[0];if(problem)return {title:'Let’s check this circuit',body:'The engine stopped at its last good result. '+problem.code,kind:'warning'};
 const intervention=snapshot?.events.find(e=>e.code==='DAMAGE_PREVENTED');if(intervention){const p=project.parts.find(x=>x.id===intervention.part);const d=p&&byId[p.definition];return {title:'A little too much electricity',body:`Your ${d?.name.toLowerCase()??'part'} is getting more energy than it can handle. We paused before it broke. Try a smaller battery or a resistor in the path.`,kind:'warning',part:intervention.part};}
 const broken=snapshot?.parts.find(p=>p.failed);if(broken)return {title:'A part has changed',body:(broken.temperature>70?'Too much heat damaged this part. ':'Too much electrical stress damaged this part. ')+(broken.failure==='short'?'Its terminals now act like a short connection. ':'Its conducting path is now broken. ')+'Switching power off does not repair it. Select it and choose Replace part to try again.',kind:'warning',part:broken.id};
 const lit=snapshot?.parts.find(p=>p.brightness>.25);if(lit)return {title:'You made a complete loop!',body:'Energy is travelling from the battery to your light. Open the switch and see what happens to the current.',kind:'success',part:lit.id};
 if(project.parts.length===0)return {title:'Start with a little spark',body:'Choose a battery, a switch and a bulb. Click on the board to place each one. Use blue wires to make a loop.',kind:'idea'};
 return {title:'Follow the little loop',body:'Electricity needs a path out of the battery and all the way back. Snaps connect on neighbouring layers. Use Join snaps for a flexible wire.',kind:'idea',action:'Try closing the switch'};
}
