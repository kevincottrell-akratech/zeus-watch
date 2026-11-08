import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {createApp} from '../server/index.mjs';
import './helpers/test-environment.mjs';

const root=resolve(import.meta.dirname,'..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// Use a disposable database and an ephemeral port; never take ownership of Run.
test('both selection paths open a zoomed non-overlapping foreground map and scrollable details', {timeout:60000}, async t=>{
 const chromium=process.env.CHROMIUM_PATH||'/repl/tools/bin/chromium';
 if(!existsSync(chromium)||!existsSync(resolve(root,'client/dist/index.html'))){
  t.skip('Requires Chromium and a built client; run npm run build first.');
  return;
 }
 process.env.NODE_ENV='test';
 process.env.DEMO_PASSWORDS_JSON='';
 process.env.COOKIE_SECURE='0';
 const app=createApp({dbPath:':memory:',password:'isolated-map-drawer-test'});
 const before=JSON.stringify(app.read());
 const profile=mkdtempSync(join(tmpdir(),'zeus-map-drawer-'));
 let chrome,ws;
 try{
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  chrome=spawn(chromium,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{detached:true,stdio:'ignore'});
  for(let i=0;i<80&&!existsSync(join(profile,'DevToolsActivePort'));i++)await pause(100);
  const debugPort=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  const target=await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let sequence=0;
  const pending=new Map(),requests=[],exceptions=[];
  ws.addEventListener('message',event=>{
   const message=JSON.parse(event.data);
   if(message.id&&pending.has(message.id)){
    const request=pending.get(message.id);
    pending.delete(message.id);
    message.error?request.reject(Error(message.error.message)):request.resolve(message.result);
   }
   if(message.method==='Network.requestWillBeSent')requests.push(message.params.request);
   if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails.text);
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++sequence;
   pending.set(id,{resolve,reject});
   ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
   const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));
   return result.result.value;
  };
  const until=async expression=>{
   for(let i=0;i<60;i++){
    if(await evaluate(expression))return;
    await pause(100);
   }
   assert.fail(`Browser condition did not become true: ${expression}`);
  };
  const click=async selector=>{
   if(!await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)){
    const shot=await call('Page.captureScreenshot',{format:'png'});
    writeFileSync(join(tmpdir(),'zeus-map-drawer-failure.png'),Buffer.from(shot.data,'base64'));
    assert.fail(`Missing ${selector}: ${await evaluate("location.href+' '+document.body.innerText.slice(0,1200)")}`);
   }
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
   await pause(100);
   await until(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return hit===el||el.contains(hit)})()`);
   const point=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:b.left+b.width/2,y:b.top+b.height/2}})()`);
   await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
   await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  };
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Page.bringToFront');
  await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:760,deviceScaleFactor:1,mobile:false});
  const login=await fetch(origin+'/api/v1/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'co1',password:'isolated-map-drawer-test'})});
  assert.equal(login.status,200);
  const token=login.headers.get('set-cookie').match(/zeus_session=([^;]+)/)[1];
  await call('Network.setCookie',{name:'zeus_session',value:token,url:origin});
  await call('Page.navigate',{url:origin});
  await until("!!document.querySelector('.sidebar nav')");
  await evaluate("[...document.querySelectorAll('nav button')].find(b=>b.textContent==='Colonies').click()");
  await until("document.querySelectorAll('.leaflet-marker-icon').length===18");
  const habitats=await evaluate("[...document.querySelectorAll('.colony-map-record')].slice(0,2).map(b=>({id:b.dataset.colonyId,name:b.querySelector('strong').textContent}))");
  await evaluate("window.__originalMap=document.querySelector('.colony-map-canvas');true");
  const checks=[];
  for(const width of [1440,1024,390,320]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:width<760?844:760,deviceScaleFactor:1,mobile:width<760});
   await pause(350);
   for(const path of ['marker','list']){
    t.diagnostic(`Checking ${path} selection at ${width}px`);
    await click('.colony-map-reset');
    await pause(350);
    const habitat=habitats[path==='marker'?0:1];
    const selector=path==='marker'?`.leaflet-marker-icon[title*="${habitat.name}"]`:`.colony-map-record[data-colony-id="${habitat.id}"]`;
    await click(selector);
    await until("!!document.querySelector('.colony-selection-details .detail-content')");
    await until("document.querySelector('.selected-park-canvas')?.dataset.selectedPointVisible==='true'");
    assert.equal(await evaluate("document.querySelector('#drawer-title').textContent"),habitat.name);
    assert.ok(requests.some(r=>r.method==='GET'&&r.url.endsWith(`/colonies/${habitat.id}`)));
    assert.equal(await evaluate("document.querySelector('.modal-backdrop').closest('.zw-drawer-layer').parentElement===document.body"),true,'Drawer is outside every map ancestor');
    assert.equal(await evaluate("document.body.style.overflow"),'hidden');
    const expectedLocation=JSON.parse(readFileSync(resolve(root,'client/src/data/fictional-colony-map.json'),'utf8')).locations.find(location=>location.colony_id===habitat.id);
    assert.equal(await evaluate("document.querySelector('.selected-park-map').dataset.colonyId"),habitat.id);
    assert.equal(await evaluate("document.querySelector('.selected-park-map').dataset.parkId"),expectedLocation.park_id);
    assert.equal(await evaluate("document.querySelectorAll('.selected-park-map .leaflet-marker-icon').length"),1);
    const originalZoom=await evaluate("Number(document.querySelector('.selected-park-canvas').dataset.zoom)");
    assert.ok(originalZoom>=12&&originalZoom<=15,'Close-up map fits the selected park');
    await click('.selected-park-map .leaflet-control-zoom-in');
    await until(`Number(document.querySelector('.selected-park-canvas').dataset.zoom)>${originalZoom}`);
    await click('.selected-park-map .leaflet-control-zoom-out');
    await until(`Number(document.querySelector('.selected-park-canvas').dataset.zoom)===${originalZoom}`);
    const inspect=()=>evaluate(`(()=>{
     const drawer=document.querySelector('.colony-selection-dialog'),r=drawer.getBoundingClientRect();
     const details=drawer.querySelector('.colony-selection-details'),d=details.getBoundingClientRect();
     const map=drawer.querySelector('.selected-park-map'),m=map.getBoundingClientRect();
     const attribution=map.querySelector('.leaflet-control-attribution'),a=attribution.getBoundingClientRect();
     const button=drawer.querySelector('[aria-label="Close details"]'),b=button.getBoundingClientRect();
     const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
     const points=[r.left+12,r.left+r.width/2,r.right-12].flatMap(x=>[r.top+16,r.top+r.height/2,r.bottom-16].map(y=>[x,y]));
     return{closeVisible:b.top>=0&&b.bottom<=innerHeight&&(hit===button||button.contains(hit)),drawerAbove:points.every(([x,y])=>document.elementFromPoint(x,y)?.closest('.colony-selection-dialog')===drawer),hasDetails:details.textContent.includes('Known identities')&&details.textContent.includes('Fictional habitat and demo map location only'),scrollable:details.scrollHeight>details.clientHeight,nonOverlapping:m.right<=d.left+1||m.bottom<=d.top+1,stacked:m.bottom<=d.top+1,mapVisible:m.width>100&&m.height>=150&&m.top>=0&&m.bottom<=innerHeight,detailsVisible:d.width>100&&d.height>=100&&d.bottom<=innerHeight,attributionVisible:attribution.textContent.includes('OpenStreetMap')&&a.top>=m.top&&a.bottom<=m.bottom&&a.bottom<=innerHeight,selectedPointVisible:drawer.querySelector('.selected-park-canvas').dataset.selectedPointVisible==='true'};
    })()`);
    assert.ok((await inspect()).drawerAbove);
    await evaluate("document.querySelector('.colony-selection-details').scrollTop=document.querySelector('.colony-selection-details').scrollHeight");
    await pause(100);
    const inspected=await inspect();
    assert.ok(inspected.closeVisible&&inspected.drawerAbove&&inspected.hasDetails,JSON.stringify({width,path,...inspected}));
    assert.ok(inspected.nonOverlapping&&inspected.mapVisible&&inspected.detailsVisible&&inspected.attributionVisible&&inspected.selectedPointVisible,JSON.stringify(inspected));
    assert.equal(inspected.stacked,width<760);
    checks.push({width,path,...inspected});
    if((width===1024&&path==='list')||(width===390&&path==='marker')){
     const shot=await call('Page.captureScreenshot',{format:'png'});
     writeFileSync(join(tmpdir(),`zeus-map-drawer-${width}-${path}.png`),Buffer.from(shot.data,'base64'));
    }
    if(path==='marker')await click('[role="dialog"] [aria-label="Close details"]');
    else{
     await evaluate("document.querySelector('[role=\"dialog\"] [aria-label=\"Close details\"]').focus()");
     await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});
     await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    }
    await until("!document.querySelector('[role=\"dialog\"]')");
    assert.equal(await evaluate("document.body.style.overflow"),'');
    assert.equal(await evaluate("window.__originalMap===document.querySelector('.colony-map-canvas')"),true);
    assert.equal(await evaluate("document.querySelectorAll('.leaflet-marker-icon').length"),18);
    assert.ok(await evaluate("[...document.querySelectorAll('.colony-map-canvas .leaflet-tile')].every(i=>Number(i.src.match(/openstreetmap.org\\/(\\d+)\\//)?.[1])<=11)"),'Closing returns to the county overview, not the close-up');
    assert.ok(await evaluate("document.querySelector('.leaflet-control-attribution').textContent.includes('OpenStreetMap')&&document.querySelector('.colony-map-legend').textContent.includes('Fictional demo location')"));
   }
  }
  assert.ok(checks.some(c=>c.width>760&&c.scrollable)&&checks.some(c=>c.width<760&&c.scrollable));
  assert.equal(JSON.stringify(app.read()),before,'Opening, scrolling and closing must not mutate records');
  assert.equal(requests.filter(r=>r.url.startsWith(origin+'/api/v1/')&&r.method!=='GET').length,0,'Browser sends no record mutations');
  assert.deepEqual(exceptions,[]);
  t.diagnostic(JSON.stringify(checks));
 }finally{
  ws?.close();
  if(chrome)try{process.kill(-chrome.pid,'SIGTERM')}catch{}
  app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  app.db.close();
  rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 }
});
