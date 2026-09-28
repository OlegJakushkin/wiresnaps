import {build} from 'esbuild';
import {mkdir,writeFile,readFile,readdir,copyFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
await mkdir('build/generated',{recursive:true});
await build({entryPoints:['src/catalogue.ts'],bundle:true,platform:'node',format:'esm',outfile:'build/generated/catalogue.mjs'});
const {catalogue,CATALOGUE_VERSION}=await import('../build/generated/catalogue.mjs');
await mkdir('public/catalogue',{recursive:true});
await writeFile('public/catalogue/components.json',JSON.stringify({version:CATALOGUE_VERSION,components:catalogue},null,2)+'\n');
await copyFile('catalogue/coverage.json','public/catalogue/coverage.json');
await build({entryPoints:['src/lessons.ts'],bundle:true,platform:'node',format:'esm',outfile:'build/generated/lessons.mjs'});
const {lessons,prepareLesson}=await import('../build/generated/lessons.mjs');
await mkdir('public/projects',{recursive:true});
for(const lesson of lessons){const project=await prepareLesson(lesson.id,target=>readFile('public/firmware/'+target+'-runtime.hex','utf8'));await writeFile('public/projects/'+lesson.id+'.json',JSON.stringify(project));console.log(lesson.name+': '+project.parts.length+' parts, '+project.connections.filter(c=>c.kind==='wire').length+' flexible wires');}
await writeFile('public/projects/index.json',JSON.stringify({version:1,catalogueVersion:CATALOGUE_VERSION,templates:lessons.map(({build,check,...metadata})=>metadata)},null,2));
await mkdir('public/source/licenses',{recursive:true});
const notices=[];
const supplements=JSON.parse(await readFile('provenance/dependency-licenses/sources.json','utf8'));
async function collect(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(!entry.isDirectory()||entry.name.startsWith('.'))continue;
  const folder=join(dir,entry.name);
  if(entry.name.startsWith('@')){await collect(folder);continue;}
  try{
   const pkg=JSON.parse(await readFile(join(folder,'package.json'),'utf8'));
   const files=(await readdir(folder)).filter(f=>/^(licen[sc]e|copying|notice)([._-]|$)/i.test(f));
   const record={name:pkg.name,version:pkg.version,license:pkg.license,repository:pkg.repository,files:[]};
   for(const f of files){const name=pkg.name.replaceAll('/','_')+'-'+f;try{await copyFile(join(folder,f),join('public/source/licenses',name));record.files.push(name);}catch{}}
   for(const extra of supplements.filter(s=>s.name===pkg.name&&s.version===pkg.version)){
    const bytes=await readFile(join('provenance/dependency-licenses',extra.file));
    if(createHash('sha256').update(bytes).digest('hex')!==extra.sha256)throw Error('Changed upstream licence: '+extra.file);
    await writeFile(join('public/source/licenses',extra.file),bytes);record.files.push(extra.file);record.noticeSource=extra.source;
   }
   record.noticeStatus=record.files.length?'text-included':'package-declaration-only';
   notices.push(record);
   try{await collect(join(folder,'node_modules'));}catch{}
  }catch{}
 }
}
await collect('node_modules');
const runtime=Object.keys(JSON.parse(await readFile('package.json','utf8')).dependencies);
for(const name of runtime)if(!notices.some(n=>n.name===name&&n.files.length))throw Error('Missing runtime licence text: '+name);
await writeFile('public/source/dependency-notices.json',JSON.stringify(notices,null,2)+'\n');
console.log(`Staged ${catalogue.length} component definitions and ${notices.length} dependency notices.`);
await import('./build_demo.mjs');
