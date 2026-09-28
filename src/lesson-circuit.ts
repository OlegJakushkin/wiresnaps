import {byId} from './catalogue';
import {emptyProject,place} from './project';
import {attach} from './construction';
import {uniqueId} from './id';
import type {Instance,Vec3} from './types';

export class Circuit {
 p=emptyProject();nodes=new Map<string,{part:string;terminal:string}>();index=0;
 add(def:string,nets:string[],position?:Vec3,control?:Instance['control']){
  const at=position??[1+(this.index%3)*4,0,1+Math.floor(this.index/3)*3] as Vec3;this.index++;
  const part=place(def,at);if(control)part.control={...part.control,...control};this.p.parts.push(part);
  byId[def].terminals.forEach((t,i)=>{const net=nets[i];if(!net)return;const endpoint={part:part.id,terminal:t.id},first=this.nodes.get(net);if(first)this.p.connections.push({id:uniqueId(),kind:'wire',from:first,to:endpoint});else this.nodes.set(net,endpoint);});return part;
 }
 fan(motor:Instance){const f=this.add('6SCM1F',[],[1,0,8]);this.p=attach(this.p,f.id,motor.id);}
}
