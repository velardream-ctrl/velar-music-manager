import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const src=read('landing-public.js');
const begin=src.indexOf(' function cueCatalog(');
const end=src.indexOf(' function renderRadio(',begin);
assert.ok(begin>=0&&end>begin);
const expression='('+src.slice(begin,end).trim()+')';
let events,played=0,loaded=[],cued=[],loop=false,index=0;
const fake={
 cuePlaylist(ids,at,start){cued.push({ids:[...ids],at,start});},
 setLoop(value){loop=value;},
 getPlaylistIndex(){return index;},
 nextVideo(){played++;},
 loadPlaylist(ids){loaded.push([...ids]);}
};
const window={YT:{Player:function(frame,opts){events=opts.events;return fake;}},location:{origin:'https://velardream.com'}};
const cue=vm.runInNewContext(expression,{window,document:{},shuffledRadioUrls:xs=>xs.slice().reverse(),
 byId:()=>null,create:()=>null,encodeURIComponent,Array,Number},{timeout:1000});
const ids=Array.from({length:203},(_,i)=>String(i).padStart(11,'0'));
const frame={parentNode:{},src:'https://www.youtube-nocookie.com/embed/00000000000'};
const status={textContent:''};
const playback=cue(frame,ids,status,13);
events.onReady({target:fake});
assert.equal(cued.length,1);
assert.equal(cued[0].ids.length,100);
assert.equal(cued[0].start,13);
assert.equal(loop,false,'Long queues must advance between chunks rather than repeat the first 100');
index=4;assert.equal(playback.next(),true);
assert.equal(played,1);
index=99;assert.equal(playback.next(),true);
assert.equal(loaded.length,1);assert.equal(loaded[0].length,100);
assert.equal(loaded[0][0],ids[100]);
index=99;events.onStateChange({data:0,target:fake});
assert.equal(loaded.length,2);assert.equal(loaded[1].length,3);
index=2;events.onStateChange({data:0,target:fake});
assert.equal(loaded.length,3,'After the full catalog, the next shuffled cycle starts');
assert.equal(loaded[2].length,100);
playback.dispose();
const before=played;assert.equal(playback.next(),false);assert.equal(played,before);

let singleEvents;let nativeNext=0;let nativeLoop=false;
const native={
 nextVideo(){nativeNext++;},
 cuePlaylist(ids){assert.equal(ids.length,2);},
 setLoop(v){nativeLoop=v;},
 getPlaylistIndex(){return 0;}
};
window.YT.Player=function(frame,opts){singleEvents=opts.events;return native;};
const short=cue({parentNode:{}},ids.slice(0,2),status,0);
singleEvents.onReady({target:native});
assert.equal(nativeLoop,true,'Short playlists loop through YouTube without replacing iframe');
assert.equal(short.next(),true);assert.equal(nativeNext,1);
short.dispose();

delete window.YT;
const manual=cue({parentNode:{},src:''},ids.slice(0,3),status,0);
const fallback={parentNode:{},src:''};
const manual2=cue(fallback,ids.slice(0,3),status,0);
assert.equal(manual2.next(),true);
assert.match(fallback.src,/embed\/00000000001\?autoplay=1/);
manual.dispose();manual2.dispose();
const css=read('style.css');
assert.match(css,/velar-radio-panel--mini \.velar-radio-next/);
assert.match(src,/if\(provider==='youtube'\)radioYoutube=cueCatalog/);
assert.match(src,/enablejsapi=1/);
assert.match(src,/radioYoutube\.dispose\(\)/);
console.log('PASS: RUN-167 manual YouTube Next, automatic continuous 203-item queue, 100-item chunks, mini control and cleanup');
