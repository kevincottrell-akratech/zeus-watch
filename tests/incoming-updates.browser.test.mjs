import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import * as d from '../server/domain.mjs';
import {parseImport} from '../server/parsers.mjs';
import {browserSession,chromium,pause} from './helpers/browser.mjs';

process.env.NODE_ENV='test';process.env.DEMO_PASSWORDS_JSON='';process.env.COOKIE_SECURE='0';
const password='isolated-incoming-ui-only';
const built=resolve(import.meta.dirname,'../client/dist/index.html');
const sampleFile=resolve(d.FIXTURES,'golden/import/messages.txt');

async function scenario(run,prepare=()=>{}){
 const app=createApp({dbPath:':memory:',password});
 const state=app.read();prepare(state);
 app.db.prepare('UPDATE state SET payload=? WHERE id=1').run(JSON.stringify(state));
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await browserSession(`http://127.0.0.1:${app.server.address().port}`,'co1',password);
  await run(app,browser);
 }finally{
  await browser?.close();app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));app.db.close();
 }
}

async function openInbox(b){
 await b.evaluate("[...document.querySelectorAll('nav button')].find(b=>b.querySelector('span')?.textContent==='Incoming updates').click()");
 await b.until("!!document.querySelector('.intake-banner')");
}

test('Incoming Updates shows clean display labels for all 24 sources without rewriting quotations', {timeout:60000},async t=>{
 if(!existsSync(chromium)||!existsSync(built)){t.skip('Requires Chromium and built client');return}
 await scenario(async(app,b)=>{
  const before=app.read(),expected=d.dashboard(before,d.authUser(before,'co1')).updates;
  await openInbox(b);
  assert.equal(await b.evaluate("document.querySelector('.intake-banner h2').textContent"),'Import updates to review');
  assert.equal(await b.evaluate("document.querySelector('.intake-banner p').textContent"),'Upload a file or load sample updates, then review proposed changes.');
  assert.equal(await b.evaluate("/golden batch|replaying is safe/i.test(document.querySelector('main').textContent)"),false);
  assert.equal(await b.evaluate("/fictional cats/i.test(document.body.textContent)"),true);
  const rows=await b.evaluate("[...document.querySelectorAll('.update-row')].map(el=>({id:el.dataset.updateId,label:el.querySelector('.update-display-label').textContent}))");
  assert.equal(rows.length,24);
  for(const row of rows){
   assert.equal(row.label,expected.find(r=>r.id===row.id).display_text);
   assert.match(row.label,/^Habitat \d{2} update:/);
  }
  const desktop=await b.call('Page.captureScreenshot',{format:'png'});
  writeFileSync('/tmp/zeus-incoming-desktop.png',Buffer.from(desktop.data,'base64'));
  const representatives=expected.filter(r=>['R01','R05','R12','R18'].includes(r.alias));
  assert.equal(representatives.length,4);
  for(const width of [1280,390]){
   await b.call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<760});
   for(const update of representatives){
    await b.openUpdate(update.alias);
    await b.until("!!document.querySelector('.update-original-source')");
    assert.equal(await b.evaluate("document.querySelector('.update-summary-text').textContent"),update.display_text);
    assert.equal(await b.evaluate("document.querySelector('.update-original-source').open"),false);
    assert.equal(await b.evaluate("document.querySelector('.update-original-source blockquote').checkVisibility()"),false);
    await b.evaluate("document.querySelector('.update-original-source summary').focus()");
    await b.key('Enter','Enter',13);
    await b.until("document.querySelector('.update-original-source').open");
    assert.equal(await b.evaluate("document.querySelector('.update-original-source blockquote').textContent"),before.incoming_updates.find(r=>r.id===update.id).canonical_text);
    await b.key('Enter','Enter',13);
    assert.equal(await b.evaluate("document.querySelector('.update-original-source').open"),false);
    if(update.alias==='R18'){
     await b.evaluate("document.querySelector('.drawer').scrollTop=0");
     const detailShot=await b.call('Page.captureScreenshot',{format:'png'});
     writeFileSync(`/tmp/zeus-update-detail-${width}.png`,Buffer.from(detailShot.data,'base64'));
    }
    await b.evaluate("document.querySelector('[aria-label=\"Close details\"]').click()");
   }
  }
  await b.call('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});
  await pause(350);
  assert.equal(await b.evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  const mobile=await b.call('Page.captureScreenshot',{format:'png'});
  writeFileSync('/tmp/zeus-incoming-mobile.png',Buffer.from(mobile.data,'base64'));
  assert.deepEqual(app.read(),before);
 });
 await scenario(async(app,b)=>{
  const before=app.read();await openInbox(b);
  assert.equal(await b.evaluate("document.querySelector('.update-row .update-display-label').textContent"),before.incoming_updates[0].canonical_text);
  assert.equal(await b.evaluate("document.querySelector('.update-row').textContent.includes('Habitat link needs review')"),true);
  await b.openUpdate('R01');await b.until("!!document.querySelector('.update-summary')");
  assert.equal(await b.evaluate("document.querySelector('.update-summary').textContent.includes('Habitat link needs review')"),true);
  assert.equal(await b.evaluate("!!document.querySelector('.update-summary-text')"),false);
  assert.equal(await b.evaluate("document.querySelector('.update-original-source').open"),false);
  await b.evaluate("document.querySelector('.update-original-source summary').click()");
  assert.equal(await b.evaluate("document.querySelector('.update-original-source blockquote').textContent"),before.incoming_updates[0].canonical_text);
  assert.deepEqual(app.read(),before);
 },state=>{state.reviews=state.reviews.filter(r=>r.update_id!==state.incoming_updates[0].id)});
});

test('sample import and actual file upload work in showcase mode without reset or automatic care changes', {timeout:60000},async t=>{
 if(!existsSync(chromium)||!existsSync(built)){t.skip('Requires Chromium and built client');return}
 await scenario(async(app,b)=>{
  const before=app.read();await openInbox(b);
  await b.evaluate("document.querySelector('.intake-banner button.primary').click()");
  await b.until("document.querySelector('.import-receipt p')?.textContent.includes('15 imported')");
  let after=app.read();
  assert.equal(after.mode,'showcase');
  assert.equal(after.incoming_updates.length,39);
  assert.deepEqual(after.incoming_updates.slice(0,24),before.incoming_updates);
  for(const table of ['colonies','cats','observations','issues','actions','reviews'])assert.deepEqual(after[table],before[table],table);
  assert.ok(after.incoming_updates.slice(24).every(r=>r.processing_state==='pending_review'&&r.import_format==='txt'&&r.source_file_hash&&r.imported_evidence));
  const expected=parseImport({format:'txt',text:readFileSync(sampleFile,'utf8'),locale:'en-US',timezone:'UTC',permission_basis:'synthetic_demo'});
  assert.equal(expected.length,15);
  assert.deepEqual(after.incoming_updates.slice(24).map(r=>r.imported_evidence),expected);
  for(const r of after.incoming_updates.slice(24)){
   assert.equal(d.proposal(after,r).adapter,'MANUAL');
   assert.deepEqual(d.proposal(after,r).effects,[]);
  }
  const imported=structuredClone(after.incoming_updates);
  await b.evaluate("document.querySelector('.intake-banner button.primary').click()");
  await b.until("document.querySelector('.import-receipt p')?.textContent.includes('0 imported · 15 duplicates · 0 invalid')");
  assert.deepEqual(app.read().incoming_updates,imported);
  for(const table of ['colonies','cats','observations','issues','actions','reviews'])assert.deepEqual(app.read()[table],before[table],table);
  t.diagnostic('Sample button: first import 15 imported; second import 0 imported, 15 duplicates, 0 invalid. All sample items remain manual/pending; 18 habitats and 108 cats unchanged.');
  await b.evaluate("document.querySelector('.intake-banner button.secondary').click()");
  await b.until("!!document.querySelector('.report-modal input[type=file]')");
  const doc=await b.call('DOM.getDocument');
  const file=await b.call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'.report-modal input[type=file]'});
  await b.call('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[sampleFile]});
  await b.until("!!document.querySelector('.report-modal textarea')?.value.length");
  assert.equal(await b.evaluate("document.querySelector('.report-modal textarea').value"),readFileSync(sampleFile,'utf8'));
  // This exact sample's declared interpretation is UTC; normal uploads default
  // to unknown rather than silently labelling local message time as UTC.
  await b.choose('#import-timezone','UTC');
  await b.evaluate("document.querySelector('.report-modal form button.primary').click()");
  await b.until("!document.querySelector('.report-modal')&&document.querySelector('.import-receipt p')?.textContent.includes('15 duplicates')");
  after=app.read();
  assert.equal(after.incoming_updates.length,39);
  assert.deepEqual(after.incoming_updates.slice(0,24),before.incoming_updates);
  for(const table of ['colonies','cats','observations','issues','actions','reviews'])assert.deepEqual(after[table],before[table],table);
  assert.equal(b.requests.some(r=>r.url.includes('/demo/reset')),false);
 });
});
