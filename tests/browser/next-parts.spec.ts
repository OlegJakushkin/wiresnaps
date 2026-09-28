import {test,expect,type Page} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import {emptyProject} from '../../src/project';

async function point(page:Page,x:number,z:number){const b=(await page.locator('.board-canvas').boundingBox())!,c=new PerspectiveCamera(34,b.width/b.height,.1,150);c.position.set(6,22,4.51);c.lookAt(6,0,4.5);c.updateMatrixWorld();const v=new Vector3(x,0,z).project(c);return {x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2};}
test('next-part ideas follow library selection and placement, explain why, and choose the next part',async({page},info)=>{
 await page.goto('/');await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});
 const p=emptyProject();p.name='Ideas while building';p.presentation.quality='low';await page.locator('input[type=file]').first().setInputFiles({name:'ideas.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))});await expect(page.getByRole('textbox',{name:'Project name'})).toHaveValue(p.name);
 const panel=page.getByRole('region',{name:'Suggested next parts'});await expect(panel).toHaveCount(0);
 await page.locator('.part-card').filter({hasText:'Red LED'}).click();await expect(panel).toHaveAttribute('data-for','6SCD1');await expect(panel.locator('.next-part-pick')).toHaveCount(4);
 const resistor=panel.getByRole('button',{name:'Choose 100 Ω resistor',exact:true});await resistor.hover();await expect(panel.getByRole('tooltip')).toContainText('keep the current small');await resistor.focus();await expect(resistor).toHaveAttribute('aria-describedby',/next-part-why/);await page.keyboard.press('Escape');await expect(panel.getByRole('tooltip')).toHaveCount(0);
 await page.getByTitle('Top view',{exact:true}).click();const at=await point(page,5,4);await page.mouse.click(at.x,at.y);await expect(page.locator('.part-inspector h3')).toContainText('Red LED');await expect(page.locator('.placement-bar')).toHaveCount(0);await expect(panel).toHaveAttribute('data-for','6SCD1');
 await info.attach('next-part-ideas.png',{body:await page.screenshot(),contentType:'image/png'});
 await panel.getByRole('button',{name:'Choose 100 Ω resistor',exact:true}).click();await expect(panel).toHaveAttribute('data-for','6SCR1');await expect(page.locator('.placement-bar')).toBeVisible();await expect(page.locator('.part-card.chosen')).toContainText('100 Ω resistor');await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);
 // Re-selecting a placed part also brings its suggestions back.
 await page.mouse.click(at.x,at.y);await expect(panel).toHaveAttribute('data-for','6SCD1');await expect(page.locator('.error-banner')).toHaveCount(0);
});

test.describe('touch suggestions',()=>{
 test.use({hasTouch:true,viewport:{width:390,height:844}});
 test('a finger tap can reveal a reason without starting placement of that candidate',async({page},info)=>{
  await page.goto('/');await expect(page.locator('.board-canvas')).toHaveAttribute('data-shaders','ready',{timeout:60000});await page.locator('.part-card').filter({hasText:'Red LED'}).tap();
  const panel=page.getByRole('region',{name:'Suggested next parts'});await expect(panel).toHaveAttribute('data-for','6SCD1');
  for(const why of await panel.locator('.next-part-why').all()){await why.tap();await expect(panel.getByRole('tooltip')).toBeVisible();await expect(panel).toHaveAttribute('data-for','6SCD1');}
  const b=(await panel.boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(390);await info.attach('next-part-touch.png',{body:await page.screenshot(),contentType:'image/png'});
  await panel.locator('.next-part-pick').first().tap();await expect(panel).not.toHaveAttribute('data-for','6SCD1');await expect(page.locator('.placement-bar')).toBeVisible();await expect(page.locator('.error-banner')).toHaveCount(0);
 });
});
