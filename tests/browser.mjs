// This is a real-browser acceptance suite, not a substitute DOM or Python emulator.
// Run after npm install and npx playwright install chromium, with npm start running.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {exercises} from '../src/content.js';

const base = 'http://localhost:4173';
await mkdir('artifacts', {recursive:true});
try { const response=await fetch(base);assert.equal(response.status,200); }
catch {throw new Error('Start the local app with npm start in a separate terminal, then rerun npm run test:browser.');}
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:1440,height:1000}, reducedMotion:'reduce',serviceWorkers:'block'});
const page = await context.newPage();
const errors=[], external=[];
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.origin===base || url.protocol==='data:' || url.protocol==='blob:')return route.continue();
  external.push(url.origin+url.pathname);
  return route.abort('internetdisconnected');
});
const report=[];
const passed=message=>{report.push(message);console.log('PASS',message);};
async function go(id){await page.goto(`${base}/#exercise/${id}`);await page.getByRole('heading',{name:exercises.find(e=>e.id===id).title,exact:true}).waitFor();await page.locator('#code').waitFor();}
async function runUI(code,{independent=false}={}){
  await page.locator('#code').fill(code);
  if(independent)await page.locator('#independent').check();
  await page.locator('#code').press('Control+Enter');
  await page.waitForFunction(()=>{const b=document.querySelector('[data-action="run"]');return b&&!b.disabled;},{},{timeout:180000});
  return page.locator('#feedback').innerText();
}
try{
  await page.goto(base);
  await page.getByRole('heading',{name:'A little practice. A clearer next step.'}).waitFor();
  await page.screenshot({path:'artifacts/continue-desktop.png',fullPage:true});
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#main').evaluate(el=>el===document.activeElement),true);
  assert.equal(await page.getByRole('heading',{name:/That page is not/}).count(),0);
  passed('Continue renders; keyboard skip link preserves route.');
  await page.getByRole('link',{name:'Browse all 14 challenges →'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.problem-card').length===14);
  assert.equal(await page.locator('.challenge-group').count(),3);
  assert.match(await page.locator('#result-count').innerText(),/Showing 14 of 14 challenges/);
  await page.locator('.collection-shortcuts').getByRole('link',{name:'10 LeetCode adaptations',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.problem-card').length===10);
  await page.locator('#search').fill('1512');
  assert.equal(await page.locator('.problem-card').count(),1);
  // Clicking the current collection shortcut must clear a narrower search too.
  await page.locator('.collection-shortcuts').getByRole('link',{name:'10 LeetCode adaptations',exact:true}).click();
  assert.equal(await page.locator('.problem-card').count(),10);
  await page.locator('.collection-shortcuts').getByRole('link',{name:'All 14 challenges',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.problem-card').length===14);
  await page.screenshot({path:'artifacts/challenges-desktop.png',fullPage:true});
  passed('The full 14-challenge catalog, 10 LeetCode adaptations, source search and filter reset are discoverable.');


  // First verify a complete learner flow before checking the whole catalog.
  const running=exercises.find(e=>e.id==='running-totals');
  await go(running.id);
  assert.equal(await page.locator('.solution-code').count(),0);
  const draft='result = []\nposition = 0\n# I will update a total here\n';
  await page.locator('#code').fill(draft);
  await page.reload();
  assert.equal(await page.locator('#code').inputValue(),draft);
  await page.locator('[data-prereq]').first().click();
  await page.locator('.return-banner a').click();
  assert.equal(await page.locator('#code').inputValue(),draft);
  await page.getByRole('tab',{name:/Hints & help/}).click();
  await page.getByRole('button',{name:'Open hint 1 of 3'}).click();
  assert.equal(await page.locator('#independent').isDisabled(),true);
  await page.getByRole('button',{name:'Reveal worked solution'}).click();
  await page.locator('.solution-code').waitFor();
  assert.match(await runUI(running.solution),/The checked cases passed/);
  assert.match(await page.locator('.exercise-heading .status').innerText(),/Passed with help/);
  await page.locator('#confusion').fill('Why does the old total need to stay in the expression?');
  await page.getByRole('button',{name:'Copy context for help ↗'}).click();
  const help=await page.locator('#help-message').inputValue();
  assert.match(help,/running-totals/);assert.match(help,/Expected:/);assert.match(help,/Hints opened: 1\./);assert.match(help,/worked solution opened: yes/);
  // The current code can equal a revealed solution; hidden solutions are never injected separately.
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('test denial');}}}));
  await page.getByRole('button',{name:'Copy message',exact:true}).click();
  assert.match(await page.locator('#copy-status').innerText(),/Clipboard access was unavailable/);
  await page.getByRole('button',{name:'Close help context'}).click();
  passed('Real Python flow, autosave/reload, prerequisite return, assistance and clipboard fallback.');

  await page.locator('.attempt-history > summary').click();
  await page.getByRole('button',{name:'Save draft & start a fresh revisit'}).click();
  assert.equal(await page.locator('.solution-code').count(),0);
  assert.match(await runUI(running.solution,{independent:true}),/The checked cases passed/);
  assert.match(await page.locator('.exercise-heading .status').innerText(),/Revisited successfully/);
  await page.getByRole('tab',{name:/Hints & help/}).click();
  await page.getByRole('button',{name:'Open hint 1 of 3'}).click();
  assert.match(await page.locator('.exercise-heading .status').innerText(),/Passed with help/);
  passed('Independent revisit preserves old evidence and later help updates the visible status.');

  await go('copy-list');
  const copy=exercises.find(e=>e.id==='copy-list');
  assert.match(await runUI(copy.solution),/The checked cases passed/);
  assert.match(await page.locator('.exercise-heading .status').innerText(),/assistance unreported/);
  await page.locator('#external-help').check();
  assert.match(await page.locator('.exercise-heading .status').innerText(),/Passed with help/);
  await page.locator('#code').fill('# saved copy draft\nresult = []');
  await page.goto(`${base}/#backup`);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download progress backup',exact:true}).click();
  const download=await downloadPromise;
  await download.saveAs('artifacts/browser-progress-backup.json');
  const before=await page.evaluate(()=>localStorage.getItem('python-fieldnotes.v1'));
  await page.locator('#import-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"version":900}')});
  await page.waitForFunction(()=>document.querySelector('#import-error')?.textContent.includes('not a supported'));
  assert.match(await page.locator('#import-error').innerText(),/not a supported/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('python-fieldnotes.v1')),before);
  await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.locator('#import-file').setInputFiles('artifacts/browser-progress-backup.json');
  await page.getByRole('button',{name:'Restore validated backup'}).click();
  await go('copy-list');
  assert.equal(await page.locator('#code').inputValue(),'# saved copy draft\nresult = []');
  passed('External help, export/import, and invalid-import preservation.');

  await go('saved-length');
  assert.equal(await page.locator('.example').count(),0);
  await page.getByRole('tab',{name:'Step through'}).click();
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Next step →'}).click();
  assert.match(await page.locator('.trace-note').innerText(),/3 < 3 is False/);
  assert.equal(await page.locator('.list-cell.current').count(),0);
  passed('Prediction answer remains hidden and prepared visual reaches the correct stopping state.');

  const catalog=await page.evaluate(async()=>{
    const {exercises}=await import('/src/content.js');
    const {createRunner}=await import('/src/runner.js');
    const runner=createRunner(), report=[];
    for(const e of exercises){const result=await runner.run(e,e.solution);report.push({id:e.id,status:result.status,cases:result.results.length,failures:result.results.filter(t=>!t.passed)});}
    return report;
  });
  assert.equal(catalog.length,exercises.length);
  for(const item of catalog)assert.equal(item.status,'passed',JSON.stringify(item));
  await writeFile('artifacts/browser-catalog.json',JSON.stringify(catalog,null,2));
  passed(`All ${exercises.length} reference solutions pass all ${exercises.reduce((n,e)=>n+e.tests.length,0)} checks through actual browser Python.`);

  const probes=await page.evaluate(async()=>{
    const {exercises}=await import('/src/content.js'), {createRunner}=await import('/src/runner.js');
    const runner=createRunner(), e=id=>exercises.find(e=>e.id===id), run=(id,code)=>runner.run(e(id),code), report={};
    report.offByOne=await run('repair-loop-boundary',e('repair-loop-boundary').starter);
    report.wrongAppend=await run('repair-append',e('repair-append').starter);
    report.replacement=await run('running-totals',e('running-totals').solution.replace('total = total + values[position]','total = values[position]'));
    report.syntax=await run('copy-list','while True\n    pass');
    report.missingStep=await run('repair-loop-step',e('repair-loop-step').starter);
    report.timeout=await run('copy-list','while True:\n    pass');
    report.afterTimeout=await run('copy-list','result = values[:]');
    const pending=run('copy-list','while True:\n    pass');setTimeout(()=>runner.cancel(),500);report.cancelled=await pending;
    report.afterCancel=await run('copy-list','result = list(values)');
    report.fresh=await run('copy-list','result = result');
    report.output=await run('copy-list','print("x" * 9000)');
    return report;
  });
  assert.equal(probes.offByOne.results[0].errorType,'IndexError');
  assert.equal(probes.wrongAppend.status,'error');
  assert.equal(probes.replacement.status,'failed');
  assert.equal(probes.syntax.results[0].errorType,'SyntaxError');
  assert.equal(probes.missingStep.status,'timeout');
  assert.equal(probes.timeout.status,'timeout');assert.equal(probes.afterTimeout.status,'passed');
  assert.equal(probes.cancelled.status,'cancelled');assert.equal(probes.afterCancel.status,'passed');
  assert.equal(probes.fresh.results[0].errorType,'NameError');
  assert.equal(probes.output.results[0].errorType,'OutputLimitExceeded');
  passed('Incorrect programs fail usefully; cancellation, timeout, output limits and fresh-state recovery work.');

  await go('running-totals');
  await runUI(running.solution);
  await page.screenshot({path:'artifacts/exercise-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/exercise-narrow.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.goto(`${base}/#problems`);
  await page.locator('#filter-kind').selectOption('');
  await page.locator('#filter-skill').selectOption('conditions');
  assert.ok(await page.locator('.problem-card').count()>0);
  await page.locator('#search').fill('nonexistent term');
  assert.match(await page.locator('#result-count').innerText(),/Showing 0 of/);
  await page.getByRole('button',{name:'Clear all filters'}).click();
  assert.equal(await page.locator('.problem-card').count(),exercises.length);
  await page.emulateMedia({reducedMotion:'reduce'});
  passed('Desktop/narrow screenshots generated; narrow view has no horizontal page overflow; filters work.');
  assert.deepEqual(external,[],'Core attempted an external network request');
  assert.deepEqual(errors,[],'Unexpected browser errors');
  passed('Cold browser context used only local assets with every external request blocked.');
  await writeFile('artifacts/browser-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),report,external,errors},null,2));
}finally{await context.close();await browser.close();}
