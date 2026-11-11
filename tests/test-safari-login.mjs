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
const prefix="var signIn=button,auth=mockAuth,firebase=mockFirebase,authorized=false,signInAttempt=0,signInWatchdog=null;"+
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
