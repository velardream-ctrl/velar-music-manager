/* RUN-112 — no public Firestore reads/writes, unified smart index and
   authorized draft-only assignment checks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const win={};
function element(tag='div'){
 return {tagName:tag,className:'',children:[],textContent:'',value:'',disabled:false,
  attributes:{},appendChild(item){this.children.push(item);return item;},
  removeChild(item){this.children.splice(this.children.indexOf(item),1);},
  setAttribute(k,v){this.attributes[k]=v;},
  get firstChild(){return this.children[0]||null;}};
}
const document={createElement:element};
const ctx={window:win,document,Array,String,Object,JSON,Math,Number,Error};
vm.runInNewContext(read('landing-schema.js'),ctx,{timeout:1200});
vm.runInNewContext(read('studio/song-distribution.js'),ctx,{timeout:1200});
const API=win.VMM_LANDING_SCHEMA,dist=win.VMM_SONG_DISTRIBUTION;
assert.equal(typeof dist.build,'function');
assert.equal(typeof dist.render,'function');
const spotifyA='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const spotifyB='https://open.spotify.com/track/ABCDEFGHIJKL0123456789';
const youtubeA='https://www.youtube.com/watch?v=ABCDEFGHIjk';
const catalog=[
 {id:'one',title:'Дикая вишня',artist:'Velar',links:{spotify:spotifyA,youtube:youtubeA}},
 {id:'two',title:'Дикая вишня',artist:'Другой исполнитель',links:{spotify:spotifyB}},
 {id:'three',title:'Без ссылок',artist:'Velar',links:{}}
];
const clone=x=>JSON.parse(JSON.stringify(x));
const draft=clone(API.normalize(API.defaults()));
const live=clone(draft);
const topic=draft.genres.topics.entries[0];
const language=draft.genres.languages.entries[0];
const effective=s=>s.artist==='Velar'?'velar':'other';
const index=()=>dist.build(catalog,draft,live,{overrides:{}},API,effective);
assert.equal(index().rows.length,3,'Index includes songs without public links');
assert.equal(index().counts.without,3);
assert.equal(index().counts.noSource,1);
assert.equal(dist.search(index(),'вишня','all','all').length,2);
assert.equal(dist.search(index(),'ДИКАЯ ёишня','all','all').length,0);
assert.equal(dist.search(index(),'другая', 'all','all').length,0);
assert.equal(dist.search(index(),'вишня', 'all','all')[0].title,'Дикая вишня');
assert.equal(dist.search(index(),'links','all','all').length,0);
assert.throws(()=>dist.modify(catalog,draft,{songId:'three',kind:'topic',targetId:topic.slug,enabled:true},API,effective,{}),/нет проверенной/);
assert.equal(dist.modify(catalog,draft,{songId:'one',kind:'topic',targetId:topic.slug,enabled:true},API,effective,{}),true);
assert.equal(topic.tracks.length,1);
assert.equal(topic.tracks[0].provider,'spotify');
assert.equal(topic.tracks[0].alternateProvider,'youtube');
assert.equal(dist.modify(catalog,draft,{songId:'one',kind:'topic',targetId:topic.slug,enabled:true},API,effective,{}),false);
assert.equal(topic.tracks.length,1,'Repeat assignment does not duplicate');
assert.equal(dist.modify(catalog,draft,{songId:'one',kind:'language',targetId:language.code,enabled:true},API,effective,{}),true);
assert.equal(language.tracks.length,1);
assert.equal(index().counts.many,1);
assert.equal(dist.search(index(),'','many','all').length,1,'Smart metadata index finds duplicate-category assignments');
assert.equal(dist.search(index(),'','without','all').length,2);
assert.equal(dist.search(index(),'','all','topic:'+topic.slug).length,1);
assert.ok(index().byId.one.draft.some(x=>x.kind==='language'));
assert.equal(index().byId.one.artistId,'velar');
assert.ok(index().byId.one.display.some(x=>x.stage==='draft'),'Draft-only assignments are never marked published');
assert.equal(live.genres.topics.entries[0].tracks.length,0,'Draft edits NEVER publish');
assert.doesNotThrow(()=>API.normalize(draft),'Shared editor must produce normalized, valid landing document');
draft.albums.entries.push({id:'test-album',title:'Заметки',kind:'collection',
 artist:'Velar',description:'',visible:false,tracks:[]});
assert.equal(dist.modify(catalog,draft,{songId:'one',kind:'album',targetId:'test-album',enabled:true},API,effective,{}),true);
assert.equal(draft.albums.entries[0].tracks.length,1);
assert.doesNotThrow(()=>API.normalize(draft));
assert.equal(dist.modify(catalog,draft,{songId:'one',kind:'album',targetId:'test-album',enabled:false},API,effective,{}),true);
assert.equal(draft.albums.entries[0].tracks.length,0);
assert.equal(dist.modify(catalog,draft,{songId:'one',kind:'topic',targetId:topic.slug,enabled:false},API,effective,{}),true);
assert.equal(topic.tracks.length,0);
assert.equal(language.tracks.length,1,'Removing topic does not touch language assignment');
assert.equal(dist.search(index(),'','many','all').length,0);
draft.artists.cards.push({artistId:'velar',title:'Velar',visible:false,featuredTracks:[]});
assert.equal(dist.modify(catalog,draft,{songId:'one',kind:'featured',targetId:'velar',enabled:true},API,effective,{}),true);
assert.equal(draft.artists.cards[0].featuredTracks.length,1);
assert.throws(()=>dist.modify(catalog,draft,{songId:'two',kind:'featured',targetId:'velar',enabled:true},API,effective,{}),/сначала назначь/);
assert.doesNotThrow(()=>API.normalize(draft));
const ambiguated=catalog.concat([{id:'four',title:'Другой трек',artist:'Velar',links:{spotify:spotifyA}}]);
assert.equal(dist.build(ambiguated,draft,live,{},API,effective).byId.one.ambiguous,true);
assert.throws(()=>dist.modify(ambiguated,draft,{songId:'one',kind:'topic',targetId:topic.slug,enabled:true},API,effective,{}),/неоднозначности/);
const ambiguousDraft=clone(draft);
ambiguousDraft.genres.topics.entries[0].tracks.push(API.languageTrack({
 title:'Дикая вишня',artist:'Velar',provider:'spotify',url:spotifyA},1));
assert.ok(dist.build(ambiguated,ambiguousDraft,live,{},API,effective).issues.length>=1,
 'Every ambiguous catalog identity must be reported, potentially in several groups');
dist.reset();
const host=element(),msgs=[];
const context={loaded:true,catalog,draft,published:live,links:{overrides:{}},
 API,artistEffective:effective,blocked:()=>false,
 onModify(action){const result=dist.modify(catalog,draft,action,API,effective,{});
   if(result)assert.doesNotThrow(()=>API.normalize(draft));
   msgs.push(action);return result;}};
dist.render(host,context);
const descend=(node,fn,out=[])=>{if(fn(node))out.push(node);node.children.forEach(c=>descend(c,fn,out));return out;};
assert.equal(descend(host,n=>n.className==='landing-distribution-row').length,3);
const searchInput=descend(host,n=>n.className==='landing-distribution-search')[0];
searchInput.value='Без ссылок';searchInput.oninput();
assert.equal(descend(host,n=>n.className==='landing-distribution-row').length,1);
searchInput.value='';searchInput.oninput();
const rows=descend(host,n=>n.className==='landing-distribution-row');
const first=rows.find(r=>r.children[0].textContent.includes('Дикая вишня')&&r.children[0].textContent.includes('Velar'));
assert.ok(first,'One row per catalogue ID, even for duplicate titles');
const add=descend(first,n=>n.className==='landing-distribution-add')[0];
assert.equal(add.disabled,false);
const selection=descend(first,n=>n.className==='landing-distribution-target')[0];
selection.value='topic:'+topic.slug;
const oldCount=rows.length;
add.onclick();
assert.equal(descend(host,n=>n.className==='landing-distribution-row').length,oldCount,'No scroll-jumping full redraw after assigning');
assert.equal(topic.tracks.length,1);
assert.equal(msgs.length,1);
const feedback=descend(first,n=>n.className==='landing-distribution-item-status')[0];
assert.match(feedback.textContent,/Добавлено в черновик: Дикая вишня/,
 'Successful add is confirmed beside the song, not far below the catalog');
assert.equal(add.disabled,true,'Already assigned target is disabled to avoid repeat clicks');
assert.equal(add.textContent,'✓ Уже назначена');
assert.ok(descend(first,n=>n.className.indexOf('landing-distribution-chip')===0).some(
 n=>n.textContent.includes(topic.label)),'New topic chip appears immediately');
const remove=descend(first,n=>n.className==='landing-distribution-remove')[0];
assert.ok(remove);
remove.onclick();
assert.equal(topic.tracks.length,0);
assert.match(feedback.textContent,/Убрано из черновика/,
 'Removing a tag confirms the change directly under the song');
assert.equal(add.disabled,false,'Removing a topic makes +Attach available again');
assert.equal(language.tracks.length,1);
assert.equal(live.genres.topics.entries[0].tracks.length,0);
const noUrl=rows.find(r=>r.children[0].textContent.includes('Без ссылок'));
assert.ok(descend(noUrl,n=>n.className==='landing-distribution-add')[0].disabled);
assert.match(read('studio/index.html'),/data-landing-tab="distribution"/);
assert.match(read('studio/index.html'),/song-distribution\.js\?v=1/);
assert.match(read('studio/landing-editor.js'),/tab==='distribution'/);
assert.match(read('studio/landing-editor.js'),/var next=clone\(data\)/);
assert.match(read('studio/landing-editor.js'),/var distributionContext=\{/,
 'Distribution context must be named so the callback can refresh its draft reference');
assert.match(read('studio/landing-editor.js'),/distributionContext\.draft=data;/,
 'Successful Add must update the live context used to redraw topic badges');
assert.doesNotMatch(read('studio/landing-editor.js'),/data=next;context\.draft=data;/,
 'Do not reintroduce the ReferenceError that left changes invisible');
assert.match(read('studio/studio.css'),/\.landing-distribution-row/);
console.log('PASS RUN-113/RUN-112: inline feedback and badges, live context, private group matrix and no implicit publish');