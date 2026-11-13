import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('studio/recordings.js'),css=read('studio/recordings.css'),html=read('studio/index.html'),sw=read('sw.js');
assert.equal((js.match(/<audio id="vmm-r-audio"/g)||[]).length,1);
assert.doesNotMatch(js,/id="vmm-r-back"|id="vmm-r-next"/);
assert.match(js,/id="vmm-r-route"/);
assert.match(js,/id="vmm-r-more"/);
assert.match(js,/vmm-r-player-sentinel/);
assert.match(js,/function updateMiniPlayer/);
assert.match(js,/window.addEventListener\('scroll',updateMiniPlayer,false\)/);
assert.match(js,/viewBox="0 0 24 24" width="28" height="28"/);
assert.ok(html.includes('recordings.js?v=12'));
assert.ok(html.includes('recordings.css?v=12'));
assert.ok(sw.includes("STUDIO_PREFIX+'v45'"));
const latest=css.slice(css.indexOf('/* RUN-057'));
assert.match(latest,/\.vmm-r-play-button::before/);
assert.match(latest,/inset:5px/);
assert.match(latest,/\.vmm-r-player\.is-minimized/);
assert.match(latest,/\.vmm-r-player-sync svg/);
let panel;const elements={},events={};
const item=()=>({className:'',style:{},textContent:'',open:false,disabled:false,
 setAttribute(k,v){this[k]=v;},removeAttribute(){},appendChild(){},addEventListener(){},
 getBoundingClientRect(){return {bottom:40};},pause(){},load(){}});
const document={querySelector:q=>q==='#workspace .workspace-content'?{appendChild(x){panel=x;}}:null,
 createElement:item,getElementById:id=>(elements[id]||(elements[id]=item()))};
const window={addEventListener:(n,f)=>{events[n]=f;}};
const injected=js.replace('window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{header:header,mini:updateMiniPlayer,setup:function(){active=true;playerVisible=true;textVisible=true;},edit:function(v){editOpen=v;},text:function(v){textVisible=v;}}};');
assert.notEqual(injected,js);
vm.runInNewContext(injected,{document,window,Math,Date,Number,String,Array,Object,Promise,Error,navigator:{onLine:true}},{timeout:1000});
const t=window.VMM_RECORDINGS._test;
t.header();
for(const m of panel.innerHTML.matchAll(/id="([^"]+)"/g))document.getElementById(m[1]);
assert.equal(typeof events.scroll,'function');
assert.ok(panel.innerHTML.indexOf('id="vmm-r-route"')>panel.innerHTML.indexOf('id="vmm-r-seek"'));
assert.ok(panel.innerHTML.indexOf('id="vmm-r-more"')>panel.innerHTML.indexOf('id="vmm-r-route"'));
const sentinel=elements['vmm-r-player-sentinel'],card=elements['vmm-r-player-card'],system=elements['vmm-r-system'];
t.setup();sentinel.getBoundingClientRect=()=>({bottom:-70});events.scroll();
assert.match(card.className,/is-minimized/);
t.edit(true);t.mini();assert.doesNotMatch(card.className,/is-minimized/);
t.edit(false);system.open=true;t.mini();assert.doesNotMatch(card.className,/is-minimized/);
system.open=false;t.text(false);t.mini();assert.doesNotMatch(card.className,/is-minimized/);
t.text(true);sentinel.getBoundingClientRect=()=>({bottom:30});t.mini();assert.doesNotMatch(card.className,/is-minimized/);
console.log('PASS: narrow single-row player, no skip, scalable cloud and safe sticky minimization');
