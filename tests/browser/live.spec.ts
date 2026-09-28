import {test,expect,type Page} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {emptyProject,place} from '../../src/project';
import {createLesson} from '../../src/lessons';
import {byId} from '../../src/catalogue';
import {BASE_Y,LAYER} from '../../src/component-design';
import type {Snapshot,Project} from '../../src/types';

async function observe(page:Page){
 await page.addInitScript(()=>{
  const state=window as any;state.shaderLinks=[];state.engineSnapshot=undefined;
  const original=WebGL2RenderingContext.prototype.linkProgram;
  WebGL2RenderingContext.prototype.linkProgram=function(program){state.shaderLinks.push({late:document.querySelector('.board-canvas')?.getAttribute('data-shaders')==='ready',sources:this.getAttachedShaders(program)?.map(shader=>this.getShaderSource(shader))});return original.call(this,program);};
  const WorkerClass=window.Worker;window.Worker=class extends WorkerClass{constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.addEventListener('message',({data})=>{if(data.type==='snapshot')state.engineSnapshot=data;});}};
 });
}
async function ready(page:Page){await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});}
async function state(page:Page):Promise<Snapshot>{return page.evaluate(()=>(window as any).engineSnapshot.snapshot);}
async function open(page:Page,p:Project){await page.locator('input[type=file]').first().setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue(p.name);await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');await expect.poll(async()=>(await state(page)).parts.some(s=>s.id===p.parts[0]?.id)||!p.parts.length).toBe(true);}
async function point(page:Page,p:[number,number,number]){const b=(await page.locator('.board-canvas').boundingBox())!;const camera=new PerspectiveCamera(34,b.width/b.height,.1,150);camera.position.set(6,22,4.51);camera.lookAt(6,0,4.5);camera.updateMatrixWorld();const v=new Vector3(...p).project(camera);return {x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2};}

test('startup warms shaders for every light count, placement and graphics mode',async({page},info)=>{
 test.setTimeout(180000);await observe(page);await page.goto('/');await ready(page);await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');
 for(let count=0;count<=8;count++){
  const p=emptyProject();p.name='Shader coverage '+count;p.parts=Array.from({length:count},(_,i)=>place('6SCD1',[1+(i%4)*3,0,1+Math.floor(i/4)*3]));await open(page,p);
  for(const quality of ['low','high']){await page.getByLabel('Graphics quality').selectOption(quality);await expect(page.locator('.board-canvas')).toHaveAttribute('data-quality',quality);await page.getByRole('button',{name:/Dark Night/}).click();await page.waitForTimeout(100);}
 }
 for(const naming of ['snap','znatok','none']){await page.getByLabel('Real-life labels').selectOption(naming);await page.waitForTimeout(100);}
 await page.getByLabel('Graphics quality').selectOption('low');await page.getByRole('button',{name:'☼ Lights',exact:true}).click();await page.locator('.part-card').first().click();await page.mouse.move(670,560);await page.waitForTimeout(200);await page.keyboard.press('Escape');
 await page.getByTitle('Top view',{exact:true}).click();const at=await point(page,[1,.4,1]);await page.mouse.click(at.x,at.y);await page.waitForTimeout(200);
 const links=await page.evaluate(()=>(window as any).shaderLinks);await info.attach('shader-compilation.json',{body:JSON.stringify({startup:links.filter((x:any)=>!x.late).length,afterStartup:links.filter((x:any)=>x.late)}),contentType:'application/json'});
 expect(links.filter((x:any)=>!x.late).length).toBeGreaterThan(10);expect(links.filter((x:any)=>x.late), 'Interaction must reuse the startup shader programs').toEqual([]);await expect(page.locator('.error-banner')).toHaveCount(0);
});

test('runs by default; lifting, cancelling, deleting and undoing a snap wire rewire the live lamp',async({page})=>{
 await observe(page);await page.goto('/');await ready(page);await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');
 const p=createLesson('battery-team');p.name='Live battery team';p.presentation.quality='low';await open(page,p);const lamp=p.parts.find(p=>byId[p.definition].model==='lamp')!;
 await expect.poll(async()=>(await state(page)).parts.find(s=>s.id===lamp.id)?.brightness,{timeout:30000}).toBeGreaterThan(.5);
 await page.getByTitle('Top view',{exact:true}).click();await page.waitForTimeout(200);
 // The longest horizontal snap wire is unobstructed along its middle.
 const wire=p.parts.filter(p=>byId[p.definition].model==='wire'&&p.rotation%2===0).sort((a,b)=>byId[b.definition].snaps.length-byId[a.definition].snaps.length)[0];const d=byId[wire.definition];
 const local=d.snaps[Math.floor(d.snaps.length/2)].position;const x=wire.position[0]+(wire.rotation===0?local[0]:-local[0]);const at=await point(page,[x,BASE_Y+.27+wire.position[1]*LAYER,wire.position[2]]);
 const before=(await state(page)).time;await page.mouse.move(at.x,at.y);await page.mouse.down();await page.mouse.move(at.x,at.y-55,{steps:5});
 await expect.poll(async()=>Math.abs((await state(page)).parts.find(s=>s.id===lamp.id)!.current)).toBeLessThan(1e-7);
 await expect.poll(async()=>(await state(page)).parts.find(s=>s.id===lamp.id)!.brightness,{timeout:5000}).toBeLessThan(.01);expect((await state(page)).time).toBeGreaterThan(before);await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');
 await page.keyboard.press('Escape');await page.mouse.up();await expect.poll(async()=>(await state(page)).parts.find(s=>s.id===lamp.id)!.brightness).toBeGreaterThan(.5);
 await page.mouse.click(at.x,at.y);await page.getByTitle('Delete part',{exact:true}).click();await expect.poll(async()=>(await state(page)).parts.find(s=>s.id===lamp.id)!.brightness).toBeLessThan(.01);await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');
 await page.getByTitle('Undo',{exact:true}).click();await expect.poll(async()=>(await state(page)).parts.find(s=>s.id===lamp.id)!.brightness).toBeGreaterThan(.5);expect((await state(page)).time).toBeGreaterThan(before);
 await page.getByTestId('run').click();await expect.poll(async()=>(await state(page)).paused).toBe(true);const paused=(await state(page)).time;await page.mouse.click(at.x,at.y);await page.getByTitle('Delete part',{exact:true}).click();await expect.poll(async()=>(await state(page)).parts.some(s=>s.id===wire.id)).toBe(false);await expect(page.getByTestId('run')).toHaveText('▶ Run');expect((await state(page)).time).toBe(paused);await expect(page.locator('.error-banner')).toHaveCount(0);
 await page.getByRole('button',{name:/^▱ Projects/}).click();await page.getByLabel('Close project library').click();await expect(page.getByTestId('run')).toHaveText('▶ Run');
 await page.getByTestId('run').click();await page.getByRole('button',{name:/^▱ Projects/}).click();await page.getByLabel('Close project library').click();await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');
});

test('a camera change can pick and operate a switch before the next display frame',async({page})=>{
 await observe(page);await page.goto('/');await ready(page);const p=emptyProject();p.name='Frame-independent controls';p.presentation.quality='low';p.parts=[place('6SCS1',[2,0,4])];await open(page,p);
 // Stop the main page's animation scheduling. The simulation worker and native
 // input events continue, so a camera preset must update its picking matrices.
 await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});await page.waitForTimeout(300);
 await page.getByTitle('Top view',{exact:true}).click();const at=await point(page,[3,.62,4]);await page.mouse.click(at.x,at.y);await expect(page.getByRole('button',{name:'○ Close the switch'})).toBeVisible();await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');
});
