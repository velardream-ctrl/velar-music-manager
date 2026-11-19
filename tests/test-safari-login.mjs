import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../studio/studio.js',import.meta.url),'utf8');
const helperStart=src.indexOf('  function clearSignInWatchdog(){');
const helperEnd=src.indexOf('  function loadSdk(){',helperStart);
const handlerStart=src.indexOf('  signIn.onclick=function(){');
const handlerEnd=src.indexOf("  el('sign-out').onclick=",handlerStart);
assert.ok(helperStart>=0&&helperEnd>helperStart&&handlerStart>=0&&handlerEnd>handlerStart);
assert.match(src,/db\.collection\('vmm_admins'\)\.doc\(user\.uid\)\.get\(\{source:'server'\}\)/);
const messages=[],timers=new Map();let timerId=0,popupCalls=0,rejectPopup;
const button={disabled:false,textContent:'Войти через Google'};
const window={
 setTimeout(fn,ms){assert.equal(ms,18000);const id=++timerId;timers.set(id,fn);return id;},
 clearTimeout(id){timers.delete(id);}
};
const auth={signInWithPopup(){popupCalls++;return new Promise((resolve,reject)=>{rejectPopup=reject;});}};
function Provider(){}
Provider.prototype.setCustomParameters=function(){};
const firebase={auth:{GoogleAuthProvider:Provider}};
const prefix="var signIn=button,auth=mockAuth,firebase=mockFirebase,authorized=false,signInAttempt=0,signInWatchdog=null,retryAdminAccess=false;"+
  "function message(s){messages.push(s);}";
const snippet=prefix+src.slice(helperStart,helperEnd)+src.slice(handlerStart,handlerEnd);
const ctx={button,mockAuth:auth,mockFirebase:firebase,messages,window,Promise,Error};
vm.runInNewContext(snippet,ctx,{timeout:1000});
const start=ctx.signIn;
assert.equal(typeof start.onclick,'function');
start.onclick();
assert.equal(popupCalls,1);
assert.equal(start.disabled,true);
assert.match(messages.at(-1),/Safari/);
assert.equal(timers.size,1);
const watchdog=[...timers.values()][0];
watchdog();
assert.equal(start.disabled,false,'Safari must not hang on "Opening Google" forever');
assert.match(start.textContent,/Повторить/);
assert.match(messages.at(-1),/всплывающие окна/);
start.onclick();
assert.equal(popupCalls,2,'User can retry with a fresh gesture');
rejectPopup({code:'auth/popup-blocked',message:'Popup blocked'});
await new Promise(r=>setImmediate(r));
assert.equal(start.disabled,false);
assert.match(messages.at(-1),/Safari заблокировал/);
assert.match(messages.at(-1),/velardream.com/);
assert.match(src,/function signinReady/);
assert.match(src,/if\(user\)\{clearSignInWatchdog/);
assert.match(src,/if\(authorized&&authorizedUid===user\.uid\)/);
console.log('PASS: Safari popup starts in click, timed recovery, actionable retry, blocked-popup errors and admin verification retained');

const checkStart=src.indexOf('  var accessAttempt=');
const checkEnd=src.indexOf('  signIn.onclick=function(){',checkStart);
const accessTimers=new Map();
let accessTimer=0, openCount=0, readCount=0, resolveLate;
const verified={uid:'owner',emailVerified:true};
const approved={exists:true,data:()=>({enabled:true})};
const accessContext={
  user:verified,signIn:{},navigator:{onLine:true},
  window:{setTimeout(fn,ms){assert.equal(ms,12000);accessTimers.set(++accessTimer,fn);return accessTimer;},clearTimeout(id){accessTimers.delete(id);}},
  clearSignInWatchdog(){},signinReady(){},message(){},unauthorized(){accessContext.signIn.disabled=false;},
  showWorkspace(){openCount++;},
  db:{collection(name){assert.equal(name,'vmm_admins');return {doc(uid){assert.equal(uid,verified.uid);return {get({source}) {
    assert.equal(source,'server');
    return ++readCount===1?new Promise(resolve=>{resolveLate=resolve;}):Promise.resolve(approved);
  }};}};}}
};
vm.runInNewContext(src.slice(checkStart,checkEnd),accessContext);
accessContext.checkAdminAccess();
assert.equal(accessContext.signIn.disabled,true);
[...accessTimers.values()][0]();
assert.equal(accessContext.signIn.textContent,'Повторить проверку доступа');
assert.equal(accessContext.signIn.disabled,false);
resolveLate(approved);
await new Promise(r=>setImmediate(r));
assert.equal(openCount,0,'A late prior check must not unlock Studio');
accessContext.checkAdminAccess();
await new Promise(r=>setImmediate(r));
assert.equal(openCount,1,'Retry checks the already-authenticated account');
assert.equal(accessTimers.size,0);

accessContext.cfg={projectId:'studio-test'};
verified.getIdToken=async()=> 'mock-firebase-token';
accessContext.window.AbortController=AbortController;
accessContext.window.setTimeout=(fn,ms)=>{
  accessTimers.set(++accessTimer,{fn,ms});
  return accessTimer;
};
accessContext.db.collection=()=>({doc:()=>({get:()=>new Promise(()=>{})})});
accessContext.window.fetch=async (url,options)=>{
  assert.equal(url,'https://firestore.googleapis.com/v1/projects/studio-test/databases/(default)/documents/vmm_admins/owner');
  assert.equal(options.headers.Authorization,'Bearer mock-firebase-token');
  assert.equal(options.cache,'no-store');
  return {ok:true,status:200,json:async()=>({fields:{enabled:{booleanValue:true}}})};
};
accessContext.checkAdminAccess();
[...accessTimers.values()].find(timer=>timer.ms===4000).fn();
await new Promise(r=>setImmediate(r));
assert.equal(openCount,2,'HTTPS fallback accepts server-confirmed administrator rights');
assert.equal(accessTimers.size,0);

accessContext.window.fetch=async()=>({ok:false,status:403});
accessContext.checkAdminAccess();
[...accessTimers.values()].find(timer=>timer.ms===4000).fn();
await new Promise(r=>setImmediate(r));
assert.equal(openCount,2,'A server rejection must never unlock Studio');
assert.equal(accessTimers.size,0);
