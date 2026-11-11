/* VELARDREAM private Studio / RUN-045. ES5-compatible for Safari iOS 12.
   Song title, UPC and catalog row are immutable identity fields in this editor.
   Never embed personal lyrics in GitHub; writes require verified owner. */
(function () {
  'use strict';
  var cfg=window.VELAR_FIREBASE_CONFIG;
  var gate=document.getElementById('gate'),workspace=document.getElementById('workspace');
  var gateStatus=document.getElementById('gate-status'),signIn=document.getElementById('sign-in');
  var db=null,auth=null,user=null,authorized=false,authorizedUid='',saveBusy=false;
  var lyrics=[],catalog=[],songs=[],songKey='',selectedRecord=null,selectedDraft=null,baseline='';
  var sections={lyrics:'Тексты песен',catalog:'Каталог релизов',recordings:'Фонограммы',platforms:'Площадки и ссылки',contacts:'Контакты',outreach:'Рассылки',audit:'Журнал'};
  function el(n){return document.getElementById(n);}
  function text(n,v){if(n)n.textContent=v==null?'':String(v);}
  function show(n,yes){if(n)n.className=n.className.replace(/\s*hidden\b/g,'')+(yes?'':' hidden');}
  function message(s){text(gateStatus,s);}
  function form(){return el('lyric-form');}
  function body(){return el('lyric-body');}
  function name(s){return String(s==null?'':s).trim();}
  function titleKey(s){return name(s).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');}
  function isDirty(){return !!(selectedRecord||selectedDraft) && body().value!==baseline;}
  function confirmDiscard(){
    if(saveBusy){text(el('save-message'),'Сохранение ещё выполняется; дождись подтверждения записи.');return false;}
    return !isDirty()||window.confirm('В тексте есть несохранённые изменения. Отменить изменения и перейти к другой песне?');
  }
  function focusSheet(yes){
    show(el('vmm-editor-view'),!yes);show(el('vmm-paper-view'),yes);
    el('lyric-view-editor').className=yes?'':'is-active';
    el('lyric-view-paper').className=yes?'is-active':'';
    el('lyric-view-editor').setAttribute('aria-pressed',yes?'false':'true');
    el('lyric-view-paper').setAttribute('aria-pressed',yes?'true':'false');
    if(yes&&window.VMM_LYRICS_TOOLS)window.VMM_LYRICS_TOOLS.refreshPreview();
  }
  function options(select,items){
    while(select.firstChild)select.removeChild(select.firstChild);
    items.forEach(function(it){var o=document.createElement('option');o.value=it.value;o.textContent=it.label;select.appendChild(o);});
  }
  function songForLyric(x){
    // Never match by UPC alone: several songs can belong to one album.
    for(var i=0;i<catalog.length;i++){
      var t=catalog[i],row=name(t.sourceRow),oldRow=name(x.catalogRow);
      if(row&&oldRow&&row===oldRow&&titleKey(t.title)===titleKey(x.title))return t;
      if(name(t.upc)&&name(t.upc)===name(x.upc)&&titleKey(t.title)===titleKey(x.title))return t;
    }
    return null;
  }
  function songOptions(){
    songs=catalog.map(function(t){return {key:'catalog:'+t.id,title:name(t.title),artist:name(t.artist),upc:name(t.upc),sourceRow:name(t.sourceRow),track:t};});
    lyrics.forEach(function(x){
      if(songForLyric(x))return;
      var same=songs.some(function(t){return t.legacy&&titleKey(t.title)===titleKey(x.title)&&name(t.upc)===name(x.upc);});
      if(!same)songs.push({key:'legacy:'+x.id,title:name(x.title),artist:name(x.artist),upc:name(x.upc),sourceRow:name(x.catalogRow),legacy:true,legacyId:x.id});
    });
    songs.sort(function(a,b){return a.title.localeCompare(b.title,'ru');});
    renderSongChoices();
  }
  function songByKey(key){for(var i=0;i<songs.length;i++)if(songs[i].key===key)return songs[i];return null;}
  function versions(song){
    if(!song)return[];
    return lyrics.filter(function(x){
      if(song.legacy)return titleKey(x.title)===titleKey(song.title)&&name(x.upc)===name(song.upc);
      return songForLyric(x)===song.track;
    });
  }
  function renderSongChoices(){
    var query=titleKey(el('lyrics-filter').value),list=[{value:'',label:'Выбери песню…'}],seenSelected=false;
    songs.forEach(function(s){
      var label=s.title+(s.artist?' — '+s.artist:'');
      if(query&&titleKey(label).indexOf(query)<0&&s.key!==songKey)return;
      if(s.key===songKey)seenSelected=true;
      list.push({value:s.key,label:label});
    });
    options(el('lyric-song-select'),list);
    el('lyric-song-select').value=seenSelected?songKey:'';
  }
  function formattedWhen(value){
    if(!value)return '';
    try{
      var d=value&&typeof value.toDate==='function'?value.toDate():new Date(value);
      if(!isNaN(d.getTime()))return d.toLocaleString('ru-RU');
    }catch(e){}
    return String(value).slice(0,32);
  }
  function setVersionChoices(choose){
    var song=songByKey(songKey),items=versions(song).map(function(x){
      return {value:x.id,label:(name(x.language)||'Язык не указан')+' · '+(name(x.version)||'Основная')};
    });
    if(selectedDraft)items.push({value:'__draft',label:(selectedDraft.language||'Русский')+' · '+(selectedDraft.version||'Основная')+' (не сохранено)'});
    if(!items.length)items=[{value:'',label:'Пока нет сохранённого текста'}];
    options(el('lyric-version-select'),items);
    el('lyric-version-select').disabled=!song||!items.some(function(x){return x.value;});
    el('lyric-version-select').value=choose||items[0].value;
    if(!el('lyric-version-select').value&&items.length)el('lyric-version-select').value=items[0].value;
  }
  function metadata(){
    var song=songByKey(songKey);
    return selectedRecord||selectedDraft||song||null;
  }
  function refreshToolbar(){
    var disabled=!(selectedRecord||selectedDraft)||saveBusy;
    el('save-lyric').disabled=disabled||!isDirty()||!body().value.trim();
    el('new-lyric').disabled=!songKey||saveBusy;
    text(el('lyric-selected-title'),songByKey(songKey)?songByKey(songKey).title:'');
    text(el('lyric-selected-artist'),songByKey(songKey)?songByKey(songKey).artist:'');
    if(window.VMM_LYRICS_TOOLS&&window.VMM_LYRICS_TOOLS.notifyDirty)window.VMM_LYRICS_TOOLS.notifyDirty(isDirty());
  }
  function fillLyric(x,isNew){
    selectedRecord=isNew?null:x;
    if(!isNew)selectedDraft=null;
    body().value=isNew?'':name(x.text); // text is preserved exactly except raw nulls
    if(!isNew&&typeof x.text==='string')body().value=x.text;
    baseline=body().value;
    show(form(),true);show(el('no-lyric-selected'),false);
    text(el('save-message'),'');
    text(el('lyric-loaded-at'),isNew?'Новая версия · пока не сохранена':'Загружено: '+(formattedWhen(x.updatedAt)||'из архива'));
    focusSheet(false);
    refreshToolbar();
    if(window.VMM_LYRICS_TOOLS)window.VMM_LYRICS_TOOLS.onRecordLoaded();
  }
  function chooseVersion(id){
    if(id==='__draft'&&selectedDraft){fillLyric(selectedDraft,true);setVersionChoices('__draft');return;}
    var chosen=null;
    for(var i=0;i<lyrics.length;i++)if(lyrics[i].id===id){chosen=lyrics[i];break;}
    if(chosen){fillLyric(chosen,false);setVersionChoices(chosen.id);}
    else{selectedRecord=null;selectedDraft=null;show(form(),false);show(el('no-lyric-selected'),true);text(el('lyric-loaded-at'),'');setVersionChoices('');}
  }
  function chooseSong(key,prefer){
    if(songKey!==key&&!confirmDiscard())return false;
    songKey=key;selectedDraft=null;
    renderSongChoices();
    var song=songByKey(key);
    if(!song){selectedRecord=null;selectedDraft=null;show(form(),false);show(el('no-lyric-selected'),true);setVersionChoices('');return true;}
    var v=versions(song),chosen=v[0];
    if(prefer)for(var i=0;i<v.length;i++)if(v[i].id===prefer){chosen=v[i];break;}
    if(chosen){fillLyric(chosen,false);setVersionChoices(chosen.id);}
    else{
      selectedDraft={title:song.title,upc:song.upc,catalogRow:song.sourceRow,language:'Русский',version:'Основная'};
      fillLyric(selectedDraft,true);setVersionChoices('__draft');
    }
    return true;
  }
  function newVersion(){
    if(!songKey||!confirmDiscard())return;
    var song=songByKey(songKey);
    if(!song)return;
    var language=window.prompt('Язык новой версии:', 'Русский');
    if(language===null)return;language=name(language).slice(0,80);if(!language)return;
    var version=window.prompt('Название новой версии:', 'Основная');
    if(version===null)return;version=name(version).slice(0,120);if(!version)return;
    if(versions(song).some(function(x){return titleKey(x.language)===titleKey(language)&&titleKey(x.version||'Основная')===titleKey(version);}) ){
      text(el('save-message'),'Такая версия уже существует. Выбери её в списке и редактируй, не создавая дубликат.');return;
    }
    selectedDraft={title:song.title,upc:song.upc,catalogRow:song.sourceRow,language:language,version:version};
    fillLyric(selectedDraft,true);setVersionChoices('__draft');
    body().focus();
  }
  function updateLoaded(id){
    return Promise.all([db.collection('vmm_catalog').limit(1200).get().catch(function(){return null;}),db.collection('vmm_lyrics').limit(500).get()]).then(function(result){
      catalog=[];if(result[0])result[0].forEach(function(doc){var d=doc.data();d.id=doc.id;catalog.push(d);});
      lyrics=[];result[1].forEach(function(doc){var x=doc.data();x.id=doc.id;lyrics.push(x);});
      lyrics.sort(function(a,b){return name(a.title).localeCompare(name(b.title),'ru');});
      songOptions();
      text(el('sync-status'),(result[0]?'Песен в каталоге: '+catalog.length:'Каталог временно недоступен')+' · сохранено текстов: '+lyrics.length+(navigator.onLine?' · в сети':' · офлайн'));
      if(id){
        for(var i=0;i<lyrics.length;i++)if(lyrics[i].id===id){var song=songForLyric(lyrics[i]);if(song)songKey='catalog:'+song.id;else songKey='legacy:'+lyrics[i].id;break;}
        renderSongChoices();
        chooseVersion(id);
      }else if(songKey)chooseSong(songKey);
      return true;
    }).catch(function(e){
      text(el('sync-status'),'Не удалось загрузить данные: '+e.message);throw e;
    });
  }
  var panelMemoryKey='vmm-studio-active-panel-v1';
  function validPanel(p){return ['overview','lyrics','catalog','recordings','platforms','contacts','outreach','extras','audit'].indexOf(p)>=0;}
  function rememberPanel(p){
    if(!validPanel(p))return;
    try{window.sessionStorage.setItem(panelMemoryKey,p);}catch(ignore){}
  }
  function rememberedPanel(){
    try{var p=window.sessionStorage.getItem(panelMemoryKey);return validPanel(p)?p:'overview';}
    catch(ignore){return 'overview';}
  }
  function selectPanel(id){
    rememberPanel(id);
    var keys=document.querySelectorAll('#workspace [data-panel]');
    for(var i=0;i<keys.length;i++)keys[i].className=keys[i].getAttribute('data-panel')===id?'nav-active':'';
    show(el('panel-lyrics'),id==='lyrics');show(el('panel-future'),id!=='lyrics');
    if(id!=='recordings'&&window.VMM_RECORDINGS)window.VMM_RECORDINGS.hide();
    if(id!=='lyrics'){text(el('future-title'),sections[id]||'Раздел');text(el('future-message'),'Раздел работает в защищённой Firestore.');}
  }
  function showWorkspace(){
    // Firebase can fire a second auth callback after Google Drive reauthentication.
    // Keep the current music, tab and scroll position intact on subsequent callbacks.
    if(authorized&&authorizedUid===user.uid){
      text(el('account-label'),user.email||'Google');text(el('net-state'),navigator.onLine?'В сети':'Без сети');
      return;
    }
    if(authorized&&authorizedUid!==user.uid){
      lyrics=[];catalog=[];songs=[];selectedRecord=null;selectedDraft=null;baseline='';songKey='';
      if(window.VMM_RECORDINGS&&window.VMM_RECORDINGS.reset)window.VMM_RECORDINGS.reset();
    }
    authorized=true;authorizedUid=user.uid;show(gate,false);show(workspace,true);
    text(el('account-label'),user.email||'Google');text(el('net-state'),navigator.onLine?'В сети':'Без сети');
    text(el('sync-status'),'Читаем личную базу…');
    var section=rememberedPanel();
    if(section==='recordings'&&window.VMM_RECORDINGS)window.VMM_RECORDINGS.open();
    else if(section!=='lyrics'&&window.VMM_WORKFLOWS)window.VMM_WORKFLOWS.open(section);
    else selectPanel('lyrics');
    updateLoaded().catch(function(){});
  }
  function unauthorized(note){
    authorized=false;authorizedUid='';saveBusy=false;lyrics=[];catalog=[];songs=[];selectedRecord=null;selectedDraft=null;baseline='';songKey='';
    if(window.VMM_RECORDINGS&&window.VMM_RECORDINGS.reset)window.VMM_RECORDINGS.reset();
    show(workspace,false);show(gate,true);message(note);if(auth)signIn.disabled=false;
  }
  function save(e){
    e.preventDefault();
    if(saveBusy)return;
    if(!authorized||!user||!db){text(el('save-message'),'Недостаточно прав.');return;}
    var meta=metadata(),current=body().value;
    if(!meta||!songKey||!name(current)){text(el('save-message'),'Сначала выбери песню и введи её текст.');return;}
    if(!navigator.onLine){text(el('save-message'),'Нет интернета. Текст остаётся в редакторе; запись в базу пока не отправлена.');return;}
    if(!isDirty()){text(el('save-message'),'Изменений для сохранения нет.');return;}
    var song=songByKey(songKey),isEdit=!!selectedRecord;
    if(!song){text(el('save-message'),'Композиция не выбрана.');return;}
    // Prevent accidental identity overwrites: on edits, update only content and audit.
    if(!isEdit&&lyrics.some(function(x){return versions(song).indexOf(x)>=0&&titleKey(x.language)===titleKey(meta.language)&&titleKey(x.version||'Основная')===titleKey(meta.version||'Основная');})){
      text(el('save-message'),'Такая версия уже сохранена. Выбери её из списка.');return;
    }
    var ref=isEdit?db.collection('vmm_lyrics').doc(selectedRecord.id):db.collection('vmm_lyrics').doc();
    var audit=db.collection('vmm_audit').doc(),before=baseline,recordId=ref.id;
    saveBusy=true;body().readOnly=true;refreshToolbar();
    text(el('save-message'),'Проверяем актуальную версию и сохраняем…');
    db.runTransaction(function(tx){
      if(isEdit)return tx.get(ref).then(function(snapshot){
        if(!snapshot.exists)throw new Error('Версия удалена на другом устройстве. Сохранение отменено.');
        if(String(snapshot.data().text||'')!==before)throw new Error('Этот текст изменился на другом устройстве. Скопируй свои правки и обнови страницу, чтобы избежать потери.');
        tx.update(ref,{text:current,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:user.uid});
        tx.set(audit,{time:firebase.firestore.FieldValue.serverTimestamp(),operation:'Текст песни изменён',subject:meta.title,result:[meta.language,meta.version].join(' · '),referenceId:recordId,actor:user.uid});
      });
      tx.set(ref,{title:meta.title,upc:meta.upc||'',catalogRow:meta.catalogRow||'',language:meta.language||'Русский',version:meta.version||'Основная',text:current,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:user.uid});
      tx.set(audit,{time:firebase.firestore.FieldValue.serverTimestamp(),operation:'Текст песни создан',subject:meta.title,result:[meta.language,meta.version].join(' · '),referenceId:recordId,actor:user.uid});
      return Promise.resolve();
    }).then(function(){
      // Do not silently discard the user's current editor if a later read fails.
      baseline=current;saveBusy=false;body().readOnly=false;refreshToolbar();
      text(el('save-message'),'Сохранено. Связь с песней сохранена; изменение записано в журнал.');
      updateLoaded(recordId).catch(function(){text(el('save-message'),'Запись сохранена, но список пока не обновился. Содержимое редактора не потеряно.');});
    }).catch(function(err){
      saveBusy=false;body().readOnly=false;refreshToolbar();
      text(el('save-message'),'Не удалось сохранить: '+err.message);
    });
  }
  function loadScript(src,done){var s=document.createElement('script');s.src=src;s.onload=function(){done(null);};s.onerror=function(){done(new Error('Не загрузилась библиотека авторизации'));};document.head.appendChild(s);}
  function configReady(c){return !!(c&&typeof c.apiKey==='string'&&c.apiKey&&typeof c.authDomain==='string'&&c.authDomain&&typeof c.projectId==='string'&&c.projectId&&typeof c.appId==='string'&&c.appId);}
  function disabled(reason){message(reason);signIn.disabled=true;}
  function loadSdk(){var base='https://www.gstatic.com/firebasejs/8.10.1/';loadScript(base+'firebase-app.js',function(e){if(e)return disabled(e.message);loadScript(base+'firebase-auth.js',function(e){if(e)return disabled(e.message);loadScript(base+'firebase-firestore.js',function(e){if(e)return disabled(e.message);initialize();});});});}
  function initialize(){
    try{
      firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.firestore();
      db.enablePersistence({synchronizeTabs:true}).catch(function(){});
      signIn.disabled=false;message('Войди через Google, чтобы подтвердить доступ владельца.');
      auth.onAuthStateChanged(function(next){
        user=next;
        if(!user){unauthorized('Вход через Google необходим для доступа к личным материалам.');return;}
        if(!user.emailVerified){unauthorized('Google не подтвердил электронную почту аккаунта.');return;}
        // Offline access only if this exact verified admin doc was previously cached by Firestore.
        // Never grant offline access from a localStorage flag or an unverified email.
        var adminRead=db.collection('vmm_admins').doc(user.uid).get({source:'server'});
        if(!navigator.onLine)adminRead=adminRead.catch(function(){
          return db.collection('vmm_admins').doc(user.uid).get({source:'cache'});
        });
        adminRead.then(function(doc){
          if(doc.exists&&doc.data()&&doc.data().enabled===true)showWorkspace();
          else unauthorized('Аккаунт Google не включён в список администраторов VELARDREAM.');
        }).catch(function(err){unauthorized('Проверка разрешения владельца не удалась: '+err.message);});
      });
    }catch(err){disabled('Ошибка авторизации: '+err.message);}
  }
  signIn.onclick=function(){
    if(!auth)return;signIn.disabled=true;message('Открываем вход Google…');
    var provider=new firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
    auth.signInWithPopup(provider).catch(function(err){message('Не удалось войти: '+err.message);signIn.disabled=false;});
  };
  el('sign-out').onclick=function(){
    if(!confirmDiscard())return;
    if(auth)auth.signOut().then(function(){try{window.sessionStorage.removeItem(panelMemoryKey);}catch(ignore){}unauthorized('Вы вышли из рабочего кабинета.');}).catch(function(err){message(err.message);});
  };
  el('lyric-song-select').onchange=function(){
    var previous=songKey;if(!chooseSong(this.value)){this.value=previous;}
  };
  el('lyric-version-select').onchange=function(){
    var previous=selectedRecord?selectedRecord.id:selectedDraft?'__draft':'';
    if(!confirmDiscard()){this.value=previous;return;}
    chooseVersion(this.value);
  };
  el('lyrics-filter').oninput=renderSongChoices;
  el('new-lyric').onclick=newVersion;
  el('lyric-view-editor').onclick=function(){focusSheet(false);};
  el('lyric-view-paper').onclick=function(){focusSheet(true);};
  form().onsubmit=save;
  body().addEventListener('input',refreshToolbar);
  el('print-lyric').onclick=function(){if(window.VMM_LYRICS_TOOLS)window.VMM_LYRICS_TOOLS.print();else text(el('save-message'),'Печать пока не загружена.');};
  el('share-lyric').onclick=function(){if(window.VMM_LYRICS_TOOLS&&window.VMM_LYRICS_TOOLS.share)window.VMM_LYRICS_TOOLS.share();else text(el('save-message'),'Функция передачи пока недоступна.');};
  var nav=document.querySelectorAll('#workspace [data-panel]');
  for(var i=0;i<nav.length;i++){
    nav[i].addEventListener('click',function(e){
      if(this.getAttribute('data-panel')!=='lyrics'&&!confirmDiscard()){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    nav[i].onclick=function(){selectPanel(this.getAttribute('data-panel'));};
  }
  window.addEventListener('beforeunload',function(e){
    if(!isDirty())return;
    e.preventDefault();e.returnValue='';
  });
  window.addEventListener('online',function(){text(el('net-state'),'В сети');});
  window.addEventListener('offline',function(){text(el('net-state'),'Без сети');});
  window.VMM_STUDIO={
    rememberPanel:rememberPanel,
    rememberedPanel:rememberedPanel,
    getLyricsMeta:function(){return metadata();},
    isLyricsDirty:isDirty,
    openForTrack:function(t){
      if(!authorized||!db)return Promise.reject(new Error('Нет доступа'));
      if(!confirmDiscard())return Promise.reject(new Error('Переход отменён: есть несохранённый текст.'));
      selectPanel('lyrics');
      return updateLoaded().then(function(){
        var catalogSong=null;
        for(var i=0;i<songs.length;i++){
          var s=songs[i];
          if(!s.legacy&&((t.id&&s.track.id===t.id)||(String(s.sourceRow)&&String(s.sourceRow)===String(t.sourceRow)&&titleKey(s.title)===titleKey(t.title)))){
            catalogSong=s;break;
          }
        }
        if(!catalogSong)throw new Error('Композиция отсутствует в каталоге.');
        chooseSong(catalogSong.key);
        el('panel-lyrics').scrollIntoView();
        return 'opened';
      });
    }
  };
  if(!configReady(cfg))disabled('Отдельный Firebase-проект не настроен. Доступ закрыт.');
  else loadSdk();
}());