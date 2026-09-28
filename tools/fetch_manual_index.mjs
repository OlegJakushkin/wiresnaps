// The manufacturer site requires JavaScript. Use its normal browser navigation.
// Run only in the Playwright Docker container. PDFs remain in the research cache.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://elenco.com/new-manuals/', {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('table tr td', {timeout:45000});
  await mkdir('.cache/catalogue', {recursive:true});
  await writeFile('.cache/catalogue/index.html', await page.content());
  await writeFile('.cache/catalogue/browser-cookies.json', JSON.stringify(await context.cookies()));
  console.log('Manufacturer manual index saved; rows:', await page.locator('table tr').count());
} finally { await browser.close(); }

