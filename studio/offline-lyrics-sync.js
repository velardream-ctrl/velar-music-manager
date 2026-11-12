/* RUN-095: offline lyric text edits, private local outbox, safe cloud replay.
   Never publish lyrics or rely on Firestore's implicit pending writes. ES5/iOS12. */
(function(){
 'use strict';
 var store=window.VMM_OFFLINE_ADMIN,queue=Promise.resolve(),timer=null,syncing=false;
 var persistedKey='',persistedText='';
 function studio(){return window.VMM_STUDIO;}
 function ctx(){return studio()&&studio().offlineLyricContext&&studio().offlineLyricContext();}
 function status(s){var el=document.getElementById('lyrics-offline-status');if(el)el.textContent=s;}
 function key(c){
   if(!c||!c.uid||!c.key||!c.meta)return '';
   var str=c.key+'_'+String(c.meta.language||'Русский')+'_'+String(c.meta.version||'Основная');
   var hash=0;for(var i=0;i<str.length;i++)hash=((hash<<5)-hash+str.charCodeAt(i))|0;
   return 'pending:lyric:'+encodeURIComponent(str.slice(0,125))+'_'+(hash>>>0).toString(36);
 }
 function serialSave(c){
   if(!store||!c||!c.dirty||!c.uid||!c.meta||!c.text.trim())return Promise.resolve(null);
   var name=key(c);
   var snapshot={uid:c.uid,key:c.key,meta:{
     title:c.meta.title,upc:c.meta.upc||'',catalogRow:c.meta.catalogRow||'',
     language:c.meta.language||'Русский',version:c.meta.version||'Основная'
   },text:c.text,baseText:c.baseText,isEdit:!!c.recordId,recordId:c.recordId||''};
   queue=queue.catch(function(){}).then(function(){
     return store.get(snapshot.uid,name).then(function(existing){
       if(existing&&existing.value){
         // Preserve the initial cloud baseline and stable new Firestore document ID.
         snapshot.baseText=existing.value.baseText;
         snapshot.recordId=existing.value.recordId;
         snapshot.isEdit=existing.value.isEdit;
       }else if(!snapshot.recordId){
         snapshot.recordId=c.db.collection('vmm_lyrics').doc().id;
       }
       return store.put(snapshot.uid,name,snapshot);
     });
   });
   return queue.then(function(item){
     persistedKey=name;persistedText=snapshot.text;
     status('Текст сохранён на этом устройстве. Синхронизация с облаком будет проверена при подключении.');
     return item;
   }).catch(function(err){
     status('Ошибка сохранения текста на устройстве: '+err.message+'. Скопируй текст или экспортируй данные.');
     throw err;
   });
 }
 function saveNow(){
   if(timer!==null){clearTimeout(timer);timer=null;}
   return serialSave(ctx());
 }
 function edited(){
   if(timer!==null)clearTimeout(timer);
   timer=setTimeout(function(){timer=null;serialSave(ctx()).catch(function(){});},220);
 }
 function recover(){
   var c=ctx();
   if(!store||!c||!c.uid||!c.meta)return Promise.resolve(null);
   var k=key(c),oldText=c.text,oldBase=c.baseText;
   return store.get(c.uid,k).then(function(saved){
     if(!saved||!saved.value)return null;
     if(!studio()||!studio().offlineLyricContext)return null;
     var now=ctx();
     if(key(now)!==k||now.text!==oldText||now.baseText!==oldBase)return null;
     studio().offlineRestoreLyric(saved.value.text,saved.value.baseText);
     persistedKey=k;persistedText=saved.value.text;
     status('Восстановлен локальный текст. Он ещё не подтверждён облаком; при конфликте останется здесь.');
     return saved;
   }).catch(function(err){status('Ошибка восстановления локального текста: '+err.message);return null;});
 }
 function metadataSame(a,b){
   return String(a.title||'')===String(b.title||'')&&
     String(a.upc||'')===String(b.upc||'')&&
     String(a.catalogRow||'')===String(b.catalogRow||'')&&
     String(a.language||'').toLowerCase()===String(b.language||'').toLowerCase()&&
     String(a.version||'Основная').toLowerCase()===String(b.version||'Основная').toLowerCase();
 }
 function uploadOne(db,uid,item){
   var p=item.value,ref=db.collection('vmm_lyrics').doc(p.recordId);
   var before=p.baseText||'',current=p.text;
   if(!p.recordId||!p.meta||!current||current.length>500000)
     return Promise.reject(new Error('Некорректный локальный текст'));
   var verify=p.isEdit?Promise.resolve():db.collection('vmm_lyrics').limit(500).get({source:'server'}).then(function(list){
     var duplicate=false;
     list.forEach(function(doc){if(doc.id!==p.recordId&&metadataSame(doc.data()||{},p.meta))duplicate=true;});
     if(duplicate)throw new Error('Версия песни уже создана другим устройством. Требуется сверка.');
   });
   return verify.then(function(){return db.runTransaction(function(tx){
     return tx.get(ref).then(function(snapshot){
       if(snapshot.exists&&String(snapshot.data().text||'')===current)return 'already';
       if(p.isEdit){
         if(!snapshot.exists)throw new Error('Облачная версия удалена: требуется ручная сверка.');
         if(String(snapshot.data().text||'')!==before)
           throw new Error('КОНФЛИКТ: текст изменён с другого устройства. Локальная версия сохранена.');
         tx.update(ref,{text:current,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:uid});
       }else{
         if(snapshot.exists)throw new Error('Документ песни уже существует с другим текстом.');
         tx.set(ref,{title:p.meta.title,upc:p.meta.upc,catalogRow:p.meta.catalogRow,
           language:p.meta.language,version:p.meta.version,text:current,
           createdAt:firebase.firestore.FieldValue.serverTimestamp(),
           updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:uid});
       }
       var audit=db.collection('vmm_audit').doc();
       tx.set(audit,{time:firebase.firestore.FieldValue.serverTimestamp(),
         operation:p.isEdit?'Текст песни изменён (офлайн)':'Текст песни создан (офлайн)',
         subject:p.meta.title,result:p.meta.language+' · '+p.meta.version,
         referenceId:p.recordId,actor:uid});
       return 'written';
     });
   });}).then(function(){
     return store.acknowledge(uid,item.name,item.nonce).then(function(ack){
       if(ack&&studio()&&studio().offlineLyricSynced)
         studio().offlineLyricSynced(p.key,p.meta,current,p.recordId);
       return ack;
     });
   });
 }
 function savedCurrent(){
   var c=ctx();return !!(c&&key(c)===persistedKey&&c.text===persistedText);
 }
 function pendingCurrent(){
   var c=ctx();return c&&store?store.get(c.uid,key(c)).then(function(v){return !!v;}):Promise.resolve(false);
 }
 function syncAll(){
   var c=ctx();
   if(syncing||!store||!c||!c.uid||!c.db||navigator.onLine===false)return Promise.resolve();
   syncing=true;var uid=c.uid,db=c.db,done=0,issues=[];
   return queue.catch(function(){}).then(function(){
     return db.collection('vmm_admins').doc(uid).get({source:'server'});
   }).then(function(admin){
     if(!admin.exists||admin.data().enabled!==true)throw new Error('Нет подтверждённых прав администратора.');
     return store.list(uid,'pending:lyric:');
   }).then(function(rows){
     return rows.reduce(function(chain,row){
       return chain.then(function(){
         if(navigator.onLine===false)throw new Error('Сеть снова недоступна');
         var next=ctx();
         if(!next||next.uid!==uid)throw new Error('Аккаунт изменён.');
         return uploadOne(db,uid,row).then(function(){done++;}).catch(function(err){
           issues.push(row.value.meta.title+': '+err.message);
         });
       });
     },Promise.resolve());
   }).then(function(){
     status(issues.length?
       'Синхронизировано '+done+'. Есть конфликты: '+issues.slice(0,2).join('; ')+'. Локальные записи не удалены.':
       'Все '+done+' ожидавших изменений текста синхронизированы с облаком.');
   }).catch(function(err){status('Ожидание сети/доступа: '+err.message+'. Локальные записи сохранены.');})
     .then(function(){syncing=false;});
 }
 function cacheDataset(uid,catalog,lyrics){
   if(!uid||!store)return Promise.resolve();
   return store.put(uid,'cache:lyrics',{catalog:catalog,lyrics:lyrics})
     .catch(function(err){status('Не удалось обновить локальный каталог: '+err.message);});
 }
 function cachedDataset(uid){return store&&uid?store.get(uid,'cache:lyrics').then(function(v){return v&&v.value||null;}):Promise.resolve(null);}
 window.addEventListener('online',function(){syncAll();});
 window.addEventListener('pagehide',function(){if(timer!==null){clearTimeout(timer);timer=null;saveNow().catch(function(){});}});
 window.VMM_OFFLINE_LYRICS={edited:edited,saveNow:saveNow,recover:recover,
   savedCurrent:savedCurrent,pendingCurrent:pendingCurrent,
   syncAll:syncAll,cacheDataset:cacheDataset,cachedDataset:cachedDataset};
}());
