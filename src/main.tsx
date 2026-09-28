import React,{Suspense,lazy,useEffect,useRef,useState,useMemo} from 'react';
import {createRoot} from 'react-dom/client';
import {uniqueId} from './id';
import {catalogue,byId} from './catalogue';
import {emptyProject,starter,place,History,parseProject} from './project';
import {validateConstruction,moveAssembly,reverseTerminals,removeAssembly,attach,canPlace} from './construction';
import {partLabel,terminalLabel} from './component-design';
import {connectTerminals,coveredConnectors,tidyWiring} from './snap-routing';
import {terminalPaths,rewireConnection,type WireTrace} from './wiring';
import {EngineClient} from './engine-client';
import {Workbench} from './workbench';
import {PartArt} from './PartArt';
import {NextPartSuggestions} from './NextPartSuggestions';
import {guidance} from './guidance';
import {lessons,lessonFor,prepareLesson} from './lessons';
import {saveProject,listProjects,getProject,deleteProject,migrateLegacy,setting} from './storage';
import type {SavedProject} from './storage';
import type {Endpoint,Instance,Project,Snapshot,Vec3,Presentation} from './types';
import en from './i18n/en';
import './style.css';
import './workbench-ui.css';
const BlockEditor=lazy(()=>import('./BlockEditor'));
const icons:Record<string,string>={'All parts':'✦',Power:'ϟ',Lights:'☼',Motion:'↻',Controls:'⌁',Electronics:'⌘',Building:'⠿',Computers:'▣'};
function download(p:Project){const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=p.name+'.wiresnaps.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function App(){
 const [project,setProject]=useState<Project>(starter),current=useRef(project);current.current=project;
 const [ready,setReady]=useState(false),[graphicsReady,setGraphicsReady]=useState(false),[selected,setSelected]=useState<string|null>(null),[placing,setPlacing]=useState<string|null>(null);
 const [rotation,setRotation]=useState(0),[layer,setLayer]=useState(0),[valid,setValid]=useState(true),[layers,setLayers]=useState<number[]>([]);
 const [category,setCategory]=useState('All parts'),[search,setSearch]=useState(''),[view,setView]=useState<'build'|'code'>('build');
 const [library,setLibrary]=useState<'showcases'|'code'|'npn'|'pnp'|'lab'|'mine'|null>(null),[saved,setSaved]=useState<SavedProject[]>([]);
 const [mobileGuide,setMobileGuide]=useState(false),[running,setRunning]=useState(false),[snapshot,setSnapshot]=useState<Snapshot>();
 const [error,setError]=useState(''),[toast,setToast]=useState(''),[joining,setJoining]=useState(false),[firstSnap,setFirstSnap]=useState<{part:string;terminal:string}>();
 const [flexible,setFlexible]=useState(false),[trace,setTrace]=useState<WireTrace>({parts:[],wires:[],terminals:[]});
 const [exploded,setExploded]=useState(false),[trash,setTrash]=useState(false),[saveStatus,setSaveStatus]=useState('Opening your projects…');
 const host=useRef<HTMLDivElement>(null),scene=useRef<Workbench|undefined>(undefined),engine=useRef<EngineClient|undefined>(undefined),history=useRef(new History());
 const upload=useRef<HTMLInputElement>(null),firmwareInput=useRef<HTMLInputElement>(null);
 const initialDemo=useRef(new URLSearchParams(location.search).get('demo'));
 const damage=useRef(new Map<string,NonNullable<Instance['damage']>>()),versions=useRef(new Map<string,number>());
 const dirty=useRef(0),savedDirty=useRef(-1),saving=useRef<Promise<void>|null>(null),isReady=useRef(false),snapshotClock=useRef(0);
 const libraryResume=useRef(false);
 const paths=useMemo(()=>terminalPaths(project),[project.id,project.revision]);
 const covered=useMemo(()=>coveredConnectors(project),[project.id,project.revision]);
 const latest=useRef({selected,placing,rotation,layer,joining,firstSnap,view,flexible});latest.current={selected,placing,rotation,layer,joining,firstSnap,view,flexible};
 function replace(next:Project){current.current=next;setProject(next);dirty.current++;setSaveStatus('Changes to save');}
 function withDamage(p=current.current):Project{return {...p,parts:p.parts.map(part=>damage.current.has(part.id)?{...part,damage:damage.current.get(part.id)}:part)};}
 function hydrate(p:Project,version=0){damage.current.clear();for(const part of p.parts)if(part.damage)damage.current.set(part.id,part.damage);versions.current.set(p.id,version);history.current=new History();setSnapshot(undefined);setRunning(false);setSelected(null);setTrace({parts:[],wires:[],terminals:[]});setPlacing(null);setJoining(false);setFirstSnap(undefined);replace(p);if(version)savedDirty.current=dirty.current;}
 function commit(next:Project,check=true){
  if(check){const oldKeys=new Set(validateConstruction(current.current.parts).map(i=>i.code+i.parts.slice().sort().join()));const added=validateConstruction(next.parts).find(i=>!oldKeys.has(i.code+i.parts.slice().sort().join()));if(added){setToast(added.message);return false;}}
  replace(history.current.commit(current.current,withDamage(next)));return true;
 }
 function control(id:string,key:string,value:number|boolean){
  const part=current.current.parts.find(p=>p.id===id);if(!part)return;const next={...part,control:{...part.control,[key]:value}};
  replace({...current.current,parts:current.current.parts.map(p=>p.id===id?next:p)});engine.current?.send({type:'control',controls:{parts:[{id,control:next.control}]}});scene.current?.setControl(next);
 }
 function remove(id=latest.current.selected){if(!id)return;scene.current?.cancelDrag();const p=current.current;commit(p.connections.some(c=>c.id===id&&c.kind==='wire')?{...p,connections:p.connections.filter(c=>c.id!==id)}:removeAssembly(p,id));setSelected(null);setToast('Removed. Undo brings it back.');}
 function rotate(){if(latest.current.placing){setRotation(r=>(r+1)%4);return;}const part=current.current.parts.find(p=>p.id===latest.current.selected);if(part)commit(moveAssembly(current.current,part.id,part.position,(part.rotation+1)%4));}
 function duplicate(){const p=current.current.parts.find(p=>p.id===latest.current.selected);if(p){setPlacing(p.definition);setRotation(p.rotation);setSelected(null);}}
 function choosePart(id:string){setPlacing(id);setSelected(null);setView('build');setJoining(false);setFirstSnap(undefined);}
 function undo(redo=false){scene.current?.cancelDrag();replace(withDamage(redo?history.current.redo(current.current):history.current.undo(current.current)));}
 function rewire(id:string,side:'from'|'to',target:Endpoint){const next=rewireConnection(current.current,id,side,target);if(next===current.current)return false;return commit(next);}
 function tidy(){try{scene.current?.cancelDrag();const p=withDamage(),next=tidyWiring(p);if(next===p){setToast('Move the covering connectors by hand, or replace any broken ones.');return;}if(commit(next)){setSelected(null);setJoining(false);setFirstSnap(undefined);setPlacing(null);setTrace({parts:[],wires:[],terminals:[]});setToast('Wires tidied. Your parts and connections are kept. Undo restores the old layout.');}}catch(e){setToast(String(e));}}
 async function persist(){
  while(saving.current)await saving.current;if(!isReady.current||dirty.current===savedDirty.current)return;
  const checkpoint=dirty.current,document=structuredClone(withDamage());setSaveStatus('Saving…');
  const operation=(async()=>{try{const {entry,conflict}=await saveProject(document,versions.current.get(document.id)??0);versions.current.set(entry.id,entry.version);
   if(current.current.id===document.id){savedDirty.current=checkpoint;if(conflict){const latestDoc=withDamage();hydrate({...latestDoc,id:entry.id,name:entry.name},entry.version);setToast('Another tab changed this project. Your work is safe in a conflict copy.');}setSaveStatus(dirty.current===checkpoint?'Saved on this device':'Changes to save');}
  }catch(e){setSaveStatus('Not saved — export a copy');setError(String(e));throw e;}})();saving.current=operation;try{await operation;}finally{if(saving.current===operation)saving.current=null;}
 }
 async function pauseAndSave(){setRunning(false);if(engine.current?.ready&&engine.current.currentProjectId)await engine.current.pause();await persist();}
 async function switchProject(p:Project,version=0){try{await pauseAndSave();hydrate(p,version);libraryResume.current=false;setLibrary(null);setView('build');}catch{setToast('The current project could not be saved. Export it before switching.');}}
 async function openLibrary(tab:'showcases'|'code'|'lab'|'mine'){try{libraryResume.current=running;await pauseAndSave();setSaved(await listProjects());setLibrary(tab);}catch{}}
 function closeLibrary(){setLibrary(null);if(libraryResume.current)engine.current?.send({type:'run'});libraryResume.current=false;}
 async function template(id:string){try{const p=await prepareLesson(id);await switchProject(p);}catch(e){setError(String(e));}}
 async function saveCopy(){try{await pauseAndSave();const p=structuredClone(withDamage());p.id=uniqueId();p.name+=' copy';hydrate(p);await persist();setToast('A separate copy is saved in My Projects.');}catch{}}
 async function editSaved(entry:SavedProject,action:'open'|'rename'|'copy'|'delete'){
  try{
   if(action==='open'){const fresh=await getProject(entry.id);if(fresh)await switchProject(parseProject(JSON.stringify(fresh.document)),fresh.version);}
   if(action==='rename'){const name=window.prompt('Project name',entry.name);if(name===null)return;const doc={...entry.document,name:name.slice(0,100)};const result=await saveProject(doc,entry.version);if(entry.id===current.current.id)hydrate(result.entry.document,result.entry.version);}
   if(action==='copy'){const p=structuredClone(entry.document);p.id=uniqueId();p.name+=' copy';await saveProject(p,0);}
   if(action==='delete'){await deleteProject(entry.id,entry.version);if(current.current.id===entry.id)hydrate(emptyProject());}
   setSaved(await listProjects());
  }catch(e){setError(String(e));}
 }
 function presentation(change:Partial<Presentation>){const next={...current.current,presentation:{...current.current.presentation,...change}};replace(next);scene.current?.setPresentation(next.presentation);if(change.night!==undefined)engine.current?.send({type:'control',controls:{night:change.night}});}
 useEffect(()=>{void (async()=>{
  try{await migrateLegacy();const id=await setting<string>('activeProject');const entry=id?await getProject(id):undefined;if(entry)hydrate(parseProject(JSON.stringify(entry.document)),entry.version);setSaveStatus(entry?'Saved on this device':'Ready to save');}
  catch(e){setError('Browser storage is unavailable. You can still build and export projects. '+String(e));setSaveStatus('Not saved — export a copy');}
  try{const id=initialDemo.current;if(id){if(!lessons.some(l=>l.id===id))throw Error('This demo is not available. Choose one from Projects.');hydrate(await prepareLesson(id));setSaveStatus('New demo copy');}}
  catch(e){setError('Could not open the demo. '+String(e));}
  finally{const url=new URL(location.href);url.searchParams.delete('demo');window.history.replaceState(null,'',url);isReady.current=true;setReady(true);}
 })();},[]);
 useEffect(()=>{
  const client=new EngineClient();engine.current=client;client.onError=message=>{setError(message);setRunning(false);};
  client.onSnapshot=s=>{if(client.currentProjectId!==current.current.id||s.revision!==current.current.revision)return;let changed=false;for(const p of s.parts){const old=damage.current.get(p.id);if(!old||old.failed!==p.failed||old.failure!==p.failure||old.temperature!==p.temperature||old.stress!==p.stress)changed=true;damage.current.set(p.id,{failed:p.failed,failure:p.failure,temperature:p.temperature,stress:p.stress});}scene.current?.observe(s);if(changed)dirty.current++;
   const now=performance.now();if(now-snapshotClock.current>80||s.paused||s.events.length){setSnapshot(s);snapshotClock.current=now;}
   setRunning(!s.paused&&!s.diagnostics.length);
   const lesson=lessonFor(current.current);if(lesson&&current.current.lesson&&!current.current.lesson.completed&&lesson.check(s,current.current))replace({...current.current,lesson:{...current.current.lesson,completed:true}});
  };
  let board:Workbench;try{board=new Workbench(host.current!,{
   select:id=>{setSelected(id);setPlacing(null);},
   place:(definition,position,rotation)=>{const p=place(definition,position,rotation);if(commit({...current.current,parts:[...current.current.parts,p]})){setSelected(p.id);setPlacing(null);}},
   move:(id,position)=>{if(!commit(moveAssembly(current.current,id,position)))client.send({type:'detach',parts:[]});},
   detach:(parts,wires)=>client.send({type:'detach',parts,wires}),rewire,
   preview:(v,l)=>{setValid(v);setLayers(l);},control,remove,trash:setTrash,trace:setTrace,
   snap:(part,terminal)=>{const a=latest.current.firstSnap;if(!a){setFirstSnap({part,terminal});return;}if(a.part!==part||a.terminal!==terminal){const p=current.current,next=connectTerminals(p,a,{part,terminal},latest.current.flexible);if(commit(next))setToast(next.parts.length>p.parts.length?'A clear snap path is ready.':'A flexible cable follows a clear path around the parts.');setFirstSnap(undefined);setJoining(false);}}
  });scene.current=board;void board.ready.then(()=>setGraphicsReady(true)).catch(e=>setError('The 3D lights could not start. '+String(e)));}catch(e){setError('The 3D board could not start. '+String(e));return()=>client.destroy();}
  const key=(e:KeyboardEvent)=>{if((e.target as HTMLElement).matches('input,textarea,select,[contenteditable=true]')||latest.current.view==='code')return;
   if(e.key==='Escape'){board.cancelDrag();setPlacing(null);setJoining(false);setFirstSnap(undefined);}
   if(e.key.toLowerCase()==='r')rotate();if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
   if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo(e.shiftKey);}
   if((e.ctrlKey||e.metaKey)&&e.key==='d'){e.preventDefault();duplicate();}
   const p=current.current.parts.find(p=>p.id===latest.current.selected);if(p&&e.code==='Space'&&!e.repeat){e.preventDefault();const type=byId[p.definition].interaction;if(type==='momentary')control(p.id,'closed',true);if(type==='toggle')control(p.id,'closed',p.control.closed===false);}
  };
  const release=(e?:KeyboardEvent)=>{if(!e||e.code==='Space')for(const p of current.current.parts)if(byId[p.definition].interaction==='momentary'&&p.control.closed)control(p.id,'closed',false);};
  const navigate=()=>setView(location.hash==='#code'?'code':'build');navigate();
  const blur=()=>release();
  window.addEventListener('hashchange',navigate);window.addEventListener('keydown',key);window.addEventListener('keyup',release);window.addEventListener('blur',blur);
  return()=>{board.destroy();client.destroy();window.removeEventListener('hashchange',navigate);window.removeEventListener('keydown',key);window.removeEventListener('keyup',release);window.removeEventListener('blur',blur);};
 },[]);
 useEffect(()=>{if(ready&&graphicsReady){const p=withDamage();scene.current?.update(p);engine.current?.load(p,!lessonFor(p)?.danger);}},[ready,graphicsReady,project.id,project.revision]);
 useEffect(()=>{scene.current?.select(selected);},[selected,project.id,project.revision]);
 useEffect(()=>{scene.current?.placement(placing,rotation,layer);},[placing,rotation,layer]);
 useEffect(()=>{scene.current?.join(joining);},[joining]);
 useEffect(()=>{window.history.replaceState(null,'','#'+view);scene.current?.visible(view==='build');},[view]);
 useEffect(()=>{const save=()=>void persist().catch(()=>{}),hide=()=>{if(document.visibilityState==='hidden')save();};const timer=setInterval(save,1000);document.addEventListener('visibilitychange',hide);window.addEventListener('pagehide',save);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',save);};},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t);},[toast]);
 const selectedPart=project.parts.find(p=>p.id===selected),definition=selectedPart&&byId[selectedPart.definition],observed=snapshot?.parts.find(p=>p.id===selected);
 const selectedWire=project.connections.find(c=>c.id===selected&&c.kind==='wire');
 const traceTerminals=trace.terminals.filter(t=>project.parts.some(p=>p.id===t.part));
 const issues=validateConstruction(project.parts),hint=guidance(project,snapshot),lesson=lessonFor(project);
 const visible=catalogue.filter(d=>(category==='All parts'||d.category===category)&&(d.name+' '+partLabel(d,project.presentation.naming)+' '+d.short).toLowerCase().includes(search.toLowerCase()));
 const programmer=selectedPart&&definition?.programming?selectedPart:project.parts.find(p=>byId[p.definition].programming);
 function run(){if(!ready||!graphicsReady)return;if(running){void engine.current?.pause();setRunning(false);}else if(issues.length)setToast(issues[0].message);else{engine.current?.send({type:'run'});setRunning(true);}}
 async function importProject(file?:File){if(!file)return;try{const p=parseProject(await file.text());p.id=uniqueId();await switchProject(p);}catch(e){setError(String(e));}}
 const naming=project.presentation.naming;
 return <div className={'app '+(project.presentation.night?'night':'')}>
  <header className="header"><a className="brand" href="#build"><span className="brand-mark">w<span>•</span></span><div>WireSnaps<small>BIG IDEAS. LITTLE CONNECTIONS.</small></div></a>
   <nav className="main-nav"><button className={view==='build'?'active':''} onClick={()=>setView('build')}>◈ Build</button><button className={view==='code'?'active':''} onClick={()=>setView('code')}>▧ Code</button><button onClick={()=>void openLibrary('showcases')}>▱ Projects <span className="tiny-badge">{lessons.length}</span></button></nav>
   <div className="header-right"><span className="saved-dot" role="status">{saveStatus}</span><button className="soft-button" onClick={()=>void openLibrary('mine')}>My Projects</button><button className="primary" onClick={()=>void persist().catch(()=>{})}>Save</button></div>
  </header>
  <div className="project-bar"><div><input aria-label="Project name" value={project.name} onChange={e=>replace({...project,name:e.target.value.slice(0,100)})}/><button title="Save a copy" onClick={()=>void saveCopy()}>⧉</button><button title="Import project" onClick={()=>upload.current?.click()}>↥</button><button title="Export project" onClick={()=>download(withDamage())}>↧</button></div><div className="mode-control">{(['guided','experiment'] as const).map(mode=><button key={mode} className={project.mode===mode?'chosen '+mode:''} onClick={()=>{replace({...current.current,mode});engine.current?.send({type:'control',controls:{mode}});}}>{mode==='guided'?'♧ Guided':'⚗ Experiment'}</button>)}</div></div>
  {lesson?.danger&&<div className="lab-warning" role="note">⚠ Simulation only — do not try this with real components. These experiments permanently break virtual parts.</div>}
  <main className="work-area">
   <aside className={'parts-panel '+(trash?'trash-active':'')}><div className="trash-overlay">⌫<strong>Drop to delete</strong><small>Undo can bring it back</small></div><div className="panel-heading"><h2>Your parts</h2><span className="count">{catalogue.length}</span></div><div className="search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a part…" aria-label="Find a part"/></div>
    <div className="categories">{Object.entries(icons).map(([c,icon])=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{icon} {c}</button>)}</div>
    <div className="part-library">{visible.map(d=><button key={d.id} className={'part-card '+(placing===d.id?'chosen':'')} onClick={()=>choosePart(d.id)} title={d.guidance.does}><PartArt d={d} naming={naming}/><span>{d.name}</span><small>{partLabel(d,naming)}</small></button>)}</div>
    {(placing||definition)&&<NextPartSuggestions key={placing??definition!.id} project={project} focus={placing?byId[placing]:definition!} onChoose={choosePart}/>}
    <div className="library-footer">Drag a part here to remove it</div>
   </aside>
   <section className="center-panel">
    <div className="bench-toolbar"><div className="run-group"><button className={'run-button '+(running?'running':'')} onClick={run} disabled={!ready||!graphicsReady||issues.length>0} data-testid="run">{running?'Ⅱ Pause':'▶ Run'}</button><button className="icon-button" title="Step" disabled={!graphicsReady||issues.length>0} onClick={()=>{engine.current?.send({type:'step'});setRunning(false);}}>▸│</button><button className="icon-button" title="Undo" onClick={()=>undo()}>↶</button><button className="icon-button" title="Redo" onClick={()=>undo(true)}>↷</button></div><div className="view-tools">
     <button className={joining?'selected':''} title="Join snaps" aria-label="Auto wire between two snaps" onClick={()=>{setJoining(!joining);setPlacing(null);setFirstSnap(undefined);}}>⌁ <span>Auto wire</span></button><button title="Top view" onClick={()=>scene.current?.top()}>▦</button><button title="Exploded layers" className={exploded?'selected':''} onClick={()=>{setExploded(!exploded);scene.current?.explode(!exploded);}}>▱</button><button title="Home view" onClick={()=>scene.current?.home()}>⌂</button><button className={'night-toggle '+(project.presentation.night?'selected':'')} aria-pressed={project.presentation.night} onClick={()=>presentation({night:!project.presentation.night})}>☾ <span>Dark Night</span></button>
    </div></div>
    {!!covered.length&&<div className="wiring-notice" role="status"><span>Some connectors cover the parts.</span><button onClick={tidy}>Tidy wires</button><small>You can undo this.</small></div>}
    <div className="stage"><div className="board-canvas" ref={host}/>{!graphicsReady&&<div className="shader-loading" role="status"><strong>Getting the lights ready…</strong><span>Preparing the board, shadows and glow.</span></div>}<div className="stage-heading"><span className="eyebrow">{lesson?.danger?'THE VIRTUAL BREAKAGE LAB':'A LITTLE EXPERIMENT. A BIG DISCOVERY.'}</span><h1>{project.name}</h1></div><div className="board-badge"><span className={'status-light '+(running?'on':'')}/>{running?'Your circuit is running':'Ready when you are'}<small>{snapshot?.time.toFixed(2)??'0.00'} s simulated</small></div>
     {!!issues.length&&<div className="construction-warning" role="alert">{issues[0].message} <small>Your project is preserved. Fix the red outlines before running.</small></div>}
     {placing&&<div className={'placement-bar '+(!valid?'invalid':'')}><span>{valid?'Click to place':'Body or spinning space is blocked'}</span><button onClick={rotate}>↻</button><label>Layer <input aria-label="Construction layer" type="number" min="1" max="9" value={layer+1} onChange={e=>setLayer(Math.max(0,Math.min(8,Number(e.target.value)-1)))}/></label><small>Clear: {layers.map(l=>l+1).join(', ')||'none'}</small><button onClick={()=>setPlacing(null)}>×</button></div>}
     {joining&&<div className="placement-bar">{firstSnap?'Choose the second metal snap.':'Choose two metal snaps. We will find a clear path.'}<label><input type="checkbox" checked={flexible} onChange={e=>setFlexible(e.target.checked)}/> Cable only</label><button onClick={()=>setJoining(false)}>Cancel</button></div>}
     {traceTerminals.length>0&&!joining&&!placing&&<div className="wire-trace" role="status"><b>Connected path</b><span>{traceTerminals.map(t=>{const p=project.parts.find(p=>p.id===t.part)!;const d=byId[p.definition];return partLabel(d,naming)+' '+terminalLabel(d,t.terminal,naming);}).join(' ↔ ')}</span></div>}
     {selectedWire&&<div className="selection-toolbar wire-toolbar"><span>Flexible wire<small>Drag a round end to another snap</small></span><button title="Delete wire" onClick={()=>remove()}>⌫</button></div>}
     {selectedPart&&definition&&<div className="selection-toolbar"><span>{partLabel(definition,naming)}</span><button title="Rotate" onClick={rotate}>↻</button><button title="Duplicate part" onClick={duplicate}>⧉</button><button title="Zoom to this part" onClick={()=>scene.current?.focus(selectedPart.id)}>⊙</button><button title="Delete part" onClick={()=>remove()}>⌫</button></div>}
     {view==='code'&&<div className="code-overlay">{programmer?<Suspense fallback={<p>Getting your blocks ready…</p>}><BlockEditor key={project.id+programmer.id} target={byId[programmer.definition].programming!} workspace={project.workspaces[programmer.id]} trace={snapshot?.trace?.[programmer.id]} onSave={workspace=>replace({...current.current,workspaces:{...current.current.workspaces,[programmer.id]:workspace}})} onProgram={hex=>{replace({...current.current,firmware:{...current.current.firmware,[programmer.id]:hex}});engine.current?.send({type:'firmware',id:programmer.id,hex});}}/></Suspense>:<div className="empty-code"><h2>A tiny computer for your ideas</h2><p>Choose a ready-made circuit with editable blocks.</p><button className="primary" onClick={()=>void openLibrary('code')}>Explore code projects</button></div>}</div>}
    </div>
    <div className="bench-footer"><span>R rotate · Delete remove · Space operate · Ctrl Z undo</span><span>{snapshot?.speed?.toFixed(2)??'0.00'}× simulation speed</span></div>
    <div className="project-strip"><div className="spark-icon">✦</div><div><b>{lesson?'Your next small discovery':'What will you make next?'}</b><small>{lesson?.description??lessons.length+' adventures, one connection at a time.'}</small></div><button onClick={()=>void openLibrary('showcases')}>Explore projects →</button></div>
   </section>
   <aside className={'guide-panel '+(mobileGuide?'mobile-open':'')}><div className="panel-heading"><h2>Your guide</h2><span className="guide-avatar">✺</span></div>
    {lesson&&project.lesson&&<section className={'lesson-card '+(lesson.danger?'danger':'')}><small>{lesson.danger?'VIRTUAL EXPERIMENT':lesson.group.toUpperCase()+' · 1–3 MINUTES'}</small><h3>{lesson.name}</h3><p>{lesson.steps[project.lesson.step]}</p><div className="lesson-nav"><button disabled={!project.lesson.step} onClick={()=>replace({...project,lesson:{...project.lesson!,step:project.lesson!.step-1}})}>←</button><span>Step {project.lesson.step+1} of {lesson.steps.length}</span><button disabled={project.lesson.step>=lesson.steps.length-1} onClick={()=>replace({...project,lesson:{...project.lesson!,step:project.lesson!.step+1}})}>→</button></div>{project.lesson.completed&&<b className="lesson-success">✓ You made it happen!</b>}<details><summary>What to notice</summary><p>{lesson.expected}</p><p>{lesson.variation}</p></details></section>}
    {lesson?.hardware&&<details className="hardware-notes"><summary>Build with real parts</summary><p>{lesson.hardware.note}</p>{lesson.hardware.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}</details>}
    <div className={'hint-card '+hint.kind}><h3>{hint.title}</h3><p>{hint.body}</p></div>
    {selectedWire&&<section className="wire-editor"><h3>Move a wire end</h3><p>Drag the blue or gold circle to a metal snap. The wire turns green when it can connect. Drop elsewhere or press Escape to put it back.</p>{(['from','to'] as const).map((side,i)=>{
     const end=selectedWire[side],part=project.parts.find(p=>p.id===end.part)!,snap=end.snap??byId[part.definition].snaps.findIndex(s=>s.terminal===end.terminal),other=selectedWire[side==='from'?'to':'from'];
     return <label className="range-label" key={side}>{i?'Gold end':'Blue end'}<select aria-label={i?'Wire gold end':'Wire blue end'} value={JSON.stringify({part:end.part,terminal:end.terminal,snap})} onChange={e=>rewire(selectedWire.id,side,JSON.parse(e.target.value))}>{project.parts.flatMap((p,index)=>byId[p.definition].snaps.map((s,snap)=><option key={p.id+':'+snap} disabled={other.part===p.id&&other.terminal===s.terminal} value={JSON.stringify({part:p.id,terminal:s.terminal,snap})}>#{index+1} {byId[p.definition].name} · {terminalLabel(byId[p.definition],s.terminal,naming)} · snap {snap+1}</option>))}</select></label>;
    })}</section>}
    {definition&&selectedPart?<section className="part-inspector"><div className="inspector-title"><span style={{background:definition.color}}>{partLabel(definition,naming)}</span><h3>{definition.name}<small>Selected part</small></h3></div>
     <div className="marking-detail">{definition.markings.map((m,i)=><span key={i}>{m.text}</span>)}</div><div className="terminal-labels">{definition.terminals.map(t=><span key={t.id}>{terminalLabel(definition,t.id,naming)}</span>)}</div><h4>What I do</h4><p>{definition.guidance.does}</p><h4>What I need</h4><p>{definition.guidance.needs}</p><div className="try-card"><b>Try this</b><p>{definition.guidance.try}</p></div>
     {definition.interaction==='toggle'&&<button className="wide soft-button" onClick={()=>control(selectedPart.id,'closed',selectedPart.control.closed===false)}>{selectedPart.control.closed===false?'○ Close the switch':'● Open the switch'}</button>}
     {definition.interaction==='momentary'&&<button className="wide primary" aria-pressed={!!selectedPart.control.closed} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);control(selectedPart.id,'closed',true);}} onPointerUp={()=>control(selectedPart.id,'closed',false)} onPointerCancel={()=>control(selectedPart.id,'closed',false)} onLostPointerCapture={()=>control(selectedPart.id,'closed',false)} onKeyDown={e=>{if(e.code==='Space'||e.code==='Enter')control(selectedPart.id,'closed',true);}} onKeyUp={()=>control(selectedPart.id,'closed',false)}>Hold the button</button>}
     {definition.interaction==='sensor'&&<label className="toggle-row"><input type="checkbox" checked={!!selectedPart.control.closed} onChange={e=>control(selectedPart.id,'closed',e.target.checked)}/>Simulate sensor contact</label>}
     {definition.shape==='gear'&&<label className="toggle-row"><input type="checkbox" checked={!!selectedPart.control.blocked} onChange={e=>control(selectedPart.id,'blocked',e.target.checked)}/>Hold the gear still</label>}
     {definition.model==='motor'&&<><label className="toggle-row"><input type="checkbox" checked={!!selectedPart.control.blocked} onChange={e=>control(selectedPart.id,'blocked',e.target.checked)}/>Hold the axle still</label><label className="range-label">Turn from outside<input aria-label="External motor torque" type="range" min="-.004" max=".004" step=".0002" value={Number(selectedPart.control.driveTorque??0)} onChange={e=>control(selectedPart.id,'driveTorque',Number(e.target.value))}/></label></>}
     {definition.interaction==='dial'&&<label className="range-label">Move the dial<input aria-label="Adjustable resistor position" type="range" min="0" max="1" step=".01" value={Number(selectedPart.control.position??.5)} onChange={e=>control(selectedPart.id,'position',Number(e.target.value))}/></label>}
     {definition.model==='accessory'&&definition.attachments.some(a=>a.kind==='axle')&&<label className="range-label">Attach to an axle<select aria-label="Attach to a motor" defaultValue="" onChange={e=>commit(attach(current.current,selectedPart.id,e.target.value))}><option value="" disabled>Choose an axle…</option>{project.parts.filter(p=>p.id!==selectedPart.id&&byId[p.definition].attachments.some(a=>a.id==='shaft')).map((p,i)=><option key={p.id} value={p.id}>{byId[p.definition].name} {i+1}</option>)}</select></label>}
     {observed&&<div className="readings"><div><small>Electrical push</small><b>{observed.voltage.toFixed(2)} <em>V</em></b></div><div><small>Current flowing</small><b>{(observed.current*1000).toFixed(1)} <em>mA</em></b></div><div><small>Inside temperature</small><b>{observed.temperature.toFixed(0)} <em>°C</em></b></div><div><small>Condition</small><b className={observed.failed?'hot':''}>{observed.failed?'Broken':observed.tripped?'Protected':'Healthy'}</b></div></div>}
     {(observed?.failed||selectedPart.damage?.failed)&&<button className="wide primary" onClick={()=>{damage.current.delete(selectedPart.id);replace({...current.current,parts:current.current.parts.map(p=>p.id===selectedPart.id?{...p,damage:undefined}:p)});engine.current?.send({type:'repair',id:selectedPart.id});}}>↻ Replace part</button>}
     <button className="wide soft-button" onClick={()=>{engine.current?.send({type:'reset'});}}>↻ Restart power</button>
     {['motor','diode','led'].includes(definition.model)&&<button className="wide soft-button" onClick={()=>commit(reverseTerminals(current.current,selectedPart.id))}>⇄ Swap the two ends</button>}
     {definition.programming&&<><button className="wide soft-button" onClick={()=>setView('code')}>▧ Open my blocks</button><div className="virtual-serial"><h4>Messages from my program</h4><pre>{observed?.serial||'Your messages appear here.'}</pre></div><details><summary>Advanced firmware</summary><button onClick={()=>firmwareInput.current?.click()}>Choose HEX file</button></details></>}
     <details><summary>Connected flexible wires</summary>{project.connections.filter(c=>c.kind==='wire'&&(c.from.part===selectedPart.id||c.to.part===selectedPart.id)).map((c,i)=><button key={c.id} className="wire-remove" onClick={()=>commit({...project,connections:project.connections.filter(x=>x.id!==c.id)})}>Remove wire {i+1} ({c.from.terminal} → {c.to.terminal})</button>)}</details>
    </section>:<div className="pick-hint"><b>Every part has a story.</b><p>Tap a part to explore. Tap its switch or hold its button to operate it.</p></div>}
    <details className="environment"><summary>☼ Surroundings</summary>{project.presentation.night&&<p className="night-explanation">Dark Night hides the sun. Solar cells and light sensors feel the darkness too. Daylight brings back your sunshine setting.</p>}{(['light','sound','wind','temperature'] as const).map(key=><label key={key}>{en[key]}<input aria-label={en[key]} type="range" min={key==='temperature'?-20:0} max={key==='light'?2:key==='sound'?1:key==='wind'?20:60} step={key==='light'||key==='sound'?.05:1} disabled={key==='light'&&project.presentation.night} value={key==='light'&&project.presentation.night?0:project.environment[key]} onChange={e=>{const environment={...current.current.environment,[key]:Number(e.target.value)};replace({...current.current,environment});engine.current?.send({type:'control',controls:{environment}});}}/></label>)}</details>
    <section className="view-settings"><label>Real-life labels<select aria-label="Real-life labels" value={naming} onChange={e=>presentation({naming:e.target.value as Presentation['naming']})}><option value="none">None · WireSnaps</option><option value="snap">Snap Circuits</option><option value="znatok">Znatok</option></select></label><label>Graphics<select aria-label="Graphics quality" value={project.presentation.quality} onChange={e=>presentation({quality:e.target.value as Presentation['quality']})}><option value="auto">Auto</option><option value="high">High</option><option value="low">Low</option></select></label></section>
    {naming!=='none'&&<p className="model-note" data-testid="brand-notice">Brand names identify reference parts only. WireSnaps is independent and is not endorsed by their makers. {naming==='znatok'?'Znatok numbering is provisional; check your own manual.':'These are functional comparisons, not certified kit layouts.'}</p>}
    <details className="build-guide"><summary>Parts & building guide</summary><p>{lesson?.danger?'Simulation only. Do not build this experiment with real parts.':'Match terminal labels and check your kit manual. Shape and thermal estimates are not a hardware safety certificate.'}</p><details><summary>Terminal-to-terminal paths</summary><ol>{paths.map((path,i)=><li key={i}>{path.terminals.map(t=>{const index=project.parts.findIndex(p=>p.id===t.part),p=project.parts[index],d=byId[p.definition];return '#'+(index+1)+' '+partLabel(d,naming)+' '+terminalLabel(d,t.terminal,naming);}).join(' ↔ ')}</li>)}</ol></details><ol>{project.parts.slice().sort((a,b)=>a.position[1]-b.position[1]).map(p=>{const d=byId[p.definition],match=naming==='none'?undefined:d.brands[naming];return <li key={p.id}><b>#{project.parts.findIndex(q=>q.id===p.id)+1} {partLabel(d,naming)} · {d.name}</b><small>Layer {Number((p.position[1]+1).toFixed(2))} · column {p.position[0]+1}, row {String.fromCharCode(65+Math.round(p.position[2]))} · {p.rotation*90}°</small>{naming!=='none'&&<small>{match?match.status==='verified'?'Verified construction match':'Functional equivalent — check pin layout':'No verified match for this brand'}</small>}<small>{d.terminals.map(t=>t.id+': '+terminalLabel(d,t.id,naming)).join(' · ')}</small>{match&&<><small>{match.note}</small><a href={match.source} target="_blank" rel="noreferrer">Part reference ↗</a></>}</li>;})}</ol></details>
    <p className="model-note">{en.modelNote}</p>
   </aside>
  </main>
  <button className="mobile-guide-toggle" onClick={()=>setMobileGuide(!mobileGuide)}>{mobileGuide?'× Close help':'✧ Help & part controls'}</button><footer className="global-footer"><span>Independent virtual circuit playground.</span><a href="./demo/" target="_blank" rel="noopener">Feature tour</a><a href="./demo/rights.html" target="_blank" rel="noopener">Names & rights</a><a href="./source/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener">Licences & source</a></footer>
  {error&&<div className="error-banner" role="alert">{error}<button onClick={()=>setError('')}>×</button></div>}{toast&&<div className="toast" role="status">{toast}</div>}
  <input ref={upload} type="file" accept=".json" hidden onChange={e=>void importProject(e.target.files?.[0])}/><input ref={firmwareInput} type="file" accept=".hex" hidden onChange={async e=>{const file=e.target.files?.[0];if(file&&selectedPart){const hex=await file.text();replace({...current.current,firmware:{...current.current.firmware,[selectedPart.id]:hex}});engine.current?.send({type:'firmware',id:selectedPart.id,hex});}}}/>
  {library&&<div className="modal-backdrop" onClick={closeLibrary}><section className="projects-modal" role="dialog" aria-modal="true" aria-label="Project library" onClick={e=>e.stopPropagation()}><button className="close-modal" aria-label="Close project library" onClick={closeLibrary}>×</button><span className="eyebrow">BUILD. WONDER. TRY SOMETHING.</span><h2>{library==='mine'?'My Projects':library==='lab'?'Virtual Breakage Lab':library==='npn'?'One NPN, three useful jobs':library==='pnp'?'One PNP, three useful jobs':'Choose a little adventure'}</h2><div className="project-tabs">{(['showcases','npn','pnp','code','lab','mine'] as const).map(tab=><button key={tab} className={library===tab?'selected':''} onClick={()=>setLibrary(tab)}>{({showcases:'Showcases · '+lessons.filter(l=>!l.danger).length,npn:'NPN only · 3',pnp:'PNP only · 3',code:'Code projects · '+lessons.filter(l=>l.code).length,lab:'Breakage Lab · '+lessons.filter(l=>l.danger).length,mine:'My Projects'})[tab]}</button>)}</div>
   {library==='mine'?<><button className="primary" onClick={()=>void switchProject(emptyProject())}>＋ New project</button><div className="saved-projects">{saved.map(entry=><article key={entry.id}><button onClick={()=>void editSaved(entry,'open')}><img src={entry.thumbnail} alt=""/><b>{entry.name}</b><small>{entry.document.parts.length} parts · {new Date(entry.updatedAt).toLocaleDateString()}</small></button><div>{(['rename','copy','delete'] as const).map(action=><button key={action} onClick={()=>void editSaved(entry,action)}>{action}</button>)}</div></article>)}</div>{!saved.length&&<p>Your saved inventions will appear here.</p>}</>:<>{library==='lab'&&<p className="lab-warning">Simulation only — do not try these experiments with real components.</p>}<div className="project-cards">{lessons.filter(l=>library==='lab'?l.danger:library==='code'?l.code:library==='npn'||library==='pnp'?l.transistorType===library:!l.danger).map(l=><button key={l.id} data-testid={'lesson-'+l.id} onClick={()=>void template(l.id)}><div style={{background:({Power:'#f9dda2',Lights:'#f9c6de',Motion:'#d5b9f8',Controls:'#bcebd0',Electronics:'#b5dfe9',Building:'#badbfa',Computers:'#b8d6e7'})[l.group]}}><PartArt d={byId[l.transistorType?(l.transistorType==='pnp'?'6SCQ1':'6SCQ2'):({Power:'6SCB1',Lights:'6SCL1',Motion:'6SCM1',Controls:'6SCS2',Electronics:'6SCQ2',Building:'6SC04',Computers:'snapino'})[l.group]]}/></div><small>{l.danger?'VIRTUAL EXPERIMENT':(l.transistorType?l.transistorType.toUpperCase()+' ONLY':l.group)+' · 1–3 MIN'}</small><h3>{l.name}</h3><p>{l.description}</p><span>{l.code?'Circuit + editable blocks →':'Let’s try it →'}</span></button>)}</div></>}
  </section></div>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
