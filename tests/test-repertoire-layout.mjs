import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('studio/index.html'),source=read('studio/recordings.js'),
 studio=read('studio/studio.js'),workflows=read('studio/workflows.js'),
 css=read('studio/recordings.css'),sw=read('sw.js');
const dataIndex=html.indexOf('id="panel-data"'),importIndex=html.indexOf('id="data-import"');
assert.ok(dataIndex>0&&importIndex>dataIndex,'Private import must live inside dedicated Data tab');
assert.ok(html.indexOf('id="workspace-grid"')===-1||importIndex>html.indexOf('id="workspace-grid"'));
assert.match(html,/data-panel="data"/);
assert.match(studio,/data:'Данные'/);
assert.match(studio,/show\(el\('panel-data'\),id==='data'\)/);
assert.match(studio,/openData:function\(\)\{selectPanel\('data'\);\}/);
assert.match(workflows,/if\(type==='data'&&window\.VMM_STUDIO/);
assert.match(workflows,/if\(a==='open-import'\)\{if\(window\.VMM_STUDIO/);
assert.ok(!html.includes('Восстановить из резервной копии</button>'),'Do not pretend restoration is implemented');
assert.match(html,/Автоматический бэкап и восстановление ещё не реализованы/);

assert.match(source,/formSongId=''[,;]/);
assert.match(source,/playerVisible=false/);
assert.match(source,/data-r-action="offline-play"/);
assert.match(source,/data-r-action="open-track"/);
assert.match(source,/function setSong\(key,forPlayback\)/);
assert.match(source,/if\(formSongId===t\.id\)/);
assert.match(source,/setSong\('',false\)/);
assert.match(source,/function renderPlayerEditor/);
assert.match(source,/id="vmm-r-player-sync"/);
assert.match(source,/id="vmm-r-edit-meta"/);
assert.match(source,/id="vmm-r-download"/);
assert.doesNotMatch(source,/data-r-action="play"/,'No duplicate Listen button in metadata card');
assert.ok(html.includes('src="recordings.js?v=11"'));
assert.ok(html.includes('src="studio.js?v=7"'));
assert.ok(html.includes('src="workflows.js?v=5"'));
assert.ok(html.includes('href="recordings.css?v=11"'));
assert.match(css,/\.vmm-r-player-sync/);
assert.ok(sw.includes("STUDIO_PREFIX+'v12'"));

const els={};
function node(tag){
 const el={tagName:tag||'div',className:'',value:'',textContent:'',disabled:false,
  children:[],style:{},getAttribute(k){return this[k]||null;},
  setAttribute(k,v){this[k]=v;},addEventListener(){},removeAttribute(){},
  appendChild(child){this.children.push(child);},removeChild(child){this.children=this.children.filter(x=>x!==child);},
  focus(){},scrollIntoView(){},pause(){},load(){},
  play(){return Promise.resolve();}};
 Object.defineProperty(el,'firstChild',{get(){return this.children[0]||null;}});
 Object.defineProperty(el,'innerHTML',{get(){return this.html||'';},set(v){this.html=v;this.children=[];}});
 return el;
}
const shell={panel:null,appendChild(el){this.panel=el;el.parentNode=this;}};
const document={
 querySelector:q=>q==='#workspace .workspace-content'?shell:null,
 querySelectorAll:()=>[],
 createElement:tag=>node(tag),
 getElementById:id=>(els[id]??=node())
};
const window={VMM_OFFLINE:{
 estimate(){return Promise.resolve(null);},
 rememberSelection(){return Promise.resolve();},
 persist(){return Promise.resolve(true);}
},confirm(){return true;},VMM_STUDIO:{rememberPanel(){}}};
let isFailure=false;
const user={uid:'owner'},entries=[];
const fakeDb={
 collection(name){return {doc(){return {id:name+'-'+(entries.length+1)};}};},
 batch(){return {
   set(ref,payload){entries.push({ref,payload});},
   commit(){return Promise.resolve();}
 };}
};
const firebase={firestore:{FieldValue:{serverTimestamp:()=>({})}}};
const fakeURL={createObjectURL(){return 'blob:local';},revokeObjectURL(){}};
const injected=source.replace(
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{header:header,setSong:setSong,renderRecords:renderRecords,actions:actions,upload:upload,setup:function(){user=window.__user;db=window.__db;catalog=[{id:"song1",title:"Дикая вишня",artist:"Velar"},{id:"song2",title:"Журавли",artist:"Velar"}];active=true;connect=function(){return Promise.resolve("token");};ensureFolder=function(){return Promise.resolve("folder");};uploadBytes=function(){return window.__failed?Promise.reject(new Error("TEST upload failure")):Promise.resolve({id:"new-drive-id"});};},state:function(){return {songId:songId,formSongId:formSongId,playerVisible:playerVisible,selected:document.getElementById("vmm-r-song").value,records:recordings.length};},setOffline:function(item){saved=[item];}}};');
assert.notEqual(injected,source,'Testing instrumentation must match the current module export');
window.__user=user;window.__db=fakeDb;
const ctx={document,window,navigator:{onLine:true},firebase,Promise,Array,Object,String,Number,Math,Date,URL:fakeURL,setTimeout,Error};
vm.runInNewContext(injected,ctx,{timeout:1000});
const t=window.VMM_RECORDINGS._test;
t.header();t.setup();
// The mock DOM does not parse innerHTML automatically: materialize its named nodes.
for(const match of shell.panel.innerHTML.matchAll(/id="([^"]+)"/g))document.getElementById(match[1]);
els['vmm-r-player-section'].className='hidden';
els['vmm-r-song-section'].className='hidden';
els['vmm-r-text-wrapper'].className='hidden';
els['vmm-r-editor'].className='hidden';
const markup=shell.panel.innerHTML;
for(const [first,second] of [['id="vmm-r-connect"','id="vmm-r-search"'],
 ['id="vmm-r-search"','id="vmm-r-offline-list"'],
 ['id="vmm-r-offline-list"','id="vmm-r-song-section"'],
 ['id="vmm-r-song-section"','id="vmm-r-player-section"'],
 ['id="vmm-r-player-sync"','id="vmm-r-edit"']]){
 assert.ok(markup.indexOf(first)>=0&&markup.indexOf(first)<markup.indexOf(second),first+' must precede '+second);
}
assert.match(markup,/<strong>Прослушивание<\/strong><span id="vmm-r-toggle-text-label">Показать текст<\/span>/);
assert.match(markup,/id="vmm-r-player-section" class="hidden"/);
t.setSong('song1',false);
assert.equal(t.state().selected,'song1');
assert.doesNotMatch(els['vmm-r-song-section'].className,/hidden/);
assert.match(els['vmm-r-player-section'].className,/hidden/);
els['vmm-r-variant'].value='Минусовка';
t.upload({name:'voice.flac',size:12*1024*1024});
await new Promise(r=>setTimeout(r,25));
assert.equal(t.state().songId,'');
assert.equal(t.state().formSongId,'');
assert.equal(t.state().selected,'','Successful upload resets dropdown');
assert.match(els['vmm-r-song-section'].className,/hidden/,'Upload controls fold after confirmed DB commit');
assert.match(els['vmm-r-player-section'].className,/hidden/,'Player remains closed after upload');
assert.equal(t.state().records,1);
assert.match(els['vmm-r-status'].textContent,/Загружено:/);
// A failed upload must not wipe the song choice.
t.setSong('song2',false);
window.__failed=true;
t.upload({name:'failing.mp3',size:123456});
await new Promise(r=>setTimeout(r,25));
assert.equal(t.state().selected,'song2');
assert.doesNotMatch(els['vmm-r-song-section'].className,/hidden/);
assert.match(els['vmm-r-status'].textContent,/TEST upload failure/);
// Stage playback explicitly opens on an offline card, not from the form.
window.__failed=false;
t.setOffline({fileId:'new-drive-id',catalogId:'song1',title:'Дикая вишня',variant:'Минусовка',
 filename:'dikaya_vishnya.flac',size:12*1024*1024,blob:{size:12*1024*1024}});
t.actions({target:{getAttribute(k){return k==='data-r-action'?'offline-play':k==='data-r-id'?'new-drive-id':null;}}});
await new Promise(r=>setTimeout(r,15));
assert.equal(t.state().songId,'song1');
assert.equal(t.state().selected,'');
assert.equal(t.state().playerVisible,true);
assert.match(els['vmm-r-song-section'].className,/hidden/);
assert.doesNotMatch(els['vmm-r-player-section'].className,/hidden/);
assert.match(els['vmm-r-player-sync']['aria-label'],/Google Drive и сохранено офлайн/);
assert.equal(els['vmm-r-toggle-text-label'].textContent,'Скрыть текст');
console.log('PASS: import isolated in Data; search before offline; success-only upload reset; deliberate player opening; two-line title and cloud badge');
