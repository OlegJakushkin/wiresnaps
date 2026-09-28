import type { Project,Snapshot,WorkerCommand,WorkerReply,EngineCommand } from './types';
export function belongsToSession(reply:{projectId:string;generation:number},projectId:string,generation:number){return reply.projectId===projectId&&reply.generation===generation;}
export class EngineClient {
 private worker=new Worker(new URL('./simulation.worker.ts',import.meta.url),{type:'module'});
 ready=false;pending:WorkerCommand[]=[];
 private projectId='';private generation=0;
 get currentProjectId(){return this.projectId;}
 private requestId=0;private replies=new Map<number,(snapshot:Snapshot)=>void>();
 onSnapshot:(snapshot:Snapshot)=>void=()=>{};
 onError:(message:string)=>void=()=>{};
 constructor(){this.worker.onmessage=({data}:{data:WorkerReply})=>{if(data.type==='ready'){this.ready=true;this.pending.splice(0).forEach(c=>this.worker.postMessage(c));}else if(belongsToSession(data,this.projectId,this.generation)){if(data.type==='snapshot'){this.onSnapshot(data.snapshot);if(data.requestId){this.replies.get(data.requestId)?.(data.snapshot);this.replies.delete(data.requestId);}}else this.onError(data.message);}else if(data.type==='error'&&!data.projectId)this.onError(data.message);};this.worker.onerror=e=>this.onError(e.message);}
 send(command:EngineCommand){if(command.type==='load'){this.projectId=command.project.id;this.generation++;this.pending=[];}const message={...command,version:2 as const,projectId:this.projectId,generation:this.generation};if(this.ready)this.worker.postMessage(message);else this.pending.push(message);}
 load(project:Project,autoRun=true){this.send({type:'load',project,autoRun});}
 pause(){return new Promise<Snapshot>(resolve=>{const requestId=++this.requestId;this.replies.set(requestId,resolve);this.send({type:'pause',requestId});});}
 destroy(){this.worker.terminate();}
}
