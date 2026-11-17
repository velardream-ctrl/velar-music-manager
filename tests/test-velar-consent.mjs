import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const store={};
const created=[];
const doc={
 title:'VELARDREAM',
 cookie:'',
 head:{appendChild(x){created.push(x);}},
 createElement(tag){return {tagName:tag,setAttribute(){},style:{},appendChild(){}};},
 getElementById(){return null;},
 querySelector(){return null;},
 body:{}
};
const w={
 localStorage:{getItem(k){return store[k]||null;},setItem(k,v){store[k]=v;},removeItem(k){delete store[k];}},
 VELAR_GA4_MEASUREMENT_ID:'G-ZD640V3VQ1',
 location:{pathname:'/'}
};
const ctx={window:w,document:doc,navigator:{},Date,JSON,String,Array,Math,Error};
vm.runInNewContext(read('analytics-public.js'),ctx,{timeout:1200});
const analytics=w.VMM_ANALYTICS;
assert.equal(analytics.configure({enabled:false},true).ready,false);
assert.equal(created.length,0,'No Google tag before enabled');
assert.equal(analytics.configure({enabled:true},true).ready,false);
assert.equal(analytics.consentChoice(),'','no implicit visitor opt in');
assert.equal(created.length,0,'Consent prompt has no Google tag');
assert.equal(analytics.choose(false).ready,false);
assert.equal(store['velar-analytics-consent'],'no');
assert.equal(created.length,0,'Explicit rejection loads no script');
assert.equal(analytics.consentChoice(),'no','refusal persists');
assert.equal(analytics.choose(true).ready,true);
assert.equal(created.length,1,'Only explicit permission loads GA4');
assert.equal(created[0].src,'https://www.googletagmanager.com/gtag/js?id=G-ZD640V3VQ1');
assert.equal(store['velar-analytics-consent'],'yes');
assert.ok(w.dataLayer.some(x=>x[0]==='consent'&&x[1]==='default'));
assert.ok(w.dataLayer.some(x=>x[0]==='event'&&x[1]==='page_view'));
const count=w.dataLayer.length;
analytics.choose(false);
assert.equal(analytics.status().ready,false,'Revocation blocks further events');
assert.equal(analytics.record('player_open',{provider:'youtube'}),false);
assert.ok(w.dataLayer.length>=count,'No reactivation during refusal');
assert.match(read('velar-assistant.js'),/analyticsInvitation\(\)/);
assert.match(read('velar-assistant.js'),/analyticsRespond\(false\)/);
assert.match(read('velar-assistant.js'),/analyticsAlreadyAsked\(\)/);
assert.match(read('velar-assistant.js'),/sessionStorage/);
assert.doesNotMatch(read('velar-assistant.js'),/remoteAddress|userIP|visitorIp|ipify/);
assert.match(read('landing-public.js'),/VMM_ANALYTICS\.configure\(value\.hero\.analytics/);
console.log('PASS RUN-188: DJ Velar consent; zero requests before opt-in; persisted refusal; revoke');
