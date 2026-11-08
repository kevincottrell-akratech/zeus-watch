import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const setup=JSON.parse(readFileSync(join(root,'package.json'),'utf8')).scripts.setup;

function exerciseSetup(failRoot=false){
 const temp=mkdtempSync(join(tmpdir(),'zeus-build-setup-'));
 try{
  const bin=join(temp,'bin'),log=join(temp,'calls.jsonl');
  mkdirSync(bin);
  // This fake package manager tests the actual setup command without installing
  // anything or inheriting private workspace environment values.
  writeFileSync(join(bin,'npm'),`#!${process.execPath}
const fs=require('node:fs');
const args=process.argv.slice(2);
fs.appendFileSync(process.env.SETUP_LOG,JSON.stringify({args,nodeEnv:process.env.NODE_ENV,omit:process.env.npm_config_omit})+'\\n');
if(!args.includes('ci')||!args.includes('--include=dev'))process.exit(42);
if(process.env.FAIL_ROOT==='1'&&args[0]==='ci')process.exit(17);
`,{mode:0o755});
  const result=spawnSync('/bin/sh',['-c',setup],{
   cwd:root,
   env:{
    PATH:`${bin}:${dirname(process.execPath)}`,
    NODE_ENV:'production',
    npm_config_omit:'dev',
    SETUP_LOG:log,
    FAIL_ROOT:failRoot?'1':'0'
   },
   encoding:'utf8'
  });
  const calls=readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line));
  return {status:result.status,calls};
 }finally{rmSync(temp,{recursive:true,force:true})}
}

test('publishing setup explicitly includes locked build tools despite production dev omission',()=>{
 const {status,calls}=exerciseSetup();
 assert.equal(status,0);
 assert.deepEqual(calls.map(c=>c.args),[
  ['ci','--include=dev'],
  ['--prefix','client','ci','--include=dev']
 ]);
 assert.ok(calls.every(c=>c.nodeEnv==='production'&&c.omit==='dev'));
});

test('publishing setup stops on a failed root install rather than continuing with partial dependencies',()=>{
 const {status,calls}=exerciseSetup(true);
 assert.equal(status,17);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].args,['ci','--include=dev']);
});
