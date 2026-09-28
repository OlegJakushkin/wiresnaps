import {test,expect,type Page} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {emptyProject,place} from '../../src/project';
import {createLesson} from '../../src/lessons';
import type {Project} from '../../src/types';
async function boardReady(page:Page){await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});}
async function pause(page:Page){await boardReady(page);await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');await page.getByTestId('run').click();}
async function saved(page:Page):Promise<any[]>{return page.evaluate(()=>new Promise<any[]>((resolve,reject)=>{const r=indexedDB.open('wiresnaps');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const q=db.transaction('projects').objectStore('projects').getAll();q.onsuccess=()=>{db.close();resolve(q.result);};};}));}
async function openDocument(page:Page,p:Project){await page.locator('input[type=file]').first().setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue(p.name);await expect(page.locator('.error-banner')).toHaveCount(0);}
async function topPoint(page:Page,point:[number,number,number]){const box=(await page.locator('.board-canvas').boundingBox())!;const c=new PerspectiveCamera(34,box.width/box.height,.1,150);c.position.set(6,22,4.51);c.lookAt(6,0,4.5);c.updateMatrixWorld();const v=new Vector3(...point).project(c);return {x:box.x+(v.x+1)*box.width/2,y:box.y+(1-v.y)*box.height/2};}
async function top(page:Page){await page.getByTitle('Top view',{exact:true}).click();await page.waitForTimeout(250);}
async function openLesson(page:Page,id:string,tab:'showcases'|'code'|'lab'='showcases'){await page.getByRole('button',{name:/^▱ Projects/}).click();if(tab==='lab')await page.getByRole('button',{name:'Breakage Lab · 4'}).click();if(tab==='code')await page.getByRole('button',{name:'Code projects · 2'}).click();await page.getByTestId('lesson-'+id).click();await expect(page.getByRole('dialog')).toHaveCount(0);}

test('static runtime, vivid day/night lighting, quality settings and input measurements',async({page},info)=>{
 const errors:string[]=[],outside:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))outside.push(r.url());});
 await page.goto('/');await boardReady(page);await expect(page.locator('canvas')).toBeVisible();await expect(page.getByLabel('Real-life labels')).toHaveValue('none');await expect(page.getByLabel('Graphics quality')).toHaveValue('auto');
 await page.getByLabel('Graphics quality').selectOption('low');await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');await expect(page.locator('.board-badge small')).not.toHaveText('0.00 s simulated',{timeout:30000});await expect(page.locator('.hint-card h3')).toHaveText('You made a complete loop!');await page.getByTestId('run').click();
 await info.attach('daylight.png',{body:await page.screenshot(),contentType:'image/png'});
 const timings:number[]=[];for(let i=0;i<6;i++){const ms=await page.evaluate(()=>new Promise<number>(resolve=>{const button=document.querySelector('.night-toggle') as HTMLButtonElement;const start=performance.now();button.click();requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-start)));}));timings.push(ms);}
 await page.getByRole('button',{name:/Dark Night/}).click();await expect(page.locator('.app')).toHaveClass(/night/);await page.locator('.environment summary').click();await expect(page.getByLabel('Sunshine')).toHaveValue('0');await expect(page.getByLabel('Sunshine')).toBeDisabled();
 await info.attach('night.png',{body:await page.screenshot(),contentType:'image/png'});
 await page.getByLabel('Graphics quality').selectOption('high');await expect(page.locator('.board-canvas')).toHaveAttribute('data-quality','high');await info.attach('night-high.png',{body:await page.screenshot(),contentType:'image/png'});await page.getByLabel('Graphics quality').selectOption('low');
 await page.getByLabel('Real-life labels').selectOption('znatok');await expect(page.locator('.part-card').first()).toContainText('19');
 // Measure a fresh steady-state sample, excluding shader compilation and the
 // preceding High-mode frame from this Low-mode performance measurement.
 const frames=await page.evaluate(()=>new Promise<number[]>(resolve=>{let last=0,warmup=30;const times:number[]=[];function frame(now:number){if(warmup>0)warmup--;else times.push(now-last);last=now;if(times.length<30)requestAnimationFrame(frame);else resolve(times);}requestAnimationFrame(frame);}));
 await info.attach('render-and-input.json',{body:JSON.stringify({browser:info.project.name,renderer:'Docker software WebGL',viewport:'1440 × 1000',quality:'Low',fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),frameIntervalsMs:frames,inputToTwoFramesMs:timings,targetFps:60,targetInputMs:100}),contentType:'application/json'});
 expect(errors).toEqual([]);expect(outside).toEqual([]);await expect(page.locator('.error-banner')).toHaveCount(0);
});
test('C++ fixtures run as WebAssembly in this browser',async({page})=>{await page.goto('/diagnostics/');await expect(page.locator('#status')).toHaveText('All fixtures passed',{timeout:85000});});

test('both code projects supply editable blocks and firmware for real emulated chips',async({page})=>{
 await page.goto('/');await boardReady(page);await page.getByLabel('Graphics quality').selectOption('low');
 for(const id of ['traffic-code','dial-code']){await openLesson(page,id,'code');await expect(page.locator('.construction-warning')).toHaveCount(0);await page.getByRole('button',{name:'▧ Code',exact:true}).click();await expect(page.locator('.block-workspace')).toBeVisible();await page.getByRole('button',{name:/Send to controller/}).click();await expect(page.locator('.block-help')).toContainText('Ready!');await page.getByRole('button',{name:'◈ Build',exact:true}).click();await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');await expect(page.locator('.board-badge small')).not.toHaveText('0.00 s simulated',{timeout:30000});await page.getByTestId('run').click();await expect(page.locator('.error-banner')).toHaveCount(0);}
});

test('switch clicks, held buttons, dial handles, keyboard and drag-to-delete with undo',async({page})=>{
 await page.goto('/');await boardReady(page);const p=emptyProject();p.name='Hands-on controls';p.presentation.quality='low';p.parts=[place('6SCS1',[2,0,4]),place('6SCS2',[6,0,4]),place('6SCRV',[9,0,4])];await openDocument(page,p);await top(page);
 const slide=await topPoint(page,[3,.62,4]);await page.mouse.click(slide.x,slide.y);await expect(page.getByRole('button',{name:'○ Close the switch'})).toBeVisible();await page.keyboard.press('Space');await expect(page.getByRole('button',{name:'● Open the switch'})).toBeVisible();
 const button=await topPoint(page,[7,.72,4]);await page.mouse.click(button.x,button.y);await expect(page.getByRole('button',{name:'Hold the button'})).toBeVisible();
 await page.mouse.move(button.x,button.y);await page.mouse.down();await page.getByRole('button',{name:'Save',exact:true}).evaluate((b:HTMLButtonElement)=>b.click());await expect.poll(async()=>{const a=(await saved(page)).find(p=>p.name==='Hands-on controls');return a?.document.parts.find((x:any)=>x.definition==='6SCS2').control.closed;}).toBe(false);await page.mouse.up();
 await page.keyboard.down('Space');await expect(page.getByRole('button',{name:'Hold the button'})).toHaveAttribute('aria-pressed','true');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('Space');await expect(page.getByRole('button',{name:'Hold the button'})).toHaveAttribute('aria-pressed','false');
 const dial=await topPoint(page,[10,.72,4.25]);await page.mouse.move(dial.x,dial.y);await page.mouse.down();await page.mouse.move(dial.x+25,dial.y,{steps:5});await page.mouse.up();await expect(page.getByLabel('Adjustable resistor position')).toHaveValue(/0\.7/);
 // Start on the base so this gesture moves the whole component, not the knob.
 const base=await topPoint(page,[9,.4,4]);await page.mouse.move(base.x,base.y);await page.mouse.down();await page.mouse.move(100,400,{steps:12});await expect(page.locator('.trash-overlay')).toBeVisible();await page.mouse.up();await expect(page.locator('.trash-overlay')).toBeHidden();await page.getByTitle('Undo',{exact:true}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(async()=>{const a=(await saved(page)).find(p=>p.name==='Hands-on controls');return a?.document.parts.length;}).toBe(3);
 // Cancellation restores the original placement and does not delete.
 await page.mouse.move(slide.x,slide.y);await page.mouse.down();await page.mouse.move(100,400,{steps:8});await page.locator('canvas').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();await expect(page.locator('.trash-overlay')).toBeHidden();await expect(page.locator('.construction-warning')).toHaveCount(0);
});

test('legacy migration, multiple saved projects, persistent damage and JSON export',async({page})=>{
 const p=emptyProject();p.id='legacy';p.name='Keep my experiment';p.mode='experiment';p.parts=[place('6SCL1',[4,0,4])];p.parts[0].damage={failed:true,failure:'open',temperature:40,stress:2};
 await page.addInitScript(p=>{if(!localStorage.getItem('wiresnaps.project.v1'))localStorage.setItem('wiresnaps.project.v1',JSON.stringify({...p,schemaVersion:1,presentation:undefined}));},p);
 await page.goto('/');await boardReady(page);await expect(page.locator('.hint-card h3')).toHaveText('A part has changed');await page.getByRole('textbox',{name:'Project name'}).fill('Still broken');await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(async()=>(await saved(page)).some(p=>p.name==='Still broken')).toBe(true);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wiresnaps.project.v1')!).name)).toBe('Keep my experiment');
 await page.getByTitle('Save a copy',{exact:true}).click();await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue('Still broken copy');await page.reload();await boardReady(page);await expect(page.locator('.hint-card h3')).toHaveText('A part has changed');await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue('Still broken copy');
 const downloaded=page.waitForEvent('download');await page.getByTitle('Export project',{exact:true}).click();const stream=await(await downloaded).createReadStream();const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));const exported=JSON.parse(Buffer.concat(chunks).toString());expect(exported.schemaVersion).toBe(2);expect(exported.parts[0].damage.failed).toBe(true);
 await page.getByRole('button',{name:'My Projects',exact:true}).first().click();await expect(page.locator('.saved-projects article')).toHaveCount(2);await expect(page.locator('.saved-projects img').first()).toBeVisible();
 page.once('dialog',dialog=>void dialog.accept('Renamed experiment'));await page.locator('.saved-projects article').first().getByRole('button',{name:'rename',exact:true}).click();await expect(page.locator('.saved-projects')).toContainText('Renamed experiment');await page.locator('.saved-projects article').first().getByRole('button',{name:'copy',exact:true}).click();await expect(page.locator('.saved-projects article')).toHaveCount(3);await page.locator('.saved-projects article').first().getByRole('button',{name:'delete',exact:true}).click();await expect(page.locator('.saved-projects article')).toHaveCount(2);
});

test.describe('touch controls',()=>{
 test.use({hasTouch:true});
 test('finger taps operate switches and release momentary buttons',async({page})=>{
  await page.goto('/');await boardReady(page);const p=emptyProject();p.name='Touch controls';p.presentation.quality='low';p.parts=[place('6SCS1',[2,0,4]),place('6SCS2',[6,0,4])];await openDocument(page,p);await top(page);
  const slide=await topPoint(page,[3,.62,4]);await page.touchscreen.tap(slide.x,slide.y);await expect(page.getByRole('button',{name:'○ Close the switch'})).toBeVisible();const button=await topPoint(page,[7,.72,4]);await page.touchscreen.tap(button.x,button.y);await expect(page.getByRole('button',{name:'Hold the button'})).toHaveAttribute('aria-pressed','false');await expect(page.locator('.error-banner')).toHaveCount(0);
 });
});

test('overlapping imports remain editable but cannot run; undo restores the conflict',async({page})=>{
 await page.goto('/');await boardReady(page);const p=emptyProject();p.name='Old overlapping project';p.presentation.quality='low';p.parts=[place('6SCB1',[4,0,4]),place('6SCM1',[5,0,4])];await openDocument(page,p);await expect(page.locator('.construction-warning')).toContainText('overlaps');await expect(page.getByTestId('run')).toBeDisabled();await top(page);const part=await topPoint(page,[6,.7,4]);await page.mouse.click(part.x,part.y);await page.getByTitle('Delete part',{exact:true}).click();await expect(page.getByTestId('run')).toBeEnabled();await page.getByTitle('Undo',{exact:true}).click();await expect(page.getByTestId('run')).toBeDisabled();
});

test('breakage templates open paused with a persistent warning and Guided protection',async({page})=>{
 await page.goto('/');await boardReady(page);await openLesson(page,'break-led','lab');await expect(page.locator('.lab-warning').first()).toContainText('Simulation only — do not try this with real components');await expect(page.getByTestId('run')).toHaveText('▶ Run');await page.getByTestId('run').click();await expect(page.locator('.hint-card h3')).toHaveText('A part has changed',{timeout:30000});await page.getByTestId('run').click();await page.getByRole('button',{name:'Save',exact:true}).click();await page.reload();await boardReady(page);await expect(page.locator('.hint-card h3')).toHaveText('A part has changed');
 await openLesson(page,'break-led','lab');await page.getByRole('button',{name:'♧ Guided',exact:true}).click();await page.getByTestId('run').click();await expect(page.locator('.hint-card h3')).toHaveText('A little too much electricity',{timeout:30000});await expect(page.getByTestId('run')).toHaveText('▶ Run');
});

test('concurrent saves keep a conflict copy and storage errors stay visible',async({page,context})=>{
 await page.goto('/');await boardReady(page);const shared=emptyProject();shared.name='Shared invention';await openDocument(page,shared);await pause(page);await page.getByRole('textbox',{name:'Project name'}).fill('Shared invention');await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(async()=>(await saved(page)).some(p=>p.name==='Shared invention')).toBe(true);
 await page.getByLabel('Graphics quality').selectOption('low');await page.getByRole('button',{name:'Save',exact:true}).click();
 const second=await context.newPage();await second.goto('/');await pause(second);await expect(second.getByRole('textbox',{name:'Project name'})).toHaveValue('Shared invention',{timeout:20000});
 await page.getByRole('textbox',{name:'Project name'}).fill('First tab');await page.getByRole('button',{name:'Save',exact:true}).click();await expect.poll(async()=>(await saved(page)).some(p=>p.name==='First tab')).toBe(true);
 await second.getByRole('textbox',{name:'Project name'}).fill('Second tab');await second.getByRole('button',{name:'Save',exact:true}).click();await expect(second.getByRole('textbox',{name:'Project name'})).toHaveValue('Second tab (conflict copy)');await expect.poll(async()=>(await saved(second)).some(p=>p.name==='First tab')).toBe(true);await second.close();
 await page.evaluate(()=>{const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args:any[]){if(args[1]==='readwrite')throw new DOMException('Storage is full','QuotaExceededError');return original.apply(this,args as any);};});
 await page.getByRole('textbox',{name:'Project name'}).fill('Keep this unsaved work');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.saved-dot')).toContainText('Not saved');await expect(page.locator('.error-banner')).toContainText('QuotaExceededError');
});
