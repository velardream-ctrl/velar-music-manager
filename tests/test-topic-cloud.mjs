import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),topics=read('topics-public.js'),playerUI=read('public-song-ui.js');
const html=read('index.html'),css=read('style.css'),sw=read('sw.js');
const admin=read('studio/landing-editor.js'),studio=read('studio/index.html'),universe=read('universe.js');
const window={};
vm.runInNewContext(schema,{window,Array,String,Number,Object,JSON,Math,Error},{timeout:1000});
const API=window.VMM_LANDING_SCHEMA,d=API.defaults();
assert.ok(d.genres.topics.entries.length>=20);
for(const code of ['love','wedding','loyalty','jealousy','faith','space','sadness','humor'])
 assert.ok(d.genres.topics.entries.some(x=>x.slug===code),'Missing theme: '+code);
assert.ok(d.genres.universe.nodes.some(x=>x.target==='topics'));
assert.ok(d.genres.topics.entries.every(x=>x.tracks.length===0),
 'Owner must assign real songs, no automatic guessed tags');
const spotify='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const yt='https://youtu.be/ABCDEFGHIjk';
const song={title:'Моя любовь',artist:'Velar',provider:'spotify',url:spotify,
 alternateProvider:'youtube',alternateUrl:'https://youtu.be/ZYXWVUTSRQP'};
const music={title:'Космос',artist:'DJ Velar',provider:'youtube',url:yt};
const tags=d.genres.topics.entries.map(t=>({
 ...t,tracks:t.slug==='love'?[song,music]:t.slug==='wedding'?[song]:[]
}));
const edited=API.normalize({...d,genres:{...d.genres,topics:{...d.genres.topics,entries:tags}}});
assert.equal(edited.genres.topics.entries.find(t=>t.slug==='love').tracks.length,2);
assert.equal(edited.genres.topics.entries.find(t=>t.slug==='wedding').tracks.length,1);
assert.equal(edited.genres.topics.entries.find(t=>t.slug==='wedding').tracks[0].url,spotify);
assert.equal(edited.genres.topics.entries.find(t=>t.slug==='wedding').tracks[0].alternateUrl,
 'https://www.youtube.com/watch?v=ZYXWVUTSRQP');
assert.equal(edited.genres.topics.entries.find(t=>t.slug==='love').tracks[1].url,
 'https://www.youtube.com/watch?v=ABCDEFGHIjk');
assert.equal(Object.keys(edited).sort().join(','),'about,albums,artists,genres,hero,releases');
assert.throws(()=>API.topicsConfig({entries:[{
 slug:'not-allowed',label:'Bad',visible:true,tracks:[{...song,url:'https://drive.google.com/private'}]
}]},d.genres.topics),/прямая ссылка/);
assert.throws(()=>API.topicsConfig({entries:[{
 slug:'love',label:'X',visible:true,tracks:[]},
 {slug:'love',label:'Y',visible:true,tracks:[]}
]},d.genres.topics),/уникальный/);
assert.throws(()=>API.topicsConfig({entries:Array.from({length:61},()=>({
 slug:'valid',label:'X',visible:true,tracks:[]
}))},d.genres.topics),/60/);
assert.throws(()=>API.universeConfig({nodes:[{
 id:'topics',label:'X',target:'https://evil.com',visible:true
}]},d.genres.universe),/раздел сайта/);
function el(tag='div'){
 return {tagName:tag,children:[],attributes:{},className:'',textContent:'',style:{},
  appendChild(x){this.children.push(x);x.parentNode=this;return x;},
  removeChild(x){this.children.splice(this.children.indexOf(x),1);x.parentNode=null;},
  get firstChild(){return this.children[0]||null;},
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}
 };
}
const nodes={};
for(const id of ['public-topic-orbit','public-topic-cloud','public-topic-detail','topics-title','topics-intro'])
 nodes[id]=el();
const document={readyState:'complete',getElementById:x=>nodes[x]||null,createElement:el};
let stopCalls=0;
window.VMM_PUBLIC_LANDING={stopExternalPlayers(){stopCalls++;}};
vm.runInNewContext(playerUI,{window,document,Array,String,Object,Number,Math,Error},{timeout:1000});
vm.runInNewContext(topics,{window,document,Array,String,Object,Number,Math,Error},{timeout:1000});
window.VELAR_TOPICS.render(edited.genres.topics);
assert.equal(nodes['public-topic-orbit'].children.length,10,
 'Only top ten selected topic planets render around the crystal');
assert.equal(nodes['public-topic-cloud'].children.length,tags.length,
 'Every visible tag appears in the complete accessible cloud');
assert.equal(nodes['public-topic-detail'].children[2].className,'topic-song-list');
const wedding=nodes['public-topic-cloud'].children.find(x=>x.textContent==='Свадьба');
assert.ok(wedding);
wedding.onclick();
assert.equal(wedding.attributes['aria-pressed'],'true');
assert.equal(nodes['public-topic-detail'].children[0].children[1].textContent,'Свадьба');
let detail=nodes['public-topic-detail'];
assert.equal(detail.children[2].children.length,1);
assert.equal(detail.children.length,3,'No bottom-of-list player');
const mediaFrame=holder=>{
 const first=holder.children[0];return first&&first.tagName==='iframe'?first:first&&first.children[0];
};
const weddingSong=detail.children[2].children[0];
assert.equal(weddingSong.children[1].children.length,2,'One song row offers Spotify + YouTube');
assert.equal(weddingSong.children[2].children.length,0,'No iframe until clicked');
weddingSong.children[1].children[0].onclick();
assert.equal(stopCalls,1);
assert.equal(mediaFrame(weddingSong.children[2]).tagName,'iframe');
assert.equal(weddingSong.children[2].children[0].className,'spotify-embed-viewport');
assert.equal(mediaFrame(weddingSong.children[2]).src,
 'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
assert.equal(mediaFrame(weddingSong.children[2]).attributes.allow.includes('autoplay'),false);
weddingSong.children[1].children[1].onclick();
assert.equal(stopCalls,2);
assert.equal(mediaFrame(weddingSong.children[2]).src,
 'https://www.youtube-nocookie.com/embed/ZYXWVUTSRQP',
 'YouTube plays in same inline slot, not a duplicate song');
const love=nodes['public-topic-cloud'].children.find(x=>x.textContent==='Любовь');
love.onclick();
detail=nodes['public-topic-detail'];
assert.equal(detail.children[2].children.length,2);
// RUN-104: published order [Моя, Космос] stays intact, rendered view is A–Я.
assert.equal(edited.genres.topics.entries.find(t=>t.slug==='love').tracks[0].title,'Моя любовь');
assert.equal(detail.children[2].children[0].children[0].children[1].children[0].textContent,
 'Космос','Alphabetical topic order places Космос before Моя любовь');
const firstSong=detail.children[2].children[0];
firstSong.children[1].children[0].onclick();
assert.equal(stopCalls,3);
assert.equal(firstSong.children[2].children[0].src,
 'https://www.youtube-nocookie.com/embed/ABCDEFGHIjk');
firstSong.children[2].children[2].onclick();
assert.equal(firstSong.children[2].children.length,0,'Closing topic player removes iframe');
assert.match(studio,/data-landing-tab="topics"/);
assert.match(admin,/function topicEditor/);
assert.match(admin,/checkbox\.onchange=function/);
assert.match(admin,/topics:'Темы песен'/);
assert.match(universe,/topics:'#topics'/);
assert.match(html,/id="public-topic-cloud"/);
assert.match(html,/id="public-topic-orbit"/);
assert.match(html,/topics-public\.js\?v=3/);
assert.match(html,/public-song-ui\.js\?v=9/);
assert.match(html,/<meta name="robots" content="noindex,nofollow,noarchive">/,
 'The user explicitly wants the developing website blocked from search indexing');
assert.match(css,/\.topic-tag\[aria-pressed=true\]/);
assert.match(sw,/'\.\/topics-public\.js\?v=3'/);
assert.match(sw,/CACHE_PREFIX \+ 'v46'/);
assert.match(sw,/STUDIO_PREFIX\+'v45'/);
assert.doesNotMatch(topics,/setTimeout\(|setInterval\(|fetch\(|firestore\(|autoplay=1|loop=1/);
console.log('PASS: RUN-073 topic cloud, multiple tags per song, curator-only catalog, noindex retained and no unrequested playback');
