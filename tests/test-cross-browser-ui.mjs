import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const player=read('studio/recordings.js'),styles=read('studio/recordings.css');
const studio=read('studio/studio.js'),publicHtml=read('index.html');
const page=read('studio/index.html'),sw=read('sw.js'),publicCSS=read('style.css');
new vm.Script(player);new vm.Script(studio);
assert.match(styles,/#vmm-repertoire #vmm-r-player-section\{[\s\S]*?overflow-anchor:none/);
assert.match(styles,/#vmm-repertoire #vmm-r-player-card\.is-minimized\{[\s\S]*?pointer-events:auto/);
assert.match(styles,/#vmm-repertoire #vmm-r-player-card\.is-minimized \.vmm-r-stage/);
assert.match(player,/var past=minimized\?rect\.bottom<24:rect\.bottom< -48/);
assert.match(player,/if\(target===minimized\)return/);
assert.match(player,/window\.addEventListener\('scroll',updateMiniPlayer,false\)/);
assert.match(publicHtml,/Открыть мир артистов <svg class="button-arrow"/);
assert.doesNotMatch(publicHtml,/Открыть мир артистов <span aria-hidden="true">↗/);
assert.match(publicCSS,/\.button-primary \.button-arrow/);
assert.ok(publicHtml.includes('href="style.css?v=11"'));
assert.ok(page.includes('src="studio.js?v=9"'));
assert.ok(page.includes('src="recordings.js?v=11"'));
assert.ok(page.includes('href="recordings.css?v=11"'));
assert.ok(sw.includes("CACHE_PREFIX + 'v11'"));
assert.ok(sw.includes("STUDIO_PREFIX+'v16'"));
assert.match(studio,/db\.collection\('vmm_admins'\)\.doc\(user\.uid\)\.get\(\{source:'server'\}\)/,
  'Safari workaround must not bypass verified admin rules');

let panel,events={};
const elements={};
function node(){
 return {className:'vmm-r-player',open:false,style:{},textContent:'',
  setAttribute(){},removeAttribute(){},addEventListener(){},pause(){},load(){},
  appendChild(){},getBoundingClientRect(){return {bottom:-60};}};
}
const document={
 querySelector:q=>q==='#workspace .workspace-content'?{appendChild(x){panel=x;}}:null,
 createElement:node,getElementById:id=>(elements[id]||(elements[id]=node()))
};
const window={addEventListener:(type,fn)=>{events[type]=fn;}};
const injected=player.replace(
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{header:header,update:updateMiniPlayer,setFlags:function(on){active=true;playerVisible=true;textVisible=on;editOpen=false;}}};');
assert.notEqual(injected,player);
vm.runInNewContext(injected,{window,document,Promise,Date,Math,String,Number,Object,Array,Error,navigator:{onLine:true}},{timeout:1000});
const api=window.VMM_RECORDINGS._test;
api.header();
const sentinel=elements['vmm-r-player-sentinel'],card=elements['vmm-r-player-card'];
const pane=elements['vmm-r-system'];
api.setFlags(true);
let b=-70;sentinel.getBoundingClientRect=()=>({bottom:b});
api.update();assert.match(card.className,/is-minimized/);
const same=card.className;
api.update();assert.equal(card.className,same,'Do not churn class on every wheel event');
b=-8;api.update();assert.match(card.className,/is-minimized/,
 'Keep mini mode until sentinel is well within viewport (Firefox hysteresis)');
b=26;api.update();assert.doesNotMatch(card.className,/is-minimized/);
b=-20;api.update();assert.doesNotMatch(card.className,/is-minimized/,
 'Do not minimize again near threshold');
b=-55;api.update();assert.match(card.className,/is-minimized/);
pane.open=true;api.update();assert.doesNotMatch(card.className,/is-minimized/,
 'System controls must always be reachable');
console.log('PASS: Firefox stable sticky controls/scroll hysteresis, accessible mini player and Android-independent SVG arrow');
