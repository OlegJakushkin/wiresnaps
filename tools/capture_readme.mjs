// Capture the real UI and check project-subpath deployment. Run inside Docker.
import {chromium} from '@playwright/test';
import {mkdir,mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';

const root=await mkdtemp(join(tmpdir(),'wiresnaps-pages-'));
await symlink(resolve(process.argv[2]??'export/site'),join(root,'wiresnaps'),'dir');
const server=spawn(process.execPath,['tools/static-server.mjs',root],{stdio:'inherit'});
let browser;
try{
  for(let i=0;i<100;i++){
    try{if((await fetch('http://127.0.0.1:4173/wiresnaps/')).ok)break;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:940},deviceScaleFactor:1});
  const errors=[],outside=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{
    if(!r.url().startsWith('http://127.0.0.1:4173/wiresnaps/')&&!/^(data:|blob:)/.test(r.url()))outside.push(r.url());
  });
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://127.0.0.1:4173/wiresnaps/#build');
  await page.locator('.board-canvas[data-shaders=ready]').waitFor({timeout:60000});
  await mkdir('docs/images',{recursive:true});
  async function lesson(id){
    await page.getByRole('button',{name:/^▱ Projects/}).click();
    await page.getByTestId('lesson-'+id).click();
    await page.getByTestId('run').filter({hasText:'Pause'}).waitFor();
    await page.getByLabel('Graphics quality').selectOption('high');
    await page.waitForTimeout(800);
  }
  async function capture(name){
    await page.mouse.move(1420,15);
    await page.waitForTimeout(300);
    await page.screenshot({path:`docs/images/${name}.png`});
  }
  await lesson('gear-buddies');
  await page.getByTestId('run').click();
  await capture('workbench');
  await lesson('traffic-code');
  await page.getByRole('button',{name:'▧ Code',exact:true}).click();
  await page.locator('.block-workspace').waitFor();
  await page.getByRole('button',{name:/Send to controller/}).click();
  await page.locator('.block-help').filter({hasText:'Ready!'}).waitFor();
  await capture('blocks');
  await page.getByRole('button',{name:'◈ Build',exact:true}).click();
  await lesson('battery-team');
  await page.getByRole('button',{name:/Dark Night/}).click();
  await page.waitForTimeout(1200);
  await page.getByTestId('run').click();
  await capture('night');
  await page.goto('http://127.0.0.1:4173/wiresnaps/demo/');
  await page.locator('h1').waitFor();
  await mkdir('build',{recursive:true});
  await page.screenshot({path:'build/demo-tour-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:4173/wiresnaps/demo/projects.html');
  await page.screenshot({path:'build/demo-projects-mobile.png'});
  if(errors.length||outside.length||failed.length)throw Error(JSON.stringify({errors,outside,failed}));
  console.log('App and guide screenshots captured; project-path assets, worker, firmware, Blockly and static guide passed with no external requests.');
}finally{
  await browser?.close();
  server.kill();
  await rm(root,{recursive:true,force:true});
}
