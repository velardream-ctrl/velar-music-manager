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
  var filter = '', mode = 'all', page = 0, selected = '', busy = false;
  var collections = {contacts:'vmm_contacts',outreach:'vmm_outreach',recordings:'vmm_recordings',extras:'vmm_platforms',audit:'vmm_audit'};
  var labels = {overview:'Обзор',catalog:'Каталог релизов',platforms:'Площадки и ссылки',contacts:'Контакты',outreach:'Рассылки',recordings:'Фонограммы',extras:'Доп. площадки',audit:'Журнал'};
  var platforms = {spotify:'Spotify',appleMusic:'Apple Music',youtube:'YouTube',yandex:'Яндекс Музыка',vk:'VK Музыка',zvuk:'Звук'};
  var fieldMap = {spotify:10,appleMusic:8,youtube:12,yandex:14,zvuk:16};
  var statusMap = {spotify:11,appleMusic:9,youtube:13,yandex:15,zvuk:17};
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
    show(id('panel-lyrics'),false);show(id('panel-future'),false);show(pane,true);
  }
  function loading(title) {pane.innerHTML='<h2>'+esc(title)+'</h2><p id="vmm-w-status" class="sync-note">Читаем записи из защищённой базы…</p>';}
  function row(s){var x=parseInt(s,10);return isFinite(x)&&x>=2?x:0;}
  function findTrack(n) {var r=row(n);for(var i=0;i<catalog.length;i++)if(Number(catalog[i].sourceRow)===r)return catalog[i];return null;}
  function getDocs(name){return db.collection(name).limit(1200).get({source:'server'}).then(function(s){var a=[];s.forEach(function(d){var x=d.data();x.id=d.id;a.push(x);});return a;});}
  function loadCommon(then) {
    Promise.all([getDocs('vmm_catalog'),getDocs('vmm_links')]).then(function(a){catalog=a[0];proposals=a[1];then();}).catch(function(e){pane.innerHTML='<h2>Ошибка загрузки</h2><p>'+esc(e.message)+'</p><button data-act="retry">Повторить</button>';});
  }
  function urlValue(t,k){return (t&&t.links&&t.links[k])||'';}
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
    var m={total:catalog.length,spotify:0,appleMusic:0,youtube:0,all:0};
    catalog.forEach(function(t){var n=0;['spotify','appleMusic','youtube'].forEach(function(k){if(direct(k,urlValue(t,k))){m[k]++;n++;}});if(n===3)m.all++;});
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
      if(q && [t.title,t.artist,t.album,t.upc,t.isrc].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)<0)return false;
      if(mode==='missing')return !direct('spotify',urlValue(t,'spotify'))||!direct('appleMusic',urlValue(t,'appleMusic'))||!direct('youtube',urlValue(t,'youtube'));
      if(mode==='ready')return ['spotify','appleMusic','youtube'].every(function(k){return direct(k,urlValue(t,k));});
      if(mode==='spotify'||mode==='appleMusic'||mode==='youtube')return !direct(mode,urlValue(t,mode));
      return true;
    });
  }
  function heading(title,sub){return '<div class="vmm-head"><div><p class="eyebrow">VELARDREAM · MUSIC MANAGER</p><h2>'+esc(title)+'</h2><p class="sync-note">'+esc(sub||'')+'</p></div><button class="btn-small" data-act="retry">↻ Обновить</button></div>';}
  function linkButton(u,text){return safeUrl(u)?'<a class="vmm-out" target="_blank" rel="noopener noreferrer" href="'+esc(u)+'">'+esc(text)+' ↗</a>':'<span class="muted">Не установлена</span>';}
  function overview() {
    var m=metrics(),todo=catalog.filter(function(t){return !direct('spotify',urlValue(t,'spotify'))||!direct('appleMusic',urlValue(t,'appleMusic'))||!direct('youtube',urlValue(t,'youtube'));});
    pane.innerHTML=heading('Обзор каталога','Живая статистика подтверждённых прямых ссылок')+'<div class="vmm-metrics"><div>Композиции<strong>'+m.total+'</strong></div><div>Apple Music<strong>'+m.appleMusic+'</strong></div><div>Spotify<strong>'+m.spotify+'</strong></div><div>YouTube<strong>'+m.youtube+'</strong></div></div><p class="sync-note">Полностью заполнены три площадки: '+m.all+' · требуют проверки: '+todo.length+'</p><h3>Приоритет — недостающие ссылки</h3><div class="vmm-rows">'+todo.slice(0,12).map(function(t){return '<button data-act="track" data-row="'+row(t.sourceRow)+'"><strong>'+esc(t.title)+'</strong><small>'+esc(t.artist)+' · '+flags(t)+'</small></button>';}).join('')+'</div>';
  }
  function catalogPage(){
    var a=searchRows(),begin=page*30;if(begin>=a.length&&page>0){page=0;begin=0;}
    pane.innerHTML=heading('Каталог релизов','Поиск по названию, артисту, UPC и ISRC')+'<div class="vmm-filter"><input id="vmm-search" type="search" placeholder="Поиск композиции, UPC, ISRC" value="'+esc(filter)+'"><select id="vmm-mode"><option value="all">Все</option><option value="missing">Недостающие ссылки</option><option value="ready">Все три площадки</option><option value="spotify">Без Spotify</option><option value="appleMusic">Без Apple Music</option><option value="youtube">Без YouTube</option></select></div><div class="vmm-rows">'+a.slice(begin,begin+30).map(function(t){return '<button data-act="track" data-row="'+row(t.sourceRow)+'"><strong>'+esc(t.title)+'</strong><small>'+esc(t.artist)+' · '+esc(t.upc||'нет UPC')+' · '+esc(t.isrc||'нет ISRC')+'</small><span class="vmm-flags">'+flags(t)+'</span></button>';}).join('')+'</div><div class="vmm-paging"><span>Записей: '+a.length+' · '+(a.length?begin+1:0)+'–'+Math.min(begin+30,a.length)+'</span><div><button data-act="prev" '+(!page?'disabled':'')+'>← Назад</button><button data-act="next" '+(begin+30>=a.length?'disabled':'')+'>Далее →</button></div></div>';
    id('vmm-mode').value=mode;
    id('vmm-search').oninput=function(){filter=this.value;page=0;catalogPage();var e=id('vmm-search');e.focus();e.setSelectionRange(e.value.length,e.value.length);};
    id('vmm-mode').onchange=function(){mode=this.value;page=0;catalogPage();};
  }
  function searchUrl(k,t){
    var q=encodeURIComponent([t.title,t.artist].join(' '));
    return k==='spotify'?'https://open.spotify.com/search/'+q:k==='appleMusic'?'https://music.apple.com/fi/search?term='+q:'https://music.youtube.com/search?q='+q;
  }
  function trackPage(n){
    var t=findTrack(n);if(!t){catalogPage();return;}
    selected=String(t.sourceRow);
    var body=heading(t.title,t.artist+' · UPC '+(t.upc||'—')+' · ISRC '+(t.isrc||'—'));
    body+='<div class="vmm-card"><h3>Подтверждённые адреса</h3>';
    ['appleMusic','spotify','youtube','yandex','zvuk'].forEach(function(k){
      var u=urlValue(t,k),ok=direct(k,u);
      body+='<div class="vmm-detail"><strong>'+esc(platforms[k])+'</strong><span>'+ (ok?linkButton(u,'Открыть трек'):k==='spotify'&&spotifyAlbum(u)?linkButton(u,'Альбом · заменить'): '<span class="muted">Нет подтверждённой прямой ссылки</span>')+'</span></div>';
    });
    body+='</div><div class="vmm-card"><h3>Найти композицию</h3><div class="vmm-action-links">'+['spotify','appleMusic','youtube'].map(function(k){return linkButton(searchUrl(k,t),platforms[k]);}).join('')+'</div><p class="sync-note">Поисковые ссылки не считаются прямыми URL треков.</p></div>';
    body+='<div class="vmm-actions"><button data-act="propose" data-row="'+row(t.sourceRow)+'">+ Предложить ссылку</button><button data-act="lyrics-track" data-row="'+row(t.sourceRow)+'">✎ Текст песни</button><button data-act="catalog">← К каталогу</button></div>';
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
      if(proposals.some(function(x){return row(x.catalogRow)===row(t.sourceRow)&&x.platform===k&&normalized(k,x.url)===normalized(k,u)&&x.status!=='Отклонено';}))return tell('Такой кандидат уже существует.');
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
    pane.innerHTML=heading('Проверка музыкальных ссылок','Новые кандидаты не изменяют каталог до подтверждения')+
      '<div class="vmm-filter"><input type="search" id="vmm-search" placeholder="Песня, площадка, URL" value="'+esc(filter)+'"><select id="vmm-mode"><option value="pending">Ожидают решения</option><option value="all">Вся история</option><option value="approved">Подтверждённые</option><option value="rejected">Отклонённые</option></select></div>'+
      '<p class="sync-note">В очереди: '+proposals.filter(pending).length+' · в истории: '+proposals.length+'</p><div class="vmm-rows">'+items.slice(0,150).map(function(x){
        return '<div class="vmm-proposal"><div><strong>'+esc(x.title)+'</strong><small>'+esc(platforms[x.platform]||x.platform)+' · '+esc(x.status)+'</small>'+linkButton(x.url,'Открыть для проверки')+'</div><div class="vmm-actions">'+(pending(x)?'<button data-act="approve" data-id="'+esc(x.id)+'">Подтвердить</button><button data-act="reject" data-id="'+esc(x.id)+'">Отклонить</button>':'')+'</div></div>';
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
          if(row(proposal.catalogRow)!==row(t.sourceRow)||proposal.platform!==k||tr(proposal.url)!==u)throw new Error('Предложение изменилось после открытия. Повтори проверку.');
          var old=(actual.links||{})[k]||'';
          if(direct(k,old)&&tr(proposal.replacesUrl)!==tr(old))throw new Error('Прямая ссылка уже существует. Для замены требуется отдельное предложение с точным прежним URL.');
          if(old && !(k==='spotify'&&spotifyAlbum(old)) && safeUrl(old) && tr(proposal.replacesUrl)!==tr(old))throw new Error('Старая ссылка изменилась, подтвердить замену нельзя.');
          var links={},orig=actual.links||{};Object.keys(orig).forEach(function(key){links[key]=orig[key];});links[k]=u;
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
    auxiliary.sort(function(a,b){return String(b.time||'').localeCompare(String(a.time||''));});
    var q=tr(filter).toLowerCase(),items=auxiliary.filter(function(x){return [x.operation,x.subject,x.result,x.time].join(' ').toLowerCase().indexOf(q)>=0;});
    pane.innerHTML=heading('Журнал изменений','История сохраняется отдельно от каталога и текстов')+
      '<div class="vmm-filter"><input type="search" id="vmm-search" placeholder="Поиск события" value="'+esc(filter)+'"></div><p class="sync-note">Всего: '+auxiliary.length+'</p><div class="vmm-rows">'+items.slice(0,180).map(function(x){return '<div class="vmm-audit-line"><strong>'+esc(x.operation)+'</strong><small>'+esc(x.subject)+' · '+esc(x.result)+'</small></div>';}).join('')+'</div>';
    id('vmm-search').oninput=function(){filter=this.value;auditPage();refocus();};
  }
  function open(type) {
    if(!labels[type]||type==='lyrics')return;
    current=type;filter='';page=0;mode=type==='platforms'?'pending':'all';navActive(type);loading(labels[type]);
    authenticated(function(){
      if(type==='overview'||type==='catalog'||type==='platforms'){loadCommon(function(){if(type==='overview')overview();else if(type==='catalog')catalogPage();else platformPage();});}
      else getDocs(collections[type]).then(function(records){auxiliary=records;if(type==='audit')auditPage();else additionalPage(type);}).catch(function(e){pane.innerHTML='<h2>Ошибка загрузки</h2><p>'+esc(e.message)+'</p>';});
    });
  }
  pane.addEventListener('click',function(e){
    var t=e.target;while(t&&t!==pane&&!t.getAttribute('data-act'))t=t.parentNode;
    if(!t||t===pane)return;
    var a=t.getAttribute('data-act');
    if(a==='retry')return open(current);
    if(a==='catalog')return open('catalog');
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
  var nav=document.querySelectorAll('#workspace [data-panel]');
  for(var i=0;i<nav.length;i++){
    nav[i].addEventListener('click',function(e){
      var type=this.getAttribute('data-panel');
      if(type==='lyrics'){show(pane,false);return;}
      if(labels[type]){e.preventDefault();e.stopImmediatePropagation();open(type);}
    },true);
  }
}());