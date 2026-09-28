import {useMemo,useState} from 'react';
import {PartArt} from './PartArt';
import {partLabel} from './component-design';
import {suggestNextParts} from './next-parts';
import {nextPartsText as text} from './i18n/next-parts.en';
import type {Definition,Project} from './types';

export function NextPartSuggestions({project,focus,onChoose}:{project:Project;focus:Definition;onChoose:(id:string)=>void}){
 const suggestions=useMemo(()=>suggestNextParts(project,focus),[project.parts,focus]);
 const [reasonFor,setReasonFor]=useState<string|null>(null);
 return <section className="next-parts" aria-label="Suggested next parts" data-for={focus.id} onKeyDown={e=>{if(e.key==='Escape'&&reasonFor){e.stopPropagation();setReasonFor(null);}}}>
  <div className="next-parts-heading"><b>✦ {text.title}</b><span>{text.withPart} {focus.name}</span></div>
  <div className="next-parts-grid">{suggestions.map(({definition:d,reason})=>{
   const tooltip='next-part-why-'+d.id,shown=reasonFor===d.id;
   return <div className="next-part" key={d.id} onPointerEnter={e=>{if(e.pointerType!=='touch')setReasonFor(d.id);}} onPointerLeave={e=>{if(!e.currentTarget.contains(document.activeElement))setReasonFor(null);}} onFocus={()=>setReasonFor(d.id)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setReasonFor(null);}}>
    <button className="next-part-pick" aria-label={text.pick+' '+d.name} aria-describedby={shown?tooltip:undefined} onClick={()=>{setReasonFor(null);onChoose(d.id);}}><PartArt d={d} naming={project.presentation.naming}/><span>{d.name}<small>{partLabel(d,project.presentation.naming)}</small></span></button>
    <button className="next-part-why" aria-label={text.why+' '+d.name} aria-expanded={shown} aria-describedby={shown?tooltip:undefined} onClick={()=>setReasonFor(d.id)}>?</button>
    {shown&&<div className="next-part-tooltip" role="tooltip" id={tooltip}><b>{d.name}</b>{reason}</div>}
   </div>;
  })}</div>
 </section>;
}
