import type {BrandMatch,Definition} from './types';
// These tables describe terminal function, not a measured construction match.
// Individual Snap Circuits references (including PDF page) live in citations.json.
const znatokSource='https://ru.scribd.com/document/959889646/Знаток-999-Схем-Книга-2';
const znatok:Record<string,string>={B1:'19',L1:'18',L2:'27',D1:'17',D2:'26',M1:'24',S1:'15',S2:'14',S9:'13',RP:'16',X1:'28',SP:'20',R1:'30',R2:'31',R3:'32',R4:'33',R5:'34',C1:'40',C2:'41',C3:'42',C4:'43',C5:'44',Q1:'51',Q2:'52',RV:'53',D3:'57'};
export function manufacturerMappings(d:Definition):Definition['brands']{
 const mappings:Definition['brands']={};const code=d.provenance.partNumbers[0];
 if(code)mappings.snap={code:d.id==='snapino'?'U31':d.model==='accessory'?code.replace(/^6SC/,''):d.short,name:d.id==='snapino'?'Snapino controller':d.name,status:'functional',source:d.provenance.url,note:'Published part identity; body dimensions and model constants are educational estimates. Check your kit manual.'};
 const zn=znatok[d.short]??(/^[1-7]$/.test(d.short)?d.short:undefined);
 if(zn)mappings.znatok={code:zn,name:d.name,status:'functional',source:znatokSource,note:'Provisional functional reference from a third-party copy of the Znatok 999 table. Manufacturer verification is pending. Check the number, values and B/C/E in your own manual; this is not a verified construction match.'};
 // Znatok 56 is an ammeter: it is deliberately not mapped to our voltage meter.
 if(d.id==='6SCBGSUP')delete mappings.snap; // Generic bearing stand, not measured kit hardware.
 if(d.shape==='gear'&&mappings.snap)mappings.snap.note='Published outer diameter; tooth count, axle fit and friction are estimates. Use your actual gear teeth and kit mounts.';
 if(d.model==='relay'&&mappings.snap){mappings.snap.source='https://www.elenco.com/wp-content/uploads/2017/05/SC_STEM1_manual_PRINT_Small.pdf#page=62';mappings.snap.note='STEM project 69 documents contacts 1 COM, 2 NC, 3 NO. Coil constants and body/snap dimensions remain estimates; follow your S3 manual.';mappings.snap.terminals={a:'COIL',b:'COIL',c:'1 COM',d:'3 NO',nc:'2 NC'};}
 return mappings;
}
