/* RUN-047: explicitly selected offline repertoire in IndexedDB.
   Binaries and private lyrics stay on this device, never in public caches. */
(function(){
  'use strict';
  var NAME='velar-audio-repertoire-v1',STORE='tracks',META='preferences',dbPromise=null;
  function open(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise(function(resolve,reject){
      if(!window.indexedDB){reject(new Error('Офлайн-хранилище недоступно в этом браузере.'));return;}
      var req=window.indexedDB.open(NAME,2);
      req.onupgradeneeded=function(){
        var db=req.result;
        if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
        if(!db.objectStoreNames.contains(META))db.createObjectStore(META,{keyPath:'uid'});
      };
      req.onsuccess=function(){resolve(req.result);};
      req.onerror=function(){reject(req.error||new Error('Ошибка IndexedDB'));};
    }).catch(function(err){dbPromise=null;throw err;});
    return dbPromise;
  }
  function transaction(mode,callback){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction(STORE,mode),store=tx.objectStore(STORE),req;
      try{req=callback(store);}catch(e){reject(e);return;}
      tx.oncomplete=function(){resolve(req&&req.result);};
      tx.onabort=function(){reject(tx.error||new Error('Операция офлайн-хранилища отменена'));};
      tx.onerror=function(){reject(tx.error||new Error('Ошибка локального хранилища'));};
    });});
  }
  function key(uid,fileId){return String(uid)+':'+String(fileId);}
  function put(uid,item){
    if(!item||!item.fileId||!item.blob||!item.blob.size)return Promise.reject(new Error('Нужны аудиофайл и ID'));
    return transaction('readwrite',function(s){
      return s.put({
        key:key(uid,item.fileId),uid:uid,fileId:item.fileId,catalogId:item.catalogId||'',
        title:item.title||'',artist:item.artist||'',variant:item.variant||'',
        filename:item.filename||'',mimeType:item.mimeType||'',size:item.blob.size,
        savedAt:Date.now(),lyrics:item.lyrics||'',blob:item.blob
      });
    });
  }
  function get(uid,fileId){return transaction('readonly',function(s){return s.get(key(uid,fileId));});}
  function remove(uid,fileId){return transaction('readwrite',function(s){return s.delete(key(uid,fileId));});}
  function list(uid){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var result=[],tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).openCursor();
      req.onsuccess=function(){var cur=req.result;if(!cur)return;var v=cur.value;if(v.uid===uid)result.push(v);cur.continue();};
      tx.oncomplete=function(){resolve(result);};
      tx.onerror=function(){reject(tx.error||new Error('Ошибка чтения списка'));};
    });});
  }
  // Only the song identifier is remembered. Lyrics and OAuth tokens are never
  // stored as preferences; offline audio remains in the user-scoped tracks store.
  function rememberSelection(uid,catalogId){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction(META,'readwrite');
      tx.objectStore(META).put({uid:String(uid),catalogId:String(catalogId||''),updatedAt:Date.now()});
      tx.oncomplete=function(){resolve();};
      tx.onerror=function(){reject(tx.error||new Error('Не удалось запомнить песню'));};
    });});
  }
  function lastSelection(uid){
    return open().then(function(db){return new Promise(function(resolve,reject){
      var tx=db.transaction(META,'readonly'),req=tx.objectStore(META).get(String(uid));
      tx.oncomplete=function(){resolve(req.result&&req.result.catalogId||'');};
      tx.onerror=function(){reject(tx.error||new Error('Не удалось прочитать последнюю песню'));};
    });});
  }
  function estimate(){
    if(navigator.storage&&navigator.storage.estimate)return navigator.storage.estimate().catch(function(){return null;});
    return Promise.resolve(null);
  }
  function persist(){
    if(navigator.storage&&navigator.storage.persist)return navigator.storage.persist().catch(function(){return false;});
    return Promise.resolve(false);
  }
  window.VMM_OFFLINE={key:key,put:put,get:get,remove:remove,list:list,rememberSelection:rememberSelection,lastSelection:lastSelection,estimate:estimate,persist:persist};
}());