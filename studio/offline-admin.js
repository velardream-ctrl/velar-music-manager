/* RUN-095: private admin offline drafts/outbox. No public Service Worker data.
   User-scoped IndexedDB only, ES5 for Safari 12; no auth tokens or binary uploads. */
(function(){
 'use strict';
 var NAME='velar-private-admin-v1',STORE='entries',database=null,sequence=0;
 function open(){
   if(database)return Promise.resolve(database);
   return new Promise(function(resolve,reject){
     if(!window.indexedDB){reject(new Error('IndexedDB недоступен. Не закрывай страницу, экспортируй текст.'));return;}
     var r=window.indexedDB.open(NAME,1);
     r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains(STORE))
       r.result.createObjectStore(STORE,{keyPath:'key'});};
     r.onsuccess=function(){database=r.result;resolve(database);};
     r.onerror=function(){reject(r.error||new Error('Локальная база недоступна'));};
   });
 }
 function valid(uid,name){
   if(!uid||!name||typeof name!=='string'||name.length>300||name.indexOf('|')>=0)
     throw new Error('Неправильный ключ локальной записи');
   return String(uid)+'|'+name;
 }
 function transact(mode,cb){
   return open().then(function(db){return new Promise(function(resolve,reject){
     var tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),result;
     try{cb(store,function(v){result=v;});}catch(e){reject(e);return;}
     tx.oncomplete=function(){resolve(result);};
     tx.onerror=function(){reject(tx.error||new Error('Ошибка сохранения на устройстве'));};
     tx.onabort=function(){reject(tx.error||new Error('Локальная операция отменена'));};
   });});
 }
 function get(uid,name){
   var key=valid(uid,name);
   return transact('readonly',function(s,done){var req=s.get(key);
     req.onsuccess=function(){done(req.result||null);};
   });
 }
 function put(uid,name,value){
   var key=valid(uid,name),nonce=Date.now()+'-'+(++sequence);
   var item={key:key,uid:String(uid),name:name,value:value,nonce:nonce,updatedAt:Date.now()};
   return transact('readwrite',function(s){s.put(item);}).then(function(){return item;});
 }
 // Never acknowledge a stale upload if a more recent edit arrived mid-sync.
 function acknowledge(uid,name,nonce){
   var key=valid(uid,name);
   return transact('readwrite',function(s,done){
     var req=s.get(key);
     req.onsuccess=function(){
       if(req.result&&req.result.nonce===nonce){s.delete(key);done(true);}
       else done(false);
     };
   });
 }
 function list(uid,prefix){
   valid(uid,prefix||'all');
   return transact('readonly',function(s,done){
     var all=[],req=s.openCursor();
     req.onsuccess=function(){
       var cursor=req.result;
       if(!cursor){done(all);return;}
       if(cursor.value.uid===String(uid)&&
          (!prefix||cursor.value.name.indexOf(prefix)===0))all.push(cursor.value);
       cursor.continue();
     };
   });
 }
 function exportPending(uid){
   return list(uid,'pending:').then(function(items){
     if(!items.length)throw new Error('Нет ожидающих синхронизации записей.');
     var data={format:'VELAR_ADMIN_OFFLINE_BACKUP_V1',createdAt:new Date().toISOString(),
       ownerUid:String(uid),items:items.map(function(item){
         return {name:item.name,value:item.value,updatedAt:item.updatedAt};
       })};
     var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
     var url=URL.createObjectURL(blob),a=document.createElement('a');
     a.href=url;a.download='VELAR_offline_admin_backup_'+new Date().toISOString().slice(0,10)+'.json';
     document.body.appendChild(a);a.click();document.body.removeChild(a);
     window.setTimeout(function(){URL.revokeObjectURL(url);},1500);
     return items.length;
   });
 }
 window.VMM_OFFLINE_ADMIN={get:get,put:put,acknowledge:acknowledge,list:list,
   exportPending:exportPending};
}());
