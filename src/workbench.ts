import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {SSAOPass} from 'three/addons/postprocessing/SSAOPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {byId} from './catalogue';
import {place} from './project';
import {LAYER,BASE_Y,partLabel,terminalLabel} from './component-design';
import {canPlace,validateConstruction,moveAssembly,movingAssemblyIds,physicalPoint,shapeBounds} from './construction';
import {clearWireRoutes,traceWire,conductor,rewireConnection,type WireTrace} from './wiring';
import {rotorDrives,type RotorDrive} from './gears';
import type {Definition,Endpoint,Instance,Project,Snapshot,Vec3,Naming,Presentation} from './types';
function cableCurve(via:THREE.Vector3[]){
 const curve=new THREE.CurvePath<THREE.Vector3>();let last=via[0];
 for(let i=1;i<via.length-1;i++){const p=via[i],next=via[i+1],r=Math.min(.065,p.distanceTo(last)/3,p.distanceTo(next)/3);if(r<1e-6)continue;
  const enter=p.clone().add(last.clone().sub(p).normalize().multiplyScalar(r)),leave=p.clone().add(next.clone().sub(p).normalize().multiplyScalar(r));
  if(last.distanceTo(enter)>1e-6)curve.add(new THREE.LineCurve3(last,enter));curve.add(new THREE.QuadraticBezierCurve3(enter,p,leave));last=leave;
 }
 if(last.distanceTo(via.at(-1)!)>1e-6)curve.add(new THREE.LineCurve3(last,via.at(-1)!));return curve;
}
const material=(color:THREE.ColorRepresentation,metalness=0)=>new THREE.MeshStandardMaterial({color,metalness,roughness:metalness?.26:.32});
function roundedPlate(width:number,height:number,depth:number){
 // Footprint rounding is independent of thickness: a thin snap plate still
 // has the generous, toy-plastic corners of the original workbench.
 const bevel=.02,x=width/2-bevel,z=depth/2-bevel,r=Math.min(.22,x*.6,z*.65),s=new THREE.Shape();
 s.moveTo(-x+r,-z);s.lineTo(x-r,-z);s.quadraticCurveTo(x,-z,x,-z+r);s.lineTo(x,z-r);s.quadraticCurveTo(x,z,x-r,z);s.lineTo(-x+r,z);s.quadraticCurveTo(-x,z,-x,z-r);s.lineTo(-x,-z+r);s.quadraticCurveTo(-x,-z,-x+r,-z);
 const g=new THREE.ExtrudeGeometry(s,{depth:height-2*bevel,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:6});g.rotateX(-Math.PI/2);g.center();return g;
}
function label(text:string,width=1,color='#243849'){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;ctx.font='bold 92px system-ui';canvas.width=Math.ceil(ctx.measureText(text).width+30);canvas.height=128;
 ctx.fillStyle=color;ctx.font='bold 92px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,64,canvas.width-16);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const object=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(width,canvas.width/128*.22),.22),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
 object.rotation.x=-Math.PI/2;object.renderOrder=2;return object;
}
export function componentMesh(d:Definition,naming:Naming='none'){
 const root=new THREE.Group(),rotor=new THREE.Group();root.add(rotor);
 for(const shape of d.geometry){
  if(shape.role==='detail'&&shape.collision===true)continue;
  const [x,y,z]=shape.size;
  const geometry=shape.kind==='box'?shape.role==='base'?roundedPlate(x,y,z):new RoundedBoxGeometry(x,y,z,2,Math.min(.065,x/4,y/4,z/4)):shape.kind==='sphere'?new THREE.SphereGeometry(x,20,16):new THREE.CylinderGeometry(x,x,y,shape.sides??24);
  const mat=material(shape.color,shape.metal??0);if(shape.role==='base'){const h={h:0,s:0,l:0};mat.color.getHSL(h);mat.color.setHSL(h.h,Math.min(1,h.s*1.25),Math.max(.28,h.l-.07));}
  const object=new THREE.Mesh(geometry,mat);object.position.fromArray(shape.at);if(shape.rotation)object.rotation.set(...shape.rotation);
  object.castShadow=true;object.receiveShadow=true;object.userData.original=mat.color.clone();
  if(shape.role==='snap')object.userData.snapTerminal=d.snaps.find(s=>s.position[0]===shape.at[0]&&s.position[2]===shape.at[2])?.terminal;
  if(shape.role==='emitter'){object.userData.emitter=true;object.userData.lightColor=d.model==='lamp'?'#ffbc53':d.color;}
  if(shape.role==='actuator'){object.userData.actuator=true;object.userData.origin=object.position.clone();}
  (shape.role==='rotor'?rotor:root).add(object);
 }
 rotor.userData.rotor=true;
 const symbol:Record<string,string>={resistor:'─▰─',diode:'▷│',led:'↗',capacitor:'││',lamp:'⊗'};
 const printed=d.shape==='gear'?d.parameters.teeth+'T':partLabel(d,naming)+(symbol[d.model]?' '+symbol[d.model]:'')+(d.model==='lamp'?' '+d.parameters.voltage+'V':d.model==='led'?' 30mA':'');
 const name=label(printed,d.model==='accessory'?.38:Math.min(1.25,d.size[0]-.12),d.model==='accessory'&&d.shape!=='gear'?'#253a4c':'#fff');name.position.set(d.size[0]/2-.32,.169,Math.max(0,d.size[2]-.44));if(d.model==='mcu')name.position.set(2.5,.411,2.5);
 if(d.model==='accessory'){name.position.set(0,d.shape==='gear'?.181:d.shape==='fan'?.112:d.shape==='wheel'?.191:.205,d.shape==='gear'?.26:d.shape==='fan'?0:.23);(d.shape==='support'?root:rotor).add(name);}else root.add(name);
 for(const m of d.markings){if(m.at[1]===.167)continue;const text=label(m.terminal?terminalLabel(d,m.terminal,naming):m.text,m.width,m.color??'#142e43');text.position.fromArray(m.at);root.add(text);}
 for(const s of d.snaps){const target=new THREE.Mesh(new THREE.SphereGeometry(.23,8,6),new THREE.MeshBasicMaterial({visible:false}));target.position.set(s.position[0],.27,s.position[2]);target.userData.terminal=s.terminal;root.add(target);}
 if(d.geometry.some(s=>s.role==='emitter')){
  const emitter=d.geometry.find(s=>s.role==='emitter')!;root.userData.emitterPosition=new THREE.Vector3(...emitter.at).add(new THREE.Vector3(0,.15,0));root.userData.emitterColor=d.model==='lamp'?'#ffc66b':d.color;
  const glow=new THREE.Mesh(new THREE.SphereGeometry(emitter.size[0]*1.2,16,12),new THREE.MeshBasicMaterial({color:root.userData.emitterColor,transparent:true,opacity:0,depthWrite:false}));glow.position.fromArray(emitter.at);root.add(glow);root.userData.glow=glow;
 }
 const crack=label('×',.8,'#222c32');crack.position.set(1,Math.max(...d.geometry.map(s=>s.at[1]))+.23,0);crack.visible=false;root.add(crack);root.userData.crack=crack;
 return root;
}
interface Events {
 select:(id:string|null)=>void;place:(definition:string,position:Vec3,rotation:number)=>void;move:(id:string,position:Vec3)=>void;
 snap:(id:string,terminal:string)=>void;preview:(valid:boolean,layers:number[])=>void;control:(id:string,key:string,value:number|boolean)=>void;
 remove:(id:string)=>void;trash:(over:boolean)=>void;detach:(parts:string[],wires?:string[])=>void;
 rewire:(wire:string,side:'from'|'to',target:Endpoint)=>boolean;
 trace:(trace:WireTrace)=>void;
}
export class Workbench {
 private renderer:THREE.WebGLRenderer;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(34,1,.1,150);
 private controls:OrbitControls;private parts=new THREE.Group();private wires=new THREE.Group();private helpers=new THREE.Group();
 private wireHandles=new THREE.Group();private routes=new Map<string,THREE.Vector3[]>();
 private wireEdit?:{id:string;side:'from'|'to';mesh:THREE.Mesh;points:THREE.Vector3[];goal:THREE.Vector3[];candidate?:Endpoint;released:boolean};
 private reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
 private objects=new Map<string,THREE.Group>();private project?:Project;private snapshot?:Snapshot;private selected:string|null=null;
 private hovered:string|null=null;private traced:string|null=null;private drives=new Map<string,RotorDrive>();
 private ray=new THREE.Raycaster();private mouse=new THREE.Vector2();private frame=0;private resize:ResizeObserver;
 private ghost?:THREE.Group;private ghostPosition:Vec3=[4,0,4];private placing:string|null=null;private rotation=0;private layer=0;private exploded=false;private joining=false;private topView=false;
 private down?:{x:number;y:number;part?:string;wire?:string;wireEnd?:'from'|'to';terminal?:string;drag:boolean;actuator?:boolean;pointer:number;position?:Vec3;dial?:number};
 private last=performance.now();private frames:number[]=[];fps=60;private slow=0;private cheap=true;private autoTried=false;private fast=0;
 private composer:EffectComposer;private ao:SSAOPass;private dof:BokehPass;private bloom:UnrealBloomPass;
 private hemi=new THREE.HemisphereLight('#dff2ff','#c89876',1);private sun=new THREE.DirectionalLight('#fff1d8',3.2);
 private presentation:Presentation={night:false,naming:'none',quality:'auto'};private highQuality?:boolean;private appliedSnapshot?:Snapshot;
 private shown=true;
 readonly ready:Promise<void>;private warmed=false;private destroyed=false;
 private shaderReservoir=new THREE.Group();private lightPool=Array.from({length:8},()=>new THREE.PointLight('#ffffff',0,4,2));
 private tableMaterial=material('#f5dca8');
 constructor(private host:HTMLElement,private events:Events){
  this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,.7));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // The light and its shadow camera do not move. Rebuild the shadow only when
  // a component moves, instead of redrawing the whole circuit for every frame.
  this.renderer.shadowMap.autoUpdate=false;this.renderer.shadowMap.needsUpdate=true;
  this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','3D circuit construction board');this.renderer.domElement.tabIndex=0;
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=4;this.controls.maxDistance=38;this.controls.maxPolarAngle=Math.PI*.48;this.home();
  this.scene.add(this.hemi,this.sun,...this.lightPool);this.sun.position.set(-4,14,5);this.sun.castShadow=true;this.sun.shadow.mapSize.set(1024,1024);Object.assign(this.sun.shadow.camera,{left:-15,right:15,top:14,bottom:-14});this.sun.shadow.normalBias=.025;
  const table=new THREE.Mesh(new THREE.PlaneGeometry(160,160),this.tableMaterial);table.rotation.x=-Math.PI/2;table.position.y=-.4;table.receiveShadow=true;this.scene.add(table);
  const board=new THREE.Mesh(new RoundedBoxGeometry(13.8,.28,10.8,3,.1),material('#f4eedc'));board.position.set(6,-.18,4.5);board.receiveShadow=true;this.scene.add(board);
  const studs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.105,.13,.08,12),material('#fff7e7'),130);const matrix=new THREE.Matrix4();let i=0;
  for(let x=0;x<13;x++)for(let z=0;z<10;z++){matrix.makeTranslation(x,.01,z);studs.setMatrixAt(i++,matrix);}studs.castShadow=true;studs.receiveShadow=true;this.scene.add(studs);
  for(let x=0;x<13;x++){const t=label(String(x+1),.35);t.position.set(x,-.027,-.6);this.scene.add(t);}for(let z=0;z<10;z++){const t=label(String.fromCharCode(65+z),.35);t.position.set(-.6,-.027,z);this.scene.add(t);}
  this.scene.add(this.parts,this.wires,this.helpers,this.wireHandles);
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
  this.ao=new SSAOPass(this.scene,this.camera,1,1);this.ao.kernelRadius=5;this.ao.minDistance=.002;this.ao.maxDistance=.12;this.composer.addPass(this.ao);
  this.bloom=new UnrealBloomPass(new THREE.Vector2(1,1),.42,.35,1.25);this.composer.addPass(this.bloom);
  this.dof=new BokehPass(this.scene,this.camera,{focus:19,aperture:.00012,maxblur:.003});this.composer.addPass(this.dof);this.composer.addPass(new OutputPass());
  this.resize=new ResizeObserver(()=>{if(this.warmed)this.fit();});this.resize.observe(host);
  const canvas=this.renderer.domElement;canvas.addEventListener('pointerdown',this.pointerDown);canvas.addEventListener('pointermove',this.pointerMove);canvas.addEventListener('pointerleave',this.pointerLeave);canvas.addEventListener('pointerup',this.pointerUp);canvas.addEventListener('pointercancel',this.cancel);canvas.addEventListener('lostpointercapture',this.cancel);window.addEventListener('blur',this.cancel);
  this.setPresentation(this.presentation);this.ready=this.prewarm();
 }
 private fit(){const {width,height}=this.host.getBoundingClientRect();this.camera.aspect=width/Math.max(1,height);this.camera.updateProjectionMatrix();this.renderer.setSize(width,height);this.composer.setSize(width,height);}
 private async prewarm(){
  // Keep one owner for every material program until the board is destroyed.
  // Otherwise disposing the last lamp/selection also discards its GPU program.
  const probe=new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.3),material('#ffffff'));probe.castShadow=true;probe.receiveShadow=true;
  const transparent=probe.clone();transparent.material=material('#ffffff');transparent.material.transparent=true;
  const glow=new THREE.Mesh(probe.geometry.clone(),new THREE.MeshBasicMaterial({transparent:true,opacity:.4}));
  const text=label('Ready');this.renderer.initTexture((text.material as THREE.MeshBasicMaterial).map!);
  this.shaderReservoir.add(probe,transparent,glow,text,new THREE.BoxHelper(probe));this.shaderReservoir.position.set(6,.5,4.5);this.scene.add(this.shaderReservoir);
  this.renderer.setPixelRatio(1);this.renderer.setSize(32,32,false);this.composer.setPixelRatio(1);this.composer.setSize(32,32);
  this.controls.update();this.ao.enabled=this.bloom.enabled=this.dof.enabled=true;
  try{
   // Light count and render-target colour space change generated GLSL. Cover
   // all supported counts in both paths, including postprocessing and shadows.
   for(let count=0;count<=this.lightPool.length;count++){
    if(this.destroyed)return;this.lightPool.forEach((light,i)=>light.visible=i<count);
    this.renderer.setRenderTarget(null);await this.renderer.compileAsync(this.scene,this.camera);
    if(this.destroyed)return;this.renderer.shadowMap.needsUpdate=true;this.renderer.render(this.scene,this.camera);
    this.renderer.setRenderTarget(this.composer.readBuffer);await this.renderer.compileAsync(this.scene,this.camera);
    if(this.destroyed)return;this.renderer.setRenderTarget(null);this.composer.render();
    this.host.dataset.shaderProgress=String(count+1);await new Promise<void>(resolve=>setTimeout(resolve,0));
   }
  }finally{this.scene.remove(this.shaderReservoir);}
  if(this.destroyed)return;
  this.lightPool.forEach(light=>light.visible=false);this.renderer.setRenderTarget(null);this.renderer.setPixelRatio(Math.min(devicePixelRatio,.7));this.composer.setPixelRatio(this.renderer.getPixelRatio());
  this.warmed=true;this.fit();this.host.dataset.shaders='ready';this.last=performance.now();this.animate();
 }
 private animate=()=>{
  this.frame=requestAnimationFrame(this.animate);if(!this.shown||document.hidden){this.last=performance.now();return;}this.controls.update();const now=performance.now(),elapsed=now-this.last;this.last=now;
  this.frames.push(elapsed);if(this.frames.length>60)this.frames.shift();this.fps=Math.round(1000/(this.frames.reduce((a,b)=>a+b,0)/this.frames.length));
  if(this.presentation.quality==='auto'){if(elapsed<19)this.fast++;else this.fast=0;if(!this.autoTried&&this.fast>90){this.cheap=false;this.autoTried=true;}if(!this.cheap&&elapsed>28)this.slow++;if(this.slow>12||!this.cheap&&elapsed>150){this.cheap=true;this.autoTried=true;this.slow=0;}}
  const high=this.presentation.quality==='high'||this.presentation.quality==='auto'&&!this.cheap;
  if(high!==this.highQuality){this.highQuality=high;this.renderer.setPixelRatio(Math.min(devicePixelRatio,high?1.5:.7));this.composer.setPixelRatio(this.renderer.getPixelRatio());this.frames=[];}
  this.ao.enabled=high;this.dof.enabled=high&&!this.placing&&!this.joining&&!this.topView&&!this.exploded&&!this.down;
  (this.dof.uniforms as Record<string,THREE.IUniform>).focus.value=this.camera.position.distanceTo(this.controls.target);
  this.animateWire(elapsed,now);
  if(this.snapshot&&this.snapshot!==this.appliedSnapshot){this.appliedSnapshot=this.snapshot;let lights=0;this.lightPool.forEach(light=>light.intensity=0);for(const p of [...this.snapshot.parts].sort((a,b)=>b.brightness-a.brightness)){const object=this.objects.get(p.id);if(!object)continue;
   const drive=this.drives.get(p.id),angle=drive?(this.snapshot.parts.find(q=>q.id===drive.driver)?.angle??0)*drive.ratio+drive.phase:p.angle;
   object.traverse(o=>{if(o.userData.rotor&&o.rotation.y!==angle){o.rotation.y=angle;this.renderer.shadowMap.needsUpdate=true;}if(o instanceof THREE.Mesh&&o.userData.original){const m=o.material as THREE.MeshStandardMaterial;m.color.copy(o.userData.original);if(p.failed)m.color.lerp(new THREE.Color('#30323b'),.78);if(o.userData.traced)m.color.set('#ffd34e');if(o.userData.emitter){m.emissive.set(o.userData.lightColor);m.emissiveIntensity=p.failed?0:p.brightness*5;}}});
   const brightness=p.failed?0:p.brightness;
   if(object.userData.emitterPosition){if(brightness>0&&lights<8){const light=this.lightPool[lights++];light.intensity=brightness*(this.presentation.night?7:4);light.color.set(object.userData.emitterColor);light.position.copy(object.userData.emitterPosition);object.localToWorld(light.position);}(object.userData.glow.material as THREE.MeshBasicMaterial).opacity=Math.min(.45,brightness*.4);}
   object.userData.crack.visible=p.failed;
  }}
  if(high){this.bloom.enabled=true;this.composer.render();}else this.renderer.render(this.scene,this.camera);
  this.host.dataset.fps=String(this.fps);this.host.dataset.quality=high?'high':'low';
 };
 setPresentation(presentation:Presentation){const change=this.presentation.naming!==presentation.naming;if(this.presentation.quality!==presentation.quality&&presentation.quality==='auto'){this.cheap=true;this.autoTried=false;this.fast=0;}this.presentation={...presentation};this.appliedSnapshot=undefined;
  this.scene.background=new THREE.Color(presentation.night?'#101b37':'#f7d9a4');this.tableMaterial.color.set(presentation.night?'#152b55':'#f5dca8');this.hemi.color.set(presentation.night?'#94b6ff':'#dff2ff');this.hemi.groundColor.set(presentation.night?'#162852':'#c89876');this.sun.color.set(presentation.night?'#a9bbff':'#fff1d8');this.hemi.intensity=presentation.night?.2:1;this.sun.intensity=presentation.night?.16:3.2;this.bloom.strength=presentation.night?.65:.35;
  if(change&&this.project)this.update({...this.project,presentation});
 }
 private hit(e:PointerEvent,ignoreHandles=false):{part?:string;wire?:string;wireEnd?:'from'|'to';terminal?:string;actuator?:boolean}{
  // Picking follows the current construction and camera even when the next
  // display frame is delayed (or rendering is paused behind the code editor).
  this.camera.updateMatrixWorld();this.scene.updateMatrixWorld(true);
  const r=this.host.getBoundingClientRect();this.mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);
  if(!ignoreHandles&&!this.placing&&!this.joining&&!this.wireEdit&&this.selected&&this.routes.has(this.selected)){
   const ends=this.routes.get(this.selected)!,distance=(p:THREE.Vector3)=>{const v=p.clone().project(this.camera);return Math.hypot(r.left+(v.x+1)*r.width/2-e.clientX,r.top+(1-v.y)*r.height/2-e.clientY);};
   const a=distance(ends[0]),b=distance(ends.at(-1)!);if(Math.min(a,b)<(e.pointerType==='touch'?28:21))return {wire:this.selected,wireEnd:a<=b?'from':'to'};
  }
  for(const hit of this.ray.intersectObjects([...this.parts.children,...this.wires.children],true)){
   // Raycaster includes invisible objects. A hidden damage-cross label used to
   // intercept presses at the centre of every healthy push button.
   let visible=true;for(let ancestor:THREE.Object3D|null=hit.object;ancestor;ancestor=ancestor.parent)visible&&=ancestor.visible;if(!visible)continue;
   let o:THREE.Object3D|null=hit.object;const terminal=(o.userData.terminal??o.userData.snapTerminal) as string|undefined,actuator=!!o.userData.actuator;while(o&&!o.userData.part&&!o.userData.wire)o=o.parent;if(o)return o.userData.wire?{wire:o.userData.wire}:{part:o.userData.part as string,terminal,actuator};
  }return {};
 }
 private point(e:PointerEvent,layer=this.layer):Vec3{this.hit(e);const at=new THREE.Vector3();this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-layer*LAYER),at);return [Math.round(at.x),layer,Math.round(at.z)];}
 private overTrash(e:PointerEvent){const r=document.querySelector('.parts-panel')?.getBoundingClientRect();return !!r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;}
 private pointerDown=(e:PointerEvent)=>{
  if(e.button!==0)return;if(this.down){this.cancel();return;}
  if(this.wireEdit?.released)this.clearWireEdit();
  const hit=this.hit(e),p=this.project?.parts.find(p=>p.id===hit.part);this.down={x:e.clientX,y:e.clientY,...hit,drag:false,pointer:e.pointerId,position:p?.position,dial:Number(p?.control.position??.5)};
  if(hit.wire===this.selected&&hit.wire&&!this.placing&&!this.joining){const points=this.routes.get(hit.wire)!;this.down.wireEnd=hit.wireEnd??(this.ray.ray.distanceToPoint(points[0])<=this.ray.ray.distanceToPoint(points.at(-1)!)?'from':'to');}
  if(this.placing||p||hit.wire){this.controls.enabled=false;this.renderer.domElement.setPointerCapture(e.pointerId);}
  if(p&&!this.placing&&!this.joining)this.events.select(p.id);
  if(hit.wire&&!this.placing&&!this.joining)this.events.select(hit.wire);
  if(p&&hit.actuator&&!this.joining&&byId[p.definition].interaction==='momentary')this.events.control(p.id,'closed',true);
 };
 private pointerMove=(e:PointerEvent)=>{
  if(this.down?.wireEnd&&this.down.wire){if(Math.hypot(e.clientX-this.down.x,e.clientY-this.down.y)>7||this.down.drag){if(!this.down.drag){this.down.drag=true;this.startWire(this.down.wire,this.down.wireEnd);this.events.detach([],[this.down.wire]);}this.moveWire(e);}return;}
  if(this.placing){this.ghostPosition=this.point(e);if(this.ghost)this.ghost.position.set(this.ghostPosition[0],BASE_Y+this.layer*LAYER,this.ghostPosition[2]);this.renderer.shadowMap.needsUpdate=true;this.preview();return;}
  if(!this.down&&!this.joining){const hit=this.hit(e),p=this.project?.parts.find(p=>p.id===hit.part);this.hovered=hit.wire??(p&&conductor(p)?p.id:null);this.host.style.cursor=hit.wire===this.selected&&hit.wire?'grab':p&&byId[p.definition].interaction!=='none'?'pointer':'default';this.updateTrace();}
  const down=this.down;if(!down?.part||this.joining)return;
  const p=this.project?.parts.find(p=>p.id===down.part);if(!p)return;const interaction=byId[p.definition].interaction;
  if(down.actuator&&interaction==='dial'){this.events.control(p.id,'position',Math.max(0,Math.min(1,down.dial!+(e.clientX-down.x)/120)));return;}
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){if(!down.drag){if(interaction==='momentary')this.events.control(p.id,'closed',false);this.events.detach([...movingAssemblyIds(this.project!,p.id)]);}down.drag=true;
   const pos=this.point(e,p.position[1]);const startPoint=this.point({clientX:down.x,clientY:down.y} as PointerEvent,p.position[1]);
   this.ghostPosition=[p.position[0]+pos[0]-startPoint[0],p.position[1],p.position[2]+pos[2]-startPoint[2]];
   const moved=moveAssembly(this.project!,p.id,this.ghostPosition);for(const q of moved.parts)if(movingAssemblyIds(this.project!,p.id).has(q.id))this.objects.get(q.id)?.position.set(q.position[0],BASE_Y+q.position[1]*LAYER,q.position[2]);
   this.helpers.children.forEach(h=>{if(h.userData.selection)(h as THREE.BoxHelper).update();});
   this.renderer.shadowMap.needsUpdate=true;
   this.events.trash(this.overTrash(e));
  }
 };
 private pointerUp=(e:PointerEvent)=>{
  const down=this.down;if(!down)return;this.down=undefined;this.controls.enabled=true;this.events.trash(false);
  const part=this.project?.parts.find(p=>p.id===down.part);if(part&&byId[part.definition].interaction==='momentary')this.events.control(part.id,'closed',false);
  if(this.renderer.domElement.hasPointerCapture(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);
  if(down.wireEnd&&down.drag&&this.wireEdit){this.moveWire(e);const edit=this.wireEdit;edit.released=true;this.host.dataset.rewiring='';
   const changed=edit.candidate&&this.events.rewire(edit.id,edit.side,edit.candidate);if(!changed){this.events.detach([]);this.returnWire();}else if(this.project){const next=rewireConnection(this.project,edit.id,edit.side,edit.candidate!);this.setWireGoal(this.renderRoute(next,edit.id));}return;}
  if(this.placing){if(canPlace(place(this.placing,this.ghostPosition,this.rotation),this.project?.parts??[]))this.events.place(this.placing,this.ghostPosition,this.rotation);return;}
  if(down.drag&&down.part){if(this.project)this.update(this.project);if(this.overTrash(e))this.events.remove(down.part);else this.events.move(down.part,this.ghostPosition);return;}
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;
  if(this.joining&&down.part&&down.terminal)this.events.snap(down.part,down.terminal);
  else {this.events.select(down.wire??down.part??null);if(part&&byId[part.definition].interaction==='toggle')this.events.control(part.id,'closed',part.control.closed===false);}
 };
 private pointerLeave=()=>{if(!this.down){this.hovered=null;this.updateTrace();}};
 private cancel=()=>{const down=this.down;this.down=undefined;this.controls.enabled=true;this.events.trash(false);if(down?.wireEnd&&this.wireEdit){this.returnWire();this.events.detach([]);}if(down?.part){const p=this.project?.parts.find(p=>p.id===down.part);if(p&&byId[p.definition].interaction==='momentary')this.events.control(p.id,'closed',false);}if(down?.drag&&down.part&&this.project){this.update(this.project);this.events.detach([]);}if(down&&this.renderer.domElement.hasPointerCapture(down.pointer))this.renderer.domElement.releasePointerCapture(down.pointer);};
 cancelDrag(){this.cancel();}
 private preview(){if(!this.placing)return;const positions=Array.from({length:9},(_,i)=>i).filter(layer=>canPlace(place(this.placing!,[this.ghostPosition[0],layer,this.ghostPosition[2]],this.rotation),this.project?.parts??[]));const valid=positions.includes(this.layer);this.events.preview(valid,positions);if(this.ghost)this.ghost.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.Material).opacity=valid?.45:.23;});}
 update(project:Project){
  if(this.wireEdit&&(this.project?.id!==project.id||!project.connections.some(c=>c.id===this.wireEdit!.id)))this.clearWireEdit();
  if(this.project?.id!==project.id||this.project.revision!==project.revision)this.snapshot=undefined;
  this.project=project;this.presentation={...project.presentation};this.appliedSnapshot=undefined;this.renderer.shadowMap.needsUpdate=true;this.clear(this.parts);this.clear(this.wires);this.clear(this.helpers);this.objects.clear();
  this.drives=rotorDrives(project);this.hovered=null;this.traced=null;
  for(const p of project.parts){const object=componentMesh(byId[p.definition],project.presentation.naming);object.userData.part=p.id;object.position.set(p.position[0],BASE_Y+p.position[1]*LAYER*(this.exploded?3:1),p.position[2]);object.rotation.y=-p.rotation*Math.PI/2;this.parts.add(object);this.objects.set(p.id,object);this.setControl(p);}
  const count=Math.min(8,project.parts.filter(p=>byId[p.definition].geometry.some(s=>s.role==='emitter')).length);this.lightPool.forEach((light,i)=>{light.visible=i<count;light.intensity=0;});
  const routes=clearWireRoutes(project);this.routes.clear();this.host.dataset.obstructedWires=String([...routes.values()].filter(r=>!r.clear).length);
  for(const [id,cable] of routes){
   const c=project.connections.find(c=>c.id===id)!,ends=[c.from,c.to].map(e=>project.parts.find(p=>p.id===e.part)!);
   const via=cable.points.map((p,i)=>new THREE.Vector3(p[0],p[1]+(this.exploded?(i===0?ends[0].position[1]:i===cable.points.length-1?ends[1].position[1]:Math.max(...ends.map(p=>p.position[1])))*LAYER*2:0),p[2]));
   this.routes.set(id,via);const route=cableCurve(via);
   if(!route.curves.length)continue;
   const segments=Math.max(24,via.length*5),wire=new THREE.Mesh(new THREE.TubeGeometry(route,segments,.035,6,false),material('#36506a'));wire.userData.wire=id;wire.castShadow=true;
   const target=new THREE.Mesh(new THREE.TubeGeometry(route,segments,.12,4,false),new THREE.MeshBasicMaterial({visible:false}));wire.add(target);wire.visible=this.wireEdit?.id!==id;this.wires.add(wire);
  }
  if(this.wireEdit?.released&&this.routes.has(this.wireEdit.id))this.setWireGoal(this.routes.get(this.wireEdit.id)!);
  for(const issue of validateConstruction(project.parts))for(const id of issue.parts){const object=this.objects.get(id);if(object)this.helpers.add(new THREE.BoxHelper(object,0xf2533e));}
  this.select(this.selected);this.setPresentation(project.presentation);
 }
 setControl(part:Instance){if(this.project)this.project={...this.project,parts:this.project.parts.map(p=>p.id===part.id?part:p)};const d=byId[part.definition];this.objects.get(part.id)?.traverse(o=>{if(o.userData.actuator){o.position.copy(o.userData.origin);if(d.interaction==='momentary')o.position.y-=part.control.closed?.08:0;else if(d.interaction==='dial')o.rotation.y=Number(part.control.position??.5)*Math.PI*1.5;else o.position.x+=part.control.closed===false?-.17:.17;}});this.renderer.shadowMap.needsUpdate=true;}
 select(id:string|null){this.selected=id;const old=this.helpers.children.filter(o=>o.userData.selection);old.forEach(o=>{this.disposeObject(o);this.helpers.remove(o);});if(id&&this.objects.has(id)){const h=new THREE.BoxHelper(this.objects.get(id)!,0x227cde);h.userData.selection=true;this.helpers.add(h);}
  this.clear(this.wireHandles);const route=id?this.routes.get(id):undefined;this.host.dataset.wireHandles=route?id!:'';
  if(route)for(const [index,p] of [route[0],route.at(-1)!].entries()){const handle=new THREE.Group(),color=index?'#ffb641':'#52ccff',mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthTest:false});const ring=new THREE.Mesh(new THREE.TorusGeometry(.19,.035,8,24),mat);ring.rotation.x=-Math.PI/2;handle.add(ring);const dot=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),mat.clone());handle.add(dot);handle.position.copy(p).add(new THREE.Vector3(0,.1,0));handle.renderOrder=8;handle.traverse(o=>o.renderOrder=8);this.wireHandles.add(handle);}this.wireHandles.visible=!this.wireEdit;this.updateTrace(true);}
 private renderRoute(p:Project,id:string,override?:{id:string;side:'from'|'to';point:Vec3}){
  const c=p.connections.find(c=>c.id===id)!,ends=[c.from,c.to].map(e=>p.parts.find(q=>q.id===e.part)!);
  return clearWireRoutes({...p,connections:[c]},override).get(id)!.points.map((v,i,a)=>new THREE.Vector3(v[0],v[1]+(this.exploded?(i===0?ends[0].position[1]:i===a.length-1?ends[1].position[1]:Math.max(...ends.map(p=>p.position[1])))*LAYER*2:0),v[2]));
 }
 private setWireGoal(points:THREE.Vector3[]){if(this.wireEdit)this.wireEdit.goal=cableCurve(points).getSpacedPoints(64);}
 private startWire(id:string,side:'from'|'to'){
  this.clearWireEdit();const points=cableCurve(this.routes.get(id)!).getSpacedPoints(64),mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),96,.045,6,false),material('#ffc15c'));mesh.castShadow=true;this.scene.add(mesh);this.wireEdit={id,side,mesh,points,goal:points.map(p=>p.clone()),released:false};
  this.wires.children.filter(o=>o.userData.wire===id).forEach(o=>o.visible=false);this.wireHandles.visible=true;this.host.dataset.rewiring=id;this.host.style.cursor='grabbing';this.updateTrace(true);
 }
 private moveWire(e:PointerEvent){
  const edit=this.wireEdit,p=this.project;if(!edit||!p)return;this.hit(e,true);const rect=this.host.getBoundingClientRect(),wire=p.connections.find(c=>c.id===edit.id)!,other=wire[edit.side==='from'?'to':'from'];let best=e.pointerType==='touch'?30:23;edit.candidate=undefined;let target:Vec3|undefined;
  if(e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom)for(const part of p.parts)for(const [snap,s] of byId[part.definition].snaps.entries()){
   if(part.id===other.part&&s.terminal===other.terminal)continue;const at=physicalPoint(part,[s.position[0],.31,s.position[2]]),display=new THREE.Vector3(...at);if(this.exploded)display.y+=part.position[1]*LAYER*2;const v=display.project(this.camera),distance=Math.hypot(rect.left+(v.x+1)*rect.width/2-e.clientX,rect.top+(1-v.y)*rect.height/2-e.clientY);
   if(distance<best){best=distance;edit.candidate={part:part.id,terminal:s.terminal,snap};target=at;}
  }
  if(!target){const height=Math.max(.9,...p.parts.flatMap(q=>byId[q.definition].geometry.filter(s=>s.collision!==false).map(s=>shapeBounds(q,s).max[1]+.25))),at=new THREE.Vector3();this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-height),at);target=[Math.max(-.5,Math.min(12.5,at.x)),height,Math.max(-.5,Math.min(9.5,at.z))];}
  const next=edit.candidate?{...p,connections:p.connections.map(c=>c.id===edit.id?{...c,[edit.side]:edit.candidate!}:c)}:p;
  this.setWireGoal(this.renderRoute(next,edit.id,edit.candidate?undefined:{id:edit.id,side:edit.side,point:target}));(edit.mesh.material as THREE.MeshStandardMaterial).color.set(edit.candidate?'#50bc87':'#ffc15c');this.host.dataset.wireTarget=edit.candidate?edit.candidate.part+':'+edit.candidate.terminal:'';
 }
 private returnWire(){if(!this.wireEdit)return;this.wireEdit.released=true;this.host.dataset.rewiring='';this.host.dataset.wireTarget='';this.setWireGoal(this.routes.get(this.wireEdit.id)!);this.updateTrace(true);}
 private clearWireEdit(){if(this.wireEdit){this.scene.remove(this.wireEdit.mesh);this.disposeObject(this.wireEdit.mesh);this.wireEdit=undefined;}this.wires.children.forEach(o=>o.visible=true);this.wireHandles.visible=true;this.host.dataset.rewiring='';this.host.dataset.wireTarget='';this.host.style.cursor=this.joining?'crosshair':'default';this.renderer.shadowMap.needsUpdate=true;this.updateTrace(true);}
 private animateWire(elapsed:number,now:number){
  if(!this.reducedMotion)this.wireHandles.children.forEach(o=>o.scale.setScalar(1+.06*Math.sin(now*.005)));
  const edit=this.wireEdit;if(!edit)return;let distance=0;const alpha=this.reducedMotion?1:1-Math.exp(-Math.min(100,elapsed)/42);
  edit.points.forEach((p,i)=>{p.lerp(edit.goal[i],alpha);distance=Math.max(distance,p.distanceTo(edit.goal[i]));});edit.mesh.geometry.dispose();edit.mesh.geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edit.points),96,.045,6,false);this.renderer.shadowMap.needsUpdate=true;
  this.wireHandles.children.forEach((handle,i)=>handle.position.copy(i?edit.points.at(-1)!:edit.points[0]).add(new THREE.Vector3(0,.1,0)));
  if(edit.released&&distance<.005)this.clearWireEdit();
 }
 private updateTrace(force=false){
  if(!this.project)return;const id=this.wireEdit&&!this.wireEdit.released?null:this.hovered??this.selected;if(!force&&id===this.traced)return;this.traced=id;
  const trace=id?traceWire(this.project,id):{parts:[],wires:[],terminals:[]};const parts=new Set(trace.parts),wires=new Set(trace.wires),terminals=new Set(trace.terminals.map(t=>t.part+':'+t.terminal));
  for(const [id,object] of this.objects)object.traverse(o=>{if(o instanceof THREE.Mesh&&o.userData.original){const active=parts.has(id)||terminals.has(id+':'+o.userData.snapTerminal);o.userData.traced=active;const m=o.material as THREE.MeshStandardMaterial;m.color.copy(o.userData.original);if(active)m.color.set('#ffd34e');if(!o.userData.emitter){m.emissive.set(active?'#edaa16':'#000000');m.emissiveIntensity=active?.45:0;}}});
  for(const object of this.wires.children){const m=(object as THREE.Mesh).material as THREE.MeshStandardMaterial,active=wires.has(object.userData.wire);m.color.set(active?'#ffd34e':'#36506a');m.emissive.set(active?'#edaa16':'#000000');m.emissiveIntensity=active?.6:0;}
  this.appliedSnapshot=undefined;this.host.dataset.traceParts=trace.parts.join(',');this.host.dataset.traceWires=trace.wires.join(',');this.host.dataset.traceTerminals=trace.terminals.map(t=>t.part+':'+t.terminal).join(',');this.events.trace(trace);
 }
 observe(snapshot:Snapshot){this.snapshot=snapshot;}
 visible(value:boolean){this.shown=value;}
 placement(id:string|null,rotation:number,layer:number){const changed=id!==this.placing;this.placing=id;this.rotation=rotation;this.layer=layer;if(changed)this.ghostPosition=[4,layer,4];else this.ghostPosition[1]=layer;
  this.renderer.shadowMap.needsUpdate=true;
  if(this.ghost){this.scene.remove(this.ghost);this.disposeObject(this.ghost);this.ghost=undefined;}
  if(id){this.ghost=componentMesh(byId[id],this.presentation.naming);this.ghost.traverse(o=>{if(o instanceof THREE.Mesh){(o.material as THREE.Material).transparent=true;(o.material as THREE.Material).opacity=.45;}});this.ghost.position.set(this.ghostPosition[0],BASE_Y+layer*LAYER,this.ghostPosition[2]);this.ghost.rotation.y=-rotation*Math.PI/2;this.scene.add(this.ghost);this.preview();}
 }
 join(enabled:boolean){this.joining=enabled;this.host.style.cursor=enabled?'crosshair':'default';}
 private aim(){this.controls.update();this.camera.updateMatrixWorld();}
 top(){this.topView=true;this.camera.position.set(6,22,4.51);this.controls.target.set(6,0,4.5);this.aim();}
 home(){this.topView=false;this.camera.position.set(12,13,17);this.controls.target.set(6,.3,4.5);this.aim();}
 focus(id:string){const o=this.objects.get(id);if(o){this.topView=false;this.controls.target.copy(o.position);this.camera.position.copy(o.position).add(new THREE.Vector3(4,6,7));this.aim();}}
 explode(value:boolean){this.exploded=value;if(this.project)this.update(this.project);}
 thumbnail(){return this.renderer.domElement.toDataURL('image/webp',.45);}
 private disposeObject(object:THREE.Object3D){object.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v instanceof THREE.Texture)v.dispose();m.dispose();}}});}
 private clear(group:THREE.Group){this.disposeObject(group);group.clear();}
 destroy(){this.destroyed=true;cancelAnimationFrame(this.frame);window.removeEventListener('blur',this.cancel);this.resize.disconnect();this.controls.dispose();this.ao.dispose();this.bloom.dispose();this.dof.dispose();this.composer.dispose();this.disposeObject(this.shaderReservoir);this.disposeObject(this.scene);this.renderer.dispose();this.host.replaceChildren();}
}
