export type Vec3 = [number,number,number];
export type Model = 'accessory'|'junction'|'battery'|'resistor'|'wire'|'switch'|'lamp'|'motor'|'diode'|'led'|'npn'|'pnp'|'capacitor'|'inductor'|'potentiometer'|'solar'|'fuse'|'photoresistor'|'thermistor'|'speaker'|'microphone'|'meter'|'touch'|'relay'|'mcu';
export interface Terminal { id:string; label:string; position:Vec3; polarity?:'positive'|'negative'; }
export interface Snap { terminal:string; position:Vec3; kind:'electrical-snap'; }
export interface Attachment { id:string; kind:'axle'|'gear'|'mount'; position:Vec3; }
export type Naming = 'none'|'snap'|'znatok';
export interface BodyShape {kind:'box'|'cylinder'|'sphere';at:Vec3;size:Vec3;color:string;rotation?:Vec3;role?:'base'|'body'|'snap'|'rotor'|'actuator'|'emitter'|'detail';metal?:number;collision?:boolean;sides?:number;}
export interface Marking {text:string;at:Vec3;width:number;color?:string;terminal?:string;}
export interface BrandMatch {code:string;name:string;status:'verified'|'functional';source:string;note:string;terminals?:Record<string,string>;}
export interface Presentation {night:boolean;naming:Naming;quality:'auto'|'high'|'low';}
export interface Definition {
 id:string; name:string; short:string; category:'Power'|'Lights'|'Motion'|'Controls'|'Electronics'|'Building'|'Computers';
 model:Model; color:string; shape:string; size:Vec3; terminals:Terminal[]; snaps:Snap[]; attachments:Attachment[];
 parameters:Record<string,number|string|number[]>; ratings:{voltage?:number;current?:number;estimated:string[]};
 guidance:{does:string;needs:string;try:string}; provenance:{partNumbers:string[];url:string;parameterStatus:'estimated'|'documented-and-estimated'};
 programming?:'atmega328p'|'pic16f877a';
 geometry:BodyShape[];markings:Marking[];interaction:'none'|'toggle'|'momentary'|'dial'|'sensor';brands:Partial<Record<'snap'|'znatok',BrandMatch>>;
}
export interface Instance {id:string;definition:string;position:Vec3;rotation:number;control:Record<string,number|boolean>;damage?:{failed:boolean;failure:string;temperature:number;stress:number};}
export interface Endpoint {part:string;terminal:string;snap?:number;}
export interface Connection {id:string;from:Endpoint;to:Endpoint;kind:'wire'|'mechanical';}
export interface Project {schemaVersion:2;catalogueVersion:string;id:string;name:string;revision:number;mode:'guided'|'experiment';parts:Instance[];connections:Connection[];workspaces:Record<string,object>;firmware:Record<string,string>;environment:{light:number;sound:number;temperature:number;wind:number};presentation:Presentation;lesson?:{templateId:string;version:1;step:number;completed:boolean};}
export interface Observation {id:string;voltage:number;current:number;power:number;temperature:number;stress:number;failed:boolean;failure:string;brightness:number;angularVelocity:number;angle:number;torque:number;tripped:boolean;pc?:number;cycles?:number;serial?:string;trace?:number;}
export interface Diagnostic {code:string;severity:'error'|'warning';part?:string;}
export interface Snapshot {apiVersion:1;revision:number;time:number;paused:boolean;parts:Observation[];events:{code:string;part:string;time?:number}[];diagnostics:Diagnostic[];speed?:number;trace?:Record<string,number>;}
export interface Controls {environment?:Partial<Project['environment']>;night?:boolean;mode?:Project['mode'];paused?:boolean;powered?:boolean;parts?:{id:string;control:Instance['control']}[];}
export type EngineCommand = {type:'load';project:Project;autoRun?:boolean}|{type:'detach';parts:string[];wires?:string[]}|{type:'run'|'step'|'reset'}|{type:'pause';requestId?:number}|{type:'control';controls:Controls}|{type:'repair';id:string}|{type:'firmware';id:string;hex:string}|{type:'diagnostics'};
export type WorkerCommand = EngineCommand & {version:2;projectId:string;generation:number};
export type WorkerReply = {version:2;type:'ready'}|({version:2;projectId:string;generation:number}&({type:'snapshot';snapshot:Snapshot;values:Float64Array;requestId?:number}|{type:'error';message:string}));
