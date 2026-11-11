import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('studio/recordings.js');
const html=read('studio/index.html'),css=read('studio/recordings.css'),sw=read('sw.js');
assert.match(source,/id="vmm-r-edit"/,'Player needs explicit pencil');
assert.match(source,/aria-controls="vmm-r-editor"/);
assert.match(source,/id="vmm-r-offline-toggle"/);
assert.match(source,/id="vmm-r-trash-current"/);
assert.match(source,/editOpen=!editOpen;renderPlayerEditor\(\)/);
assert.match(source,/if\(!editOpen\|\|!r\|\|r\.archived\|\|r\.catalogId!==songId\)return/);
assert.doesNotMatch(source,/data-r-offline=/,'Do not expose live offline checkbox');
assert.doesNotMatch(source,/data-r-action="trash"/,'Do not expose per-track trash in playback list');
assert.match(source,/duplicate&&!window\.confirm/,'Duplicate variant upload must require confirmation');
assert.ok(html.includes('src="recordings.js?v=12"'));
assert.ok(html.includes('href="recordings.css?v=12"'));
assert.ok(sw.includes("STUDIO_PREFIX+'v27'"));
assert.match(css,/\.vmm-r-edit-toggle/);

const nodes={}, clicks=[],confirmed=[];
function node(type){
 const o={type:type||'div',style:{},className:'',textContent:'',innerHTML:'',value:'',
   disabled:false,children:[],pause(){},load(){},addEventListener(){},
   removeAttribute(){},setAttribute(k,v){this[k]=v;},
   appendChild(e){this.children.push(e);},scrollIntoView(){}};
 return o;
}
const document={
 querySelector(q){return q==='#workspace .workspace-content'?node('section'):null;},
 createElement:node,
 getElementById(id){return nodes[id]||(nodes[id]=node());}
};
const fakeStored={fileId:'file-1',catalogId:'song1',title:'Дикая вишня',artist:'Velar',
 variant:'Минусовка',filename:'dikaya_vishnya.flac',size:35000000,blob:{size:35000000}};
const record={id:'doc-1',catalogId:'song1',driveFileId:'file-1',title:'Дикая вишня',
 variant:'Минусовка',filename:'dikaya_vishnya.flac',size:35000000};
let removed=0;
const window={confirm(s){confirmed.push(s);return false;},VMM_OFFLINE:{
 remove(){removed++;return Promise.resolve();},
 estimate(){return Promise.resolve(null);},
 rememberSelection(){return Promise.resolve();}
}};
const code=source.replace(
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{header:header,renderRecords:renderRecords,renderPlayerEditor:renderPlayerEditor,setSong:setSong,hide:hide,selectAudio:function(id){audioFileId=id;playerVisible=true;},setup:function(){user={uid:"owner"};catalog=[{id:"song1",title:"Дикая вишня"},{id:"song2",title:"Журавли"}];recordings=[window.__record];saved=[window.__stored];songId="song1";active=true;db={collection:function(){return {doc:function(){return {};}};}};}}};'
);
assert.notEqual(code,source,'Cannot inject test exports');
window.__record=record;window.__stored=fakeStored;
vm.runInNewContext(code,{window,document,navigator:{onLine:true},Promise,Math,Date,Number,String,Array,Object,Error},{timeout:1000});
const t=window.VMM_RECORDINGS._test;
t.header();document.getElementById('vmm-r-editor').className='vmm-r-editor hidden';t.setup();t.renderRecords();
assert.doesNotMatch(nodes['vmm-r-records'].innerHTML,/data-r-action="trash"|data-r-offline=/);
assert.match(nodes['vmm-r-records'].innerHTML,/Открыть в плеере/,'Cloud-only recordings remain explicitly playable');
assert.equal(nodes['vmm-r-edit'].disabled,true,'Pencil disabled until playback record is selected');
nodes['vmm-r-edit'].onclick();
assert.match(nodes['vmm-r-status'].textContent,/Сначала выбери/);
assert.match(nodes['vmm-r-editor'].className,/hidden/);

t.selectAudio('file-1');t.renderPlayerEditor();
assert.equal(nodes['vmm-r-edit'].disabled,false);
nodes['vmm-r-edit'].onclick();
assert.doesNotMatch(nodes['vmm-r-editor'].className,/hidden/);
assert.equal(nodes['vmm-r-edit']['aria-expanded'],'true');
assert.match(nodes['vmm-r-edit-target'].textContent,/Дикая вишня · Минусовка/);
assert.equal(nodes['vmm-r-offline-toggle'].textContent,'Убрать из офлайна');
assert.doesNotMatch(nodes['vmm-r-trash-current'].className,/hidden/);
// No destructive operation if confirmation is rejected.
nodes['vmm-r-offline-toggle'].onclick();
assert.equal(removed,0,'Canceled action must not touch IndexedDB');
assert.equal(confirmed.length,1);
assert.match(nodes['vmm-r-editor'].className,/^vmm-r-editor/);
nodes['vmm-r-trash-current'].onclick();
assert.equal(confirmed.length,2,'Drive Trash still needs a separate confirmation');
assert.match(nodes['vmm-r-editor'].className,/^vmm-r-editor/);
// Explicitly close management, then switching songs must forget active track.
nodes['vmm-r-edit'].onclick();
assert.match(nodes['vmm-r-editor'].className,/hidden/);
nodes['vmm-r-edit'].onclick();
assert.doesNotMatch(nodes['vmm-r-editor'].className,/hidden/);
t.setSong('song2');
assert.match(nodes['vmm-r-editor'].className,/hidden/);
assert.equal(nodes['vmm-r-edit'].disabled,true);
assert.equal(nodes['vmm-r-edit']['aria-expanded'],'false');
console.log('PASS: pencil-only edit mode, guarded per-record Trash/Offline, extra confirmation, no stale song controls');
