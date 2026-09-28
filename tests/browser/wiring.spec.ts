import {test,expect,type Page} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {emptyProject,place,worldPoint} from '../../src/project';
import {clearWireRoutes,traceWire} from '../../src/wiring';
import {byId} from '../../src/catalogue';
import {lessons} from '../../src/lessons';
import {BASE_Y,LAYER} from '../../src/component-design';
import type {Project,Snapshot,Vec3} from '../../src/types';

async function boot(page:Page){await page.addInitScript(()=>{const Original=window.Worker;(window as any).snapshot=undefined;window.Worker=class extends Original{constructor(...args:ConstructorParameters<typeof Worker>){super(...args);this.addEventListener('message',e=>{if(e.data.type==='snapshot')(window as any).snapshot=e.data.snapshot;});}};});await page.goto('/');await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});}
const snapshot=(page:Page):Promise<Snapshot>=>page.evaluate(()=>(window as any).snapshot);
async function open(page:Page,p:Project){await page.locator('input[type=file]').first().setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue(p.name);await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');}
async function top(page:Page){await page.getByTitle('Top view',{exact:true}).click();await page.waitForTimeout(250);}
async function point(page:Page,p:Vec3){const b=(await page.locator('.board-canvas').boundingBox())!,c=new PerspectiveCamera(34,b.width/b.height,.1,150);c.position.set(6,22,4.51);c.lookAt(6,0,4.5);c.updateMatrixWorld();const v=new Vector3(...p).project(c);return {x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2};}

test('automatic snap wiring and complete cable tracing work with click, hover and undo',async({page},info)=>{
 await boot(page);const p=emptyProject();p.name='Clear connections';p.presentation.quality='low';const a=place('6SCR1',[1,0,1]),b=place('6SCD1',[5,0,1]),battery=place('6SCB5',[4,0,5]);p.parts=[a,b,battery];
 const cable={id:'clear-cable',kind:'wire' as const,from:{part:b.id,terminal:'b'},to:{part:battery.id,terminal:'b'}};p.connections=[cable];await open(page,p);await top(page);
 await page.getByRole('button',{name:'Auto wire between two snaps'}).click();
 for(const at of [[3,BASE_Y+.28,1],[5,BASE_Y+.28,1]] as Vec3[]){const v=await point(page,at);await page.mouse.click(v.x,v.y);}
 await expect(page.locator('.placement-bar')).toHaveCount(0);await expect(page.locator('.construction-warning')).toHaveCount(0);await expect.poll(async()=>(await snapshot(page)).parts.length).toBeGreaterThan(3);
 const route=clearWireRoutes(p).get(cable.id)!,mid=route.points.slice(1,-1).find((v,i,all)=>i>0&&Math.abs(v[2]-all[i-1][2])>.5);
 const prior=route.points[route.points.indexOf(mid!)-1],at=await point(page,mid?[(mid[0]+prior[0])/2,(mid[1]+prior[1])/2,(mid[2]+prior[2])/2]:route.points[1]);
 await page.mouse.move(at.x,at.y);await expect(page.locator('.board-canvas')).toHaveAttribute('data-trace-wires',/clear-cable/);const expected=traceWire(p,cable.id);for(const t of expected.terminals)await expect(page.locator('.board-canvas')).toHaveAttribute('data-trace-terminals',new RegExp(t.part+':'+t.terminal));
 await page.mouse.click(at.x,at.y);await page.mouse.move(20,100);await expect(page.getByTitle('Delete wire',{exact:true})).toBeVisible();await expect(page.locator('.board-canvas')).toHaveAttribute('data-trace-wires',/clear-cable/);
 await info.attach('krona-and-traced-cable.png',{body:await page.locator('.stage').screenshot(),contentType:'image/png'});await page.getByTitle('Delete wire',{exact:true}).click();await expect(page.locator('.board-canvas')).toHaveAttribute('data-trace-wires','');await page.getByTitle('Undo',{exact:true}).click();await expect(page.locator('.error-banner')).toHaveCount(0);
 await page.mouse.click(at.x,at.y);await expect(page.getByTitle('Delete wire',{exact:true})).toBeVisible();const next=emptyProject();next.name='A separate invention';await open(page,next);await expect(page.locator('.wire-trace')).toHaveCount(0);await expect(page.locator('.board-canvas')).toHaveAttribute('data-trace-wires','');
});

test('a saved project with covered component faces can be tidied, operated and undone',async({page},info)=>{
 await boot(page);const p=lessons.find(l=>l.id==='tiny-switch')!.build();p.name='My saved transistor circuit';p.presentation.quality='low';
 const sw=p.parts.find(q=>q.definition==='6SCS2')!,battery=p.parts.find(q=>q.definition==='6SCB1')!,transistor=p.parts.find(q=>q.definition==='6SCQ2')!;
 // Earlier routers accepted raised strips across faces. Keep the original
 // electrical nets, with their old branches attached to those raised strips.
 for(const [part,definition] of [[battery,'6SC03'],[sw,'6SC07']] as const){const strip=place(definition,[...part.position] as Vec3);strip.position[1]=4;p.parts.push(strip);p.connections.push({id:'old-'+part.id,kind:'wire',from:{part:part.id,terminal:'a'},to:{part:strip.id,terminal:'a'}});}
 await open(page,p);await expect(page.getByRole('button',{name:'Tidy wires',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Saved on this device'})).toBeVisible();await page.reload();await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});await top(page);
 await info.attach('saved-covered-faces.png',{body:await page.locator('.stage').screenshot(),contentType:'image/png'});
 // Cleaning up while a connection is half-drawn must discard its old anchor.
 await page.getByRole('button',{name:'Auto wire between two snaps'}).click();const anchor=await point(page,[battery.position[0],BASE_Y+4*LAYER+.28,battery.position[2]]);await page.mouse.click(anchor.x,anchor.y);await expect(page.locator('.placement-bar')).toContainText('Choose the second');
 await page.getByRole('button',{name:'Tidy wires',exact:true}).click();await expect(page.locator('.wiring-notice')).toHaveCount(0);await expect(page.locator('.placement-bar')).toHaveCount(0);await expect(page.locator('.board-canvas')).toHaveAttribute('data-obstructed-wires','0');await expect(page.locator('.construction-warning')).toHaveCount(0);
 await info.attach('saved-tidied-top.png',{body:await page.locator('.stage').screenshot(),contentType:'image/png'});
 const local=worldPoint(sw,[1,0,0]),at=await point(page,[local[0],BASE_Y+.62,local[2]]),current=async()=>Math.abs((await snapshot(page))?.parts.find(q=>q.id===transistor.id)?.current??0);
 await expect.poll(current).toBeLessThan(.00001);await page.mouse.move(at.x,at.y);await page.mouse.down();await expect.poll(current,{timeout:30000}).toBeGreaterThan(.00001);await page.mouse.up();await expect.poll(current,{timeout:30000}).toBeLessThan(.00001);
 await page.getByTitle('Home view',{exact:true}).click();await info.attach('saved-tidied-angled.png',{body:await page.locator('.stage').screenshot(),contentType:'image/png'});
 await page.getByTitle('Undo',{exact:true}).click();await expect(page.getByRole('button',{name:'Tidy wires',exact:true})).toBeVisible();await page.getByTitle('Redo',{exact:true}).click();await expect(page.locator('.wiring-notice')).toHaveCount(0);await expect(page.locator('.error-banner')).toHaveCount(0);
});

for(const id of ['tiny-switch','npn-lantern','pnp-lantern','transistor-team','relay-race','gear-buddies'])test(id+' responds to its actual on-board control',async({page},info)=>{
 test.setTimeout(120000);await boot(page);await page.getByRole('button',{name:/^▱ Projects/}).click();await page.getByTestId('lesson-'+id).click();const p=await(await page.request.get('/projects/'+id+'.json')).json() as Project;
 await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue(p.name);await page.getByLabel('Graphics quality').selectOption('low');await top(page);await expect(page.locator('.board-canvas')).toHaveAttribute('data-obstructed-wires','0');
 const sw=p.parts.find(p=>byId[p.definition].model==='switch')!,local=worldPoint(sw,[1,0,0]),at=await point(page,[local[0],BASE_Y+sw.position[1]*LAYER+.62,local[2]]);
 const target=p.parts.find(q=>q.definition===(id==='tiny-switch'?'6SCQ2':id==='gear-buddies'?'6SCGM':id==='relay-race'?'6SCD2':'6SCD1'))!;
 const reading=async()=>{const o=(await snapshot(page))?.parts.find(q=>q.id===target.id);return o?(byId[target.definition].model==='npn'?Math.abs(o.current):byId[target.definition].model==='motor'?Math.abs(o.current):o.brightness):0;};
 if(id==='tiny-switch'){
  await expect.poll(reading).toBeLessThan(.00001);await page.mouse.move(at.x,at.y);await page.mouse.down();await expect.poll(reading,{timeout:30000}).toBeGreaterThan(.00001);await page.mouse.up();await expect.poll(reading,{timeout:30000}).toBeLessThan(.00001);
 }else{
  await expect.poll(reading,{timeout:30000}).toBeGreaterThan(.001);await page.mouse.click(at.x,at.y);await expect.poll(reading,{timeout:30000}).toBeLessThan(.00001);await page.mouse.click(at.x,at.y);await expect.poll(reading,{timeout:30000}).toBeGreaterThan(.001);
 }
 await expect(page.getByTestId('run')).toHaveText('Ⅱ Pause');await expect(page.locator('.error-banner')).toHaveCount(0);await expect(page.locator('.construction-warning')).toHaveCount(0);await info.attach(id+'.png',{body:await page.locator('.stage').screenshot(),contentType:'image/png'});
});
