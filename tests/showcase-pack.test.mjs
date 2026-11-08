import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import './helpers/test-environment.mjs';
import {createApp} from '../server/index.mjs';
import {CAT_IMAGE_MANIFEST} from '../server/cat-images.mjs';
import {authUser,privateAccess} from '../server/domain.mjs';

const root=resolve(import.meta.dirname,'..');
const pack=join(root,'fixtures/synthetic/showcase/cat-image-pack');
const digest=data=>createHash('sha256').update(data).digest('hex');

test('all 26 individually approved showcase originals reproduce their retained manifest',()=>{
 const names=readdirSync(join(pack,'images')).sort();
 assert.deepEqual(names,CAT_IMAGE_MANIFEST.map(entry=>entry.file.slice('images/'.length)).sort());
 assert.equal(CAT_IMAGE_MANIFEST.length,26);
 assert.equal(new Set(CAT_IMAGE_MANIFEST.map(entry=>entry.cat_id)).size,18);
 for(const entry of CAT_IMAGE_MANIFEST){
  const original=readFileSync(join(pack,entry.file));
  assert.equal(digest(original),entry.sha256,entry.file);
  assert.equal(original.readUInt32BE(16),entry.width);
  assert.equal(original.readUInt32BE(20),entry.height);
  assert.equal(entry.synthetic,true);
  assert.equal(entry.provenance_label,'synthetic_demo');
 }
});

test('a fresh clone imports and privately serves all approved views without changing census or replaying inserts',async()=>{
 const temp=mkdtempSync(join(tmpdir(),'zeus-approved-source-'));
 const dbPath=join(temp,'new-demo.sqlite'),zipPath=join(temp,'approved-only.zip');
 const password='isolated-showcase-test-password';
 let app;
 let listening=false;
 try{
  execFileSync('python3',['-c',[
   'import json, pathlib, sys, zipfile',
   'pack=pathlib.Path(sys.argv[1])',
   'entries=json.loads((pack/"manifest.json").read_text())',
   'with zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_STORED) as z:',
   ' for entry in entries: z.write(pack/entry["file"],entry["file"])'
  ].join('\n'),pack,zipPath],{env:{PATH:process.env.PATH}});
  const importPack=()=>execFileSync(process.execPath,[join(root,'scripts/upload-showcase-cat-images.mjs'),zipPath],{
   env:{PATH:process.env.PATH,NODE_ENV:'test',DATABASE_PATH:dbPath},
   encoding:'utf8',stdio:['ignore','pipe','pipe']
  });
  assert.match(importPack(),/26 added, 0 already present, 18 stable cat IDs/);
  // Follow the documented clone order: import to a new DB before first startup.
  app=createApp({dbPath,password});
  const stateBefore=JSON.stringify(app.read());
  assert.equal(app.read().colonies.length,18);
  assert.equal(app.read().cats.length,108);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cat_media').get().n,26);
  assert.equal(JSON.stringify(app.read()),stateBefore);
  assert.match(importPack(),/0 added, 26 already present, 18 stable cat IDs/);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM cat_media').get().n,26);
  assert.equal(JSON.stringify(app.read()),stateBefore);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  listening=true;
  const base=`http://127.0.0.1:${app.server.address().port}/api/v1`;
  async function login(username){
   const response=await fetch(`${base}/session`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
   assert.equal(response.status,200);
   return response.headers.get('set-cookie').split(';')[0];
  }
  const coordinator=await login('co2'),volunteer=await login('v01');
  const volunteerUser=authUser(app.read(),'v01');
  let permittedViews=0,restrictedViews=0;
  for(const entry of CAT_IMAGE_MANIFEST){
   const path=`${base}/cat-images/${entry.cat_id}/${entry.view}`;
   const stored=app.db.prepare('SELECT metadata,original,derivative FROM cat_media WHERE cat_id=? AND view=?').get(entry.cat_id,entry.view);
   assert.equal(digest(stored.original),entry.sha256);
   assert.equal(JSON.parse(stored.metadata).provenance_label,'synthetic_demo');
   const response=await fetch(path,{headers:{cookie:coordinator}});
   assert.equal(response.status,200,entry.file);
   assert.equal(response.headers.get('content-type'),'image/jpeg');
   assert.equal(response.headers.get('cache-control'),'private, no-store');
   assert.equal(digest(Buffer.from(await response.arrayBuffer())),digest(stored.derivative));
   const permitted=privateAccess(app.read(),volunteerUser,entry.primary_colony_id,'evidence_access');
   assert.equal(permitted,entry.primary_colony_id===CAT_IMAGE_MANIFEST[0].primary_colony_id);
   assert.equal((await fetch(path,{headers:{cookie:volunteer}})).status,permitted?200:404);
   if(permitted)permittedViews++;else restrictedViews++;
   assert.equal((await fetch(path)).status,401);
  }
  assert.ok(permittedViews>0&&restrictedViews>0);
  const first=CAT_IMAGE_MANIFEST[0];
  const profile=await (await fetch(`${base}/cats/${first.cat_id}`,{headers:{cookie:coordinator}})).json();
  assert.equal(profile.name,'Callie');
  assert.deepEqual(profile.photo_views.map(view=>view.view),['front','side','rear']);
  assert.equal(JSON.stringify(app.read()),stateBefore);
 }finally{
  if(listening)await new Promise(resolve=>app.server.close(resolve));
  if(app)app.db.close();
  rmSync(temp,{recursive:true,force:true});
 }
});
