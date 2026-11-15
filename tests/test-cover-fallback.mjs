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
// A manually uploaded cover must always take precedence, even when YouTube is first.
const manual='https://example.com/published-cover.jpg';
api.configure('rows',[],'standard',[],'youtube-first');
const manualHost=element('div');
api.mount(manualHost,[track],{prefix:'language',cover:manual,batch:1});
const manualHolder=manualHost.children[0].children[0].children.find(x=>x.className==='public-song-row-artwork');
assert.equal(manualHolder.children[0].src,manual,'Published manual cover wins over platform priority');
manualHolder.children[0].onerror();
assert.equal(manualHolder.children[0].src,yt,'Broken manual cover follows YouTube-first priority');
manualHolder.children[0].onerror();
assert.equal(manualHolder.children[0].src,'https://i.scdn.co/image/abc123',
 'Broken YouTube preview falls back to Spotify metadata after failed manual cover');
manualHolder.children[0].onerror();
assert.ok(manualHolder.children[0].className.includes('--empty'),
 'Three failed cover sources end in a stable placeholder');

// Existing Spotify-first behavior also honors a broken manually uploaded cover.
api.configure('rows',[],'standard',[],'spotify-first');
const manualSpotifyHost=element('div');
api.mount(manualSpotifyHost,[track],{prefix:'language',cover:manual,batch:1});
const manualSpotifyHolder=manualSpotifyHost.children[0].children[0].children.find(x=>x.className==='public-song-row-artwork');
manualSpotifyHolder.children[0].onerror();
assert.equal(manualSpotifyHolder.children[0].src,'https://i.scdn.co/image/abc123',
 'Manual cover failure should choose the published Spotify-first source');
manualSpotifyHolder.children[0].onerror();
assert.equal(manualSpotifyHolder.children[0].src,yt,'Spotify failure should still reach YouTube');
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
assert.equal(brokenArtwork.children[1].textContent,'♫','note persists through first source failure');
brokenArtwork.children[0].onerror();
assert.equal(brokenArtwork.children[0].className.includes('--empty'),true,
 'note remains after all image sources fail');
console.log('PASS RUN-124/125/126: ordered covers and visible note during stalled network');
