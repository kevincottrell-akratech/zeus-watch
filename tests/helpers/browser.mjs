import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync,mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const chromium=process.env.CHROMIUM_PATH||'/repl/tools/bin/chromium';
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function browserSession(origin,username,password){
 const profile=mkdtempSync(join(tmpdir(),'zeus-review-browser-'));
 const chrome=spawn(chromium,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{detached:true,stdio:'ignore'});
 let ws;
 const close=async()=>{
  ws?.close();
  try{process.kill(-chrome.pid,'SIGTERM')}catch{}
  rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
 };
 try{
  for(let i=0;i<80&&!existsSync(join(profile,'DevToolsActivePort'));i++)await pause(100);
  const port=readFileSync(join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];
  const target=await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json());
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let sequence=0;
  const pending=new Map(),requests=[];
  ws.addEventListener('message',event=>{
   const message=JSON.parse(event.data);
   if(pending.has(message.id)){
    const task=pending.get(message.id);pending.delete(message.id);
    message.error?task.reject(Error(message.error.message)):task.resolve(message.result);
   }
   if(message.method==='Network.requestWillBeSent')requests.push(message.params.request);
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{
   const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
   const result=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   assert.ok(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));
   return result.result.value;
  };
  const until=async expression=>{
   for(let i=0;i<70;i++){if(await evaluate(expression))return;await pause(100)}
   assert.fail(`Browser condition not met: ${expression}`);
  };
  const key=async(key,code=key,windowsVirtualKeyCode=0)=>{
   await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode,...(key==='Enter'?{text:'\r'}:{})});
   await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode});
  };
  const field=async(selector,value)=>{
   await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${selector.includes('reason')?'HTMLTextAreaElement':'HTMLInputElement'}.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  };
  const choose=async(selector,value)=>{
   await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  };
  await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
  await call('Page.bringToFront');await call('Emulation.setFocusEmulationEnabled',{enabled:true});
  await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  const auth=await fetch(origin+'/api/v1/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password})});
  assert.equal(auth.status,200);
  const cookie=auth.headers.get('set-cookie').match(/zeus_session=([^;]+)/)[1];
  await call('Network.setCookie',{name:'zeus_session',value:cookie,url:origin});
  await call('Page.navigate',{url:origin});await until("!!document.querySelector('.sidebar nav')");
  const openUpdate=async alias=>{
   await evaluate("[...document.querySelectorAll('nav button')].find(b=>b.querySelector('span')?.textContent==='Incoming updates').click()");
   await until("!!document.querySelector('.update-row')");
   await evaluate(`[...document.querySelectorAll('.update-row')].find(b=>b.querySelector('strong').textContent===${JSON.stringify(alias)}).click()`);
  };
  return {call,evaluate,until,key,field,choose,openUpdate,requests,close};
 }catch(error){await close();throw error}
}
