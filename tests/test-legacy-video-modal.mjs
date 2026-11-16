import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('landing-public.js','utf8');
const section=source.slice(source.indexOf(' var dismissVideoModal=null;'),source.indexOf(' function releaseCard('));
for(const legacy of [true,false]){
 const events={},nodes=[],timers=new Map(),intervals=new Map();let serial=0,apiEvents,played=0,paused=0,destroyed=0,sizeCalls=0,seeked=0,muted=false;
 function create(tag,className,text){
  const n={tag,className,textContent:text,children:[],attrs:{},style:{setProperty(k,v){this[k]=v;}},
   setAttribute(k,v){this.attrs[k]=v;},appendChild(c){this.children.push(c);c.parentNode=this;},
   removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parentNode=null;},focus(){}};
  Object.defineProperty(n,'src',{set(v){if(legacy&&this.tag==='iframe')assert.ok(this.attrs.width,'Dimensions precede navigation');this.url=v;}});
  nodes.push(n);return n;
 }
 const player={playVideo(){played++;},pauseVideo(){paused++;},destroy(){destroyed++;},setSize(){sizeCalls++;},
  isMuted:()=>muted,mute(){muted=true;},unMute(){muted=false;},seekTo(s){seeked=s;},getDuration:()=>120,getCurrentTime:()=>30};
 const body=create('body'),head=create('head');
 const doc={body,head,getElementById(){return null;},createElement:create,addEventListener(k,f){events[k]=f;},removeEventListener(k){delete events[k];}};
 const win={innerWidth:768,innerHeight:1024,location:{origin:'https://velardream.com'},
  addEventListener(k,f){events[k]=f;},removeEventListener(k){delete events[k];},
  setTimeout(f){timers.set(++serial,f);return serial;},clearTimeout(t){timers.delete(t);},
  setInterval(f){intervals.set(++serial,f);return serial;},clearInterval(t){intervals.delete(t);},
  YT:{Player:function(frame,config){apiEvents=config.events;return player;}}};
 const ctx={document:doc,window:win,create,legacyIpadVideo:()=>legacy,pauseOtherEmbeds(){}};
 vm.createContext(ctx);vm.runInContext(section,ctx);
 const open=()=>ctx.showLegacyVideoModal('https://www.youtube-nocookie.com/embed/ABCDEFGHIjk','Test');
 const latest=cls=>nodes.filter(n=>n.className===cls).at(-1);
 open();
 let frame=latest('velar-video-dialog-frame');
 assert.match(frame.url,/playsinline=1/);
 assert.equal(frame.referrerPolicy,'strict-origin-when-cross-origin');
 if(legacy){
  assert.match(frame.url,/controls=0/);assert.match(frame.url,/enablejsapi=1&origin=https%3A%2F%2Fvelardream.com/);
  const play=latest('velar-video-api-play'),status=latest('velar-video-api-status');
  assert.equal(play.disabled,true);play.onclick();assert.equal(played,0,'No play before onReady');
  apiEvents.onReady({target:player});assert.equal(play.disabled,false);assert.equal(played,0,'Ready does not autoplay');
  play.onclick();assert.equal(played,1,'User gesture invokes real API');assert.doesNotMatch(status.textContent,/воспроизводится/);
  apiEvents.onStateChange({data:1});assert.equal(play.textContent,'Пауза');assert.match(status.textContent,/воспроизводится/);
  play.onclick();assert.equal(paused,1);apiEvents.onStateChange({data:2});assert.equal(play.textContent,'Воспроизвести');
  latest('velar-video-api-mute').onclick();assert.equal(muted,true);
  const seek=latest('velar-video-api-seek');seek.value='50';seek.onchange();assert.equal(seeked,60);
  for(const f of intervals.values())f();assert.equal(seek.value,'25');
  apiEvents.onError({data:153});assert.match(status.textContent,/153/);
  apiEvents.onAutoplayBlocked();assert.match(status.textContent,/заблокировал/);
  play.onclick();for(const f of [...timers.values()])f();assert.match(status.textContent,/не подтвердил запуск/);
  const url=frame.url;win.innerWidth=1024;win.innerHeight=768;events.resize();
  assert.equal(frame.url,url);assert.ok(+frame.attrs.height<=533);assert.ok(sizeCalls>=2);
 }else{assert.doesNotMatch(frame.url,/controls=0|enablejsapi/);assert.equal(latest('velar-video-api-play'),undefined);}
 const fallback=latest('velar-video-fallback');assert.equal(fallback.href,'https://www.youtube.com/watch?v=ABCDEFGHIjk');assert.equal(fallback.target,'_blank');
 open();assert.equal(body.children.length,1,'Reopen replaces modal');
 events.keydown({key:'Escape'});assert.equal(body.children.length,0);
 assert.equal(Object.keys(events).length,0);assert.equal(timers.size,0);assert.equal(intervals.size,0);
 if(legacy)assert.equal(destroyed,2);
 // Slow API must not attach to a closed modal; ready handler is restored.
 if(legacy){delete win.YT;open();const pending=win.onYouTubeIframeAPIReady;assert.equal(typeof pending,'function');
  events.keydown({key:'Escape'});assert.equal(win.onYouTubeIframeAPIReady,undefined);
  win.YT={Player(){throw Error('must not attach after close');}};pending();assert.equal(body.children.length,0);}
}
console.log('PASS: same-page modal; API readiness, real play/pause/mute/seek, truthful states, errors/timeouts, sizing, cleanup; modern iframe unchanged');
