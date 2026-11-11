import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../studio/recordings.js',import.meta.url),'utf8');
const elements={};
let panel;
function create(){
 return {className:'hidden',style:{},textContent:'',value:'',disabled:false,open:false,children:[],pause(){},load(){},appendChild(x){this.children.push(x);},
  addEventListener(){},setAttribute(k,v){this[k]=v;},removeAttribute(){},
  getAttribute(k){return this[k]||null;},getBoundingClientRect(){return {bottom:30};},
  get innerHTML(){return this.markup||'';},set innerHTML(v){this.markup=v;}};
}
const document={
 querySelector(q){return q==='#workspace .workspace-content'?{appendChild(x){panel=x;}}:null;},
 querySelectorAll(){return [];},createElement:create,
 getElementById(id){return elements[id]||(elements[id]=create());}
};
const uid='owner001',meta={fileId:'file_abc0001',catalogId:'song001',title:'Дикая вишня',
 artist:'Velar',variant:'Минусовка',filename:'dikaya_vishnya.flac',mimeType:'audio/flac',size:35000000};
let cached=[],remote=[meta],removals=0;
const offline={
 list(){return Promise.resolve(cached.slice());},
 put(uid,item){cached=cached.filter(x=>x.fileId!==item.fileId).concat([{...item,size:item.blob.size}]);return Promise.resolve();},
 remove(uid,id){removals++;cached=cached.filter(x=>x.fileId!==id);return Promise.resolve();},
 persist(){return Promise.resolve(true);},
 estimate(){return Promise.resolve(null);},
 wasCloudReady(){return Promise.resolve(true);},
 pendingPinChanges(){return Promise.resolve([]);},
 markCloudReady(){return Promise.resolve();},
 queuePinChange(){return Promise.resolve();},
 rememberSelection(){return Promise.resolve();}
};
const api={
 read(){return Promise.resolve({pins:remote.slice(),authoritative:true});},
 update(db,uid,item,on){remote=remote.filter(x=>x.fileId!==item.fileId);if(on)remote.push(item);return Promise.resolve(remote);},
 pin:item=>item
};
const window={VMM_OFFLINE:offline,VMM_CLOUD_PINS:api,addEventListener(){},__downloads:0};
const replacement=[
 'window.VMM_RECORDINGS={_test:{header:header,refresh:refreshCloudPins,reset:reset,',
 'setup:function(token){user={uid:"owner001"};db={};active=true;driveToken=token||"";',
 'catalog=[{id:"song001",title:"Дикая вишня",artist:"Velar"}];',
 'recordings=[{id:"record1",driveFileId:"file_abc0001",catalogId:"song001",title:"Дикая вишня",artist:"Velar",',
 'variant:"Минусовка",filename:"dikaya_vishnya.flac",mimeType:"audio/flac",size:35000000}];',
 'audioBlob=function(){window.__downloads++;return Promise.resolve({size:35000000});};},',
 'state:function(){return {count:saved.length,pins:cloudPins.length,ready:cloudPinsLoaded,status:cloudStatus};}}};'
].join('\n');
const injected=source.replace('window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',replacement);
assert.notEqual(injected,source);
vm.runInNewContext(injected,{document,window,navigator:{onLine:true},Promise,Date,Number,String,Array,Object,Math,Error,URL:{revokeObjectURL(){}},setTimeout},{timeout:1000});
const app=window.VMM_RECORDINGS._test;
app.header();
for(const match of panel.innerHTML.matchAll(/id="([^"]+)"/g))document.getElementById(match[1]);
app.setup('');
await app.refresh();
assert.equal(app.state().pins,1);
assert.equal(app.state().count,0);
assert.equal(window.__downloads,0);
assert.match(elements['vmm-r-offline-list'].innerHTML,/ожидает загрузки/);
assert.match(elements['vmm-r-sync-status'].textContent,/Подключить Google Drive/);
app.setup('drive-token');
await app.refresh();
assert.equal(window.__downloads,1);
assert.equal(cached.length,1);
assert.equal(cached[0].fileId,meta.fileId);
assert.match(elements['vmm-r-offline-list'].innerHTML,/офлайн ✓/);
await app.refresh();
assert.equal(window.__downloads,1,'Existing offline blob must never be downloaded again');
app.reset();
assert.equal(cached.length,1,'Logout must not erase locally saved songs');
remote=[];
app.setup('drive-token');
await app.refresh();
assert.equal(cached.length,0,'Explicit remote unpin removes local copy on sync');
assert.equal(removals,1);
console.log('PASS: second device downloads after Drive auth once, retains media across logout, obeys remote unpin');
