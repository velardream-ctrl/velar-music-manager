import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),langs=read('languages-public.js'),universe=read('universe.js'),playerUI=read('public-song-ui.js');
const html=read('index.html'),css=read('style.css'),admin=read('studio/landing-editor.js');
const sw=read('sw.js'),rules=read('firestore.rules');
const win={};
vm.runInNewContext(schema,{window:win,Array,String,Number,Object,JSON,Error},{timeout:1000});
const api=win.VMM_LANDING_SCHEMA;
const defaults=api.defaults();
assert.equal(defaults.genres.universe.nodes.length,8);
assert.equal(defaults.genres.languages.entries.length,13);
assert.equal(defaults.genres.languages.entries.filter(x=>x.fictional).length,2);
assert.equal(defaults.genres.languages.entries.some(x=>x.code==='zh'),false,
 'Chinese full songs were not yet verified');
assert.equal(defaults.genres.languages.entries.every(x=>x.tracks.length===0),true,
 'Never assume unreleased or privately stored songs are public');
assert.equal(api.normalize({...defaults}).genres.universe.nodes.length,8);
const t1={title:'Noche de Bachata',artist:'DJ Velar',provider:'spotify',
 url:'https://open.spotify.com/track/0123456789ABCDEFGHIJKL'};
// Keep the Spotify fixture first alphabetically while testing one inline player per row.
const t2={title:'Zumba Rave',artist:'DJ Velar',provider:'youtube',url:'https://youtu.be/ABCDEFGHIjk'};
const entries=defaults.genres.languages.entries.map(x=>({
 ...x,tracks:x.code==='es'?[t1,t2]:x.code==='alien'?[t2]:[]
}));
const page=api.normalize({...defaults,genres:{...defaults.genres,
 universe:{...defaults.genres.universe,nodes:[
   ...defaults.genres.universe.nodes,
   {id:'creative-gallery',label:'Арт-галерея',description:'Цифровые формы музыки',
    target:'languages',visible:false}
 ]},
 languages:{...defaults.genres.languages,entries}
}});
assert.equal(page.genres.languages.entries.find(x=>x.code==='es').tracks.length,2);
assert.equal(page.genres.universe.nodes.length,9);
assert.equal(page.genres.universe.nodes[8].visible,false);
assert.deepEqual(Object.keys(page.genres.languages.entries.find(x=>x.code==='es').tracks[0]),
 ['title','artist','provider','url']);
assert.doesNotMatch(JSON.stringify(page),/privateRecording|DriveFile|accessToken|lyricsDocument/);
// RUN-090: legacy Spotify + YouTube entries representing one composition
// consolidate into a single row, preserving the FIRST provider and order.
const bothLegacy=api.normalize({...defaults,genres:{...defaults.genres,
 languages:{...defaults.genres.languages,entries:defaults.genres.languages.entries.map(x=>({
  ...x,tracks:x.code==='en'?[t1,{...t1,provider:'youtube',url:t2.url}]:[]
 }))}}});
const merged=bothLegacy.genres.languages.entries.find(x=>x.code==='en').tracks;
assert.equal(merged.length,1);
assert.equal(merged[0].provider,'spotify');
assert.equal(merged[0].alternateProvider,'youtube');
assert.equal(merged[0].alternateUrl,'https://www.youtube.com/watch?v=ABCDEFGHIjk');
assert.equal(api.languageTrack(merged[0],1).alternateProvider,'youtube');
assert.throws(()=>api.languageTrack({...merged[0],alternateUrl:'https://drive.google.com/private'},1),/прямая ссылка/);
assert.throws(()=>api.languageTrack({...merged[0],alternateProvider:'spotify'},1),/отличаться/);

assert.throws(()=>api.languagesConfig({entries:[{code:'es',label:'X',visible:true,tracks:[
 {...t1,url:'https://drive.google.com/file/d/secret'}]}]},defaults.genres.languages),/прямая ссылка/);
assert.throws(()=>api.languagesConfig({entries:[
 {code:'es',label:'Испанский',visible:true,tracks:[]},
 {code:'es',label:'Второй',visible:true,tracks:[]}
]},defaults.genres.languages),/уникальными/);
assert.throws(()=>api.universeConfig({nodes:[
 {id:'xx',label:'X',target:'https://example.com',visible:true}]},defaults.genres.universe),/раздел сайта/);
assert.throws(()=>api.universeConfig({nodes:Array(13).fill({
 id:'world-1',label:'World',target:'artists',visible:true
})},defaults.genres.universe),/12/);
assert.match(rules,/content\.keys\(\)\.hasOnly\(\[/);
assert.match(rules,/'hero','artists','albums','releases','genres','about'/);
assert.doesNotMatch(JSON.stringify(page),/"contentSecret"/);

function node(tag='div'){
 const n={tagName:tag,className:'',children:[],attributes:{},style:{},textContent:'',
  appendChild(c){c.parentNode=this;this.children.push(c);return c;},
  removeChild(c){this.children.splice(this.children.indexOf(c),1);c.parentNode=null;},
  get firstChild(){return this.children[0]||null;},
  setAttribute(k,v){this.attributes[k]=v;},
  getAttribute(k){return this.attributes[k];}};
 return n;
}
const ids=['public-language-orbit','public-language-detail','languages-title','languages-intro',
 'velar-universe-toggle','velar-universe-panel','velar-universe-stage','velar-universe-details',
 'hero-crystal-link','universe-orbit-left','universe-orbit-right','universe-title','universe-intro'];
const elements={};for(const key of ids)elements[key]=node();
elements['velar-universe-panel'].className='universe-panel hidden';
const doc={readyState:'complete',getElementById:key=>elements[key]||null,createElement:node};
let stopped=0;win.VMM_PUBLIC_LANDING={stopExternalPlayers(){stopped++;}};
win.matchMedia=()=>({matches:false});
vm.runInNewContext(playerUI,{window:win,document:doc,Array,String,Object,Number,Math,Error},{timeout:1000});
vm.runInNewContext(langs,{window:win,document:doc,Array,String,Object,Number,Math,Error},{timeout:1000});
vm.runInNewContext(universe,{window:win,document:doc,Array,String,Object,Number,Math,Error},{timeout:1000});
win.VELAR_LANGUAGES.render(page.genres.languages);
assert.equal(elements['public-language-orbit'].children.length,13);
assert.equal(elements['public-language-detail'].children.length,2);
assert.equal(elements['public-language-detail'].children[1].className,'language-empty');
const es=elements['public-language-orbit'].children.find(n=>n.attributes['aria-label']==='Выбрать язык: Испанский');
assert.ok(es);
es.onclick();
assert.equal(es.attributes['aria-pressed'],'true');
const detail=elements['public-language-detail'];
assert.equal(detail.children[1].textContent.includes('2'),true);
const list=detail.children[2];
assert.equal(detail.children.length,3,'No extra player at bottom of list');
assert.equal(list.children.length,2);
const mediaFrame=holder=>{
 const first=holder.children[0];return first&&first.tagName==='iframe'?first:first&&first.children[0];
};
const firstRow=list.children[0],secondRow=list.children[1];
assert.equal(firstRow.children[2].children.length,0,'No iframe before visitor clicks');
firstRow.children[0].children[1].onclick(); // song title opens primary
assert.equal(stopped,1,'Other external players are stopped before opening a song');
assert.equal(firstRow.children[2].children[0].className,'spotify-embed-viewport');
assert.equal(mediaFrame(firstRow.children[2]).tagName,'iframe',
 'Inline iframe is immediately after the first clicked song, before next row');
assert.equal(mediaFrame(firstRow.children[2]).src,'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
assert.equal(mediaFrame(firstRow.children[2]).attributes.allow.includes('autoplay'),false);
secondRow.children[1].children[0].onclick();
assert.equal(stopped,2);
assert.equal(firstRow.children[2].children.length,0,'Opening another song closes the previous iframe');
assert.equal(secondRow.children[2].children.length,3);
assert.equal(secondRow.children[2].children[0].src,'https://www.youtube-nocookie.com/embed/ABCDEFGHIjk');
secondRow.children[2].children[2].onclick();
assert.equal(secondRow.children[2].children.length,0,'Closing removes third-party iframe');
const alien=elements['public-language-orbit'].children.find(n=>n.attributes['aria-label'].includes('Инопланетный'));
alien.onclick();
assert.equal(elements['public-language-detail'].children[0].children[0].textContent,'АВТОРСКИЙ ВЫМЫШЛЕННЫЙ ЯЗЫК');
win.VELAR_UNIVERSE.render(page);
assert.equal(elements['universe-title'].textContent,page.genres.universe.heading);
assert.equal(typeof elements['velar-universe-toggle'].onclick,'function');
elements['velar-universe-toggle'].onclick();
const stage=elements['velar-universe-stage'];
assert.equal(stage.children.length,8,'Seven visible navigation buttons; radio is hidden while disabled; plus official crystal');
assert.equal(stage.children[0].children[1].src,'assets/velardream-symbol.svg');
const languageNode=stage.children.filter(function(n){return n.attributes&&n.attributes['aria-label']==='Выбрать созвездие: Миры языков';})[0];
assert.ok(languageNode,'Language constellation remains accessible without disabled radio node');
languageNode.onclick();
assert.equal(elements['velar-universe-details'].children.at(-1).href,'#languages');
assert.match(languageNode.attributes['aria-pressed'],/true/);
const xBefore=stage.children[1].style.left;
elements['universe-orbit-right'].onclick();
assert.notEqual(stage.children[1].style.left,xBefore,'Manual orbit changes node positions');
const custom={...page,genres:{...page.genres,universe:{
 ...page.genres.universe,nodes:[
   {id:'my-world',label:'Мой музыкальный мир',target:'languages',description:'Мой новый раздел',visible:true},
   {id:'about',label:'О нас',target:'about',visible:true}
 ]}}};
win.VELAR_UNIVERSE.render(custom);
assert.equal(stage.children.length,3,'Admin-managed node deletion changes public orbit');
stage.children[1].onclick();
assert.equal(elements['velar-universe-details'].children[1].textContent,'Мой музыкальный мир');
assert.equal(elements['velar-universe-details'].children.at(-1).href,'#languages');
assert.match(admin,/function universeEditor/);
assert.match(admin,/function languageEditor/);
assert.match(admin,/API\.songUrl\(urls\.spotify/);
assert.match(html,/id="languages"/);
assert.match(html,/src="assets\/velardream-symbol.svg"/);
assert.match(html,/languages-public\.js\?v=3/);
assert.match(html,/public-song-ui\.js\?v=10/);
assert.match(sw,/'\.\/public-song-ui\.js\?v=10'/);
assert.match(css,/\.language-orbit-node\[aria-pressed=true\]/);
assert.match(css,/\.language-song-play::before/);
assert.match(sw,/'\.\/languages-public\.js\?v=3'/);
assert.doesNotMatch(langs,/setInterval\(|setTimeout\(|firestore\(|fetch\(/);
assert.doesNotMatch(universe,/setInterval\(|setTimeout\(|firestore\(|fetch\(/);
console.log('PASS: RUN-072 editable constellations and languages, genuine crystal, sanitized catalog links, one visitor-clicked player, no extra reads');
