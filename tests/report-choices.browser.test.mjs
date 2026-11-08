import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import * as d from '../server/domain.mjs';
import {browserSession,chromium,pause} from './helpers/browser.mjs';

process.env.NODE_ENV='test';process.env.DEMO_PASSWORDS_JSON='';process.env.COOKIE_SECURE='0';
const password='isolated-real-pointer-only';

for(const width of [1280,390]){
 test(`co2 pointer-operated Habitat, Coverage and Cat persist through submitted and imported report review at ${width}px`,{timeout:120000},async t=>{
  if(!existsSync(chromium)||!existsSync(resolve(import.meta.dirname,'../client/dist/index.html'))){t.skip('Requires Chromium and built client');return}
  const app=createApp({dbPath:':memory:',password});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  let b,restricted;
  try{
   const initial=app.read(),c1=initial.colonies.find(c=>c.alias==='C01'),c2=initial.colonies.find(c=>c.alias==='C02');
   const callie=initial.cats.find(c=>c.alias==='K001');
   b=await browserSession(origin,'co2',password);
   await b.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
   const click=async selector=>{
    await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
    await pause(120);
    const p=await b.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,hit:hit===el||el.contains(hit)}})()`);
    assert.equal(p.hit,true,`Pointer target must be unobscured: ${selector}`);
    await b.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    for(const type of ['mousePressed','mouseReleased'])await b.call('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',clickCount:1});
   };
   const button=async(text,root='main')=>{
    await b.evaluate(`(()=>{document.querySelector('[data-pointer-button]')?.removeAttribute('data-pointer-button');const el=[...document.querySelectorAll(${JSON.stringify(root+' button')})].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!el)throw Error('Missing button');el.setAttribute('data-pointer-button','yes')})()`);
    await click('[data-pointer-button]');
   };
   const choose=async(id,value)=>{
    await click(`#${id}-trigger`);
    await b.until(`!!document.querySelector('#${id}-listbox')`);
    assert.equal(await b.evaluate(`document.querySelector('#${id}-trigger').getAttribute('aria-expanded')`),'true');
    await click(`#${id}-listbox [role=option][data-value=${JSON.stringify(value)}]`);
    await b.until(`!document.querySelector('#${id}-listbox')`);
    assert.equal(await b.evaluate(`document.querySelector('#${id}').value`),value);
   };
   const type=async(selector,text)=>{await click(selector);await b.call('Input.insertText',{text})};
   await button('New report');
   await b.until("!!document.querySelector('#report-habitat-trigger')");
   await choose('report-habitat',c1.id);
   const source='Fictional partial sighting at C01: two cats observed; identities uncertain.';
   await type('.report-modal textarea',source);
   await button('Submit for review','.report-modal');
   await b.until("!document.querySelector('.report-modal')");
   const submitted=app.read().incoming_updates.find(r=>r.canonical_text===source);
   assert.ok(submitted);
   assert.equal(submitted.named_colony_id,c1.id);
   await b.openUpdate(submitted.alias);
   await b.until("!!document.querySelector('#manual-habitat-trigger')");
   // Source location is not silently promoted into a confirmed review selection.
   assert.equal(await b.evaluate("document.querySelector('#manual-habitat').value"),'');
   await choose('manual-habitat',c1.id);
   await choose('manual-cat',callie.id);
   await choose('manual-habitat',c2.id);
   assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
   await click('#manual-cat-trigger');
   const ids=await b.evaluate("[...document.querySelectorAll('#manual-cat-listbox [role=option]')].map(o=>o.dataset.value).filter(v=>v&&v!=='new')");
   assert.deepEqual(ids,initial.cats.filter(c=>c.primary_colony_id===c2.id).map(c=>c.id));
   await b.key('Escape','Escape',27);
   assert.equal(await b.evaluate("!!document.querySelector('.drawer')"),true);
   await choose('manual-habitat',c1.id);
   await choose('manual-cat','');

   const review=async(report,count)=>{
    await choose('manual-coverage','partial');
    await type('#manual-min-count',String(count));
    await type('#manual-max-count',String(count));
    await b.field('#manual-observed-at',(report.observed_at||initial.clock).slice(0,16));
    if(await b.evaluate("!!document.querySelector('#manual-time-confirmed')"))await click('#manual-time-confirmed');
    await type('#review-reason','Explicit fictional-source review: partial observation, habitat selected by the reviewer, cat identity unresolved.');
    assert.equal(await b.evaluate("document.querySelector('#manual-habitat').value"),c1.id);
    assert.equal(await b.evaluate("document.querySelector('#manual-coverage').value"),'partial');
    assert.equal(await b.evaluate("document.querySelector('#manual-cat').value"),'');
    await button('Approve proposal','.decision-box');
    await b.until("!document.querySelector('.drawer')");
    const state=app.read(),saved=state.incoming_updates.find(r=>r.id===report.id);
    const observation=state.observations.find(o=>o.incoming_update_id===report.id);
    assert.equal(saved.processing_state,'approved');
    assert.equal(observation.colony_id,c1.id);
    assert.equal(observation.coverage,'partial');
    assert.equal(observation.cat_id,null);
    assert.equal(observation.count_min,count);
    assert.equal(observation.count_max,count);
    assert.equal(observation.source_assertion,report.canonical_text);
    const request=b.requests.findLast(r=>r.method==='POST'&&r.url.endsWith(`/updates/${report.id}/review`));
    const posted=JSON.parse(request.postData);
    assert.equal(posted.observation.colony_id,c1.id);
    assert.equal(posted.observation.coverage,'partial');
    assert.equal(posted.new_cat,undefined);
    await b.openUpdate(report.alias);
    await b.until("!!document.querySelector('.reviewed-observations')");
    assert.equal(await b.evaluate("document.querySelector('.reviewed-observations').textContent.includes('Partial sighting')"),true);
    assert.equal(await b.evaluate("document.querySelector('.reviewed-observations').textContent.includes('Unresolved')"),true);
    assert.equal(await b.evaluate("document.querySelector('.update-original-source blockquote').textContent"),report.canonical_text);
    await click('[aria-label="Close details"]');
   };
   await review(submitted,2);
   await button('Load sample updates','.intake-banner');
   await b.until("document.querySelector('.import-receipt p')?.textContent.includes('15 imported')");
   const imported=app.read().incoming_updates.find(r=>r.source_system==='upload_txt');
   await b.openUpdate(imported.alias);await b.until("!!document.querySelector('#manual-habitat-trigger')");
   await choose('manual-habitat',c1.id);
   // Keyboard activation and cancellation preserve explicit choice semantics.
   await click('#manual-coverage-trigger');
   await b.key('End','End',35);
   await b.key('Escape','Escape',27);
   assert.equal(await b.evaluate("document.querySelector('#manual-coverage').value"),'not_count');
   await choose('manual-cat','');
   await click('#manual-cat-trigger');
   const shot=await b.call('Page.captureScreenshot',{format:'png'});
   writeFileSync(`/tmp/zeus-choice-menu-${width}.png`,Buffer.from(shot.data,'base64'));
   await b.key('Escape','Escape',27);
   await review(imported,3);
   const after=app.read();
   for(const table of ['cats','colonies','assignments','volunteers','coordinators'])assert.deepEqual(after[table],initial[table],table);
   assert.deepEqual(d.census(after,c1.id),d.census(initial,c1.id));
   assert.equal(b.requests.some(r=>r.url.includes('/demo/reset')),false);
   restricted=await browserSession(origin,'v01',password);
   const denied=await restricted.evaluate(`(async()=>{const r=await fetch('/api/v1/updates/${submitted.id}');const body=await r.json();return {status:r.status,hasOptions:!!body.manual_review_options,hasSource:!!body.canonical_text,hasReview:!!body.reviewed_observations}})()`);
   assert.deepEqual(denied,{status:403,hasOptions:false,hasSource:false,hasReview:false});
   assert.deepEqual(app.read(),after);
   t.diagnostic(`Actual pointer clicks at ${width}px: new report and imported update saved selected habitat and partial coverage; cats filtered/reset and unresolved identities preserved; volunteer GET denied 403.`);
  }finally{
   await restricted?.close();await b?.close();app.server.closeAllConnections();
   await new Promise(resolve=>app.server.close(resolve));app.db.close();
  }
 });
}
