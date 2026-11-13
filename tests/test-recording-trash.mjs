import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('studio/recordings.js');
const html=read('studio/index.html');
const sw=read('sw.js');
assert.match(source,/function moveRecording\(r,toTrash\)/);
assert.match(source,/function validateManagedRecording\(r\)/);
assert.match(source,/function driveInfo\(r,folderId\)/);
assert.match(source,/m\.parents\.indexOf\(folderId\)<0/);
assert.match(source,/tx\.update\(ref,archived\?/);
assert.match(source,/archivedAt:firebase\.firestore\.FieldValue\.serverTimestamp\(\)/);
assert.match(source,/id="vmm-r-trash-current"/);
assert.match(source,/data-r-action="restore"/);
assert.doesNotMatch(source,/request\([^\n]+method:'DELETE'/);
assert.ok(html.includes('src="recordings.js?v=12"'));
assert.ok(html.includes('href="recordings.css?v=12"'));
assert.ok(sw.includes("STUDIO_PREFIX+'v44'"));

const nodes={};
const element=()=>({textContent:'',innerHTML:'',className:'',style:{},appendChild(){},addEventListener(){},pause(){},load(){},removeAttribute(){},setAttribute(){}});
const document={
 querySelector:q=>q==='#workspace .workspace-content'?{appendChild(){}}:null,
 createElement:()=>element(),getElementById:id=>(nodes[id]??=element())
};
let asks=0;
const window={confirm:()=>{asks++;return true;}};
const user={uid:'owner-uid',emailVerified:true,providerData:[{providerId:'google.com'}],
  reauthenticateWithPopup(){return Promise.resolve({user,credential:{accessToken:'test-token'}});}};
const auth=()=>({currentUser:user});
auth.GoogleAuthProvider=function(){this.addScope=()=>{};this.setCustomParameters=()=>{};};
let fileTrashed=false,metadataUpdated=0,auditCount=0,driveChanges=0,folder='our-folder';
const recordData={catalogId:'song-1',driveFileId:'drive-1',filename:'song__test.mp3',title:'Тестовая',variant:'Проверка',size:1000};
let state={...recordData,archived:false};
const docRef={path:'vmm_recordings/doc-1'};
const firestore={
 collection(name){return {doc(id){
   if(name==='vmm_recordings'&&id==='__audio_settings')return {get:()=>Promise.resolve({exists:true,data:()=>({folderId:'our-folder'})})};
   if(name==='vmm_recordings')return docRef;
   if(name==='vmm_audit')return {path:'vmm_audit/new'};
   throw new Error('Unexpected collection '+name);
  }};},
 runTransaction(fn){
   const tx={
     get:ref=>Promise.resolve({exists:true,data:()=>({...recordData})}),
     update(ref,value){assert.equal(ref,docRef);assert.ok(!Object.hasOwn(value,'title'),'Must not touch catalog/song identity');metadataUpdated++;state={...state,...value};},
     set(ref,value){assert.match(value.operation,/Фонограмма/);auditCount++;}
   };
   return Promise.resolve().then(()=>fn(tx));
 }
};
const firebase={auth,firestore:Object.assign(()=>firestore,{FieldValue:{serverTimestamp:()=>({serverTimestamp:true})}})};
async function fetch(url,opts={}){
 assert.match(url,/https:\/\/www\.googleapis\.com\/drive\/v3\/files\/drive-1/);
 assert.equal(opts.headers.Authorization,'Bearer test-token');
 if(opts.method==='PATCH'){
   driveChanges++;fileTrashed=JSON.parse(opts.body).trashed;
   return {ok:true,json:async()=>({id:'drive-1',name:recordData.filename,trashed:fileTrashed})};
 }
 return {ok:true,json:async()=>({id:'drive-1',name:recordData.filename,parents:[folder],trashed:fileTrashed})};
}
const code=source.replace(
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{set:function(r){db=window.__db;user=window.__user;catalog=[{id:"song-1",title:"Тестовая"}];songId="song-1";recordings=[r];active=true;},moveRecording:moveRecording,renderRecords:renderRecords}};'
);
assert.notEqual(code,source,'Test injection must find export');
window.__db=firestore;window.__user=user;
vm.runInNewContext(code,{document,window,firebase,navigator:{onLine:true},fetch,Promise,Math,Date,Number,String,Array,Object,Error,console},{timeout:1000});
const t=window.VMM_RECORDINGS._test,record={id:'doc-1',...recordData};
t.set(record);
t.renderRecords();
assert.doesNotMatch(nodes['vmm-r-records'].innerHTML,/data-r-action="trash"/,'Trash must be hidden from the ordinary audio row');
function flush(){return new Promise(resolve=>setTimeout(resolve,30));}
t.moveRecording(record,true);
await flush();
assert.equal(fileTrashed,true);
assert.equal(metadataUpdated,1);
assert.equal(auditCount,1);
assert.equal(record.archived,true);
assert.match(nodes['vmm-r-records'].innerHTML,/Восстановить/);
assert.doesNotMatch(nodes['vmm-r-records'].innerHTML,/data-r-action="trash"/);
assert.match(nodes['vmm-r-status'].textContent,/история сохранена/);
t.moveRecording(record,false);
await flush();
assert.equal(fileTrashed,false);
assert.equal(metadataUpdated,2);
assert.equal(auditCount,2);
assert.equal(record.archived,false);
assert.doesNotMatch(nodes['vmm-r-records'].innerHTML,/data-r-action="trash"/);
// Never trash a file in a different folder, even with a valid Drive token.
folder='unrelated-folder';
t.moveRecording(record,true);
await flush();
assert.equal(driveChanges,2,'Must not modify file outside managed Drive folder');
assert.equal(metadataUpdated,2,'Must not alter database for unrelated Drive file');
assert.equal(record.archived,false);
assert.match(nodes['vmm-r-status'].textContent,/вне папки/);
// Never archive an offline-only local document or another song.
t.moveRecording({id:'offline:drive-1',...recordData},true);
await flush();
assert.equal(metadataUpdated,2);
assert.ok(asks>=3,'Destructive actions must require confirmation');
console.log('PASS: user confirmation, scope to managed Drive folder, reversible Trash, immutable song/lyric records, audit, offline-only rejected');
