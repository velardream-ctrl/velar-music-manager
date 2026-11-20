/* RUN-061 — protected landing CMS, ES5 / Safari 12 compatible.
   Draft and publication are separate Firestore documents. No user lyrics/audio. */
(function(){
 'use strict';
 var API=window.VMM_LANDING_SCHEMA,root=document.getElementById('panel-landing');
 function compareSong(a,b){
   // Russian/Latin alphabetical titles, natural numeric order, artist tie-break.
   var x=String(a&&a.title||'').trim(),y=String(b&&b.title||'').trim();
   var title=x.localeCompare(y,'ru',{numeric:true,sensitivity:'base'});
   return title||String(a&&a.artist||'').trim().localeCompare(
     String(b&&b.artist||'').trim(),'ru',{numeric:true,sensitivity:'base'});
 }

 if(!root||!API)return;
 var tab='hero',data=API.defaults(),baseline='',published=null;
 var uid='',db=null,loaded=false,busy=false,draftRev=0,publishedRev=0,loadGeneration=0;
 var catalogArtists=[],catalogLoaded=false,catalogLoading=false,catalogError='';
 var linksAudit=null,linksAuditSignature='',linksAuditLoading=false;
 var trackLinks={revision:0,overrides:{}},trackLinksLoaded=false;
 var trackEditorArtist='',trackChecked={},trackSearch='',trackSaving=false;
 var pendingArtistLinks=false;
 function offlineLinksName(){return 'pending:artist-links';}
 function restoreArtistLinks(){
   if(!offlineStore||!uid)return Promise.resolve();
   return offlineStore.get(uid,offlineLinksName()).then(function(saved){
     pendingArtistLinks=!!saved;
     if(saved&&saved.value){
       trackLinks={revision:Number(saved.value.baseRevision)||0,
         overrides:window.VMM_ARTIST_TRACKS.sanitize(saved.value.overrides)};
       trackLinksLoaded=true;
       offlineStatus('Есть локальные назначения артистов; облачная синхронизация ожидается.');
       updateButtons();
     }
   }).catch(function(err){offlineStatus('Ошибка чтения привязок: '+err.message);});
 }
 function syncArtistLinks(){
   if(!pendingArtistLinks||!offlineStore||!uid||!db||navigator.onLine===false||trackSaving)return Promise.resolve();
   var account=uid;trackSaving=true;
   return offlineStore.get(account,offlineLinksName()).then(function(saved){
     if(!saved||!saved.value){pendingArtistLinks=false;return;}
     var p=saved.value,map=window.VMM_ARTIST_TRACKS.sanitize(p.overrides);
     return authorized().then(function(auth){
       if(auth.user.uid!==account)throw new Error('Учётная запись изменилась');
       var ref=auth.db.collection('vmm_links').doc(window.VMM_ARTIST_TRACKS.documentId);
       return auth.db.runTransaction(function(tx){
         return tx.get(ref).then(function(old){
           var d=old.exists?old.data()||{}:{},rev=Number(d.revision)||0;
           if(old.exists&&d.schemaVersion!==1)
             throw new Error('Несовместимый формат облачных привязок.');
           if(rev!==Number(p.baseRevision||0))
             throw new Error('КОНФЛИКТ: связи артистов уже изменились с другого устройства.');
           tx.set(ref,{schemaVersion:1,revision:rev+1,overrides:map,updatedBy:account,
             updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
           return rev+1;
         });
       });
     }).then(function(version){
       return offlineStore.acknowledge(account,offlineLinksName(),saved.nonce).then(function(ack){
         if(ack&&uid===account){pendingArtistLinks=false;trackLinks={revision:version,overrides:map};
           offlineStatus('Привязки артистов синхронизированы (версия '+version+').');render();}
       });
     });
   }).catch(function(e){offlineStatus('Назначения артистов остаются на устройстве: '+e.message);})
     .then(function(){trackSaving=false;updateButtons();});
 }
 function saveLinksOffline(artistId,selected,tracks){
   if(!offlineStore||!uid){info('Локальное хранилище не работает. Скопируй изменения.');return;}
   var next;try{next=window.VMM_ARTIST_TRACKS.apply(trackLinks.overrides,artistId,selected,tracks);}
   catch(e){info('Не удалось назначить песни: '+e.message);return;}
   var account=uid,base=trackLinks.revision;
   offlineStore.get(account,offlineLinksName()).then(function(prior){
     var original=prior&&prior.value?prior.value.baseRevision:base;
     return offlineStore.put(account,offlineLinksName(),{baseRevision:original,overrides:next});
   }).then(function(){
     trackLinks={revision:base,overrides:next};pendingArtistLinks=true;
     render();info('Привязки песен сохранены на этом устройстве и ожидают синхронизации.');
   }).catch(function(e){info('Локальное сохранение связей не удалось: '+e.message);});
 }
 var languageEditorCode='',languageCatalogSearch='',languageTrackFilter='',languageCatalogPage=0;
 var topicEditorSlug='',topicCatalogSearch='',topicTrackFilter='',topicCatalogPage=0;
 var genreEditorId='',genreCatalogSearch='',genreTrackFilter='',genreCatalogPage=0;
 var albumEditorId='',albumCatalogSearch='',albumTrackFilter='',albumCatalogPage=0;
 var faqSearch='',faqGroup='',faqPage=0;
 // Offline admin: private IndexedDB outbox, no publication without explicit click.
 var offlineSyncing=false,offlineNonce='',offlineConflict=false,offlineTimer=null,
   offlineWorking=Promise.resolve(),offlineSavedSignature='';
 var offlineStore=window.VMM_OFFLINE_ADMIN;
 function pendingName(){return 'pending:landing';}
 function offlineStatus(msg){var element=id('landing-offline-status');if(element)text(element,msg);}
 function showOfflineConflict(on){
   offlineConflict=!!on;
   var button=id('landing-merge-offline');
   if(button)button.hidden=!offlineConflict;
 }
 function snapshotLocal(){
   if(!offlineStore||!uid||!loaded||busy||!draftDirty())return Promise.resolve(null);
   var payload={content:clone(data),baseRevision:draftRev,baseBaseline:baseline};
   var account=uid,signature=JSON.stringify(payload.content);
   offlineWorking=offlineWorking.catch(function(){}).then(function(){
     return offlineStore.put(account,pendingName(),payload);
   });
   return offlineWorking.then(function(item){
     offlineNonce=item.nonce;offlineSavedSignature=signature;
     offlineStatus('На устройстве сохранён черновик · ожидает синхронизации с облаком.');
     return item;
   }).catch(function(err){
     offlineStatus('Локальное сохранение не удалось: '+err.message+'. Скопируй текст или сделай резервную копию.');
     throw err;
   });
 }
 function scheduleLocal(){
   if(!offlineStore||!uid||!loaded||!draftDirty()||busy)return;
   if(JSON.stringify(data)===offlineSavedSignature)return;
   if(offlineTimer!==null)clearTimeout(offlineTimer);
   offlineTimer=setTimeout(function(){
     offlineTimer=null;snapshotLocal().catch(function(){});
   },250);
 }
 // RUN-185: targeted correction of a common ambiguity: three official
 // links per song, not one. Only repair when denominator exactly equals
 // the clearly labelled song count; never overwrite any other user number.
 function normalizeWithLinkCapacity(raw){
   try{return API.normalize(raw);}
   catch(err){
     if(String(err.message||'').indexOf('Заполненных ссылок не может быть больше общего числа')<0)throw err;
     var candidate=clone(raw),progress=candidate.about&&candidate.about.progress;
     if(!progress||!Array.isArray(progress.metrics))throw err;
     var songs=null;
     progress.metrics.forEach(function(m){
       if(m&&m.label==='Композиции в каталоге'&&
         typeof m.value==='number'&&m.value>=0&&Math.floor(m.value)===m.value)songs=m.value;
     });
     if(songs===null||progress.total!==songs||
       typeof progress.completed!=='number'||progress.completed>songs*3)throw err;
     progress.total=songs*3;
     var clean=API.normalize(candidate);
     return clean;
   }
 }
 function recoverLocal(){
   if(!offlineStore||!uid)return Promise.resolve(null);
   return offlineStore.get(uid,pendingName()).then(function(saved){
     if(!saved||!saved.value)return null;
     var value=saved.value;
     if(!value.content)return null;
     var clean=normalizeWithLinkCapacity(value.content);
     // An offline revision may be older than the currently fetched server doc;
     // retain it visibly, but don't blindly overwrite the cloud.
     data=clean;
     baseline=value.baseBaseline||baseline;
     draftRev=Number(value.baseRevision)||0;
     offlineNonce=saved.nonce;offlineSavedSignature=JSON.stringify(clean);render();
     offlineStatus('Восстановлен локальный черновик. Синхронизация после подключения; при конфликте данные останутся на устройстве.');
     return saved;
   }).catch(function(err){offlineStatus('Не удалось восстановить локальные изменения: '+err.message);return null;});
 }
 function syncOffline(){
   if(offlineSyncing||!offlineStore||!uid||!loaded||busy||!navigator.onLine)return Promise.resolve();
   offlineSyncing=true;
   return offlineWorking.catch(function(){}).then(function(){
     return offlineStore.get(uid,pendingName());
   }).then(function(saved){
     if(!saved||!saved.value)return null;
     var payload=saved.value,clean=normalizeWithLinkCapacity(payload.content),account=uid,nonce=saved.nonce;
     // Always reverify online authority and revision in a server transaction.
     return authorized().then(function(auth){
       if(auth.user.uid!==account)throw new Error('Смена аккаунта: синхронизация отменена.');
       return auth.db.runTransaction(function(tx){
         var ref=auth.db.collection('vmm_public_drafts').doc('landing');
         return tx.get(ref).then(function(remote){
           var rev=remote.exists?Number(remote.data().revision)||0:0;
           if(rev!==Number(payload.baseRevision||0)){
             throw new Error('КОНФЛИКТ: облачный черновик изменился с другого устройства. Локальная версия сохранена, требуется сравнить.');
           }
           tx.set(ref,{schemaVersion:1,status:'draft',revision:rev+1,
             content:clean,updatedBy:account,
             updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
           return rev+1;
         });
       });
     }).then(function(revision){
       return offlineStore.acknowledge(account,pendingName(),nonce).then(function(ack){
         if(uid===account){
           if(offlineNonce===nonce){
             draftRev=revision;baseline=JSON.stringify(clean);
             // If the saved outbox was corrected from songs to three link slots,
             // reflect the successful server snapshot in the visible editor.
             // A newer local edit must remain untouched.
             if(JSON.stringify(data)===JSON.stringify(payload.content))data=clone(clean);
             if(ack)showOfflineConflict(false);
             offlineStatus(ack?'Синхронизировано с облачным черновиком (версия '+revision+'). Для посетителей ещё не опубликовано.':
               'Облачный черновик сохранён; более свежие правки остались в очереди.');
             updateButtons();
           }
         }
         return ack;
       });
     });
   }).catch(function(err){
     var message=err&&err.message||String(err);
     if(message.indexOf('КОНФЛИКТ:')>=0)showOfflineConflict(true);
     offlineStatus('Синхронизация приостановлена: '+message+'. Изменения остались на устройстве.');
   }).then(function(){offlineSyncing=false;});
 }
 // Explicit owner action only. A three-way merge compares the original base
 // snapshot, the offline edit, and the latest server draft inside ONE
 // revision-checked transaction. If any path overlaps, nothing is written.
 function reconcileOffline(){
   if(!offlineConflict||!offlineStore||!uid||!loaded||busy||offlineSyncing||
      navigator.onLine===false)return Promise.resolve(false);
   if(!window.VMM_LANDING_MERGE){
     info('Модуль безопасного сравнения ещё не загружен. Сохрани локальную резервную копию.');
     return Promise.resolve(false);
   }
   if(!window.confirm('Сначала скачай резервную копию несинхронизированных изменений. Безопасно объединить локальные изменения с последней облачной версией? Совпадающие правки будут проверены, а конфликтующие останутся на устройстве.'))return Promise.resolve(false);
   var account=uid;
   busy=true;updateButtons();
   root.className+=' is-reconciling';
   info('Проверяем локальную копию и сравниваем с облачным черновиком…');
   return offlineWorking.catch(function(){}).then(function(){
     return offlineStore.get(account,pendingName());
   }).then(function(saved){
     if(!saved||!saved.value||!saved.value.content||!saved.value.baseBaseline)
       throw new Error('Нет полноценной локальной копии с исходной версией. Ничего не записано. Скачай резервную копию.');
     var payload=saved.value,base;
     try{base=API.normalize(JSON.parse(payload.baseBaseline));}
     catch(e){throw new Error('Исходная версия черновика повреждена. Автоматическое объединение запрещено.');}
     var local=API.normalize(payload.content),nonce=saved.nonce;
     return authorized().then(function(auth){
       if(auth.user.uid!==account)throw new Error('Аккаунт изменился; объединение отменено.');
       return auth.db.runTransaction(function(tx){
         var ref=auth.db.collection('vmm_public_drafts').doc('landing');
         return tx.get(ref).then(function(snapshot){
           var remote=snapshot.exists?API.normalize(snapshot.data().content):API.defaults();
           var rev=snapshot.exists?Number(snapshot.data().revision)||0:0;
           var merged=window.VMM_LANDING_MERGE.threeWay(base,local,remote);
           if(merged.conflicts.length)
             throw new Error('Не удалось автоматически объединить: обе версии меняли '+merged.conflicts.slice(0,4).join(', ')+'. Ничего не перезаписано. Сохрани обе копии для сравнения.');
           var clean=API.normalize(merged.value),same=JSON.stringify(clean)===JSON.stringify(remote);
           if(!same){
             tx.set(ref,{schemaVersion:1,status:'draft',revision:rev+1,
               content:clean,updatedBy:account,
               updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
           }
           return {revision:rev+(same?0:1),content:clean,changes:merged.changes};
         });
       });
     }).then(function(merged){
       return offlineStore.acknowledge(account,pendingName(),nonce).then(function(ack){
         if(uid!==account)return false;
         if(!ack||offlineNonce&&offlineNonce!==nonce){
           // Another edit arrived while the transaction ran. Its outbox is
           // intentionally retained; never overwrite a newer local edit.
           throw new Error('Облачная версия объединена, но обнаружены более новые изменения на телефоне. Они не удалены. Скачай резервную копию и повтори согласование.');
         }
         draftRev=merged.revision;data=merged.content;
         baseline=JSON.stringify(data);offlineNonce='';offlineSavedSignature=baseline;
         showOfflineConflict(false);render();
         offlineStatus('Локальные и облачные изменения безопасно объединены (черновик '+merged.revision+'). Публикация по-прежнему отдельная.');
         info('Черновик объединён с облаком. Проверь тему и песни, затем при необходимости опубликуй.');
         return true;
       });
     });
   }).catch(function(err){
     showOfflineConflict(true);
     info('Объединение остановлено: '+(err&&err.message||err));
     offlineStatus('Несинхронизированные изменения остаются на устройстве. Облачный черновик не перезаписан. Скачай резервную копию.');
     return false;
   }).then(function(ok){
     root.className=root.className.replace(/ is-reconciling/g,'');
     busy=false;updateButtons();return ok;
   });
 }
 var openedArtistDetails={};
 var tabs={hero:'Оформление главной',distribution:'Распределение песен',artists:'Артисты',releases:'Музыка и релизы',albums:'Альбомы',playlists:'Плейлисты и подписки',radio:'VELAR RADIO',universe:'Созвездия',languages:'Языки песен',topics:'Темы песен',assistant:'Помощник VELAR',genres:'Жанры',analytics:'Статистика посещений',about:'О проекте',publish:'Публикация'};
 function id(k){return document.getElementById(k);}
 function clear(el){while(el.firstChild)el.removeChild(el.firstChild);}
 function text(el,t){if(el)el.textContent=String(t==null?'':t);}
 function show(el,on){if(el)el.className=el.className.replace(/\s*hidden\b/g,'')+(on?'':' hidden');}
 function clone(x){return JSON.parse(JSON.stringify(x));}
 function draftDirty(){
   if(!loaded)return false;
   try{return JSON.stringify(API.normalize(data))!==baseline;}
   catch(err){return JSON.stringify(data)!==baseline;}
 }
 function trackDirty(){
   if(!trackEditorArtist||!trackLinksLoaded||!catalogLoaded)return false;
   return catalogArtists.some(function(t){
     if(!t.id)return false;
     var before=window.VMM_ARTIST_TRACKS.effective(t,trackLinks.overrides)===trackEditorArtist;
     return before!==!!trackChecked[t.id];
   });
 }
 function dirty(){return draftDirty()||trackDirty();}
 function info(s){text(id('landing-status'),s);}
 function updateButtons(){
   scheduleLocal();
   id('landing-save').disabled=!loaded||busy||!draftDirty();
   id('landing-publish').disabled=!loaded||busy||!draftRev||dirty()||trackSaving||pendingArtistLinks;
   id('landing-reload').disabled=busy||trackSaving||offlineConflict;
   id('landing-restore').disabled=!published||busy||trackSaving||offlineConflict;
   var localMatch=loaded&&offlineSavedSignature===JSON.stringify(data);
   text(id('landing-dirty'),busy?'Идёт операция…':trackSaving?'Сохраняем связи песен…':
     !loaded?'Данные ещё не загружены':
     pendingArtistLinks?'Назначения артистов ожидают облачной синхронизации':
     dirty()?(localMatch?'Сохранено на устройстве · ожидает синхронизации':'Есть изменения, локальная запись ожидается'):
     'Изменения сохранены');
 }
 function safeStatus(err){
   return err&&err.code==='permission-denied'?
     'Доступ отклонён правилами Firestore. Для нового публичного раздела нужно установить правила из репозитория, не меняя приватных прав.':
     (err&&err.message||'Неизвестная ошибка');
 }
 function authorized(){
   if(!window.firebase||!firebase.apps||!firebase.apps.length)
     return Promise.reject(new Error('Firebase ещё не загружен.'));
   var u=firebase.auth().currentUser;
   if(!u||!u.emailVerified||!u.providerData||!u.providerData.some(function(p){return p.providerId==='google.com';}))
     return Promise.reject(new Error('Требуется подтверждённый вход администратора через Google.'));
   var database=firebase.firestore();
   var admin=database.collection('vmm_admins').doc(u.uid);
   var check=admin.get({source:'server'});
   if(navigator.onLine===false)check=check.catch(function(){return admin.get({source:'cache'});});
   return check.then(function(s){
     if(!s.exists||!s.data()||s.data().enabled!==true)throw new Error('Нет прав администратора.');
     return {user:u,db:database};
   });
 }
 function field(parent,label,value,onInput,multiline){
   var wrap=document.createElement('label');wrap.className='landing-field';
   var name=document.createElement('span');name.textContent=label;wrap.appendChild(name);
   var input=document.createElement(multiline?'textarea':'input');
   if(!multiline)input.type='text';
   else input.rows=3;
   input.value=value||'';input.autocomplete='off';
   // RUN-107: on iOS the fixed mobile navigation must not cover Safari's
   // native caret and paste controls while the admin is editing a long form.
   input.addEventListener('focus',function(){
     if(document.body&&document.body.classList)
       document.body.classList.add('vmm-landing-text-focus');
   });
   input.addEventListener('blur',function(){
     if(document.body&&document.body.classList)
       document.body.classList.remove('vmm-landing-text-focus');
   });
   input.addEventListener('input',function(){onInput(this.value);updateButtons();});
   wrap.appendChild(input);parent.appendChild(wrap);return input;
 }
 function button(textLabel,action,style){
   var b=document.createElement('button');b.type='button';b.textContent=textLabel;
   b.className=style||'landing-small';b.onclick=action;return b;
 }
 function heading(p,title,detail){
   var h=document.createElement('h3');h.textContent=title;p.appendChild(h);
   if(detail){var m=document.createElement('p');m.className='sync-note';m.textContent=detail;p.appendChild(m);}
 }
 function sectionFields(parent,key){
   field(parent,'Заголовок раздела',data[key].heading,function(v){data[key].heading=v;});
   field(parent,'Вступление / описание',data[key].intro,function(v){data[key].intro=v;},true);
 }
 function artistOptions(){
   return window.VMM_ARTIST_CHOICES?window.VMM_ARTIST_CHOICES.choices(catalogArtists):[];
 }
 function loadCatalogArtists(force){
   if(!db||!uid||!loaded||catalogLoading)return Promise.resolve();
   if(catalogLoaded&&!force)return Promise.resolve();
   var generation=loadGeneration,account=uid;
   catalogLoading=true;catalogError='';
   // Show a real loading state immediately, rather than the stale 'not loaded' label.
   if(tab==='distribution'||tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics'||tab==='genres')render();
   if(navigator.onLine===false&&offlineStore){
     return offlineStore.get(uid,'cache:artist-catalog').then(function(saved){
       if(!saved||!saved.value||!Array.isArray(saved.value.catalog))
         throw new Error('Нет локального каталога. Открой его один раз при наличии сети.');
       catalogArtists=saved.value.catalog;
       trackLinks=saved.value.trackLinks||{revision:0,overrides:{}};
       catalogLoaded=true;trackLinksLoaded=true;catalogLoading=false;
       return restoreArtistLinks().then(function(){render();});
     }).catch(function(err){
       catalogLoading=false;catalogError=err.message;render();
     });
   }
   return Promise.all([
     db.collection('vmm_catalog').limit(1200).get({source:'server'}),
     window.VMM_ARTIST_TRACKS.read(db)
   ]).then(function(result){
     if(generation!==loadGeneration||account!==uid)return;
     var rows=[];
     result[0].forEach(function(doc){var song=doc.data()||{};song.id=doc.id;rows.push(song);});
     if(rows.length>=1200)throw new Error('Каталог достиг лимита 1200 записей. Для безопасного назначения требуется загрузить полный каталог.');
     catalogArtists=rows;trackLinks=result[1];trackLinksLoaded=true;
     catalogLoaded=true;catalogLoading=false;
     if(offlineStore)offlineStore.put(uid,'cache:artist-catalog',{
       catalog:rows,trackLinks:result[1]}).catch(function(err){
         offlineStatus('Не удалось сохранить каталог для офлайн: '+err.message);
       });
     restoreArtistLinks().then(function(){if(pendingArtistLinks)syncArtistLinks();});
     if(tab==='distribution'||tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics'||tab==='genres')render();
   }).catch(function(err){
     if(generation!==loadGeneration||account!==uid)return;
     catalogLoading=false;catalogError=err&&err.message||'Каталог или связи песен временно недоступны.';
     if(tab==='distribution'||tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics'||tab==='genres')render();
   });
 }
 function artistPicker(parent){
   var module=window.VMM_ARTIST_CHOICES;
   if(!module){heading(parent,'Выбор артиста','Не загрузился справочник имён. Обнови страницу.');return;}
   var wrapper=document.createElement('section');wrapper.className='landing-artist-picker';
   heading(wrapper,'Добавить артиста из каталога',
     'Выбирай готовое имя — карточка заполнится автоматически. Исходные имена и песни в базе не изменяются.');
   var chooser=document.createElement('select');chooser.className='landing-artist-select';
   chooser.setAttribute('aria-label','Выбери артиста из каталога');
   var placeholder=document.createElement('option');placeholder.value='';
   placeholder.textContent='Выбери артиста…';chooser.appendChild(placeholder);
   var choices=artistOptions();
   choices.forEach(function(item){
     var option=document.createElement('option');option.value=item.id;
     option.textContent=item.label+' · '+item.count+' '+(item.count===1?'песня':'песен')+
       (item.preset&&item.count===0?' (ещё не привязан)':'');
     chooser.appendChild(option);
   });
   var controls=document.createElement('div');controls.className='landing-artist-picker-actions';
   controls.appendChild(chooser);
   controls.appendChild(button('+ Добавить артиста',function(){
     var selected=module.byId(choices,chooser.value);
     if(!selected){info('Сначала выбери артиста в списке.');return;}
     if(data.artists.cards.length>=12){info('На главной можно разместить не более 12 артистов.');return;}
     if(data.artists.cards.some(function(x){return x.artistId===selected.id;})){
       info('Этот артист уже добавлен в черновик. Открой его карточку ниже, чтобы изменить имя или описание.');
       return;
     }
     data.artists.cards.push(module.newCard(selected));
     render();
     info(selected.count?
       'Добавлен '+selected.label+' ('+selected.count+' песен по исходной подписи). Карточка пока скрыта от посетителей.':
       'Добавлен '+selected.label+'. Точная привязка песен в каталоге пока отсутствует. Карточка пока скрыта от посетителей.');
   },'landing-add'));
   wrapper.appendChild(controls);
   var note=document.createElement('p');note.className='sync-note';
   note.textContent=catalogLoading?'Загружаем имена исполнителей из закрытого каталога…':
     catalogError?'Каталог недоступен: '+catalogError+'. Три согласованных имени доступны для выбора.':
     catalogLoaded?'Список получен из '+catalogArtists.length+' записей приватного каталога. Только указанные в нём имена добавлены к трём согласованным профилям.':
       'В списке пока три согласованных имени. Для просмотра остальных загрузим действующий каталог.';
   wrapper.appendChild(note);
   if(!catalogLoading){
     wrapper.appendChild(button('Обновить список из каталога',function(){
       catalogLoaded=false;loadCatalogArtists(true);
     }));
   }
   parent.appendChild(wrapper);
 }
 function closeTrackEditor(){
   if(trackDirty()&&!window.confirm('Есть несохранённые галочки песен. Отменить их?'))return false;
   trackEditorArtist='';trackChecked={};trackSearch='';render();return true;
 }
 function openTrackEditor(artistId){
   if(!catalogLoaded||!trackLinksLoaded){info('Сначала загрузим полный каталог и его связи.');return;}
   if(trackSaving||busy)return;
   if(trackEditorArtist===artistId){closeTrackEditor();return;}
   if(trackDirty()&&!window.confirm('Есть несохранённые галочки другого артиста. Отменить их?'))return;
   trackEditorArtist=artistId;trackSearch='';trackChecked={};
   catalogArtists.forEach(function(t){
     trackChecked[t.id]=window.VMM_ARTIST_TRACKS.effective(t,trackLinks.overrides)===artistId;
   });
   render();
 }
 function saveTrackLinks(artistId){
   if(artistId!==trackEditorArtist||!catalogLoaded||!trackLinksLoaded||busy||trackSaving)return;
   var tracks=catalogArtists.slice(),selected=tracks.filter(function(t){return !!trackChecked[t.id];}).map(function(t){return t.id;});
   if(!navigator.onLine){saveLinksOffline(artistId,selected,tracks);return;}
   if(pendingArtistLinks){info('Сначала синхронизируй предыдущие назначения артистов.');syncArtistLinks();return;}
   var current=trackLinks,changes=window.VMM_ARTIST_TRACKS.conflicts(current.overrides,artistId,selected,tracks);
   if(changes.length){
     var example=changes.slice(0,3).map(function(t){return t.title;}).join('; ');
     if(!window.confirm('Переназначить '+changes.length+' песен от другого артиста? Примеры: '+example+
        '. Исходные сведения релизов и фонограммы не меняются.'))return;
   }
   var account=uid,generation=loadGeneration;
   trackSaving=true;updateButtons();info('Сохраняем привязки '+selected.length+' песен…');
   authorized().then(function(a){
     if(a.user.uid!==account||generation!==loadGeneration)throw new Error('Учётная запись изменилась.');
     return window.VMM_ARTIST_TRACKS.save(db,account,artistId,selected,tracks,current.revision);
   }).then(function(next){
     if(generation!==loadGeneration||uid!==account)return;
     trackLinks=next;trackSaving=false;render();
     info('Готово! '+selected.length+' песен привязаны к артисту на сайте. Исходные исполнители и данные дистрибьютора не изменены. Публичный список релизов по-прежнему публикуется отдельно.');
   }).catch(function(e){
     if(generation!==loadGeneration||uid!==account)return;
     trackSaving=false;updateButtons();info('Не удалось сохранить привязки: '+safeStatus(e));
   });
 }
 function trackEditor(parent,item){
   if(!item.artistId||item.artistId!==trackEditorArtist)return;
   var box=document.createElement('div');box.className='landing-track-editor';
   heading(box,'Песни артиста: '+(item.title||item.artistId),
     'Отметь нужные композиции. Они связываются с артистом только внутри сайта: исходные записи каталога, Drive и имена у дистрибьютора не меняются. Сохранение не публикует закрытые треки.');
   var search=document.createElement('input');search.type='search';search.className='landing-track-search';
   search.placeholder='Найти песню или исходного исполнителя…';
   search.value=trackSearch;search.setAttribute('aria-label','Поиск песен для назначения');
   box.appendChild(search);
   var toolbar=document.createElement('div');toolbar.className='landing-track-toolbar';
   var selectFound=button('Отметить найденные',function(){
     filtered().forEach(function(t){trackChecked[t.id]=true;});
     drawRows();updateButtons();
   });
   var unselectFound=button('Снять отметки с найденных',function(){
     filtered().forEach(function(t){trackChecked[t.id]=false;});
     drawRows();updateButtons();
   });
   toolbar.appendChild(selectFound);toolbar.appendChild(unselectFound);box.appendChild(toolbar);
   var stat=document.createElement('p');stat.className='sync-note';stat.setAttribute('role','status');box.appendChild(stat);
   var rows=document.createElement('div');rows.className='landing-track-list';box.appendChild(rows);
   var actions=document.createElement('div');actions.className='landing-track-toolbar';
   var saveBtn=button('Сохранить привязки песен',function(){saveTrackLinks(item.artistId);},'landing-add');
   var cancelBtn=button('Закрыть список',function(){closeTrackEditor();});
   actions.appendChild(saveBtn);actions.appendChild(cancelBtn);box.appendChild(actions);
   function filtered(){
     var q=String(trackSearch||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
     return catalogArtists.filter(function(t){
       if(!q)return true;
       return (String(t.title||'')+' '+String(t.artist||'')).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0;
     }).sort(compareSong);
   }
   function drawRows(){
     clear(rows);
     var matching=filtered();
     var assigned=catalogArtists.filter(function(t){return !!trackChecked[t.id];}).length;
     var changed=trackDirty();
     stat.textContent='Назначено артисту: '+assigned+' из '+catalogArtists.length+
       '. Найдено: '+matching.length+(changed?' · Есть несохранённые галочки':'');
     saveBtn.disabled=!changed||trackSaving||busy;
     // Avoid thousands of checkboxes at once on iOS 12; bulk actions still
     // operate on all filtered tracks, not only the first visible 80.
     matching.slice(0,80).forEach(function(t){
       var label=document.createElement('label');label.className='landing-track-row';
       var check=document.createElement('input');check.type='checkbox';check.checked=!!trackChecked[t.id];
       check.onchange=function(){
         trackChecked[t.id]=!!this.checked;drawRows();updateButtons();
       };
       label.appendChild(check);
       var name=document.createElement('span');
       name.textContent=String(t.title||'Без названия')+' — '+String(t.artist||'Исполнитель не указан');
       var assignedOther=window.VMM_ARTIST_TRACKS.effective(t,trackLinks.overrides);
       if(assignedOther&&assignedOther!==item.artistId)name.textContent+=' · сейчас: '+assignedOther;
       label.appendChild(name);rows.appendChild(label);
     });
     if(matching.length>80){
       var note=document.createElement('p');note.className='sync-note';
       note.textContent='Показаны первые 80 из '+matching.length+' песен. Уточни поиск. Кнопки отметят все найденные.';
       rows.appendChild(note);
     }
     if(!matching.length){
       var empty=document.createElement('p');empty.className='sync-note';empty.textContent='Совпадений нет.';
       rows.appendChild(empty);
     }
   }
   search.oninput=function(){trackSearch=this.value;drawRows();};
   drawRows();parent.appendChild(box);
 }
 function artistPhotoControls(card,item){
   var panel=document.createElement('div');panel.className='landing-photo-section';
   var title=document.createElement('p');title.className='landing-photo-label';
   title.textContent='Фотография артиста · загрузка с устройства';panel.appendChild(title);
   var preview=document.createElement('div');preview.className='landing-photo-preview';
   if(item.imageData||item.imageUrl){
     var image=document.createElement('img');image.src=item.imageData||item.imageUrl;
     image.alt='Предпросмотр фотографии '+(item.title||'артиста');
     image.className='landing-photo-image'+(item.imageShape==='circle'?' is-circle':'');
     preview.appendChild(image);
   }else{
     var empty=document.createElement('p');empty.className='sync-note';
     empty.textContent='Пока без фотографии';preview.appendChild(empty);
   }
   panel.appendChild(preview);
   var input=document.createElement('input');input.type='file';
   input.accept='image/jpeg,image/png,image/webp,image/heic,image/heif';
   input.className='landing-photo-input';
   input.setAttribute('aria-label','Выбрать изображение артиста');
   input.onchange=function(){
     var file=this.files&&this.files[0];this.value='';
     if(!file)return;
     if(!window.VMM_ARTIST_IMAGE){info('Редактор фотографий не загружен. Обнови страницу.');return;}
     window.VMM_ARTIST_IMAGE.open(file,function(imageData){
       var previousData=item.imageData,previousUrl=item.imageUrl;
       item.imageData=imageData;item.imageUrl='';
       try{API.normalize(data);}catch(err){item.imageData=previousData;item.imageUrl=previousUrl;info('Фото не добавлено: '+err.message);return;}
       render();info('Фотография обрезана и сжата до '+Math.round(imageData.length*0.75/1024)+' КБ. Сохрани черновик, затем опубликуй.');
     },function(message){info(message);});
   };
   panel.appendChild(input);
   var actions=document.createElement('div');actions.className='landing-photo-buttons';
   actions.appendChild(button(item.imageData||item.imageUrl?'Заменить фотографию':'Загрузить фотографию',function(){
     input.click();
   },'landing-add'));
   if(item.imageData||item.imageUrl){
     actions.appendChild(button('Убрать фото',function(){
       if(!window.confirm('Убрать фотографию из черновика? Публичная страница изменится только после публикации.'))return;
       item.imageData='';item.imageUrl='';render();
     },'landing-small'));
   }
   panel.appendChild(actions);
   var shape=document.createElement('label');shape.className='landing-photo-shape';
   var name=document.createElement('span');name.textContent='Форма фотографии на сайте';shape.appendChild(name);
   var select=document.createElement('select');select.setAttribute('aria-label','Форма фотографии');
   [['square','Квадрат'],['circle','Круг']].forEach(function(pair){
     var option=document.createElement('option');option.value=pair[0];option.textContent=pair[1];select.appendChild(option);
   });
   select.value=item.imageShape==='circle'?'circle':'square';
   select.onchange=function(){item.imageShape=this.value;render();};
   shape.appendChild(select);panel.appendChild(shape);
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Кадрирование и сжатие выполняются прямо на устройстве. Исходный тяжёлый файл не отправляется. Суммарный размер изображений ограничен.';
   panel.appendChild(note);card.appendChild(panel);
 }
 function artistMusicControls(card,item){
   var wrap=document.createElement('section');wrap.className='landing-featured';
   heading(wrap,'Лучшие песни на главной',
     'Выбери до 30 композиций для карусели. Отметь Spotify, YouTube и Apple Music — одну, две или все три площадки. Ссылки берутся только из проверенного музыкального каталога.');
   if(!item.artistId){
     var missing=document.createElement('p');missing.className='sync-note';
     missing.textContent='Для выбора песен нужен артист из справочника.';wrap.appendChild(missing);
     card.appendChild(wrap);return;
   }
   if(!catalogLoaded||!trackLinksLoaded){
     var wait=document.createElement('p');wait.className='sync-note';
     wait.textContent=catalogError?'Не удалось прочитать каталог: '+catalogError:
       'Загружаем защищённый каталог. Выбор песен будет доступен после загрузки.';
     wrap.appendChild(wait);card.appendChild(wrap);return;
   }
   var songUrl=API.songUrl,manualOrder=item.featuredSort==='manual';
   var selected=(item.featuredTracks||[]).slice();
   if(!manualOrder)selected.sort(compareSong);
   selectField(wrap,'Порядок лучших песен',
     [['alphabetical','По алфавиту А–Я (по умолчанию)'],['manual','Вручную (стрелками)']],
     item.featuredSort||'alphabetical',function(v){
       if(v==='manual'&&item.featuredSort!=='manual')
         item.featuredTracks=(item.featuredTracks||[]).slice().sort(compareSong);
       item.featuredSort=v;render();
     });
   var options=[];
   catalogArtists.forEach(function(t){
     if(window.VMM_ARTIST_TRACKS.effective(t,trackLinks.overrides)!==item.artistId)return;
     var links=t.links||{},spotify=songUrl(links.spotify||'','spotify'),
       youtube=songUrl(links.youtube||'','youtube'),appleMusic=songUrl(links.appleMusic||links.apple||'','appleMusic');
     if(spotify||youtube||appleMusic)options.push({title:String(t.title||'Без названия'),
       id:t.id,spotify:spotify,youtube:youtube,appleMusic:appleMusic});
   });
   if(!options.length){
     var empty=document.createElement('p');empty.className='sync-note';
     empty.textContent='У артиста пока нет привязанных песен с прямой ссылкой Spotify, YouTube или Apple Music. Сначала проверь ссылки в «Каталог релизов» и, если нужно, назначь песни артисту.';
     wrap.appendChild(empty);card.appendChild(wrap);return;
   }
   var search=document.createElement('input');search.type='search';
   search.className='landing-featured-search';search.placeholder='Поиск песни в каталоге…';
   search.setAttribute('aria-label','Найти лучшие песни артиста');
   wrap.appendChild(search);
   var counter=document.createElement('p');counter.className='sync-note';wrap.appendChild(counter);
   var selectedHost=document.createElement('div');selectedHost.className='landing-featured-selection';
   wrap.appendChild(selectedHost);
   var rows=document.createElement('div');rows.className='landing-featured-list';wrap.appendChild(rows);
   var allSongsNote=document.createElement('p');allSongsNote.className='sync-note';
   allSongsNote.textContent='Все доступные песни этого артиста: '+options.length+'. Прокручивай список или используй поиск; ограничение 36 снято.';
   wrap.appendChild(allSongsNote);
   function chosen(t){
     for(var k=0;k<selected.length;k++)
       if(t.spotify&&[selected[k].url,selected[k].alternateUrl,selected[k].thirdUrl].indexOf(t.spotify)>=0||
         t.youtube&&[selected[k].url,selected[k].alternateUrl,selected[k].thirdUrl].indexOf(t.youtube)>=0||
         t.appleMusic&&[selected[k].url,selected[k].alternateUrl,selected[k].thirdUrl].indexOf(t.appleMusic)>=0)return k;
     return -1;
   }
   function markChanged(){
     if(!manualOrder)selected.sort(compareSong);
     item.featuredTracks=selected.slice();updateButtons();
   }
   function draw(){
     clear(rows);clear(selectedHost);
     counter.textContent='Выбрано '+selected.length+'/30 · доступны '+options.length+
       ' композиций. '+(manualOrder?'Ручной порядок стрелками.':'Список по алфавиту А–Я.');
     selected.forEach(function(song,index){
       var line=document.createElement('div');line.className='landing-featured-chosen';
       var name=document.createElement('span');
       var platformLabel=function(p){return p==='spotify'?'Spotify':p==='appleMusic'?'Apple Music':'YouTube';};
       name.textContent=(index+1)+'. '+song.title+' — '+[song.provider,song.alternateProvider,song.thirdProvider].filter(Boolean).map(platformLabel).join(' + ');
       line.appendChild(name);
       if(manualOrder){
         var up=button('↑',function(){
           if(index<1)return;var old=selected[index-1];selected[index-1]=selected[index];selected[index]=old;markChanged();draw();
         },'landing-small');
         var down=button('↓',function(){
           if(index===selected.length-1)return;
           var old=selected[index+1];selected[index+1]=selected[index];selected[index]=old;markChanged();draw();
         },'landing-small');
         up.disabled=index===0;down.disabled=index===selected.length-1;
         up.setAttribute('aria-label','Поднять песню '+song.title);
         down.setAttribute('aria-label','Опустить песню '+song.title);
         line.appendChild(up);line.appendChild(down);
       }
       var remove=button('×',function(){selected.splice(index,1);markChanged();draw();},'landing-small');
       remove.setAttribute('aria-label','Убрать песню '+song.title+' из подборки');
       line.appendChild(remove);
       selectedHost.appendChild(line);
     });
     var q=String(search.value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
     var found=options.filter(function(t){return !q||(t.title.toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0);});
     found.sort(compareSong);
     var visible=found;
     visible.forEach(function(t){
       var at=chosen(t),yes=at>=0;
       var row=document.createElement('div');row.className='landing-featured-row';
       var tick=document.createElement('input');tick.type='checkbox';tick.checked=yes;
       tick.setAttribute('aria-label','Выбрать '+t.title);
       var label=document.createElement('span');label.textContent=t.title;row.appendChild(tick);row.appendChild(label);
       var sources=document.createElement('div');sources.className='landing-song-sources landing-featured-sources';
       function checked(provider){
         if(!yes)return false;
         return selected[at].provider===provider||
           !!selected[at].alternateUrl&&selected[at].alternateProvider===provider||
           !!selected[at].thirdUrl&&selected[at].thirdProvider===provider;
       }
       var spotify=attachedSourceCheckbox(sources,'spotify',checked('spotify'),!t.spotify);
       var youtube=attachedSourceCheckbox(sources,'youtube',checked('youtube'),!t.youtube);
       var apple=attachedSourceCheckbox(sources,'appleMusic',checked('appleMusic'),!t.appleMusic);
       row.appendChild(sources);
       function changeSelection(sOn,yOn,aOn){
         sOn=!!(sOn&&t.spotify);yOn=!!(yOn&&t.youtube);aOn=!!(aOn&&t.appleMusic);
         var foundAt=chosen(t),old=foundAt>=0?selected[foundAt]:null;
         if(!sOn&&!yOn&&!aOn){
           if(foundAt>=0){selected.splice(foundAt,1);markChanged();}
           draw();return;
         }
         if(foundAt<0&&selected.length>=30){
           info('Выбери не более 30 лучших песен для артиста.');draw();return;
         }
         var enabled=['spotify','youtube','appleMusic'].filter(function(k){return k==='spotify'?sOn:k==='youtube'?yOn:aOn;});
         var primary=old&&enabled.indexOf(old.provider)>=0?old.provider:enabled[0];
         var rest=enabled.filter(function(k){return k!==primary;});
         var raw={title:old?old.title:t.title,provider:primary,url:t[primary]};
         if(rest[0]){raw.alternateProvider=rest[0];raw.alternateUrl=t[rest[0]];}
         if(rest[1]){raw.thirdProvider=rest[1];raw.thirdUrl=t[rest[1]];}
         var clean=API.featuredTrack(raw,foundAt<0?selected.length+1:foundAt+1);
         if(foundAt<0)selected.push(clean);else selected[foundAt]=clean;
         markChanged();draw();
       }
       tick.onchange=function(){
         if(!this.checked){changeSelection(false,false);return;}
         if(yes){draw();return;}
         changeSelection(!!t.spotify,!t.spotify&&!!t.youtube,!t.spotify&&!t.youtube&&!!t.appleMusic);
       };
       spotify.onchange=function(){changeSelection(spotify.checked,youtube.checked,apple.checked);};
       youtube.onchange=function(){changeSelection(spotify.checked,youtube.checked,apple.checked);};
       apple.onchange=function(){changeSelection(spotify.checked,youtube.checked,apple.checked);};
       rows.appendChild(row);
     });
     if(!found.length){
       var noResult=document.createElement('p');noResult.className='sync-note';
       noResult.textContent='Нет песен с подтверждёнными прямыми ссылками по этому запросу.';
       rows.appendChild(noResult);
     }
   }
   search.oninput=draw;
   draw();
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Посетитель сам выбирает Spotify, YouTube или Apple Music в одной карточке. Никакого автозапуска. Сохрани черновик и отдельно опубликуй изменения.';
   wrap.appendChild(note);card.appendChild(wrap);
 }

 function selectField(parent,label,options,chosen,onChange){
   var wrap=document.createElement('label');wrap.className='landing-field';
   var cap=document.createElement('span');cap.textContent=label;wrap.appendChild(cap);
   var select=document.createElement('select');select.className='landing-release-select';
   options.forEach(function(row){
     var o=document.createElement('option');o.value=row[0];o.textContent=row[1];select.appendChild(o);
   });
   select.value=chosen;select.onchange=function(){onChange(this.value);updateButtons();};
   wrap.appendChild(select);parent.appendChild(wrap);return select;
 }
 function releaseCover(parent,item){
   var section=document.createElement('div');section.className='landing-release-cover';
   heading(section,'Обложка релиза','Кадрирование и сжатие до 90 КБ выполняются на устройстве.');
   if(item.imageData||item.imageUrl){
     var img=document.createElement('img');img.className='landing-release-cover-preview';
     img.src=item.imageData||item.imageUrl;img.alt='Обложка: '+(item.title||'релиз');section.appendChild(img);
   }
   var file=document.createElement('input');file.type='file';file.className='landing-release-cover-input';
   file.accept='image/jpeg,image/png,image/webp,image/heic,image/heif';
   file.setAttribute('aria-label','Выбрать обложку релиза');section.appendChild(file);
   file.onchange=function(){
     var f=this.files&&this.files[0];this.value='';
     if(!f)return;
     if(!window.VMM_ARTIST_IMAGE){info('Редактор картинок пока недоступен. Обнови страницу.');return;}
     window.VMM_ARTIST_IMAGE.open(f,function(img){
       var old=item.imageData,oldURL=item.imageUrl;
       item.imageData=img;item.imageUrl='';
       try{API.normalize(data);}
       catch(err){item.imageData=old;item.imageUrl=oldURL;info('Ошибка обложки: '+err.message);return;}
       render();info('Обложка сжата. Сохрани черновик, затем опубликуй.');
     },function(error){info(error);});
   };
   section.appendChild(button('Загрузить обложку',function(){file.click();},'landing-add'));
   if(item.imageData||item.imageUrl){
     section.appendChild(button('Убрать обложку',function(){
       if(!window.confirm('Убрать обложку из черновика?'))return;
       item.imageData='';item.imageUrl='';render();
     }));
   }
   parent.appendChild(section);
 }
 function releaseExtras(parent,item){
   selectField(parent,'Тип релиза',[['single','Сингл'],['album','Альбом'],['video','Видеоклип']],
     item.kind||'single',function(v){item.kind=v;});
   selectField(parent,'Главная витрина',[['none','В общем каталоге'],['music','Крупный музыкальный релиз'],
     ['video','Крупная видеопремьера']],item.spotlight||'none',function(v){item.spotlight=v;});
   selectField(parent,'Официальный плеер',[['','Без встроенного плеера'],['spotify','Spotify'],
     ['youtube','YouTube']],item.mediaProvider||'',function(v){item.mediaProvider=v;item.mediaUrl='';render();});
   field(parent,'Прямая ссылка на трек/альбом Spotify или видео YouTube',item.mediaUrl||'',function(v){item.mediaUrl=v;});
   releaseCover(parent,item);
 }
 function releaseCatalogPicker(parent){
   var wrap=document.createElement('section');wrap.className='landing-release-picker';
   heading(wrap,'Добавить из каталога','В черновик попадут только название, исполнитель и выбранная официальная ссылка. Не публикуем исходный защищённый каталог.');
   if(!catalogLoaded){
     var msg=document.createElement('p');msg.className='sync-note';
     msg.textContent=catalogLoading?'Читаем каталог…':catalogError?catalogError:'Подключи защищённый каталог.';
     wrap.appendChild(msg);
     wrap.appendChild(button('Загрузить каталог',function(){catalogLoaded=false;loadCatalogArtists(true);}));
     parent.appendChild(wrap);return;
   }
   var search=document.createElement('input');search.type='search';search.className='landing-release-search';
   search.placeholder='Название или артист';search.setAttribute('aria-label','Найти песню в каталоге');wrap.appendChild(search);
   var choices=document.createElement('select');choices.className='landing-release-select';
   choices.setAttribute('aria-label','Песня для добавления');wrap.appendChild(choices);
   var sources=document.createElement('select');sources.className='landing-release-select';
   sources.setAttribute('aria-label','Музыкальная площадка');wrap.appendChild(sources);
   var songs=[];
   catalogArtists.forEach(function(song){
     var urls=song.links||{},spotify=API.releaseMediaUrl(urls.spotify||'','spotify'),
       youtube=API.releaseMediaUrl(urls.youtube||'','youtube');
     if(spotify||youtube)songs.push({title:String(song.title||''),artist:String(song.artist||''),
       spotify:spotify,youtube:youtube});
   });
   // Alphabetize the entire protected catalog, not just the first search results.
   songs.sort(compareSong);
   function updateSources(){
     clear(sources);var row=songs[Number(choices.value)];
     if(!row)return;
     if(row.spotify){var sp=document.createElement('option');sp.value='spotify';sp.textContent='Spotify';sources.appendChild(sp);}
     if(row.youtube){var yt=document.createElement('option');yt.value='youtube';yt.textContent='YouTube';sources.appendChild(yt);}
   }
   function searchSongs(){
     clear(choices);
     var q=String(search.value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
     var count=0;
     songs.forEach(function(song,i){
       if(q&&(song.title+' '+song.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)<0)return;
       if(count++>=60)return;
       var option=document.createElement('option');option.value=String(i);
       option.textContent=song.title+' · '+song.artist;choices.appendChild(option);
     });
     if(choices.children.length)choices.value=choices.children[0].value;
     updateSources();
   }
   search.oninput=searchSongs;choices.onchange=updateSources;searchSongs();
   wrap.appendChild(button('+ Выбрать релиз',function(){
     var row=songs[Number(choices.value)],provider=sources.value||(sources.children[0]&&sources.children[0].value)||'';
     if(!row){info('Нет подходящей песни с прямой ссылкой.');return;}
     if(data.releases.cards.length>=12){info('На главной максимум 12 релизов.');return;}
     var url=provider==='spotify'?row.spotify:row.youtube;
     if(!url){info('У песни нет ссылки на эту площадку.');return;}
     if(data.releases.cards.some(function(x){return x.mediaUrl===url&&!!url;})){
       info('Этот релиз уже есть в списке.');return;
     }
     var item=API.blankCard();
     item.title=row.title;item.subtitle=row.artist;item.kind=provider==='youtube'?'video':'single';
     item.mediaProvider=provider;item.mediaUrl=url;item.url=url;item.spotlight='none';
     item.visible=false;
     data.releases.cards.push(item);render();
     info('Релиз добавлен в черновик (пока скрыт). Проверь тип, обложку и отметь «Показывать».');
   },'landing-add'));
   parent.appendChild(wrap);
 }
 function radioPlaylistImport(parent,radio,input){
   var source=field(parent,'Добавить в эфир песни из плейлиста YouTube','',function(){});
   var key=field(parent,'Ключ YouTube Data API v3 для импорта (только на время ввода)','',function(){});
   key.type='password';
   var button=document.createElement('button'),status=document.createElement('p');
   button.type='button';button.textContent='Добавить песни из плейлиста';status.setAttribute('role','status');
   parent.appendChild(button);parent.appendChild(status);
   button.onclick=function(){
     var url=API.playlistUrl(source.value,'youtube'),credential=key.value.trim();
     if(!url||!credential){status.textContent='Укажи ссылку на плейлист YouTube и ключ для импорта.';return;}
     var imported=[],seen={},pages={};
     button.disabled=true;status.textContent='Читаем плейлист…';
     function request(resource,params){
       return window.fetch('https://www.googleapis.com/youtube/v3/'+resource+'?'+params,{
         headers:{'X-Goog-Api-Key':credential},credentials:'omit'
       }).then(function(response){
         if(!response.ok)throw new Error('YouTube отклонил запрос ('+response.status+'). Проверь ключ, квоту и доступность плейлиста.');
         return response.json();
       });
     }
     function readPage(token){
       return request('playlistItems','part=contentDetails&maxResults=50&playlistId='+url.split('list=')[1]+
         (token?'&pageToken='+encodeURIComponent(token):'')).then(function(page){
         var ids=page.items.map(function(item){return item.contentDetails.videoId;});
         var details=ids.length?request('videos','part=snippet,contentDetails,status&id='+ids.join(',')):Promise.resolve({items:[]});
         return details.then(function(result){
           result.items.forEach(function(video){
             if(seen[video.id]||!video.status.embeddable)return;
             var d=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(video.contentDetails.duration);
             if(!d)return;
             var seconds=Number(d[1]||0)*3600+Number(d[2]||0)*60+Number(d[3]||0);
             if(!seconds||seconds>86400)return;
             seen[video.id]=true;
             imported.push({title:video.snippet.title,seconds:seconds,url:'https://www.youtube.com/watch?v='+video.id});
           });
           if(imported.length>300)throw new Error('В плейлисте больше 300 песен. Выбери меньший плейлист.');
           if(page.nextPageToken){
             if(pages[page.nextPageToken])throw new Error('YouTube вернул повторную страницу.');
             pages[page.nextPageToken]=true;return readPage(page.nextPageToken);
           }
         });
       });
     }
     readPage('').then(function(){
       if(!document.body.contains(button))return;
       var current=API.radioConfig(Object.assign({},radio,{enabled:false})).tracks;
       var urls={};current.forEach(function(t){urls[t.url]=true;});
       var extra=imported.filter(function(t){return !urls[t.url];});
       if(current.length+extra.length>300)throw new Error('После добавления будет больше 300 песен.');
       radio.tracks=current.concat(extra);
       input.value=radio.tracks.map(function(t){return [t.title,t.seconds,t.url].join(' | ');}).join('\n');
       status.textContent='Добавлено песен: '+extra.length+'. Сохрани черновик и опубликуй настройки.';
       updateButtons();
     }).catch(function(error){status.textContent=error.message;}).then(function(){button.disabled=false;key.value='';});
   };
 }
 function radioEditor(parent){
   var radio=data.releases.radio;
   if(!radio){
     radio={enabled:false,controlVersion:2,title:'VELAR RADIO',provider:'spotify',url:''};
     data.releases.radio=radio;
   }
   heading(parent,'Настройки VELAR RADIO',
     'Управляй плавающим радио на главной странице. Сейчас оно выключено по умолчанию. Для включения или смены плейлиста сохрани черновик и отдельно опубликуй.');
   var row=document.createElement('label');row.className='landing-checkbox';
   var check=document.createElement('input');check.type='checkbox';
   check.checked=radio.enabled===true;
   check.onchange=function(){radio.enabled=this.checked;radio.controlVersion=2;updateButtons();};
   row.appendChild(check);
   var label=document.createElement('span');
   label.textContent='Показывать VELAR RADIO посетителям';
   row.appendChild(label);parent.appendChild(row);
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Отключение скрывает плавающее радио. Раздел обычных плейлистов и подписок остаётся доступным. Автозапуска музыки нет.';
   parent.appendChild(note);
   field(parent,'Название радио',radio.title||'VELAR RADIO',function(v){radio.title=v;});
   heading(parent,'Анимация и свечение логотипа','Золотое сияние вокруг значка. Выбери режим, яркость и размер ореола. Сохрани черновик и отдельно опубликуй.');
   var visual=radio.visual||(radio.visual={mode:'heartbeat',intensity:3,spread:20});
   selectField(parent,'Режим анимации радио',[
     ['heartbeat','Сердцебиение — двойной удар и мягкое послесвечение'],
     ['shimmer','Мерцание — спокойная музыка'],
     ['broadcast','Важный эфир — яркие импульсы'],
     ['music','Светомузыка — ритмическое сияние при открытом плеере'],
     ['off','Без анимации — мягкий постоянный ореол']
   ],visual.mode||'heartbeat',function(v){visual.mode=v;});
   function radioVisualSlider(label,key,min,max,step,suffix){
     var wrap=document.createElement('label');wrap.className='landing-field';
     var caption=document.createElement('span');caption.textContent=label;wrap.appendChild(caption);
     var slider=document.createElement('input');slider.type='range';
     slider.min=String(min);slider.max=String(max);slider.step=String(step);
     slider.value=String(visual[key]);slider.setAttribute('aria-label',label);
     var value=document.createElement('strong');value.className='landing-loading-value';
     value.textContent=slider.value+suffix;
     slider.oninput=function(){visual[key]=Number(this.value);value.textContent=this.value+suffix;updateButtons();};
     wrap.appendChild(slider);wrap.appendChild(value);parent.appendChild(wrap);
   }
   radioVisualSlider('Яркость свечения','intensity',1,5,1,' / 5');
   radioVisualSlider('Размер светового ореола','spread',1,100,1,'% от диаметра значка');
   var visualHelp=document.createElement('p');visualHelp.className='sync-note';
   visualHelp.textContent='Светомузыка включается при открытом официальном плеере, в том числе свёрнутом. Это визуальная пульсация, а не точная синхронизация с аудиоволной YouTube, Spotify или Apple Music. Системное «Уменьшение движения» отключает анимацию.';
   parent.appendChild(visualHelp);
   heading(parent,'Эфир из каталога сайта','Отметь площадки. При публикации Studio собирает ссылки из каталога и видимых разделов сайта. Этот режим имеет приоритет перед плейлистом и расписанием.');
   var choices=radio.sources||(radio.sources=[]);
   ['youtube','spotify','appleMusic'].forEach(function(p){
     var box=attachedSourceCheckbox(parent,p,choices.indexOf(p)>=0,false);
     box.onchange=function(){
       radio.sources=radio.sources.filter(function(item){return item!==p;});
       if(box.checked)radio.sources.push(p);
       updateButtons();
     };
   });
   var scheduleInput=field(parent,'Эфир YouTube · название | секунды | ссылка (одна песня в строке)',
     (radio.tracks||[]).map(function(t){return [t.title,t.seconds,t.url].join(' | ');}).join('\n'),
     function(value){
       radio.tracks=value.split(/\r?\n/).filter(function(line){return line.trim();}).map(function(line){
         var parts=line.split('|'),url=parts.pop()||'',seconds=parts.pop()||'';
         return {title:parts.join('|').trim(),seconds:Number(seconds),url:url.trim()};
       });
     },true);
   radioPlaylistImport(parent,radio,scheduleInput);
   var info=document.createElement('p');info.className='sync-note';
   info.textContent='Заполненный список песен включает общий эфир. Чтобы вернуться к обычному плейлисту, очисти список.';
   parent.appendChild(info);
   var list=data.releases.playlists||[],options=[['manual','Указать плейлист вручную']];
   list.forEach(function(p,i){
     if(API.playlistUrl(p.url,p.provider)){
       options.push(['preset-'+i,(p.title||'Плейлист '+(i+1))+' · '+(p.provider==='youtube'?'YouTube':'Spotify')]);
     }
   });
   var matched='manual';
   list.forEach(function(p,i){
     if(p.url===radio.url&&p.provider===radio.provider&&API.playlistUrl(p.url,p.provider))
       matched='preset-'+i;
   });
   selectField(parent,'Выбрать один из своих плейлистов',options,matched,function(value){
     if(value==='manual')return;
     var item=list[Number(value.slice(7))];if(!item)return;
     var verified=API.playlistUrl(item.url,item.provider);if(!verified)return;
     radio.provider=item.provider;radio.url=verified;radio.controlVersion=2;
     render();
   });
   selectField(parent,'Площадка радио',[['spotify','Spotify'],['youtube','YouTube']],
     radio.provider||'spotify',function(v){
       if(v!==radio.provider){radio.provider=v;radio.url='';}
       radio.controlVersion=2;render();
     });
   field(parent,'Официальная ссылка на публичный плейлист радио',radio.url||'',function(v){
     radio.url=v;radio.controlVersion=2;
   });
   var help=document.createElement('p');help.className='sync-note';
   help.textContent='Разрешены только официальные публичные плейлисты Spotify и YouTube. Плеер появляется по нажатию слушателя, без автоматических прослушиваний.';
   parent.appendChild(help);
   var url=API.playlistUrl(radio.url||'',radio.provider);
   if(url){
     var preview=document.createElement('a');preview.className='landing-small';
     preview.href=url;preview.target='_blank';preview.rel='noopener noreferrer';
     preview.textContent='Открыть выбранный плейлист';
     parent.appendChild(preview);
   }
 }
 function playAndFollowEditor(parent){
   heading(parent,'Плейлисты и подписки','Редактируй музыкальные подборки и ссылки независимо от плавающего радио.');
   parent.appendChild(button('Настроить VELAR RADIO',function(){
     tab='radio';render();
   },'landing-small'));
   heading(parent,'Плейлисты','Плейлисты показываются отдельно от альбомов и синглов.');
   if(!data.releases.playlists)data.releases.playlists=[];
   data.releases.playlists.forEach(function(item,index){
     var box=document.createElement('section');box.className='landing-card';
     heading(box,'Плейлист '+(index+1));
     field(box,'Название',item.title,function(v){item.title=v;});
     field(box,'Короткое описание',item.description||'',function(v){item.description=v;});
     selectField(box,'Площадка',[['spotify','Spotify'],['youtube','YouTube']],
       item.provider||'spotify',function(v){item.provider=v;item.url='';render();});
     field(box,'Официальная ссылка на плейлист',item.url||'',function(v){item.url=v;});
     var row=document.createElement('label');row.className='landing-checkbox';
     var tick=document.createElement('input');tick.type='checkbox';tick.checked=item.visible===true;
     tick.onchange=function(){item.visible=this.checked;updateButtons();};
     row.appendChild(tick);row.appendChild(document.createTextNode(' Показывать плейлист'));box.appendChild(row);
     box.appendChild(button('Удалить плейлист',function(){
       if(!window.confirm('Убрать плейлист из черновика?'))return;
       data.releases.playlists.splice(index,1);render();
     }));parent.appendChild(box);
   });
   parent.appendChild(button('+ Добавить плейлист',function(){
     if(data.releases.playlists.length>=8){info('Максимум 8 плейлистов.');return;}
     data.releases.playlists.push({title:'',description:'',url:'',provider:'spotify',visible:false});render();
   },'landing-add'));
   heading(parent,'Подписки','Только прямые официальные страницы артистов и каналов.');
   if(!data.releases.subscriptions)data.releases.subscriptions=[];
   data.releases.subscriptions.forEach(function(item,index){
     var box=document.createElement('section');box.className='landing-card';
     heading(box,'Подписка '+(index+1));
     field(box,'Название',item.title,function(v){item.title=v;});
     selectField(box,'Площадка',[['spotify','Spotify'],['youtube','YouTube'],['telegram','Telegram']],
       item.provider||'spotify',function(v){item.provider=v;item.url='';render();});
     field(box,'Ссылка на артиста / канал',item.url||'',function(v){item.url=v;});
     var row=document.createElement('label');row.className='landing-checkbox';
     var tick=document.createElement('input');tick.type='checkbox';tick.checked=item.visible===true;
     tick.onchange=function(){item.visible=this.checked;updateButtons();};
     row.appendChild(tick);row.appendChild(document.createTextNode(' Показывать подписку'));box.appendChild(row);
     box.appendChild(button('Удалить подписку',function(){
       if(!window.confirm('Убрать ссылку из черновика?'))return;
       data.releases.subscriptions.splice(index,1);render();
     }));parent.appendChild(box);
   });
   parent.appendChild(button('+ Добавить подписку',function(){
     if(data.releases.subscriptions.length>=6){info('Максимум 6 подписок.');return;}
     data.releases.subscriptions.push({title:'',provider:'spotify',url:'',visible:false});render();
   },'landing-add'));
 }

 // RUN-072 — Editable navigation; links are restricted to internal sections
 // by the shared public schema. Nothing here touches Firestore until save.
 function universeEditor(parent){
   var world=data.genres.universe,nodes=world.nodes;
   heading(parent,'Управление музыкальной вселенной',
     'В центре всегда подлинный кристалл VELARDREAM. Меню вокруг него можно добавлять, скрывать, перемещать и удалять. Максимум 12.');
   field(parent,'Заголовок вселенной',world.heading,function(v){world.heading=v;});
   field(parent,'Описание вселенной',world.intro,function(v){world.intro=v;},true);
   nodes.forEach(function(item,index){
     var card=document.createElement('section');card.className='landing-card';
     heading(card,'Созвездие '+(index+1)+' · '+(item.label||item.id));
     var actions=document.createElement('div');actions.className='landing-item-actions';
     var up=button('↑ Выше',function(){
       if(index<1)return;
       var x=nodes.splice(index,1)[0];nodes.splice(index-1,0,x);render();
     });
     var down=button('↓ Ниже',function(){
       if(index>=nodes.length-1)return;
       var x=nodes.splice(index,1)[0];nodes.splice(index+1,0,x);render();
     });
     var remove=button('Удалить созвездие',function(){
       if(!window.confirm('Убрать это созвездие из черновика? Кристалл останется.'))return;
       nodes.splice(index,1);render();
     },'landing-danger');
     up.disabled=index===0;down.disabled=index===nodes.length-1;
     actions.appendChild(up);actions.appendChild(down);actions.appendChild(remove);card.appendChild(actions);
     field(card,'Уникальный код (латиница и дефис)',item.id,function(v){item.id=v.trim().toLowerCase();});
     field(card,'Название созвездия',item.label,function(v){item.label=v;});
     field(card,'Подпись созвездия',item.description||'',function(v){item.description=v;},true);
     selectField(card,'При нажатии перейти в раздел',[
       ['artists','Артисты'],['releases','Релизы и клипы'],['albums','Альбомы'],['playlists','Плейлисты'],
       ['genres','Жанры'],['languages','Миры языков'],['topics','Темы песен'],['about','О проекте'],['radio','VELAR RADIO (плейлисты)']
     ],item.target,function(v){item.target=v;});
     var row=document.createElement('label');row.className='landing-checkbox';
     var check=document.createElement('input');check.type='checkbox';check.checked=item.visible;
     check.onchange=function(){item.visible=this.checked;updateButtons();};
     row.appendChild(check);
     var label=document.createElement('span');label.textContent='Показывать вокруг кристалла';
     row.appendChild(label);card.appendChild(row);
     parent.appendChild(card);
   });
   parent.appendChild(button('+ Добавить созвездие',function(){
     if(nodes.length>=12){info('Максимум 12 созвездий. Можно сначала удалить или скрыть старое.');return;}
     var i=1,code='';
     do{code='new-world-'+i++;}while(nodes.some(function(n){return n.id===code;}));
     nodes.push({id:code,label:'Новый мир',description:'',target:'languages',visible:false});
     render();
   },'landing-add'));
 }

 // RUN-090: ONE attachment editor shared by language and topic constellations.
 // A song has one row and one primary official player, optionally a second.
 // RUN-179: all genres, topics, languages and albums share three official sources.
 function attachedSongSources(t){
   var sources={spotify:'',youtube:'',appleMusic:''};
   if(!t)return sources;
   [['provider','url'],['alternateProvider','alternateUrl'],['thirdProvider','thirdUrl']].forEach(function(keys){
     if(sources.hasOwnProperty(t[keys[0]]))sources[t[keys[0]]]=t[keys[1]]||'';
   });
   return sources;
 }
 function attachedCatalogOptions(){
   var rows=[];
   (catalogArtists||[]).forEach(function(song){
     var links=song.links||{};
     var spotify=API.songUrl(links.spotify||'','spotify'),
       youtube=API.songUrl(links.youtube||'','youtube'),
       appleMusic=API.songUrl(links.appleMusic||'','appleMusic');
     if(spotify||youtube||appleMusic)rows.push({
       title:String(song.title||'Без названия'),artist:String(song.artist||''),
       spotify:spotify,youtube:youtube,appleMusic:appleMusic
     });
   });
   return rows.sort(compareSong);
 }
 function attachedSongKey(t){
   return String(t.title||'').trim().toLocaleLowerCase('ru')+'|'+
     String(t.artist||'').trim().toLocaleLowerCase('ru');
 }
 function attachedFind(target,song){
   var key=attachedSongKey(song),urls=[song.spotify,song.youtube,song.appleMusic].filter(function(u){return !!u;});
   for(var i=0;i<target.tracks.length;i++){
     var row=target.tracks[i],links=attachedSongSources(row);
     if(attachedSongKey(row)===key||urls.some(function(url){
       return url===links.spotify||url===links.youtube||url===links.appleMusic;
     }))return row;
   }
   return null;
 }
 function attachedCheckMode(primary,spotify,youtube,appleMusic){
   var checked=[];
   if(spotify)checked.push('spotify');
   if(youtube)checked.push('youtube');
   if(appleMusic)checked.push('appleMusic');
   if(!checked.length)return '';
   if(checked.indexOf(primary)>=0){
     checked.splice(checked.indexOf(primary),1);
     checked.unshift(primary); // existing primary remains unchanged when possible
   }
   return checked.join('+');
 }
 function attachedSourceCheckbox(parent,provider,checked,disabled){
   var label=document.createElement('label');label.className='landing-source-check'+(disabled?' is-disabled':'');
   var box=document.createElement('input');box.type='checkbox';box.checked=!!checked;
   box.disabled=!!disabled;box.setAttribute('aria-label',provider==='spotify'?'Spotify':provider==='appleMusic'?'Apple Music':'YouTube');
   label.appendChild(box);
   var title=document.createElement('span');title.textContent=provider==='spotify'?'Spotify':provider==='appleMusic'?'Apple Music':'YouTube';
   label.appendChild(title);parent.appendChild(label);return box;
 }
 function attachedBuildSong(song,mode,sources){
   var parts=String(mode||'').split('+'),raw={title:song.title,artist:song.artist,
     provider:parts[0],url:sources[parts[0]]||''};
   if(parts[1]){raw.alternateProvider=parts[1];raw.alternateUrl=sources[parts[1]]||'';}
   if(parts[2]){raw.thirdProvider=parts[2];raw.thirdUrl=sources[parts[2]]||'';}
   return API.languageTrack(raw,1); // one shared whitelist, no private URLs
 }
 function attachedReplace(target,old,song,mode,sources){
   var clean=attachedBuildSong(song,mode,sources);
   var index=old?target.tracks.indexOf(old):-1;
   if(old&&index<0)throw new Error('Песня уже изменена в другом списке. Обнови редактор.');
   var links=attachedSongSources(clean),identity=attachedSongKey(clean);
   target.tracks.forEach(function(t){
     if(t===old)return;
     var existing=attachedSongSources(t);
     if(attachedSongKey(t)===identity)
       throw new Error('Такая песня уже назначена. Измени существующую строку.');
     if(['spotify','youtube','appleMusic'].some(function(p){
       return !!links[p]&&['spotify','youtube','appleMusic'].some(function(k){return links[p]===existing[k];});
     }))throw new Error('Одна ссылка уже назначена другой композиции.');
   });
   if(!old&&target.tracks.length>=300)throw new Error('Максимум 300 песен на подборку.');
   if(old){
     old.title=clean.title;old.artist=clean.artist;old.provider=clean.provider;old.url=clean.url;
     delete old.alternateProvider;delete old.alternateUrl;delete old.thirdProvider;delete old.thirdUrl;
     if(clean.alternateUrl){old.alternateProvider=clean.alternateProvider;old.alternateUrl=clean.alternateUrl;}
     if(clean.thirdUrl){old.thirdProvider=clean.thirdProvider;old.thirdUrl=clean.thirdUrl;}
   }else target.tracks.push(clean);
   return clean;
 }
 function attachedSongsEditor(parent,entry,opts){
   var mode=opts.mode||'language',isLanguage=mode==='language';
   var filter=opts.getFilter||function(){return '';},setFilter=opts.setFilter||function(){};
   var getCatalogSearch=opts.getCatalogSearch||function(){return '';},
     setCatalogSearch=opts.setCatalogSearch||function(){};
   var localCatalogPage=0;
   var getCatalogPage=opts.getCatalogPage||function(){return localCatalogPage;};
   var setCatalogPage=opts.setCatalogPage||function(v){localCatalogPage=v;};
   var options=attachedCatalogOptions();
   // RUN-105: the assigned list lives BELOW the catalog so its growing height
   // cannot shift the search field/checkboxes while the editor is in use.
   var assignedSection=document.createElement('section');
   assignedSection.className='landing-assigned-block';
   heading(assignedSection,isLanguage?'Подтверждённые песни ('+entry.tracks.length+')':
     'Назначенные песни ('+entry.tracks.length+')',
     'Найди композицию по названию или выбери из списка. Отметь Spotify, YouTube и/или Apple Music. Все площадки относятся к одной песне. Изменения сохраняются сначала в черновике.');
   var search=document.createElement('input');search.type='search';search.className='landing-release-search';
   search.placeholder='Поиск среди назначенных песен…';search.value=filter();
   var assigned=document.createElement('div');assigned.className='landing-language-songs';
   function catalogFor(t){
     var key=attachedSongKey(t);
     for(var i=0;i<options.length;i++){
       if(attachedSongKey(options[i])===key)return options[i];
     }
     return null;
   }
   function drawAssigned(){
     assignedSection.children[0].textContent=(isLanguage?'Подтверждённые песни (':
       'Назначенные песни (')+entry.tracks.length+')';
     clear(assigned);
     var q=filter().toLocaleLowerCase('ru').replace(/ё/g,'е');
     var found=entry.tracks.filter(function(t){
       return !q||(t.title+' '+t.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0;
     }).sort(compareSong);
     found.slice(0,40).forEach(function(t){
       var outer=document.createElement('div');outer.className='landing-attached-song';
       var line=document.createElement('div');line.className='landing-language-song-row';
       var title=document.createElement('span');
       var platforms=[t.provider,t.alternateProvider,t.thirdProvider].filter(function(p){return !!p;});
       title.textContent=t.title+' · '+t.artist+' · '+platforms.map(function(p){
         return p==='appleMusic'?'Apple Music':p==='spotify'?'Spotify':'YouTube';
       }).join(' + ');
       line.appendChild(title);
       var edit=button('Изменить плеер',function(){
         clear(editArea);
         if(editArea.getAttribute('data-open')==='true'){
           editArea.setAttribute('data-open','false');return;
         }
         editArea.setAttribute('data-open','true');
         var catalog=catalogFor(t),sources=attachedSongSources(t);
         if(catalog){
           if(!sources.spotify)sources.spotify=catalog.spotify;
           if(!sources.youtube)sources.youtube=catalog.youtube;
           if(!sources.appleMusic)sources.appleMusic=catalog.appleMusic;
         }
         var wrap=document.createElement('div');wrap.className='landing-attached-fields';
         var activeSources=attachedSongSources(t);
         var checks=document.createElement('div');checks.className='landing-song-sources';
         checks.setAttribute('role','group');
         checks.setAttribute('aria-label','Источники записи: '+t.title);
         var spotifyCheck=attachedSourceCheckbox(checks,'spotify',!!activeSources.spotify,false);
         var youtubeCheck=attachedSourceCheckbox(checks,'youtube',!!activeSources.youtube,false);
         var appleCheck=attachedSourceCheckbox(checks,'appleMusic',!!activeSources.appleMusic,false);
         wrap.appendChild(checks);
         function urlField(label,url){
           var holder=document.createElement('label');holder.className='landing-attached-url';
           var text=document.createElement('span');text.textContent=label;
           var input=document.createElement('input');input.type='url';input.value=url||'';
           input.placeholder='https://';input.setAttribute('aria-label',label+' — '+t.title);
           holder.appendChild(text);holder.appendChild(input);wrap.appendChild(holder);return input;
         }
         var spotify=urlField('Spotify — прямая ссылка на песню',sources.spotify);
         var youtube=urlField('YouTube — прямая ссылка на видео',sources.youtube);
         var apple=urlField('Apple Music — прямая ссылка на песню',sources.appleMusic);
         var buttons=document.createElement('div');buttons.className='landing-item-actions';
         buttons.appendChild(button('Применить',function(){
           try{
             var chosen=attachedCheckMode(t.provider,spotifyCheck.checked,youtubeCheck.checked,appleCheck.checked);
             if(!chosen)throw new Error('Отметь хотя бы одну площадку: Spotify, YouTube или Apple Music.');
             attachedReplace(entry,t,t,chosen,
               {spotify:spotify.value.trim(),youtube:youtube.value.trim(),appleMusic:apple.value.trim()});
           }catch(e){info('Не удалось изменить плеер: '+e.message);return;}
           drawAssigned();drawCatalog();updateButtons();
           info('Источники обновлены в черновике. Нажми «Сохранить черновик», затем «Опубликовать».');
         },'landing-add'));
         buttons.appendChild(button('Отмена',function(){drawAssigned();},'landing-small'));
         wrap.appendChild(buttons);editArea.appendChild(wrap);
       },'landing-small');
       line.appendChild(edit);
       line.appendChild(button('Открепить',function(){
         var index=entry.tracks.indexOf(t);if(index<0)return;
         entry.tracks.splice(index,1);drawAssigned();if(catalogLoaded)drawCatalog();updateButtons();
       },'landing-danger'));
       outer.appendChild(line);
       var editArea=document.createElement('div');editArea.className='landing-attached-editor';
       editArea.setAttribute('data-open','false');outer.appendChild(editArea);
       assigned.appendChild(outer);
     });
     if(found.length>40){
       var note=document.createElement('p');note.className='sync-note';
       note.textContent='Первые 40 из '+found.length+'. Уточни поиск, чтобы редактировать остальные.';
       assigned.appendChild(note);
     }
     if(!found.length){
       var empty=document.createElement('p');empty.className='sync-note';
       empty.textContent='Песен пока нет. Добавь их из каталога ниже.';
       assigned.appendChild(empty);
     }
   }
   search.oninput=function(){setFilter(this.value);drawAssigned();};
   // With zero attached songs this is NOT the catalog search; do not confuse users.
   if(entry.tracks.length)assignedSection.appendChild(search);
   assignedSection.appendChild(assigned);
   drawAssigned();
   heading(parent,'Каталог песен — быстрый выбор',
     'Найди песню по названию или исполнителю, затем выбери Spotify, YouTube и Apple Music. Песня остаётся одной строкой.');
   // Keep the MAIN song search visible even while the private catalog loads.
   // Preserve typed text across re-renders so a delayed 4G response cannot erase it.
   var catalogSearch=document.createElement('input');catalogSearch.type='search';
   catalogSearch.className='landing-language-catalog-search';
   catalogSearch.placeholder='Найти песню во всём каталоге…';
   catalogSearch.value=getCatalogSearch();parent.appendChild(catalogSearch);
   catalogSearch.oninput=function(){setCatalogSearch(this.value);setCatalogPage(0);if(catalogLoaded)drawCatalog();};
   if(!catalogLoaded){
     var msg=document.createElement('p');msg.className='sync-note';
     msg.textContent=catalogLoading?'Загружаем закрытый каталог песен…':catalogError?
       'Ошибка каталога: '+catalogError:
       (!db||!uid||!loaded?'Ожидаем подтверждения входа администратора и подключения к базе.':
       'Каталог ещё не загружен. Нажми «Загрузить каталог».');
     parent.appendChild(msg);
     var retry=button(catalogLoading?'Каталог загружается…':'Загрузить каталог',function(){
       if(!db||!uid||!loaded){info('Каталог доступен после подтверждённого входа администратора.');return;}
       catalogLoaded=false;loadCatalogArtists(true);
     });
     retry.disabled=catalogLoading;
     parent.appendChild(retry);
     parent.appendChild(assignedSection);
     return;
   }
   var results=document.createElement('div');results.className='landing-language-catalog-list';
   parent.appendChild(results);
   parent.appendChild(assignedSection);
   function drawCatalog(){
     clear(results);
     var q=getCatalogSearch().toLocaleLowerCase('ru').replace(/ё/g,'е');
     var matches=options.filter(function(song){
       return !!(song.spotify||song.youtube||song.appleMusic)&&
         (!q||(song.title+' '+song.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0);
     });
     var size=40,total=matches.length,pages=Math.max(1,Math.ceil(total/size));
     var page=Math.max(0,Math.min(pages-1,Math.floor(Number(getCatalogPage())||0)));
     if(page!==getCatalogPage())setCatalogPage(page);
     var start=page*size;
     matches.slice(start,start+size).forEach(function(song){
       var existing=attachedFind(entry,song),sources={spotify:song.spotify,youtube:song.youtube,appleMusic:song.appleMusic};
       if(existing){
         var old=attachedSongSources(existing);
         if(!sources.spotify)sources.spotify=old.spotify;
         if(!sources.youtube)sources.youtube=old.youtube;
         if(!sources.appleMusic)sources.appleMusic=old.appleMusic;
       }
       if(!sources.spotify&&!sources.youtube&&!sources.appleMusic)return;
       var row=document.createElement('div');row.className='landing-topic-catalog-row';
       var holder=document.createElement('label');holder.className='landing-checkbox';
       var check=document.createElement('input');check.type='checkbox';check.checked=!!existing;
       holder.appendChild(check);
       var name=document.createElement('span');name.textContent=song.title+' · '+song.artist;
       holder.appendChild(name);row.appendChild(holder);
       var currentSources=existing?attachedSongSources(existing):{spotify:'',youtube:'',appleMusic:''};
       var choices=document.createElement('div');choices.className='landing-song-sources';
       choices.setAttribute('role','group');choices.setAttribute('aria-label','Источники: '+song.title);
       var spotifyCheck=attachedSourceCheckbox(choices,'spotify',!!currentSources.spotify,!sources.spotify);
       var youtubeCheck=attachedSourceCheckbox(choices,'youtube',!!currentSources.youtube,!sources.youtube);
       var appleCheck=attachedSourceCheckbox(choices,'appleMusic',!!currentSources.appleMusic,!sources.appleMusic);
       row.appendChild(choices);
       // Local feedback: the checkbox and this text change without redrawing the catalog.
       var assignmentState=document.createElement('span');
       assignmentState.className='landing-assignment-state';
       assignmentState.textContent=existing?'✓ Назначена':'';
       row.appendChild(assignmentState);
       function applySources(){
         var current=attachedFind(entry,song);
         var mode=attachedCheckMode(current&&current.provider,spotifyCheck.checked,youtubeCheck.checked,appleCheck.checked);
         if(!mode){
           if(current)entry.tracks.splice(entry.tracks.indexOf(current),1);
           check.checked=false;assignmentState.textContent='';
           drawAssigned();updateButtons();
           info('Песня откреплена от этой подборки только в черновике.');
           return;
         }
         try{attachedReplace(entry,current,song,mode,sources);}
         catch(e){
           var restore=current?attachedSongSources(current):{spotify:'',youtube:'',appleMusic:''};
           spotifyCheck.checked=!!restore.spotify;
           youtubeCheck.checked=!!restore.youtube;
           appleCheck.checked=!!restore.appleMusic;
           check.checked=!!current;
           info('Нельзя прикрепить песню: '+e.message);return;
         }
         check.checked=true;assignmentState.textContent='✓ Назначена';
         drawAssigned();updateButtons();
         info('Привязка обновлена в черновике. Сохрани и опубликуй, чтобы изменения увидели слушатели.');
       }
       check.onchange=function(){
         if(!this.checked){spotifyCheck.checked=false;youtubeCheck.checked=false;appleCheck.checked=false;}
         else if(!spotifyCheck.checked&&!youtubeCheck.checked&&!appleCheck.checked){
           if(sources.spotify)spotifyCheck.checked=true;
           else if(sources.youtube)youtubeCheck.checked=true;
           else appleCheck.checked=true;
         }
         applySources();
       };
       spotifyCheck.onchange=applySources;
       youtubeCheck.onchange=applySources;
       appleCheck.onchange=applySources;
       results.appendChild(row);
     });
     if(total>size){
       var pagesNav=document.createElement('div');pagesNav.className='landing-song-pagination';
       pagesNav.setAttribute('role','navigation');
       pagesNav.setAttribute('aria-label','Страницы каталога песен');
       var status=document.createElement('span');status.className='landing-song-page-status';
       status.textContent=(start+1)+'–'+Math.min(start+size,total)+' из '+total+
         ' · страница '+(page+1)+' из '+pages;
       pagesNav.appendChild(status);
       function changeCatalogPage(next){
         setCatalogPage(next);drawCatalog();
         // The next 40 songs must be visible without scrolling back through the form.
         if(results.scrollIntoView){
           try{results.scrollIntoView({block:'start'});}
           catch(err){results.scrollIntoView();}
         }
       }
       var previous=button('← Назад',function(){changeCatalogPage(page-1);},'landing-small');
       previous.disabled=page===0;
       pagesNav.appendChild(previous);
       var following=button('Вперёд →',function(){changeCatalogPage(page+1);},'landing-small');
       following.disabled=page>=pages-1;
       pagesNav.appendChild(following);
       results.appendChild(pagesNav);
     }
     if(!total){
       var empty=document.createElement('p');empty.className='sync-note';
       empty.textContent='Нет песен с проверенными ссылками в каталоге.';
       results.appendChild(empty);
     }
   }
   drawCatalog();
 }
 function languageEditor(parent){
   var config=data.genres.languages,langs=config.entries;
   heading(parent,'Миры языков',
     'Привязывай только проверенные опубликованные песни. Язык автоматически по названию не угадывается. До 20 языков и 300 песен на каждый, с общим ограничением объёма Firestore.');
   field(parent,'Заголовок языкового мира',config.heading,function(v){config.heading=v;});
   field(parent,'Описание языкового мира',config.intro,function(v){config.intro=v;},true);
   if(window.VMM_TITLE_LANGUAGE&&window.VMM_TITLE_LANGUAGE.attach){
     window.VMM_TITLE_LANGUAGE.attach({
       parent:parent,catalog:catalogArtists,catalogLoaded:catalogLoaded,
       db:db,uid:uid,languages:config,
       onLoad:function(){loadCatalogArtists(true);},
       onDraftChanged:function(){updateButtons();}
     });
   }
   var menu=document.createElement('div');menu.className='landing-language-menu';
   langs.forEach(function(lang,index){
     var item=document.createElement('div');item.className='landing-language-menu-item';
     var show=button(lang.label+(lang.fictional?' · вымышленный':'')+
       ' · '+lang.tracks.length+' песен',function(){
         languageEditorCode=lang.code;languageCatalogSearch='';languageTrackFilter='';languageCatalogPage=0;render();
       },'landing-small');
     if(languageEditorCode===lang.code)show.className+=' is-active';
     item.appendChild(show);
     var row=document.createElement('div');row.className='landing-item-actions';
     var up=button('↑',function(){if(index<1)return;var x=langs.splice(index,1)[0];langs.splice(index-1,0,x);render();});
     var down=button('↓',function(){if(index===langs.length-1)return;var x=langs.splice(index,1)[0];langs.splice(index+1,0,x);render();});
     var remove=button('Удалить',function(){
       if(!window.confirm('Удалить язык и его публичные привязки только из черновика?'))return;
       langs.splice(index,1);
       if(languageEditorCode===lang.code)languageEditorCode='';
       render();
     },'landing-danger');
     up.disabled=index===0;down.disabled=index===langs.length-1;
     row.appendChild(up);row.appendChild(down);row.appendChild(remove);
     item.appendChild(row);menu.appendChild(item);
   });
   parent.appendChild(menu);
   parent.appendChild(button('+ Добавить язык',function(){
     if(langs.length>=20){info('Достигнут предел в 20 языковых миров.');return;}
     var i=1,code='';do{code='new-language-'+i++;}while(langs.some(function(n){return n.code===code;}));
     langs.push({code:code,label:'Новый язык',fictional:false,visible:false,tracks:[]});
     languageEditorCode=code;languageCatalogSearch='';languageCatalogPage=0;render();
   },'landing-add'));
   var active=langs.filter(function(x){return x.code===languageEditorCode;})[0];
   if(!active){active=langs[0];if(active)languageEditorCode=active.code;}
   if(!active){info('Нет языков. Добавь первый языковой мир.');return;}
   var card=document.createElement('section');card.className='landing-card landing-language-editor';
   heading(card,'Редактирование: '+active.label,'Список песен показывается посетителям только после публикации черновика.');
   field(card,'Уникальный код языка (латиница)',active.code,function(v){
     var normalized=v.trim().toLowerCase();
     active.code=normalized;languageEditorCode=normalized;
   });
   field(card,'Название языка',active.label,function(v){active.label=v;});
   var control=document.createElement('label');control.className='landing-checkbox';
   var fictional=document.createElement('input');fictional.type='checkbox';fictional.checked=active.fictional===true;
   fictional.onchange=function(){active.fictional=this.checked;updateButtons();};
   control.appendChild(fictional);
   var fictionalText=document.createElement('span');
   fictionalText.textContent='Авторский / вымышленный язык';control.appendChild(fictionalText);card.appendChild(control);
   var row=document.createElement('label');row.className='landing-checkbox';
   var visible=document.createElement('input');visible.type='checkbox';visible.checked=active.visible===true;
   visible.onchange=function(){active.visible=this.checked;updateButtons();};
   row.appendChild(visible);
   var visText=document.createElement('span');visText.textContent='Показывать язык на сайте';
   row.appendChild(visText);card.appendChild(row);
   attachedSongsEditor(card,active,{mode:'language',
     getFilter:function(){return languageTrackFilter;},
     setFilter:function(v){languageTrackFilter=v;},
     getCatalogSearch:function(){return languageCatalogSearch;},
     setCatalogSearch:function(v){languageCatalogSearch=v;},
     getCatalogPage:function(){return languageCatalogPage;},
     setCatalogPage:function(v){languageCatalogPage=v;}
   });
   parent.appendChild(card);
 }

 // RUN-073: editorial tagging. A public song can be assigned to any number
 // of topics, like private artist-track assignments, without copying audio.
 // RUN-096: one shared song editor for official albums AND collections from singles.
 function albumsEditor(parent){
   var cfg=data.albums,entries=cfg.entries;
   heading(parent,'Альбомы и коллекции из синглов',
     'Официальный альбом имеет собственную страницу у дистрибьютора. Собранные на сайте синглы называются авторской коллекцией; их исходные релизы не изменяются.');
   field(parent,'Название раздела',cfg.heading,function(v){cfg.heading=v;});
   field(parent,'Описание раздела',cfg.intro,function(v){cfg.intro=v;},true);
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Вид обложек и список песен альбомов настраиваются в «Оформление главной» → «Альбомы». Здесь редактируются сами альбомы и их песни.';
   parent.appendChild(note);
   var menu=document.createElement('div');menu.className='landing-language-menu';
   entries.forEach(function(album,index){
     var group=document.createElement('div');group.className='landing-language-menu-item';
     var select=button((album.title||album.id)+' · '+album.tracks.length+' песен',function(){
       albumEditorId=album.id;albumCatalogSearch='';albumTrackFilter='';albumCatalogPage=0;render();
     },'landing-small');
     if(albumEditorId===album.id)select.className+=' is-active';
     group.appendChild(select);
     var controls=document.createElement('div');controls.className='landing-item-actions';
     var up=button('↑',function(){if(index<1)return;var t=entries.splice(index,1)[0];entries.splice(index-1,0,t);render();});
     var down=button('↓',function(){if(index>=entries.length-1)return;var t=entries.splice(index,1)[0];entries.splice(index+1,0,t);render();});
     var remove=button('Удалить',function(){
       if(!window.confirm('Удалить альбом из черновика сайта? Оригинальные синглы останутся в каталоге.'))return;
       entries.splice(index,1);if(albumEditorId===album.id)albumEditorId='';render();
     },'landing-danger');
     up.disabled=index===0;down.disabled=index===entries.length-1;
     controls.appendChild(up);controls.appendChild(down);controls.appendChild(remove);
     group.appendChild(controls);menu.appendChild(group);
   });
   parent.appendChild(menu);
   parent.appendChild(button('+ Создать альбом',function(){
     if(entries.length>=8){info('В текущем формате страницы максимум 8 альбомов, чтобы не перегружать Firestore фотографиями.');return;}
     var i=1,key;do{key='album-'+i++;}while(entries.some(function(a){return a.id===key;}));
     entries.push({id:key,title:'',artist:'',description:'',kind:'collection',
       mediaProvider:'spotify',mediaUrl:'',imageData:'',imageUrl:'',visible:false,tracks:[]});
     albumEditorId=key;albumCatalogSearch='';albumTrackFilter='';albumCatalogPage=0;render();
   },'landing-add'));
   var active=entries.filter(function(album){return album.id===albumEditorId;})[0];
   if(!active){active=entries[0];if(active)albumEditorId=active.id;}
   if(!active)return;
   var box=document.createElement('section');box.className='landing-card landing-album-editor';
   heading(box,'Альбом: '+(active.title||'Новая коллекция'),
     'Обложка будет публичной после отдельной публикации. Песни не дублируются и сохраняют свои Spotify/YouTube ссылки.');
   field(box,'Код альбома (латиница и дефис)',active.id,function(v){active.id=v.trim().toLowerCase();albumEditorId=active.id;});
   field(box,'Название альбома',active.title,function(v){active.title=v;});
   field(box,'Исполнитель',active.artist,function(v){active.artist=v;});
   field(box,'Описание',active.description||'',function(v){active.description=v;},true);
   selectField(box,'Тип',
     [['collection','Авторская коллекция из синглов'],['official','Официально выпущенный альбом']],
     active.kind,function(v){active.kind=v;if(v==='collection')active.mediaUrl='';render();});
   if(active.kind==='official')field(box,'Ссылка на официальный альбом Spotify (не трек)',
     active.mediaUrl||'',function(v){active.mediaUrl=v;});
   var mark=document.createElement('label');mark.className='landing-checkbox';
   var tick=document.createElement('input');tick.type='checkbox';tick.checked=active.visible===true;
   tick.onchange=function(){active.visible=this.checked;updateButtons();};
   mark.appendChild(tick);mark.appendChild(document.createTextNode(' Показывать альбом на сайте'));box.appendChild(mark);
   field(box,'HTTPS-ссылка на публичную обложку (не Google Drive) — необязательно',
     active.imageUrl||'',function(v){active.imageUrl=v;});
   releaseCover(box,active);
   attachedSongsEditor(box,active,{mode:'album',
     getFilter:function(){return albumTrackFilter;},
     setFilter:function(v){albumTrackFilter=v;},
     getCatalogSearch:function(){return albumCatalogSearch;},
     setCatalogSearch:function(v){albumCatalogSearch=v;},
     getCatalogPage:function(){return albumCatalogPage;},
     setCatalogPage:function(v){albumCatalogPage=v;}
   });
   parent.appendChild(box);
 }

 // RUN-178: genres share the validated topic/language/album song picker.
 // RUN-178: exactly one checkbox per catalog song; official sources are
 // resolved automatically at publication, never selected in this UI.
 function genreEditor(parent){
   var groups=data.genres.entries||[];
   heading(parent,'Жанры и песни',
     'Выбери жанр и отметь композиции одной галочкой. Spotify, YouTube и Apple Music подтягиваются из каталога автоматически. Можно назначать одну песню нескольким жанрам.');
   sectionFields(parent,'genres');
   var menu=document.createElement('div');menu.className='landing-language-menu';
   groups.forEach(function(group,index){
     var row=document.createElement('div');row.className='landing-language-menu-item';
     var select=button(group.label+' · '+(group.songIds||[]).length+' песен',function(){
       genreEditorId=group.id;genreCatalogSearch='';genreCatalogPage=0;render();
     },'landing-small');
     if(genreEditorId===group.id)select.className+=' is-active';
     row.appendChild(select);
     var actions=document.createElement('div');actions.className='landing-item-actions';
     var up=button('↑',function(){
       if(!index)return;
       var item=groups.splice(index,1)[0];groups.splice(index-1,0,item);render();
     });
     var down=button('↓',function(){
       if(index===groups.length-1)return;
       var item=groups.splice(index,1)[0];groups.splice(index+1,0,item);render();
     });
     var remove=button('Удалить',function(){
       if(!window.confirm('Удалить жанр «'+group.label+'» и его назначения из черновика? Песни и ссылки в каталоге не изменятся.'))return;
       groups.splice(index,1);
       if(genreEditorId===group.id)genreEditorId='';
       data.genres.tags=groups.map(function(g){return g.label;});render();
     },'landing-danger');
     up.disabled=index===0;down.disabled=index===groups.length-1;
     actions.appendChild(up);actions.appendChild(down);actions.appendChild(remove);
     row.appendChild(actions);menu.appendChild(row);
   });
   parent.appendChild(menu);
   parent.appendChild(button('+ Добавить жанр',function(){
     if(groups.length>=20){info('Не более 20 жанров.');return;}
     var n=1,code;
     do{code='genre-'+n++;}while(groups.some(function(g){return g.id===code;}));
     groups.push({id:code,label:'Новый жанр '+(n-1),visible:false,songIds:[],tracks:[]});
     data.genres.tags=groups.map(function(g){return g.label;});
     genreEditorId=code;genreCatalogSearch='';genreCatalogPage=0;render();
   },'landing-add'));
   var current=groups.filter(function(g){return g.id===genreEditorId;})[0];
   if(!current){current=groups[0];if(current)genreEditorId=current.id;}
   if(!current)return;
   if(!Array.isArray(current.songIds))current.songIds=[];
   var card=document.createElement('section');card.className='landing-card landing-genre-editor';
   heading(card,'Жанр: '+current.label,
     'Каждая песня берётся из единого каталога. Связи с жанрами сохраняются в черновике и становятся общедоступны только после публикации.');
   field(card,'Название жанра',current.label,function(v){
     current.label=v;data.genres.tags=groups.map(function(g){return g.label;});
   });
   var visibility=document.createElement('label');visibility.className='landing-checkbox';
   var check=document.createElement('input');check.type='checkbox';check.checked=current.visible===true;
   check.onchange=function(){current.visible=this.checked;updateButtons();};
   visibility.appendChild(check);
   var label=document.createElement('span');label.textContent='Показывать жанр на сайте';
   visibility.appendChild(label);card.appendChild(visibility);
   var summary=document.createElement('p');summary.className='sync-note';
   card.appendChild(summary);
   var search=document.createElement('input');search.type='search';
   search.className='landing-language-catalog-search';
   search.placeholder='Найти песню по названию или исполнителю…';
   search.value=genreCatalogSearch;card.appendChild(search);
   if(!catalogLoaded){
     var msg=document.createElement('p');msg.className='sync-note';
     msg.textContent=catalogLoading?'Загружаем каталог…':catalogError?
       'Ошибка каталога: '+catalogError:'Каталог ещё не загружен.';
     card.appendChild(msg);
     var retry=button('Загрузить каталог',function(){catalogLoaded=false;loadCatalogArtists(true);});
     retry.disabled=catalogLoading;card.appendChild(retry);
     parent.appendChild(card);return;
   }
   var results=document.createElement('div');results.className='landing-track-list';
   card.appendChild(results);
   function draw(){
     clear(results);
     summary.textContent='Назначено песен: '+current.songIds.length+' · Ссылки на площадки подключаются автоматически.';
     var q=String(genreCatalogSearch||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
     var found=catalogArtists.filter(function(t){
       return !q||(String(t.title||'')+' '+String(t.artist||'')).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0;
     }).sort(compareSong);
     var limit=40,pages=Math.max(1,Math.ceil(found.length/limit));
     genreCatalogPage=Math.max(0,Math.min(pages-1,genreCatalogPage));
     var first=genreCatalogPage*limit;
     found.slice(first,first+limit).forEach(function(song){
       if(!song.id)return;
       var row=document.createElement('label');row.className='landing-track-row';
       var checkbox=document.createElement('input');checkbox.type='checkbox';
       checkbox.checked=current.songIds.indexOf(song.id)>=0;
       checkbox.onchange=function(){
         var idx=current.songIds.indexOf(song.id);
         if(this.checked&&idx<0){
           if(current.songIds.length>=300){this.checked=false;info('Максимум 300 песен на жанр.');return;}
           current.songIds.push(song.id);
         }else if(!this.checked&&idx>=0)current.songIds.splice(idx,1);
         summary.textContent='Назначено песен: '+current.songIds.length+' · Ссылки на площадки подключаются автоматически.';
         updateButtons();
       };
       row.appendChild(checkbox);
       var title=document.createElement('span');title.textContent=String(song.title||'Без названия')+
         ' — '+String(song.artist||'Исполнитель не указан');
       row.appendChild(title);results.appendChild(row);
     });
     if(found.length>limit){
       var pageNav=document.createElement('div');pageNav.className='landing-song-pagination';
       var status=document.createElement('span');status.className='landing-song-page-status';
       status.textContent=(first+1)+'–'+Math.min(first+limit,found.length)+' из '+found.length+
         ' · страница '+(genreCatalogPage+1)+' из '+pages;
       pageNav.appendChild(status);
       var prev=button('← Назад',function(){genreCatalogPage--;draw();});
       var next=button('Вперёд →',function(){genreCatalogPage++;draw();});
       prev.disabled=genreCatalogPage===0;next.disabled=genreCatalogPage===pages-1;
       pageNav.appendChild(prev);pageNav.appendChild(next);results.appendChild(pageNav);
     }
     if(!found.length){var none=document.createElement('p');none.className='sync-note';
       none.textContent='Песен не найдено. Измени запрос.';results.appendChild(none);}
   }
   search.oninput=function(){genreCatalogSearch=this.value;genreCatalogPage=0;draw();};
   draw();parent.appendChild(card);
 }
 function topicEditor(parent){
   var config=data.genres.topics,topics=config.entries;
   heading(parent,'Темы и настроения',
     'Прикрепляй песни из каталога к нескольким темам — как к артистам. Никаких автоматических догадок по названиям. Изменения остаются в черновике до отдельной публикации.');
   field(parent,'Заголовок тематических миров',config.heading,function(v){config.heading=v;});
   field(parent,'Описание тематических миров',config.intro,function(v){config.intro=v;},true);
   var menu=document.createElement('div');menu.className='landing-language-menu';
   topics.forEach(function(topic,index){
     var tile=document.createElement('div');tile.className='landing-language-menu-item';
     var select=button(topic.label+' · '+topic.tracks.length+' песен',function(){
       topicEditorSlug=topic.slug;topicCatalogSearch='';topicTrackFilter='';topicCatalogPage=0;render();
     },'landing-small');
     if(topicEditorSlug===topic.slug)select.className+=' is-active';
     tile.appendChild(select);
     var actions=document.createElement('div');actions.className='landing-item-actions';
     var up=button('↑',function(){
       if(!index)return;
       var one=topics.splice(index,1)[0];topics.splice(index-1,0,one);render();
     });
     var down=button('↓',function(){
       if(index>=topics.length-1)return;
       var one=topics.splice(index,1)[0];topics.splice(index+1,0,one);render();
     });
     var remove=button('Удалить',function(){
       if(!window.confirm('Удалить эту тему и привязки песен из черновика?'))return;
       topics.forEach(function(t){if(t.parentSlug===topic.slug)t.parentSlug='';});
       topics.splice(index,1);
       if(topicEditorSlug===topic.slug)topicEditorSlug='';
       render();
     },'landing-danger');
     up.disabled=index===0;down.disabled=index===topics.length-1;
     actions.appendChild(up);actions.appendChild(down);actions.appendChild(remove);
     tile.appendChild(actions);menu.appendChild(tile);
   });
   parent.appendChild(menu);
   parent.appendChild(button('+ Добавить тему',function(){
     if(topics.length>=60){info('Максимум 60 тематических миров.');return;}
     var index=1,slug='';
     do{slug='new-topic-'+index++;}while(topics.some(function(t){return t.slug===slug;}));
     topics.push({slug:slug,label:'Новая тема',description:'',visible:false,tracks:[]});
     topicEditorSlug=slug;topicCatalogSearch='';topicTrackFilter='';topicCatalogPage=0;render();
   },'landing-add'));
   var current=topics.filter(function(x){return x.slug===topicEditorSlug;})[0];
   if(!current){current=topics[0];if(current)topicEditorSlug=current.slug;}
   if(!current)return;
   var card=document.createElement('section');card.className='landing-card landing-topic-editor';
   heading(card,'Подборка: '+current.label,
     'Тема и прикреплённые композиции попадут к слушателям только после сохранения и отдельной публикации.');
   field(card,'Уникальный код темы (латиница)',current.slug,function(v){
     topics.forEach(function(t){if(t.parentSlug&&t.parentSlug===current.slug)t.parentSlug=v.trim().toLowerCase();});
     current.slug=v.trim().toLowerCase();topicEditorSlug=current.slug;
   });
   var hasChildren=topics.some(function(t){return t.parentSlug===current.slug;});
   if(!hasChildren)selectField(card,'Основная тема',[['','Самостоятельная тема']].concat(topics.filter(function(t){return t!==current&&!t.parentSlug;}).map(function(t){return [t.slug,t.label];})),current.parentSlug||'',function(v){current.parentSlug=v;});
   selectField(card,'Показ темы',[['browse','В подборе и поиске'],['search','Только в поиске']],current.searchOnly?'search':'browse',function(v){current.searchOnly=v==='search';});
   field(card,'Поисковые слова через запятую',current.keywords||'',function(v){current.keywords=v;});
   field(card,'Название темы',current.label,function(v){current.label=v;});
   field(card,'Описание темы для слушателей',current.description||'',function(v){current.description=v;},true);
   var visibility=document.createElement('label');visibility.className='landing-checkbox';
   var check=document.createElement('input');check.type='checkbox';check.checked=current.visible===true;
   check.onchange=function(){current.visible=this.checked;updateButtons();};
   visibility.appendChild(check);
   var name=document.createElement('span');name.textContent='Показывать тему на сайте';
   visibility.appendChild(name);card.appendChild(visibility);
   attachedSongsEditor(card,current,{mode:'topic',
     getFilter:function(){return topicTrackFilter;},
     setFilter:function(v){topicTrackFilter=v;},
     getCatalogSearch:function(){return topicCatalogSearch;},
     setCatalogSearch:function(v){topicCatalogSearch=v;},
     getCatalogPage:function(){return topicCatalogPage;},
     setCatalogPage:function(v){topicCatalogPage=v;}
   });
   parent.appendChild(card);
 }

 // RUN-083: paginated knowledge base to keep old iPhones responsive.
 function faqEditor(parent,assistant){
   var outer=document.createElement('details');outer.className='landing-card';
   var summary=document.createElement('summary');
   summary.textContent='База знаний VELAR — '+assistant.faq.length+' вопросов и ответов';
   outer.appendChild(summary);
   var explanation=document.createElement('p');explanation.className='sync-note';
   explanation.textContent='Эти примеры — редакционные сценарии, не записи бесед пользователей. Приоритет у ваших личных правил ниже. Поиск, категории и страницы позволяют редактировать базу без сотни открытых форм. Ссылки на песни выбираются только из опубликованных подборок.';
   outer.appendChild(explanation);
   var search=document.createElement('input');search.type='search';
   search.className='landing-artist-select';
   search.setAttribute('aria-label','Найти вопрос в базе знаний');
   search.placeholder='Поиск по словам, вопросам и ответам';
   search.value=faqSearch;outer.appendChild(search);
   var category=document.createElement('select');category.className='landing-artist-select';
   category.setAttribute('aria-label','Категория вопросов VELAR');
   var categories=[''].concat(assistant.faq.map(function(q){return q.group;})
     .filter(function(g,i,a){return a.indexOf(g)===i;}));
   categories.forEach(function(g){
     var o=document.createElement('option');o.value=g;
     o.textContent=g||'Все категории';category.appendChild(o);
   });
   category.value=faqGroup;outer.appendChild(category);
   var listing=document.createElement('div');outer.appendChild(listing);
   function routeSelect(row){
     var wrap=document.createElement('label');wrap.className='landing-field';
     var title=document.createElement('span');title.textContent='Что предложить после ответа';
     wrap.appendChild(title);
     var select=document.createElement('select');select.className='landing-artist-select';
     var options=[
       ['none','Только ответ'],['clarify','Уточняющие кнопки'],['contact','Написать автору'],
       ['section:artists','Раздел «Артисты»'],['section:releases','Раздел «Релизы»'],['section:albums','Раздел «Альбомы»'],
       ['section:playlists','Раздел «Плейлисты»'],['section:topics','Раздел «Темы»'],
       ['section:languages','Раздел «Языки»'],['section:genres','Раздел «Жанры»'],
       ['section:about','Раздел «О проекте»']
     ];
     (data.genres.topics.entries||[]).forEach(function(t){
       options.push(['topic:'+t.slug,'Музыкальная тема: '+t.label]);
     });
     (data.genres.languages.entries||[]).forEach(function(l){
       options.push(['language:'+l.code,'Язык песен: '+l.label]);
     });
     if(!options.some(function(x){return x[0]===row.route;}))
       options.push([row.route,'Сохранённая тема: '+row.route]);
     options.forEach(function(pair){
       var o=document.createElement('option');o.value=pair[0];
       o.textContent=pair[1];select.appendChild(o);
     });
     select.value=row.route;
     select.onchange=function(){row.route=this.value;updateButtons();};
     wrap.appendChild(select);return wrap;
   }
   function draw(){
     clear(listing);
     var q=faqSearch.toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
     var found=assistant.faq.filter(function(item){
       if(faqGroup&&item.group!==faqGroup)return false;
       var text=(item.id+' '+item.group+' '+item.keywords+' '+item.answer)
         .toLocaleLowerCase('ru').replace(/ё/g,'е');
       return !q||text.indexOf(q)!==-1;
     });
     var pages=Math.max(1,Math.ceil(found.length/8));
     if(faqPage>=pages)faqPage=pages-1;
     var status=document.createElement('p');status.className='sync-note';
     status.textContent='Найдено: '+found.length+' · Страница '+(faqPage+1)+' из '+pages;
     listing.appendChild(status);
     found.slice(faqPage*8,faqPage*8+8).forEach(function(item){
       var card=document.createElement('section');card.className='landing-card';
       heading(card,item.group+' · '+item.id);
       var active=document.createElement('label');active.className='landing-checkbox';
       var check=document.createElement('input');check.type='checkbox';
       check.checked=item.enabled!==false;
       check.onchange=function(){item.enabled=this.checked;updateButtons();};
       active.appendChild(check);
       var caption=document.createElement('span');caption.textContent='Этот ответ включён';
       active.appendChild(caption);card.appendChild(active);
       field(card,'Код FAQ',item.id,function(v){item.id=v.trim().toLowerCase();});
       field(card,'Категория FAQ',item.group,function(v){item.group=v;});
       field(card,'Вопросы и ключевые фразы через запятую',item.keywords,function(v){item.keywords=v;},true);
       field(card,'Ответ VELAR',item.answer,function(v){item.answer=v;},true);
       card.appendChild(routeSelect(item));
       field(card,'Уточнения (до 3 кнопок через запятую)',item.followups,
         function(v){item.followups=v;},true);
       card.appendChild(button('Удалить сценарий',function(){
         if(!window.confirm('Удалить этот ответ из черновика?'))return;
         var ix=assistant.faq.indexOf(item);
         if(ix>=0)assistant.faq.splice(ix,1);
         summary.textContent='База знаний VELAR — '+assistant.faq.length+' вопросов и ответов';
         draw();updateButtons();
       },'landing-danger'));
       listing.appendChild(card);
     });
     var navigation=document.createElement('div');navigation.className='landing-item-actions';
     var previous=button('← Предыдущие',function(){if(faqPage>0){faqPage--;draw();}});
     previous.disabled=faqPage===0;
     var next=button('Следующие →',function(){if(faqPage+1<pages){faqPage++;draw();}});
     next.disabled=faqPage+1>=pages;
     navigation.appendChild(previous);navigation.appendChild(next);listing.appendChild(navigation);
   }
   search.oninput=function(){faqSearch=this.value;faqPage=0;draw();};
   category.onchange=function(){faqGroup=this.value;faqPage=0;draw();};
   outer.appendChild(button('+ Добавить вопрос и ответ',function(){
     if(assistant.faq.length>=150){info('База знаний: максимум 150 сценариев.');return;}
     var n=1,id;
     do{id='custom-'+n++;}while(assistant.faq.some(function(x){return x.id===id;}));
     assistant.faq.push({id:id,group:'Мои ответы',keywords:'новый вопрос',
       answer:'Здесь будет ответ VELAR.',route:'none',followups:'',enabled:true});
     faqGroup='Мои ответы';faqSearch='';search.value='';
     if(!Array.prototype.some.call(category.children,function(o){return o.value==='Мои ответы';})){
       var option=document.createElement('option');option.value='Мои ответы';
       option.textContent='Мои ответы';category.appendChild(option);
     }
     category.value=faqGroup;faqPage=Math.max(0,Math.ceil(
       assistant.faq.filter(function(x){return x.group===faqGroup;}).length/8)-1);
     outer.open=true;summary.textContent='База знаний VELAR — '+assistant.faq.length+' вопросов и ответов';
     draw();updateButtons();
   },'landing-add'));
   draw();parent.appendChild(outer);
 }
 function assistantEditor(parent){
   var assistant=data.genres.assistant;
   if(window.VELAR_AI_LAB&&window.VELAR_AI_LAB.attach)window.VELAR_AI_LAB.attach(parent);
   heading(parent,'VELAR Assistant — бесплатный музыкальный секретарь',
     'Работает прямо в браузере посетителя. Никакой платной нейросети, дополнительных запросов к Firestore, скрытой отправки сообщений или автозапуска музыки.');
   var check=document.createElement('label');check.className='landing-checkbox';
   var enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=assistant.enabled===true;
   enabled.onchange=function(){assistant.enabled=this.checked;updateButtons();};
   check.appendChild(enabled);
   var label=document.createElement('span');label.textContent='Показывать помощника на сайте';
   check.appendChild(label);parent.appendChild(check);
   var greet=document.createElement('label');greet.className='landing-checkbox';
   var greeting=document.createElement('input');greeting.type='checkbox';
   greeting.checked=assistant.greetingEnabled===true;
   greeting.onchange=function(){assistant.greetingEnabled=this.checked;updateButtons();};
   greet.appendChild(greeting);
   var gt=document.createElement('span');gt.textContent='Приветствовать нового посетителя (не более одного раза за сеанс)';
   greet.appendChild(gt);parent.appendChild(greet);
   // RUN-082: owner controls text reveal without editing JavaScript/CSS.
   var typingLabel=document.createElement('label');typingLabel.className='landing-checkbox';
   var typingEnabled=document.createElement('input');typingEnabled.type='checkbox';
   typingEnabled.checked=assistant.typing.enabled===true;
   typingEnabled.onchange=function(){assistant.typing.enabled=this.checked;updateButtons();};
   typingLabel.appendChild(typingEnabled);
   var typingText=document.createElement('span');
   typingText.textContent='Показывать ответы по буквам (эффект живой печати)';
   typingLabel.appendChild(typingText);parent.appendChild(typingLabel);
   var speedLabel=document.createElement('label');speedLabel.className='landing-field';
   var speedCaption=document.createElement('span');
   speedCaption.textContent='Скорость печати (мс на символ, от 15 до 90)';
   speedLabel.appendChild(speedCaption);
   var speedInput=document.createElement('input');speedInput.type='range';
   speedInput.min='15';speedInput.max='90';speedInput.step='5';
   speedInput.value=String(assistant.typing.speedMs);
   var speedValue=document.createElement('span');speedValue.className='sync-note';
   speedValue.textContent=String(assistant.typing.speedMs)+' мс';
   speedInput.oninput=function(){
     assistant.typing.speedMs=Number(this.value);
     speedValue.textContent=this.value+' мс';
     updateButtons();
   };
   speedLabel.appendChild(speedInput);speedLabel.appendChild(speedValue);
   parent.appendChild(speedLabel);
   var typingHint=document.createElement('p');typingHint.className='sync-note';
   typingHint.textContent='Длинные ответы появляются максимум за несколько секунд. При уменьшении анимации на устройстве ответ отображается сразу. Новая настройка заработает после сохранения черновика и публикации.';
   parent.appendChild(typingHint);
   field(parent,'Имя помощника',assistant.title,function(v){assistant.title=v;});
   field(parent,'Текст приветствия',assistant.welcome,function(v){assistant.welcome=v;},true);
   heading(parent,'Музыкальный выбор VELAR',
     'Любимая композиция — выбор помощника, а не признак публикации. Слушать можно только песню с официальной ссылкой в открытой теме или языке. Случайный выбор также ограничен опубликованными треками.');
   field(parent,'Любимая песня помощника',assistant.favoriteSongTitle,
     function(v){assistant.favoriteSongTitle=v;});
   // RUN-080: all public labels are owner-editable. The chat continues to
   // generate replies locally; these fields never create an external API.
   var labelFields=[
     ['launcher','Надпись на кнопке открытия'],
     ['greetingBubble','Текст всплывающего приветствия'],
     ['headerNote','Подпись под именем помощника (можно оставить пустой)'],
     ['greetingCloseText','Символ закрытия приветствия'],
     ['greetingCloseAria','Описание закрытия приветствия для доступности'],
     ['closeText','Символ закрытия окна чата'],
     ['closeAria','Описание закрытия чата для доступности'],
     ['dialogAria','Название окна для голосового чтения'],
     ['inputAria','Описание поля ввода для доступности'],
     ['inputPlaceholder','Подсказка внутри поля сообщения'],
     ['submit','Надпись кнопки отправки'],
     ['privacy','Строка под полем сообщения (пусто — скрыть)']
   ];
   var labelsBlock=document.createElement('details');labelsBlock.className='landing-card';
   var labelsSummary=document.createElement('summary');
   labelsSummary.textContent='Все надписи и подписи окна чата';labelsBlock.appendChild(labelsSummary);
   labelFields.forEach(function(pair){
     field(labelsBlock,pair[1],assistant.labels[pair[0]],function(v){assistant.labels[pair[0]]=v;},
       pair[0]==='greetingBubble');
   });
   parent.appendChild(labelsBlock);
   heading(parent,'Быстрые темы внизу чата',
     'Количество от 0 до 12, порядок настраивается. Надпись кнопки видна посетителю, а запрос отправляется помощнику после нажатия. Можно выбрать готовую музыкальную тему или вписать свой текст.');
   assistant.quickTopics.forEach(function(topic,index){
     var card=document.createElement('section');card.className='landing-card';
     heading(card,'Быстрая кнопка '+(index+1));
     field(card,'Надпись кнопки №'+(index+1),topic.label,function(v){topic.label=v;});
     field(card,'Запрос кнопки №'+(index+1),topic.query,function(v){topic.query=v;});
     var available=(data.genres.topics&&data.genres.topics.entries||[]).filter(function(t){
       return t.visible===true;
     });
     if(available.length){
       var themeLabel=document.createElement('label');themeLabel.className='landing-field';
       var caption=document.createElement('span');caption.textContent='Подставить опубликованную тему';themeLabel.appendChild(caption);
       var choice=document.createElement('select');choice.className='landing-artist-select';
       var placeholder=document.createElement('option');placeholder.value='';
       placeholder.textContent='Выбрать тему…';choice.appendChild(placeholder);
       available.forEach(function(t,j){
         var option=document.createElement('option');option.value=String(j);
         option.textContent=t.label;choice.appendChild(option);
       });
       choice.onchange=function(){
         if(this.value==='')return;
         var chosen=available[Number(this.value)];
         if(!chosen)return;
         topic.label=chosen.label;topic.query=chosen.label;
         render();
       };
       themeLabel.appendChild(choice);card.appendChild(themeLabel);
     }
     var actions=document.createElement('div');actions.className='landing-item-actions';
     actions.appendChild(button('↑ Выше',function(){
       if(index===0)return;
       var current=assistant.quickTopics.splice(index,1)[0];
       assistant.quickTopics.splice(index-1,0,current);render();
     }));
     actions.appendChild(button('↓ Ниже',function(){
       if(index===assistant.quickTopics.length-1)return;
       var current=assistant.quickTopics.splice(index,1)[0];
       assistant.quickTopics.splice(index+1,0,current);render();
     }));
     actions.appendChild(button('Удалить кнопку',function(){
       if(!window.confirm('Удалить быструю кнопку из черновика?'))return;
       assistant.quickTopics.splice(index,1);render();
     },'landing-danger'));
     card.appendChild(actions);parent.appendChild(card);
   });
   parent.appendChild(button('+ Добавить быструю тему',function(){
     if(assistant.quickTopics.length>=12){info('Можно добавить не более 12 быстрых тем.');return;}
     assistant.quickTopics.push({label:'Новая тема',query:'тема'});render();
   },'landing-add'));
   // RUN-080: portrait mappings are data, never hard-coded to one response.
   var avatars=assistant.avatars;
   var portraitNames=[
     ['neutral','Спокойный портрет'],['wave','Приветствие'],['morning','Доброе утро'],
     ['night','Спокойной ночи'],['thanks','Благодарность'],['heart','Сердечко / любовь'],
     ['okay','OK'],['peace','Победа'],['off','Выключение'],['celebrate','Праздник']
   ];
   function portraitOptions(){
     var values=portraitNames.slice();
     avatars.customImages.forEach(function(img,i){
       values.push(['custom'+(i+1),img.name+(img.dataUrl?' (мой JPEG)':' (не загружен)')]);
     });
     return values;
   }
   function previewPortrait(node,value){
     var index=value==='custom1'?0:value==='custom2'?1:-1;
     var image=index>=0&&avatars.customImages[index].dataUrl||'';
     node.style.backgroundImage=image?'url("'+image+'")':
       'url("../assets/dj-velar-expressions.jpg")';
     node.style.backgroundSize=image?'cover':'1000% 100%';
     node.style.backgroundPosition=image?'center':
       ((Math.max(0,portraitNames.map(function(x){return x[0];}).indexOf(value))*100/9)+'% 50%');
   }
   function portraitSelect(parent,label,value,change,allowAuto){
     var wrap=document.createElement('label');wrap.className='landing-field';
     var title=document.createElement('span');title.textContent=label;wrap.appendChild(title);
     var picker=document.createElement('select');picker.className='landing-artist-select';
     if(allowAuto){
       var automatic=document.createElement('option');automatic.value='auto';
       automatic.textContent='Автоматически по времени суток';picker.appendChild(automatic);
     }
     portraitOptions().forEach(function(pair){
       var opt=document.createElement('option');opt.value=pair[0];opt.textContent=pair[1];
       picker.appendChild(opt);
     });
     picker.value=value;
     var preview=document.createElement('span');preview.className='landing-avatar-preview';
     preview.style.display='inline-block';preview.style.width='48px';preview.style.height='48px';
     preview.style.borderRadius='50%';preview.style.backgroundRepeat='no-repeat';
     preview.style.border='1px solid #d6b379';
     previewPortrait(preview,value==='auto'?'wave':value);
     picker.onchange=function(){
       change(this.value);
       previewPortrait(preview,this.value==='auto'?'wave':this.value);
       updateButtons();
     };
     wrap.appendChild(picker);wrap.appendChild(preview);parent.appendChild(wrap);
   }
   heading(parent,'Аватарки DJ Velar',
     'Для каждого состояния выбери любую из десяти работающих картинок. Приветствие может автоматически зависеть от времени суток. Изменения появятся на сайте только после публикации.');
   portraitSelect(parent,'Аватар кнопки открытия чата',avatars.launcher,function(v){avatars.launcher=v;});
   portraitSelect(parent,'Аватар в шапке чата',avatars.header,function(v){avatars.header=v;});
   portraitSelect(parent,'Аватар при первом приветствии',avatars.greeting,
     function(v){avatars.greeting=v;},true);
   var reactions=[
     ['neutral','Обычный ответ, без эмоции'],['wave','Привет / здравствуйте'],
     ['morning','Доброе утро'],['night','Спокойной ночи'],
     ['thanks','Спасибо / благодарю'],['heart','Любовь / сердечко'],
     ['okay','ОК / согласие'],['peace','Молодец / победа'],
     ['off','Выключи / отключи'],['celebrate','Праздник / ура']
   ];
   var reactionsBlock=document.createElement('details');reactionsBlock.className='landing-card';
   var reactionsTitle=document.createElement('summary');
   reactionsTitle.textContent='Какая аватарка соответствует каждой эмоции';
   reactionsBlock.appendChild(reactionsTitle);
   reactions.forEach(function(pair){
     portraitSelect(reactionsBlock,pair[1],avatars.reactions[pair[0]],function(v){
       avatars.reactions[pair[0]]=v;
     });
   });
   parent.appendChild(reactionsBlock);
   heading(parent,'Особые реакции на слова',
     'Можно установить до 20 правил в заданном порядке. В каждом правиле выбери, искать слова в вопросе, в ответе помощника или в обоих. Первое подходящее правило определит аватар.');
   avatars.keywordRules.forEach(function(rule,index){
     var ruleCard=document.createElement('section');ruleCard.className='landing-card';
     heading(ruleCard,'Правило аватара '+(index+1));
     field(ruleCard,'Ключевые слова аватара №'+(index+1),rule.keywords,
       function(v){rule.keywords=v;},true);
     var srcLabel=document.createElement('label');srcLabel.className='landing-field';
     var srcTitle=document.createElement('span');srcTitle.textContent='Где искать слова';srcLabel.appendChild(srcTitle);
     var srcSelect=document.createElement('select');srcSelect.className='landing-artist-select';
     [['question','В вопросе посетителя'],['answer','В ответе помощника'],['both','В вопросе и ответе']].forEach(function(pair){
       var opt=document.createElement('option');opt.value=pair[0];opt.textContent=pair[1];
       srcSelect.appendChild(opt);
     });
     srcSelect.value=rule.source||'question';
     srcSelect.onchange=function(){rule.source=this.value;updateButtons();};
     srcLabel.appendChild(srcSelect);ruleCard.appendChild(srcLabel);
     portraitSelect(ruleCard,'Показывать аватар',rule.expression,function(v){rule.expression=v;});
     var actions=document.createElement('div');actions.className='landing-item-actions';
     actions.appendChild(button('↑ Выше',function(){
       if(index===0)return;
       var r=avatars.keywordRules.splice(index,1)[0];avatars.keywordRules.splice(index-1,0,r);render();
     }));
     actions.appendChild(button('↓ Ниже',function(){
       if(index>=avatars.keywordRules.length-1)return;
       var r=avatars.keywordRules.splice(index,1)[0];avatars.keywordRules.splice(index+1,0,r);render();
     }));
     actions.appendChild(button('Удалить правило',function(){
       if(!window.confirm('Удалить только из черновика?'))return;
       avatars.keywordRules.splice(index,1);render();
     },'landing-danger'));
     ruleCard.appendChild(actions);parent.appendChild(ruleCard);
   });
   parent.appendChild(button('+ Правило для аватарки',function(){
     if(avatars.keywordRules.length>=20){info('Максимум 20 правил аватаров.');return;}
     avatars.keywordRules.push({keywords:'любовь,люблю',source:'question',expression:'heart'});render();
   },'landing-add'));
   var uploadBlock=document.createElement('details');uploadBlock.className='landing-card';
   var uploadTitle=document.createElement('summary');
   uploadTitle.textContent='Загрузить собственные аватарки (2 места)';
   uploadBlock.appendChild(uploadTitle);
   var uploadInfo=document.createElement('p');uploadInfo.className='sync-note';
   uploadInfo.textContent='JPEG/PNG/WebP до 3 МБ. Сайт сам уменьшит картинку до 96×96 и JPEG примерно до 18 КБ. Оригинальные десять аватаров не удаляются.';
   uploadBlock.appendChild(uploadInfo);
   avatars.customImages.forEach(function(slot,index){
     var slotCard=document.createElement('section');slotCard.className='landing-card';
     heading(slotCard,'Дополнительный портрет '+(index+1));
     field(slotCard,'Название своего портрета №'+(index+1),slot.name,
       function(v){slot.name=v;});
     var picker=document.createElement('input');picker.type='file';
     picker.setAttribute('aria-label','Загрузить аватар '+(index+1));
     picker.accept='image/jpeg,image/png,image/webp';
     picker.onchange=function(){
       var file=this.files&&this.files[0];
       if(!file)return;
       if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>3000000){
         info('Выбери JPEG, PNG или WebP размером до 3 МБ.');return;
       }
       var reader=new FileReader();
       reader.onerror=function(){info('Не удалось прочитать картинку.');};
       reader.onload=function(){
         var image=new Image();
         image.onerror=function(){info('Этот формат изображения не удалось открыть.');};
         image.onload=function(){
           try{
             var canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;
             var ctx=canvas.getContext('2d');
             if(!ctx)throw new Error('Canvas недоступен');
             var edge=Math.min(image.width,image.height);
             var left=(image.width-edge)/2,top=(image.height-edge)/2;
             ctx.fillStyle='#fff';ctx.fillRect(0,0,96,96);
             ctx.drawImage(image,left,top,edge,edge,0,0,96,96);
             var result='';
             [0.75,0.6,0.45,0.3].some(function(quality){
               result=canvas.toDataURL('image/jpeg',quality);
               return result.length<=24000;
             });
             if(result.length>24000)throw new Error('JPEG не удалось уменьшить до 18 КБ');
             var before=slot.dataUrl;slot.dataUrl=result;
             try{API.normalize(data);}
             catch(err){slot.dataUrl=before;throw err;}
             render();info('Свой аватар '+(index+1)+' подготовлен. Сохрани черновик и опубликуй.');
           }catch(err){info('Ошибка аватарки: '+err.message);}
         };
         image.src=reader.result;
       };
       reader.readAsDataURL(file);
     };
     slotCard.appendChild(picker);
     if(slot.dataUrl){
       portraitSelect(slotCard,'Предпросмотр своего аватара',
         'custom'+(index+1),function(){});
       slotCard.appendChild(button('Убрать загруженный аватар',function(){
         if(!window.confirm('Удалить свой портрет только из черновика?'))return;
         slot.dataUrl='';render();
       },'landing-danger'));
     }
     uploadBlock.appendChild(slotCard);
   });
   parent.appendChild(uploadBlock);
   var replyFields=[
     ['emptyInput','Если пользователь не ввёл запрос'],
     ['contactEnabled','Сотрудничество: почта настроена'],
     ['contactDisabled','Сотрудничество: почта не настроена'],
     ['contactEnabledButton','Кнопка: написать автору'],
     ['contactDisabledButton','Кнопка: официальные страницы'],
     ['moodWithTracks','Тема с песнями: текст ответа'],
     ['moodWithoutTracks','Тема без песен: текст ответа'],
     ['moodButton','Кнопка: открыть музыкальную тему'],
     ['hello','Ответ на приветствие'],
     ['radio','Ответ про радио'],
     ['radioButton','Кнопка: плейлисты'],
     ['languages','Ответ про языки'],
     ['languagesButton','Кнопка: языки'],
     ['releases','Ответ про релизы'],
     ['releasesButton','Кнопка: релизы'],
     ['artists','Ответ про артистов'],
     ['artistsButton','Кнопка: артисты'],
     ['fallbackEnabled','Неизвестный запрос: почта настроена'],
     ['fallbackDisabled','Неизвестный запрос: почта не настроена'],
     ['fallbackButton','Кнопка: исследовать темы']
   ];
   var repliesBlock=document.createElement('details');repliesBlock.className='landing-card';
   var repliesSummary=document.createElement('summary');
   repliesSummary.textContent='Встроенные ответы помощника и их кнопки';
   repliesBlock.appendChild(repliesSummary);
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='В ответах о музыкальных темах {topic} — название темы, {count} — число песен. Пустая надпись кнопки действия скрывает кнопку.';
   repliesBlock.appendChild(note);
   replyFields.forEach(function(pair){
     field(repliesBlock,pair[1],assistant.replies[pair[0]],function(v){assistant.replies[pair[0]]=v;},
       pair[0].indexOf('Button')===-1);
   });
   parent.appendChild(repliesBlock);
   heading(parent,'Связь с автором',
     'Необходим публичный рабочий email. Адрес будет виден посетителям и в опубликованных данных. Пока поле пустое, бот предложит официальные страницы артистов. Письмо открывается как черновик в почте посетителя; автоматическая отправка, Telegram/WhatsApp и хранение обращений пока не включены.');
   field(parent,'Публичный email для предложений (необязательно)',assistant.contactEmail||'',function(v){
     assistant.contactEmail=v.trim();
   });
   faqEditor(parent,assistant);
   // RUN-084: original jokes in the same published assistant configuration.
   heading(parent,'Музыкальные анекдоты',
     'На слова «анекдот», «пошути», «ещё анекдот» VELAR выдаёт следующую короткую шутку. Все тексты можно менять; сообщения посетителей не собираются.');
   var jokeActive=document.createElement('label');jokeActive.className='landing-checkbox';
   var jokesOn=document.createElement('input');jokesOn.type='checkbox';
   jokesOn.checked=assistant.jokesEnabled!==false;
   jokesOn.onchange=function(){assistant.jokesEnabled=this.checked;updateButtons();};
   jokeActive.appendChild(jokesOn);
   var jokeOnText=document.createElement('span');jokeOnText.textContent='Включить музыкальные анекдоты';
   jokeActive.appendChild(jokeOnText);parent.appendChild(jokeActive);
   var jokesBlock=document.createElement('details');jokesBlock.className='landing-card';
   var jokesTitle=document.createElement('summary');
   jokesTitle.textContent='Редактировать анекдоты ('+assistant.jokes.length+')';
   jokesBlock.appendChild(jokesTitle);
   assistant.jokes.forEach(function(joke,index){
     var card=document.createElement('section');card.className='landing-card';
     field(card,'Анекдот №'+(index+1),joke,function(v){assistant.jokes[index]=v;},true);
     card.appendChild(button('Удалить анекдот',function(){
       if(!window.confirm('Удалить шутку только из черновика?'))return;
       assistant.jokes.splice(index,1);render();
     },'landing-danger'));
     jokesBlock.appendChild(card);
   });
   jokesBlock.appendChild(button('+ Добавить анекдот',function(){
     if(assistant.jokes.length>=40){info('Максимум 40 анекдотов.');return;}
     assistant.jokes.push('— Почему музыканты любят паузы? — Можно успеть выпить чай!');
     render();info('Новая шутка добавлена в черновик. Сохрани и опубликуй.');
   },'landing-add'));
   parent.appendChild(jokesBlock);
      heading(parent,'Ответы по ключевым словам',
     'Правила проверяются перед общими подсказками по музыке. Ключевые слова перечисляются через запятую; ответ виден посетителям. Не вводи сюда личные данные или секретные ключи. До 25 правил.');
   var rulesAudit=API.auditAssistantRules(assistant.rules,assistant.faq);
   var inspection=document.createElement('details');inspection.className='landing-card';
   var inspectionTitle=document.createElement('summary');
   inspectionTitle.textContent='Проверка повторов ответов ('+rulesAudit.findings.length+' замечаний)';
   inspection.appendChild(inspectionTitle);
   var summaryNote=document.createElement('p');summaryNote.className='sync-note';
   summaryNote.textContent='Равные ответы для нескольких правил: '+rulesAudit.merged+
     '; пересечения с общей базой FAQ: '+rulesAudit.overlaps+
     '; разные ответы на одно слово: '+rulesAudit.conflicts+
     '. Авторские тексты не удаляются автоматически.';
   inspection.appendChild(summaryNote);
   if(!rulesAudit.findings.length){
     var cleanNote=document.createElement('p');cleanNote.className='sync-note';
     cleanNote.textContent='Точных повторов не обнаружено. Смысловые совпадения проверяются вручную.';
     inspection.appendChild(cleanNote);
   }
   rulesAudit.findings.slice(0,30).forEach(function(message){
     var line=document.createElement('p');line.className='sync-note';
     line.textContent='• '+message;inspection.appendChild(line);
   });
   if(rulesAudit.findings.length>30){
     var more=document.createElement('p');more.className='sync-note';
     more.textContent='Показаны первые 30 замечаний из '+rulesAudit.findings.length+'.';
     inspection.appendChild(more);
   }
   var cleanRules=button('Очистить только точные повторы',function(){
     var audit=API.auditAssistantRules(assistant.rules,assistant.faq);
     if(!audit.changed){info('Точных повторов для очистки нет.');return;}
     if(!window.confirm('Объединить только одинаковые ответы и убрать точные повторы ключей? Разные авторские ответы сохранятся.'))return;
     assistant.rules=audit.rules;render();
     info('Точные повторы устранены в черновике. Разные авторские ответы и пересечения с FAQ оставлены для ручной проверки.');
   },'landing-small');
   cleanRules.disabled=!rulesAudit.changed;
   inspection.appendChild(cleanRules);
   var recommended=button('+ Добавить 6 особых ответов',function(){
     var result=API.addRecommendedAssistantRules(assistant.rules,assistant.faq);
     if(!result.added){info('Все предложенные ответы уже есть либо достигнут лимит 25 правил.');return;}
     assistant.rules=result.rules;render();
     info('Добавлено специальных ответов: '+result.added+
       '. Повторяющиеся ключи пропущены. Проверь черновик и затем опубликуй.');
   },'landing-add');
   inspection.appendChild(recommended);
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Рекомендуемые ответы: заказ песни, стихи, живая музыка на свадьбе, идея для песни, отсутствующий трек, неизданная музыка. Они добавляются только по вашему нажатию; опубликованные правила без команды не изменяются.';
   inspection.appendChild(note);
   parent.appendChild(inspection);
   assistant.rules.forEach(function(rule,index){
     var card=document.createElement('section');card.className='landing-card';
     heading(card,'Ответ '+(index+1));
     field(card,'Ключевые слова через запятую',rule.keywords||'',function(v){rule.keywords=v;},true);
     field(card,'Что ответит помощник',rule.answer||'',function(v){rule.answer=v;},true);
     card.appendChild(button('Удалить правило',function(){
       if(!window.confirm('Убрать правило только из черновика?'))return;
       assistant.rules.splice(index,1);render();
     },'landing-danger'));
     parent.appendChild(card);
   });
   parent.appendChild(button('+ Добавить ответ',function(){
     if(assistant.rules.length>=25){info('Максимум 25 правил.');return;}
     assistant.rules.push({keywords:'ключевое слово',answer:'Напишите подходящий ответ.'});
     render();
   },'landing-add'));
 }

 // RUN-115: the same owner-only artist editor, not a second admin panel.
 function artistDetailControls(card,item,index){
   var identity=item.artistId||('legacy-'+index);
   var details=document.createElement('details');
   details.className='landing-featured';
   details.open=!!openedArtistDetails[identity];
   details.addEventListener('toggle',function(){openedArtistDetails[identity]=details.open;});
   var summary=document.createElement('summary');
   summary.textContent='Персональная страница — биография и социальные сети';
   details.appendChild(summary);
   var infoLine=document.createElement('p');infoLine.className='sync-note';
   infoLine.textContent='Это публичная страница артиста, не личный кабинет. Данные редактируешь только ты; изменения появятся после сохранения черновика и отдельной публикации.';
   details.appendChild(infoLine);
   var bio=field(details,'Подробная биография / история творчества (до 5000 символов)',
     item.biography||'',function(v){item.biography=v;},true);
   bio.rows=7;
   var live=document.createElement('a');
   live.className='landing-small landing-artist-profile-link';
   live.href='../artist.html?'+(item.artistId?'id='+encodeURIComponent(item.artistId):
     'name='+encodeURIComponent(item.title||''));
   live.target='_blank';live.rel='noopener noreferrer';
   live.textContent='Открыть страницу артиста';
   details.appendChild(live);
   var platforms=[
     ['spotify','Spotify'],['youtube','YouTube'],['instagram','Instagram'],
     ['tiktok','TikTok'],['telegram','Telegram'],['facebook','Facebook'],
     ['apple','Apple Music'],['soundcloud','SoundCloud'],['bandcamp','Bandcamp'],
     ['vk','ВКонтакте'],['linkedin','LinkedIn'],['yandex','Яндекс Музыка'],['deezer','Deezer'],['website','Сайт артиста']
   ];
   heading(details,'Официальные площадки',
     'Добавляй только принадлежащие этому артисту публичные страницы. Скрытые ссылки не увидят посетители. Прямая ссылка на песню здесь не подходит — нужен профиль исполнителя.');
   if(!Array.isArray(item.socialLinks))item.socialLinks=[];
   item.socialLinks.forEach(function(link,i){
     var row=document.createElement('div');row.className='landing-card';
     var platform=document.createElement('label');platform.className='landing-field';
     var caption=document.createElement('span');caption.textContent='Площадка '+(i+1);platform.appendChild(caption);
     var select=document.createElement('select');
     platforms.forEach(function(pair){
       var option=document.createElement('option');option.value=pair[0];option.textContent=pair[1];select.appendChild(option);
     });
     select.value=link.platform||'spotify';
     select.onchange=function(){link.platform=this.value;updateButtons();};
     platform.appendChild(select);row.appendChild(platform);
     field(row,'Полная HTTPS-ссылка на профиль',link.url||'',function(v){link.url=v;});
     var check=document.createElement('label');check.className='landing-checkbox';
     var tick=document.createElement('input');tick.type='checkbox';tick.checked=link.visible===true;
     tick.onchange=function(){link.visible=this.checked;updateButtons();};
     var words=document.createElement('span');words.textContent='Показывать ссылку посетителям';
     check.appendChild(tick);check.appendChild(words);row.appendChild(check);
     row.appendChild(button('Удалить ссылку',function(){
       item.socialLinks.splice(i,1);openedArtistDetails[identity]=true;render();
     },'landing-danger'));
     details.appendChild(row);
   });
   var add=button('+ Добавить социальную сеть',function(){
     if(item.socialLinks.length>=12){info('На одного артиста допускается до 12 официальных ссылок.');return;}
     item.socialLinks.push({platform:'spotify',url:'',visible:false});
     openedArtistDetails[identity]=true;render();
   },'landing-add');
   details.appendChild(add);
   card.appendChild(details);
 }
 function cardFields(parent,key){
   var list=data[key].cards,wrap=document.createElement('div');wrap.className='landing-cards';parent.appendChild(wrap);
   list.forEach(function(item,index){
     var card=document.createElement('section');card.className='landing-card';
     heading(card,(key==='artists'?'Артист ':'Релиз ')+(index+1));
     if(key==='artists'&&item.artistId){
       var candidate=window.VMM_ARTIST_CHOICES&&window.VMM_ARTIST_CHOICES.byId(artistOptions(),item.artistId);
       var linkInfo=document.createElement('p');linkInfo.className='sync-note landing-artist-source';
       var actual=catalogLoaded&&trackLinksLoaded?catalogArtists.filter(function(t){
         return window.VMM_ARTIST_TRACKS.effective(t,trackLinks.overrides)===item.artistId;
       }).length:null;
       linkInfo.textContent='Профиль: '+item.artistId+
         (actual!==null?' · '+actual+' песен привязано на сайте':
           candidate?' · '+candidate.count+' композиций по исходным именам':' · связь с каталогом уточняется')+
         '. Изменение публичного имени не переименовывает релизы.';
       card.appendChild(linkInfo);
     }
     var tools=document.createElement('div');tools.className='landing-item-actions';
     var up=button('↑ Выше',function(){if(index<1)return;var x=list.splice(index,1)[0];list.splice(index-1,0,x);render();});
     var down=button('↓ Ниже',function(){if(index===list.length-1)return;var x=list.splice(index,1)[0];list.splice(index+1,0,x);render();});
     var remove=button('Удалить карточку',function(){
       if(!window.confirm('Удалить эту карточку из черновика? Опубликованная страница не изменится до публикации.'))return;
       list.splice(index,1);render();
     },'landing-danger');
     up.disabled=index===0;down.disabled=index===list.length-1;
     tools.appendChild(up);tools.appendChild(down);tools.appendChild(remove);card.appendChild(tools);
     field(card,key==='artists'?'Имя / название артиста':'Название релиза',item.title,function(v){item.title=v;});
     field(card,key==='artists'?'Роль / стиль':'Исполнитель',item.subtitle,function(v){item.subtitle=v;});
     field(card,'Краткое публичное описание',item.description,function(v){item.description=v;},true);
     field(card,'Публичная HTTPS-ссылка (профиль, Spotify, YouTube…) — необязательно',item.url,function(v){item.url=v;});
     if(key==='artists'){
       artistPhotoControls(card,item);
       artistDetailControls(card,item,index);
     }else {field(card,'HTTPS-ссылка на публичную обложку — необязательно',item.imageUrl,function(v){item.imageUrl=v;});releaseExtras(card,item);}
     var check=document.createElement('label');check.className='landing-checkbox';
     var checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.visible===true;
     checkbox.onchange=function(){item.visible=this.checked;updateButtons();};
     var label=document.createElement('span');label.textContent='Показывать эту карточку на главной';
     check.appendChild(checkbox);check.appendChild(label);card.appendChild(check);
     if(key==='artists'&&item.artistId){
       var trackButton=button(trackEditorArtist===item.artistId?'Свернуть список песен':'Назначить песни',function(){
         openTrackEditor(item.artistId);
       },'landing-small');
       trackButton.disabled=!catalogLoaded||!trackLinksLoaded||trackSaving;
       card.appendChild(trackButton);
       trackEditor(card,item);
       artistMusicControls(card,item);
     }
     wrap.appendChild(card);
   });
   if(key==='releases'){
     releaseCatalogPicker(parent);
     var add=button('+ Добавить релиз',function(){
       if(list.length>=12){info('В одном разделе допускается максимум 12 карточек.');return;}
       list.push(API.blankCard());render();
     },'landing-add');
     parent.appendChild(add);
   }
 }
 function preview(parent){
   heading(parent,'Предварительный просмотр содержания','Это только просмотр черновика; посетители пока видят предыдущую опубликованную версию.');
   var sections=[
     ['Первый экран',data.hero.subtitle,data.hero.intro],
     ['Артисты',data.artists.heading,data.artists.intro],
     ['Музыка и релизы',data.releases.heading,data.releases.intro],
     ['Альбомы',data.albums.heading,data.albums.intro],
     ['VELAR RADIO',data.releases.radio.title,data.releases.radio.enabled?'Радио включено · '+data.releases.radio.provider:'Радио выключено'],
     ['Жанры',data.genres.heading,data.genres.intro],
     ['Созвездия',data.genres.universe.heading,
       data.genres.universe.nodes.filter(function(n){return n.visible;}).map(function(n){return n.label;}).join(' · ')],
     ['Языковые миры',data.genres.languages.heading,
       data.genres.languages.entries.filter(function(n){return n.visible;}).map(function(n){
         return n.label+' ('+n.tracks.length+')';
       }).join(' · ')],
     ['О проекте',data.about.heading,data.about.intro]
   ];
   sections.forEach(function(s){
     var item=document.createElement('div');item.className='landing-preview-section';
     var kicker=document.createElement('small');kicker.textContent=s[0];item.appendChild(kicker);
     var h=document.createElement('h4');h.textContent=s[1];item.appendChild(h);
     var p=document.createElement('p');p.textContent=s[2];item.appendChild(p);
     if(s[0]==='Артисты'||s[0]==='Музыка и релизы'){
       var rows=s[0]==='Артисты'?data.artists.cards:data.releases.cards;
       var visible=rows.filter(function(x){return x.visible;});
       var sub=document.createElement('small');
       sub.textContent=visible.length?visible.map(function(x){return x.title||'Без названия';}).join(' · '):'Пока нет опубликованных карточек — сохранится блок «Скоро».';
       item.appendChild(sub);
     }
     if(s[0]==='Жанры'){
       var note=document.createElement('small');note.textContent=data.genres.tags.join(' · ');item.appendChild(note);
     }
     if(s[0]==='О проекте'){
       var notice=document.createElement('small');notice.textContent=data.about.notice;item.appendChild(notice);
     }
     parent.appendChild(item);
   });
 }

 // RUN-183: owner-managed social footer; disabled by default, never auto-publish.
 function siteSocialEditor(parent){
   if(!data.hero.socialBar)data.hero.socialBar={enabled:false,shareEnabled:false,links:[]};
   var cfg=data.hero.socialBar;
   if(!Array.isArray(cfg.links))cfg.links=[];
   var block=document.createElement('section');block.className='landing-display-group';
   heading(block,'Социальные сети и «Поделиться»',
     'Нижняя панель сайта. Пока выключена: ты сам добавляешь официальные ссылки, сохраняешь черновик, публикуешь и отдельно включаешь показ. Работает и в приложении на iPhone/iPad.');
   function checkbox(label,key){
     var line=document.createElement('label');line.className='landing-checkbox';
     var input=document.createElement('input');input.type='checkbox';input.checked=cfg[key]===true;
     input.onchange=function(){cfg[key]=this.checked;updateButtons();};
     var text=document.createElement('span');text.textContent=label;
     line.appendChild(input);line.appendChild(text);block.appendChild(line);
   }
   checkbox('Показывать нижнюю панель на сайте','enabled');
   checkbox('Показывать в панели кнопку «Поделиться сайтом»','shareEnabled');
   var choices=[['facebook','Facebook'],['vk','ВКонтакте'],['instagram','Instagram'],
     ['tiktok','TikTok'],['linkedin','LinkedIn'],['youtube','YouTube'],
     ['telegram','Telegram'],['spotify','Spotify'],['apple','Apple Music'],
     ['soundcloud','SoundCloud'],['bandcamp','Bandcamp'],['yandex','Яндекс Музыка'],
     ['deezer','Deezer'],['website','Внешний сайт']];
   cfg.links.forEach(function(link,i){
     var item=document.createElement('div');item.className='landing-card';
     selectField(item,'Площадка '+(i+1),choices,link.platform||'facebook',function(v){link.platform=v;});
     field(item,'Полная HTTPS-ссылка на официальный профиль',link.url||'',function(v){link.url=v;});
     var check=document.createElement('label');check.className='landing-checkbox';
     var tick=document.createElement('input');tick.type='checkbox';tick.checked=link.visible===true;
     tick.onchange=function(){link.visible=this.checked;updateButtons();};
     var caption=document.createElement('span');caption.textContent='Показывать эту ссылку';check.appendChild(tick);check.appendChild(caption);item.appendChild(check);
     item.appendChild(button('Удалить ссылку',function(){cfg.links.splice(i,1);render();},'landing-danger'));
     block.appendChild(item);
   });
   block.appendChild(button('+ Добавить площадку',function(){
     if(cfg.links.length>=12){info('Максимум 12 официальных ссылок.');return;}
     cfg.links.push({platform:'facebook',url:'',visible:false});render();
   },'landing-add'));
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Незаполненные и скрытые ссылки не отображаются. «Поделиться» использует системное меню устройства, а при его отсутствии — копирование адреса. Подключения к аккаунтам соцсетей и автопубликации нет.';
   block.appendChild(note);parent.appendChild(block);
 }

 // RUN-184: curator-approved public aggregates, independent of the private overview.
 function publicProgressEditor(parent){
   if(!data.about.progress)data.about.progress=API.defaults().about.progress;
   var p=data.about.progress;
   var section=document.createElement('section');section.className='landing-display-group';
   heading(section,'Публичная статистика музыкальной коллекции',
     'Счётчики для посетителей под описанием проекта. Сайт НЕ читает приватный каталог: только выбранные числа, опубликованные тобой. «Готовность ссылок» не означает готовность всего сайта.');
   function toggle(label,obj,key){
     var row=document.createElement('label');row.className='landing-checkbox';
     var check=document.createElement('input');check.type='checkbox';check.checked=obj[key]===true;
     check.onchange=function(){obj[key]=this.checked;updateButtons();};
     var caption=document.createElement('span');caption.textContent=label;
     row.appendChild(check);row.appendChild(caption);section.appendChild(row);
   }
   function numberControl(host,label,obj,key){
     var row=document.createElement('label');row.className='landing-field';
     var caption=document.createElement('span');caption.textContent=label;row.appendChild(caption);
     var input=document.createElement('input');input.type='number';input.min='0';input.max='1000000';input.step='1';
     input.value=String(obj[key]||0);input.setAttribute('aria-label',label);
     input.oninput=function(){
       if(this.value==='')return;
       var n=Number(this.value);if(isFinite(n)&&n>=0&&n<=1000000&&Math.floor(n)===n){obj[key]=n;updateButtons();}
     };
     row.appendChild(input);host.appendChild(row);
   }
   toggle('Показывать статистику посетителям',p,'enabled');
   field(section,'Заголовок публичного блока',p.title||'',function(v){p.title=v;});
   field(section,'Пояснение под заголовком',p.intro||'',function(v){p.intro=v;},true);
   var tip=document.createElement('p');tip.className='sync-note';
   tip.textContent='Заполни показатели вручную либо однократно возьми итоговые числа из защищённого каталога. Кнопка не публикует данные и не передаёт названия/ссылки песен.';
   section.appendChild(tip);
   section.appendChild(button('↻ Заполнить числа из каталога',function(){
     if(!loaded||busy||!navigator.onLine){info('Нужны интернет и доступ к каталогу администратора.');return;}
     info('Читаем только итоговые числа из защищённого каталога…');
     loadCatalogArtists(true).then(function(){
       if(!catalogLoaded){info('Каталог пока не загружен; числа не изменены.');return;}
       var stats={songs:catalogArtists.length,spotify:0,appleMusic:0,youtube:0};
       catalogArtists.forEach(function(song){
         var links=song.links||{};
         ['spotify','appleMusic','youtube'].forEach(function(k){
           if(typeof links[k]==='string'&&/^https:\/\//i.test(links[k]))stats[k]++;
         });
       });
       var count=stats.spotify+stats.appleMusic+stats.youtube;
       var values=[stats.songs,count,stats.spotify,stats.appleMusic,stats.youtube];
       var labels=['Композиции в каталоге','Ссылки на площадки','Spotify','Apple Music','YouTube'];
       labels.forEach(function(label,i){
         var row=(p.metrics||[]).filter(function(x){return x.label===label;})[0];
         if(row)row.value=values[i];
         else if(p.metrics.length<12)p.metrics.push({label:label,value:values[i],visible:true});
       });
       p.completed=count;p.total=stats.songs*3;
       p.updatedAt=new Date().toISOString().slice(0,10);
       render();info('В черновик перенесены только суммарные числа: '+stats.songs+
         ' песен, '+count+' ссылок. Перед публикацией проверь видимость и добавь сведения о будущих альбомах вручную.');
     }).catch(function(e){info('Не удалось обновить статистику: '+safeStatus(e));});
   },'landing-small'));
   (p.metrics||[]).forEach(function(metric,i){
     var row=document.createElement('div');row.className='landing-card';
     field(row,'Название показателя '+(i+1),metric.label||'',function(v){metric.label=v;});
     numberControl(row,'Значение',metric,'value');
     var check=document.createElement('label');check.className='landing-checkbox';
     var tick=document.createElement('input');tick.type='checkbox';tick.checked=metric.visible===true;
     tick.onchange=function(){metric.visible=this.checked;updateButtons();};
     var title=document.createElement('span');title.textContent='Показать этот показатель';
     check.appendChild(tick);check.appendChild(title);row.appendChild(check);
     row.appendChild(button('Удалить показатель',function(){p.metrics.splice(i,1);render();},'landing-danger'));
     section.appendChild(row);
   });
   section.appendChild(button('+ Добавить свой показатель',function(){
     if(p.metrics.length>=12){info('Допускается до 12 публичных показателей.');return;}
     p.metrics.push({label:'Новый показатель',value:0,visible:false});render();
   },'landing-add'));
   toggle('Показывать полосу готовности ссылок',p,'showBar');
   field(section,'Название полосы готовности',p.barLabel||'',function(v){p.barLabel=v;});
   numberControl(section,'Ссылок заполнено',p,'completed');
   numberControl(section,'Всего возможных ссылок (число песен × 3)',p,'total');
   var capacityHint=document.createElement('p');capacityHint.className='sync-note';
   capacityHint.textContent='Одна песня может иметь 3 ссылки: Spotify, Apple Music, YouTube. Например: 280 песен × 3 = 840 возможных ссылок. 682 из 840 = 81%.';
   section.appendChild(capacityHint);
   var autoCapacity=button('Рассчитать максимум по числу песен × 3',function(){
     var songs=null;
     (p.metrics||[]).forEach(function(m){if(m.label==='Композиции в каталоге')songs=m.value;});
     if(typeof songs!=='number'||songs<0||Math.floor(songs)!==songs){
       info('Укажи число композиций в показателе «Композиции в каталоге».');return;
     }
     p.total=songs*3;render();
     info('Максимум ссылок: '+songs+' × 3 = '+p.total+'. Сохрани черновик и затем опубликуй.');
   },'landing-small');
   section.appendChild(autoCapacity);
   field(section,'Что ещё готовится к публикации',p.note||'',function(v){p.note=v;},true);
   field(section,'Дата снимка (YYYY-MM-DD, можно оставить пустой)',p.updatedAt||'',function(v){p.updatedAt=v;});
   var foot=document.createElement('p');foot.className='sync-note';
   foot.textContent='Важно: это публичный снимок, а не живой доступ к Firebase. После пополнения каталога повтори обновление чисел, сохрани черновик и отдельно опубликуй. Счётчики «альбомы» и «готовятся» заполняются вручную, если нет надёжного статуса в базе.';
   section.appendChild(foot);parent.appendChild(section);
 }

 // RUN-186: telemetry preferences are owner-only draft/published settings.
 // Collection is deliberately blocked until an authenticated aggregation service
 // is deployed; UI must never invent visit/play totals.
 function analyticsEditor(parent){
   if(!data.hero.analytics)data.hero.analytics=API.defaults().hero.analytics;
   var a=data.hero.analytics,section=document.createElement('section');
   section.className='landing-display-group';
   heading(section,'Счётчик посещений и интереса к песням',
     'Посетителей о разрешении спрашивает помощник DJ Velar в первом открытии чата. До согласия Google Analytics не загружается. Отказ не ограничивает музыку, IP для запоминания ответа не используется.');
   function check(label,key){
     var row=document.createElement('label');row.className='landing-checkbox';
     var input=document.createElement('input');input.type='checkbox';input.checked=a[key]===true;
     input.onchange=function(){a[key]=this.checked;updateButtons();};
     var name=document.createElement('span');name.textContent=label;
     row.appendChild(input);row.appendChild(name);section.appendChild(row);
   }
   check('Включить GA4 (G-ZD640V3VQ1) с добровольным согласием через помощника Velar','enabled');
   check('Разрешить показ публичного счётчика (отдельно от сбора данных)','showPublic');
   check('Показывать посещения сайта','showVisits');
   check('Показывать открытия музыкальных плееров','showActions');
   check('Показывать рейтинг популярных треков','showTopTracks');
   field(section,'Заголовок публичного блока',a.title,function(v){a.title=v;});
   selectField(section,'Планируемый срок для собственного сервера (не изменяет хранение GA4)',
     [['30','30 дней'],['90','90 дней'],['180','180 дней']],String(a.retentionDays||90),
     function(v){a.retentionDays=Number(v);});
   var status=document.createElement('p');status.className='sync-note';
   status.textContent='Поток GA4 G-ZD640V3VQ1 готов. Чтобы начать измерять визиты, включи сбор, сохрани и опубликуй. DJ Velar предложит посетителю разрешить или отклонить аналитику; без выбора Google-тег не загружается. Отчёты доступны в Google Analytics → В реальном времени. Счётчики в админке и на публичной странице пока не подключены — настройки их видимости зарезервированы.';
   section.appendChild(status);
   // RUN-191: real visit/event reports remain in owner's GA4 console, not
   // the consent control at the public footer. This is a navigational link.
   var reports=document.createElement('a');
   reports.href='https://analytics.google.com/';
   reports.target='_blank';
   reports.rel='noopener noreferrer';
   reports.className='landing-add';
   reports.textContent='Открыть отчёты Google Analytics';
   reports.style.cssText='display:inline-block;margin:12px 0;padding:12px 16px;text-decoration:underline';
   section.appendChild(reports);
   var help=document.createElement('p');help.className='sync-note';
   help.textContent='Для первых событий: Google Analytics → Отчёты → В реальном времени. В этом разделе Studio пока нет отдельной таблицы с реальными посещениями; кнопка на сайте «Настройки статистики» служит только для согласия посетителей.';
   section.appendChild(help);
   var explain=document.createElement('p');explain.className='sync-note';
   explain.textContent='События GA4: page_view, velar_player_open, velar_radio_open, velar_radio_next, velar_youtube_start. Посетитель может отозвать согласие через «Настройки статистики» внизу сайта. Для песенных рейтингов потребуются настройки отчётов GA4 и сопоставление ID песен; открытие внешнего плеера не означает завершённое прослушивание.';
   section.appendChild(explain);
   parent.appendChild(section);
 }

 // RUN-181: all homepage display choices live in ONE place.
 // Artist profile settings are intentionally not here: they belong to Artists.
 function motionFields(block,settings){
   selectField(block,'Направление движения карточек',[['right','Справа налево'],['left','Слева направо']],settings.direction||'right',function(v){settings.direction=v;});
   selectField(block,'В конце подборки',[['loop','По кругу'],['swing','Маятник']],settings.end||'loop',function(v){settings.end=v;});
   var label=document.createElement('label'),caption=document.createElement('span'),speed=document.createElement('input');
   speed.type='range';speed.min='1';speed.max='100';speed.value=settings.speed||35;
   function update(){caption.textContent='Скорость '+speed.value+'%';}
   update();speed.oninput=function(){settings.speed=Number(speed.value);update();updateButtons();};
   label.appendChild(caption);label.appendChild(speed);block.appendChild(label);
 }
 function homepageDisplaySettings(parent){
   var headingBlock=document.createElement('section');
   headingBlock.className='landing-display-settings';
   heading(headingBlock,'Оформление блоков главной страницы',
     'Здесь собраны все способы показа песен посетителям на главной. Каждый блок независим. Для длинных подборок рекомендуется компактный список с поиском и страницами.');
   selectField(headingBlock,'Вид главной страницы',[['classic','Классический'],['compact','Компактный']],data.hero.skin||'classic',function(v){
     data.hero.skin=v;
   });
   var sourceArea=document.createElement('div');
   headingBlock.appendChild(sourceArea);
   var source=selectField(sourceArea,'Источник главной песни',
     [['all','Все песни'],['genres','Жанры'],['topics','Темы'],['languages','Языки'],['artists','Артисты'],['albums','Альбомы']],
     data.hero.featureSource||'all',function(value){
       data.hero.featureSource=value;data.hero.featureGroup='';render();
     });
   // Options are derived from the same live catalog used by the public selector.
   var sourceRows=API.featuredSourceGroups(data,source.value);
   if(source.value!=='all'){
     var groupOptions=sourceRows.filter(function(row){return row.visible!==false;}).map(function(row){
       return [String(row.id||row.slug||row.code||''),row.label||row.title||row.name||'Без названия'];
     }).filter(function(row){return row[0];});
     selectField(sourceArea,'Выбрать '+({
       genres:'жанр',topics:'тему',languages:'язык',artists:'артиста',albums:'альбом'
     }[source.value]||'раздел'),[['','Все доступные в разделе']].concat(groupOptions),data.hero.featureGroup||'',function(value){
       data.hero.featureGroup=value;render();
     });
     if(data.hero.featureGroup&&!groupOptions.some(function(row){return row[0]===data.hero.featureGroup;})){
       var warning=document.createElement('p');
       warning.textContent='Ранее выбранный раздел больше недоступен. Выберите другой источник.';
       sourceArea.appendChild(warning);
     }
   }
   sourceArea.hidden=(data.hero.featureMode||'random')!=='list';
   var songs=API.homepageSongs(data).sort(compareSong);
   var modes=[['random','Случайная при открытии страницы'],['fixed','Выбранная песня'],['rotate','Случайная со сменой по таймеру'],['list','Случайная из списка песен']];
   var mode=selectField(headingBlock,'Главная песня компактного вида',modes,data.hero.featureMode||'random',function(value){
     data.hero.featureMode=value;
     sourceArea.hidden=value!=='list';
     showSongSettings();
   });
   // Keep dependent controls directly below the fourth mode selector.
   headingBlock.insertBefore(sourceArea,mode.parentNode.nextSibling);
   var songOptions=songs.map(function(song){return [song.url,song.title+(song.artist?' — '+song.artist:'')];});
   var selected=songs.filter(function(song){return [song.url,song.alternateUrl,song.thirdUrl].indexOf(data.hero.featureUrl)>=0;})[0];
   var fixedFields=document.createElement('div');headingBlock.appendChild(fixedFields);
   selectField(fixedFields,'Песня из каталога',[['','Первая доступная песня']].concat(songOptions),selected?selected.url:'',function(value){data.hero.featureUrl=value;});
   var dailyFields=document.createElement('div');headingBlock.appendChild(dailyFields);
   selectField(dailyFields,'Случайная песня',[['open','Новая при открытии'],['day','Одна на весь день']],data.hero.featureDaily?'day':'open',function(v){data.hero.featureDaily=v==='day';});
   var timerFields=document.createElement('div');headingBlock.appendChild(timerFields);
   selectField(timerFields,'Менять песню каждые',[1,5,15,30,60].map(function(n){return [String(n),n+' мин'];}),String(data.hero.featureMinutes||5),function(value){data.hero.featureMinutes=Number(value);});
   function showSongSettings(){
     fixedFields.hidden=mode.value!=='fixed';
     timerFields.hidden=mode.value!=='rotate';
     dailyFields.hidden=mode.value!=='random'&&mode.value!=='list';
   }
   showSongSettings();
   var artistBlock=document.createElement('section');artistBlock.className='landing-display-group';
   heading(artistBlock,'Артисты на главной',
     'Только подборка «Лучшие песни» рядом с карточками артистов. Отдельная страница артиста настраивается в разделе «Артисты».');
   var featured=data.artists.songViewMode==='auto'?'auto':data.artists.songViewMode==='carousel'?'carousel':data.artists.featuredView||'classic';
   selectField(artistBlock,'Показ лучших песен на главной',
     [['classic','Компактные строки'],['covers','Строки с обложками'],
      ['tiles','Квадратные карточки'],['carousel','Карусель'],['auto','Автокарусель']],featured,function(v){
       if(v==='carousel'||v==='auto'){data.artists.songViewMode=v;}
       else{data.artists.songViewMode='standard';data.artists.featuredView=v;}
     });
   data.artists.cards.forEach(function(artist){
     var details=document.createElement('details'),summary=document.createElement('summary');
     summary.textContent=artist.title||'Артист';details.appendChild(summary);
     [['homeDisplay','На главной'],['profileDisplay','В профиле артиста']].forEach(function(row){
       var key=row[0];
       selectField(details,row[1],[['','Как в общем оформлении'],['rows','Список'],['carousel','Карусель'],['auto','Автокарусель']],artist[key]||'',function(v){artist[key]=v;});
       motionFields(details,artist[key+'Motion']||(artist[key+'Motion']={}));
     });
     artistBlock.appendChild(details);
   });
   headingBlock.appendChild(artistBlock);
   var clips=document.createElement('section');clips.className='landing-display-group';
   heading(clips,'Видеоклипы','Карточки видео в разделе «Релизы и видеоклипы».');
   selectField(clips,'Показ видеоклипов',[['grid','Обычные карточки'],['carousel','Карусель'],['auto','Автокарусель']],data.releases.videoView||'auto',function(v){data.releases.videoView=v;});
   motionFields(clips,data.releases.videoMotion||(data.releases.videoMotion={}));
   headingBlock.appendChild(clips);
   if(!data.genres.displayModes)data.genres.displayModes={};
   var choices=[['compact','Компактный список · поиск · страницы по 25'],
     ['rows','Обычный список'],['covers','Строки с обложками'],
     ['tiles','Квадратные карточки'],['carousel','Карусель'],['auto','Автокарусель']];
   [['genres','Жанры'],['topics','Темы песен'],['languages','Языки песен'],
    ['albums','Песни в альбомах']].forEach(function(entry){
     var block=document.createElement('section');block.className='landing-display-group';
     heading(block,entry[1],entry[0]==='albums'?
       'Только песни внутри альбома после раскрытия. Обложки самих альбомов настраиваются ниже.':
       'Вид песен после выбора '+(entry[0]==='languages'?'языка':entry[0]==='topics'?'темы':'жанра')+'.');
     var selected=data.genres.displayModes[entry[0]]||
       (data.genres.songViewMode==='carousel'?'carousel':data.albums.trackView||'rows');
     selectField(block,'Показ: '+entry[1],choices,selected,function(v){
       data.genres.displayModes[entry[0]]=v;
     });
     var motion=data.genres.motion||(data.genres.motion={});
     motionFields(block,motion[entry[0]]||(motion[entry[0]]={}));
     headingBlock.appendChild(block);
   });
   var albums=document.createElement('section');albums.className='landing-display-group';
   heading(albums,'Обложки альбомов',
     'Отдельно от песен внутри альбома.');
   selectField(albums,'Вид альбомов',
     [['grid','Сетка квадратных обложек'],['list','Список: обложка и описание']],
     data.albums.view||'grid',function(v){data.albums.view=v;});
   headingBlock.appendChild(albums);
   var warn=document.createElement('p');warn.className='sync-note';
   warn.textContent='Изменения сначала сохрани в черновике, затем опубликуй.';
   headingBlock.appendChild(warn);parent.appendChild(headingBlock);
 }

 // RUN-182: admin-only, explicit, read-only live scan. The result remains
 // local until the owner clicks "Apply", saves the draft, and publishes.
 function existingLinkAuditEditor(parent){
   var box=document.createElement('section');box.className='landing-display-group';
   heading(box,'Сверка уже добавленных музыкальных ссылок',
     'Сравнивает опубликованные подборки черновика с текущим приватным каталогом Firebase. Проверяет совпадения по точным Spotify/YouTube/Apple Music ID, а не по похожим названиям. Интернет-поиск новых треков не выполняется.');
   var scan=button(linksAuditLoading?'Сканирование…':'Проверить все прикреплённые песни',function(){
     if(linksAuditLoading||busy||!loaded||navigator.onLine===false){
       info('Для сверки требуется открытый редактор, интернет и доступ администратора.');
       return;
     }
     var signature;
     try{signature=JSON.stringify(API.normalize(data));}
     catch(err){info('Сначала исправь данные черновика: '+err.message);return;}
     if(!window.VMM_EXISTING_LINKS){info('Модуль сверки не загрузился. Перезагрузи Studio.');return;}
     linksAuditLoading=true;linksAudit=null;linksAuditSignature='';
     render();info('Читаем только приватный каталог Firebase для сравнения ссылок…');
     var owner=uid;
     authorized().then(function(auth){
       if(auth.user.uid!==owner)throw new Error('Пользователь сменился.');
       return auth.db.collection('vmm_catalog').limit(1200).get({source:'server'});
     }).then(function(snapshot){
       if(uid!==owner)throw new Error('Пользователь сменился.');
       if(JSON.stringify(API.normalize(data))!==signature)
         throw new Error('Редактор изменился во время сканирования. Повтори проверку.');
       var rows=[];snapshot.forEach(function(doc){
         var song=doc.data()||{};song.id=doc.id;rows.push(song);
       });
       linksAudit=window.VMM_EXISTING_LINKS.audit(data,rows,API);
       linksAuditSignature=signature;
       info('Сверка готова: '+linksAudit.summary.addedLinks+
         ' отсутствующих привязок найдены среди уже существующих ссылок.');
     }).catch(function(err){linksAudit=null;info('Сверка не выполнена: '+safeStatus(err));})
       .then(function(){linksAuditLoading=false;if(uid===owner&&tab==='publish')render();});
   },'landing-small');
   scan.disabled=linksAuditLoading||busy;
   box.appendChild(scan);
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Сканирование ничего не записывает. Уверенные совпадения можно перенести только в черновик, затем отдельно сохранить и опубликовать. Неоднозначные записи остаются без изменений.';
   box.appendChild(note);
   if(linksAudit){
     var stats=linksAudit.summary;
     var counter=document.createElement('p');counter.className='sync-note';
     counter.textContent='В текущем каталоге: '+stats.catalogSongs+
       ' песен · проверено прикреплённых строк: '+stats.linked+
       ' · можно дополнить песен: '+stats.addedSongs+
       ' · добавить кнопок площадок: '+stats.addedLinks+
       ' · не найдено в каталоге: '+stats.unmatched+
       ' · неоднозначно: '+stats.ambiguous+
       ' · конфликт источников: '+stats.conflict+
       ' · привязок жанров по ID: '+stats.genreIds+
       ' (обновляются при публикации автоматически).';
     box.appendChild(counter);
     var by=Object.keys(stats.bySection).filter(function(k){return stats.bySection[k].improved>0;});
     by.slice(0,25).forEach(function(k){
       var item=document.createElement('p');item.className='sync-note';
       item.textContent=k+': '+stats.bySection[k].newLinks+' новых значков';
       box.appendChild(item);
     });
     if(stats.examples.length){
       var examples=document.createElement('div');examples.className='landing-link-audit-examples';
       var subtitle=document.createElement('p');subtitle.className='sync-note';
       subtitle.textContent='Примеры добавлений (первые '+stats.examples.length+'):';
       examples.appendChild(subtitle);
       stats.examples.forEach(function(row){
         var item=document.createElement('p');item.className='sync-note';
         item.textContent=row.section+' — '+row.title+' → '+row.added;
         examples.appendChild(item);
       });
       box.appendChild(examples);
     }
     var buttonApply=button('Перенести точные совпадения в черновик',function(){
       if(!linksAudit||!linksAudit.summary.addedLinks)return;
       try{
         if(JSON.stringify(API.normalize(data))!==linksAuditSignature){
           info('Данные поменялись после сверки. Запусти сканирование заново.');return;
         }
         if(!window.confirm('Дополнить '+linksAudit.summary.addedSongs+
           ' прикреплённых песен '+linksAudit.summary.addedLinks+
           ' уже существующими ссылками? Будет изменён только НЕСОХРАНЁННЫЙ черновик, не каталог и не опубликованный сайт.'))return;
         data=clone(linksAudit.next);linksAudit=null;linksAuditSignature='';
         render();info('Точные ссылки перенесены в черновик. Теперь нажми «Сохранить черновик», затем «Опубликовать».');
       }catch(e){info('Применение остановлено: '+e.message);}
     },'landing-add');
     buttonApply.disabled=!stats.addedLinks;box.appendChild(buttonApply);
   }
   parent.appendChild(box);
 }
 function render(){
   var host=id('landing-fields');if(!host)return;
   clear(host);
   var panel=document.createElement('div');panel.className='landing-editor-panel';host.appendChild(panel);
   if(tab==='hero'){
     heading(panel,'Первый экран','Эмблема, название VELARDREAM и кнопки остаются частью оформления сайта; здесь меняются подпись и вступление.');
     field(panel,'Подзаголовок',data.hero.subtitle,function(v){data.hero.subtitle=v;});
     field(panel,'Основное описание',data.hero.intro,function(v){data.hero.intro=v;},true);
     // RUN-123: on-site image load testing. Saving and publication remain separate.
     var loadPanel=document.createElement('section');loadPanel.className='landing-loading-controls';
     heading(loadPanel,'Загрузка изображений и разделов',
       'Регулируй отложенную загрузку: первые обложки появляются быстро, остальные — по выбранной степени.');
     var loadLabel=document.createElement('label');loadLabel.className='landing-loading-label';
     var loadTitle=document.createElement('span');loadTitle.textContent='Степень ленивой загрузки';
     loadLabel.appendChild(loadTitle);
     var loadSlider=document.createElement('input');loadSlider.type='range';
     loadSlider.min='0';loadSlider.max='3';loadSlider.step='1';
     var loadNames=['0 · Выключена — всё сразу','1 · Лёгкая — первые 4 сразу',
       '2 · Умеренная — первые 2 сразу','3 · Сильная — первая сразу'];
     var loadHints=[
       'Все показанные картинки и официальные обложки запрашиваются немедленно.',
       'После первых четырёх картинок в каждой группе браузер управляет загрузкой остальных.',
       'После первых двух картинок остальные загружаются лениво; поиск внешних обложек стартует вблизи экрана.',
       'После первой картинки в каждой группе остальные откладываются; поиск внешних обложек начинается ближе к экрану.'
     ];
     var loadValue=document.createElement('strong');loadValue.className='landing-loading-value';
     loadValue.setAttribute('aria-live','polite');
     var loadHelp=document.createElement('p');loadHelp.className='sync-note landing-loading-help';
     var loadTest=document.createElement('a');loadTest.className='landing-small landing-preview-link';
     loadTest.textContent='Проверить выбранный режим на сайте';
     loadTest.target='_blank';loadTest.rel='noopener noreferrer';
     function updateLoadLabel(){
       var n=Number(loadSlider.value);if(n<0||n>3||n!==Math.floor(n))n=0;
       loadValue.textContent=loadNames[n];loadHelp.textContent=loadHints[n]+[' Разделы открываются сразу.',' Разделы подготавливаются за два экрана.',' Разделы подготавливаются за экран.',' Разделы подготавливаются непосредственно перед появлением.'][n];
       loadTest.href='../?imageLoadingTest='+n;
       loadSlider.setAttribute('aria-valuetext',loadNames[n]);
     }
     loadSlider.value=String(data.hero.imageLoadingLevel||0);
     loadSlider.setAttribute('aria-label','Степень ленивой загрузки изображений и разделов, от 0 до 3');
     loadSlider.oninput=function(){
       data.hero.imageLoadingLevel=Number(this.value);updateLoadLabel();updateButtons();
     };
     loadSlider.onchange=loadSlider.oninput;
     loadLabel.appendChild(loadSlider);loadLabel.appendChild(loadValue);
     loadPanel.appendChild(loadLabel);loadPanel.appendChild(loadHelp);loadPanel.appendChild(loadTest);
     var loadNotice=document.createElement('p');loadNotice.className='sync-note';
     loadNotice.textContent='Тестовая ссылка меняет загрузку только в открывшейся вкладке, без публикации. Для всех посетителей сохрани черновик и отдельно опубликуй. Эмблемы и музыкальные плееры не затрагиваются.';
     loadPanel.appendChild(loadNotice);
     // RUN-125: independent of all four lazy-loading modes.
     selectField(loadPanel,'Приоритет источников обложек',
       [['spotify-first','Spotify → YouTube (по умолчанию)'],
        ['youtube-first','YouTube → Spotify']],
       data.hero.coverSourcePriority||'spotify-first',
       function(choice){data.hero.coverSourcePriority=choice;});
     var coverNotice=document.createElement('p');coverNotice.className='sync-note';
     coverNotice.textContent='Обложка, загруженная вручную, имеет высший приоритет. При отказе источника используется второй, затем значок ♫. Сохрани черновик и опубликуй, чтобы изменить настройки для посетителей.';
     loadPanel.appendChild(coverNotice);panel.appendChild(loadPanel);
     updateLoadLabel();
     homepageDisplaySettings(panel);
     siteSocialEditor(panel);
   }else if(tab==='distribution'){
     if(window.VMM_SONG_DISTRIBUTION){
       var distributionContext={
         loaded:catalogLoaded&&trackLinksLoaded,
         catalog:catalogArtists,draft:data,published:published,links:trackLinks,
         API:API,artistEffective:function(song,overrides){
           return window.VMM_ARTIST_TRACKS.effective(song,overrides);
         },
         onLoad:function(){catalogLoaded=false;loadCatalogArtists(true);},
         blocked:function(){return busy||offlineConflict||offlineSyncing||trackSaving;},
         onModify:function(action){
           if(busy||offlineConflict||offlineSyncing||trackSaving)
             throw new Error('Сначала заверши синхронизацию или разреши конфликт.');
           // Validate on a copy FIRST: invalid or oversized landing documents
           // must not poison the owner's real draft/offline outbox.
           var next=clone(data);
           var changed=window.VMM_SONG_DISTRIBUTION.modify(catalogArtists,next,action,API,
             function(song,overrides){return window.VMM_ARTIST_TRACKS.effective(song,overrides);},
             trackLinks);
           if(changed){
             API.normalize(next);
             data=next;distributionContext.draft=data;
             updateButtons();info('Назначение изменено в черновике. Сохрани его и отдельно опубликуй.');
           }
           return changed;
         }
       };
       window.VMM_SONG_DISTRIBUTION.render(panel,distributionContext);
     }else heading(panel,'Распределение песен','Модуль пока не загружен. Обнови ресурсы Studio.');
   }else if(tab==='artists'||tab==='releases'){
     heading(panel,tabs[tab],tab==='artists'?'Профили артистов публикуются только после включения галочки.':'Добавляй только ссылки на публичные релизы, без приватных фонограмм и текстов.');
     sectionFields(panel,tab);
     if(tab==='artists'){
       artistPicker(panel);
       var profilePresentation=document.createElement('section');
       profilePresentation.className='landing-display-group';
       heading(profilePresentation,'Отдельная страница артиста',
         'Только профиль, который посетитель открывает кнопкой «Подробнее». Оформление артистов на главной странице регулируется в «Оформление главной».');
       selectField(profilePresentation,'Песни в профиле артиста',
         [['compact','Компактный список с поиском (рекомендуется)'],
          ['covers','Строки с обложками'],['tiles','Карточки с обложками']],
         data.artists.detailTrackView||'compact',function(v){data.artists.detailTrackView=v;});
       var separateNote=document.createElement('p');separateNote.className='sync-note';
       separateNote.textContent='Одна композиция — одна карточка; Spotify, YouTube и Apple Music — значки под названием. Профиль показывает опубликованные лучшие песни (до 30), не читая закрытый каталог.';
       profilePresentation.appendChild(separateNote);panel.appendChild(profilePresentation);
     }
     cardFields(panel,tab);
   }else if(tab==='albums'){
     albumsEditor(panel);
   }else if(tab==='playlists'){
     playAndFollowEditor(panel);
   }else if(tab==='radio'){
     radioEditor(panel);
   }else if(tab==='universe'){
     universeEditor(panel);
   }else if(tab==='languages'){
     languageEditor(panel);
   }else if(tab==='topics'){
     topicEditor(panel);
   }else if(tab==='assistant'){
     assistantEditor(panel);
   }else if(tab==='genres'){
     genreEditor(panel);
   }else if(tab==='analytics'){
     // Prevent an empty admin tab if a legacy offline draft lacks hero.analytics.
     heading(panel,'Статистика посещений',
       'GA4 G-ZD640V3VQ1 · Сбор включается в Studio и только после согласия гостя через DJ Velar.');
     try{analyticsEditor(panel);}
     catch(err){
       var message=document.createElement('p');message.className='sync-note';
       message.textContent='Настройки не удалось показать: '+String(err&&err.message||err)+'. Обнови Studio, не нажимая «Вернуть опубликованную версию».';
       panel.appendChild(message);
     }
   }else if(tab==='about'){
     heading(panel,'О проекте','Информация, видимая всем посетителям.');
     sectionFields(panel,tab);
     field(panel,'Объявление внизу раздела',data.about.notice,function(v){data.about.notice=v;},true);
     publicProgressEditor(panel);
   }else if(tab==='publish'){
     heading(panel,'Проверить и опубликовать','Сначала сохрани черновик. Кнопка «Опубликовать» обновит только отдельный публичный документ.');
     existingLinkAuditEditor(panel);
     preview(panel);
   }
   var buttons=document.querySelectorAll('#landing-tabs [data-landing-tab]');
   for(var i=0;i<buttons.length;i++){
     var on=buttons[i].getAttribute('data-landing-tab')===tab;
     buttons[i].className=on?'is-active':'';
     buttons[i].setAttribute('aria-pressed',on?'true':'false');
   }
   updateButtons();
 }
 function refs(){
   return {draft:db.collection('vmm_public_drafts').doc('landing'),
     live:db.collection('vmm_public_pages').doc('landing')};
 }
 function load(force){
   if(busy)return Promise.resolve();
   if(loaded&&!force){render();if(tab==='distribution'||tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics'||tab==='genres')loadCatalogArtists();return Promise.resolve();}
   if(force&&dirty()&&!window.confirm('Есть несинхронизированные изменения. Обновление может их перезаписать в редакторе. Обновить?'))return Promise.resolve();
   if(force){linksAudit=null;linksAuditSignature='';linksAuditLoading=false;trackEditorArtist='';trackChecked={};trackSearch='';languageEditorCode='';languageCatalogSearch='';languageTrackFilter='';languageCatalogPage=0;topicEditorSlug='';topicCatalogSearch='';topicTrackFilter='';topicCatalogPage=0;genreEditorId='';genreCatalogSearch='';genreTrackFilter='';genreCatalogPage=0;albumCatalogPage=0;catalogLoaded=false;catalogLoading=false;catalogError='';trackLinksLoaded=false;}
   var currentLoad=++loadGeneration;
   busy=true;updateButtons();info('Проверяем права и загружаем черновик…');
   return authorized().then(function(auth){
     if(currentLoad!==loadGeneration)return null;
     uid=auth.user.uid;db=auth.db;var r=refs();
     var scope=navigator.onLine?{source:'server'}:{source:'cache'};
     return Promise.all([r.draft.get(scope),r.live.get(scope)]).then(function(list){
       if(currentLoad!==loadGeneration)return;
       var draft=list[0].exists?list[0].data():null,live=list[1].exists?list[1].data():null;
       published=live&&live.status==='published'?API.normalize(live.content):null;
       publishedRev=live?Number(live.revision)||0:0;
       draftRev=draft?Number(draft.revision)||0:0;
       data=API.normalize(draft&&draft.content?draft.content:published||API.defaults());
       baseline=JSON.stringify(data);loaded=true;busy=false;render();
       recoverLocal().then(function(){if(navigator.onLine)syncOffline();});
       if(tab==='distribution'||tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics'||tab==='genres')loadCatalogArtists();
       info(draft?'Черновик загружен. Изменения пока не опубликованы.':
          (published?'Загружена последняя публикация. Сохрани черновик, прежде чем публиковать изменения.':
          'Публикаций пока нет. Подготовь разделы и сохрани первый черновик.'));
     });
   }).catch(function(err){
     if(currentLoad!==loadGeneration)return;
     busy=false;loaded=false;updateButtons();info('Не удалось открыть редактор из облака/кэша: '+safeStatus(err));
   });
 }
 function save(){
   if(!loaded||busy)return;
   if(!navigator.onLine){
     snapshotLocal().then(function(){info('Черновик сохранён на этом устройстве. Он отправится в облако после подключения.');})
       .catch(function(e){info('Ошибка локального черновика: '+e.message);});
     return;
   }
   var cleanData;try{cleanData=normalizeWithLinkCapacity(data);if(cleanData.about.progress.total!==data.about.progress.total){data=clone(cleanData);render();info('Исправлено: максимальное число ссылок = число композиций × 3. Проверь данные и снова нажми «Сохранить черновик».');return;}}catch(e){info('Проверь поля: '+e.message);return;}
   var savedRevision=draftRev,account=uid;
   busy=true;updateButtons();info('Сохраняем черновик…');
   authorized().then(function(a){
     if(a.user.uid!==account)throw new Error('Учётная запись изменилась.');
     var ref=refs().draft;
     return db.runTransaction(function(tx){
       return tx.get(ref).then(function(s){
         var version=s.exists?(Number(s.data().revision)||0):0;
         if(version!==savedRevision)throw new Error('Черновик изменён с другого устройства. Обнови редактор перед новой записью.');
         tx.set(ref,{schemaVersion:1,status:'draft',revision:version+1,
           content:cleanData,updatedBy:account,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
         return version+1;
       });
     });
   }).then(function(v){
     var previousNonce=offlineNonce;
     draftRev=v;baseline=JSON.stringify(cleanData);busy=false;render();
     if(offlineStore&&previousNonce)offlineStore.acknowledge(account,pendingName(),previousNonce).catch(function(){});
     info('Черновик сохранён (версия '+v+'). '+(dirty()?'Есть более поздние несохранённые правки.':'Главная страница ещё не изменилась.'));
   }).catch(function(e){
     busy=false;
     var message=safeStatus(e);
     if(message.indexOf('Черновик изменён с другого устройства')>=0){
       showOfflineConflict(true);
       snapshotLocal().catch(function(){});
       message+=' Локальная копия сохранена. Используй безопасное объединение, а не «Обновить из базы».';
     }
     updateButtons();info('Черновик не сохранён: '+message);
   });
 }
 function publish(){
   if(!loaded||busy||!draftRev)return;
   if(dirty()||offlineSyncing||offlineNonce&&draftDirty()){info('Сначала дождись облачной синхронизации черновика и привязок.');return;}
   if(!navigator.onLine){info('Публикация требует интернета.');return;}
   if(!window.confirm('Опубликовать выбранные артистов, релизы и тексты на открытой главной странице velardream.com?'))return;
   var cleanData;try{cleanData=API.normalize(data);}catch(e){info('Публикация остановлена: '+e.message);return;}
   var liveData=cleanData,account=uid,expectedDraft=draftRev,expectedLive=publishedRev;
   busy=true;updateButtons();info('Публикуем проверенные данные…');
   authorized().then(function(a){
     if(a.user.uid!==account)throw new Error('Учётная запись изменилась.');
     var sources=cleanData.releases.radio.sources;
     var groups=cleanData.genres.entries||[];
     var needsGenres=groups.some(function(g){return g.songIds&&g.songIds.length;});
     if(!sources.length&&!needsGenres)return;
     // RUN-178: single read from protected catalog supplies both radio and
     // public genre metadata. No catalog writes, private fields or credentials.
     return a.db.collection('vmm_catalog').limit(1200).get({source:'server'}).then(function(snapshot){
       var rows=[],byId={};
       snapshot.forEach(function(doc){
         var track=doc.data()||{};rows.push(track);byId[doc.id]=track;
       });
       if(rows.length>=1200)throw new Error('Каталог достиг лимита 1200 записей. Публикация остановлена, чтобы не потерять назначения.');
       liveData=clone(cleanData);
       if(sources.length){
         liveData.releases.radio.catalog=API.radioCatalog(cleanData,rows,sources);
         if(!sources.some(function(p){return liveData.releases.radio.catalog[p].length;}))
           throw new Error('В каталоге пока нет ссылок выбранных площадок.');
       }
       (liveData.genres.entries||[]).forEach(function(g){
         g.tracks=[];
         (g.songIds||[]).forEach(function(songId){
           if(!Object.prototype.hasOwnProperty.call(byId,songId))
             throw new Error('Жанр «'+g.label+'»: песня '+songId+' не найдена в каталоге. Обнови каталог.');
           var song=byId[songId],links=song.links||{},sourcesFound=[];
           ['spotify','youtube','appleMusic'].forEach(function(p){
             var verified=API.songUrl(links[p]||'',p);
             if(verified)sourcesFound.push({provider:p,url:verified});
           });
           if(!sourcesFound.length)return; // retain ID for future publication
           var first=sourcesFound[0];
           var row={title:String(song.title||'Без названия'),artist:String(song.artist||''),
             provider:first.provider,url:first.url};
           if(sourcesFound[1]){row.alternateProvider=sourcesFound[1].provider;row.alternateUrl=sourcesFound[1].url;}
           if(sourcesFound[2]){row.thirdProvider=sourcesFound[2].provider;row.thirdUrl=sourcesFound[2].url;}
           g.tracks.push(API.languageTrack(row,1));
         });
       });
       liveData=API.normalize(liveData); // enforce public-data whitelist
     });
   }).then(function(){
     if(uid!==account)throw new Error('Учётная запись изменилась.');
     var r=refs();
     return db.runTransaction(function(tx){
       return tx.get(r.draft).then(function(s){
         if(!s.exists||(Number(s.data().revision)||0)!==expectedDraft||
           JSON.stringify(API.normalize(s.data().content))!==JSON.stringify(cleanData))
           throw new Error('Черновик изменился в другом окне. Публикация остановлена.');
         return tx.get(r.live).then(function(pub){
           var v=pub.exists?(Number(pub.data().revision)||0):0;
           if(v!==expectedLive)throw new Error('Главная страница уже опубликована из другого окна. Обнови редактор.');
           tx.set(r.live,{schemaVersion:1,status:'published',revision:v+1,content:liveData,
             updatedBy:account,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
           return v+1;
         });
       });
     });
   }).then(function(v){
     published=clone(liveData);publishedRev=v;busy=false;
     // RUN-114: the distribution UI compares the draft with the LAST
     // published snapshot. A successful publish changes that snapshot:
     // remount this tab immediately so badges stop saying "draft" after
     // the song is already visible to listeners. The search/page state is
     // retained by VMM_SONG_DISTRIBUTION (no new Firestore reads/writes).
     if(tab==='distribution')render();
     updateButtons();
     info('Опубликовано! Версия '+v+'. Открой главную страницу в новой вкладке, чтобы проверить.');
   }).catch(function(e){busy=false;updateButtons();info('Публикация не выполнена: '+safeStatus(e));});
 }
 if(window.addEventListener){
   window.addEventListener('online',function(){syncOffline();syncArtistLinks();});
   window.addEventListener('pagehide',function(){
     if(offlineTimer!==null){clearTimeout(offlineTimer);offlineTimer=null;snapshotLocal().catch(function(){});}
   });
 }
 function canLeave(){
   if(busy||trackSaving){info('Дождись завершения сохранения или публикации.');return false;}
   if(!dirty())return true;
   // Locally persisted entries survive navigation; do not discard silently.
   if(!navigator.onLine&&offlineStore){
     if(JSON.stringify(data)!==offlineSavedSignature){
       snapshotLocal().catch(function(){});
       info('Сначала дождись сообщения о сохранении на устройстве. Локальная запись ещё выполняется.');
       return false;
     }
     return true;
   }
   if(!window.confirm('В главной странице или связях песен есть несохранённые изменения. Отменить их и выйти из раздела?'))return false;
   data=JSON.parse(baseline);trackEditorArtist='';trackChecked={};trackSearch='';render();return true;
 }
 function open(){
   show(root,true);
   load(false);
 }
 function hide(){show(root,false);}
 function reset(){
   linksAudit=null;linksAuditSignature='';linksAuditLoading=false;
   loadGeneration++;
   uid='';db=null;loaded=false;busy=false;draftRev=0;publishedRev=0;
   offlineNonce='';offlineSyncing=false;offlineSavedSignature='';showOfflineConflict(false);
   if(offlineTimer!==null){clearTimeout(offlineTimer);offlineTimer=null;}
   catalogArtists=[];catalogLoaded=false;catalogLoading=false;catalogError='';
   trackLinks={revision:0,overrides:{}};trackLinksLoaded=false;pendingArtistLinks=false;trackEditorArtist='';trackChecked={};trackSearch='';trackSaving=false;
   if(window.VMM_SONG_DISTRIBUTION)window.VMM_SONG_DISTRIBUTION.reset();
   data=API.defaults();baseline='';published=null;tab='hero';languageEditorCode='';languageCatalogSearch='';languageTrackFilter='';languageCatalogPage=0;topicEditorSlug='';topicCatalogSearch='';topicTrackFilter='';topicCatalogPage=0;genreEditorId='';genreCatalogSearch='';genreTrackFilter='';genreCatalogPage=0;albumCatalogPage=0;hide();updateButtons();
 }
 var nav=document.querySelectorAll('#landing-tabs [data-landing-tab]');
 for(var i=0;i<nav.length;i++)nav[i].onclick=function(){
   tab=this.getAttribute('data-landing-tab');render();
   if(tab==='distribution'||tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics'||tab==='genres')loadCatalogArtists();
 };
 id('landing-save').onclick=save;
 id('landing-merge-offline').onclick=reconcileOffline;
 id('landing-publish').onclick=publish;
 id('landing-reload').onclick=function(){load(true);};
 id('landing-restore').onclick=function(){
   if(!published||!canLeave())return;
   data=clone(published);tab='publish';render();
   info('Последняя опубликованная версия возвращена в редактор. Сохрани как черновик, если нужно продолжить работу.');
 };
 id('landing-export-offline').onclick=function(){
   if(!offlineStore||!uid){info('Войди в личный кабинет перед резервным копированием.');return;}
   offlineStore.exportPending(uid,'pending:landing').then(function(count){
     info('Скачана локальная резервная копия ('+count+' записей). Не пересылай её посторонним.');
   }).catch(function(err){info('Резервная копия: '+err.message);});
 };
 window.VMM_LANDING={open:open,hide:hide,reset:reset,canLeave:canLeave,isDirty:dirty,
   syncOffline:syncOffline,syncArtistLinks:syncArtistLinks};
}());
