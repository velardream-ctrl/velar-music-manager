/* RUN-121/123: images still load eagerly by default; lazy modes are opt-in. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const publicFiles=[
  'index.html','landing-public.js','public-song-ui.js',
  'albums-public.js','universe.js','artist-detail.js'
];
for(const file of publicFiles){
  const source=read(file);
  if(file.endsWith('.html')){
    assert.doesNotMatch(source,/<img\b[^>]*loading=["']lazy["']/is,file+' contains lazy image markup');
  }else{
    assert.doesNotMatch(source,/\b(?:img|image|artwork|thumb|coverImage|crystal)\.loading\s*=\s*["']lazy["']/,
      file+' still lazily loads its rendered images');
  }
}
const songSource=read('public-song-ui.js');
assert.doesNotMatch(songSource,/coverRequests|function loadNear\(/,
  'All published cover lookups should start when cards render, not on swipe/focus');
assert.ok(songSource.includes('window.VELAR_IMAGE_LOADING.apply'));
const landing=read('landing-public.js');
assert.ok(landing.includes('setImageLoading(img,index)'));
assert.ok(read('albums-public.js').includes('window.VELAR_IMAGE_LOADING.apply'));
assert.ok(read('universe.js').includes('window.VELAR_IMAGE_LOADING.apply'));
assert.ok(read('artist-detail.js').includes('window.VELAR_IMAGE_LOADING.apply'));
const index=read('index.html'),artist=read('artist.html'),sw=read('sw.js');
for(const versioned of [
  'landing-public.js?v=62&clips=1','universe.js?v=7','public-song-ui.js?v=25&clips=1','albums-public.js?v=4'
]){
  assert.ok(index.includes(versioned),'Homepage must load '+versioned);
  assert.ok(sw.includes('./'+versioned),'Service worker should precache '+versioned);
}
assert.ok(artist.includes('artist-detail.js?v=5'));
assert.ok(sw.includes('./artist-detail.js?v=5'));
assert.ok(sw.includes("CACHE_PREFIX + 'v98'"));
assert.match(read('public-song-ui.js'),/frame\.loading='lazy'/,
  'Music players remain click-to-open without preloading');
const window={location:{search:''}};const promises=[],requests=[];
window.fetch=url=>{
  requests.push(url);
  return new Promise(resolve=>promises.push(resolve));
};
function node(tag='div'){
  return {tagName:tag,className:'',textContent:'',children:[],attributes:{},style:{},
    scrollLeft:0,clientWidth:320,scrollWidth:1300,offsetLeft:0,
    appendChild(child){this.children.push(child);child.parentNode=this;return child;},
    removeChild(child){const i=this.children.indexOf(child);if(i>=0)this.children.splice(i,1);return child;},
    setAttribute(k,v){this.attributes[k]=v;},
    get firstChild(){return this.children[0]||null;},
    getAttribute(k){return this.attributes[k];}};
}
const document={createElement:node};
vm.runInNewContext(read('landing-schema.js'),{window,Array,String,Object,JSON,Number,Error},{timeout:1200});
vm.runInNewContext(read('image-loading.js'),{window,Array,Number,Math,Error},{timeout:1200});
window.VELAR_IMAGE_LOADING.configure(0);
vm.runInNewContext(songSource,{window,document,Array,String,Object,Number,Math,Error},{timeout:1200});
const tracks=Array.from({length:6},(_,i)=>({
  title:'Песня '+(i+1),artist:'Velar',provider:'spotify',
  url:'https://open.spotify.com/track/'+String(i+1).padStart(22,'A')
}));
const host=node();
window.VELAR_PUBLIC_SONGS.configure('rows',[],'standard');
window.VELAR_PUBLIC_SONGS.mount(host,tracks,{prefix:'language',batch:6});
assert.equal(host.children.length,6);
assert.equal(requests.length,6,
  'All six visible song cards must immediately request artwork, including item 5 and 6');
for(const item of host.children){
  assert.equal(item.children.find(x=>String(x.className).includes('public-song-inline')).children.length,0,'No Spotify iframe before playback');
}
for(const complete of promises)
  complete({ok:true,json:()=>Promise.resolve({thumbnail_url:'https://i.scdn.co/image/abc123123'})});
await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
for(const item of host.children){
  const label=item.children[0];
  const img=label.children.find(x=>x.tagName==='span'&&x.className==='public-song-row-artwork');
  assert.ok(img&&img.children.length===1,'Each row should have its cover');
  assert.equal(img.children[0].tagName,'img');
  assert.equal(img.children[0].loading,'eager');
}
console.log('PASS RUN-121/123: default eager mode fetches all displayed covers, audio embeds remain click-only');
