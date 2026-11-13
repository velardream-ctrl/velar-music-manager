/* RUN-106 — optional global carousel for public song lists, no private data. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),player=read('public-song-ui.js');
new vm.Script(schema);new vm.Script(player);
const window={},requests=[];
const spotify='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const spotify2='https://open.spotify.com/track/ABCDEFGHIJKL0123456789';
const yt='https://www.youtube.com/watch?v=ABCDEFGHIjk';
window.fetch=url=>{
 requests.push(url);
 return Promise.resolve({ok:true,json:()=>Promise.resolve({
   thumbnail_url:'https://i.scdn.co/image/abc123123'
 })});
};
function node(tag='div'){
 return {tagName:tag,className:'',children:[],style:{},attributes:{},
  scrollLeft:0,clientWidth:300,scrollWidth:1300,offsetLeft:0,
  appendChild(child){child.parentNode=this;this.children.push(child);return child;},
  removeChild(child){const i=this.children.indexOf(child);if(i>=0)this.children.splice(i,1);
    child.parentNode=null;return child;},
  setAttribute(k,v){this.attributes[k]=v;},
  getAttribute(k){return this.attributes[k];},
  get firstChild(){return this.children[0]||null;}
 };
}
const document={createElement:node};
vm.runInNewContext(schema,{window,Array,String,Object,JSON,Number,Error},{timeout:1000});
const API=window.VMM_LANDING_SCHEMA,defaults=API.defaults();
assert.equal(API.normalize(defaults).genres.songViewMode,'standard');
assert.equal(API.normalize({...defaults,genres:{...defaults.genres,songViewMode:'carousel'}})
 .genres.songViewMode,'carousel');
assert.equal(API.normalize({...defaults,genres:{...defaults.genres,songViewMode:undefined}})
 .genres.songViewMode,'standard','Older public documents retain original rows');
assert.throws(()=>API.normalize({...defaults,genres:{...defaults.genres,songViewMode:'bad'}}),
 /обычный показ или карусель/);
window.VMM_PUBLIC_LANDING={stopExternalPlayers(){}};
vm.runInNewContext(player,{window,document,Array,String,Number,Math,Error},{timeout:1000});
const engine=window.VELAR_PUBLIC_SONGS;
const songs=[
 {title:'Гамма',artist:'Velar',provider:'spotify',url:spotify2},
 {title:'Альфа',artist:'Velar',provider:'spotify',url:spotify,
   alternateProvider:'youtube',alternateUrl:yt},
 {title:'Бета',artist:'Velar',provider:'youtube',url:yt}
];
engine.configure('rows',[],'standard');
const old=node(),original=engine.mount(old,songs,{prefix:'topic'});
assert.equal(old.children.length,3,'Standard songs stay regular rows');
assert.ok(!old.className.includes('carousel'));
original.close();
engine.configure('rows',[],'carousel');
const list=node();
const carousel=engine.mount(list,songs,{prefix:'topic',batch:2});
assert.match(list.className,/public-song-carousel/);
assert.equal(list.children.length,2,'Accessible controls plus native scroll rail');
const [controls,rail]=list.children;
assert.equal(controls.children[1].textContent,'1 / 3');
assert.equal(rail.children[0].className.includes('carousel'),true);
assert.equal(rail.children[0].children[0].children[2].children[0].textContent,
 'Альфа','Carousel alphabetic order must not mutate source array');
assert.equal(songs[0].title,'Гамма');
assert.ok(rail.children[0].children[0].children[1].className.includes('artwork'));
assert.equal(rail.children[0].children[2].children.length,0,'No iframe before play');
const first=rail.children[0];
first.children[0].children[2].onclick();
assert.equal(first.children[2].children[0].tagName,'div','Spotify official iframe is inside masked viewport');
assert.equal(first.children[2].children[0].children[0].src,'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
first.children[0].children[2].onclick();
assert.equal(first.children[2].children.length,0,'Second click unloads the player');
controls.children[2].onclick();
assert.equal(controls.children[1].textContent,'2 / 3');
controls.children[2].onclick();
assert.equal(controls.children[1].textContent,'3 / 3','Arrow grows lazy batch');
assert.equal(rail.children.length,3,'All three songs after next advances beyond batch');
assert.equal(controls.children[2].disabled,true);
rail.scrollLeft=0;rail.onscroll();
assert.equal(typeof carousel.openByUrl,'function');
carousel.openByUrl(spotify);
assert.equal(controls.children[1].textContent,'1 / 3','Deep link reaches correct card');
await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
assert.ok(requests.some(url=>url.includes('open.spotify.com/oembed?url=')),
 'Only visible Spotify cards request official artwork');
assert.equal(first.children[0].children[1].children[0].tagName,'img','Artwork replaces music-note fallback');
assert.equal(first.children[0].children[1].children[0].src,'https://i.scdn.co/image/abc123123');
engine.configure('rows',[{visible:true,imageUrl:'https://example.com/owner-cover.jpg',
 tracks:[{url:spotify}]}],'carousel');
const owned=node();engine.mount(owned,[songs[1]],{prefix:'album'});
assert.equal(owned.children[1].children[0].children[0].children[1].children[0].src,
 'https://example.com/owner-cover.jpg','Curated album art has priority over Spotify oEmbed');
assert.match(read('studio/landing-editor.js'),/Оформление песен во всех разделах/);
assert.match(read('landing-public.js'),/value.genres.songViewMode/);
const css=read('style.css');
assert.match(css,/\.public-song-carousel-track\{/);
assert.match(css,/scroll-snap-type:x mandatory/);
assert.match(css,/-webkit-overflow-scrolling:touch/);
console.log('PASS RUN-106: global carousel, accessible arrows, native swipe, lazy artwork, curated covers, official click-to-play and legacy rows');
