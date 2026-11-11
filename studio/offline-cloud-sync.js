/* RUN-058: sync only private offline-selection metadata via existing admin-only
   Firestore collection. Actual media stays in private Google Drive and IndexedDB.
   No OAuth tokens, private lyrics or audio blobs enter Firestore. ES5/Safari 12. */
(function(){
  'use strict';
  var PREFIX='__offline_pins__',LIMIT=800;
  function clean(s,max){return String(s==null?'':s).trim().slice(0,max||180);}
  function fileId(s){s=clean(s,180);return /^[A-Za-z0-9_-]{4,180}$/.test(s)?s:'';}
  function pin(item){
    if(!item)return null;
    var id=fileId(item.fileId||item.driveFileId),catalog=clean(item.catalogId,160);
    if(!id||!catalog)return null;
    return {fileId:id,catalogId:catalog,title:clean(item.title,180),
      artist:clean(item.artist,150),variant:clean(item.variant,80),
      filename:clean(item.filename,180),mimeType:clean(item.mimeType,80),
      size:Math.max(0,Math.min(50*1024*1024,Number(item.size)||0))};
  }
  function sanitize(rows){
    var seen={},list=[];
    (Array.isArray(rows)?rows:[]).forEach(function(item){
      var p=pin(item);if(!p||seen[p.fileId])return;
      if(list.length>=LIMIT)throw new Error('В подборке больше '+LIMIT+' записей. Нельзя молча потерять часть выбора при синхронизации.');
      seen[p.fileId]=true;list.push(p);
    });
    return list;
  }
  function path(uid){
    var u=clean(uid,150);
    if(!/^[A-Za-z0-9_-]{4,150}$/.test(u))throw new Error('Неверный UID для офлайн-синхронизации.');
    return PREFIX+u;
  }
  function ref(db,uid){return db.collection('vmm_recordings').doc(path(uid));}
  function stamp(){
    return window.firebase&&firebase.firestore&&firebase.firestore.FieldValue?
      firebase.firestore.FieldValue.serverTimestamp():new Date().toISOString();
  }
  function payload(uid,rows){
    return {ownerUid:uid,schemaVersion:1,pins:sanitize(rows),updatedAt:stamp()};
  }
  // New accounts bootstrap once from their existing phone cache. If another
  // device created the manifest first, transactions never overwrite it.
  function read(db,uid,local){
    if(!navigator.onLine){
      return ref(db,uid).get({source:'cache'}).then(function(s){
        if(!s.exists)return {pins:[],authoritative:false};
        var d=s.data()||{};
        if(d.ownerUid!==uid)throw new Error('Данные офлайн-подборки другого аккаунта.');
        return {pins:sanitize(d.pins),authoritative:false};
      }).catch(function(){return {pins:[],authoritative:false};});
    }
    var target=ref(db,uid);
    return db.runTransaction(function(tx){
      return tx.get(target).then(function(s){
        if(s.exists){
          var data=s.data()||{};
          if(data.ownerUid!==uid)throw new Error('UID офлайн-подборки не совпадает.');
          return {pins:sanitize(data.pins),authoritative:true};
        }
        var base=sanitize(local||[]);
        tx.set(target,payload(uid,base));
        return {pins:base,authoritative:true,bootstrapped:true};
      });
    });
  }
  function update(db,uid,item,enabled){
    if(!navigator.onLine)return Promise.reject(new Error('Нет сети для синхронизации выбора.'));
    var target=ref(db,uid),candidate=pin(item);
    if(!candidate)throw new Error('У фонограммы нет корректного ID.');
    return db.runTransaction(function(tx){
      return tx.get(target).then(function(s){
        var data=s.exists?s.data()||{}:{};
        if(s.exists&&data.ownerUid!==uid)throw new Error('UID офлайн-подборки не совпадает.');
        var old=sanitize(data.pins||[]).filter(function(p){return p.fileId!==candidate.fileId;});
        if(enabled)old.push(candidate);
        tx.set(target,payload(uid,old));
        return sanitize(old);
      });
    });
  }
  window.VMM_CLOUD_PINS={pin:pin,sanitize:sanitize,path:path,read:read,update:update};
}());
