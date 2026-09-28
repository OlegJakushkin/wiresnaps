import RAPIER from '@dimforge/rapier3d-compat';
import type { Project,Snapshot } from './types';
import { byId } from './catalogue';
import {rotorDrives,type RotorDrive} from './gears';
// SI units. Gear loads are reflected into one generalized rotor per train:
// J = sum(Ji ri^2), torque = sum(ti ri), wi = ri w. Rapier advances it at 1 ms.
export class Mechanics {
 private world?:RAPIER.World;private rotors=new Map<string,RAPIER.RigidBody>();private drives=new Map<string,RotorDrive>();
 private losses=new Map<string,{inertia:number;viscous:number;dry:number}>();
 static async init(){await RAPIER.init();}
 load(project:Project,previous?:Snapshot){
  this.world?.free();this.world=new RAPIER.World({x:0,y:0,z:0});this.world.timestep=.001;this.rotors.clear();this.losses.clear();this.drives=rotorDrives(project);
  for(const driver of new Set([...this.drives.values()].map(x=>x.driver))){
   const members=project.parts.filter(p=>this.drives.get(p.id)?.driver===driver);let inertia=0,viscous=0,dry=0;
   for(const p of members){const d=byId[p.definition],ratio=this.drives.get(p.id)!.ratio;
    const j=d.model==='motor'?Number(d.parameters.inertia??1e-6):.004*(d.shape==='fan'?.035:Number(d.parameters.outerRadius??.58)*.0254)**2/2;
    inertia+=j*ratio*ratio;
    viscous+=Math.max(0,Number(d.parameters.friction??(d.model==='motor'?2e-6:0)))*ratio*ratio;
    dry+=Math.max(0,Number(d.parameters.coulombFriction??0))*Math.abs(ratio);
   }
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().lockTranslations().enabledRotations(false,true,false));
   inertia=Math.max(1e-8,inertia);body.setAdditionalMassProperties(.001,{x:0,y:0,z:0},{x:1e-6,y:inertia,z:1e-6},{x:0,y:0,z:0,w:1},true);this.rotors.set(driver,body);this.losses.set(driver,{inertia,viscous,dry});
   const retained=previous?.parts.find(q=>q.id===driver);if(retained)body.setAngvel({x:0,y:retained.angularVelocity,z:0},true);
  }
 }
 step(snapshot:Snapshot,project:Project){
  if(!this.world)return {parts:[]};
  for(const [driver,body] of this.rotors){let torque=0,blocked=false;
   body.resetTorques(true);
   for(const p of project.parts){const drive=this.drives.get(p.id);if(drive?.driver!==driver)continue;const d=byId[p.definition],speed=body.angvel().y*drive.ratio;
    blocked ||= !!p.control.blocked;let t=Number(p.control.driveTorque??0);
    if(d.model==='motor')t+=snapshot.parts.find(o=>o.id===p.id)?.torque??0;
    if(d.shape==='fan')t+=.5*1.225*Math.PI*.03**2*.02*project.environment.wind**2-2e-8*speed*Math.abs(speed);
    torque+=t*drive.ratio;
   }
   if(blocked){body.setAngvel({x:0,y:0,z:0},true);body.setBodyType(RAPIER.RigidBodyType.Fixed,true);}
   else {body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);body.addTorque({x:0,y:torque,z:0},true);}
  }
  this.world.step();
  // Implicit viscous drag plus dry friction: remove angular momentum, never
  // reverse it. At rest the same friction balances a sub-threshold drive torque.
  // This is the same law as the native engine's unloaded motor integrator.
  for(const [driver,body] of this.rotors){const {inertia,viscous,dry}=this.losses.get(driver)!,free=body.angvel().y;
   const speed=Math.sign(free)*Math.max(0,Math.abs(free)-.001*dry/inertia)/(1+.001*viscous/inertia);body.setAngvel({x:0,y:speed,z:0},true);
  }
  return {parts:project.parts.filter(p=>byId[p.definition].model==='motor').map(p=>{const drive=this.drives.get(p.id)!;return {id:p.id,control:{angularVelocity:this.rotors.get(drive.driver)!.angvel().y*drive.ratio}};})};
 }
 dispose(){this.world?.free();}
}
