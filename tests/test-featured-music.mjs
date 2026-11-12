import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schemaSrc=read('landing-schema.js'),publicSrc=read('landing-public.js');
const html=read('index.html'),css=read('style.css');
const editor=read('studio/landing-editor.js'),studio=read('studio/studio.js');
const workflows=read('studio/workflows.js'),sw=read('sw.js');
const w={};vm.runInNewContext(schemaSrc,{window:w,Array,String,Object,JSON,Number,Error},{timeout:1000});
const api=w.VMM_LANDING_SCHEMA;
assert.equal(api.songUrl('https://open.spotify.com/track/0123456789ABCDEFGHIJKL?si=test','spotify'),
  'https://open.spotify.com/track/0123456789ABCDEFGHIJKL');
assert.equal(api.songUrl('https://youtu.be/ABCDEFGHIjk?t=30','youtube'),
  'https://www.youtube.com/watch?v=ABCDEFGHIjk');
assert.equal(api.songUrl('https://www.youtube.com/watch?feature=share&v=ABCDEFGHIjk','youtube'),
  'https://www.youtube.com/watch?v=ABCDEFGHIjk');
for(const invalid of ['https://open.spotify.com/artist/0123456789ABCDEFGHIJKL',
  'https://open.spotify.com/album/0123456789ABCDEFGHIJKL',
  'https://drive.google.com/file/d/private',
  'javascript:alert(1)','https://attacker.example/track/0123456789ABCDEFGHIJKL']){
  assert.equal(api.songUrl(invalid,'spotify'),'');
}
assert.equal(api.songUrl('https://www.youtube.com/@djvelar','youtube'),'');
const original=api.defaults();
const s1={title:'Белая берёза',provider:'spotify',url:'https://open.spotify.com/track/0123456789ABCDEFGHIJKL'};
const s2={title:'Журавли',provider:'youtube',url:'https://youtu.be/ABCDEFGHIjk'};
const profile={title:'DJ Velar',artistId:'velar',visible:true,imageShape:'square',imageData:'',
  imageUrl:'https://example.com/velar.jpg',featuredTracks:[s1,s2]};
const other={title:'Илья Дмитриев',artistId:'ilya-dmitriev',visible:true,
  imageUrl:'https://example.com/ilya.jpg',featuredTracks:[s2]};
const page=api.normalize({...original,artists:{...original.artists,cards:[profile,other]}});
assert.equal(page.artists.cards[0].featuredTracks.length,2);
assert.equal(page.artists.cards[0].featuredTracks[1].url,'https://www.youtube.com/watch?v=ABCDEFGHIjk');
assert.deepEqual(Object.keys(page.artists.cards[0].featuredTracks[0]),['title','provider','url']);
assert.doesNotMatch(JSON.stringify(page),/privateRecording|sourceRow|accessToken/);
const invalid=(track)=>api.normalize({...original,artists:{...original.artists,cards:[{...profile,featuredTracks:[track]}]}});
assert.throws(()=>invalid({...s1,url:'https://open.spotify.com/artist/0123456789ABCDEFGHIJKL'}),/прямая ссылка/);
assert.throws(()=>invalid({...s1,provider:'vk'}),/Spotify или YouTube/);
assert.throws(()=>invalid({...s1,title:''}),/обязательно/);
assert.throws(()=>api.normalize({...original,artists:{...original.artists,cards:[
  {...profile,featuredTracks:[s1,s1]}
]}}),/повторов/);
assert.throws(()=>api.normalize({...original,artists:{...original.artists,cards:[
  {...profile,featuredTracks:[s1,s2,s1,s2]}
]}}),/не более трёх/);
assert.deepEqual(Array.from(api.normalize({...original,artists:{...original.artists,cards:[{
  ...profile,featuredTracks:undefined
}]}}).artists.cards[0].featuredTracks),[]);
const elements={};
function el(tag='div'){
 const node={tagName:tag,children:[],className:'',textContent:'',attributes:{},style:{},
  appendChild(child){this.children.push(child);return child;},
  removeChild(child){this.children.splice(this.children.indexOf(child),1);},
  get firstChild(){return this.children[0]||null;},
  setAttribute(name,value){this.attributes[name]=value;},
  getAttribute(name){return this.attributes[name];},
  set innerHTML(value){this._innerHTML=value;this.children=[];},
  get innerHTML(){return this._innerHTML||'';}
 };
 return node;
}
const ids=['public-hero-subtitle','public-hero-intro','artists-title','public-artists-intro',
 'releases-title','public-releases-intro','genres-title','public-genres-intro','about-title',
 'public-about-intro','public-about-notice','public-genres-tags','public-artists-cards',
 'public-releases-cards'];
for(const id of ids)elements[id]=el();
elements['public-artists-cards'].innerHTML='<p>СКОРО</p>';
elements['public-artists-cards'].className='feature feature-artists';
const document={readyState:'complete',getElementById:id=>elements[id]||null,createElement:el};
let listener=null;
const firebase={apps:[{}],firestore(){return {collection(){return {doc(){return {
 onSnapshot(fn){listener=fn;}
};}};}};}};
w.firebase=firebase;w.VELAR_FIREBASE_CONFIG={projectId:'test'};
vm.runInNewContext(publicSrc,{window:w,document,firebase,Array,Object,String,Error},{timeout:1000});
assert.equal(typeof listener,'function');
listener({exists:true,data:()=>({status:'published',schemaVersion:1,content:page})});
const host=elements['public-artists-cards'];
assert.equal(host.className,'cms-artist-stories');
assert.equal(host.children.length,2);
const first=host.children[0];
assert.equal(first.children[0].tagName,'article');
assert.match(first.children[1].className,/cms-music-panel/);
assert.match(host.children[1].className,/cms-artist-story--reverse/);
const panel=first.children[1],list=panel.children[1];
assert.equal(panel.children.length,2,'No single player after the whole best-songs list');
assert.equal(list.children.length,2);
const firstRow=list.children[0],secondRow=list.children[1];
const firstButton=firstRow.children[0],player=firstRow.children[1];
const secondButton=secondRow.children[0],secondPlayer=secondRow.children[1];
assert.match(firstRow.className,/cms-music-entry/);
const playIcon=firstButton.children[2];
assert.equal(playIcon.className,'cms-music-play-icon');
assert.equal(playIcon.textContent,'','Play icon must not be an OS-dependent emoji');
assert.equal(playIcon.attributes['aria-hidden'],'true');
assert.equal(firstButton.attributes['aria-label'],'Слушать: Белая берёза — Spotify');
assert.equal(player.children.length,0,'No iframe before explicit click');
firstButton.onclick();
assert.equal(player.children[0].tagName,'iframe','First song iframe is directly after first song button');
assert.equal(player.children[0].src,'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
assert.match(player.children[0].attributes.allow,/encrypted-media/);
assert.equal(player.children[0].loading,'lazy');
assert.equal(player.children[1].href,s1.url);
assert.equal(firstButton.attributes['aria-pressed'],'true');
assert.equal(secondPlayer.children.length,0);
// RUN-092: tap the same row again to UNLOAD the external player.
firstButton.onclick();
assert.equal(player.children.length,0,'Second tap removes Spotify iframe and external link');
assert.equal(firstButton.attributes['aria-pressed'],'false');
firstButton.onclick();
assert.equal(player.children[0].tagName,'iframe','Third tap opens the same song again');
secondButton.onclick();
assert.equal(player.children.length,0,'Opening second song destroys first song iframe');
assert.equal(secondPlayer.children.length,2,'Only one official iframe at a time');
assert.equal(secondPlayer.children[0].src,'https://www.youtube-nocookie.com/embed/ABCDEFGHIjk');
assert.equal(firstButton.attributes['aria-pressed'],'false');
assert.equal(secondButton.attributes['aria-pressed'],'true');
// User-reported case: a 3-song list must place first song iframe BEFORE rows 2 and 3.
const s3={title:'Ты моя Карелия',provider:'spotify',
 url:'https://open.spotify.com/track/ABCDEFGHIJKL0123456789'};
const three=api.normalize({...original,artists:{...original.artists,cards:[
 {...profile,featuredTracks:[s1,s2,s3]},other
]}});
listener({exists:true,data:()=>({status:'published',schemaVersion:1,content:three})});
const list3=host.children[0].children[1].children[1];
assert.equal(list3.children.length,3);
assert.equal(list3.children[0].children[1].children.length,0);
list3.children[0].children[0].onclick();
assert.equal(list3.children[0].children[1].children[0].tagName,'iframe');
list3.children[0].children[0].onclick();
assert.equal(list3.children[0].children[1].children.length,0,'First of three closes on repeat tap');
list3.children[0].children[0].onclick();
assert.equal(list3.children[0].children[1].children[0].tagName,'iframe');
assert.equal(list3.children[1].children[1].children.length,0);
assert.equal(list3.children[2].children[1].children.length,0);
assert.match(css,/\.cms-music-entry>\.cms-music-player:not\(:empty\)/);
const plain=api.normalize({...original,artists:{...original.artists,cards:[
 {...profile,featuredTracks:[]},{...other,featuredTracks:[]}
]}});
listener({exists:true,data:()=>({status:'published',schemaVersion:1,content:plain})});
assert.match(host.className,/cms-artist-tiles/);
assert.equal(host.children[0].tagName,'article');
assert.match(css,/#artists\.showcase\{display:block/);
assert.match(css,/cms-artist-story--reverse/);
assert.match(css,/@media\(max-width:800px\)/);
assert.match(editor,/function artistMusicControls/);
assert.match(editor,/effective\(t,trackLinks\.overrides\)/);
assert.match(editor,/selected\.length>=3/);
assert.match(editor,/markChanged\(\)/);
assert.match(studio,/show\(el\('vmm-workflows'\),false\)/);
assert.match(workflows,/show\(id\('panel-landing'\),false\)/);
assert.match(html,/style\.css\?v=28/);
assert.match(html,/landing-public\.js\?v=12/);
assert.match(sw,/CACHE_PREFIX \+ 'v33'/);
assert.match(css,/\.cms-music-play-icon::before\{/);
assert.match(css,/border-left:10px solid currentColor/);
assert.match(css,/\.cms-card-link::after\{/);
assert.match(css,/\.public-ui-arrow\{/);
assert.doesNotMatch(publicSrc,/cms-music-play-icon','▶'/);
assert.doesNotMatch(read('studio/recordings.js'),/▶|☁/);
assert.match(read('studio/recordings.css'),/vmm-r-inline-play::before/);
assert.doesNotMatch(read('studio/recordings.css'),/content:'▸'|content:'▾'/);
assert.doesNotMatch(read('studio/workflows.js'),/esc\(text\)\+' ↗'/);
assert.doesNotMatch(html,/Листайте дальше <span aria-hidden="true">↓/);
assert.match(html,/class="public-ui-arrow"/);
console.log('PASS: RUN-067/068 curated official embeds, vector gold play icons, emoji-free playback, responsive gallery');
