import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../cloudflare/ai-budget.js',import.meta.url),'utf8');
const code=src.replace('export class VelarAiBudget','class VelarAiBudget')+
  '\n;globalThis.VelarAiBudget=VelarAiBudget;';
const ctx={Response,URL,Date,Number,globalThis:null};
ctx.globalThis=ctx;
vm.runInNewContext(code,ctx);
const records=new Map();
const state={storage:{
 get:async key=>records.get(key),
 put:async(key,value)=>{records.set(key,structuredClone(value));}
}};
const budget=new ctx.VelarAiBudget(state);
const url='https://internal';
function post(path,data){
 return budget.fetch(new Request(url+path,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}));
}
let r=await post('/reserve',{limit:2});
assert.equal(r.status,200);
const first=await r.json();
assert.equal(first.used,1);
r=await post('/complete',{day:first.day,ok:true});
assert.equal(r.status,200);
r=await post('/reserve',{limit:2});
assert.equal((await r.json()).used,2);
r=await post('/complete',{day:first.day,ok:false});
assert.equal(r.status,200);
r=await post('/reserve',{limit:2});
assert.equal(r.status,429,'Third reservation must never reach the AI');
const stats=await (await budget.fetch(new Request(url+'/stats'))).json();
assert.equal(stats.used,2);assert.equal(stats.succeeded,1);assert.equal(stats.failed,1);
r=await post('/reserve',{limit:0});assert.equal(r.status,400);
r=await post('/complete',{day:'1900-01-01',ok:true});assert.equal((await r.json()).ignored,true);
assert.equal((await (await budget.fetch(new Request(url+'/stats'))).json()).used,2);
assert.match(src,/storage\.put/);
assert.doesNotMatch(src,/message|CF-Connecting-IP|visitorText|localStorage/,'No questions or IP stored');
console.log('PASS RUN-198: daily reservation cap, counters, failure tracking, no visitor data');
