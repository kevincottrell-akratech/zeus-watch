import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import * as d from '../server/domain.mjs';
import {importText} from '../server/parsers.mjs';
import {browserSession,chromium} from './helpers/browser.mjs';

process.env.NODE_ENV='test';process.env.DEMO_PASSWORDS_JSON='';process.env.COOKIE_SECURE='0';
const password='isolated-source-time-browser-test';

for(const [width,timezoneId] of [[1280,'America/New_York'],[390,'America/Los_Angeles']]){
 test(`co2 reviews source timestamps without clock substitution at ${width}px in ${timezoneId}`,{timeout:120000},async t=>{
  if(!existsSync(chromium)||!existsSync(resolve(import.meta.dirname,'../client/dist/index.html'))){t.skip('Requires Chromium and built client');return}
  const app=createApp({dbPath:':memory:',password,secure:false});
  const state=app.read(),original=structuredClone(state),co=d.authUser(state,'co2');
  const cases=[
   {source_event_id:'offset',event_type:'note',canonical_text:'Fictional sighting at an explicit source instant.',observed_at:'2026-11-07T08:15:27.321-04:00'},
   {source_event_id:'ambiguous',event_type:'note',canonical_text:'Fictional sighting; timezone not specified.',observed_at:'2026-11-01T01:30:00'},
   {source_event_id:'missing',event_type:'note',canonical_text:'Fictional source has no time; reviewer has a separate supporting log.',observed_at:null},
   {source_event_id:'legacy',event_type:'note',canonical_text:'Fictional older TXT item with an unverified interpretation.',observed_at:'2026-11-07T05:00:00Z'}
  ];
  importText(state,co,{format:'json',text:JSON.stringify(cases),permission_basis:'synthetic_demo'});
  const records=state.incoming_updates.slice(-4);
  records[3].source_system='upload_txt';
  app.db.prepare('UPDATE state SET payload=? WHERE id=1').run(JSON.stringify(state));
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  let b;
  try{
   const origin=`http://127.0.0.1:${app.server.address().port}`;
   b=await browserSession(origin,'co2',password);
   await b.call('Emulation.setTimezoneOverride',{timezoneId});
   await b.call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<760});
   const close=async()=>{await b.evaluate("document.querySelector('[aria-label=\"Close details\"]').click()");await b.until("!document.querySelector('.drawer')")};
   const approveDisabled=()=>b.evaluate("[...document.querySelectorAll('.decision-box button')].find(b=>b.textContent.includes('Approve proposal')).disabled");
   await b.evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='New report').click()");
   await b.until("!!document.querySelector('.report-modal')");
   assert.equal(await b.evaluate("document.querySelector('.report-modal input[type=datetime-local]').value"),'');
   await b.evaluate("document.querySelector('[aria-label=\"Close report\"]').click()");

   await b.openUpdate(records[0].alias);await b.until("!!document.querySelector('#manual-observed-at')");
   assert.equal(await b.evaluate("document.querySelector('#manual-observed-at').value"),'2026-11-07T12:15:27.321');
   assert.equal(await b.evaluate("document.querySelector('[data-source-time=raw]').textContent"),cases[0].observed_at);
   assert.match(await b.evaluate("document.querySelector('.source-timestamp').textContent"),/UTC-04:00/);
   await b.choose('#manual-habitat',state.colonies[0].id);
   await b.field('#review-reason','Reviewed exact source timestamp and numeric offset; identity unresolved.');
   assert.equal(await approveDisabled(),false);
   await b.evaluate("[...document.querySelectorAll('.decision-box button')].find(b=>b.textContent.includes('Approve proposal')).click()");
   await b.until("!document.querySelector('.drawer')");
   assert.equal(app.read().observations.find(o=>o.incoming_update_id===records[0].id).observed_at,'2026-11-07T12:15:27.321Z');
   assert.deepEqual(app.read().incoming_updates.find(r=>r.id===records[0].id).imported_evidence,cases[0]);
   await b.openUpdate(records[0].alias);await b.until("!!document.querySelector('.reviewed-observation-time')");
   assert.match(await b.evaluate("document.querySelector('.reviewed-observation-time').textContent"),/12:15:27.321Z/);
   await close();
   for(const record of records.slice(1)){
    await b.openUpdate(record.alias);await b.until("!!document.querySelector('#manual-observed-at')");
    assert.equal(await b.evaluate("document.querySelector('#manual-observed-at').value"),'');
    assert.equal(await b.evaluate("document.querySelector('#manual-time-confirmed').checked"),false);
    await b.choose('#manual-habitat',state.colonies[0].id);
    await b.field('#review-reason','Reviewer confirms UTC time using supporting fictional observation log.');
    await b.field('#manual-observed-at','2026-11-07T12:30:00.123');
    assert.equal(await approveDisabled(),true);
    await b.evaluate("document.querySelector('#manual-time-confirmed').focus()");
    await b.key(' ','Space',32);
    assert.equal(await approveDisabled(),false);
    await b.field('#manual-observed-at','2026-11-07T12:31:00.123');
    assert.equal(await b.evaluate("document.querySelector('#manual-time-confirmed').checked"),false);
    assert.equal(await approveDisabled(),true);
    const shot=await b.call('Page.captureScreenshot',{format:'png'});
    writeFileSync(`/tmp/zeus-source-time-${width}.png`,Buffer.from(shot.data,'base64'));
    await close();
    assert.deepEqual(app.read().incoming_updates.find(r=>r.id===record.id),record);
   }
   // Actual import UI defaults to unknown, not an assumed UTC timezone.
   await b.evaluate("document.querySelector('.intake-banner button.secondary').click()");
   await b.until("!!document.querySelector('#import-timezone')");
   assert.equal(await b.evaluate("document.querySelector('#import-timezone').value"),'unknown');
   const raw='11/7/26, 5:10 AM - Volunteer 01: Fictional message, unknown timezone.';
   await b.evaluate(`(()=>{const el=document.querySelector('.report-modal textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(raw)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
   await b.evaluate("document.querySelector('.report-modal form button.primary').click()");
   await b.until("!document.querySelector('.report-modal')&&!!document.querySelector('.import-receipt')");
   assert.match(await b.evaluate("document.querySelector('.import-receipt').textContent"),/not approved or added to the census/);
   const unknown=app.read().incoming_updates.at(-1);
   assert.equal(unknown.observed_at,null);
   assert.equal(unknown.imported_evidence.source_timestamp_text,'11/7/26, 5:10 AM');
   assert.equal(unknown.imported_evidence.source_timezone,null);
   await b.openUpdate(unknown.alias);await b.until("!!document.querySelector('#manual-observed-at')");
   assert.equal(await b.evaluate("document.querySelector('#manual-observed-at').value"),'');
   assert.match(await b.evaluate("document.querySelector('.source-timestamp').textContent"),/timezone unresolved/);
   await close();
   await b.evaluate("[...document.querySelectorAll('nav button')].find(b=>b.querySelector('span')?.textContent==='Colonies').click()");
   await b.until("!!document.querySelector('.colony-map-record')");
   await b.evaluate("document.querySelector('.colony-map-record').click()");
   await b.until("!!document.querySelector('[data-privacy-notice]')");
   assert.match(await b.evaluate("document.querySelector('[data-privacy-notice]').textContent"),/Coordinators have role-authorized access/);
   const after=app.read();
   assert.deepEqual(after.incoming_updates.slice(0,24),original.incoming_updates);
   for(const table of ['colonies','cats','assignments','volunteers','coordinators'])assert.deepEqual(after[table],original[table]);
   assert.equal(b.requests.some(r=>r.url.includes('/demo/reset')),false);
   const posted=JSON.parse(b.requests.find(r=>r.method==='POST'&&r.url.endsWith(`/updates/${records[0].id}/review`)).postData);
   assert.equal(posted.observation.observed_at,'2026-11-07T12:15:27.321Z');
   t.diagnostic(`${timezoneId}: exact offset/milliseconds preserved; missing, ambiguous and legacy timestamps start blank and require confirmation; editing clears confirmation; unknown TXT import stays pending; coordinator wording matches existing role access.`);
  }finally{
   await b?.close();app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.db.close();
  }
 });
}
