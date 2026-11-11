import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('studio/recordings.js'),
  css=read('studio/recordings.css'),
  html=read('studio/index.html'),
  sw=read('sw.js');

// One actual HTMLAudioElement: customized UI and native iOS AirPlay/options
// control the same source. Never fork audio, duplicate the blob, or use a proxy.
assert.equal((source.match(/<audio id="vmm-r-audio"/g)||[]).length,1);
assert.match(source,/id="vmm-r-play"/);
assert.match(source,/id="vmm-r-seek"/);
assert.doesNotMatch(source,/id="vmm-r-back"|id="vmm-r-next"/);
assert.match(source,/id="vmm-r-route"/);
assert.match(source,/id="vmm-r-more"/);
assert.match(source,/id="vmm-r-elapsed"/);
assert.match(source,/id="vmm-r-remaining"/);
assert.match(source,/id="vmm-r-system"/);
assert.match(source,/x-webkit-airplay="allow"/);
assert.match(source,/<audio id="vmm-r-audio" controls/);
assert.match(source,/function stageToggle\(\)/);
assert.match(source,/function stageSeekTo\(seconds\)/);
assert.match(source,/function syncStagePlayer\(\)/);
assert.match(source,/function clearAudio\(\)/);
assert.match(source,/function bindStagePlayer\(\)/);
assert.match(css,/\.vmm-r-play-button/);
assert.match(css,/\.vmm-r-timeline input\[type="range"\]::-webkit-slider-thumb/);
assert.match(css,/\.vmm-r-system audio/);
assert.ok(html.includes('src="recordings.js?v=11"'));
assert.ok(html.includes('href="recordings.css?v=11"'));
assert.ok(sw.includes("STUDIO_PREFIX+'v14'"));
assert.ok(!/drive\.googleapis\.com|audio\/flac|audio\/mpeg/.test(sw),'Private audio must not be cached in the public PWA shell');

const elements={};
let player;
function element(tag){
  const listeners={};
  const obj={
    tagName:tag||'DIV',style:{},className:'',children:[],
    textContent:'',value:'',disabled:false,paused:true,ended:false,
    currentTime:0,duration:0,src:'',
    setAttribute(key,value){this[key]=value;},
    getAttribute(key){return this[key]||null;},
    removeAttribute(key){delete this[key];},
    addEventListener(name,listener){(listeners[name]||(listeners[name]=[])).push(listener);},
    dispatch(name){(listeners[name]||[]).forEach(fn=>fn());},
    appendChild(item){this.children.push(item);},
    pause(){this.paused=true;this.dispatch('pause');},
    play(){this.paused=false;this.ended=false;this.dispatch('play');return Promise.resolve();},
    load(){this.dispatch('loadedmetadata');},
    focus(){},scrollIntoView(){}
  };
  Object.defineProperty(obj,'innerHTML',{get(){return this._html||'';},set(value){this._html=value;}});
  return obj;
}
const shell={appendChild(el){player=el;}};
const document={
  querySelector(q){return q==='#workspace .workspace-content'?shell:null;},
  querySelectorAll(){return [];},
  createElement(tag){return element(tag);},
  getElementById(id){return elements[id]||(elements[id]=element(id==='vmm-r-audio'?'AUDIO':'DIV'));}
};
const window={};
const code=source.replace(
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{header:header,sync:syncStagePlayer,seek:stageSeekTo,toggle:stageToggle,clear:clearAudio,time:stageTime,setup:function(){audioFileId="audio-1";songId="song-1";playerVisible=true;},state:function(){return {audioFileId:audioFileId,playerPending:playerPending};}}};'
);
assert.notEqual(code,source,'test instrumentation failed');
vm.runInNewContext(code,{
  window,document,Promise,Array,Object,String,Number,Math,Date,Error,URL:{revokeObjectURL(){}},
  navigator:{onLine:true}
},{timeout:1000});
const test=window.VMM_RECORDINGS._test;
test.header();
assert.ok(player.innerHTML.includes('Системные функции плеера'));
assert.ok(player.innerHTML.indexOf('id="vmm-r-play"')<player.innerHTML.indexOf('id="vmm-r-audio"'));
assert.equal(elements['vmm-r-play'].disabled,true,'No playback before audio loads');
assert.equal(elements['vmm-r-seek'].disabled,true);
assert.equal(test.time(3661),'61:01');
assert.equal(test.time(NaN),'0:00');

test.setup();
const audio=elements['vmm-r-audio'];
audio.duration=330;audio.currentTime=35;
audio.dispatch('durationchange');
assert.equal(elements['vmm-r-play'].disabled,false);
assert.equal(elements['vmm-r-elapsed'].textContent,'0:35');
assert.equal(elements['vmm-r-remaining'].textContent,'-4:55');
assert.equal(elements['vmm-r-seek'].disabled,false);

elements['vmm-r-play'].onclick();
assert.equal(audio.paused,false);
assert.equal(elements['vmm-r-play']['aria-label'],'Пауза');
assert.equal(elements['vmm-r-play']['aria-pressed'],'true');

audio.currentTime=70;audio.dispatch('timeupdate');
assert.equal(elements['vmm-r-elapsed'].textContent,'1:10');
assert.equal(elements['vmm-r-remaining'].textContent,'-4:20');
// Skip controls are intentionally removed; slider seeking stays intact.
assert.equal(elements['vmm-r-back'],undefined);
assert.equal(elements['vmm-r-next'],undefined);

const slider=elements['vmm-r-seek'];
slider.value='500';slider.oninput();
assert.equal(elements['vmm-r-elapsed'].textContent,'2:45');
assert.equal(slider['aria-valuetext'],'2:45 из 5:30');
slider.onchange();
assert.equal(audio.currentTime,165);
assert.equal(elements['vmm-r-remaining'].textContent,'-2:45');

elements['vmm-r-play'].onclick();
assert.equal(audio.paused,true);
assert.equal(elements['vmm-r-play']['aria-label'],'Воспроизвести');
audio.ended=true;audio.dispatch('ended');
assert.equal(elements['vmm-r-play']['aria-pressed'],'false');

// Existing clear() must release the same audio source and reset all controls.
test.clear();
assert.equal(test.state().audioFileId,'');
assert.equal(elements['vmm-r-play'].disabled,true);
assert.equal(elements['vmm-r-seek'].disabled,true);
assert.equal(elements['vmm-r-elapsed'].textContent,'0:00');
assert.equal(elements['vmm-r-remaining'].textContent,'—:—');
console.log('PASS: one media engine, compact play/pause, seek, elapsed/remaining, reset and native iOS controls');
