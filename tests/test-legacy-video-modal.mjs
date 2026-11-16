import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('landing-public.js','utf8');
const section=source.slice(source.indexOf(' var dismissVideoModal=null;'),source.indexOf(' function releaseCard('));
for(const legacy of [true,false]){
 const events={},nodes=[];
 function create(tag,className,text){
  const n={tag,className,text,children:[],attrs:{},style:{setProperty(k,v){this[k]=v;}},
   setAttribute(k,v){this.attrs[k]=v;},appendChild(c){this.children.push(c);c.parentNode=this;},
   removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parentNode=null;},focus(){}};
  Object.defineProperty(n,'src',{set(v){if(legacy)assert.ok(this.attrs.width,'Dimensions precede navigation');this.url=v;}});
  nodes.push(n);return n;
 }
 const body=create('body'),doc={body,getElementById(){return null;},addEventListener(k,f){events[k]=f;},removeEventListener(k){delete events[k];}};
 const win={innerWidth:768,innerHeight:1024,addEventListener(k,f){events[k]=f;},removeEventListener(k){delete events[k];}};
 const ctx={document:doc,window:win,create,legacyIpadVideo:()=>legacy,pauseOtherEmbeds(){},externalYouTube:()=>false,youtubeWatchUrl:()=>'https://www.youtube.com/watch?v=ABCDEFGHIjk'};
 vm.createContext(ctx);vm.runInContext(section,ctx);
 const open=()=>ctx.showLegacyVideoModal('https://www.youtube-nocookie.com/embed/ABCDEFGHIjk','Test');
 open();
 let frame=nodes.find(n=>n.tag==='iframe');
 assert.match(frame.url,legacy?/playsinline=0/:/playsinline=1/);
 assert.equal(frame.referrerPolicy,'strict-origin-when-cross-origin');
 if(legacy){
  assert.ok(+frame.attrs.width>=200);assert.ok(+frame.attrs.height>=200);
  const url=frame.url;win.innerWidth=1024;win.innerHeight=768;events.resize();
  assert.equal(frame.url,url);assert.ok(+frame.attrs.height<=638);
 }
 assert.equal(nodes.find(n=>n.className==='velar-video-fallback').href,'https://www.youtube.com/watch?v=ABCDEFGHIjk');
 open();assert.equal(body.children.length,1,'Reopening replaces prior modal');
 events.keydown({key:'Escape'});assert.equal(body.children.length,0);
 assert.equal(Object.keys(events).length,0,'Closing cleans listeners');
}
console.log('PASS: legacy modal sizes before navigation, rotation, fallback, reopen and cleanup; modern mode preserved');
