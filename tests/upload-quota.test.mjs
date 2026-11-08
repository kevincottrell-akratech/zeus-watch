import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import {FIXTURES,hash} from '../server/domain.mjs';

process.env.NODE_ENV='test';
process.env.DEMO_PASSWORDS_JSON='';
process.env.COOKIE_SECURE='0';
const password='isolated-upload-quota-test-only';
const MAX_FILES=250,MAX_BYTES=500*1024*1024;
const original=readFileSync(`${FIXTURES}/golden/images/P01.png`);
const upload={filename:'fictional-quota-test.png',base64:original.toString('base64'),permission_basis:'synthetic_demo'};

async function scenario(run){
 const app=createApp({dbPath:':memory:',password,secure:false});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${app.server.address().port}`;
 async function login(username){
  const response=await fetch(`${origin}/api/v1/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  assert.equal(response.status,200);
  const session=await response.json();
  const headers={'Content-Type':'application/json',Cookie:response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':session.csrfToken};
  return async(body=upload,key=randomUUID(),overrides={})=>{
   const r=await fetch(`${origin}/api/v1/files`,{method:'POST',headers:{...headers,'Idempotency-Key':key,...overrides},body:JSON.stringify(body)});
   return {status:r.status,body:await r.json()};
  };
 }
 const quota=()=>({...app.db.prepare('SELECT COUNT(*) AS files,COALESCE(SUM(length(original)),0) AS bytes FROM media').get()});
 const receipts=()=>app.db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n;
 const seedFiles=count=>{
  const insert=app.db.prepare('INSERT INTO media VALUES(?,?,?,?,?)');
  for(let i=0;i<count;i++)insert.run(`synthetic-quota-fixture-${i}`,'isolated-fixture','{}',Buffer.from([0]),Buffer.alloc(0));
 };
 try{await run({app,login,quota,receipts,seedFiles})}
 finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.db.close()}
}

test('concurrent uploads at the file limit cannot consume the same last slot',async()=>{
 await scenario(async({app,login,quota,receipts,seedFiles})=>{
  seedFiles(MAX_FILES-1);
  const before=app.read(),send=await login('co2');
  const responses=await Promise.all([send(),send()]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,413]);
  assert.equal(responses.find(r=>r.status===413).body.error.code,'STORAGE_LIMIT');
  assert.deepEqual(quota(),{files:MAX_FILES,bytes:MAX_FILES-1+original.length});
  assert.equal(receipts(),1);
  assert.equal(app.read().audit.length,before.audit.length+1);
  for(const table of ['cats','colonies','incoming_updates','observations','reviews'])assert.deepEqual(app.read()[table],before[table]);
 });
});

test('concurrent uploads at the byte limit include incoming bytes; accepted replay succeeds when full',async()=>{
 await scenario(async({app,login,quota,receipts})=>{
  // Real SQLite BLOB lengths, not mocked quota results or reduced production limits.
  // zeroblob avoids allocating a second 500 MiB JavaScript input buffer.
  app.db.prepare("INSERT INTO media VALUES('synthetic-byte-quota','isolated-fixture','{}',zeroblob(?),X'')").run(MAX_BYTES-original.length);
  const send=await login('co2'),keys=[randomUUID(),randomUUID()];
  const results=await Promise.all(keys.map(key=>send(upload,key)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,413]);
  assert.equal(results.find(r=>r.status===413).body.error.code,'STORAGE_LIMIT');
  assert.deepEqual(quota(),{files:2,bytes:MAX_BYTES});
  assert.equal(receipts(),1);
  const winner=results.findIndex(r=>r.status===200),accepted=results[winner].body;
  const before=hash(app.read()),stored=app.db.prepare('SELECT id,metadata FROM media ORDER BY id').all();
  const replay=await send(upload,keys[winner]);
  assert.equal(replay.status,200);
  for(const field of ['id','url','sha256','bytes','filename'])assert.equal(replay.body[field],accepted[field]);
  assert.deepEqual(quota(),{files:2,bytes:MAX_BYTES});
  assert.equal(receipts(),1);
  assert.equal(hash(app.read()),before);
  assert.deepEqual(app.db.prepare('SELECT id,metadata FROM media ORDER BY id').all(),stored);
  const conflict=await send({...upload,filename:'different.png'},keys[winner]);
  assert.equal(conflict.status,409);
  assert.equal(conflict.body.error.code,'IDEMPOTENCY_CONFLICT');
  const newFile=await send();
  assert.equal(newFile.status,413);
  assert.equal(newFile.body.error.code,'STORAGE_LIMIT');
  assert.equal(hash(app.read()),before);
  assert.equal(receipts(),1);
 });
});

test('an incoming file larger than remaining capacity is rejected even before the quota is full',async()=>{
 await scenario(async({app,login,quota,receipts})=>{
  app.db.prepare("INSERT INTO media VALUES('synthetic-byte-quota','isolated-fixture','{}',zeroblob(?),X'')").run(MAX_BYTES-original.length+1);
  const before=hash(app.read()),used=quota(),send=await login('co2');
  assert.ok(used.bytes<MAX_BYTES);
  const rejected=await send();
  assert.equal(rejected.status,413);
  assert.equal(rejected.body.error.code,'STORAGE_LIMIT');
  assert.deepEqual(quota(),used);
  assert.equal(receipts(),0);
  assert.equal(hash(app.read()),before);
 });
});

test('an image exceeding the existing 10 MiB per-file limit leaves no upload or receipt',async()=>{
 await scenario(async({app,login,quota,receipts})=>{
  const before=hash(app.read()),send=await login('co2');
  const rejected=await send({...upload,base64:Buffer.alloc(10*1024*1024+1).toString('base64')});
  assert.equal(rejected.status,400);
  assert.equal(rejected.body.error.code,'IMAGE_SIZE');
  assert.deepEqual(quota(),{files:0,bytes:0});
  assert.equal(receipts(),0);
  assert.equal(hash(app.read()),before);
 });
});

test('concurrent retries at the last file slot share one receipt and preserve authorization',async()=>{
 await scenario(async({app,login,quota,receipts,seedFiles})=>{
  seedFiles(MAX_FILES-1);
  const send=await login('co2'),key=randomUUID(),before=app.read();
  const results=await Promise.all([send(upload,key),send(upload,key)]);
  assert.deepEqual(results.map(r=>r.status),[200,200]);
  assert.equal(results[0].body.id,results[1].body.id);
  assert.equal(quota().files,MAX_FILES);
  assert.equal(receipts(),1);
  assert.equal(app.read().audit.length,before.audit.length+1);
  const fullState=hash(app.read()),admin=await login('admin'),volunteer=await login('v05');
  assert.equal((await admin(upload,key)).status,403);
  assert.equal((await send(upload,key,{'X-CSRF-Token':'invalid-test-csrf'})).status,403);
  // A different user cannot reuse a coordinator's receipt, even with the same key.
  assert.equal((await volunteer(upload,key)).status,413);
  assert.equal(hash(app.read()),fullState);
  assert.equal(receipts(),1);
 });
});
