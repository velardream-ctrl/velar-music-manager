import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('studio/recordings.js'),
      css=read('studio/recordings.css'),
      html=read('studio/index.html'),
      sw=read('sw.js');

// The underlying media is not replaced; native AirPlay and the native overflow
// menu remain on the SAME <audio> in a disclosure opened by our quick button.
assert.equal((js.match(/<audio id="vmm-r-audio"/g)||[]).length,1);
assert.match(js,/id="vmm-r-route"/);
assert.match(js,/id="vmm-r-more"/);
assert.match(js,/id="vmm-r-controls-shell"|class="vmm-r-controls-shell"/);
assert.match(js,/audio\.webkitShowPlaybackTargetPicker\(\)/);
assert.match(js,/pane\.open=!pane\.open;syncSystemMenu\(\)/);
assert.match(js,/id="vmm-r-system"/);
assert.match(js,/<audio id="vmm-r-audio" controls/);
assert.match(js,/if\(s\.style\.setProperty\)s\.style\.setProperty\('--vmm-progress',p\+'%'\)/);
assert.doesNotMatch(js,/s\.style\.background='linear-gradient\(/,
  'Never paint progress on the entire 44px touch target');
assert.match(css,/#vmm-repertoire \.vmm-r-timeline input\[type="range"\]\{[\s\S]*?height:44px;min-height:44px/);
assert.match(css,/#vmm-repertoire \.vmm-r-timeline input\[type="range"\]::-webkit-slider-runnable-track\{\s*height:6px/);
assert.match(css,/::-webkit-slider-thumb\{\s*[\s\S]*?height:21px;width:21px/);
assert.match(css,/\.vmm-r-system:not\(\[open\]\)\{display:none\}/);
assert.ok(html.includes('recordings.js?v=12'));
assert.ok(html.includes('recordings.css?v=12'));
assert.ok(sw.includes("STUDIO_PREFIX+'v30'"));

let panel;const nodes={};
function el(tag){
 const listeners={};
 return {
  tagName:tag||'DIV',style:{},value:'',textContent:'',className:'',
  disabled:false,open:false,paused:true,ended:false,currentTime:0,duration:0,
  appendChild(){},addEventListener(name,cb){(listeners[name]||(listeners[name]=[])).push(cb);},
  dispatch(name){for(const cb of (listeners[name]||[]))cb();},
  setAttribute(k,v){this[k]=v;},removeAttribute(){},focus(){},
  getAttribute(k){return this[k]||null;},
  pause(){this.paused=true;this.dispatch('pause');},
  load(){this.dispatch('loadedmetadata');},
  play(){this.paused=false;this.dispatch('play');return Promise.resolve();}
 };
}
const document={
 querySelector(q){return q==='#workspace .workspace-content'?{appendChild(node){panel=node;}}:null;},
 createElement:el,getElementById(id){return nodes[id]||(nodes[id]=el(id==='vmm-r-audio'?'AUDIO':'DIV'));}
};
const window={};
const code=js.replace(
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{header:header,sync:syncStagePlayer,ready:function(){audioFileId="record-1";},clear:clearAudio}};'
);
assert.notEqual(code,js);
vm.runInNewContext(code,{document,window,navigator:{onLine:true},Promise,String,Array,Object,Number,Math,Date,Error,URL:{revokeObjectURL(){}}},{timeout:1000});
const t=window.VMM_RECORDINGS._test;
t.header();
assert.ok(panel.innerHTML.includes('id="vmm-r-route"'));
assert.ok(panel.innerHTML.includes('id="vmm-r-more"'));
assert.ok(panel.innerHTML.includes('id="vmm-r-system"'));
const route=nodes['vmm-r-route'],more=nodes['vmm-r-more'],system=nodes['vmm-r-system'];
const audio=nodes['vmm-r-audio'];
assert.equal(route.disabled,true);
assert.equal(more.disabled,true);
assert.equal(system.open,false);

t.ready();audio.duration=320;audio.currentTime=95;t.sync();
assert.equal(route.disabled,false);
assert.equal(more.disabled,false);
assert.equal(nodes['vmm-r-seek'].style['--vmm-progress'],'29.6875%');

let calls=0;
audio.webkitShowPlaybackTargetPicker=function(){calls++;};
route.onclick();assert.equal(calls,1,'AirPlay picker must be invoked immediately on direct click');
assert.equal(system.open,false,'AirPlay click must not unnecessarily expand native fallback');
more.onclick();assert.equal(system.open,true,'More must reveal original native controls');
assert.equal(more['aria-expanded'],'true');
more.onclick();assert.equal(system.open,false);
assert.equal(more['aria-expanded'],'false');
// If WebKit API is missing, the route button uses existing native controls.
delete audio.webkitShowPlaybackTargetPicker;
route.onclick();assert.equal(system.open,true);
system.open=false;system.ontoggle();
assert.equal(more['aria-expanded'],'false');
// Wireless playback state from the native element should be reflected.
audio.webkitCurrentPlaybackTargetIsWireless=true;
audio.dispatch('webkitcurrentplaybacktargetiswirelesschanged');
assert.match(route.className,/is-wireless/);
t.clear();
assert.equal(route.disabled,true);
assert.equal(more.disabled,true);
console.log('PASS: slim 6px visual seek, 44px hit area, direct AirPlay, three-dot native menu, fallback and no duplicate media');
