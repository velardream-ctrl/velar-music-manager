/* VMM RUN-043 — secure, owner-only workflows. No personal records embedded.
   Legacy behavior is adapted to Firestore, never calls Apps Script or sends mail.
   Compatible with Safari iOS 12: ES5-style syntax and native DOM APIs. */
(function () {
  'use strict';
  var shell = document.querySelector('.workspace-content');
  if (!shell) return;
  var pane = document.createElement('section');
  pane.id = 'vmm-workflows';
  pane.className = 'panel hidden';
  pane.setAttribute('aria-live', 'polite');
  shell.appendChild(pane);
  var catalog = [], proposals = [], auxiliary = [], current = 'overview';
  var filter = '', mode = 'all', page = 0, selected = '', busy = false, artist = 'all', chosen = Object.create(null);
  var collections = {contacts:'vmm_contacts',outreach:'vmm_outreach',recordings:'vmm_recordings',extras:'vmm_platforms',audit:'vmm_audit'};
  var labels = {overview:'Обзор',catalog:'Каталог релизов',platforms:'Площадки и ссылки',contacts:'Контакты',outreach:'Рассылки',recordings:'Фонограммы',extras:'Доп. площадки',audit:'Журнал'};
  var platforms = {spotify:'Spotify',appleMusic:'Apple Music',youtube:'YouTube',yandex:'Яндекс Музыка',vk:'VK Музыка',zvuk:'Звук'};
  var fieldMap = {spotify:10,appleMusic:8,youtube:12,zvuk:16}; // Yandex legacy column 14 stores ALBUM links, never overwrite with track.
  var statusMap = {spotify:11,appleMusic:9,youtube:13,zvuk:17};
  var user = null, db = null;
  function id(x) { return document.getElementById(x); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c];}); }
  function tr(s) { return String(s == null ? '' : s).trim(); }
  function safeUrl(u) { return /^https:\/\/[a-z0-9.-]+(?:\/|$)/i.test(tr(u)); }
  function el(tag, props) { var n=document.createElement(tag);Object.keys(props||{}).forEach(function(k){n.setAttribute(k,props[k]);});return n; }
  function show(n, yes) {if(!n)return;n.className=n.className.replace(/\s*hidden\b/g,'')+(yes?'':' hidden');}
  function tell(s) {var node=id('vmm-w-status');if(node) node.textContent=s||''; }
  function refocus(){var e=id('vmm-search');if(!e)return;e.focus();try{var p=e.value.length;e.setSelectionRange(p,p);}catch(ignore){}}
  function ts(){return firebase.firestore.FieldValue.serverTimestamp();}
  function platformKey(k){return k==='apple'?'appleMusic':k==='vkArtist'?'vk':k;}
  function asDate(value) {
    if(!value)return null;
    if(value&&typeof value.toDate==='function')return value.toDate();
    if(value&&typeof value.seconds==='number')return new Date(value.seconds*1000);
    // The 2026 legacy audit export contains Google Sheets serial dates (e.g. 46312.5).
    // Test this BEFORE Date.parse: JS interprets five-digit integers as calendar years.
    var str=String(value).trim();
    if(/^\d{4,6}(?:\.\d+)?$/.test(str)){
      var serial=Number(str);
      if(serial>20000&&serial<90000)return new Date(Math.round((serial-25569)*86400000));
    }
    var parsed=Date.parse(str);
    return isFinite(parsed)?new Date(parsed):null;
  }
  function formattedDate(value) {
    var d=asDate(value);
    if(!d || isNaN(d.getTime()))return String(value||'').slice(0,50);
    var str=String(value).trim();
    if(/^\d{4,6}(?:\.\d+)?$/.test(str) && Number(str)>20000 && Number(str)<90000){
      // A Sheets serial contains local wall-clock time with no time zone.
      function pad(n){return ('0'+n).slice(-2);}
      return pad(d.getUTCDate())+'.'+pad(d.getUTCMonth()+1)+'.'+d.getUTCFullYear()+' '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());
    }
    return d.toLocaleString('ru-RU');
  }
  function millis(value) {
    var d=asDate(value);
    return d&&!isNaN(d.getTime())?d.getTime():0;
  }
  function authenticated(fn) {
    if (!id('workspace') || id('workspace').className.indexOf('hidden') !== -1) {pane.innerHTML='<p>Необходим вход владельца.</p>';return;}
    if (!window.firebase || !firebase.apps.length) {pane.innerHTML='<p>Firebase ещё загружается.</p>';return;}
    var u=firebase.auth().currentUser;
    if(!u || !u.emailVerified || !u.providerData.some(function(p){return p.providerId==='google.com';})){pane.innerHTML='<p>Авторизуйся через Google.</p>';return;}
    var database=firebase.firestore();
    database.collection('vmm_admins').doc(u.uid).get({source:'server'}).then(function(s){
      if(!s.exists || !s.data() || s.data().enabled!==true) throw new Error('Нет доступа администратора.');
      user=u;db=database;fn();
    }).catch(function(e){busy=false;pane.innerHTML='<h2>Доступ не подтверждён</h2><p>'+esc(e.message)+'</p>';});
  }
  function navActive(key){
    var buttons=document.querySelectorAll('#workspace [data-panel]');
    for(var i=0;i<buttons.length;i++)buttons[i].className=buttons[i].getAttribute('data-panel')===key?'nav-active':'';
    show(id('panel-lyrics'),false);show(id('panel-landing'),false);
    show(id('panel-future'),false);show(id('panel-data'),false);show(pane,true);
  }
  function loading(title) {pane.innerHTML='<h2>'+esc(title)+'</h2><p id="vmm-w-status" class="sync-note">Читаем записи из защищённой базы…</p>';}
  function row(s){var x=parseInt(s,10);return isFinite(x)&&x>=2?x:0;}
  function findTrack(n) {var r=row(n);for(var i=0;i<catalog.length;i++)if(Number(catalog[i].sourceRow)===r)return catalog[i];return null;}
  function getDocs(name){return db.collection(name).limit(1200).get({source:'server'}).then(function(s){var a=[];s.forEach(function(d){if(name==='vmm_links'&&(d.id==='artist_track_assignments_v1'||d.id==='artist_registry_v1'||d.id==='manual_catalog_sequence_v1'))return;var x=d.data();x.id=d.id;a.push(x);});return a;});}
  function loadCommon(then) {
    Promise.all([getDocs('vmm_catalog'),getDocs('vmm_links')]).then(function(a){catalog=a[0];proposals=a[1];then();}).catch(function(e){pane.innerHTML='<h2>Ошибка загрузки</h2><p>'+esc(e.message)+'</p><button data-act="retry">Повторить</button>';});
  }
  function urlValue(t,k){
    if(!t||!t.links)return '';
    if(k==='yandex'){
      // Legacy links.yandex and column 14 are album references; keep them intact.
      return t.links.yandexTrack || (direct('yandex',t.links.yandex||'')?t.links.yandex:'');
    }
    return t.links[k]||'';
  }
  function direct(k,u){
    u=tr(u);
    if(!/^https:\/\//i.test(u))return false;
    if(k==='spotify')return /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]{22}(?:[?#].*)?$/i.test(u);
    if(k==='appleMusic')return /^https:\/\/music\.apple\.com\/[A-Za-z0-9-]+\/(?:album\/[^?#]+\?[^#]*\bi=\d+|song\/[^?#]+)(?:[&#?].*)?$/i.test(u);
    if(k==='youtube')return /^https:\/\/(?:www\.)?youtu\.be\/[A-Za-z0-9_-]{11}(?:[?#].*)?$/i.test(u)||/^https:\/\/(?:www\.)?youtube\.com\/watch\?[^#]*\bv=[A-Za-z0-9_-]{11}(?:[&#].*)?$/i.test(u)||/^https:\/\/music\.youtube\.com\/watch\?[^#]*\bv=[A-Za-z0-9_-]{11}(?:[&#].*)?$/i.test(u);
    if(k==='yandex')return /^https:\/\/music\.yandex\.(ru|com)\/(?:album\/\d+\/track\/\d+|track\/\d+)(?:[?#].*)?$/i.test(u);
    if(k==='vk')return /^https:\/\/(?:music\.)?vk\.com\/(?:audio[-\d_]+|music\/[^\s]+)(?:[?#].*)?$/i.test(u);
    if(k==='zvuk')return /^https:\/\/(?:zvuk\.com|zvuk\.ru)\/track\/[^\s]+$/i.test(u);
    return false;
  }
  function spotifyAlbum(u){return /^https:\/\/open\.spotify\.com\/album\//i.test(tr(u));}
  function normalized(k,u){
    u=tr(u);
    if(k==='spotify'){var m=u.match(/\/track\/([A-Za-z0-9]{22})/i);return m?m[1]:u.split('?')[0];}
    if(k==='youtube'){var y=u.match(/(?:[?&]v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i);return y?y[1]:u.split('?')[0];}
    if(k==='appleMusic'){var song=u.match(/[?&]i=(\d+)/i);if(song)return 'apple-song-'+song[1];}
    return u.split('?')[0].replace(/\/$/,'').toLowerCase();
  }
  function metrics() {
    var m={total:catalog.length,spotify:0,appleMusic:0,youtube:0,all:0,spotifyAlbum:0};
    catalog.forEach(function(t){var n=0;if(spotifyAlbum(urlValue(t,'spotify')))m.spotifyAlbum++;['spotify','appleMusic','youtube'].forEach(function(k){if(direct(k,urlValue(t,k))){m[k]++;n++;}});if(n===3)m.all++;});
    return m;
  }
  function flags(t) {
    return ['appleMusic','spotify','youtube'].map(function(k){
      var ok=direct(k,urlValue(t,k)),partial=k==='spotify'&&spotifyAlbum(urlValue(t,k));
      return '<span class="vmm-flag '+(ok?'yes':partial?'partial':'')+'" title="'+esc(platforms[k]+(ok?' · трек найден':' · ссылка отсутствует'))+'">'+(k==='appleMusic'?'A':k==='spotify'?'S':'Y')+'</span>';
    }).join('');
  }
  function searchRows(){
    var q=tr(filter).toLocaleLowerCase('ru').replace(/ё/g,'е');
    return catalog.filter(function(t){
      if(q && [t.title,t.artist,siteArtist(t),t.album,t.upc,t.isrc,t.searchTags,t.searchDescription].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)<0)return false;
      if(artist!=='all'&&siteArtist(t)!==artist)return false;
      if(mode==='missing')return !direct('spotify',urlValue(t,'spotify'))||!direct('appleMusic',urlValue(t,'appleMusic'))||!direct('youtube',urlValue(t,'youtube'));
      if(mode==='ready')return ['spotify','appleMusic','youtube'].every(function(k){return direct(k,urlValue(t,k));});
      if(mode==='spotify'||mode==='appleMusic'||mode==='youtube')return !direct(mode,urlValue(t,mode));
      return true;
    });
  }
  function heading(title,sub){return '<div class="vmm-head"><div><p class="eyebrow">VELARDREAM · MUSIC MANAGER</p><h2>'+esc(title)+'</h2><p class="sync-note">'+esc(sub||'')+'</p></div><button class="btn-small" data-act="retry">↻ Обновить</button></div>';}
  function linkButton(u,text){return safeUrl(u)?'<a class="vmm-out" target="_blank" rel="noopener noreferrer" href="'+esc(u)+'">'+esc(text)+'</a>':'<span class="muted">Не установлена</span>';}
  function progressCard(label,filled,total,detail,kind){
    var pct=total?Math.round(100*filled/total):0,missing=Math.max(0,total-filled);
    return '<div class="vmm-progress-card '+esc(kind||'')+'">'+
      '<span class="vmm-progress-title">'+esc(label)+'</span>'+
      '<strong class="vmm-progress-count">'+filled+' <small>/ '+total+'</small></strong>'+
      '<span class="vmm-progress-meta">'+esc(detail||('Не хватает: '+missing))+'</span>'+
      '<div class="vmm-progress-line" role="progressbar" aria-label="'+esc(label)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><span style="width:'+pct+'%"></span></div>'+
      '<div class="vmm-progress-percent">'+pct+'% <small>заполнено</small></div></div>';
  }
  function overview() {
    if(!catalog.length){pane.innerHTML=heading('Обзор каталога','Данные доступны только владельцу')+'<div class="vmm-card"><h3>Каталог Firestore пока пуст</h3><p>Исходный Google Apps Script и резервная копия не затронуты. Если перенос ещё не выполнялся, открой безопасный импорт и проверь файл перед загрузкой.</p><button data-act="open-import">Открыть импорт данных</button></div>';return;}
    var m=metrics(),todo=catalog.filter(function(t){return !direct('spotify',urlValue(t,'spotify'))||!direct('appleMusic',urlValue(t,'appleMusic'))||!direct('youtube',urlValue(t,'youtube'));});
    var totalSlots=m.total*3,doneSlots=m.spotify+m.appleMusic+m.youtube;
    var overall=totalSlots?Math.round(100*doneSlots/totalSlots):0;
    pane.innerHTML=heading('Обзор каталога','Статистика по прямым ссылкам на песни · Spotify, Apple Music, YouTube')+'<div class="vmm-actions"><button data-act="new-release">+ Добавить песню</button><button data-act="artist-manager">Управление артистами</button></div>'+
      '<div class="vmm-metrics vmm-metrics-progress">'+
      progressCard('Всего композиций',m.total,m.total,'Единый музыкальный каталог','releases')+
      progressCard('Apple Music',m.appleMusic,m.total,'Не хватает: '+(m.total-m.appleMusic),'apple')+
      progressCard('Spotify',m.spotify,m.total,'Не хватает: '+(m.total-m.spotify)+(m.spotifyAlbum?' · '+m.spotifyAlbum+' альбомов вместо треков':''),'spotify')+
      progressCard('YouTube',m.youtube,m.total,'Не хватает: '+(m.total-m.youtube),'youtube')+
      '</div>'+
      '<div class="vmm-card vmm-overall"><div class="vmm-overall-head"><h3>Общая готовность ссылок</h3><strong>'+overall+'%</strong></div>'+
      '<p class="sync-note">'+doneSlots+' из '+totalSlots+' ссылок заполнено · '+(totalSlots-doneSlots)+' отсутствуют · релизов со всеми тремя площадками: '+m.all+' из '+m.total+'</p>'+
      '<div class="vmm-progress-line vmm-total-progress" role="progressbar" aria-label="Общая готовность ссылок" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+overall+'"><span style="width:'+overall+'%"></span></div></div>'+
      '<h3>Требуют проверки: '+todo.length+' композиций</h3>'+
      '<div class="vmm-rows">'+todo.slice(0,12).map(function(t){return '<button data-act="track" data-row="'+row(t.sourceRow)+'"><strong>'+esc(t.title)+'</strong><small>'+esc(t.artist)+' · '+flags(t)+'</small></button>';}).join('')+'</div>'+
      '<div class="vmm-actions"><button data-act="missing-catalog">Показать все недостающие ссылки</button></div>';
  }


  /* RUN-NEW: owner-only artist registry and manual release editor. */
  var registry=[],registryRevision=0,artistOverrides={};
  function canonicalArtistName(name){return /^(?:dj\s+)?velar$/i.test(tr(name))?'Velar':tr(name);}
  function siteArtist(t){
    if(t&&window.VMM_ARTIST_TRACKS&&window.VMM_ARTIST_CHOICES){var artistId=window.VMM_ARTIST_TRACKS.effective(t,artistOverrides);var custom=registry.filter(function(a){return a.id===artistId;})[0];if(custom)return canonicalArtistName(custom.name);var choice=window.VMM_ARTIST_CHOICES.byId(window.VMM_ARTIST_CHOICES.choices(catalog),artistId);if(choice)return canonicalArtistName(choice.label);}
    return canonicalArtistName(t&&t.artist||'');
  }
  function artistList(){
    // RUN-130: exactly three canonical stage names in Studio.
    return ['Velar','Илья Дмитриев','Crazy Bobr'];
  }
  function artistOptions(value){return artistList().map(function(n){return '<option value="'+esc(n)+'"'+(n===value?' selected':'')+'>'+esc(n)+'</option>';}).join('');}
  function loadRegistry(done){
    db.collection('vmm_links').doc('artist_registry_v1').get({source:'server'}).then(function(s){
      var d=s.exists?s.data()||{}:{};
      registry=Array.isArray(d.artists)?d.artists:[];registryRevision=Number(d.revision)||0;
      if(window.VMM_ARTIST_TRACKS)window.VMM_ARTIST_TRACKS.read(db).then(function(v){artistOverrides=v.overrides;done();}).catch(function(e){pane.innerHTML='<h2>Ошибка привязок артистов</h2><p>'+esc(e.message)+'</p><button data-act="retry">Повторить</button>';});else done();
    }).catch(function(e){pane.innerHTML='<h2>Ошибка загрузки артистов</h2><p>'+esc(e.message)+'</p><button data-act="retry">Повторить</button>';});
  }
  function artistManager(){
    pane.innerHTML=heading('Управление артистами','Создавай новых исполнителей и назначай им песни без изменения официальных кредитов')+
      '<form id="vmm-artist-create" class="vmm-card"><h3>Добавить исполнителя</h3><label>Сценическое имя<input name="name" maxlength="120" required placeholder="Название артиста"></label><div class="vmm-actions"><button type="submit">Сохранить артиста</button><button type="button" data-act="catalog">К каталогу</button></div><p id="vmm-w-status" class="sync-note"></p></form>'+
      '<div class="vmm-card"><h3>Исполнители и статистика</h3><p class="sync-note">Загружено песен из каталога: '+catalog.length+'. Непривязанных: '+catalog.filter(function(t){return !siteArtist(t);}).length+'. Назначение по официальному имени выполняется автоматически.</p>'+artistList().map(function(n){var songs=catalog.filter(function(t){return siteArtist(t)===n;});return '<p><strong>'+esc(n)+'</strong> · '+songs.length+' песен · выпущено '+songs.filter(function(t){return !t.releaseStatus||t.releaseStatus==='released';}).length+' · ожидают '+songs.filter(function(t){return t.releaseStatus==='scheduled';}).length+' · черновики '+songs.filter(function(t){return t.releaseStatus==='draft';}).length+'</p>';}).join('')+'</div>';
    id('vmm-artist-create').onsubmit=function(e){
      e.preventDefault();if(busy)return;var name=canonicalArtistName(this.elements.name.value);
      if(name.length<2||name.length>120)return tell('Имя должно содержать от 2 до 120 символов.');
      if(artistList().some(function(n){return n.toLowerCase()===name.toLowerCase();}))return tell('Такой исполнитель уже существует.');
      busy=true;authenticated(function(){
        var ref=db.collection('vmm_links').doc('artist_registry_v1'),audit=db.collection('vmm_audit').doc();
        db.runTransaction(function(tx){return tx.get(ref).then(function(s){
          var d=s.exists?s.data()||{}:{},arr=Array.isArray(d.artists)?d.artists.slice():[];
          if(arr.some(function(a){return canonicalArtistName(a.name).toLowerCase()===name.toLowerCase();})||window.VMM_ARTIST_CHOICES.choices(catalog).some(function(a){return canonicalArtistName(a.label).toLowerCase()===name.toLowerCase();}))throw new Error('Исполнитель уже существует в каталоге или реестре.');
          if(arr.length>=300)throw new Error('Достигнут лимит артистов.');
          arr.push({id:'custom-'+db.collection('vmm_catalog').doc().id.toLowerCase(),name:name,createdBy:user.uid});
          tx.set(ref,{schemaVersion:1,revision:(Number(d.revision)||0)+1,artists:arr,updatedAt:ts(),updatedBy:user.uid});
          tx.set(audit,{time:ts(),operation:'Создан исполнитель',subject:name,result:'Сохранён в приватном реестре',actor:user.uid});
        });}).then(function(){busy=false;loadRegistry(artistManager);}).catch(function(err){busy=false;tell('Ошибка: '+err.message);});
      });
    };
  }
  function releaseEditor(docId){
    var t=docId?catalog.filter(function(x){return x.id===docId;})[0]:null;
    if(docId&&!t)return catalogPage();
    var currentArtist=t?siteArtist(t):'';
    pane.innerHTML=heading(t?'Редактировать композицию':'Новая композиция','Сохранение только в приватном каталоге; публикация на главной выполняется отдельно')+
      '<form id="vmm-release-editor" class="vmm-card"><label>Название песни<input name="title" required maxlength="220" value="'+esc(t?t.title:'')+'"></label>'+
      '<label>Исполнитель на сайте<select name="siteArtist" required><option value="">Выбери исполнителя</option>'+artistOptions(currentArtist)+'</select></label>'+
      '<label>Официальный исполнитель релиза<input name="artist" maxlength="220" value="'+esc(t?t.artist:'')+'" placeholder="Как указано на площадках"></label>'+
      '<label>UPC (можно позже)<input name="upc" maxlength="40" value="'+esc(t?t.upc:'')+'"></label>'+
      '<label>ISRC (можно позже)<input name="isrc" maxlength="40" value="'+esc(t?t.isrc:'')+'"></label>'+
      '<label>О чём песня? (публичное описание темы)<textarea name="searchDescription" maxlength="280" rows="3" placeholder="Например: Именная песня-подарок для Михаила">'+esc(t?t.searchDescription||'':'')+'</textarea></label>'+ 
      '<label>Поисковые теги через запятую<input name="searchTags" maxlength="640" value="'+esc(t?t.searchTags||'':'')+'" placeholder="Миша, Михаил, именная песня, подарок, день рождения"></label>'+ 
      '<p class="sync-note">Теги помогают найти песню по имени и теме. Не меняют официальное название; на сайте появляются только после отдельной публикации релиза.</p>'+ 
      '<label>Статус<select name="releaseStatus"><option value="draft">Черновик</option><option value="scheduled">Ожидает релиза</option><option value="released">Выпущена</option></select></label>'+
      '<label>Дата релиза<input name="releaseDate" type="date" value="'+esc(t?t.releaseDate||'':'')+'"></label>'+
      '<div class="vmm-actions"><button type="submit">Сохранить</button><button type="button" data-act="catalog">Отмена</button><button type="button" data-act="artist-manager">+ Исполнитель</button></div><p id="vmm-w-status" class="sync-note"></p></form>';
    id('vmm-release-editor').elements.releaseStatus.value=t&&t.releaseStatus||'draft';
    id('vmm-release-editor').onsubmit=function(e){
      e.preventDefault();if(busy)return;
      var f=this.elements,title=tr(f.title.value),siteArtist=tr(f.siteArtist.value),official=tr(f.artist.value)||siteArtist;
      var upc=tr(f.upc.value),isrc=tr(f.isrc.value),status=f.releaseStatus.value,date=f.releaseDate.value;
      var meta=window.VELAR_SONG_SEARCH_META,searchTags='',searchDescription='';
      if(!meta)return tell('Не загрузился модуль поисковых тегов. Обнови страницу.');
      try{searchTags=meta.normalizeTags(f.searchTags.value);searchDescription=meta.normalizeDescription(f.searchDescription.value);}
      catch(tagError){return tell('Ошибка тегов: '+tagError.message);}
      if(!title||!siteArtist||!artistList().some(function(n){return n===siteArtist;}))return tell('Выбери существующего артиста и укажи название.');
      if(status==='scheduled'&&!date)return tell('Для ожидающего релиза укажи дату.');
      if(catalog.some(function(x){return x.id!==docId&&tr(x.title).toLowerCase()===title.toLowerCase()&&tr(x.artist).toLowerCase()===official.toLowerCase()&&((isrc&&tr(x.isrc)===isrc)||(!isrc&&(!upc||tr(x.upc)===upc)))}))return tell('Похожая песня уже есть в каталоге. Проверь дубликат.');
      if(!docId&&!window.confirm('Добавить новую запись в приватный каталог?'))return;
      busy=true;authenticated(function(){
        var target=docId?db.collection('vmm_catalog').doc(docId):db.collection('vmm_catalog').doc(),audit=db.collection('vmm_audit').doc();
        var max=catalog.reduce(function(n,x){return Math.max(n,row(x.sourceRow));},1);
        var counter=db.collection('vmm_links').doc('manual_catalog_sequence_v1');
        var assignmentRef=db.collection('vmm_links').doc('artist_track_assignments_v1');
        db.runTransaction(function(tx){
          return Promise.all([tx.get(counter),tx.get(assignmentRef)]).then(function(results){
            var c=results[0],a=results[1];
            var sequence=Math.max(max,Number(c.exists&&c.data().lastRow)||1,1000000)+1;
            var data={title:title,releaseStatus:status,releaseDate:date,
              searchTags:searchTags,searchDescription:searchDescription,
              updatedBy:user.uid,updatedAt:ts()};
            if(!docId||t&&t.origin==='studio-manual'){data.artist=official;data.upc=upc;data.isrc=isrc;}
            else if(official!==tr(t.artist)||upc!==tr(t.upc)||isrc!==tr(t.isrc))throw new Error('Официальные кредиты импортированного релиза защищены от изменения.');
            if(!docId){data.sourceRow=sequence;data.createdAt=ts();data.origin='studio-manual';data.links={};tx.set(counter,{lastRow:sequence,updatedAt:ts()});tx.set(target,data);}
            else tx.update(target,data);
            var choices=window.VMM_ARTIST_CHOICES&&window.VMM_ARTIST_CHOICES.choices(catalog)||[];
            var match=choices.filter(function(x){return x.label===siteArtist;})[0]||registry.filter(function(x){return canonicalArtistName(x.name)===siteArtist;})[0];
            if(!match)throw new Error('Артист отсутствует в реестре.');
            var existing=a.exists?a.data()||{}:{},map=Object.assign({},existing.overrides||{});
            if(Object.keys(map).length>=1900&&!map[target.id])throw new Error('Лимит индивидуальных привязок почти достигнут.');
            map[target.id]=match.id;
            tx.set(assignmentRef,{schemaVersion:1,revision:(Number(existing.revision)||0)+1,overrides:map,updatedAt:ts(),updatedBy:user.uid});
            tx.set(audit,{time:ts(),operation:docId?'Композиция изменена':'Композиция добавлена',subject:title,result:siteArtist+' · '+status,referenceId:target.id,actor:user.uid});
          });
        }).then(function(){busy=false;open('catalog');}).catch(function(err){busy=false;tell('Ошибка сохранения: '+err.message);});
      });
    };
  }

  function catalogPage(){
    if(!catalog.length){pane.innerHTML=heading('Каталог релизов','Защищённая база данных')+'<div class="vmm-actions"><button data-act="new-release">+ Добавить песню</button><button data-act="artist-manager">Управление артистами</button></div><div class="vmm-card"><h3>В Firebase пока нет композиций</h3><p>Для заполнения используй прежний файл импорта. Не создавай дубликаты вручную.</p><button data-act="open-import">Открыть безопасный импорт</button></div>';return;}
    var a=searchRows(),begin=page*30;if(begin>=a.length&&page>0){page=0;begin=0;}
    var allArtists=Object.create(null);artistList().forEach(function(n){allArtists[n]=true;});
    var actorOptions=Object.keys(allArtists).sort().map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>';}).join('');
    var picked=Object.keys(chosen).filter(function(k){return chosen[k];}).length;
    pane.innerHTML=heading('Каталог релизов','Поиск по названию, артисту, теме, тегам, UPC и ISRC')+
      '<div class="vmm-actions"><button data-act="new-release">+ Добавить песню</button><button data-act="artist-manager">Управление артистами</button></div><div class="vmm-filter"><input id="vmm-search" type="search" placeholder="Название, имя, тема, тег, UPC, ISRC" value="'+esc(filter)+'">'+
      '<select id="vmm-mode"><option value="all">Все</option><option value="missing">Недостающие ссылки</option><option value="ready">Все три площадки</option><option value="spotify">Без Spotify</option><option value="appleMusic">Без Apple Music</option><option value="youtube">Без YouTube</option></select>'+
      '<select id="vmm-artist"><option value="all">Все артисты</option>'+actorOptions+'</select></div>'+
      '<div class="vmm-action-links"><button data-act="bulk-artist">Перенести выбранные песни к артисту</button><button data-act="print-catalog">Печать / PDF каталога</button><button data-act="clear-selection">Снять отметки</button><span id="vmm-selected-count" class="sync-note">Выбрано: '+picked+' (если ничего не выбрано, печатается весь каталог)</span></div>'+
      '<div class="vmm-rows">'+a.slice(begin,begin+30).map(function(t){
        var r=row(t.sourceRow);
        return '<div class="vmm-catalog-row"><label class="vmm-row-select"><input type="checkbox" data-vmm-select="'+r+'"'+(chosen[r]?' checked':'')+'> Выбрать</label>'+
        '<button data-act="track" data-row="'+r+'"><strong>'+esc(t.title)+'</strong><small>'+esc(siteArtist(t))+' · '+esc(t.upc||'нет UPC')+' · '+esc(t.isrc||'нет ISRC')+'</small><span class="vmm-flags">'+flags(t)+'</span></button></div>';
      }).join('')+'</div><div class="vmm-paging"><span>Записей: '+a.length+' · '+(a.length?begin+1:0)+'–'+Math.min(begin+30,a.length)+'</span><div><button data-act="prev" '+(!page?'disabled':'')+'>← Назад</button><button data-act="next" '+(begin+30>=a.length?'disabled':'')+'>Далее →</button></div></div>';
    id('vmm-mode').value=mode;id('vmm-artist').value=artist;
    id('vmm-search').oninput=function(){filter=this.value;page=0;catalogPage();refocus();};
    id('vmm-mode').onchange=function(){mode=this.value;page=0;catalogPage();};
    id('vmm-artist').onchange=function(){artist=this.value;page=0;catalogPage();};
  }

  function bulkArtist(){
    var tracks=catalog.filter(function(t){return chosen[row(t.sourceRow)];});
    if(tracks.length>450)return tell('Для безопасной пакетной записи выбери не более 450 песен.');
    if(!tracks.length)return tell('Сначала отметь песни для переноса.');
    pane.innerHTML=heading('Перенос песен','Меняется только исполнитель на сайте, официальные данные релиза сохраняются')+
      '<form id="vmm-bulk-artist" class="vmm-card"><p>Выбрано песен: '+tracks.length+'</p><label>Новый артист<select name="artist" required><option value="">Выбери артиста</option>'+artistOptions('')+'</select></label>'+
      '<div class="vmm-actions"><button type="submit">Перенести песни</button><button type="button" data-act="catalog">Отмена</button></div><p id="vmm-w-status" class="sync-note"></p></form>';
    id('vmm-bulk-artist').onsubmit=function(e){
      e.preventDefault();if(busy)return;var name=tr(this.elements.artist.value);
      if(!artistList().some(function(n){return n===name;}))return tell('Выбери исполнителя из списка.');
      if(!window.confirm('Назначить '+tracks.length+' песен артисту «'+name+'»? Официальные сведения останутся прежними.'))return;
      busy=true;authenticated(function(){
        var choices=window.VMM_ARTIST_CHOICES&&window.VMM_ARTIST_CHOICES.choices(catalog)||[];
        var match=choices.filter(function(a){return a.label===name;})[0]||registry.filter(function(a){return canonicalArtistName(a.name)===name;})[0];
        if(!match||!window.VMM_ARTIST_TRACKS){busy=false;return tell('Модуль привязки артистов недоступен.');}
        window.VMM_ARTIST_TRACKS.read(db).then(function(snapshot){
          var ids=tracks.map(function(t){return t.id;}),map=Object.assign({},snapshot.overrides);
          ids.forEach(function(id){map[id]=match.id;});
          var ref=db.collection('vmm_links').doc('artist_track_assignments_v1');
          return db.runTransaction(function(tx){return tx.get(ref).then(function(s){
            var d=s.exists?s.data()||{}:{},rev=Number(d.revision)||0;
            if(rev!==snapshot.revision)throw new Error('Назначения изменились, обнови страницу.');
            if(Object.keys(d.overrides||{}).length+ids.length>2000)throw new Error('Лимит привязок: раздели операцию или обратись к администратору.');
            var next=Object.assign({},d.overrides||{});
            ids.forEach(function(id){next[id]=match.id;});
            tx.set(ref,{schemaVersion:1,revision:rev+1,overrides:next,updatedBy:user.uid,updatedAt:ts()});
            tx.set(db.collection('vmm_audit').doc(),{time:ts(),operation:'Массовое назначение артиста',subject:name,result:'Композиций: '+tracks.length,actor:user.uid});
          });});
        }).then(function(){busy=false;chosen=Object.create(null);open('catalog');}).catch(function(err){busy=false;tell('Ошибка переноса: '+err.message);});
      });
    };
  }
  function printCatalog(){
    var selection=Object.keys(chosen).filter(function(k){return chosen[k];});
    var rows=catalog.filter(function(t){return !selection.length||chosen[row(t.sourceRow)];});
    if(!rows.length){tell('Каталог пока пуст.');return;}
    var popup=window.open('about:blank','_blank');
    if(!popup){tell('Safari заблокировал окно печати. Разреши всплывающие окна.');return;}
    var cells=rows.map(function(t){return '<tr><td>'+esc(t.title)+'</td><td>'+esc(t.artist)+'</td><td>'+esc(t.upc)+'</td><td>'+esc(t.isrc)+'</td></tr>';}).join('');
    var html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VELAR · Каталог</title><style>'+
      '@page{size:A4;margin:11mm}body{font:11px/1.4 Arial,sans-serif;color:#111;background:#fff}h1{font-size:21px;margin:0 0 7px}p{color:#444;margin:0 0 14px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #bbb;padding:5px 3px;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}#bar{padding:10px 0}#bar button{font:15px Arial;padding:8px 15px}@media print{#bar{display:none}}'+
      '</style></head><body><div id="bar"><button id="print-action">Печать / PDF</button></div><h1>VELAR · Музыкальный каталог</h1><p>Композиции: '+rows.length+'</p><table><thead><tr><th>Название</th><th>Исполнитель</th><th>UPC</th><th>ISRC</th></tr></thead><tbody>'+cells+'</tbody></table></body></html>';
    try{popup.document.open();popup.document.write(html);popup.document.close();popup.document.getElementById('print-action').onclick=function(){popup.print();};popup.focus();}
    catch(e){try{popup.close();}catch(ignore){}tell('Не удалось открыть печать: '+e.message);}
  }

  function searchUrl(k,t){
    var q=encodeURIComponent([t.title,t.artist].join(' '));
    return k==='spotify'?'https://open.spotify.com/search/'+q:k==='appleMusic'?'https://music.apple.com/fi/search?term='+q:'https://music.youtube.com/search?q='+q;
  }
  function trackPage(n){
    var t=findTrack(n);if(!t){catalogPage();return;}
    selected=String(t.sourceRow);
    var body=heading(t.title,siteArtist(t)+' · UPC '+(t.upc||'—')+' · ISRC '+(t.isrc||'—'));
    body+='<div class="vmm-card"><h3>Подтверждённые адреса</h3>';
    ['appleMusic','spotify','youtube','yandex','zvuk'].forEach(function(k){
      var u=urlValue(t,k),ok=direct(k,u);
      body+='<div class="vmm-detail"><strong>'+esc(platforms[k])+'</strong><span>'+ (ok?linkButton(u,'Открыть трек'):k==='spotify'&&spotifyAlbum(u)?linkButton(u,'Альбом · заменить'): '<span class="muted">Нет подтверждённой прямой ссылки</span>')+'</span></div>';
    });
    if(t.links&&safeUrl(t.links.yandex)&&/^https:\/\/music\.yandex\.(?:ru|com)\/album\//i.test(t.links.yandex))body+='<div class="vmm-detail"><strong>Яндекс Музыка · альбом</strong><span>'+linkButton(t.links.yandex,'Открыть альбом')+'</span></div>';
    if(t.links&&safeUrl(t.links.vkArtist))body+='<div class="vmm-detail"><strong>VK · профиль исполнителя</strong><span>'+linkButton(t.links.vkArtist,'Открыть профиль')+'</span></div>';
    body+='</div><div class="vmm-card"><h3>Найти композицию</h3><div class="vmm-action-links">'+['spotify','appleMusic','youtube'].map(function(k){return linkButton(searchUrl(k,t),platforms[k]);}).join('')+'</div><p class="sync-note">Поисковые ссылки не считаются прямыми URL треков.</p></div>';
    body+='<div class="vmm-card"><h3>Темы и поисковые теги</h3><p>'+esc(t.searchDescription||'Тема ещё не описана')+'</p><p class="sync-note">'+esc(t.searchTags||'Теги не указаны')+'</p></div>'+ 
      '<div class="vmm-actions"><button data-act="edit-release" data-id="'+esc(t.id)+'">✎ Редактировать запись</button><button data-act="propose" data-row="'+row(t.sourceRow)+'">+ Предложить ссылку</button><button data-act="lyrics-track" data-row="'+row(t.sourceRow)+'">✎ Текст песни</button><button data-act="catalog">← К каталогу</button></div>';
    pane.innerHTML=body;
  }
  function proposalForm(n){
    var t=findTrack(n);if(!t)return;
    selected=String(t.sourceRow);
    pane.innerHTML=heading('Предложить прямую ссылку',t.title+' · '+t.artist)+'<form id="vmm-proposal-form"><label>Площадка<select name="platform"><option value="spotify">Spotify</option><option value="appleMusic">Apple Music</option><option value="youtube">YouTube</option><option value="yandex">Яндекс Музыка</option><option value="vk">VK Музыка</option><option value="zvuk">Звук</option></select></label><label>Прямая ссылка на трек<input type="url" name="url" required maxlength="800" placeholder="https://..."></label><p class="sync-note">Сначала попадёт в очередь. Основной каталог изменится только после ручного подтверждения.</p><div class="vmm-actions"><button type="submit">Добавить на проверку</button><button type="button" data-act="track" data-row="'+row(t.sourceRow)+'">Отмена</button></div><p id="vmm-w-status" class="sync-note"></p></form>';
    id('vmm-proposal-form').onsubmit=function(e){
      e.preventDefault();if(busy)return;var f=this,k=f.elements.platform.value,u=tr(f.elements.url.value);
      if(!direct(k,u))return tell('Разрешены только прямые адреса конкретных треков; ссылка на альбом или поиск не подходит.');
      var existing=urlValue(t,k);
      if(direct(k,existing)&&normalized(k,existing)===normalized(k,u))return tell('Эта прямая ссылка уже сохранена в каталоге.');
      if(direct(k,existing)&&!window.confirm('В каталоге уже есть подтверждённая ссылка. Создать отдельное предложение для её ручной замены? Старая ссылка останется без изменений до подтверждения.'))return;
      if(proposals.some(function(x){return row(x.catalogRow)===row(t.sourceRow)&&platformKey(x.platform)===k&&normalized(k,x.url)===normalized(k,u)&&x.status!=='Отклонено';}))return tell('Такой кандидат уже существует.');
      busy=true;tell('Проверяем право владельца и сохраняем предложение…');
      authenticated(function(){var p=db.collection('vmm_links').doc(),audit=db.collection('vmm_audit').doc(),batch=db.batch();
        batch.set(p,{catalogRow:String(t.sourceRow),title:t.title,platform:k,url:u,status:'Ожидает подтверждения',source:'Ручное добавление · VELARDREAM Studio',replacesUrl:existing||'',createdAt:ts(),updatedAt:ts(),updatedBy:user.uid});
        batch.set(audit,{time:ts(),operation:'Ссылка предложена',subject:t.title,result:k,referenceId:p.id,actor:user.uid});
        batch.commit().then(function(){busy=false;open('platforms');}).catch(function(err){busy=false;tell('Ошибка записи: '+err.message);});
      });
    };
  }
  function pending(x) {return x.status==='Ожидает подтверждения'||x.status==='На проверке'||x.status==='Требует проверки';}
  function platformPage(){
    var q=tr(filter).toLowerCase();
    var items=proposals.filter(function(x){if(mode==='pending'&&!pending(x))return false;if(mode==='approved'&&x.status!=='Подтверждено')return false;if(mode==='rejected'&&x.status!=='Отклонено')return false;return [x.title,x.platform,x.url,x.status].join(' ').toLowerCase().indexOf(q)>=0;});
    var m=metrics(),pendingCount=proposals.filter(pending).length;
    pane.innerHTML=heading('Проверка музыкальных ссылок','Новые кандидаты не изменяют каталог до подтверждения')+
      '<div class="vmm-metrics vmm-metrics-progress">'+
      progressCard('На проверке',pendingCount,proposals.length,'В очереди предложений','releases')+
      progressCard('Apple Music',m.appleMusic,m.total,'Прямых ссылок из каталога','apple')+
      progressCard('Spotify',m.spotify,m.total,'Прямых ссылок из каталога','spotify')+
      progressCard('YouTube',m.youtube,m.total,'Прямых ссылок из каталога','youtube')+'</div>'+
      '<div class="vmm-filter"><input type="search" id="vmm-search" placeholder="Песня, площадка, URL" value="'+esc(filter)+'"><select id="vmm-mode"><option value="pending">Ожидают решения</option><option value="all">Вся история</option><option value="approved">Подтверждённые</option><option value="rejected">Отклонённые</option></select></div>'+
      '<p class="sync-note">В очереди: '+proposals.filter(pending).length+' · в истории: '+proposals.length+'</p><div class="vmm-rows">'+items.slice(0,150).map(function(x){
        return '<div class="vmm-proposal"><div><strong>'+esc(x.title)+'</strong><small>'+esc(platforms[platformKey(x.platform)]||x.platform)+' · '+esc(x.status)+'</small>'+linkButton(x.url,'Открыть для проверки')+'</div><div class="vmm-actions">'+(pending(x)?'<button data-act="approve" data-id="'+esc(x.id)+'">Подтвердить</button><button data-act="reject" data-id="'+esc(x.id)+'">Отклонить</button>':'')+'</div></div>';
      }).join('')+'</div><p id="vmm-w-status" class="sync-note">'+(items.length>150?'Показаны первые 150 результатов; уточни поиск.':'')+'</p>';
    id('vmm-mode').value=mode;
    id('vmm-search').oninput=function(){filter=this.value;platformPage();refocus();};
    id('vmm-mode').onchange=function(){mode=this.value;platformPage();};
  }
  function proposeById(identifier){for(var i=0;i<proposals.length;i++)if(proposals[i].id===identifier)return proposals[i];return null;}
  function approve(identifier) {
    if(busy)return;
    var p=proposeById(identifier);
    if(!p||!pending(p))return tell('Запись уже обработана; обнови страницу.');
    var t=findTrack(p.catalogRow),k=p.platform,u=tr(p.url);
    if(!t)return tell('Песня не найдена по строке каталога; сначала проверь импорт.');
    if(!direct(k,u))return tell('Неправильная прямая ссылка. Подтверждение запрещено.');
    var previous=urlValue(t,k);
    if(direct(k,previous)&&tr(p.replacesUrl)!==tr(previous))return tell('В каталоге уже есть другая прямая ссылка; новое предложение не разрешает её замену.');
    if(previous && k!=='spotify' && safeUrl(previous) && tr(p.replacesUrl)!==tr(previous))return tell('Ссылка уже занята. Для её замены сначала создай отдельное предложение из карточки композиции.');
    if(previous && k==='spotify' && direct(k,previous) && tr(p.replacesUrl)!==tr(previous))return tell('Существующий Spotify-трек нельзя заменить без отдельного подтверждённого предложения.');
    for(var i=0;i<catalog.length;i++){
      var other=catalog[i];if(other.id!==t.id&&direct(k,urlValue(other,k))&&normalized(k,urlValue(other,k))===normalized(k,u))return tell('Такой трек уже закреплён за другой композицией: '+other.title);
    }
    var confirmMessage='Подтверждаешь, что открыл трек и сверил исполнителя, название и идентификаторы?\n'+t.title+'\n'+platforms[k]+'\n'+u;
    if(previous)confirmMessage+='\n\nСуществующая ссылка будет заменена только после твоего согласия:\n'+previous;
    if(!window.confirm(confirmMessage))return;
    busy=true;tell('Записываем подтверждение и журнал одной транзакцией…');
    authenticated(function(){
      var trackRef=db.collection('vmm_catalog').doc(t.id),proposalRef=db.collection('vmm_links').doc(p.id),auditRef=db.collection('vmm_audit').doc();
      db.runTransaction(function(tx){
        return Promise.all([tx.get(trackRef),tx.get(proposalRef)]).then(function(snaps){
          var a=snaps[0],b=snaps[1];if(!a.exists||!b.exists)throw new Error('Запись не найдена.');
          var actual=a.data(),proposal=b.data();
          if(!pending(proposal))throw new Error('Предложение уже обработано.');
          if(row(proposal.catalogRow)!==row(t.sourceRow)||platformKey(proposal.platform)!==k||tr(proposal.url)!==u)throw new Error('Предложение изменилось после открытия. Повтори проверку.');
          var old=(actual.links||{})[k==='yandex'?'yandexTrack':k]||'';if(k==='yandex'&&!old&&direct('yandex',(actual.links||{}).yandex||''))old=actual.links.yandex;
          if(direct(k,old)&&tr(proposal.replacesUrl)!==tr(old))throw new Error('Прямая ссылка уже существует. Для замены требуется отдельное предложение с точным прежним URL.');
          if(old && !(k==='spotify'&&spotifyAlbum(old)) && safeUrl(old) && tr(proposal.replacesUrl)!==tr(old))throw new Error('Старая ссылка изменилась, подтвердить замену нельзя.');
          var links={},orig=actual.links||{};Object.keys(orig).forEach(function(key){links[key]=orig[key];});links[k==='yandex'?'yandexTrack':k]=u;
          var rowValues=Array.isArray(actual.legacyRow)?actual.legacyRow.slice():null;
          if(rowValues&&fieldMap[k]!==undefined){rowValues[fieldMap[k]]=u;rowValues[statusMap[k]]='Подтверждено вручную · VELARDREAM Studio';}
          var update={links:links,updatedAt:ts(),updatedBy:user.uid};
          if(rowValues)update.legacyRow=rowValues;
          tx.update(trackRef,update);
          tx.update(proposalRef,{status:'Подтверждено',approvedAt:ts(),approvedBy:user.uid,previousUrl:old});
          tx.set(auditRef,{time:ts(),operation:'Подтверждение ссылки',subject:t.title,result:k,previousUrl:old,newUrl:u,referenceId:p.id,actor:user.uid});
        });
      }).then(function(){busy=false;open('platforms');}).catch(function(e){busy=false;tell('Подтверждение не выполнено: '+e.message);});
    });
  }
  function reject(identifier){
    if(busy)return;var p=proposeById(identifier);
    if(!p||!pending(p))return;
    if(!window.confirm('Отклонить предложение для '+p.title+'? Каталог не изменится.'))return;
    busy=true;
    authenticated(function(){var batch=db.batch(),log=db.collection('vmm_audit').doc();
      batch.update(db.collection('vmm_links').doc(p.id),{status:'Отклонено',reviewedAt:ts(),reviewedBy:user.uid});
      batch.set(log,{time:ts(),operation:'Ссылка отклонена',subject:p.title,result:p.platform,referenceId:p.id,actor:user.uid});
      batch.commit().then(function(){busy=false;open('platforms');}).catch(function(err){busy=false;tell('Ошибка: '+err.message);});
    });
  }
  function extraFields(type) {
    if(type==='contacts')return [['name','Имя / название','text'],['organization','Организация','text'],['email','Email','email'],['role','Роль / специализация','text'],['notes','Заметки','textarea']];
    if(type==='outreach')return [['subject','Тема письма','text'],['recipient','Получатель','text'],['body','Текст черновика','textarea'],['status','Статус (черновик)','text']];
    if(type==='recordings')return [['catalogRow','Строка каталога','number'],['title','Композиция','text'],['type','Тип фонограммы','text'],['description','Описание','textarea'],['url','Ссылка Google Drive','url']];
    if(type==='extras')return [['catalogRow','Строка каталога','number'],['title','Композиция','text'],['platform','Площадка (yandex / vk / zvuk)','text'],['url','Прямая ссылка','url']];
    return [];
  }
  function additionalPage(type) {
    var q=tr(filter).toLowerCase(),a=auxiliary.filter(function(x){return JSON.stringify(x).toLowerCase().indexOf(q)>=0;});
    var title=labels[type],descr=type==='outreach'?'Создание и хранение черновиков. Автоматическая отправка выключена.':'Записи хранятся в защищённой базе владельца.';
    pane.innerHTML=heading(title,descr)+'<div class="vmm-filter"><input id="vmm-search" type="search" placeholder="Поиск по записям" value="'+esc(filter)+'"><button data-act="new-extra">+ Добавить</button></div><p class="sync-note">Всего записей: '+auxiliary.length+'</p><div class="vmm-rows">'+a.slice(0,150).map(function(x){return '<button data-act="edit-extra" data-id="'+esc(x.id)+'"><strong>'+esc(x.name||x.subject||x.title||x.platform||'(Без названия)')+'</strong><small>'+esc(x.organization||x.type||x.recipient||x.url||'Открыть для редактирования')+'</small></button>';}).join('')+'</div><p id="vmm-w-status" class="sync-note"></p>';
    if(type==='contacts'){
      var edit=el('button',{type:'button'});
      edit.textContent='Редактировать темы обращений';
      pane.insertBefore(edit,pane.querySelector('.vmm-filter'));
      edit.onclick=function(){
        var doc=db.collection('velar_contact_settings').doc('topics');
        var defaults='Ошибка на сайте\nЗаказ песни\nВопрос администратору';
        doc.get({source:'server'}).then(function(snapshot){
          if(!pane.contains(edit))return;
          var original=snapshot.exists?snapshot.data().names:null;
          var form=el('form',{}),label=el('label',{}),area=el('textarea',{rows:'7',maxlength:'4000',required:'required'}),save=el('button',{type:'submit'});
          label.textContent='Темы обращения — по одной на строку. Можно добавить, переименовать или убрать тему.';
          area.value=original===null?defaults:original;
          label.appendChild(area);form.appendChild(label);save.textContent='Сохранить темы на сайте';form.appendChild(save);
          edit.parentNode.replaceChild(form,edit);
          form.onsubmit=function(event){
            event.preventDefault();
            var rows=area.value.split(/\n/).map(tr).filter(Boolean);
            if(!rows.length||rows.some(function(row,i){return rows.indexOf(row)!==i;})){tell('Укажите хотя бы одну тему без повторов.');return;}
            var names=rows.join('\n');save.disabled=true;
            db.runTransaction(function(tx){return tx.get(doc).then(function(latest){
              if((latest.exists?latest.data().names:null)!==original)throw new Error('Темы уже изменены. Обновите раздел.');
              tx.set(doc,{names:names});
            });}).then(function(){original=names;tell('Темы опубликованы.');save.disabled=false;}).catch(function(e){tell(e.message);save.disabled=false;});
          };
        }).catch(function(e){tell('Не удалось загрузить темы: '+e.message);});
      };
    }
    id('vmm-search').oninput=function(){filter=this.value;additionalPage(type);refocus();};
  }
  function extraEditor(type,identifier){
    var item=null;for(var i=0;i<auxiliary.length;i++)if(auxiliary[i].id===identifier)item=auxiliary[i];
    var fields=extraFields(type);
    pane.innerHTML=heading(item?'Редактировать запись':'Новая запись',labels[type])+'<form id="vmm-extra-form">'+fields.map(function(f){var value=item&&item[f[0]]||'';return '<label>'+esc(f[1])+(f[2]==='textarea'?'<textarea name="'+f[0]+'" rows="6">'+esc(value)+'</textarea>':'<input name="'+f[0]+'" type="'+f[2]+'" value="'+esc(value)+'" maxlength="5000">')+'</label>';}).join('')+
      '<div class="vmm-actions"><button type="submit">Сохранить</button><button type="button" data-act="back-extra">Отмена</button>'+(item?'<button type="button" class="vmm-danger" data-act="delete-extra" data-id="'+esc(item.id)+'">Удалить запись</button>':'')+'</div><p id="vmm-w-status" class="sync-note"></p></form>';
    id('vmm-extra-form').onsubmit=function(e){
      e.preventDefault();if(busy)return;var form=this,values={};
      fields.forEach(function(f){values[f[0]]=tr(form.elements[f[0]].value);});
      if(type==='contacts'&&!values.name)return tell('Заполни имя или организацию.');
      if(type==='outreach'&&(!values.subject||!values.body))return tell('Нужны тема и текст черновика.');
      if(type==='recordings'&&!/^https:\/\/(?:drive|docs)\.google\.com\//i.test(values.url))return tell('Нужна ссылка на Google Drive.');
      if(type==='extras'&&!direct(values.platform,values.url))return tell('Допустима только прямая ссылка Яндекс / VK / Звук.');
      busy=true;tell('Сохраняем…');authenticated(function(){
        var ref=item?db.collection(collections[type]).doc(item.id):db.collection(collections[type]).doc();
        values.updatedAt=ts();values.updatedBy=user.uid;
        if(!item){values.createdAt=ts();if(type==='outreach')values.status='Черновик';}
        var audit=db.collection('vmm_audit').doc(),batch=db.batch();
        batch.set(ref,values,{merge:true});
        batch.set(audit,{time:ts(),operation:item?'Запись отредактирована':'Запись создана',subject:values.name||values.title||values.subject,result:type,referenceId:ref.id,actor:user.uid});
        batch.commit().then(function(){busy=false;open(type);}).catch(function(err){busy=false;tell('Ошибка сохранения: '+err.message);});
      });
    };
  }
  function deleteExtra(type,identifier) {
    if(busy||!window.confirm('Удалить эту запись? История операции останется в журнале.'))return;
    var item=null;for(var i=0;i<auxiliary.length;i++)if(auxiliary[i].id===identifier)item=auxiliary[i];
    if(!item)return;
    busy=true;authenticated(function(){
      var batch=db.batch(),log=db.collection('vmm_audit').doc();
      batch.delete(db.collection(collections[type]).doc(identifier));
      batch.set(log,{time:ts(),operation:'Запись удалена',subject:item.name||item.title||item.subject||'',result:type,referenceId:identifier,actor:user.uid});
      batch.commit().then(function(){busy=false;open(type);}).catch(function(e){busy=false;tell('Ошибка: '+e.message);});
    });
  }
  function auditPage() {
    auxiliary.sort(function(a,b){return millis(b.time)-millis(a.time);});
    var q=tr(filter).toLowerCase(),items=auxiliary.filter(function(x){return [x.operation,x.subject,x.result,x.time].join(' ').toLowerCase().indexOf(q)>=0;});
    pane.innerHTML=heading('Журнал изменений','История сохраняется отдельно от каталога и текстов')+
      '<div class="vmm-filter"><input type="search" id="vmm-search" placeholder="Поиск события" value="'+esc(filter)+'"></div><p class="sync-note">Всего: '+auxiliary.length+'</p><div class="vmm-rows">'+items.slice(0,180).map(function(x){return '<div class="vmm-audit-line"><strong>'+esc(x.operation)+'</strong><small>'+esc(x.subject)+' · '+esc(x.result)+' · '+esc(formattedDate(x.time))+'</small></div>';}).join('')+'</div>';
    id('vmm-search').oninput=function(){filter=this.value;auditPage();refocus();};
  }
  function open(type) {
    if(type==='data'&&window.VMM_STUDIO&&window.VMM_STUDIO.openData){window.VMM_STUDIO.openData();return;}
    if(!labels[type]||type==='lyrics'||type==='recordings')return;
    if(window.VMM_STUDIO&&window.VMM_STUDIO.rememberPanel)window.VMM_STUDIO.rememberPanel(type);
    current=type;filter='';page=0;mode=type==='platforms'?'pending':'all';navActive(type);loading(labels[type]);
    authenticated(function(){
      if(type==='overview'||type==='catalog'||type==='platforms'){loadCommon(function(){loadRegistry(function(){if(type==='overview')overview();else if(type==='catalog')catalogPage();else platformPage();});});}
      else getDocs(collections[type]).then(function(records){auxiliary=records;if(type==='audit')auditPage();else additionalPage(type);}).catch(function(e){pane.innerHTML='<h2>Ошибка загрузки</h2><p>'+esc(e.message)+'</p>';});
    });
  }
  pane.addEventListener('change',function(e){if(e.target&&e.target.getAttribute('data-vmm-select')){var r=e.target.getAttribute('data-vmm-select');chosen[r]=!!e.target.checked;var n=id('vmm-selected-count');if(n)n.textContent='Выбрано: '+Object.keys(chosen).filter(function(k){return chosen[k];}).length;}});
  pane.addEventListener('click',function(e){
    var t=e.target;while(t&&t!==pane&&!t.getAttribute('data-act'))t=t.parentNode;
    if(!t||t===pane)return;
    var a=t.getAttribute('data-act');
    if(a==='retry')return open(current);
    if(a==='open-import'){if(window.VMM_STUDIO&&window.VMM_STUDIO.openData)window.VMM_STUDIO.openData();var details=id('data-import');if(details){details.open=true;details.scrollIntoView();}return;}
    if(a==='catalog')return open('catalog');
    if(a==='new-release')return releaseEditor(null);
    if(a==='artist-manager')return artistManager();
    if(a==='edit-release')return releaseEditor(t.getAttribute('data-id'));
    if(a==='missing-catalog'){current='catalog';filter='';mode='missing';page=0;navActive('catalog');catalogPage();return;}
    if(a==='print-catalog')return printCatalog();
    if(a==='bulk-artist')return bulkArtist();
    if(a==='clear-selection'){chosen=Object.create(null);return catalogPage();}
    if(a==='prev'){page=Math.max(0,page-1);return catalogPage();}
    if(a==='next'){page++;return catalogPage();}
    if(a==='track')return trackPage(t.getAttribute('data-row'));
    if(a==='lyrics-track'){var lyricTrack=findTrack(t.getAttribute('data-row'));if(!lyricTrack||!window.VMM_STUDIO)return tell('Редактор текстов пока недоступен.');show(pane,false);window.VMM_STUDIO.openForTrack(lyricTrack).catch(function(err){open('catalog');tell('Ошибка редактора: '+err.message);});return;}
    if(a==='propose')return proposalForm(t.getAttribute('data-row'));
    if(a==='approve')return approve(t.getAttribute('data-id'));
    if(a==='reject')return reject(t.getAttribute('data-id'));
    if(a==='new-extra')return extraEditor(current,null);
    if(a==='edit-extra')return extraEditor(current,t.getAttribute('data-id'));
    if(a==='back-extra')return additionalPage(current);
    if(a==='delete-extra')return deleteExtra(current,t.getAttribute('data-id'));
  });
  var sidebar=document.querySelector('#workspace .sidebar');
  var overviewButton=el('button',{'type':'button','data-panel':'overview'});
  overviewButton.textContent='◈ Обзор';
  if(sidebar)sidebar.insertBefore(overviewButton,sidebar.firstChild);
  if(sidebar){
    var extraButton=el('button',{'type':'button','data-panel':'extras'});extraButton.textContent='♫ Доп. площадки';
    var auditButton=sidebar.querySelector('[data-panel="audit"]');
    if(auditButton)sidebar.insertBefore(extraButton,auditButton);else sidebar.appendChild(extraButton);
  }
  window.VMM_WORKFLOWS={open:open};
  var nav=document.querySelectorAll('#workspace [data-panel]');
  for(var i=0;i<nav.length;i++){
    nav[i].addEventListener('click',function(e){
      var type=this.getAttribute('data-panel');
      if(type==='lyrics'){show(pane,false);if(window.VMM_RECORDINGS)window.VMM_RECORDINGS.hide();return;}
      if(type==='data'){if(window.VMM_RECORDINGS)window.VMM_RECORDINGS.hide();show(pane,false);return;}
      if(type==='recordings'&&window.VMM_RECORDINGS){e.preventDefault();e.stopImmediatePropagation();window.VMM_RECORDINGS.open();return;}
      if(labels[type]){if(window.VMM_RECORDINGS)window.VMM_RECORDINGS.hide();e.preventDefault();e.stopImmediatePropagation();open(type);}
    },true);
  }
}());