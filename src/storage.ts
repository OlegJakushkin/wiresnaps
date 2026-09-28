import type {Project} from './types';
import {parseProject} from './project';
import {byId} from './catalogue';
import {uniqueId} from './id';
export interface SavedProject {id:string;name:string;updatedAt:number;version:number;thumbnail:string;document:Project;}
const DATABASE='wiresnaps';const VERSION=1;
let connection:Promise<IDBDatabase>|undefined;
export function database():Promise<IDBDatabase>{
 if(!connection)connection=new Promise((resolve,reject)=>{
  const request=indexedDB.open(DATABASE,VERSION);
  request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('projects',{keyPath:'id'});db.createObjectStore('settings');};
  request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=undefined;};resolve(request.result);};
  request.onerror=()=>{connection=undefined;reject(request.error);};
  request.onblocked=()=>reject(Error('Close older WireSnaps tabs to finish opening your projects.'));
 });return connection;
}
function result<T>(request:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function thumbnail(project:Project){
 const shapes=project.parts.map(p=>{const d=byId[p.definition];return '<g transform="translate('+((p.position[0]+1)*19)+' '+((p.position[2]+1)*13)+') rotate('+(p.rotation*90)+')"><rect x="-5" y="-4" width="'+(d.size[0]*18)+'" height="'+(d.size[2]*12)+'" rx="5" fill="'+d.color+'"/><circle r="3" fill="#d5e1eb"/><text x="12" y="4" fill="#173345" font-size="8">'+escape(d.short)+'</text></g>';}).join('');
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="280" height="155" viewBox="0 0 280 155"><rect width="280" height="155" rx="12" fill="'+(project.presentation.night?'#14233e':'#f5deb6')+'"/>'+shapes+'</svg>');
}
export async function listProjects(){const db=await database();const all=await result(db.transaction('projects').objectStore('projects').getAll()) as SavedProject[];return all.sort((a,b)=>b.updatedAt-a.updatedAt);}
export async function getProject(id:string){const db=await database();return result(db.transaction('projects').objectStore('projects').get(id)) as Promise<SavedProject|undefined>;}
export async function setting<T>(key:string){const db=await database();return result(db.transaction('settings').objectStore('settings').get(key)) as Promise<T|undefined>;}
export async function saveProject(document:Project,expectedVersion:number):Promise<{entry:SavedProject;conflict:boolean}>{
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['projects','settings'],'readwrite'),store=tx.objectStore('projects');let entry:SavedProject,conflict=false;
  const request=store.get(document.id);request.onsuccess=()=>{
   const old=request.result as SavedProject|undefined;conflict=(old?.version??0)!==expectedVersion;
   const copy=structuredClone(document);if(conflict){copy.id=uniqueId();copy.name+=' (conflict copy)';}
   // A momentary switch must never remain held after restoring a project.
   copy.parts=copy.parts.map(p=>({...p,damage:p.damage??{failed:false,failure:'',temperature:copy.environment.temperature,stress:0},control:byId[p.definition].interaction==='momentary'?{...p.control,closed:false}:p.control}));
   entry={id:copy.id,name:copy.name,document:copy,version:conflict?1:(old?.version??0)+1,updatedAt:Date.now(),thumbnail:thumbnail(copy)};
   store.put(entry);tx.objectStore('settings').put(copy.id,'activeProject');
  };
  tx.oncomplete=()=>resolve({entry,conflict});tx.onabort=()=>reject(tx.error??Error('Your browser could not save the project. Export a copy to keep it.'));tx.onerror=()=>{};
 });
}
export async function deleteProject(id:string,expectedVersion:number){
 const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects'),req=store.get(id);let conflict=false;req.onsuccess=()=>{if(req.result?.version!==expectedVersion){conflict=true;tx.abort();}else store.delete(id);};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(Error(conflict?'This project changed in another tab. Refresh the list before deleting.':'Could not delete this project.'));});
}
export async function migrateLegacy(){
 const db=await database();
 if(await setting<boolean>('legacyMigrated'))return;
 const saved=localStorage.getItem('wiresnaps.project.v1');
 if(!saved){await new Promise<void>((resolve,reject)=>{const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(true,'legacyMigrated');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});return;}
 const project=parseProject(saved);
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['projects','settings'],'readwrite'),store=tx.objectStore('projects'),req=store.get(project.id);
  req.onsuccess=()=>{if(!req.result)store.put({id:project.id,name:project.name,updatedAt:Date.now(),version:1,document:project,thumbnail:thumbnail(project)} satisfies SavedProject);tx.objectStore('settings').put(project.id,'activeProject');tx.objectStore('settings').put(true,'legacyMigrated');};
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);
 });
 // The old key deliberately remains a recovery backup; it is never overwritten.
}
