import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),choicesSrc=read('studio/artist-choices.js'),linksSrc=read('studio/artist-track-links.js'),source=read('studio/landing-editor.js'),studio=read('studio/studio.js');
const nodes={},tabNames=['hero','artists','releases','genres','about','publish'];
function elem(tag='div'){
 const el={tagName:tag,type:'',value:'',textContent:'',className:'',disabled:false,checked:false,
   children:[],events:{},style:{},attributes:{},
   setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},
   appendChild(child){this.children.push(child);return child;},
   removeChild(child){this.children.splice(this.children.indexOf(child),1);},
   addEventListener(name,cb){this.events[name]=cb;},
   input(value){this.value=value;if(this.events.input)this.events.input.call(this);},
   get firstChild(){return this.children[0]||null;}
 };
 return el;
}
const get=id=>nodes[id]||(nodes[id]=elem());
const nav=tabNames.map(name=>{const n=elem('button');n.attributes['data-landing-tab']=name;return n;});
const document={getElementById:get,createElement:elem,querySelectorAll(q){return q==='#landing-tabs [data-landing-tab]'?nav:[];}};
const records=new Map(),reads=[];
function snapshot(id){return {exists:records.has(id),data(){return records.get(id);}};}
const database={
 collection(collection){return {
  limit(n){assert.equal(n,1200);return {get(){return Promise.resolve({
   forEach(cb){[
    {id:'songVelar1',data:()=>({title:'Белая берёза',artist:'Velar'})},
    {id:'songVelar2',data:()=>({title:'Crazy Bobr Party',artist:'Velar'})},
    {id:'songIlya',data:()=>({title:'Север',artist:'Илья Дмитриев'})}
   ].forEach(cb);}
  });}};},
  doc(id){
  const key=collection+'/'+id;
  return {id,key,get(options){reads.push({key,options});if(collection==='vmm_admins')
   return Promise.resolve({exists:true,data:()=>({enabled:true})});
   return Promise.resolve(snapshot(key));}};
 }};},
 runTransaction(callback){
  const pending=[];
  const tx={
   get(ref){return Promise.resolve(snapshot(ref.key));},
   set(ref,data){pending.push({key:ref.key,data});}
  };
  return Promise.resolve().then(()=>callback(tx)).then(v=>{
   for(const x of pending)records.set(x.key,x.data);
   return v;
  });
 }
};
const account={uid:'owner1234',emailVerified:true,providerData:[{providerId:'google.com'}]};
const firebase={apps:[1],auth(){return {currentUser:account};},firestore(){return database;}};
firebase.firestore.FieldValue={serverTimestamp:()=> 'SERVER_TIME'};
const window={firebase,confirm:()=>true,VMM_LANDING_SCHEMA:null};
vm.runInNewContext(schema,{window,Array,String,Number,Object,JSON,Error},{timeout:1000});
vm.runInNewContext(choicesSrc,{window,Array,String,Number,Object,JSON,Math,Error},{timeout:1000});
vm.runInNewContext(linksSrc,{window,Array,String,Number,Object,JSON,Math,Promise,Error,firebase,navigator:{onLine:true}},{timeout:1000});
vm.runInNewContext(source,{document,window,firebase,navigator:{onLine:true},Promise,Array,String,Number,Object,JSON,Error},{timeout:1000});
const api=window.VMM_LANDING;
assert.ok(api&&typeof api.open==='function');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function traverse(root,fn){
 if(fn(root))return root;
 for(const child of root.children){const found=traverse(child,fn);if(found)return found;}
 return null;
}
function findInput(label){
 const node=traverse(get('landing-fields'),el=>el.tagName==='label'&&el.children[0]?.textContent===label);
 assert.ok(node,'Missing form input: '+label);
 return node.children[1];
}
api.open();await flush();
assert.ok(reads.some(x=>x.key==='vmm_admins/owner1234'&&x.options?.source==='server'));
assert.ok(reads.some(x=>x.key==='vmm_public_drafts/landing'));
assert.ok(reads.some(x=>x.key==='vmm_public_pages/landing'));
assert.equal(api.isDirty(),false);
findInput('Подзаголовок').input('Музыка меняет мир');
assert.equal(api.isDirty(),true);
const beforeConfirm=window.confirm;
window.confirm=()=>false;
assert.equal(api.canLeave(),false,'Unsaved CMS changes must block navigation');
window.confirm=beforeConfirm;
get('landing-save').onclick();await flush();
assert.equal(api.isDirty(),false);
assert.equal(records.get('vmm_public_drafts/landing').content.hero.subtitle,'Музыка меняет мир');
assert.equal(records.has('vmm_public_pages/landing'),false,'Saving a draft must not publish');
assert.equal(get('landing-publish').disabled,false);
get('landing-publish').onclick();await flush();
const live=records.get('vmm_public_pages/landing');
assert.equal(live.status,'published');
assert.equal(live.content.hero.subtitle,'Музыка меняет мир');
assert.equal(live.updatedBy,'owner1234');
// Artist card editor works independently from the private release catalog.
nav[1].onclick();await flush();
const select=traverse(get('landing-fields'),n=>n.className==='landing-artist-select');
assert.ok(select);
select.value='velar';
const add=traverse(get('landing-fields'),n=>n.className==='landing-add');
assert.ok(add);
add.onclick();
findInput('Имя / название артиста').input('DJ Velar');
findInput('Роль / стиль').input('Бас и композитор');
findInput('Публичная HTTPS-ссылка (профиль, Spotify, YouTube…) — необязательно')
 .input('https://example.com/velar');
const checkbox=traverse(get('landing-fields'),n=>n.type==='checkbox');
assert.ok(checkbox);checkbox.checked=true;checkbox.onchange.call(checkbox);
assert.equal(api.isDirty(),true);
get('landing-save').onclick();await flush();
assert.equal(records.get('vmm_public_drafts/landing').content.artists.cards.length,1);
assert.equal(records.get('vmm_public_pages/landing').content.artists.cards.length,0);
get('landing-publish').onclick();await flush();
assert.equal(records.get('vmm_public_pages/landing').content.artists.cards[0].title,'DJ Velar');
assert.equal(records.get('vmm_public_pages/landing').content.artists.cards[0].artistId,'velar');
assert.equal(records.get('vmm_public_pages/landing').content.artists.cards[0].visible,true);
// Crazy Bobr is a separate preset even when the catalog still credits Velar.
const chooser=traverse(get('landing-fields'),n=>n.className==='landing-artist-select');
chooser.value='crazy-bobr';
traverse(get('landing-fields'),n=>n.className==='landing-add').onclick();
assert.equal(traverse(get('landing-fields'),n=>n.textContent==='Имя / название артиста')!==null,true);
function all(root,predicate,out=[]){
 if(predicate(root))out.push(root);
 for(const x of root.children)all(x,predicate,out);
 return out;
}
let trackButtons=all(get('landing-fields'),n=>n.textContent==='Назначить песни');
assert.equal(trackButtons.length,2);
trackButtons[1].onclick();
const trackSearch=traverse(get('landing-fields'),n=>n.className==='landing-track-search');
assert.ok(trackSearch);
trackSearch.value='Crazy Bobr Party';
trackSearch.oninput.call(trackSearch);
const trackRow=traverse(get('landing-fields'),n=>n.className==='landing-track-row');
assert.ok(trackRow);
assert.match(trackRow.children[1].textContent,/Crazy Bobr Party/);
const tick=trackRow.children[0];
tick.checked=true;tick.onchange.call(tick);
assert.equal(api.isDirty(),true);
const saveLinks=traverse(get('landing-fields'),n=>n.textContent==='Сохранить привязки песен');
assert.ok(saveLinks&&!saveLinks.disabled);
saveLinks.onclick();await flush();
const links=records.get('vmm_links/artist_track_assignments_v1');
assert.equal(links.overrides.songVelar2,'crazy-bobr');
assert.equal(links.revision,1);
assert.equal(records.get('vmm_public_pages/landing').content.artists.cards.length,1,
 'Private song assignments must not publish the new artist without explicit public publish');
get('landing-save').onclick();await flush();
assert.equal(records.get('vmm_public_drafts/landing').content.artists.cards[1].title,'Crazy Bobr');
// Remote write must never be overwritten by stale admin tab.
nav[0].onclick();
findInput('Подзаголовок').input('Несохранённый локальный текст');
const remote=records.get('vmm_public_drafts/landing');
records.set('vmm_public_drafts/landing',{...remote,revision:remote.revision+100,content:{...remote.content}});
get('landing-save').onclick();await flush();
assert.match(get('landing-status').textContent,/другого устройства/);
assert.equal(records.get('vmm_public_drafts/landing').revision,remote.revision+100);
assert.equal(api.isDirty(),true);
assert.equal(get('landing-publish').disabled,true);
assert.match(studio,/window\.VMM_LANDING\.canLeave\(\)/);
assert.match(studio,/window\.VMM_LANDING\.reset/);
console.log('PASS: admin-only landing editor, catalog-backed artist chooser, isolated draft/publication and conflict protection');
