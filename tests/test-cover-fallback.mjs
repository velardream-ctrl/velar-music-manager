/* RUN-124: deterministic artwork fallback on older Safari and modern browsers. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={location:{search:''}};
const timers=[];
window.setTimeout=fn=>{timers.push(fn);return timers.length;};
window.clearTimeout=()=>{};
let resolveFetch;
window.fetch=()=>new Promise(resolve=>{resolveFetch=resolve;});
const nodes=[];
function element(tag){
  const e={tagName:tag,className:'',children:[],attributes:{},textContent:'',
    appendChild(x){x.parentNode=this;this.children.push(x);return x;},
    removeChild(x){this.children.splice(this.children.indexOf(x),1);return x;},
    get firstChild(){return this.children[0]||null;},
    setAttribute(k,v){this.attributes[k]=v;},
    getAttribute(k){return this.attributes[k];}};
  nodes.push(e);return e;
}
const document={createElement:element};
vm.runInNewContext(read('landing-schema.js'),{window,Array,String,Object,JSON,Number,Error});
vm.runInNewContext(read('image-loading.js'),{window,Array,Number,Math,Error});
vm.runInNewContext(read('public-song-ui.js'),{window,document,Array,String,Object,Number,Math,Error});
const api=window.VELAR_PUBLIC_SONGS;
const track={title:'Sample',provider:'spotify',url:'https://open.spotify.com/track/AAAAAAAAAAAAAAAAAAAAAA',
  alternateProvider:'youtube',alternateUrl:'https://www.youtube.com/watch?v=abcdefghijk'};
const yt='https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg';
let seen=[];
api.requestArtwork(track,x=>seen.push(x));
assert.equal(seen.length,0,'YouTube must not briefly display before Spotify resolves');
resolveFetch({ok:true,json:()=>Promise.resolve({thumbnail_url:'https://i.scdn.co/image/abc123'})});
for(let i=0;i<8;i++)await Promise.resolve();
assert.deepEqual(seen,['https://i.scdn.co/image/abc123']);
timers[0]();
assert.equal(seen.length,1,'late timeout must not swap cover');
api.configure('rows',[],'standard');
const host=element('div');
api.mount(host,[track],{prefix:'language',batch:1});
const label=host.children[0].children[0];
const holder=label.children.find(x=>x.className==='public-song-row-artwork');
assert.equal(holder.children[0].tagName,'img');
assert.equal(holder.children[0].src,'https://i.scdn.co/image/abc123');
holder.children[0].onerror();
assert.equal(holder.children[0].src,yt,'broken Spotify image should use YouTube');
holder.children[0].onerror();
assert.equal(holder.children[0].className.includes('--empty'),true,'broken YouTube cover must stop and use placeholder');
assert.equal(host.children[0].children[2].children.length,0,'never pre-open player');
// RUN-125: when YouTube is preferred, avoid Spotify metadata until a broken image.
api.configure('rows',[],'standard',[],'youtube-first');
const host2=element('div');
api.mount(host2,[track],{prefix:'language',batch:1});
const label2=host2.children[0].children[0];
const holder2=label2.children.find(x=>x.className==='public-song-row-artwork');
assert.equal(holder2.children[0].src,yt,'owner priority uses YouTube immediately');
holder2.children[0].onerror();
assert.equal(holder2.children[0].src,'https://i.scdn.co/image/abc123',
 'broken YouTube image must try Spotify before a placeholder');
holder2.children[0].onerror();
assert.equal(holder2.children[0].className.includes('--empty'),true,
 'both sources failing must not enter a retry loop');
console.log('PASS RUN-124/125: stable ordered covers and two-way fallbacks');
