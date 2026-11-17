import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const workerSource=read('cloudflare/dj-velar-owner-lab.js');
const assistant=read('velar-assistant.js');
const html=read('index.html'),sw=read('sw.js');
new vm.Script(assistant);
assert.match(html,/ai-fallback\.js\?v=1/);
assert.match(html,/velar-assistant\.js\?v=16/);
assert.match(sw,/velar-assistant\.js\?v=16/);
assert.match(sw,/ai196/);
assert.match(assistant,/VELAR_AI_FALLBACK/);
assert.match(assistant,/window\.VELAR_PUBLIC_AI_ENABLED!==true/);
assert.match(assistant,/data-response-source/);
assert.match(assistant,/replyText\(config,'fallbackDisabled'\)/);
assert.match(assistant,/https:\/\/ai\.velardream\.com\/v1\/public-chat/);
assert.doesNotMatch(assistant,/VELAR_OWNER_TEST_TOKEN/);
const code=workerSource.replace(/^import .*ai-budget\.js";\nexport \{ VelarAiBudget \};\n/,'').replace('export default {','const worker = {')+'\n;globalThis.worker = worker;';
new vm.Script(code);
const context={Request,Response,URL,globalThis:null};context.globalThis=context;
vm.runInNewContext(code,context);
let calls=0,limits=0;
const env={AI:{run:async()=>{calls++;return {response:'Я помогу подобрать музыку.'};}},
 PUBLIC_RATE_LIMITER:{limit:async()=>{limits++;return {success:true};}},
 PUBLIC_GLOBAL_RATE_LIMITER:{limit:async()=>({success:true})},
 PUBLIC_AI_ENABLED:'false',PUBLIC_AI_DAILY_LIMIT:'100',
 PUBLIC_AI_BUDGET:{idFromName:()=>1,get:()=>({fetch:async(url,opts)=>{
   if(url.endsWith('/reserve'))return Response.json({ok:true,day:'2026-11-17'});
   if(url.endsWith('/stats'))return Response.json({day:'2026-11-17',used:1,succeeded:1,failed:0});
   return Response.json({ok:true});
 }})},VELAR_OWNER_TEST_TOKEN:'x'.repeat(40)};
function req({origin='https://velardream.com',method='POST',message='Что ты умеешь?',ip='198.51.100.10'}={}){
 return new Request('https://ai.velardream.com/v1/public-chat',{method,
 headers:{Origin:origin,'CF-Connecting-IP':ip,'Content-Type':'application/json'},
 body:method==='POST'?JSON.stringify({message,language:'ru'}):undefined});
}
let r=await context.worker.fetch(req(),env);
assert.equal(r.status,503);assert.equal(calls,0,'Disabled AI must never consume quota');
env.PUBLIC_AI_ENABLED='true';delete env.PUBLIC_RATE_LIMITER;
r=await context.worker.fetch(req(),env);
assert.equal(r.status,503);assert.equal(calls,0,'No rate limiter must fail closed');
env.PUBLIC_RATE_LIMITER={limit:async()=>({success:false})};
r=await context.worker.fetch(req(),env);
assert.equal(r.status,429);assert.equal(calls,0);
env.PUBLIC_RATE_LIMITER={limit:async()=>{limits++;return {success:true};}};
delete env.PUBLIC_GLOBAL_RATE_LIMITER;
r=await context.worker.fetch(req(),env);
assert.equal(r.status,503);assert.equal(calls,0,'No aggregate limiter must fail closed');
env.PUBLIC_GLOBAL_RATE_LIMITER={limit:async()=>({success:false})};
r=await context.worker.fetch(req(),env);
assert.equal(r.status,429);assert.equal(calls,0,'Aggregate throttling must not invoke AI');
env.PUBLIC_GLOBAL_RATE_LIMITER={limit:async()=>({success:true})};
r=await context.worker.fetch(req({origin:'https://untrusted.example'}),env);
assert.equal(r.status,403);assert.equal(calls,0);
r=await context.worker.fetch(req(),env);
assert.equal(r.status,200);assert.match((await r.json()).reply,/подобрать музыку/);
assert.equal(calls,1);assert.ok(limits>0);
delete env.PUBLIC_AI_BUDGET;
r=await context.worker.fetch(req(),env);
assert.equal(r.status,503,'No shared budget binding must reject model calls');
assert.equal(calls,1);
env.PUBLIC_AI_BUDGET={idFromName:()=>1,get:()=>({fetch:async()=>Response.json({error:'daily_limit'},{status:429})})};
r=await context.worker.fetch(req(),env);
assert.equal(r.status,429,'Daily cap must refuse AI');
assert.equal(calls,1);
let statRequest=new Request('https://ai.velardream.com/v1/owner-stats',{
 method:'GET',headers:{Origin:'https://velardream.com'}});
r=await context.worker.fetch(statRequest,env);
assert.equal(r.status,401,'Dashboard counts are owner-only');
console.log('PASS RUN-196: server-side opt-in, origin, per-client and global rate-limit, model, public fallback wiring');

assert.doesNotMatch(assistant,/velar-assistant-ai-notice|Неизвестные вопросы могут передаваться Cloudflare AI/);
// RUN-199: Health must accurately distinguish deployed bindings from client toggle.
let health=await context.worker.fetch(new Request('https://ai.velardream.com/health',{method:'GET'}),env);
assert.equal((await health.json()).publicEnabled,false,'Missing budget must not show ready');
env.PUBLIC_AI_BUDGET={idFromName:()=>1,get:()=>({fetch:async()=>Response.json({ok:true})})};
health=await context.worker.fetch(new Request('https://ai.velardream.com/health',{method:'GET'}),env);
assert.equal((await health.json()).publicEnabled,true,'Configured server should report ready');
assert.doesNotMatch(await (await context.worker.fetch(new Request('https://ai.velardream.com/health',{method:'GET'}),env)).text(),/OWNER_TEST_TOKEN|Bearer|198\.51/);

