import {useEffect,useRef,useState} from 'react';
import * as Blockly from 'blockly/core';
import {toolbox,blinkWorkspace,programFromWorkspace} from './programming/blocks';
import {compile,packageFirmware} from './programming/compiler';
import type {Target} from './programming/compiler';
interface Props {workspace?:object;target:Target;trace?:number;onSave:(workspace:object)=>void;onProgram:(hex:string,trace:Record<number,string>)=>void;}
export default function BlockEditor({workspace,target,trace,onSave,onProgram}:Props){
 const host=useRef<HTMLDivElement>(null),editor=useRef<Blockly.WorkspaceSvg|null>(null),map=useRef<Record<number,string>>({});const [message,setMessage]=useState('Numbers go from 0 to 255. Use a resistor to protect an LED.');
 const saveRef=useRef(onSave);saveRef.current=onSave;
 useEffect(()=>{const w=Blockly.inject(host.current!,{toolbox,grid:{spacing:24,length:2,colour:'#ddd',snap:true},trashcan:true,zoom:{controls:true,wheel:true,startScale:.85},sounds:false,media:new URL('blockly/',document.baseURI).href});editor.current=w;Blockly.serialization.workspaces.load(workspace??blinkWorkspace,w);
  try{map.current=compile(programFromWorkspace(w,target)).trace;}catch{}
  const change=(event:Blockly.Events.Abstract)=>{if(!event.isUiEvent)saveRef.current(Blockly.serialization.workspaces.save(w));};w.addChangeListener(change);const resize=new ResizeObserver(()=>Blockly.svgResize(w));resize.observe(host.current!);return()=>{resize.disconnect();w.dispose();};
 },[]);
 useEffect(()=>{if(trace&&map.current[trace])editor.current?.highlightBlock(map.current[trace]);},[trace]);
 async function upload(){try{const program=compile(programFromWorkspace(editor.current!,target));const url=new URL('firmware/'+(target==='atmega328p'?'avr':'pic')+'-runtime.hex',document.baseURI);const response=await fetch(url);if(!response.ok)throw Error('Controller firmware is missing from this download.');const hex=packageFirmware(await response.text(),program);map.current=program.trace;onProgram(hex,program.trace);setMessage(`Ready! Your ${program.bytes.length}-byte program is inside the controller. Press Run.`);}catch(e){setMessage(String(e instanceof Error?e.message:e));}}
 return <div className="block-panel"><div className="block-toolbar"><span><b>Your blocks</b><small>{target==='atmega328p'?'AVR controller · dimming pins 5 and 6':'PIC controller · dimming pin 16'}</small></span><button className="primary" onClick={()=>void upload()}>↥ Send to controller</button></div><div className="block-workspace" ref={host}/><p role="status" className="block-help">{message}</p></div>;
}
