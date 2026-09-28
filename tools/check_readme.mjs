// Validate local README links and render its Mermaid diagram. Docker only.
// Pass the temporary node_modules directory containing Mermaid as the argument.
import {chromium} from '@playwright/test';
import {readFile,writeFile,access,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';

const markdown=await readFile('README.md','utf8');
for(const match of markdown.matchAll(/\]\(([^)]+)\)/g)){
  if(!/^(https?:|#)/.test(match[1]))await access(match[1]);
}
const diagram=markdown.match(/```mermaid\r?\n([\s\S]*?)```/)?.[1];
if(!diagram)throw Error('Missing simulation diagram');
const server=spawn(process.execPath,['tools/static-server.mjs',process.argv[2]],{stdio:'inherit'});
let browser;
try{
  for(let i=0;i<100;i++){
    try{await fetch('http://127.0.0.1:4173/');break;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  browser=await chromium.launch();
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:4173/');
  const svg=await page.evaluate(async source=>{
    const {default:mermaid}=await import('/mermaid/dist/mermaid.esm.min.mjs');
    mermaid.initialize({startOnLoad:false,securityLevel:'strict'});
    return (await mermaid.render('simulation-architecture',source)).svg;
  },diagram);
  if(!svg.includes('<svg'))throw Error('Mermaid did not produce a diagram');
  await mkdir('build',{recursive:true});
  await writeFile('build/readme-architecture.svg',svg);
  console.log('README local links and Mermaid rendering passed.');
}finally{
  await browser?.close();
  server.kill();
}
