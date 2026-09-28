import {test,expect} from '@playwright/test';

test('static feature tour is local, navigable and readable on narrow screens',async({page,request})=>{
 const outside:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('data:'))outside.push(r.url());});
 const local=new Set<string>();
 for(const name of ['index','build','code','experiments','projects','inside','rights','review']){
  await page.goto('/demo/'+name+'.html');await expect(page.locator('h1')).toBeVisible();
  expect(await page.locator('script').count()).toBe(0);
  await expect(page.locator('nav[aria-label="Feature guide"] [aria-current=page]')).toHaveCount(1);
  for(const href of await page.locator('a[href],img[src],link[href]').evaluateAll(nodes=>nodes.map(n=>(n as HTMLAnchorElement).href||(n as HTMLImageElement).src))){
   if(href.startsWith('http://127.0.0.1:4173/')&&!href.includes('wiresnaps-source.tar.gz'))local.add(href.split('#')[0]);
  }
 }
 for(const href of local)expect((await request.get(href)).ok(),href).toBe(true);
 await page.setViewportSize({width:390,height:844});await page.goto('/demo/projects.html');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(outside).toEqual([]);
});

test('all 29 demo links name shipped projects and open a working controller copy',async({page,context,request})=>{
 await page.goto('/demo/projects.html');
 const ids=await page.locator('a.demo-launch').evaluateAll(nodes=>nodes.map(n=>new URL((n as HTMLAnchorElement).href).searchParams.get('demo')));
 const manifest=await(await request.get('/projects/index.json')).json();
 expect([...new Set(ids)].sort()).toEqual(manifest.templates.map((t:{id:string})=>t.id).sort());
 const opened=context.waitForEvent('page');await page.getByRole('link',{name:'Traffic-Light Dance'}).click();const app=await opened;
 await app.locator('.board-canvas[data-shaders=ready]').waitFor({timeout:60000});
 await expect(app.locator('.project-bar input')).toHaveValue('Traffic-Light Dance');
 await expect(app.getByTestId('run')).toHaveText(/Pause/);
 await app.getByRole('button',{name:'▧ Code',exact:true}).click();
 await expect(app.locator('.block-toolbar small')).toContainText('AVR controller');
 await app.getByRole('button',{name:/Send to controller/}).click();await expect(app.locator('.block-help')).toContainText('Ready!');
 await app.close();
});

test('demo links preserve existing projects; breakage copies stay paused',async({page})=>{
 await page.goto('/?demo=battery-team#build');await page.locator('.board-canvas[data-shaders=ready]').waitFor({timeout:60000});
 await expect(page.getByTestId('run')).toHaveText(/Pause/);await page.getByTestId('run').click();
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.saved-dot')).toHaveText('Saved on this device');
 await page.goto('/?demo=break-npn#build');await page.locator('.board-canvas[data-shaders=ready]').waitFor({timeout:60000});
 await expect(page.locator('.project-bar input')).toHaveValue('One Load Too Many');
 await expect(page.getByTestId('run')).toHaveText(/Run/);await expect(page.locator('.mode-control')).toContainText('Experiment');
 await expect(page.getByText(/Simulation only — do not try this with real components/)).toBeVisible();
 await page.getByRole('button',{name:'My Projects',exact:true}).click();
 await expect(page.locator('.saved-projects')).toContainText('Battery Team');
 await expect(page.locator('.saved-projects')).toContainText('One Load Too Many');
});

test('reference labels show independence and invalid demos recover without loading arbitrary content',async({page})=>{
 await page.goto('/?demo=not-a-template#build');await page.locator('.board-canvas[data-shaders=ready]').waitFor({timeout:60000});
 await expect(page.getByRole('alert')).toContainText('This demo is not available');
 await page.getByLabel('Real-life labels').selectOption('snap');await expect(page.getByTestId('brand-notice')).toContainText('not endorsed');
 await page.getByLabel('Real-life labels').selectOption('znatok');await expect(page.getByTestId('brand-notice')).toContainText('provisional');
 await page.getByLabel('Real-life labels').selectOption('none');await expect(page.getByTestId('brand-notice')).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Feature tour',exact:true})).toHaveAttribute('href','./demo/');
});
