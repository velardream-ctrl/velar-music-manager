import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const offline=read('studio/offline-admin.js');
const pub=read('public-offline.js');
const sync=read('studio/offline-lyrics-sync.js');
new vm.Script(offline);new vm.Script(pub);new vm.Script(sync);
new vm.Script(read('studio/studio.js'));
new vm.Script(read('studio/landing-editor.js'));
new vm.Script(read('velar-assistant.js'));
function indexedDB(){
 const maps={},dbs={};
 function makeDB(name){
  const stores=maps[name]||(maps[name]={}),names={
   contains(k){return Object.prototype.hasOwnProperty.call(stores,k);}
  };
  return dbs[name]||(dbs[name]={
   objectStoreNames:names,createObjectStore(k){stores[k]=new Map();},
   transaction(k){
    const map=stores[k],tx={oncomplete:null,onerror:null,onabort:null},state={pending:0,done:false};
    function task(fn){
     state.pending++;
     setTimeout(()=>{
      try{fn();}
      catch(e){tx.error=e;if(tx.onerror)tx.onerror();}
      state.pending--;
      if(state.pending===0&&!state.done){state.done=true;setTimeout(()=>{if(tx.oncomplete)tx.oncomplete();},0);}
     },0);
    }
    const store={
     put(value,key){
      const req={};task(()=>{req.result=key||value.key||value.uid;map.set(req.result,value);if(req.onsuccess)req.onsuccess();});return req;
     },
     get(key){
      const req={};task(()=>{req.result=map.get(key);if(req.onsuccess)req.onsuccess();});return req;
     },
     delete(key){
      const req={};task(()=>{map.delete(key);if(req.onsuccess)req.onsuccess();});return req;
     },
     openCursor(){
      const rows=Array.from(map.entries()),req={};let pos=0;
      function next(){
       task(()=>{const row=rows[pos++];req.result=row?{
        value:row[1],continue(){next();}
       }:null;if(req.onsuccess)req.onsuccess();});
      }
      next();return req;
     }
    };
    tx.objectStore=()=>store;
    return tx;
   }
  });
 }
 return {open(name){
  const req={};setTimeout(()=>{
   req.result=makeDB(name);
   if(req.onupgradeneeded)req.onupgradeneeded();
   if(req.onsuccess)req.onsuccess();
  },0);return req;
 }};
}
const fake=indexedDB(),window={indexedDB:fake};
vm.runInNewContext(offline,{window,Promise,Date,Array,String,Object,JSON,Error,Math,setTimeout},{timeout:1000});
const store=window.VMM_OFFLINE_ADMIN;
assert.equal(typeof store.put,'function');
const row=await store.put('owner-01','pending:landing',{baseRevision:3,content:{hello:'offline'}});
assert.equal((await store.get('owner-01','pending:landing')).value.content.hello,'offline');
assert.equal(await store.get('owner-02','pending:landing'),null,'Other user must not see offline drafts');
assert.equal((await store.list('owner-01','pending:')).length,1);
assert.equal(await store.acknowledge('owner-01','pending:landing','wrong-nonce'),false);
assert.equal((await store.list('owner-01','pending:')).length,1,'Stale nonce cannot delete draft');
const newer=await store.put('owner-01','pending:landing',{baseRevision:3,content:{hello:'new edit'}});
assert.equal(await store.acknowledge('owner-01','pending:landing',row.nonce),false,
 'Older upload cannot acknowledge a newer local edit');
assert.equal((await store.get('owner-01','pending:landing')).value.content.hello,'new edit');
assert.equal(await store.acknowledge('owner-01','pending:landing',newer.nonce),true);
assert.equal((await store.list('owner-01','pending:')).length,0);
const publicWin={indexedDB:fake,VMM_LANDING_SCHEMA:{normalize:x=>x}};
vm.runInNewContext(pub,{window:publicWin,Promise,Date,Array,String,Object,JSON,Error},{timeout:1000});
assert.equal(await publicWin.VMM_PUBLIC_OFFLINE.read(),null);
await publicWin.VMM_PUBLIC_OFFLINE.put({hero:{title:'VELAR'},genres:{assistant:{enabled:true}}});
assert.equal((await publicWin.VMM_PUBLIC_OFFLINE.read()).hero.title,'VELAR');
const html=read('studio/index.html'),publicHtml=read('index.html'),sw=read('sw.js');
assert.match(html,/offline-admin\.js\?v=1/);
assert.match(html,/offline-lyrics-sync\.js\?v=1/);
assert.match(html,/landing-offline-status/);
assert.match(html,/lyrics-offline-status/);
assert.match(publicHtml,/public-offline\.js\?v=1/);
assert.match(sw,/\.\/public-offline\.js\?v=1/);
assert.match(sw,/\.\/studio\/offline-admin\.js\?v=1/);
assert.match(sw,/\.\/studio\/offline-lyrics-sync\.js\?v=1/);
assert.match(read('landing-public.js'),/VMM_PUBLIC_OFFLINE\.read\(\)/);
assert.match(read('landing-public.js'),/VMM_PUBLIC_OFFLINE\.put\(d\.content\)/);
assert.match(read('velar-assistant.js'),/function notifyConnectivity/);
assert.match(sync,/КОНФЛИКТ: текст изменён с другого устройства/);
assert.match(read('studio/landing-editor.js'),/КОНФЛИКТ: облачный черновик изменился/);
assert.doesNotMatch(sw,/cache\.put\(req, response\)/,'No caching private Firestore responses');
console.log('PASS: RUN-095 offline outbox CRUD, owner isolation, nonce conflict, public snapshot and cached shell contracts');
