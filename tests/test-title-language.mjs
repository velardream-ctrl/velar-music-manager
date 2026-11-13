import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('studio/title-language.js'),studio=read('studio/index.html'),
 sw=read('sw.js'),editor=read('studio/landing-editor.js');
const schema=read('landing-schema.js'),rules=read('firestore.rules');
new vm.Script(source);const w={};
const context={window:w,Array,String,Object,JSON,Error,Math,Number,document:{createElement(tag){
 return {tagName:tag,className:'',children:[],attributes:{},value:'',checked:false,
 appendChild(c){this.children.push(c);c.parentNode=this;return c;},
 removeChild(c){this.children.splice(this.children.indexOf(c),1);},
 setAttribute(k,v){this.attributes[k]=v;},
 get firstChild(){return this.children[0]||null;}
 };
}},Promise};
vm.runInNewContext(schema,context,{timeout:1000});
vm.runInNewContext(source,context,{timeout:1000});
const d=w.VMM_TITLE_LANGUAGE.guess;
for(const [title,code] of [
 ['Белая берёза','ru'],['Дикая вишня','ru'],['Отчий дом','ru'],
 ['Amore oltre il tempo','it'],['Lo Specchio e la Rosa','it'],
 ['Noche de Bachata','es'],['Bajo el Cielo de Mallorca','es'],
 ['Suomen kesän taika','fi'],['Liebe im Neonlicht','de'],
 ["Les Chats et l'Amour à Paris",'fr'],['Butterfly','en'],
 ['Northern Light Flow','en'],['Dancing Streams','en']
]){
 const result=d(title);
 assert.equal(result.code,code,JSON.stringify({title,result}));
 assert.equal(result.confidence,'high',title);
}
for(const title of ['Noor-e-Dil','Requiem Aeternam','Lux Obscura',
 'CRAZY BOBR — SILENT DJ','3i/Atlas','Velarena']){
 assert.equal(d(title).confidence,'review',title);
}
const langs=w.VMM_LANDING_SCHEMA.defaults().genres.languages;
const sample=[
 {id:'doc-1',title:'Белая берёза',artist:'Velar',titleLanguage:'ru',links:{spotify:'https://open.spotify.com/track/0123456789ABCDEFGHIJKL'}},
 {id:'doc-2',title:'Liebe im Neonlicht',artist:'DJ Velar',links:{spotify:'https://open.spotify.com/track/0123456789ABCDEFGHIJKM'}},
 {id:'doc-3',title:'Requiem Aeternam',artist:'Velar',links:{youtube:'https://youtu.be/ABCDEFGHIjk'}},
 {id:'doc-4',title:'Новая песня',artist:'Velar',links:{spotify:'https://example.com/song'}},
 {id:'doc-5',title:'Испанский трек',titleLanguage:'unknown-local',artist:'Velar',links:{}}
];
const p=w.VMM_TITLE_LANGUAGE.proposals(sample,langs);
assert.equal(p.length,5);
assert.equal(p.find(r=>r.id==='doc-1').before,'ru');
assert.equal(p.find(r=>r.id==='doc-2').code,'de');assert.equal(p.find(r=>r.id==='doc-2').before,'');
assert.equal(p.find(r=>r.id==='doc-3').code,'');assert.equal(p.find(r=>r.id==='doc-3').review,true);
assert.equal(p.find(r=>r.id==='doc-5').before,'unknown-local','Unknown preexisting values must not be overwritten');
assert.deepEqual(Array.from(p).map(r=>r.title),
 Array.from(p).map(r=>r.title).sort((a,b)=>a.localeCompare(b,'ru',{numeric:true,sensitivity:'base'})),
 'Language review song list appears alphabetically, not in Firestore fetch order');
const parent=context.document.createElement('div');
let writes=[],commits=0,updated=0;
const db={batch(){return {update(ref,obj){writes.push({ref,obj});},
 commit(){commits++;return Promise.resolve();}};},collection(name){return {doc(id){return {name,id};}}}};
context.firebase={auth(){return {currentUser:{uid:'owner-1',emailVerified:true}};},
 firestore:{FieldValue:{serverTimestamp(){return 'TIMESTAMP';}}}};
w.firebase=context.firebase;
w.confirm=()=>true;
w.VMM_TITLE_LANGUAGE.attach({parent,catalog:sample,catalogLoaded:true,db,uid:'owner-1',
 languages:langs,onDraftChanged(){updated++;}});
function walk(root,predicate){
 if(predicate(root))return root;
 for(const c of root.children){const found=walk(c,predicate);if(found)return found;}
 return null;
}
const launch=walk(parent,x=>x.textContent==='Проверить языки каталога');
assert.ok(launch);launch.onclick();
const apply=walk(parent,x=>(x.textContent||'').startsWith('Сохранить подтверждённые языки'));
assert.ok(apply);assert.match(apply.textContent,/\(2\)/,'Only two new high confidence suggestions');
const sync=walk(parent,x=>(x.textContent||'').startsWith('Подключить языки к созвездиям'));
assert.ok(sync);sync.onclick();
assert.equal(updated,1);
assert.equal(langs.entries.find(t=>t.code==='ru').tracks.length,1);
assert.equal(langs.entries.find(t=>t.code==='de').tracks.length,0,
 'Suggestions must not become public until owner explicitly saves them into Firestore');
apply.onclick();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(commits,1);
assert.equal(writes.length,2);
assert.ok(writes.every(x=>x.ref.name==='vmm_catalog'));
assert.ok(writes.every(x=>Object.keys(x.obj).every(k=>k.startsWith('titleLanguage'))),
 'Batch updates only language metadata, never lyrics or song identity');
assert.equal(sample[1].titleLanguage,'de');
assert.equal(sample[4].titleLanguage,'unknown-local');
const sync2=walk(parent,x=>(x.textContent||'').startsWith('Подключить языки к созвездиям'));
sync2.onclick();
assert.equal(langs.entries.find(t=>t.code==='de').tracks.length,1);
assert.ok(!langs.entries.some(t=>t.tracks.some(song=>song.url.includes('example.com'))));
assert.match(studio,/title-language\.js\?v=1/);
assert.match(editor,/VMM_TITLE_LANGUAGE\.attach/);
assert.match(sw,/'\.\/studio\/title-language\.js\?v=1'/);
assert.match(rules,/match \/vmm_catalog\/\{itemId\} \{ allow read, write: if studioAdmin\(\); \}/);
assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|setInterval\(|setTimeout\(|getUserMedia|autoplay|WebSocket/);
assert.match(read('index.html'),/name="robots" content="noindex,nofollow,noarchive"/);
console.log('PASS RUN-075: high-confidence title language detection, review ambiguous, admin-only batch writes, draft-only public language matching, noindex unchanged');
