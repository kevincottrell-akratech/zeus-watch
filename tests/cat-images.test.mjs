import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import {privateAccess} from '../server/domain.mjs';
import {CAT_IMAGE_MANIFEST,catImageViews} from '../server/cat-images.mjs';

process.env.NODE_ENV='test';
process.env.DEMO_PASSWORDS_JSON='';
const password='test-password-not-production';

test('cat detail gallery contains full images without changing other evidence galleries',()=>{
 const css=readFileSync(new URL('../client/src/cat-gallery.css',import.meta.url),'utf8');
 const primary=css.match(/\.cat-primary-photo img\.detail-photo\s*\{([^}]+)\}/)?.[1]||'';
 const additional=css.match(/\.cat-extra-views\.evidence-photos > figure > img\s*\{([^}]+)\}/)?.[1]||'';
 for(const rule of [primary,additional]){
  assert.match(rule,/object-fit:\s*contain/);
  assert.match(rule,/width:\s*100%/);
  assert.match(rule,/background:/);
 }
 assert.match(primary,/max-height:\s*none/);
 assert.match(css,/\.cat-extra-views\.evidence-photos\s*\{[^}]*display:\s*grid/);
 assert.doesNotMatch(css,/object-fit:\s*(?:cover|fill)/);
 assert.ok(readFileSync(new URL('../client/src/main.tsx',import.meta.url),'utf8').includes("import './cat-gallery.css'"));
});

async function setup(){
 const app=createApp({dbPath:':memory:',password});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}/api/v1`;
 async function login(username){
  const response=await fetch(`${base}/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
  assert.equal(response.status,200,`Could not log in as ${username}`);
  const data=await response.json(),cookie=response.headers.get('set-cookie').split(';')[0];
  return {
   user:data.user,
   get:path=>fetch(`${base}${path}`,{headers:{cookie}}),
   call:async(path,body)=>{const result=await fetch(`${base}${path}`,{method:'POST',headers:{'content-type':'application/json',cookie,'x-csrf-token':data.csrfToken,'idempotency-key':randomUUID()},body:JSON.stringify(body)});return {status:result.status,...await result.json()};}
  };
 }
 return {app,base,login,close:async()=>{await new Promise(resolve=>app.server.close(resolve));app.db.close();}};
}

test('Showcase photos map by stable IDs, expose available views, and stay private',async()=>{
 const t=await setup();
 try{
  const coordinator=await t.login('co1');
  assert.equal((await coordinator.call('/demo/reset',{mode:'showcase'})).status,200);
  const before=t.app.read();
  const catsById=new Map(before.cats.map(cat=>[cat.id,cat]));
  const ids=new Set(CAT_IMAGE_MANIFEST.map(entry=>entry.cat_id));
  const expectedNames=new Map(Object.entries({K001:'Callie',K002:'Sterling',K003:'Finn',K004:'Figaro',K007:'Poppy',K014:'Nimbus',K021:'Willow',K028:'Domino',K035:'Mango',K042:'Maple',K043:'Cleo',K050:'Slate',K057:'Biscuit',K064:'Oreo',K071:'Sunny',K078:'Hazel',K079:'Pepper',K086:'Winston'}));
  assert.equal(CAT_IMAGE_MANIFEST.length,26);
  assert.equal(ids.size,18);
  assert.equal(expectedNames.size,18);
  for(const cat of before.cats)assert.equal(cat.name,expectedNames.get(cat.alias)||`Fictional Cat ${cat.alias.slice(1)}`);
  for(const entry of CAT_IMAGE_MANIFEST){
   const cat=catsById.get(entry.cat_id);
   assert.ok(cat,`Unknown stable cat ID ${entry.cat_id}`);
   assert.equal(cat.alias,entry.alias);
   assert.equal(cat.primary_colony_id,entry.primary_colony_id);
  }

  const firstEntry=CAT_IMAGE_MANIFEST.find(entry=>entry.alias==='K001'&&entry.view==='front');
  const firstCat=catsById.get(firstEntry.cat_id);
  assert.deepEqual(catImageViews(firstCat.id).map(image=>image.view),['front','side','rear']);
  assert.deepEqual(catImageViews(catsById.get(CAT_IMAGE_MANIFEST.find(entry=>entry.alias==='K007').cat_id).id).map(image=>image.view),['front']);
  const profile=await coordinator.get(`/cats/${firstCat.id}`).then(response=>response.json());
  assert.equal(profile.photo_url,catImageViews(firstCat.id)[0].url);
  assert.deepEqual(profile.photo_views.map(image=>image.view),['front','side','rear']);
  assert.ok(profile.photo_views.every(image=>image.alt_text&&image.url.startsWith('/api/v1/cat-images/')));
  const sterlingEntry=CAT_IMAGE_MANIFEST.find(entry=>entry.alias==='K002'&&entry.view==='front');
  const sterling=await coordinator.get(`/cats/${sterlingEntry.cat_id}`).then(response=>response.json());
  assert.equal(sterling.alias,'K002');
  assert.deepEqual(sterling.photo_views.map(image=>image.view),['front','side','rear']);
  assert.ok(sterling.photo_views.every(image=>image.url.startsWith(`/api/v1/cat-images/${sterlingEntry.cat_id}/`)));
  assert.equal(sterling.photo_url,catImageViews(sterlingEntry.cat_id)[0].url);

  const derivative=Buffer.from('private synthetic image derivative');
  const metadata=JSON.stringify({cat_id:firstCat.id,view:'front',sha256:firstEntry.sha256,provenance_label:'synthetic_demo'});
  t.app.db.prepare('INSERT INTO cat_media(cat_id,view,metadata,original,derivative) VALUES(?,?,?,?,?)').run(firstCat.id,'front',metadata,Buffer.from('original'),derivative);
  const path=`/cat-images/${firstCat.id}/front`;
  const response=await coordinator.get(path);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'image/jpeg');
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),derivative);

  const deniedUser=await (async()=>{
   for(const username of ['v01','v02','v03','v04','v05']){
    const candidate=await t.login(username);
    if(!privateAccess(before,candidate.user,firstCat.primary_colony_id,'evidence_access'))return candidate;
   }
   return null;
  })();
  assert.ok(deniedUser,'Expected a showcase volunteer without access to this cat colony');
  assert.equal((await deniedUser.get(path)).status,404);
  const admin=await t.login('admin');
  assert.equal((await admin.get(path)).status,403);
  assert.equal((await fetch(`${t.base}${path}`)).status,401);
  assert.equal((await coordinator.get(`/cat-images/${firstCat.id}/side`)).status,404);

  const after=t.app.read();
  assert.deepEqual(after.cats.map(cat=>cat.id),before.cats.map(cat=>cat.id));
  assert.deepEqual(after.observations,before.observations);
  assert.deepEqual(after.colonies.map(({id,count_min,count_max,census_as_of})=>({id,count_min,count_max,census_as_of})),before.colonies.map(({id,count_min,count_max,census_as_of})=>({id,count_min,count_max,census_as_of})));
 }finally{
  await t.close();
 }
});
