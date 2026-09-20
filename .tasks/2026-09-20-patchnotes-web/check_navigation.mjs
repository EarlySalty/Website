// Exercise the real shared navigation against local-only browser responses.
import {chromium} from '/home/nathanael/Documents/claude-config/tools/sichtpruefung/node_modules/playwright-core/index.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const nav = await readFile(new URL('../../dl-brand/nav.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../../dl-brand/nav.css', import.meta.url), 'utf8');
const browser = await chromium.launch({headless:true, executablePath:'/home/nathanael/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',args:['--disable-dev-shm-usage']});
try {
  const context = await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:900}});
  await context.route('http://patch-nav.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if(path==='/brand/nav.js') return route.fulfill({contentType:'text/javascript',body:nav});
    if(path==='/brand/nav.css') return route.fulfill({contentType:'text/css',body:css});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="de"><head><link rel="stylesheet" href="/brand/nav.css"><script src="/brand/nav.js" defer></script></head><body><main>Lokale Navigationsprüfung</main><footer></footer></body></html>'});
  });
  const page = await context.newPage();
  const errors=[];
  page.on('pageerror', e=>errors.push(String(e)));
  for(const path of ['/patch/','/patch/hero/yamato.html','/patchnotes/patch-3/','/patchnotes/']) {
    await page.goto('http://patch-nav.test'+path);
    assert.equal(await page.locator('.brand-floor-indicator b').textContent(),'P');
    await page.locator('.brand-elevator-call').click();
    const link=page.locator('.brand-floor-link[href="/patchnotes/"]');
    assert.equal(await link.getAttribute('aria-current'),path.startsWith('/patch/')?'location':'page');
    await link.focus();
    await link.press('Enter');
    await page.waitForURL('http://patch-nav.test/patchnotes/');
    console.log(path+' -> /patchnotes/: passed');
  }
  await page.goto('http://patch-nav.test/patch/');
  await page.locator('.brand-elevator-call').click();
  const [popup]=await Promise.all([
    context.waitForEvent('page'),
    page.locator('.brand-floor-link[href="/patchnotes/"]').click({modifiers:['Control']})
  ]);
  await popup.bringToFront();
  await popup.waitForURL('http://patch-nav.test/patchnotes/', {waitUntil:'domcontentloaded',timeout:10000});
  assert.equal(page.url(),'http://patch-nav.test/patch/');
  assert.deepEqual(errors,[]);
  console.log('Control-click opens the archive in another tab: passed');
  await context.close();
} finally {await browser.close();}
