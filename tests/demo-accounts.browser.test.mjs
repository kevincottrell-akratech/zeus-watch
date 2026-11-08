import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import * as d from '../server/domain.mjs';
import {browserSession,chromium} from './helpers/browser.mjs';

process.env.NODE_ENV='test';process.env.DEMO_PASSWORDS_JSON='';process.env.COOKIE_SECURE='0';

test('existing demo accounts retain separate coordinator and assigned-volunteer authority',()=>{
 const s=d.seed(),co=d.authUser(s,'co1'),backup=d.authUser(s,'co2'),vol=d.authUser(s,'v01');
 assert.equal(co.role,'coordinator');
 assert.equal(backup.role,'coordinator');
 assert.equal(vol.role,'volunteer');
 assert.doesNotThrow(()=>d.coord(co));
 assert.throws(()=>d.coord(vol),error=>error.status===403);
 const own=s.colonies.find(c=>c.alias==='C01');
 const other=s.colonies.find(c=>c.alias==='C02');
 assert.equal(d.privateAccess(s,vol,own.id,'evidence_access'),true);
 assert.equal(d.privateAccess(s,vol,other.id,'evidence_access'),false);
 assert.equal(d.dashboard(s,vol).updates.length,0);
 assert.equal(d.dashboard(s,co).updates.length,24);
});

test('volunteer browser hides imports, rejects direct import, and keeps unrelated photo evidence private', {timeout:45000},async t=>{
 if(!existsSync(chromium)||!existsSync(resolve(import.meta.dirname,'../client/dist/index.html'))){t.skip('Requires Chromium and built client');return}
 const password='isolated-role-test-only';
 const app=createApp({dbPath:':memory:',password});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 let b;
 try{
  const before=app.read(),vol=d.authUser(before,'v01');
  const own=before.cats.find(c=>c.alias==='K001'),other=before.cats.find(c=>c.alias==='K007');
  assert.notEqual(own.primary_colony_id,other.primary_colony_id);
  b=await browserSession(`http://127.0.0.1:${app.server.address().port}`,'v01',password);
  await b.evaluate("[...document.querySelectorAll('nav button')].find(b=>b.querySelector('span')?.textContent==='Incoming updates').click()");
  await b.until("!!document.querySelector('.intake-banner')");
  assert.equal(await b.evaluate("document.querySelectorAll('.intake-banner button').length"),0);
  assert.equal(await b.evaluate("document.querySelectorAll('.update-row').length"),0);
  const permissions=await b.evaluate(`(async()=>{
   const session=await fetch('/api/v1/session').then(r=>r.json());
   const denied=await fetch('/api/v1/imports',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({format:'json',text:'[]',permission_basis:'synthetic_demo'})});
   const own=await fetch('/api/v1/cats/${own.id}').then(r=>r.json());
   const other=await fetch('/api/v1/cats/${other.id}').then(r=>r.json());
   return {role:session.user.role,importStatus:denied.status,ownViews:own.photo_views?.length||0,otherViews:other.photo_views?.length||0,otherPrimary:other.photo_url};
  })()`);
  assert.equal(permissions.role,'volunteer');
  assert.equal(permissions.importStatus,403);
  assert.equal(permissions.ownViews,3);
  assert.equal(permissions.otherViews,0);
  assert.equal(permissions.otherPrimary,null);
  await b.evaluate("[...document.querySelectorAll('main button')].find(b=>b.textContent.includes('New report')).click()");
  await b.until("!!document.querySelector('.report-modal')");
  await b.evaluate("document.querySelector('.report-modal header button').click()");
  assert.deepEqual(app.read(),before);
  assert.equal(vol.alias,'V01');
  t.diagnostic('v01 browser: report form available; imports hidden and POST denied 403; Habitat 01 photo evidence available, unrelated evidence withheld. No account or record changes.');
 }finally{
  await b?.close();app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));app.db.close();
 }
});
