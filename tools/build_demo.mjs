// Original Markdown guides become a static, script-free tour. Run inside Docker.
import MarkdownIt from 'markdown-it';
import {readFile,writeFile,mkdir,cp,copyFile} from 'node:fs/promises';

const pages=[
  ['index','Feature tour','Make a connection. Follow your curiosity.'],
  ['build','Build & rewire','Make the circuit clear enough to explain.'],
  ['code','Program','Blocks become instructions. Pins carry the result.'],
  ['experiments','Experiment','Light, motion, stored energy and the occasional broken part.'],
  ['projects','29 projects','Short adventures with something real to discover.'],
  ['inside','Inside the engine','Local computation, visible causes and effects.'],
  ['rights','Names & rights','Original work, explicit references and honest limits.'],
  ['review','IP review','Preliminary review · 28 September 2026']
];
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
await mkdir('public/demo',{recursive:true});
await cp('docs/images','public/demo/images',{recursive:true});
await copyFile('docs/demo/site.css','public/demo/site.css');
await copyFile('LICENSE','public/source/LICENSE');
await copyFile('THIRD_PARTY_NOTICES.md','public/source/THIRD_PARTY_NOTICES.md');
await copyFile('provenance/ip-searches.json','public/source/ip-searches.json');
for(const [id,label,subtitle] of pages){
  const source=id==='review'?'docs/IP_REVIEW.md':`docs/demo/${id}.md`;
  const text=await readFile(source,'utf8');
  const title=text.match(/^# (.+)$/m)?.[1];
  if(!title)throw Error(`Missing title in ${source}`);
  const headings=[],used=new Map();
  const md=new MarkdownIt({html:false,typographer:false});
  md.renderer.rules.heading_open=(tokens,index,options,env,self)=>{
    const title=tokens[index+1].content;
    const base=title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const count=used.get(base)??0;used.set(base,count+1);const slug=base+(count?'-'+count:'');
    tokens[index].attrSet('id',slug);
    if(tokens[index].tag==='h2')headings.push([slug,title]);
    return self.renderToken(tokens,index,options);
  };
  const renderLink=md.renderer.rules.link_open??((t,i,o,e,s)=>s.renderToken(t,i,o));
  md.renderer.rules.link_open=(tokens,index,options,env,self)=>{
    const token=tokens[index];let href=token.attrGet('href');
    if(href?.startsWith('../../?demo=')){href=href.replace('../../?demo=','../?demo=');token.attrSet('class','demo-launch');token.attrSet('target','_blank');token.attrSet('rel','noopener');}
    else if(href==='../../LICENSE')href='../source/LICENSE';
    else if(href==='../../THIRD_PARTY_NOTICES.md')href='../source/THIRD_PARTY_NOTICES.md';
    else if(href==='../IP_REVIEW.md')href='review.html';
    else if(href==='../provenance/ip-searches.json')href='../source/ip-searches.json';
    else if(href&&!/^https?:/.test(href))href=href.replace(/\.md(?=#|$)/,'.html');
    if(href)token.attrSet('href',href);
    return renderLink(tokens,index,options,env,self);
  };
  const renderImage=md.renderer.rules.image;
  md.renderer.rules.image=(tokens,index,options,env,self)=>{
    const token=tokens[index];token.attrSet('src',token.attrGet('src').replace('../images/','images/'));
    token.attrSet('loading','lazy');token.attrSet('width','1440');token.attrSet('height','940');
    return renderImage(tokens,index,options,env,self);
  };
  const content=md.render(text.replace(/^# .+\r?\n/,''))
    .replaceAll('<table>','<div class="table-scroll" tabindex="0" role="region" aria-label="Comparison table"><table>')
    .replaceAll('</table>','</table></div>');
  const nav=pages.map(([key,name])=>`<a href="${key}.html"${key===id?' aria-current="page"':''}>${escape(name)}</a>`).join('');
  const toc=headings.map(([slug,name])=>`<a href="#${slug}">${escape(name)}</a>`).join('');
  const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${escape(subtitle)}"><title>${escape(label)} · WireSnaps</title><link rel="stylesheet" href="site.css"></head>
<body><a class="skip" href="#content">Skip to content</a>
<header><a class="brand" href="index.html"><span class="mark" aria-hidden="true">w<span>•</span></span><span>WireSnaps<small>BIG IDEAS. LITTLE CONNECTIONS.</small></span></a><a class="play" href="../#build" target="_blank" rel="noopener">Open playground ↗</a></header>
<div class="layout"><aside><nav aria-label="Feature guide">${nav}</nav><p class="small-note">Independent browser playground.<br>Development milestone.</p></aside>
<main id="content"><div class="hero"><p class="eyebrow">THE WIRESNAPS FIELD GUIDE</p><h1>${escape(title)}</h1><p>${escape(subtitle)}</p></div>
<nav class="on-page" aria-label="On this page"><b>On this page</b>${toc}</nav><article>${content}</article>
<section class="next"><h2>Ready to try an idea?</h2><p>Demos open in a new tab as a personal copy. Your existing saved projects stay available.</p><a href="projects.html">Choose a project →</a></section></main></div>
<footer><span>Original WireSnaps content · GPL-3.0-or-later</span><a href="rights.html">Names & rights</a><a href="../source/THIRD_PARTY_NOTICES.md">Third-party notices</a><a href="../source/wiresnaps-source.tar.gz">Corresponding source</a></footer></body></html>`;
  await writeFile(`public/demo/${id}.html`,html);
}
console.log(`Built ${pages.length} static guide pages from repository Markdown; no runtime scripts or remote assets.`);
