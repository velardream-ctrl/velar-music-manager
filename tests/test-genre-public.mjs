/* RUN-178/179: genre metadata is curated by song ID; full provider links
   appear on the public page without extra admin provider checkboxes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),genreCode=read('genres-public.js'),playerCode=read('public-song-ui.js');
new vm.Script(schema);new vm.Script(genreCode);new vm.Script(playerCode);
const win={};
vm.runInNewContext(schema,{window:win,Array,String,Object,Number,JSON,Error,Math},{timeout:1000});
const api=win.VMM_LANDING_SCHEMA,legacy=api.defaults();
const migrated=api.normalize(legacy);
assert.equal(migrated.genres.entries.length,legacy.genres.tags.length,
 'All legacy genre labels must survive the upgrade');
assert.equal(migrated.genres.entries[0].label,'Опера');
assert.equal(migrated.genres.entries[0].songIds.length,0);
assert.equal(migrated.genres.entries[0].visible,true);
const spotify='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const youtube='https://www.youtube.com/watch?v=ABCDEFGHIjk';
const apple='https://music.apple.com/fi/album/white-birch/1234567890?i=1234567891';
const song={title:'Белая берёза',artist:'Velar',provider:'spotify',url:spotify,
 alternateProvider:'youtube',alternateUrl:youtube,thirdProvider:'appleMusic',thirdUrl:apple};
const group={id:'genre-1',label:'Новая опера',songIds:['songVelar1'],visible:true,tracks:[song]};
const group2={id:'genre-2',label:'Поп',songIds:['songVelar1'],visible:true,tracks:[song]};
const content=api.normalize({...legacy,genres:{...legacy.genres,entries:[group,group2]}});
assert.equal(content.genres.entries[0].tracks[0].thirdUrl,apple);
assert.deepEqual(Array.from(content.genres.entries.map(x=>x.songIds[0])),['songVelar1','songVelar1']);
assert.throws(()=>api.normalize({...legacy,genres:{...legacy.genres,entries:[
 {...group,songIds:['songVelar1','songVelar1']}]} }),/повторяющийся ID/);
assert.throws(()=>api.normalize({...legacy,genres:{...legacy.genres,entries:[
 {...group,tracks:[{...song,thirdUrl:'https://drive.google.com/private'}]}]} }),/прямая ссылка/);
function element(tag='div'){
 const n={tagName:tag,className:'',children:[],attributes:{},style:{},textContent:'',
  appendChild(child){this.children.push(child);child.parentNode=this;return child;},
  removeChild(child){const i=this.children.indexOf(child);if(i>=0)this.children.splice(i,1);return child;},
  get firstChild(){return this.children[0]||null;},
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}
 };
 return n;
}
const nodes={'public-genres-tags':element(),'public-genre-detail':element()};
const doc={getElementById:id=>nodes[id]||null,createElement:element};
win.VMM_PUBLIC_LANDING={stopExternalPlayers(){}};
vm.runInNewContext(playerCode,{window:win,document:doc,Array,String,Object,Number,JSON,Error,Math},{timeout:1000});
vm.runInNewContext(genreCode,{window:win,document:doc,Array,String,Object,Number,JSON,Error,Math},{timeout:1000});
win.VELAR_GENRES.render(content.genres);
assert.equal(nodes['public-genres-tags'].children.length,2);
assert.equal(nodes['public-genres-tags'].children[0].tagName,'button');
assert.equal(nodes['public-genre-detail'].children[0].textContent,'Новая опера');
assert.equal(nodes['public-genre-detail'].children[2].children.length,1);
const songRow=nodes['public-genre-detail'].children[2].children[0];
const buttons=songRow.children.find(n=>n.className==='public-song-platforms');
const slot=songRow.children.find(n=>String(n.className).indexOf('public-song-inline')>=0);
assert.equal(buttons.children.length,3,'All 3 official sources offered automatically');
assert.equal(slot.children.length,0,'Media iframe must not preload or autoplay');
assert.equal(buttons.children[2].attributes['data-provider'],'appleMusic');
buttons.children[2].onclick();
assert.equal(slot.children[1].tagName,'iframe');
assert.equal(slot.children[1].src,apple.replace('https://music.apple.com/','https://embed.music.apple.com/'));
buttons.children[2].onclick();
assert.equal(slot.children.length,0,'Repeat press closes Apple Music player');
nodes['public-genres-tags'].children[1].onclick();
assert.equal(nodes['public-genre-detail'].children[0].textContent,'Поп');
assert.equal(nodes['public-genre-detail'].children[2].children.length,1);
assert.match(read('studio/landing-editor.js'),/genreEditor\(panel\)/);
assert.match(read('studio/landing-editor.js'),/songIds\.push\(song\.id\)/);
assert.match(read('index.html'),/genres-public\.js\?v=1/);
assert.match(read('sw.js'),/genres-public\.js\?v=1/);
console.log('PASS: genre checkboxes, legacy tag migration, renaming and automatic Spotify/YouTube/Apple Music playback');
