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
  const e={tagName:tag,className:'',children:[],attributes:{},textContent:'',style:{},
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
assert.equal(holder.children[0].className.includes('--empty'),true,
 'Spotify image failure must show the local note, never a YouTube image');
assert.equal(host.children[0].children[2].children.length,0,'never pre-open player');
// Spotify-only artwork policy is independent of legacy stored priority.
api.configure('rows',[],'standard',[],'youtube-first');
const host2=element('div');
api.mount(host2,[track],{prefix:'language',batch:1});
const holder2=host2.children[0].children[0].children.find(x=>x.className==='public-song-row-artwork');
assert.equal(holder2.children[0].src,'https://i.scdn.co/image/abc123',
 'YouTube-first setting must not replace Spotify artwork');
holder2.children[0].onerror();
assert.equal(holder2.children[0].className.includes('--empty'),true);
const manual='https://example.com/published-cover.jpg';
const manualHost=element('div');
api.mount(manualHost,[track],{prefix:'language',cover:manual,batch:1});
const manualHolder=manualHost.children[0].children[0].children.find(x=>x.className==='public-song-row-artwork');
assert.equal(manualHolder.children[0].src,'https://i.scdn.co/image/abc123',
 'Manual art cannot override the Spotify-only policy');
// RUN-126: on poor mobile networks a pending image must leave a local note
// visible in the same square. Only actual onload may remove the note.
api.configure('rows',[],'carousel',[],'youtube-first');
const slowHost=element('div');
api.mount(slowHost,[track],{prefix:'language',batch:1});
const slowRail=slowHost.children[1];
const slowCard=slowRail.children[0];
const slowArtwork=slowCard.children[0].children.find(x=>x.className==='public-song-artwork');
assert.ok(slowArtwork,'carousel must have a square artwork holder');
assert.equal(slowArtwork.children[0].tagName,'img');
assert.equal(slowArtwork.children[0].style.visibility,'hidden',
 'unfinished image should not paint over the note');
assert.equal(slowArtwork.children[1].textContent,'♫','note is visible even if network hangs');
slowArtwork.children[0].onload();
assert.equal(slowArtwork.children[0].style.visibility,'visible','only loaded artwork replaces note');
assert.equal(slowArtwork.children.length,1,'remove note after real image load');
api.configure('rows',[],'carousel',[],'spotify-first');
const brokenHost=element('div');
api.mount(brokenHost,[track],{prefix:'language',batch:1});
const brokenArtwork=brokenHost.children[1].children[0].children[0].children.find(x=>x.className==='public-song-artwork');
assert.equal(brokenArtwork.children[1].textContent,'♫');
brokenArtwork.children[0].onerror();
assert.equal(brokenArtwork.children.length,1,
 'Failed Spotify image must leave one stable local note, not another network image');
assert.equal(brokenArtwork.children[0].textContent,'♫',
 'Spotify-only fallback remains a local note');
console.log('PASS RUN-132: Spotify-only covers and visible note during stalled network');
