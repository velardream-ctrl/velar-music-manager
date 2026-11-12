/* RUN-095: anonymous PUBLIC published landing snapshot only, for cached offline
   music sections and local VELAR Assistant. Never stores private lyrics,
   unpublished drafts, auth data, tokens, recordings or client messages. */
(function(){
 'use strict';
 var dbReady=null,NAME='velar-public-content-v1',STORE='snapshots';
 function open(){
   if(dbReady)return dbReady;
   if(!window.indexedDB)return Promise.reject(new Error('Нет локального хранилища'));
   dbReady=new Promise(function(resolve,reject){
     var r=window.indexedDB.open(NAME,1);
     r.onupgradeneeded=function(){if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};
     r.onsuccess=function(){resolve(r.result);};
     r.onerror=function(){reject(r.error||new Error('Ошибка кэша публичной страницы'));};
   }).catch(function(e){dbReady=null;throw e;});
   return dbReady;
 }
 function transact(mode,write){
   return open().then(function(db){return new Promise(function(resolve,reject){
     var tx=db.transaction(STORE,mode),s=tx.objectStore(STORE),req;
     try{req=write(s);}catch(e){reject(e);return;}
     tx.oncomplete=function(){resolve(req&&req.result);};
     tx.onerror=function(){reject(tx.error||new Error('Ошибка кэша'));};
     tx.onabort=function(){reject(tx.error||new Error('Кэш отменён'));};
   });});
 }
 function put(content){
   if(!window.VMM_LANDING_SCHEMA)return Promise.resolve();
   var clean=window.VMM_LANDING_SCHEMA.normalize(content);
   return transact('readwrite',function(s){return s.put({schemaVersion:1,content:clean,savedAt:Date.now()},'landing');});
 }
 function read(){
   return transact('readonly',function(s){return s.get('landing');})
     .then(function(v){return v&&v.schemaVersion===1&&v.content||null;});
 }
 window.VMM_PUBLIC_OFFLINE={put:put,read:read};
}());
