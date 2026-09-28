import {test,expect,type Page} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {physicalPoint} from '../../src/construction';
import type {Project,Snapshot,Vec3} from '../../src/types';

async function boot(page:Page){await page.addInitScript(()=>{const W=window.Worker;window.Worker=class extends W{constructor(...args:ConstructorParameters<typeof Worker>){super(...args);this.addEventListener('message',e=>{if(e.data.type==='snapshot')(window as any).snapshot=e.data.snapshot;});}};});await page.goto('/');await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});}
const state=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as any).snapshot);
async function point(page:Page,at:Vec3){const b=(await page.locator('.board-canvas').boundingBox())!,c=new PerspectiveCamera(34,b.width/b.height,.1,150);c.position.set(6,22,4.51);c.lookAt(6,0,4.5);c.updateMatrixWorld();const v=new Vector3(...at).project(c);return {x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2};}

for(const type of ['npn','pnp'])test(type.toUpperCase()+' collection offers three usable single-transistor projects',async({page},info)=>{
 test.setTimeout(200000);await boot(page);await page.getByTitle('Top view',{exact:true}).click();
 for(const kind of ['sensor','timer','fan']){
  const id=type+'-'+kind;await page.getByRole('button',{name:/^▱ Projects/}).click();await page.getByRole('button',{name:type.toUpperCase()+' only · 3',exact:true}).click();await expect(page.locator('.project-cards>button')).toHaveCount(3);
  if(kind==='sensor')await info.attach(type+'-collection.png',{body:await page.locator('.projects-modal').screenshot(),contentType:'image/png'});
  await page.getByTestId('lesson-'+id).click();const p=await(await page.request.get('/projects/'+id+'.json')).json() as Project;await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue(p.name);await page.getByLabel('Graphics quality').selectOption('low');await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');
  const part=(def:string)=>p.parts.find(q=>q.definition===def)!,read=async(def:string)=>(await state(page))?.parts.find(q=>q.id===part(def).id),bright=async()=>(await read('6SCD1'))?.brightness??0;
  if(kind==='sensor'){
   await expect.poll(bright,{timeout:30000}).toBeGreaterThan(.01);await page.getByRole('button',{name:/Dark Night/}).click();await expect.poll(bright,{timeout:30000}).toBeLessThan(.001);await page.getByRole('button',{name:/Dark Night/}).click();await expect.poll(bright,{timeout:30000}).toBeGreaterThan(.01);
   const at=await point(page,physicalPoint(part('6SCS1'),[1,.62,0]));await page.mouse.click(at.x,at.y);await expect.poll(bright).toBeLessThan(.001);await page.mouse.click(at.x,at.y);await expect.poll(bright).toBeGreaterThan(.01);
  }else if(kind==='timer'){
   await expect.poll(bright).toBeLessThan(.001);const at=await point(page,physicalPoint(part('6SCS2'),[1,.62,0])),before=(await state(page)).time;
   await page.mouse.move(at.x,at.y);await page.mouse.down();await expect.poll(async()=>(await state(page)).time,{timeout:30000}).toBeGreaterThan(before+.25);await expect.poll(bright).toBeGreaterThan(.02);await page.mouse.up();await expect(page.getByRole('button',{name:'Hold the button'})).toBeVisible();const afterglow=await bright();expect(afterglow).toBeGreaterThan(.01);
   // Check visible fading here; the WASM fixtures separately verify full decay
   // and repeated charging without imposing a real-time simulation deadline.
   await expect.poll(bright,{timeout:60000}).toBeLessThan(afterglow*.5);
  }else{
   const speed=async()=>Math.abs((await read('6SCM1'))?.angularVelocity??0);await expect.poll(async()=>(await state(page)).time,{timeout:30000}).toBeGreaterThan(.4);await expect.poll(speed,{timeout:30000}).toBeGreaterThan(10);const fast=await speed(),dial=await point(page,physicalPoint(part('6SCRV'),[1,.65,.3]));await page.mouse.click(dial.x,dial.y);
   const slider=page.getByLabel('Adjustable resistor position');await expect(slider).toBeVisible();await slider.fill('0.6');await expect.poll(speed,{timeout:30000}).toBeLessThan(fast*.85);await slider.fill('0.05');await expect.poll(speed,{timeout:30000}).toBeGreaterThan(fast*.9);
   const sw=await point(page,physicalPoint(part('6SCS1'),[1,.62,0]));await page.mouse.click(sw.x,sw.y);await expect.poll(async()=>Math.abs((await read(type==='npn'?'6SCQ2':'6SCQ1'))?.current??1),{timeout:30000}).toBeLessThan(1e-6);
  }
  await expect(page.locator('.construction-warning')).toHaveCount(0);await expect(page.locator('.board-canvas')).toHaveAttribute('data-obstructed-wires','0');await expect(page.locator('.error-banner')).toHaveCount(0);expect((await state(page)).parts.every(q=>!q.failed)).toBe(true);await info.attach(id+'-working.png',{body:await page.locator('.stage').screenshot(),contentType:'image/png'});
 }
});
