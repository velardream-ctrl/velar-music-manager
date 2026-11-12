/* VELARDREAM private Studio / RUN-045. ES5-compatible for Safari iOS 12.
   Song title, UPC and catalog row are immutable identity fields in this editor.
   Never embed personal lyrics in GitHub; writes require verified owner. */
(function () {
  'use strict';
  var cfg=window.VELAR_FIREBASE_CONFIG;
  var gate=document.getElementById('gate'),workspace=document.getElementById('workspace');
  var gateStatus=document.getElementById('gate-status'),signIn=document.getElementById('sign-in');
  var db=null,auth=null,user=null,authorized=false,authorizedUid='',saveBusy=false;
  var signInAttempt=0,signInWatchdog=null;
  var lyrics=[],catalog=[],songs=[],songKey='',selectedRecord=null,selectedDraft=null,baseline='';
  var sections={lyrics:'Тексты песен',catalog:'Каталог релизов',recordings:'Фонограммы',platforms:'Площадки и ссылки',contacts:'Контакты',outreach:'Рассылки',audit:'Журнал',data:'Данные'};
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
    if(!isDirty())return true;
    if(window.VMM_OFFLINE_LYRICS){
      if(window.VMM_OFFLINE_LYRICS.savedCurrent())return true;
      window.VMM_OFFLINE_LYRICS.saveNow().catch(function(){});
      text(el('save-message'),'Изменения ещё записываются на устройство. Дождись сохранения, затем повтори действие.');
      return false;
    }
    return window.confirm('В тексте есть несохранённые изменения. Отменить изменения и перейти к другой песне?');
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
  // Same live search as the recordings catalog, using only private songs
  // already loaded in this session; no search terms are written to Firestore.
  function lyricSearchMatches(query){
    var q=titleKey(query);
    if(!q)return[];
    return songs.filter(function(s){
      return titleKey(s.title+' '+s.artist).indexOf(q)>=0;
    });
  }
  function pickLyricSearchResult(key){
    if(!songByKey(key))return false;
    // Clicking the already-open song must NEVER discard unsaved changes or
    // replace a selected language version.
    if(key!==songKey&&!chooseSong(key))return false;
    el('lyrics-filter').value='';
    renderSongChoices();
    return true;
  }
  function renderLyricSearchResults(matches,query){
    var root=el('lyric-search-results');
    if(!root)return;
    while(root.firstChild)root.removeChild(root.firstChild);
    show(root,!!query);
    if(!query)return;
    var summary=document.createElement('p');
    summary.className='sync-note lyrics-search-summary';
    summary.setAttribute('role','status');
    summary.textContent=matches.length?
      'Найдено: '+matches.length+'. Нажми на название песни.' :
      'По запросу «'+el('lyrics-filter').value+'» песен не найдено.';
    root.appendChild(summary);
    matches.slice(0,25).forEach(function(s){
      var button=document.createElement('button');
      button.type='button';
      button.className='lyrics-search-hit';
      button.textContent=s.title+(s.artist?' — '+s.artist:'');
      button.onclick=function(){pickLyricSearchResult(s.key);};
      root.appendChild(button);
    });
    if(matches.length>25){
      var foot=document.createElement('p');
      foot.className='sync-note lyrics-search-summary';
      foot.textContent='Показаны первые 25 результатов. Уточни название или исполнителя.';
      root.appendChild(foot);
    }
  }
  function renderSongChoices(){
    var query=titleKey(el('lyrics-filter').value),list=[{value:'',label:'Выбери песню…'}],seenSelected=false;
    var matches=lyricSearchMatches(query);
    songs.forEach(function(s){
      var label=s.title+(s.artist?' — '+s.artist:'');
      if(query&&titleKey(label).indexOf(query)<0&&s.key!==songKey)return;
      if(s.key===songKey)seenSelected=true;
      list.push({value:s.key,label:label});
    });
    options(el('lyric-song-select'),list);
    el('lyric-song-select').value=seenSelected?songKey:'';
    renderLyricSearchResults(matches,query);
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
    if(window.VMM_OFFLINE_LYRICS)window.VMM_OFFLINE_LYRICS.recover();
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
      if(window.VMM_OFFLINE_LYRICS&&user)
        window.VMM_OFFLINE_LYRICS.cacheDataset(user.uid,catalog,lyrics);
      text(el('sync-status'),(result[0]?'Песен в каталоге: '+catalog.length:'Каталог временно недоступен')+' · сохранено текстов: '+lyrics.length+(navigator.onLine?' · в сети':' · офлайн'));
      if(id){
        for(var i=0;i<lyrics.length;i++)if(lyrics[i].id===id){var song=songForLyric(lyrics[i]);if(song)songKey='catalog:'+song.id;else songKey='legacy:'+lyrics[i].id;break;}
        renderSongChoices();
        chooseVersion(id);
      }else if(songKey)chooseSong(songKey);
      return true;
    }).catch(function(e){
      // Fallback to the last VERIFIED admin user's cached catalog and lyrics.
      // The page never exposes this data before the Firebase admin gate succeeds.
      if(navigator.onLine===false&&window.VMM_OFFLINE_LYRICS&&user){
        return window.VMM_OFFLINE_LYRICS.cachedDataset(user.uid).then(function(saved){
          if(!saved||!Array.isArray(saved.catalog)||!Array.isArray(saved.lyrics))throw e;
          catalog=saved.catalog;lyrics=saved.lyrics;songOptions();
          text(el('sync-status'),'Загружен личный офлайн-каталог · '+lyrics.length+' текстов');
          if(id){chooseVersion(id);}else if(songKey)chooseSong(songKey);
          return true;
        }).catch(function(err){text(el('sync-status'),'Не удалось загрузить офлайн-каталог: '+err.message);throw err;});
      }
      text(el('sync-status'),'Не удалось загрузить данные: '+e.message);throw e;
    });
  }
  // Hash-based tab state: only a fixed, nonsensitive panel name appears in
  // the URL. No localStorage/sessionStorage, tokens, titles or lyrics.
  function validPanel(p){return ['overview','landing','lyrics','catalog','recordings','platforms','contacts','outreach','extras','audit','data'].indexOf(p)>=0;}
  function rememberPanel(p){
    if(!validPanel(p))return;
    try{
      var here=window.location;
      if(here&&window.history&&window.history.replaceState){
        window.history.replaceState(null,'',here.pathname+here.search+'#vmm-'+p);
      }
    }catch(ignore){}
  }
  function rememberedPanel(){
    try{
      var hash=window.location&&window.location.hash||'',match=/^#vmm-([a-z]+)$/.exec(hash);
      return match&&validPanel(match[1])?match[1]:'overview';
    }catch(ignore){return 'overview';}
  }
  function selectPanel(id){
    rememberPanel(id);
    var keys=document.querySelectorAll('#workspace [data-panel]');
    for(var i=0;i<keys.length;i++)keys[i].className=keys[i].getAttribute('data-panel')===id?'nav-active':'';
    show(el('panel-lyrics'),id==='lyrics');show(el('panel-landing'),id==='landing');show(el('panel-future'),id!=='lyrics'&&id!=='data'&&id!=='landing');show(el('panel-data'),id==='data');
    // The independent workflow/overview panel must never remain visible
    // underneath the landing CMS, Lyrics or any other selected panel.
    show(el('vmm-workflows'),false);
    if(id==='landing'&&window.VMM_LANDING)window.VMM_LANDING.open();
    else if(window.VMM_LANDING)window.VMM_LANDING.hide();
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
      if(window.VMM_LANDING&&window.VMM_LANDING.reset)window.VMM_LANDING.reset();
    }
    authorized=true;authorizedUid=user.uid;clearSignInWatchdog();signIn.disabled=false;signIn.textContent='Войти через Google';show(gate,false);show(workspace,true);
    text(el('account-label'),user.email||'Google');text(el('net-state'),navigator.onLine?'В сети':'Без сети');
    text(el('sync-status'),'Читаем личную базу…');
    var section=rememberedPanel();
    if(section==='landing'&&window.VMM_LANDING)selectPanel('landing');
    else if(section==='recordings'&&window.VMM_RECORDINGS)window.VMM_RECORDINGS.open();
    else if(section!=='lyrics'&&window.VMM_WORKFLOWS)window.VMM_WORKFLOWS.open(section);
    else selectPanel('lyrics');
    updateLoaded().then(function(){
      if(window.VMM_OFFLINE_LYRICS&&navigator.onLine)
        window.VMM_OFFLINE_LYRICS.syncAll();
    }).catch(function(){});
  }
  function unauthorized(note){
    authorized=false;authorizedUid='';saveBusy=false;lyrics=[];catalog=[];songs=[];selectedRecord=null;selectedDraft=null;baseline='';songKey='';
    if(window.VMM_RECORDINGS&&window.VMM_RECORDINGS.reset)window.VMM_RECORDINGS.reset();
    if(window.VMM_LANDING&&window.VMM_LANDING.reset)window.VMM_LANDING.reset();
    show(workspace,false);show(gate,true);message(note);if(auth)signinReady();
  }
  function save(e){
    e.preventDefault();
    if(saveBusy)return;
    if(!authorized||!user||!db){text(el('save-message'),'Недостаточно прав.');return;}
    var meta=metadata(),current=body().value;
    if(!meta||!songKey||!name(current)){text(el('save-message'),'Сначала выбери песню и введи её текст.');return;}
    if(!navigator.onLine){
      if(!window.VMM_OFFLINE_LYRICS){text(el('save-message'),'Локальное хранилище недоступно. Скопируй текст.');return;}
      window.VMM_OFFLINE_LYRICS.saveNow().then(function(){
        text(el('save-message'),'Сохранено на этом устройстве. При возвращении сети текст синхронизируется после проверки изменений.');
      }).catch(function(err){text(el('save-message'),'Не удалось сохранить локально: '+err.message);});
      return;
    }
    if(!isDirty()){text(el('save-message'),'Изменений для сохранения нет.');return;}
    if(window.VMM_OFFLINE_LYRICS){
      saveBusy=true;body().readOnly=true;refreshToolbar();
      text(el('save-message'),'Сохраняем локально и проверяем очередь синхронизации…');
      window.VMM_OFFLINE_LYRICS.saveNow().then(function(){
        return window.VMM_OFFLINE_LYRICS.syncAll();
      }).then(function(){
        saveBusy=false;body().readOnly=false;refreshToolbar();
        if(isDirty())text(el('save-message'),'Локальная копия сохранена. Если облако изменилось, сравни версии перед продолжением.');
      }).catch(function(err){
        saveBusy=false;body().readOnly=false;refreshToolbar();
        text(el('save-message'),'Локальная копия/синхронизация: '+err.message);
      });
      return;
    }
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
      if(window.VMM_OFFLINE_LYRICS)window.VMM_OFFLINE_LYRICS.syncAll();
      text(el('save-message'),'Сохранено. Связь с песней сохранена; изменение записано в журнал.');
      updateLoaded(recordId).catch(function(){text(el('save-message'),'Запись сохранена, но список пока не обновился. Содержимое редактора не потеряно.');});
    }).catch(function(err){
      saveBusy=false;body().readOnly=false;refreshToolbar();
      text(el('save-message'),'Не удалось сохранить: '+err.message);
    });
  }
  function loadScript(src,done){var s=document.createElement('script');s.src=src;s.onload=function(){done(null);};s.onerror=function(){done(new Error('Не загрузилась библиотека авторизации'));};document.head.appendChild(s);}
  function configReady(c){return !!(c&&typeof c.apiKey==='string'&&c.apiKey&&typeof c.authDomain==='string'&&c.authDomain&&typeof c.projectId==='string'&&c.projectId&&typeof c.appId==='string'&&c.appId);}
  function clearSignInWatchdog(){
    if(signInWatchdog!==null&&typeof window.clearTimeout==='function')window.clearTimeout(signInWatchdog);
    signInWatchdog=null;
  }
  function signinReady(){
    clearSignInWatchdog();
    signIn.disabled=false;
    signIn.textContent='Войти через Google';
  }
  function disabled(reason){clearSignInWatchdog();message(reason);signIn.disabled=true;}
  function loadSdk(){var base='https://www.gstatic.com/firebasejs/8.10.1/';loadScript(base+'firebase-app.js',function(e){if(e)return disabled(e.message);loadScript(base+'firebase-auth.js',function(e){if(e)return disabled(e.message);loadScript(base+'firebase-firestore.js',function(e){if(e)return disabled(e.message);initialize();});});});}
  function initialize(){
    try{
      firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.firestore();
      db.enablePersistence({synchronizeTabs:true}).catch(function(){});
      signIn.disabled=false;message('Войди через Google, чтобы подтвердить доступ владельца.');
      auth.onAuthStateChanged(function(next){
        user=next;
        if(user){clearSignInWatchdog();message('Google подтвердил вход. Проверяем права администратора…');}
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
    if(!auth)return;
    var attempt=++signInAttempt;
    signIn.disabled=true;
    signIn.textContent='Открываем Google…';
    message('Открываем вход Google… Если Safari блокирует всплывающие окна, разреши их для velardream.com.');
    var provider=new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    // Keep popup initiation directly inside a real click: Safari's transient
    // user activation must not be consumed by another async call.
    var promise;
    try{promise=auth.signInWithPopup(provider);}
    catch(err){
      signinReady();
      message('Вход Google не открылся: '+err.message+'. Проверь разрешение всплывающих окон Safari и повтори.');
      return;
    }
    if(typeof window.setTimeout==='function'){
      signInWatchdog=window.setTimeout(function(){
        if(attempt!==signInAttempt||authorized)return;
        signInWatchdog=null;
        signIn.disabled=false;
        signIn.textContent='Повторить вход через Google';
        message('Google пока не подтвердил вход. Если окно не появилось, разреши всплывающие окна для velardream.com в Safari и нажми «Повторить вход». Если окно открыто, заверши вход там.');
      },18000);
    }
    Promise.resolve(promise).then(function(){
      if(attempt!==signInAttempt)return;
      clearSignInWatchdog();
      // User verification is still performed ONLY by the auth observer and
      // server-side vmm_admins check; popup completion does not grant access.
      if(!authorized)message('Вход Google выполнен. Проверяем права администратора…');
    }).catch(function(err){
      if(attempt!==signInAttempt||authorized)return;
      signinReady();
      var code=err&&err.code||'';
      if(code==='auth/popup-blocked'||code==='auth/operation-not-supported-in-this-environment'){
        message('Safari заблокировал окно входа Google. Открой Safari → Настройки → Веб-сайты → Всплывающие окна, разреши velardream.com и попробуй ещё раз. ('+code+')');
      }else if(code==='auth/popup-closed-by-user'){
        message('Окно Google закрыто без входа. Нажми «Войти через Google», чтобы повторить.');
      }else{
        message('Не удалось войти: '+(err&&err.message||code||'Неизвестная ошибка')+'. Попробуй ещё раз.');
      }
    });
  };
  el('sign-out').onclick=function(){
    if(!confirmDiscard()||(window.VMM_LANDING&&!window.VMM_LANDING.canLeave()))return;
    if(auth)auth.signOut().then(function(){try{var here=window.location;window.history.replaceState(null,'',here.pathname+here.search);}catch(ignore){}unauthorized('Вы вышли из рабочего кабинета.');}).catch(function(err){message(err.message);});
  };
  el('lyric-song-select').onchange=function(){
    var previous=songKey;
    if(!chooseSong(this.value)){this.value=previous;return;}
    el('lyrics-filter').value='';
    renderSongChoices();
  };
  el('lyric-version-select').onchange=function(){
    var previous=selectedRecord?selectedRecord.id:selectedDraft?'__draft':'';
    if(!confirmDiscard()){this.value=previous;return;}
    chooseVersion(this.value);
  };
  el('lyrics-filter').oninput=renderSongChoices;
  el('lyrics-filter').onkeydown=function(e){
    if(e.key==='Escape'){
      this.value='';
      renderSongChoices();
      e.preventDefault();
      return;
    }
    if(e.key==='Enter'){
      var found=lyricSearchMatches(this.value);
      if(found.length){
        e.preventDefault();
        pickLyricSearchResult(found[0].key);
      }
    }
  };
  el('new-lyric').onclick=newVersion;
  el('lyrics-export-offline').onclick=function(){
    if(!user||!authorized||!window.VMM_OFFLINE_ADMIN){
      text(el('lyrics-offline-status'),'Войди в личный кабинет перед экспортом.');return;
    }
    window.VMM_OFFLINE_ADMIN.exportPending(user.uid,'pending:lyric:').then(function(n){
      text(el('lyrics-offline-status'),'Скачана резервная копия '+n+' локальных текстов. Храни её в безопасном месте.');
    }).catch(function(err){text(el('lyrics-offline-status'),'Экспорт: '+err.message);});
  };
  el('lyric-view-editor').onclick=function(){focusSheet(false);};
  el('lyric-view-paper').onclick=function(){focusSheet(true);};
  form().onsubmit=save;
  body().addEventListener('input',refreshToolbar);
  body().addEventListener('input',function(){
    if(window.VMM_OFFLINE_LYRICS)window.VMM_OFFLINE_LYRICS.edited();
  });
  el('print-lyric').onclick=function(){if(window.VMM_LYRICS_TOOLS)window.VMM_LYRICS_TOOLS.print();else text(el('save-message'),'Печать пока не загружена.');};
  el('share-lyric').onclick=function(){if(window.VMM_LYRICS_TOOLS&&window.VMM_LYRICS_TOOLS.share)window.VMM_LYRICS_TOOLS.share();else text(el('save-message'),'Функция передачи пока недоступна.');};
  var nav=document.querySelectorAll('#workspace [data-panel]');
  for(var i=0;i<nav.length;i++){
    nav[i].addEventListener('click',function(e){
      var nextPanel=this.getAttribute('data-panel');
      if(nextPanel!=='landing'&&window.VMM_LANDING&&!window.VMM_LANDING.canLeave()){e.preventDefault();e.stopImmediatePropagation();return;}
      if(nextPanel!=='lyrics'&&!confirmDiscard()){e.preventDefault();e.stopImmediatePropagation();}
    },true);
    nav[i].onclick=function(){selectPanel(this.getAttribute('data-panel'));};
  }
  window.addEventListener('beforeunload',function(e){
    if(!isDirty()&&!(window.VMM_LANDING&&window.VMM_LANDING.isDirty&&window.VMM_LANDING.isDirty()))return;
    e.preventDefault();e.returnValue='';
  });
  window.addEventListener('online',function(){
    text(el('net-state'),'В сети');
    if(window.VMM_OFFLINE_LYRICS)window.VMM_OFFLINE_LYRICS.syncAll();
  });
  window.addEventListener('offline',function(){text(el('net-state'),'Без сети');});
  window.VMM_STUDIO={
    rememberPanel:rememberPanel,
    rememberedPanel:rememberedPanel,
    openData:function(){selectPanel('data');},
    getLyricsMeta:function(){return metadata();},
    isLyricsDirty:isDirty,
    offlineLyricContext:function(){
      if(!authorized||!user||!db||!songKey||!(selectedRecord||selectedDraft))return null;
      return {uid:user.uid,db:db,key:songKey,
        recordId:selectedRecord?selectedRecord.id:'',
        meta:{title:metadata().title,upc:metadata().upc,
          catalogRow:metadata().catalogRow,language:metadata().language,
          version:metadata().version},
        text:body().value,baseText:baseline,dirty:isDirty()};
    },
    offlineRestoreLyric:function(value,oldBaseline){
      if(!authorized||!songKey)return;
      baseline=String(oldBaseline||'');body().value=String(value||'');
      refreshToolbar();
      text(el('save-message'),'Восстановлен локальный текст; он ожидает безопасной синхронизации.');
    },
    offlineLyricSynced:function(key,meta,value,recordId){
      if(songKey!==key||!metadata()||body().value!==value)return;
      var active=metadata();
      if(titleKey(active.title)!==titleKey(meta.title)||
         titleKey(active.language)!==titleKey(meta.language)||
         titleKey(active.version)!==titleKey(meta.version))return;
      baseline=value;refreshToolbar();
      text(el('save-message'),'Текст синхронизирован с облаком. Другие устройства смогут увидеть его после обновления.');
      updateLoaded(recordId).catch(function(){});
    },
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