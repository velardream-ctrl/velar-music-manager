/* RUN-064: private, reversible song-to-artist overrides, never change
   vmm_catalog.artist, release credits, UPC, lyrics, offline blobs or Drive.
   Saved in the already admin-only vmm_links collection (no rules change).
   ES5 / Safari 12. */
(function(){
 'use strict';
 var DOC='artist_track_assignments_v1',NONE='unassigned';
 function key(s){return String(s==null?'':s).trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');}
 function validArtist(s){return typeof s==='string'&&/^[a-z0-9-]{2,80}$/.test(s);}
 function validId(s){return typeof s==='string'&&s.length>0&&s.length<=300&&!/[\/]/.test(s);}
 function inferred(track){
   if(!window.VMM_ARTIST_CHOICES)return '';
   return window.VMM_ARTIST_CHOICES.inferredId(track&&track.artist);
 }
 function effective(track,overrides){
   if(track&&overrides&&Object.prototype.hasOwnProperty.call(overrides,track.id))
     return overrides[track.id]===NONE?'':overrides[track.id];
   return inferred(track);
 }
 function sanitize(overrides){
   if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))
     return {};
   var clean={},n=0;
   Object.keys(overrides).forEach(function(id){
     var artist=overrides[id];
     if(!validId(id)||!(artist===NONE||validArtist(artist)))return;
     if(++n>2000)throw new Error('Слишком много индивидуальных привязок.');
     clean[id]=artist;
   });
   return clean;
 }
 function ref(db){return db.collection('vmm_links').doc(DOC);}
 function read(db){
   return ref(db).get({source:'server'}).then(function(snapshot){
     if(!snapshot.exists)return {revision:0,overrides:{}};
     var d=snapshot.data()||{};
     if(d.schemaVersion!==1)throw new Error('Неподдерживаемый формат связей артистов.');
     return {revision:Number(d.revision)||0,overrides:sanitize(d.overrides)};
   });
 }
 function apply(current,artistId,chosen,tracks){
   if(!validArtist(artistId))throw new Error('Недопустимый ID артиста.');
   if(!Array.isArray(tracks)||tracks.length>1200)
     throw new Error('Нельзя назначать песни из неполного каталога.');
   var selected={};
   if(!Array.isArray(chosen))throw new Error('Ошибка выбранных песен.');
   chosen.forEach(function(id){if(!validId(id))throw new Error('Недопустимый ID композиции.');selected[id]=true;});
   var out=sanitize(current),seen={};
   tracks.forEach(function(track){
     if(!track||!validId(track.id)||seen[track.id])throw new Error('Повторяющийся или отсутствующий ID песни.');
     seen[track.id]=true;
     var prev=effective(track,current),source=inferred(track),wanted=!!selected[track.id];
     if(wanted){
       if(source===artistId)delete out[track.id]; // revert to original inferred artist
       else out[track.id]=artistId; // explicit site-only reassignment
     }else if(prev===artistId){
       if(source===artistId)out[track.id]=NONE; // explicit removal from inferred artist
       else delete out[track.id]; // revert an old manual reassignment
     }
     // Never touch tracks that belong to another artist and weren't selected.
   });
   Object.keys(selected).forEach(function(id){
     if(!seen[id])throw new Error('Выбрана песня, отсутствующая в загруженном каталоге.');
   });
   return out;
 }
 function conflicts(current,artistId,chosen,tracks){
   var selected={};(chosen||[]).forEach(function(id){selected[id]=true;});
   return (tracks||[]).filter(function(track){
     if(!selected[track.id])return false;
     var owner=effective(track,current);
     return !!owner&&owner!==artistId;
   }).map(function(x){return {id:x.id,title:String(x.title||'Без названия'),previous:effective(x,current)};});
 }
 function save(db,userId,artistId,chosen,tracks,expectedRevision){
   if(!navigator.onLine)return Promise.reject(new Error('Нет интернета для сохранения привязок.'));
   if(!userId||!validArtist(artistId))return Promise.reject(new Error('Нет разрешённого администратора или артиста.'));
   var target=ref(db);
   return db.runTransaction(function(tx){
     return tx.get(target).then(function(s){
       var d=s.exists?s.data()||{}:{},rev=s.exists?(Number(d.revision)||0):0;
       if(s.exists&&d.schemaVersion!==1)throw new Error('Несовместимая версия данных привязок.');
       if(rev!==expectedRevision)throw new Error('Привязки изменились в другом окне. Обнови список перед сохранением.');
       var map=apply(d.overrides||{},artistId,chosen,tracks);
       tx.set(target,{schemaVersion:1,revision:rev+1,overrides:map,
         updatedBy:userId,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
       return {revision:rev+1,overrides:map};
     });
   });
 }
 window.VMM_ARTIST_TRACKS={read:read,save:save,apply:apply,effective:effective,
   conflicts:conflicts,sanitize:sanitize,documentId:DOC};
}());
