import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {demoCredentials} from '../server/demo-credentials.mjs';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';
import * as d from '../server/domain.mjs';

// Fresh random test-only values, unrelated to the configured demo Secrets.
const fresh=()=>randomBytes(24).toString('hex');
const coordinator=fresh(),volunteer=fresh(),admin=fresh(),oldCoordinator=fresh();
const roles={NODE_ENV:'production',DEMO_COORDINATOR_PASSWORD:coordinator,DEMO_VOLUNTEER_PASSWORD:volunteer};

test('demo role passwords follow existing roles and leave administrator credentials separate',()=>{
 const config={...roles,DEMO_PASSWORDS_JSON:JSON.stringify({admin,co1:oldCoordinator})};
 const credential=demoCredentials(config);
 const state=d.seed();
 for(const account of state.coordinators)assert.ok(credential(d.authUser(state,account.alias))===coordinator);
 for(const account of state.volunteers)assert.ok(credential(d.authUser(state,account.alias))===volunteer);
 assert.ok(credential(d.authUser(state,'admin'))===admin);
 assert.ok(credential(d.authUser(state,'co1'))!==oldCoordinator);
 assert.equal(credential(null),undefined);
 assert.equal(demoCredentials(roles)(d.authUser(state,'admin')),undefined);
});

test('role configuration fails closed for partial, short, equal, or administrator-reused passwords',()=>{
 for(const bad of [
  {...roles,DEMO_COORDINATOR_PASSWORD:''},
  {...roles,DEMO_VOLUNTEER_PASSWORD:''},
  {...roles,DEMO_VOLUNTEER_PASSWORD:coordinator},
  {...roles,DEMO_VOLUNTEER_PASSWORD:String.fromCharCode(32).repeat(12)},
  {...roles,DEMO_VOLUNTEER_PASSWORD:fresh().slice(0,11)},
  {...roles,DEMO_PASSWORDS_JSON:JSON.stringify({admin:coordinator,co1:oldCoordinator})}
 ])assert.throws(()=>demoCredentials(bad));
});

test('legacy per-account and local credentials still work; configuration errors never quote secret input',()=>{
 const account=demoCredentials({NODE_ENV:'production',DEMO_PASSWORDS_JSON:JSON.stringify({admin,co1:oldCoordinator})});
 assert.ok(account(d.authUser(d.seed(),'co1'))===oldCoordinator);
 const local=demoCredentials({NODE_ENV:'development'},coordinator);
 assert.ok(local(d.authUser(d.seed(),'v01'))===coordinator);
 assert.throws(()=>demoCredentials({NODE_ENV:'production'},coordinator),/distinct/);
 const malformed=fresh();
 assert.throws(()=>demoCredentials({DEMO_PASSWORDS_JSON:malformed}),error=>!error.message.includes(malformed));
});

test('both coordinator accounts and every volunteer sign in with their role password without record changes',async t=>{
 // Exercise every account without relaxing the real per-minute login limit.
 const start=Date.now();let elapsed=0;
 t.mock.method(Date,'now',()=>start+elapsed);
 process.env.NODE_ENV='test';
 process.env.DEMO_PASSWORDS_JSON=JSON.stringify({admin,co1:oldCoordinator});
 process.env.DEMO_COORDINATOR_PASSWORD=coordinator;
 process.env.DEMO_VOLUNTEER_PASSWORD=volunteer;
 const app=createApp({dbPath:':memory:',secure:false});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${app.server.address().port}`,before=d.hash(app.read());
 const signIn=async(username,password)=>{
  elapsed+=61000;
  const response=await fetch(origin+'/api/v1/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 try{
  const state=app.read();
  for(const account of [...state.coordinators,...state.volunteers]){
   const expected=d.authUser(state,account.alias),password=expected.role==='coordinator'?coordinator:volunteer;
   const result=await signIn(account.alias,password);
   assert.equal(result.status,200);
   assert.equal(result.body.user.role,expected.role);
   assert.equal(result.body.user.id,expected.id);
  }
  assert.equal((await signIn('co1',volunteer)).status,401);
  assert.equal((await signIn('v01',coordinator)).status,401);
  assert.equal((await signIn('co1',oldCoordinator)).status,401);
  const administrator=await signIn('admin',admin);
  assert.equal(administrator.status,200);
  assert.equal(administrator.body.user.role,'administrator');
  const volunteerSession=await signIn('v01',volunteer);
  const denied=await fetch(origin+'/api/v1/imports',{method:'POST',headers:{'Content-Type':'application/json',Cookie:volunteerSession.cookie,'X-CSRF-Token':volunteerSession.body.csrfToken,'Idempotency-Key':randomUUID()},body:JSON.stringify({format:'json',text:'[]',permission_basis:'synthetic_demo'})});
  assert.equal(denied.status,403);
  assert.equal(d.hash(app.read()),before);
 }finally{
  app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  app.db.close();
 }
});
