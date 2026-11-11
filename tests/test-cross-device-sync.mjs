import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../studio/offline-cloud-sync.js',import.meta.url),'utf8');
const offline=fs.readFileSync(new URL('../studio/offline-repertoire.js',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../studio/index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.match(src,/__offline_pins__/);
assert.match(src,/db\.runTransaction/);
assert.match(src,/ownerUid/);
assert.match(src,/schemaVersion:1/);
assert.doesNotMatch(src,/accessToken|localStorage|sessionStorage|blob:/);
assert.match(offline,/queuePinChange/);
assert.match(offline,/pendingPinChanges/);
assert.match(offline,/acknowledgePinChange/);
assert.match(offline,/wasCloudReady/);
assert.match(offline,/markCloudReady/);
assert.match(offline,/indexedDB\.open\(NAME,2\)/);
assert.ok(page.includes('src="offline-cloud-sync.js?v=1"'));
assert.ok(page.includes('src="offline-repertoire.js?v=3"'));
assert.ok(page.includes('src="recordings.js?v=12"'));
assert.ok(sw.includes("STUDIO_PREFIX+'v22'"));
assert.ok(sw.includes('./studio/offline-cloud-sync.js?v=1'));
assert.doesNotMatch(sw,/drive\.googleapis\.com|audio\/flac|audio\/mpeg/);
const window={};
vm.runInNewContext(src,{window,navigator:{onLine:true},Promise,Array,Object,String,Number,Math,Date,Error},{timeout:1000});
const api=window.VMM_CLOUD_PINS;
assert.ok(api);
const map=new Map();
const uid='owner12345';
const db={
 collection(name){
  assert.equal(name,'vmm_recordings');
  return {doc(id){
   return {id,get(){const item=map.get(id);return Promise.resolve({
    exists:!!item,data(){return item;}
   });}};
  }};
 },
 runTransaction(fn){
  const tx={
   get(ref){const item=map.get(ref.id);return Promise.resolve({exists:!!item,data(){return item;}});},
   set(ref,value){map.set(ref.id,value);}
  };
  return Promise.resolve().then(()=>fn(tx));
 }
};
const phone=[{fileId:'file_abc0001',catalogId:'songA',title:'Дикая вишня',size:35000000,blob:{size:35000000},lyrics:'private words'}];
const one=await api.read(db,uid,phone);
assert.equal(one.bootstrapped,true);
assert.equal(one.pins.length,1);
assert.ok(!('blob' in one.pins[0]));
assert.ok(!('lyrics' in one.pins[0]));
assert.equal(one.pins[0].title,'Дикая вишня');
// Computer opens later; it sees cloud selection without binary transfer via Firestore.
const desktop=await api.read(db,uid,[]);
assert.equal(desktop.pins.length,1);
assert.equal(desktop.pins[0].fileId,'file_abc0001');
await api.update(db,uid,{fileId:'file_xyz0002',catalogId:'songB',title:'Журавли',size:23800000},true);
const phoneAgain=await api.read(db,uid,phone);
assert.equal(JSON.stringify(phoneAgain.pins.map(p=>p.fileId).sort()),JSON.stringify(['file_abc0001','file_xyz0002']));
// The choice is per-user, and removing a pin propagates to every device.
await api.update(db,uid,phone[0],false);
const after=await api.read(db,uid,[]);
assert.equal(JSON.stringify(after.pins.map(p=>p.fileId)),JSON.stringify(['file_xyz0002']));
const other=await api.read(db,'someone_else',[]);
assert.equal(other.pins.length,0);
assert.notEqual(api.path(uid),api.path('someone_else'));
const stored=JSON.stringify([...map.values()]);
assert.doesNotMatch(stored,/private words|accessToken|secret|blob/);
console.log('PASS: Firestore owner manifest bootstraps phone offline set, syncs desktop and unpins globally without cloud audio');
