import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import {browserSession,chromium,pause} from './helpers/browser.mjs';

process.env.NODE_ENV='test';process.env.DEMO_PASSWORDS_JSON='';process.env.COOKIE_SECURE='0';
const password='isolated-review-test-only';
const built=resolve(import.meta.dirname,'../client/dist/index.html');

test('co2 loads embedded options for existing and imported updates and explicitly saves an unresolved-identity review', {timeout:60000},async t=>{
 if(!existsSync(chromium)||!existsSync(built)){t.skip('Requires Chromium and built client');return}
 await scenario(async(app,b)=>{
  const before=app.read(),c1=before.colonies.find(c=>c.alias==='C01'),c2=before.colonies.find(c=>c.alias==='C02');
  const co2=before.coordinators.find(c=>c.alias==='CO2');
  const identity=before.cats.find(c=>c.alias==='K001');
  const runtime=await b.evaluate("(async()=>{const r=await fetch('/api/v1/session');return {contract:r.headers.get('X-Zeus-Review-Contract'),alias:(await r.json()).user.alias}})()");
  assert.deepEqual(runtime,{contract:'manual-options-v1',alias:'CO2'});
  await b.openUpdate('R01');await b.until("!!document.querySelector('#manual-habitat')");
  assert.equal(await b.evaluate("document.querySelector('#manual-habitat').options.length"),19);
  assert.equal(b.requests.filter(r=>r.url.endsWith(`/updates/${before.incoming_updates[0].id}`)).length,1);
  await b.choose('#manual-habitat',c1.id);
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').options.length"),8);
  await b.choose('#manual-cat',identity.id);
  await b.choose('#manual-habitat',c2.id);
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
  assert.equal(await b.evaluate(`[...document.querySelector('#manual-cat').options].some(o=>o.value===${JSON.stringify(identity.id)})`),false);
  await b.evaluate("[...document.querySelectorAll('.decision-box button')].find(b=>b.textContent==='Leave pending and close').click()");
  assert.deepEqual(app.read(),before);
  await b.evaluate("document.querySelector('.intake-banner button.primary').click()");
  await b.until("document.querySelector('.import-receipt p')?.textContent.includes('15 imported')");
  const imported=app.read().incoming_updates.find(r=>r.alias==='IMPORT-25');
  assert.ok(imported);
  await b.openUpdate('IMPORT-25');await b.until("!!document.querySelector('#manual-habitat')");
  assert.equal(await b.evaluate("document.querySelector('#manual-habitat').options.length"),19);
  assert.equal(await b.evaluate("document.querySelector('#manual-habitat').value"),'');
  await b.choose('#manual-habitat',c1.id);
  const shownCats=await b.evaluate("[...document.querySelector('#manual-cat').options].map(o=>o.value).filter(v=>v&&v!=='new')");
  assert.deepEqual(shownCats,before.cats.filter(c=>c.primary_colony_id===c1.id).map(c=>c.id));
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
  await b.field('#manual-observed-at',imported.observed_at.slice(0,16));
  await b.evaluate("document.querySelector('#manual-time-confirmed').click()");
  const reason='Reviewed the supplied fictional C01 report; habitat C01 is explicit, identity remains unresolved.';
  await b.field('#review-reason',reason);
  await b.evaluate("document.querySelector('#manual-habitat').scrollIntoView({block:'center'})");
  const shot=await b.call('Page.captureScreenshot',{format:'png'});
  writeFileSync('/tmp/zeus-co2-import-review.png',Buffer.from(shot.data,'base64'));
  await b.evaluate("[...document.querySelectorAll('.decision-box button')].find(b=>b.textContent.includes('Approve proposal')).click()");
  await b.until("!document.querySelector('.drawer')");
  const after=app.read(),reviewed=after.incoming_updates.find(r=>r.id===imported.id);
  assert.equal(reviewed.processing_state,'approved');
  assert.equal(reviewed.version,2);
  assert.equal(reviewed.canonical_text,imported.canonical_text);
  const observation=after.observations.find(o=>o.incoming_update_id===imported.id);
  assert.equal(observation.colony_id,c1.id);
  assert.equal(observation.cat_id,null);
  assert.equal(observation.coverage,'not_count');
  assert.equal(observation.observed_at,imported.observed_at);
  assert.equal(observation.source_assertion,imported.canonical_text);
  assert.deepEqual(after.incoming_updates.slice(0,24),before.incoming_updates);
  for(const table of ['cats','colonies','issues','actions'])assert.deepEqual(after[table],before[table],table);
  assert.ok(after.audit.some(a=>a.actor_id===co2.id&&a.reason===reason));
  assert.equal(b.requests.some(r=>r.url.includes('/demo/reset')),false);
  t.diagnostic('co2: R01 and IMPORT-25 each received 18 habitats and habitat-specific cats. Explicit imported review saved as approved/version 2 with unresolved cat, no census change and original source preserved.');
 },undefined,'co2');
});

test('co2 fails closed on a failed request or legacy response, then recovers using a complete authorized response', {timeout:60000},async t=>{
 if(!existsSync(chromium)||!existsSync(built)){t.skip('Requires Chromium and built client');return}
 await scenario(async(app,b)=>{
  const before=app.read(),id=before.incoming_updates[0].id;
  const handlers=app.server.listeners('request');
  let fault='unavailable';
  app.server.removeAllListeners('request');
  app.server.on('request',(req,res)=>{
   const target=req.method==='GET'&&req.url===`/api/v1/updates/${id}`;
   if(target&&fault==='unavailable'){
    res.writeHead(503,{'Content-Type':'application/json'});
    res.end(JSON.stringify({error:{code:'TEST_OUTAGE',message:'Test update service unavailable'}}));return;
   }
   if(target&&fault==='legacy'){
    const end=res.end.bind(res);
    res.end=(body,...args)=>{
     if(res.statusCode===200){const payload=JSON.parse(String(body));delete payload.manual_review_options;body=JSON.stringify(payload)}
     return end(body,...args);
    };
   }
   for(const handler of handlers)handler.call(app.server,req,res);
  });
  await b.openUpdate('R01');await b.until("!!document.querySelector('.drawer [role=status]')");
  assert.equal(await b.evaluate("document.querySelector('.drawer').textContent.includes('Test update service unavailable')"),true);
  assert.equal(await b.evaluate("!!document.querySelector('#manual-habitat')"),false);
  await b.evaluate("document.querySelector('[aria-label=\"Close details\"]').click()");
  fault='legacy';
  await b.openUpdate('R01');await b.until("!!document.querySelector('.drawer [role=status]')");
  assert.equal(await b.evaluate("document.querySelector('.drawer').textContent.includes('server returned incomplete manual-review options')"),true);
  assert.equal(await b.evaluate("!!document.querySelector('.manual-review')"),false);
  assert.equal(await b.evaluate("document.querySelector('.drawer').textContent.includes('Review options are not available yet')"),false);
  await b.evaluate("document.querySelector('[aria-label=\"Close details\"]').click()");
  fault='';
  await b.openUpdate('R01');await b.until("!!document.querySelector('#manual-habitat')");
  assert.equal(await b.evaluate("document.querySelector('#manual-habitat').options.length"),19);
  assert.equal(await b.evaluate("document.querySelector('#manual-habitat').value"),'');
  assert.deepEqual(app.read(),before);
  t.diagnostic('co2: HTTP 503 and a 200 response missing manual_review_options both prevented review; reopening after recovery loaded options without selecting an identity or changing records.');
 },undefined,'co2');
});

async function scenario(run,prepare=()=>{},username){
 const app=createApp({dbPath:':memory:',password});
 const state=app.read();prepare(state);
 app.db.prepare('UPDATE state SET payload=? WHERE id=1').run(JSON.stringify(state));
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  browser=await browserSession(origin,username||state.testUser||'co1',password);
  await run(app,browser);
 }finally{
  await browser?.close();app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));app.db.close();
 }
}

test('manual review in browser explicitly links existing records, resets habitat-dependent choices, and preserves evidence', {timeout:60000},async t=>{
 if(!existsSync(chromium)||!existsSync(built)){t.skip('Requires Chromium and built client');return}
 await scenario(async(app,b)=>{
  const before=app.read(),entry=before.incoming_updates.find(r=>r.alias==='R01'),cat=before.cats.find(c=>c.alias==='K001');
  const other=before.colonies.find(c=>c.id!==cat.primary_colony_id);
  await b.openUpdate('R01');await b.until("!!document.querySelector('#manual-habitat')");
  assert.equal(await b.evaluate("document.querySelector('#manual-habitat').options.length"),19);
  assert.equal(await b.evaluate("document.querySelector('#manual-habitat').value"),'');
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').disabled"),true);
  // Native keyboard interaction confirms the menu is not merely populated in DOM.
  await b.evaluate("document.querySelector('#manual-habitat-trigger').focus()");
  await b.key('ArrowDown','ArrowDown',40);
  await b.key('Enter','Enter',13);
  await b.until("document.querySelector('#manual-habitat').value!==''");
  await b.choose('#manual-habitat',cat.primary_colony_id);
  await b.until("document.querySelector('#manual-cat').options.length===8");
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
  await b.choose('#manual-cat',cat.id);
  await b.choose('#manual-habitat',other.id);
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
  assert.equal(await b.evaluate(`[...document.querySelector('#manual-cat').options].some(o=>o.value===${JSON.stringify(cat.id)})`),false);
  await b.choose('#manual-habitat',cat.primary_colony_id);
  await b.choose('#manual-cat','new');
  await b.evaluate("document.querySelector('.manual-record-choices input[type=checkbox]').click()");
  await b.choose('#manual-habitat',other.id);
  await b.choose('#manual-habitat',cat.primary_colony_id);
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
  await b.choose('#manual-cat',cat.id);
  await b.field('#review-reason','Explicitly reviewed fictional evidence and selected the existing habitat and Callie.');
  assert.equal(await b.evaluate("document.querySelector('#manual-observed-at').value"),'');
  await b.field('#manual-observed-at',before.clock.slice(0,16));
  await b.evaluate("document.querySelector('#manual-time-confirmed').click()");
  for(const width of [1280,390]){
   await b.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
   await pause(350);
   await b.evaluate("document.querySelector('#manual-habitat').scrollIntoView({block:'center'})");
   assert.equal(await b.evaluate("document.querySelector('.drawer').scrollWidth<=document.querySelector('.drawer').clientWidth"),true);
  }
  const shot=await b.call('Page.captureScreenshot',{format:'png'});
  writeFileSync('/tmp/zeus-manual-review-options.png',Buffer.from(shot.data,'base64'));
  assert.equal(app.read().incoming_updates.find(r=>r.id===entry.id).processing_state,'pending_review');
  await b.evaluate("[...document.querySelectorAll('.decision-box button')].find(b=>b.textContent.includes('Approve proposal')).click()");
  await b.until("!document.querySelector('.drawer')");
  const after=app.read(),observation=after.observations.find(o=>o.incoming_update_id===entry.id);
  assert.equal(after.incoming_updates.find(r=>r.id===entry.id).processing_state,'approved');
  assert.equal(observation.cat_id,cat.id);
  assert.equal(observation.colony_id,cat.primary_colony_id);
  assert.equal(observation.source_assertion,entry.canonical_text);
  assert.deepEqual(after.cats,before.cats);
  assert.deepEqual(after.colonies,before.colonies);
  assert.deepEqual(after.issues,before.issues);
 });
});

test('browser explains empty and restricted review choices and leaves reports unchanged', {timeout:60000},async t=>{
 if(!existsSync(chromium)||!existsSync(built)){t.skip('Requires Chromium and built client');return}
 await scenario(async(app,b)=>{
  const before=JSON.stringify(app.read());
  await b.openUpdate('R01');await b.until("!!document.querySelector('#manual-habitat')");
  await b.choose('#manual-habitat',app.read().colonies[0].id);
  assert.ok(await b.evaluate("document.querySelector('.manual-record-choices').textContent.includes('No cat records are available for this habitat')"));
  assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
  await b.evaluate("[...document.querySelectorAll('.decision-box button')].find(b=>b.textContent==='Leave pending and close').click()");
  await b.until("!document.querySelector('.drawer')");
  assert.equal(JSON.stringify(app.read()),before);
 },state=>{state.cats=[];state.memberships=[]});
 await scenario(async(app,b)=>{
  const before=JSON.stringify(app.read());
  await b.openUpdate('R01');
  await b.until("!!document.querySelector('.drawer [role=status]')");
  assert.ok(await b.evaluate("document.querySelector('.drawer').textContent.includes('Coordinator access required')&&document.querySelector('.drawer').textContent.includes('authorized coordinator')"));
  assert.equal(await b.evaluate("!!document.querySelector('#manual-habitat')"),false);
  await b.evaluate("document.querySelector('[aria-label=\"Close details\"]').click()");
  assert.equal(JSON.stringify(app.read()),before);
 },state=>{state.testUser='v01';state.incoming_updates[0].submitted_by=state.volunteers[0].id});
});
