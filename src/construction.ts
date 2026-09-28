import {byId} from './catalogue';
import {BASE_Y,BOARD,LAYER} from './component-design';
import type {BodyShape,Instance,Project,Vec3} from './types';
export interface Bounds {min:Vec3;max:Vec3;}
export interface ConstructionIssue {code:'BODY_OVERLAP'|'OUTSIDE_BOARD';parts:string[];message:string;}
export function rotatePoint(v:Vec3,r:number):Vec3{const a=r*Math.PI/2,c=Math.round(Math.cos(a)),s=Math.round(Math.sin(a));return [v[0]*c-v[2]*s,v[1],v[0]*s+v[2]*c];}
export function physicalPoint(p:Instance,v:Vec3):Vec3 {const q=rotatePoint(v,p.rotation);return [q[0]+p.position[0],q[1]+BASE_Y+p.position[1]*LAYER,q[2]+p.position[2]];}
function halfSize(s:BodyShape):Vec3{
 let h:Vec3=s.kind==='box'?s.size.map(x=>x/2) as Vec3:s.kind==='sphere'?[...s.size]:[s.size[0],s.size[1]/2,s.size[0]];
 // Authored geometry uses quarter turns; conservative envelopes include rounded edges.
 if(s.rotation?.[2])h=[h[1],h[0],h[2]];
 if(s.rotation?.[0])h=[h[0],h[2],h[1]];
 if(s.rotation?.[1]&&Math.abs(Math.sin(s.rotation[1]))>.5)h=[h[2],h[1],h[0]];
 return h;
}
export function shapeBounds(p:Instance,s:BodyShape):Bounds {const at=physicalPoint(p,s.at);const h=rotatePoint(halfSize(s),p.rotation).map(Math.abs);return {min:at.map((x,i)=>x-h[i]) as Vec3,max:at.map((x,i)=>x+h[i]) as Vec3};}
const shapeCache=new WeakMap<Instance,{key:string;shapes:{s:BodyShape;b:Bounds}[];bounds:Bounds}>();
function prepared(p:Instance){const key=p.definition+':'+p.position.join(',')+':'+p.rotation;const old=shapeCache.get(p);if(old?.key===key)return old;const shapes=byId[p.definition].geometry.filter(s=>s.collision!==false&&(s.role!=='detail'||s.collision===true)).map(s=>({s,b:shapeBounds(p,s)}));const entry={key,shapes,bounds:{min:[0,1,2].map(i=>Math.min(...shapes.map(s=>s.b.min[i]))) as Vec3,max:[0,1,2].map(i=>Math.max(...shapes.map(s=>s.b.max[i]))) as Vec3}};shapeCache.set(p,entry);return entry;}
function solids(p:Instance){return prepared(p).shapes;}
export function bounds(p:Instance):Bounds{return prepared(p).bounds;}
function overlap(a:Bounds,b:Bounds){return a.min.every((x,i)=>x<b.max[i]-.008&&a.max[i]>b.min[i]+.008);}
function engaged(a:Instance,b:Instance,shape:BodyShape){
 const q=physicalPoint(a,[shape.at[0],0,shape.at[2]]);
 return byId[b.definition].snaps.some(s=>{const v=physicalPoint(b,[s.position[0],0,s.position[2]]);return Math.abs(q[0]-v[0])<.01&&Math.abs(q[2]-v[2])<.01&&Math.abs(Math.abs(q[1]-v[1])-LAYER)<.01;});
}
function partsOverlap(a:Instance,b:Instance){
 if(!overlap(bounds(a),bounds(b)))return false;
 // Only matched pitch circles may share the tooth engagement envelope. Other
 // objects still collide with each gear's complete rotating sweep.
 if(gearsMesh(a,b))return false;
 for(const x of solids(a))for(const y of solids(b)){
  if(!overlap(x.b,y.b))continue;
  if(x.s.role==='snap'&&y.s.role==='base'&&engaged(a,b,x.s))continue;
  if(y.s.role==='snap'&&x.s.role==='base'&&engaged(b,a,y.s))continue;
  if(x.s.role==='snap'&&y.s.role==='snap'&&engaged(a,b,x.s))continue;
  return true;
 }
 return false;
}
export function gearsMesh(a:Instance,b:Instance){
 const da=byId[a.definition],db=byId[b.definition];if(da.shape!=='gear'||db.shape!=='gear')return false;
 return Math.abs(a.position[1]-b.position[1])<.025&&Math.abs(Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])-Number(da.parameters.pitchRadius)-Number(db.parameters.pitchRadius))<.012;
}
export function validateConstruction(parts:Instance[]):ConstructionIssue[]{
 const issues:ConstructionIssue[]=[];
 for(let i=0;i<parts.length;i++){const p=parts[i],b=bounds(p);
  if(b.min[0]<BOARD.minX||b.max[0]>BOARD.maxX||b.min[2]<BOARD.minZ||b.max[2]>BOARD.maxZ||p.position[1]<0||p.position[1]>8)issues.push({code:'OUTSIDE_BOARD',parts:[p.id],message:byId[p.definition].name+' needs to fit on the board.'});
  for(let j=0;j<i;j++)if(partsOverlap(p,parts[j]))issues.push({code:'BODY_OVERLAP',parts:[p.id,parts[j].id],message:byId[p.definition].name+' overlaps '+byId[parts[j].definition].name+'. Move it or choose a clear layer.'});
 }
 return issues;
}
export function canPlace(p:Instance,others:Instance[]){const b=bounds(p);return b.min[0]>=BOARD.minX&&b.max[0]<=BOARD.maxX&&b.min[2]>=BOARD.minZ&&b.max[2]<=BOARD.maxZ&&p.position[1]>=0&&p.position[1]<=8&&!others.some(x=>x.id!==p.id&&partsOverlap(p,x));}
export function assemblyIds(project:Project,id:string){const ids=new Set([id]);let added=true;while(added){added=false;for(const c of project.connections)if(c.kind==='mechanical'&&ids.has(c.from.part)&&!ids.has(c.to.part)){ids.add(c.to.part);added=true;}}return ids;}
export function assemblyRoot(project:Project,id:string){const seen=new Set<string>();while(!seen.has(id)){seen.add(id);const parent=project.connections.find(c=>c.kind==='mechanical'&&c.to.part===id);if(!parent)return id;id=parent.from.part;}return id;}
export function movingAssemblyIds(project:Project,id:string){return assemblyIds(project,assemblyRoot(project,id));}
export function moveAssembly(project:Project,id:string,position:Vec3,rotation?:number):Project{
 const original=project.parts.find(p=>p.id===id);if(!original)return project;const ids=movingAssemblyIds(project,id),turns=rotation===undefined?0:(rotation-original.rotation+4)%4;
 return {...project,parts:project.parts.map(p=>{if(!ids.has(p.id))return p;const v=rotatePoint([p.position[0]-original.position[0],p.position[1]-original.position[1],p.position[2]-original.position[2]],turns);return {...p,position:[position[0]+v[0],position[1]+v[1],position[2]+v[2]],rotation:(p.rotation+turns)%4};})};
}
export function reverseTerminals(project:Project,id:string):Project{
 const part=project.parts.find(p=>p.id===id);if(!part)return project;const terminals=byId[part.definition].terminals;if(terminals.length!==2)return project;
 // A physical half-turn about the midpoint of the two terminals keeps the
 // connector locations fixed. Attached fans turn with their motor.
 const [a,b]=terminals.map(t=>t.position),offset=rotatePoint([a[0]+b[0],0,a[2]+b[2]],part.rotation);
 return moveAssembly(project,id,[part.position[0]+offset[0],part.position[1],part.position[2]+offset[2]],(part.rotation+2)%4);
}
export function removeAssembly(project:Project,id:string):Project{
 const ids=assemblyIds(project,id);return {...project,parts:project.parts.filter(p=>!ids.has(p.id)),connections:project.connections.filter(c=>!ids.has(c.from.part)&&!ids.has(c.to.part)),workspaces:Object.fromEntries(Object.entries(project.workspaces).filter(([k])=>!ids.has(k))),firmware:Object.fromEntries(Object.entries(project.firmware).filter(([k])=>!ids.has(k)))};
}
export function attach(project:Project,accessoryId:string,motorId:string):Project{
 const accessory=project.parts.find(p=>p.id===accessoryId),motor=project.parts.find(p=>p.id===motorId);if(!accessory||!motor)return project;
 const mount=byId[accessory.definition].attachments.find(a=>a.kind==='axle'),shaft=byId[motor.definition].attachments.find(a=>a.id==='shaft');if(!mount||!shaft)return project;
 const at=physicalPoint(motor,shaft.position),local=rotatePoint(mount.position,motor.rotation);
 const position:Vec3=[at[0]-local[0],(at[1]-local[1]-BASE_Y)/LAYER,at[2]-local[2]];
 return {...project,parts:project.parts.map(p=>p.id===accessoryId?{...p,position,rotation:motor.rotation}:p),connections:[...project.connections.filter(c=>c.kind!=='mechanical'||c.to.part!==accessoryId),{id:'attachment-'+accessoryId,kind:'mechanical',from:{part:motorId,terminal:'shaft'},to:{part:accessoryId,terminal:mount.id}}]};
}
