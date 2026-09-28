import {test,expect,type Page} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {emptyProject,place,worldPoint} from '../../src/project';
import {byId} from '../../src/catalogue';
import {BASE_Y} from '../../src/component-design';
import type {Project,Snapshot,Vec3} from '../../src/types';

async function boot(page:Page){await page.addInitScript(()=>{const Original=window.Worker;(window as any).snapshot=undefined;window.Worker=class extends Original{constructor(...args:ConstructorParameters<typeof Worker>){super(...args);this.addEventListener('message',e=>{if(e.data.type==='snapshot')(window as any).snapshot=e.data.snapshot;});}};});await page.goto('/');await ready(page);}
async function ready(page:Page){await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});await page.getByLabel('Graphics quality').selectOption('low');}
const snapshot=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as any).snapshot);
async function point(page:Page,p:Vec3){const b=(await page.locator('.board-canvas').boundingBox())!,c=new PerspectiveCamera(34,b.width/b.height,.1,150);c.position.set(6,22,4.51);c.lookAt(6,0,4.5);c.updateMatrixWorld();const v=new Vector3(...p).project(c);return {x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2};}

test('switching off the gear circuit stops both gears, and switching on restarts them',async({page},info)=>{
 test.setTimeout(120000);await boot(page);await page.getByRole('button',{name:/^▱ Projects/}).click();await page.getByTestId('lesson-gear-buddies').click();const p=await(await page.request.get('/projects/gear-buddies.json')).json() as Project;
 await page.getByLabel('Graphics quality').selectOption('low');await page.getByTitle('Top view',{exact:true}).click();const motor=p.parts.find(p=>p.definition==='6SCGM')!,sw=p.parts.find(p=>byId[p.definition].interaction==='toggle')!;
 const state=async()=>(await snapshot(page))?.parts.find(q=>q.id===motor.id);await expect.poll(async()=>Math.abs((await state())?.angularVelocity??0),{timeout:30000}).toBeGreaterThan(5);
 const local=worldPoint(sw,[1,0,0]),at=await point(page,[local[0],BASE_Y+.62,local[2]]);await page.mouse.click(at.x,at.y);await page.mouse.move(10,100);
 await expect.poll(async()=>Math.abs((await state())?.current??0)).toBeLessThan(.00001);await expect.poll(async()=>Math.abs((await state())?.angularVelocity??0),{timeout:30000}).toBe(0);
 const stopped=await snapshot(page),angle=(await state())!.angle;
 // Let the renderer consume the worker's final resting angle before comparing.
 await expect.poll(async()=>(await snapshot(page)).time).toBeGreaterThan(stopped.time+.05);
 // The status badge overlaps the canvas and its clock continues while gears rest.
 const imageOptions={style:'.board-badge { visibility: hidden !important; }'};
 const before=await page.locator('.board-canvas').screenshot(imageOptions);await info.attach('gears-before.png',{body:before,contentType:'image/png'});
 await expect.poll(async()=>(await snapshot(page)).time,{timeout:30000}).toBeGreaterThan(stopped.time+.15);expect((await state())!.angle).toBe(angle);
 const after=await page.locator('.board-canvas').screenshot(imageOptions);await info.attach('gears-stopped.png',{body:after,contentType:'image/png'});expect(after.equals(before)).toBe(true);
 await page.mouse.click(at.x,at.y);await expect.poll(async()=>Math.abs((await state())?.angularVelocity??0),{timeout:30000}).toBeGreaterThan(5);await expect(page.locator('.error-banner')).toHaveCount(0);
});

test('Dark Night changes solar and sensor electricity, survives reload, and restores chosen daylight',async({page})=>{
 test.setTimeout(120000);await boot(page);const p=emptyProject();p.name='Sun and sensor';p.environment.light=.65;p.presentation.quality='low';
 const battery=place('6SCB1',[1,0,1]),solar=place('6SCB2',[5,0,1]),sensor=place('6SCRP',[9,0,1]),solarLoad=place('6SCR1',[5,0,5]),sensorLoad=place('6SCR1',[9,0,5]);p.parts=[battery,solar,sensor,solarLoad,sensorLoad];
 const wire=(a:typeof battery,ta:string,b:typeof battery,tb:string)=>p.connections.push({id:'wire-'+p.connections.length,kind:'wire',from:{part:a.id,terminal:ta},to:{part:b.id,terminal:tb}});
 wire(battery,'b',solar,'b');wire(solar,'a',solarLoad,'a');wire(solarLoad,'b',solar,'b');wire(battery,'a',sensor,'a');wire(sensor,'b',sensorLoad,'a');wire(sensorLoad,'b',battery,'b');
 await page.locator('input[type=file]').first().setInputFiles({name:'light.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue(p.name);
 const current=async(id:string)=>Math.abs((await snapshot(page))?.parts.find(q=>q.id===id)?.current??0);
 await expect.poll(()=>current(solar.id)).toBeGreaterThan(.01);await expect.poll(()=>current(sensor.id)).toBeGreaterThan(.001);const daylight=await current(solar.id);
 await page.getByTestId('run').click();await expect(page.getByTestId('run')).toHaveText('▶ Run');await expect.poll(async()=>(await snapshot(page)).paused).toBe(true);const pausedAt=(await snapshot(page)).time;
 await page.getByRole('button',{name:/Dark Night/}).click();await expect.poll(()=>current(solar.id)).toBeLessThan(1e-9);await expect.poll(()=>current(sensor.id)).toBeLessThan(.00001);expect((await snapshot(page)).time).toBe(pausedAt);
 await page.locator('.environment summary').click();await expect(page.getByLabel('Sunshine')).toHaveValue('0');await expect(page.getByLabel('Sunshine')).toBeDisabled();
 // Updating another environment control must not re-send the remembered sun.
 await page.getByLabel('Room temperature').focus();await page.getByLabel('Room temperature').press('ArrowRight');await expect.poll(()=>current(solar.id)).toBeLessThan(1e-9);
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Saved on this device'})).toBeVisible();await page.reload();await ready(page);await expect(page.locator('.app')).toHaveClass(/night/);await expect.poll(async()=>(await snapshot(page))?.parts.some(q=>q.id===solar.id)).toBe(true);await expect.poll(()=>current(solar.id)).toBeLessThan(1e-9);await expect.poll(()=>current(sensor.id)).toBeLessThan(.00001);
 await page.getByRole('button',{name:/Dark Night/}).click();await expect.poll(()=>current(solar.id)).toBeGreaterThan(.01);await expect.poll(()=>current(sensor.id)).toBeGreaterThan(.001);expect(await current(solar.id)).toBeCloseTo(daylight,5);
 await page.locator('.environment summary').click();await expect(page.getByLabel('Sunshine')).toBeEnabled();await expect(page.getByLabel('Sunshine')).toHaveValue('0.65');await expect(page.locator('.error-banner')).toHaveCount(0);
});
