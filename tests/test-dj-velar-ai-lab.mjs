import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workerSrc=read('cloudflare/dj-velar-owner-lab.js');
const labSrc=read('studio/ai-lab.js');
const studioSrc=read('studio/landing-editor.js');
const studioHTML=read('studio/index.html');
const sw=read('sw.js');
const workerScript=workerSrc.replace('export default {','const worker = {')+'\n;globalThis.worker = worker;';
new vm.Script(workerScript);
new vm.Script(labSrc);
assert.match(studioSrc,/window\.VELAR_AI_LAB\.attach\(parent\)/);
assert.match(studioHTML,/ai-lab\.js\?v=1/);
assert.match(sw,/studio\/ai-lab\.js\?v=1/);
assert.match(sw,/reports191-ai192/);
assert.doesNotMatch(read('index.html'),/ai-lab\.js|dj-velar-owner-lab/,'Visitor page must load no new AI scripts');
assert.doesNotMatch(labSrc,/localStorage|sessionStorage|firebase|Firestore|setItem/,'Owner tokens and questions are never saved');
assert.match(labSrc,/Bearer /);
assert.match(labSrc,/v1\/owner-test/);
assert.match(workerSrc,/VELAR_OWNER_TEST_TOKEN/);
assert.match(workerSrc,/@cf\/meta\/llama-3\.1-8b-instruct-fp8/);
const context={Request,Response,URL,globalThis:null};
context.globalThis=context;
vm.runInNewContext(workerScript,context);
const ai={run:async(model,args)=>{assert.equal(model,'@cf/meta/llama-3.1-8b-instruct-fp8');assert.ok(args.max_tokens<=260);return {response:'Попробуйте музыку для спокойного вечера.'};}};
const env={AI:ai,VELAR_OWNER_TEST_TOKEN:'very-strong-owner-testing-token-0000000000001'};
const origin='https://velardream.com';
function request(path,{method='POST',auth='',message='Какая музыка для вечера?',originOverride=origin}={}){
 return new Request('https://dj-velar-owner-test.workers.dev'+path,{method,
   headers:{Origin:originOverride,Authorization:auth, 'Content-Type':'application/json'},
   body:method==='POST'?JSON.stringify({message,language:'ru'}):undefined});
}
const handler=context.worker.fetch;
let response=await handler(request('/v1/owner-test'),env);
assert.equal(response.status,401,'No token must never invoke AI');
response=await handler(request('/v1/owner-test',{auth:'Bearer '+env.VELAR_OWNER_TEST_TOKEN,originOverride:'https://attacker.example'}),env);
assert.equal(response.status,403,'Other origins rejected');
response=await handler(request('/v1/owner-test',{auth:'Bearer '+env.VELAR_OWNER_TEST_TOKEN}),env);
assert.equal(response.status,200);
let result=await response.json();assert.match(result.reply,/Попробуйте музыку/);
assert.equal(result.kind,'model_text_only');
assert.equal(response.headers.get('Cache-Control'),'no-store');
response=await handler(request('/v1/owner-test',{auth:'Bearer '+env.VELAR_OWNER_TEST_TOKEN,message:'x'.repeat(501)}),env);
assert.equal(response.status,400);
response=await handler(request('/health',{method:'GET'}),env);
assert.equal((await response.json()).publicEnabled,false);
console.log('PASS RUN-192: private AI lab, authenticated Worker, no public site/model load or saved secrets');
