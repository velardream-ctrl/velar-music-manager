/* RUN-096: album collections reuse official public track URLs, one album cover.
   Verify curated singles are NOT misrepresented as an official distributor album. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),albums=read('albums-public.js'),songUI=read('public-song-ui.js');
new vm.Script(schema);new vm.Script(albums);new vm.Script(songUI);
const window={};
vm.runInNewContext(schema,{window,Array,String,Object,Number,JSON,Error,Math},{timeout:1000});
const API=window.VMM_LANDING_SCHEMA,base=API.defaults();
const spotify='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const youtube='https://www.youtube.com/watch?v=ABCDEFGHIjk';
const sample={id:'northern-dreams',title:'Северные истории',artist:'Velar',
 description:'Собраны отдельные синглы.',visible:true,kind:'collection',
 imageUrl:'https://example.com/album-cover.jpg',mediaProvider:'spotify',mediaUrl:'',
 tracks:[{title:'Северный олень',artist:'Velar',provider:'spotify',url:spotify},
 {title:'Журавли',artist:'Velar',provider:'youtube',url:youtube}]};
const cfg=API.normalize({...base,albums:{...base.albums,trackView:'covers',entries:[sample]}});
assert.equal(cfg.albums.entries[0].kind,'collection');
assert.equal(cfg.albums.entries[0].tracks.length,2);
assert.equal(cfg.albums.trackView,'covers');
assert.equal(cfg.artists.featuredView,'classic','Legacy artist rows stay unchanged by default');
assert.equal(API.normalize({...base}).albums.entries.length,0,'Old saved pages do not invent albums');
assert.throws(()=>API.normalize({...base,albums:{...base.albums,entries:[{...sample,kind:'collection',mediaUrl:
 'https://open.spotify.com/album/ABCDEFGHIJKLMNOPQRSTUV'}]}}),/не должна выдавать/);
assert.throws(()=>API.normalize({...base,albums:{...base.albums,entries:[{...sample,kind:'official',mediaUrl:spotify}]}}),
 /именно на Spotify Album/);
assert.throws(()=>API.normalize({...base,albums:{...base.albums,entries:[{...sample,imageUrl:'https://drive.google.com/file/private'}]}}),
 /приватные ссылки/);
assert.throws(()=>API.normalize({...base,albums:{...base.albums,entries:[sample,{...sample}]}}),/уникальными/);
assert.throws(()=>API.normalize({...base,albums:{...base.albums,entries:Array(9).fill(sample)}}),/не более 8/);
assert.throws(()=>API.normalize({...base,albums:{...base.albums,entries:[{...sample,tracks:[
 {...sample.tracks[0],url:'https://evil.com/tracker'}]}]}}),/прямая ссылка/);
const official=API.normalize({...base,albums:{...base.albums,entries:[{
 ...sample,kind:'official',mediaUrl:'https://open.spotify.com/album/ABCDEFGHIJKLMNOPQRSTUV'
}]}}).albums.entries[0];
assert.equal(official.kind,'official');
assert.equal(official.mediaUrl,'https://open.spotify.com/album/ABCDEFGHIJKLMNOPQRSTUV');

function node(tag='div'){
 return {tagName:tag,children:[],className:'',attributes:{},textContent:'',style:{},
  appendChild(n){this.children.push(n);n.parentNode=this;return n;},
  removeChild(n){const i=this.children.indexOf(n);if(i>=0)this.children.splice(i,1);n.parentNode=null;return n;},
  get firstChild(){return this.children[0]||null;},
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}
 };
}
const nodes={};
for(const id of ['public-albums-cards','albums-title','public-albums-intro'])nodes[id]=node();
const document={getElementById:id=>nodes[id]||null,createElement:node};
let stopped=0;
window.VMM_PUBLIC_LANDING={stopExternalPlayers(){stopped++;}};
vm.runInNewContext(songUI,{window,document,Array,String,Object,Number,Math,Error},{timeout:1000});
vm.runInNewContext(albums,{window,document,Array,String,Object,Number,Math,Error},{timeout:1000});
window.VELAR_PUBLIC_SONGS.configure('covers',cfg.albums.entries);
window.VELAR_ALBUMS.render(cfg.albums);
assert.equal(nodes['public-albums-cards'].children.length,1);
const card=nodes['public-albums-cards'].children[0];
assert.equal(card.children[0].children[0].tagName,'img');
assert.equal(card.children[0].children[0].loading,'lazy');
assert.match(card.children[1].children[0].textContent,/КОЛЛЕКЦИЯ ИЗ СИНГЛОВ/);
const toggle=card.children[1].children.find(n=>n.tagName==='button');
assert.ok(toggle,'Album has expand/collapse button');
assert.equal(card.children[2].children.length,0,'No song/player before visitor click');
toggle.onclick();
assert.equal(toggle.attributes['aria-expanded'],'true');
const list=card.children[2];
assert.equal(list.children.length,2,'Two singles under one album cover');
const row=list.children[0],title=row.children[0];
assert.match(row.className,/public-song-entry--covers/);
assert.equal(title.children[1].tagName,'img','Thumbnail derives from owner-curated album cover');
const primary=row.children[1].children[0];
primary.onclick();
assert.equal(row.children[2].children[0].className,'spotify-embed-viewport');
assert.equal(stopped,1);
primary.onclick();
assert.equal(row.children[2].children.length,0,'Click second time unloads Spotify embed');
toggle.onclick();
assert.equal(card.children[2].children.length,0);
assert.equal(toggle.attributes['aria-expanded'],'false');
window.VELAR_ALBUMS.render({...cfg.albums,view:'list',entries:[official]});
assert.match(nodes['public-albums-cards'].className,/cms-album-gallery--list/);
assert.ok(nodes['public-albums-cards'].children[0].children[1].children.some(n=>n.tagName==='a'),
 'Officially released album has direct verified Spotify album link');
assert.match(read('index.html'),/id="albums"/);
assert.match(read('studio/index.html'),/data-landing-tab="albums"/);
assert.match(read('sw.js'),/\.\/albums-public\.js\?v=1/);
console.log('PASS: RUN-096 curated singles album, official release distinction, thumbnails, playback and draft-safe UI');
