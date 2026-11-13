import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const nodes={},tabNames=['hero','artists','releases','playlists','radio','universe','languages','topics','assistant','genres','about','publish','albums'];
let scrolls=0;
function elem(tag='div'){
  return {tagName:tag,type:'',value:'',textContent:'',className:'',disabled:false,checked:false,
    children:[],style:{},attributes:{},
    setAttribute(k,v){this.attributes[k]=v;},
    getAttribute(k){return this.attributes[k];},
    appendChild(child){this.children.push(child);return child;},
    removeChild(child){this.children.splice(this.children.indexOf(child),1);},
    addEventListener(name,fn){this['on'+name]=fn;},
    scrollIntoView(){scrolls++;},
    get firstChild(){return this.children[0]||null;}
  };
}
const get=id=>nodes[id]||(nodes[id]=elem());
const nav=tabNames.map(name=>{const n=elem('button');n.attributes['data-landing-tab']=name;return n;});
const document={getElementById:get,createElement:elem,createTextNode(t){const e=elem('#text');e.textContent=t;return e;},
  querySelectorAll(q){return q==='#landing-tabs [data-landing-tab]'?nav:[];}};
const songs=Array.from({length:95},(_,i)=>({
  id:'song-'+i,
  data:()=>({title:'Песня '+String(i+1).padStart(3,'0'),artist:'Velar',
    links:{spotify:'https://open.spotify.com/track/'+String(i+1).padStart(22,'0'),
      youtube:i===40?'https://youtu.be/abcdefghijk':''}})
}));
// Deliberately reverse Firestore's result order; Studio must sort before paging.
songs.reverse();
const records=new Map();
function snap(key){return {exists:records.has(key),data(){return records.get(key);}};}
const db={collection(c){return {
  limit(n){assert.equal(n,1200);return {get(){return Promise.resolve({forEach(fn){songs.forEach(fn);}});}};},
  doc(id){const key=c+'/'+id;return {key,id,get(opts){
    if(c==='vmm_admins')return Promise.resolve({exists:true,data:()=>({enabled:true})});
    return Promise.resolve(snap(key));
  }};}
};},runTransaction(cb){const updates=[];const tx={
  get(ref){return Promise.resolve(snap(ref.key));},
  set(ref,data){updates.push({key:ref.key,data});}
};return Promise.resolve().then(()=>cb(tx)).then(v=>{updates.forEach(x=>records.set(x.key,x.data));return v;});}};
const user={uid:'owner1',emailVerified:true,providerData:[{providerId:'google.com'}]};
const firebase={apps:[1],auth(){return {currentUser:user};},firestore(){return db;}};
firebase.firestore.FieldValue={serverTimestamp(){return 'SERVER_TIME';}};
const window={firebase,confirm(){return true;}},navigator={onLine:true};
const ctx={window,document,firebase,navigator,Promise,Array,String,Number,Object,JSON,Math,Error};
vm.runInNewContext(read('landing-schema.js'),ctx,{timeout:1000});
vm.runInNewContext(read('studio/artist-choices.js'),ctx,{timeout:1000});
vm.runInNewContext(read('studio/artist-track-links.js'),ctx,{timeout:1000});
vm.runInNewContext(read('studio/landing-editor.js'),ctx,{timeout:1000});
const flush=()=>new Promise(r=>setImmediate(r));
function all(node,fn,found=[]){if(fn(node))found.push(node);node.children.forEach(x=>all(x,fn,found));return found;}
const find=(fn)=>all(get('landing-fields'),fn)[0];
const rows=()=>all(get('landing-fields'),e=>e.className==='landing-topic-catalog-row');
function hasOrder(node,first,second){
  if(node.children.includes(first)&&node.children.includes(second))
    return node.children.indexOf(first)<node.children.indexOf(second);
  return node.children.some(child=>hasOrder(child,first,second));
}
const button=label=>find(e=>e.tagName==='button'&&e.textContent===label);
const status=()=>find(e=>e.className==='landing-song-page-status')?.textContent||'';
const api=window.VMM_LANDING;
api.open();await flush();await flush();
nav[7].onclick();await flush();
assert.equal(rows().length,40,'First page must render 40 song choices, not all 95 in one huge DOM');
const assignedSection=find(e=>e.className==='landing-assigned-block');
const catalogResults=find(e=>e.className==='landing-language-catalog-list');
assert.ok(assignedSection&&catalogResults,'Both assigned songs and catalog are present');
assert.ok(hasOrder(get('landing-fields'),catalogResults,assignedSection),
  'Assigned songs must follow catalog; adding a song cannot increase height above the active checkbox');
assert.equal(assignedSection.children[0].textContent,'Назначенные песни (0)');
assert.match(status(),/^1–40 из 95 · страница 1 из 3$/);
assert.equal(button('← Назад').disabled,true,'Back is disabled on first page');
assert.equal(button('Вперёд →').disabled,false);
button('Вперёд →').onclick();
assert.equal(rows().length,40);
assert.match(status(),/^41–80 из 95 · страница 2 из 3$/);
assert.equal(button('← Назад').disabled,false);
assert.equal(rows()[0].children[0].children[1].textContent,'Песня 041 · Velar');
assert.equal(scrolls,1,'Paging should scroll the newly displayed list into view');
const row=rows()[0],pick=row.children[0].children[0],source=row.children[1];
pick.checked=true;pick.onchange.call(pick);
assert.equal(row.children[2].textContent,'✓ Назначена','Inline confirmation marks the selected song');
assert.equal(assignedSection.children[0].textContent,'Назначенные песни (1)',
  'Assigned count updates without re-rendering the upper catalog');
assert.equal(scrolls,1,'Checking a song must not move the catalog or scroll it');
assert.equal(source.children[0].children[0].checked,true,'Spotify is default');
source.children[1].children[0].checked=true;source.children[1].children[0].onchange.call(source.children[1].children[0]);
assert.equal(api.isDirty(),true);
button('Вперёд →').onclick();
assert.equal(rows().length,15,'Last page has just the remaining 15 songs');
assert.match(status(),/^81–95 из 95 · страница 3 из 3$/);
assert.equal(button('Вперёд →').disabled,true,'Forward is disabled on last page');
button('← Назад').onclick();
assert.match(status(),/^41–80 из 95 · страница 2 из 3$/);
assert.equal(rows()[0].children[0].children[0].checked,true,'Previously picked song remains selected');
assert.equal(rows()[0].children[1].children[0].children[0].checked,true,'Spotify choice persisted');
assert.equal(rows()[0].children[1].children[1].children[0].checked,true,'YouTube choice persisted');
const search=find(e=>e.className==='landing-language-catalog-search');
search.value='Песня 095';search.oninput.call(search);
assert.equal(rows().length,1,'Search filters entire catalog, not only current 40 entries');
assert.equal(rows()[0].children[0].children[1].textContent,'Песня 095 · Velar');
assert.equal(status(),'','A single match needs no pager');
search.value='';search.oninput.call(search);
assert.match(status(),/^1–40 из 95 · страница 1 из 3$/,'Reset search returns to first page');
button('Вперёд →').onclick();
assert.match(status(),/^41–80 из 95/);
nav[6].onclick();
assert.match(status(),/^1–40 из 95/,'Language page selection is independent from topics');
nav[7].onclick();
assert.match(status(),/^41–80 из 95/,'Returning to topics preserves topic page during same editing session');
get('landing-save').onclick();await flush();await flush();
const draft=records.get('vmm_public_drafts/landing');
assert.ok(draft,'Selected song can be saved into a private draft');
const love=draft.content.genres.topics.entries.find(e=>e.slug==='love');
assert.equal(love.tracks.length,1,'Pagination never duplicates songs');
assert.equal(love.tracks[0].alternateProvider,'youtube');
assert.equal(records.has('vmm_public_pages/landing'),false,'Saving draft never auto-publishes');
assert.match(read('studio/index.html'),/landing-editor\.js\?v=28/);
assert.ok(read('studio/index.html').includes('studio.css?v=26'),'Studio CSS URL must be cache-busted');
assert.match(read('sw.js'),/STUDIO_PREFIX\+'v42'/);
console.log('PASS RUN-105/RUN-100: stable catalog, inline assignment state, pagination 40/95, next/back, search, source selection, independent state and private draft');
