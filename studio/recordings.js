/* RUN-047 — VELARDREAM repertoire: private Google Drive upload/player + offline set.
   No server proxy, no public links, no OAuth token persistence. */
(function(){
  'use strict';
  var shell=document.querySelector('#workspace .workspace-content');
  if(!shell)return;
  var panel=document.createElement('section');
  panel.id='vmm-repertoire';
  panel.className='panel hidden';
  shell.appendChild(panel);
  var db=null,user=null,driveToken='',driveFolderId='',busy=false,active=false,listenersAttached=false,suggestOpen=false;
  var catalog=[],lyrics=[],recordings=[],saved=[],songId='',audioFileId='',audioURL='',mode='a4',textVisible=false,uploadMessage='',editOpen=false,playRequestId=0,formSongId='',playerVisible=false;
  var MAX=50*1024*1024,DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file',FOLDER='VELARDREAM RECORDS - Фонограммы';
  function id(s){return document.getElementById(s);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','&quot;':'&quot;',"'":'&#39;'}[c];});}
  function clean(s){return String(s||'').trim();}
  function norm(s){return clean(s).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');}
  function msg(s){var el=id('vmm-r-status');if(el)el.textContent=s;}
  function mb(n){return (Number(n||0)/1048576).toFixed(1)+' МБ';}
  function show(el,yes){if(el)el.className=el.className.replace(/\s*hidden\b/g,'')+(yes?'':' hidden');}
  function song(){for(var i=0;i<catalog.length;i++)if(String(catalog[i].id)===String(songId))return catalog[i];return null;}
  function record(fileId){for(var i=0;i<recordings.length;i++)if(recordings[i].driveFileId===fileId)return recordings[i];return null;}
  function isSaved(fileId){return saved.some(function(s){return s.fileId===fileId;});}
  function stored(fileId){for(var i=0;i<saved.length;i++)if(saved[i].fileId===fileId)return saved[i];return null;}
  function translit(str){
    var map={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
    var s=String(str||'').toLocaleLowerCase('ru'),out='';
    for(var i=0;i<s.length;i++)out+=Object.prototype.hasOwnProperty.call(map,s.charAt(i))?map[s.charAt(i)]:s.charAt(i);
    if(out.normalize)out=out.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return out.replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,85)||'track';
  }
  function filename(t,variant,extension){
    var name=translit(t.title)+'__'+translit(variant||'audio');
    if(recordings.some(function(r){return r.catalogId===t.id&&translit(r.variant||'audio')===translit(variant||'audio');})){
      var d=new Date(),p=function(n){return ('0'+n).slice(-2);};
      name+='__'+d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());
    }
    return name+'.'+extension;
  }
  function unique(list,key){
    var items=[],seen={};
    list.forEach(function(x){var v=key(x);if(!v||seen[v])return;seen[v]=true;items.push(x);});
    return items;
  }
  function header(){
    panel.innerHTML=
      '<div class="vmm-r-heading"><div><p class="eyebrow">VELARDREAM · REPERTOIRE</p><h2>Фонограммы и тексты песен</h2><p class="sync-note">Каталог · плеер · A4 · крупный текст · офлайн</p></div>'+
      '<button type="button" id="vmm-r-connect" class="btn-small secondary">Подключить Google Drive</button></div>'+
      '<p id="vmm-r-status" role="status" class="sync-note"></p>'+ 
      '<div class="vmm-r-pick"><label for="vmm-r-search">Найти композицию</label><input id="vmm-r-search" type="search" placeholder="Название песни или исполнитель" autocomplete="off" aria-controls="vmm-r-results">'+
      '<div id="vmm-r-results" class="vmm-r-results" role="status" aria-live="polite"></div>'+
      '<label for="vmm-r-song">Выбрать песню</label><select id="vmm-r-song"><option value="">Выбери песню…</option></select></div>'+
      '<div id="vmm-r-offline-list" class="vmm-r-offline-list" aria-label="Офлайн-подборка"></div>'+
      '<div id="vmm-r-song-section" class="hidden">'+
      '<div class="vmm-r-tools"><strong id="vmm-r-song-title"></strong><span id="vmm-r-folder"></span></div>'+
      '<div class="vmm-r-upload"><label for="vmm-r-variant">Вариант фонограммы</label><input id="vmm-r-variant" type="text" maxlength="80" value="Минусовка" placeholder="Минусовка, оригинал, бэк-вокал…">'+
      '<label for="vmm-r-file" class="vmm-r-file-label">Загрузить MP3 или FLAC (до 50 МБ)</label><input id="vmm-r-file" type="file" accept=".mp3,.flac,audio/mpeg,audio/flac,audio/x-flac">'+
      '<p class="sync-note">Файл переименуется латиницей по названию песни и сохранится в твою закрытую папку Google Drive. Доступ к файлам остаётся личным.</p></div>'+
      '<div id="vmm-r-records" class="vmm-r-records"></div></div>'+
      '<div id="vmm-r-player-section" class="hidden">'+
      '<div class="vmm-r-player"><div class="vmm-r-player-head"><button type="button" id="vmm-r-toggle-text" class="vmm-r-player-title" aria-expanded="false"><strong>Прослушивание</strong><span id="vmm-r-toggle-text-label">Показать текст</span></button>'+
      '<span id="vmm-r-player-sync" class="vmm-r-player-sync" role="status" aria-label="Фонограмма не выбрана" title="Фонограмма не выбрана"><span aria-hidden="true">☁</span><span id="vmm-r-sync-mark" aria-hidden="true">—</span></span>'+
      '<button type="button" id="vmm-r-edit" class="vmm-r-edit-toggle" aria-label="Редактировать выбранную фонограмму" title="Редактировать выбранную фонограмму" aria-controls="vmm-r-editor" aria-expanded="false">'+
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4 10.5-10.5z"/></svg></button></div>'+
      '<div class="vmm-r-stage" role="group" aria-label="Фирменный аудиоплеер VELARDREAM">'+
      '<button type="button" id="vmm-r-play" class="vmm-r-play-button" aria-label="Воспроизвести" aria-pressed="false" disabled>'+
      '<svg class="vmm-r-play-icon" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M7 4.8c0-.7.8-1.1 1.4-.7l12 7.2c.6.3.6 1.1 0 1.5l-12 7.1c-.6.4-1.4 0-1.4-.7z"/></svg>'+
      '<svg class="vmm-r-pause-icon" viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1.3"/><rect x="14" y="4" width="5" height="16" rx="1.3"/></svg></button>'+
      '<div class="vmm-r-timeline"><input id="vmm-r-seek" type="range" min="0" max="1000" step="1" value="0" disabled aria-label="Позиция воспроизведения" aria-valuetext="0:00 из 0:00">'+
      '<div class="vmm-r-clock"><output id="vmm-r-elapsed" for="vmm-r-seek">0:00</output><output id="vmm-r-remaining" for="vmm-r-seek">—:—</output></div></div>'+
      '<button type="button" id="vmm-r-back" class="vmm-r-jump" aria-label="Назад на 10 секунд" disabled><span aria-hidden="true">↶</span><small>10</small></button>'+
      '<button type="button" id="vmm-r-next" class="vmm-r-jump" aria-label="Вперёд на 10 секунд" disabled><span aria-hidden="true">↷</span><small>10</small></button></div>'+
      '<details id="vmm-r-system" class="vmm-r-system"><summary>Системные функции плеера</summary>'+
      '<p class="sync-note">AirPlay, системное меню и громкость устройства доступны в стандартном плеере iPhone.</p>'+
      '<audio id="vmm-r-audio" controls preload="none" x-webkit-airplay="allow"></audio></details>'+
      '<p id="vmm-r-now" class="sync-note">Выбери запись, чтобы включить её.</p>'+
      '<div id="vmm-r-editor" class="vmm-r-editor hidden" role="group" aria-label="Управление фонограммой">'+
      '<strong id="vmm-r-edit-target"></strong><p id="vmm-r-edit-meta" class="sync-note"></p><p class="sync-note">Изменения относятся только к этой фонограмме. Текст и каталог не затрагиваются.</p>'+
      '<div class="vmm-r-edit-actions"><button type="button" id="vmm-r-download">↓ Скачать</button><button type="button" id="vmm-r-offline-toggle"></button><button type="button" id="vmm-r-trash-current" class="vmm-r-trash-btn">В корзину Google Drive</button></div></div></div>'+ 
      '<div id="vmm-r-text-wrapper" class="hidden">'+ 
      '<div class="vmm-r-text-tools"><strong>Текст композиции</strong><div role="group" aria-label="Вид текста">'+
      '<button type="button" id="vmm-r-a4" class="is-active" aria-pressed="true">A4 · две колонки</button>'+
      '<button type="button" id="vmm-r-large" aria-pressed="false">Читать крупно</button></div></div>'+
      '<div id="vmm-r-lyrics" class="vmm-r-lyrics"></div></div></div>'+ 
      '<p id="vmm-r-storage" class="sync-note"></p>';
    id('vmm-r-connect').onclick=function(){connect(true).then(ensureFolder).then(function(){msg('Google Drive подключён. Можно загружать и воспроизводить записи.');renderFolder();}).catch(function(e){msg('Google Drive: '+e.message);});};
    id('vmm-r-search').oninput=function(){suggestOpen=true;renderSongs();};
    id('vmm-r-search').onkeydown=function(e){if(e.key==='Enter'){var q=norm(this.value),matches=catalog.filter(function(t){return norm(clean(t.title)+' '+clean(t.artist||'')).indexOf(q)>=0;});if(q&&matches.length){e.preventDefault();chooseSearchResult(matches[0]);}}};
    id('vmm-r-song').onchange=function(){setSong(this.value,false);};
    id('vmm-r-file').onchange=function(){var file=this.files&&this.files[0];if(file)upload(file);this.value='';};
    id('vmm-r-toggle-text').onclick=function(){toggleText(!textVisible);};
    id('vmm-r-download').onclick=function(){var r=record(audioFileId);if(editOpen&&r&&!r.archived&&r.catalogId===songId)download(r);};
    id('vmm-r-edit').onclick=function(){
      var r=record(audioFileId);
      if(!r||r.archived||r.catalogId!==songId){msg('Сначала выбери нужную запись кнопкой «Слушать».');return;}
      editOpen=!editOpen;renderPlayerEditor();
    };
    id('vmm-r-offline-toggle').onclick=function(){
      var r=record(audioFileId);
      if(!editOpen||!r||r.archived||r.catalogId!==songId)return;
      var offline=isSaved(r.driveFileId);
      if(offline&&!window.confirm('Убрать «'+(r.title||r.variant||'фонограмму')+'» из офлайн-подборки?\n\nЛокальная копия удалится только с этого устройства. Google Drive останется без изменений.'))return;
      editOpen=false;renderPlayerEditor();
      offlineOn(r,!offline);
    };
    id('vmm-r-trash-current').onclick=function(){
      var r=record(audioFileId);
      if(!editOpen||!r||r.archived||r.catalogId!==songId||!r.id||r.id.indexOf('offline:')===0)return;
      moveRecording(r,true);
    };
    id('vmm-r-a4').onclick=function(){setMode('a4');};
    id('vmm-r-large').onclick=function(){setMode('large');};
    if(!listenersAttached){panel.addEventListener('click',actions);listenersAttached=true;}
  }
  function chooseSearchResult(t){
    if(!t)return;
    suggestOpen=false;
    id('vmm-r-search').value=clean(t.title);
    setSong(t.id);
    var section=id('vmm-r-song-section');
    if(section&&section.scrollIntoView)section.scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  function renderSongs(){
    var sel=id('vmm-r-song'),input=id('vmm-r-search'),suggestions=id('vmm-r-results');
    if(!sel||!input)return;
    var q=norm(input.value),previous=String(formSongId||''),results=[];
    sel.innerHTML='<option value="">Выбери песню…</option>';
    catalog.forEach(function(t){
      var label=clean(t.title)+(t.artist?' — '+clean(t.artist):'');
      if(q&&norm(label).indexOf(q)<0&&String(t.id)!==previous)return;
      if(!q||norm(label).indexOf(q)>=0)results.push(t);
      var opt=document.createElement('option');opt.value=t.id;opt.textContent=label;sel.appendChild(opt);
    });
    // The native select remains available. iPhone users also get directly
    // tappable search results, without opening a second selector.
    sel.value=previous||'';
    if(!suggestions)return;
    while(suggestions.firstChild)suggestions.removeChild(suggestions.firstChild);
    var summary=document.createElement('p');summary.className='sync-note';
    if(!catalog.length){
      summary.textContent='Список песен пока пуст. Обнови страницу или проверь подключение к базе.';
    }else if(!q){
      summary.textContent='В каталоге '+catalog.length+' песен. Начни вводить название — совпадения появятся здесь.';
    }else if(!results.length){
      summary.textContent='По запросу «'+input.value+'» песен не найдено. Проверь написание или обнови каталог.';
    }else{
      summary.textContent='Найдено: '+results.length+'. Нажми на название песни.';
    }
    suggestions.appendChild(summary);
    if(suggestOpen&&q&&results.length){
      results.slice(0,25).forEach(function(t){
        var button=document.createElement('button');
        button.type='button';button.className='vmm-r-suggestion';
        button.textContent=clean(t.title)+(t.artist?' — '+clean(t.artist):'');
        button.onclick=function(){chooseSearchResult(t);};
        suggestions.appendChild(button);
      });
      if(results.length>25){
        var foot=document.createElement('p');foot.className='sync-note';
        foot.textContent='Показаны первые 25 результатов. Уточни запрос.';
        suggestions.appendChild(foot);
      }
    }
  }
  // Upload selection and stage playback are intentionally distinct.
  // Choosing a catalog song opens only the upload form; an explicit selection
  // from an offline card or cloud recording opens the player.
  function setSong(key,forPlayback){
    var next=String(key||''),playback=!!forPlayback;
    if(songId!==next){clearAudio();textVisible=false;editOpen=false;playRequestId++;}
    songId=next;formSongId=playback?'':next;playerVisible=!!next&&playback;
    if(playback){
      suggestOpen=false;
      var search=id('vmm-r-search');if(search)search.value='';
    }
    renderSongs();
    var t=song();
    show(id('vmm-r-song-section'),!!t&&!playback);
    show(id('vmm-r-player-section'),!!t&&playback);
    if(!t){renderPlayerEditor();return;}
    id('vmm-r-song-title').textContent=t.title;
    renderFolder();renderRecords();renderLyrics();toggleText(textVisible);
    if(user&&window.VMM_OFFLINE&&window.VMM_OFFLINE.rememberSelection&&saved.some(function(s){return s.catalogId===t.id;})){
      window.VMM_OFFLINE.rememberSelection(user.uid,t.id).catch(function(){});
    }
  }
  function matchingLyrics(t){
    if(!t)return[];
    var matching=lyrics.filter(function(l){
      var sameTitle=norm(l.title)===norm(t.title);
      return sameTitle&&((clean(l.catalogRow)&&clean(t.sourceRow)&&clean(l.catalogRow)===clean(t.sourceRow))||
        (clean(l.upc)&&clean(t.upc)&&clean(l.upc)===clean(t.upc)));
    });
    if(!matching.length){
      var offline=saved.filter(function(s){return s.catalogId===t.id&&s.lyrics;});
      if(offline.length)return[{text:offline[0].lyrics,version:'Офлайн'}];
    }
    return matching;
  }
  function rowsHTML(text){
    var lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),out=[],stanza=[];
    function flush(){if(stanza.length){out.push('<p class="vmm-r-stanza">'+stanza.map(function(s){return esc(s).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');}).join('<br>')+'</p>');stanza=[];}}
    lines.forEach(function(s){
      var raw=s.trim(),head;
      if(!raw){flush();return;}
      if(/^\*\*(.*?)\*\*$/.test(raw))head=raw.slice(2,-2);
      else if(/^#{2,6}\s/.test(raw))head=raw.replace(/^#{2,6}\s+/,'');
      if(head!==undefined){flush();out.push('<h3>'+esc(head)+'</h3>');return;}
      if(/^#\s/.test(raw)){flush();return;}
      stanza.push(s);
    });
    flush();
    return out.join('');
  }
  function renderLyrics(){
    var t=song(),el=id('vmm-r-lyrics');if(!el||!t)return;
    var versions=matchingLyrics(t),current=versions[0];
    if(!current){el.innerHTML='<p class="sync-note">Текст для этой песни ещё не сохранён. Его можно добавить в разделе «Тексты песен».</p>';return;}
    el.className='vmm-r-lyrics '+(mode==='large'?'vmm-r-large':'vmm-r-a4');
    el.innerHTML='<div class="vmm-r-text-title"><strong>'+esc(t.title)+'</strong><span>'+esc(current.language||'')+(current.version?' · '+esc(current.version):'')+'</span></div>'+
      '<div class="vmm-r-text-content">'+rowsHTML(current.text)+'</div>';
  }
  function toggleText(yes){
    textVisible=!!yes;
    show(id('vmm-r-text-wrapper'),textVisible);
    var btn=id('vmm-r-toggle-text');
    if(btn)btn.setAttribute('aria-expanded',textVisible?'true':'false');
    var caption=id('vmm-r-toggle-text-label');if(caption)caption.textContent=textVisible?'Скрыть текст':'Показать текст';
  }
  function setMode(which){
    mode=which;
    id('vmm-r-a4').className=mode==='a4'?'is-active':'';
    id('vmm-r-large').className=mode==='large'?'is-active':'';
    id('vmm-r-a4').setAttribute('aria-pressed',mode==='a4'?'true':'false');
    id('vmm-r-large').setAttribute('aria-pressed',mode==='large'?'true':'false');
    renderLyrics();
  }
  function renderPlayerEditor(){
    var selected=record(audioFileId),
      valid=!!(playerVisible&&selected&&!selected.archived&&selected.catalogId===songId);
    if(!valid)editOpen=false;
    var badge=id('vmm-r-player-sync'),mark=id('vmm-r-sync-mark');
    if(badge){
      var isOffline=valid&&isSaved(selected.driveFileId);
      var inCloud=valid&&!!(selected.id&&selected.id.indexOf('offline:')!==0);
      var label=!valid?'Фонограмма не выбрана':
        inCloud?(isOffline?'Google Drive и сохранено офлайн':'В Google Drive, офлайн-копии нет'):
        isOffline?'Сохранено только на этом устройстве':'Нет подтверждённой облачной копии';
      badge.setAttribute('aria-label',label);badge.title=label;
      badge.className='vmm-r-player-sync'+(isOffline?' is-offline':'');
      if(mark)mark.textContent=isOffline?'✓':inCloud?'':'—';
    }
    var button=id('vmm-r-edit'),pane=id('vmm-r-editor');
    if(button){
      button.disabled=!valid;
      button.setAttribute('aria-expanded',editOpen?'true':'false');
      button.setAttribute('aria-label',editOpen?'Закрыть управление фонограммой':'Редактировать выбранную фонограмму');
      button.title=editOpen?'Закрыть управление фонограммой':'Редактировать выбранную фонограмму';
    }
    show(pane,editOpen&&valid);
    if(!valid)return;
    var target=id('vmm-r-edit-target');
    if(target)target.textContent=(selected.title||song().title||'Песня')+' · '+(selected.variant||'Фонограмма');
    var date=selected.createdAt&&selected.createdAt.toDate?selected.createdAt.toDate().toLocaleDateString('ru-RU'):'';
    var meta=id('vmm-r-edit-meta');
    if(meta)meta.textContent=(selected.filename||'')+' · '+mb(selected.size)+(date?' · '+date:'');
    var toggle=id('vmm-r-offline-toggle');
    if(toggle)toggle.textContent=isSaved(selected.driveFileId)?'Убрать из офлайна':'Сохранить офлайн';
    var trash=id('vmm-r-trash-current');
    if(trash)show(trash,!!(selected.id&&selected.id.indexOf('offline:')!==0));
  }
  function renderOfflineList(){
    var target=id('vmm-r-offline-list');if(!target)return;
    if(!saved.length){
      target.innerHTML='<p class="sync-note">Офлайн-подборка пуста. Отметь галочкой нужные фонограммы — здесь они останутся доступными после возвращения на сайт.</p>';
      return;
    }
    var rows=saved.slice().sort(function(a,b){return clean(a.title).localeCompare(clean(b.title),'ru');});
    target.innerHTML='<h3>Офлайн-подборка · '+rows.length+'</h3>'+
      '<p class="sync-note">Выбранные фонограммы хранятся на этом устройстве. Тексты раскрываются только при прослушивании.</p>'+
      rows.map(function(s){
        return '<button type="button" class="vmm-r-pinned" data-r-action="offline-play" data-r-id="'+esc(s.fileId)+'">'+
          '<span>▶ '+esc(s.title||'Без названия')+'</span><small>'+esc(s.variant||'Фонограмма')+' · '+mb(s.size)+' · офлайн ✓</small></button>';
      }).join('');
  }
  function renderRecords(){
    var box=id('vmm-r-records'),t=song();if(!box||!t)return;
    var items=recordings.filter(function(r){return r.catalogId===t.id&&!r.archived;});
    var archived=recordings.filter(function(r){return r.catalogId===t.id&&r.archived;});
    // The catalog is an upload selector, never a second playback/metadata panel.
    // A cloud-only recording can still be opened deliberately without an offline pin.
    var live=items.length?
      '<p class="sync-note">У песни есть '+items.length+' '+(items.length===1?'фонограмма':'фонограмм')+' в каталоге. Для прослушивания открой нужный вариант.</p>'+
      '<div class="vmm-r-open-choices">'+items.map(function(r){
        return '<button type="button" data-r-action="open-track" data-r-id="'+esc(r.driveFileId)+'">Открыть в плеере · '+esc(r.variant||'Фонограмма')+'</button>';
      }).join('')+'</div>':
      '<p class="sync-note">У этой песни пока нет фонограммы. Загрузи MP3 или FLAC выше.</p>';
    var archiveHTML=archived.length?'<details class="vmm-r-archive"><summary>Корзина фонограмм ('+archived.length+')</summary><p class="sync-note">Файлы находятся в корзине Google Drive. Их можно восстановить.</p>'+
      archived.map(function(r){return '<div class="vmm-r-track">'+
        '<div class="vmm-r-track-info"><strong>'+esc(r.variant||'Фонограмма')+'</strong><small>'+esc(r.filename||'')+'</small></div>'+
        '<button type="button" data-r-action="restore" data-r-id="'+esc(r.driveFileId)+'">Восстановить</button></div>';}).join('')+'</details>':'';
    box.innerHTML=live+archiveHTML;
    updateStorage();renderPlayerEditor();
  }

  function renderFolder(){
    var target=id('vmm-r-folder');if(!target)return;
    if(driveFolderId&&/^[\w-]+$/.test(driveFolderId))target.innerHTML='<a target="_blank" rel="noopener" href="https://drive.google.com/drive/folders/'+esc(driveFolderId)+'">Папка Google Drive</a>';
    else target.textContent='Google Drive пока не подключён';
  }
  function readCache(){
    if(!user||!window.VMM_OFFLINE)return Promise.resolve();
    return window.VMM_OFFLINE.list(user.uid).then(function(rows){
      saved=rows;
      saved.forEach(function(s){
        if(!catalog.some(function(t){return t.id===s.catalogId;}))catalog.push({id:s.catalogId,title:s.title,artist:s.artist,sourceRow:''});
        if(!recordings.some(function(r){return r.driveFileId===s.fileId;}))recordings.push({
          id:'offline:'+s.fileId,catalogId:s.catalogId,driveFileId:s.fileId,title:s.title,
          artist:s.artist,variant:s.variant,filename:s.filename,mimeType:s.mimeType,size:s.size
        });
      });
    });
  }
  function getDocs(collection){
    return db.collection(collection).limit(1200).get().then(function(s){
      var list=[];s.forEach(function(d){var x=d.data();x.id=d.id;list.push(x);});return list;
    });
  }
  function verify(){
    if(!window.firebase||!firebase.apps.length)return Promise.reject(new Error('Авторизация ещё загружается.'));
    var u=firebase.auth().currentUser;
    if(!u||!u.emailVerified||!u.providerData.some(function(x){return x.providerId==='google.com';}))return Promise.reject(new Error('Войди в личный кабинет Google.'));
    if(user&&user.uid!==u.uid){driveToken='';driveFolderId='';catalog=[];lyrics=[];recordings=[];saved=[];songId='';clearAudio();}
    db=firebase.firestore();user=u;
    return db.collection('vmm_admins').doc(u.uid).get({source:navigator.onLine?'server':'cache'}).then(function(s){
      if(!s.exists||!s.data()||s.data().enabled!==true)throw new Error('Нет подтверждённых прав владельца.');
    });
  }
  function load(){
    msg(uploadMessage||'Открываем репертуар…');
    var errors=[],lastPinned='';
    return verify().then(function(){
      return Promise.all([
        getDocs('vmm_catalog').catch(function(e){errors.push('каталог: '+e.message);return [];}),
        getDocs('vmm_lyrics').catch(function(e){errors.push('тексты: '+e.message);return [];}),
        getDocs('vmm_recordings').catch(function(e){errors.push('фонограммы: '+e.message);return [];}),
        window.VMM_OFFLINE?readCache().catch(function(e){errors.push('офлайн: '+e.message);}):Promise.resolve(),
        window.VMM_OFFLINE&&window.VMM_OFFLINE.lastSelection?
          window.VMM_OFFLINE.lastSelection(user.uid).catch(function(){return '';}):Promise.resolve('')
      ]);
    }).then(function(result){
      var current=songId;
      catalog=unique(result[0].concat(catalog),function(x){return x.id;});
      lyrics=result[1];
      recordings=unique(result[2].filter(function(x){return x.driveFileId&&x.catalogId;}).concat(recordings),function(x){return x.driveFileId;});
      catalog.sort(function(a,b){return clean(a.title).localeCompare(clean(b.title),'ru');});
      lastPinned=result[4]||'';
      // Offline choices remain visible; neither the upload form nor the stage
      // player opens automatically after a refresh.
      renderSongs();renderOfflineList();setSong('');
      msg(uploadMessage||('Композиции: '+catalog.length+' · фонограммы: '+recordings.length+' · сохранено офлайн: '+saved.length+
         (navigator.onLine?' · в сети':' · без интернета')+
         (errors.length?' · Не удалось прочитать '+errors.join('; '):'')+
         (!catalog.length?' · Каталог пуст: поиск пока невозможен.':'')));
      return db.collection('vmm_recordings').doc('__audio_settings').get().then(function(d){
        if(d.exists&&d.data())driveFolderId=String(d.data().folderId||'');
        renderFolder();
      }).catch(function(){});
    }).catch(function(e){msg('Ошибка репертуара: '+e.message);});
  }
  function open(){
    if(active){show(panel,true);return;}
    suggestOpen=false;textVisible=false;playerVisible=false;formSongId='';
    active=true;header();
    if(window.VMM_STUDIO&&window.VMM_STUDIO.rememberPanel)window.VMM_STUDIO.rememberPanel('recordings');
    if(uploadMessage)msg(uploadMessage);
    var tabs=document.querySelectorAll('#workspace [data-panel]');
    for(var i=0;i<tabs.length;i++)tabs[i].className=tabs[i].getAttribute('data-panel')==='recordings'?'nav-active':'';
    show(id('panel-lyrics'),false);show(id('panel-future'),false);show(id('panel-data'),false);show(id('vmm-workflows'),false);show(panel,true);
    load();
  }
  function hide(){active=false;editOpen=false;renderPlayerEditor();show(panel,false);}
  function connect(force){
    if(!navigator.onLine)return Promise.reject(new Error('Для подключения Google Drive нужен интернет.'));
    if(driveToken&&!force)return Promise.resolve(driveToken);
    var u=firebase.auth().currentUser;
    if(!u||!user||u.uid!==user.uid)return Promise.reject(new Error('Нужен вход владельца.'));
    var provider=new firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    provider.setCustomParameters({prompt:'select_account'});
    // Reauthentication must be launched directly from a button/file/checkbox click.
    return u.reauthenticateWithPopup(provider).then(function(result){
      // Firebase Auth 8.x puts the Google OAuth credential on the result.
      // credentialFromResult is absent in the version loaded by Studio.
      var cred=result&&result.credential;
      if(!result.user||result.user.uid!==user.uid||!cred||!cred.accessToken)throw new Error('Не удалось подтвердить тот же аккаунт Google.');
      driveToken=cred.accessToken;return driveToken;
    });
  }
  function request(url,options,raw){
    options=options||{};
    if(!driveToken)return Promise.reject(new Error('Нужно подключить Google Drive.'));
    var headers=options.headers||{};
    headers.Authorization='Bearer '+driveToken;
    options.headers=headers;
    return fetch(url,options).then(function(res){
      if(!res.ok){return res.text().then(function(t){
        if(res.status===401||res.status===403)driveToken='';
        var detail='Google Drive HTTP '+res.status;
        try{var x=JSON.parse(t);detail=x.error&&x.error.message||detail;}catch(ignore){}
        throw new Error(detail+(res.status===401||res.status===403?' · подключи Drive повторно.':''));
      });}
      return raw?res:res.json();
    });
  }
  function ensureFolder(){
    if(driveFolderId)return Promise.resolve(driveFolderId);
    return db.collection('vmm_recordings').doc('__audio_settings').get({source:'server'}).then(function(doc){
      if(doc.exists&&doc.data()&&doc.data().folderId){
        driveFolderId=doc.data().folderId;return driveFolderId;
      }
      return request('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name:FOLDER,mimeType:'application/vnd.google-apps.folder'})
      }).then(function(r){
        if(!r.id)throw new Error('Google Drive не вернул ID папки.');
        driveFolderId=r.id;
        return db.collection('vmm_recordings').doc('__audio_settings').set({
          kind:'settings',folderId:r.id,folderName:FOLDER,createdBy:user.uid,
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        }).then(function(){renderFolder();return driveFolderId;});
      });
    });
  }
  function uploadBytes(file,name,folder,mime){
    return request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType',{
      method:'POST',
      headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':mime,'X-Upload-Content-Length':String(file.size)},
      body:JSON.stringify({name:name,mimeType:mime,parents:[folder],description:'Личная фонограмма VELARDREAM RECORDS'})
    },true).then(function(res){
      var url=res.headers.get('Location');
      if(!url||!/^https:\/\/(?:www\.googleapis\.com|content\.googleapis\.com)\//.test(url))throw new Error('Google Drive не предоставил защищённый адрес загрузки.');
      var chunkSize=8*1024*1024;
      function next(start,retry){
        var end=Math.min(file.size,start+chunkSize);
        var chunk=file.slice(start,end,mime);
        return fetch(url,{
          method:'PUT',
          headers:{'Authorization':'Bearer '+driveToken,'Content-Type':mime,'Content-Range':'bytes '+start+'-'+(end-1)+'/'+file.size},
          body:chunk
        }).then(function(resp){
          if(resp.status===308){
            var range=resp.headers.get('Range'),match=range&&/bytes=0-(\d+)/.exec(range);
            var after=match?Number(match[1])+1:end;
            if(after<=start)throw new Error('Загрузка не продвинулась; повтори позже.');
            msg('Загружаем '+name+': '+Math.round(after/file.size*100)+'%');
            return next(after,0);
          }
          if(!resp.ok)throw new Error('Google Drive: HTTP '+resp.status+' при передаче файла.');
          return resp.json();
        }).catch(function(err){
          if(retry>=2)throw err;
          msg('Повторяем передачу после сетевой ошибки…');
          return new Promise(function(resolve){setTimeout(resolve,500*(retry+1));}).then(function(){return next(start,retry+1);});
        });
      }
      return next(0,0);
    });
  }
  function upload(file){
    if(busy)return msg('Загрузка или другая операция уже выполняется. Дождись завершения перед выбором нового файла.');
    var t=song();if(!t)return msg('Сначала выбери песню.');
    var ext=(file.name.split('.').pop()||'').toLowerCase();
    if(ext!=='mp3'&&ext!=='flac')return msg('Разрешены только .mp3 и .flac. Конвертируй другой формат заранее.');
    if(!file.size||file.size>MAX)return msg('Файл должен быть не пустым и не больше 50 МБ.');
    if(!navigator.onLine)return msg('Загрузка в Google Drive требует подключения к интернету.');
    var variant=clean(id('vmm-r-variant').value)||'Минусовка';
    // Avoid an accidental second recording of the same song and variant.
    // Another take is allowed, but requires an explicit confirmation.
    var duplicate=recordings.some(function(r){
      return !r.archived&&r.catalogId===t.id&&norm(r.variant||'Минусовка')===norm(variant);
    });
    if(duplicate&&!window.confirm('У песни «'+t.title+'» уже есть вариант «'+variant+'».\n\nЗагрузить ещё одну фонограмму с этим названием?')){
      msg('Загрузка отменена. Существующая фонограмма сохранена без изменений.');
      return;
    }
    var name=filename(t,variant,ext),mime=ext==='flac'?'audio/flac':'audio/mpeg';
    busy=true;uploadMessage='';msg('Запрашиваем доступ к Google Drive…');
    connect().then(ensureFolder).then(function(folder){
      msg('Загружаем '+name+'…');
      return uploadBytes(file,name,folder,mime);
    }).then(function(result){
      if(!result.id)throw new Error('Google Drive не вернул ID загруженного файла.');
      var ref=db.collection('vmm_recordings').doc(),audit=db.collection('vmm_audit').doc(),batch=db.batch();
      var entry={catalogId:t.id,catalogRow:String(t.sourceRow||''),title:t.title,artist:t.artist||'',variant:variant,
        driveFileId:result.id,filename:name,mimeType:mime,size:file.size,
        createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:user.uid};
      batch.set(ref,entry);
      batch.set(audit,{time:firebase.firestore.FieldValue.serverTimestamp(),operation:'Фонограмма загружена',subject:t.title,
        result:name,referenceId:ref.id,actor:user.uid});
      return batch.commit().then(function(){
        entry.id=ref.id;recordings.push(entry);busy=false;
        uploadMessage='Загружено: '+name+'. Можно слушать, скачать или отметить для офлайн.';
        if(formSongId===t.id){
          // Only a confirmed Firestore commit resets the selection and closes
          // all upload controls. Errors leave the current song selected.
          var search=id('vmm-r-search');if(search)search.value='';
          suggestOpen=false;setSong('',false);
          msg(uploadMessage+' Выбор песни сброшен. Для прослушивания открой её в офлайн-подборке или найди в каталоге.');
        }else msg(uploadMessage+' Запись прикреплена к '+t.title+' — выбери её в каталоге.');
      }).catch(function(err){throw new Error('Файл уже в Google Drive, но запись в каталоге не создалась: '+name+'. '+err.message);});
    }).catch(function(e){busy=false;uploadMessage='Ошибка загрузки: '+e.message;msg(uploadMessage);});
  }
  function audioBlob(r){
    var s=stored(r.driveFileId);
    if(s&&s.blob)return Promise.resolve(s.blob);
    if(!navigator.onLine)return Promise.reject(new Error('Нет интернета, а запись не сохранена офлайн.'));
    if(!driveToken)return Promise.reject(new Error('Сначала подключи Google Drive.'));
    return request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(r.driveFileId)+'?alt=media',{},true).then(function(res){
      return res.blob();
    });
  }
  function clearAudio(){
    audioFileId='';editOpen=false;playRequestId++;
    var a=id('vmm-r-audio');
    if(a){a.pause();a.removeAttribute('src');a.load();}
    if(audioURL){URL.revokeObjectURL(audioURL);audioURL='';}
    renderPlayerEditor();
  }
  function play(r){
    var a=id('vmm-r-audio');if(!a)return;
    editOpen=false;
    var expectedRequest=++playRequestId;
    renderPlayerEditor();
    msg('Подготавливаем '+(r.variant||'фонограмму')+'…');
    var task=stored(r.driveFileId)?audioBlob(r):connect().then(function(){return audioBlob(r);});
    task.then(function(blob){
      if(!active||songId!==r.catalogId||expectedRequest!==playRequestId)return;
      toggleText(true);
      clearAudio();audioURL=URL.createObjectURL(blob);audioFileId=r.driveFileId;
      renderPlayerEditor();
      a.src=audioURL;a.load();
      id('vmm-r-now').textContent=clean(r.title)+' · '+clean(r.variant)+' · '+mb(blob.size);
      return a.play().then(function(){msg('Воспроизведение: '+r.title);})
        .catch(function(){msg('Файл готов. Нажми ▶ на плеере iPhone для запуска.');});
    }).catch(function(e){msg('Не получилось открыть аудио: '+e.message);});
  }
  function shareDownload(blob,r){
    var name=clean(r.filename)||'audio.mp3',file;
    try{file=new File([blob],name,{type:r.mimeType||'audio/mpeg'});}catch(ignore){file=null;}
    var canShare=false;
    try{canShare=!!(file&&navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));}catch(ignore){}
    if(canShare){
      return navigator.share({files:[file],title:r.title}).catch(function(err){if(err.name!=='AbortError')msg('Передача файла: '+err.message);});
    }
    var url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;document.body.appendChild(link);link.click();document.body.removeChild(link);
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    msg('Скачивание началось: '+name);
  }
  function download(r){
    msg('Подготавливаем скачивание…');
    var task=stored(r.driveFileId)?audioBlob(r):connect().then(function(){return audioBlob(r);});
    task.then(function(blob){return shareDownload(blob,r);}).catch(function(e){msg('Скачать не удалось: '+e.message);});
  }
  function offlineOn(r,checked){
    if(!window.VMM_OFFLINE)return msg('Локальное хранилище не поддерживается.');
    if(!checked){
      window.VMM_OFFLINE.remove(user.uid,r.driveFileId).then(function(){
        saved=saved.filter(function(s){return s.fileId!==r.driveFileId;});
        renderRecords();renderOfflineList();renderPlayerEditor();msg('Убрано из офлайн-подборки. В Google Drive файл сохранён.');
      }).catch(function(e){renderRecords();msg('Не удалось убрать офлайн: '+e.message);});
      return;
    }
    var item=stored(r.driveFileId);
    if(item)return;
    var task=connect().then(function(){return audioBlob(r);});
    msg('Сохраняем '+r.title+' для выступления без интернета…');
    task.then(function(blob){
      if(blob.size>MAX)throw new Error('Файл больше 50 МБ.');
      var t=song(),l=matchingLyrics(t)[0];
      return window.VMM_OFFLINE.put(user.uid,{
        fileId:r.driveFileId,catalogId:r.catalogId,title:r.title,artist:r.artist,variant:r.variant,
        filename:r.filename,mimeType:r.mimeType,blob:blob,lyrics:l?l.text:''
      }).then(function(){return window.VMM_OFFLINE.persist();});
    }).then(function(){
      return readCache().then(function(){
        renderRecords();renderOfflineList();renderPlayerEditor();
        if(window.VMM_OFFLINE.rememberSelection)window.VMM_OFFLINE.rememberSelection(user.uid,r.catalogId).catch(function(){});
        msg('Готово: '+r.title+' сохранена офлайн на этом устройстве. Перед концертом проверь без интернета.');
      });
    }).catch(function(e){renderRecords();msg('Не удалось сохранить офлайн: '+e.message);});
  }
  function updateStorage(){
    var target=id('vmm-r-storage');if(!target)return;
    var total=saved.reduce(function(sum,s){return sum+(s.size||0);},0);
    target.textContent='Офлайн на этом устройстве: '+saved.length+' файлов · '+mb(total)+'. Файлы Google Drive не удаляются при снятии галочки.';
    if(window.VMM_OFFLINE)window.VMM_OFFLINE.estimate().then(function(v){
      if(v&&target)target.textContent+=' Память сайта: '+mb(v.usage||0)+' из доступных '+mb(v.quota||0)+'.';
    });
  }
  // Only recordings created through this Studio may be moved to Drive Trash.
  // Keep the song, lyrics and full audit history untouched.
  function validateManagedRecording(r){
    if(!r||!r.id||r.id.indexOf('offline:')===0||!r.catalogId||!r.driveFileId||!r.filename)throw new Error('Удалять можно только записи, загруженные этим кабинетом.');
    if(!song()||r.catalogId!==songId)throw new Error('Композиция изменилась; выбери запись снова.');
    return db.collection('vmm_recordings').doc(r.id);
  }
  function folderForArchive(){
    return db.collection('vmm_recordings').doc('__audio_settings').get({source:'server'}).then(function(d){
      if(!d.exists||!d.data()||!d.data().folderId)throw new Error('Не найдена папка VELARDREAM в базе. Никакие файлы не перемещены.');
      return String(d.data().folderId);
    });
  }
  function driveInfo(r,folderId){
    return request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(r.driveFileId)+'?fields=id,name,parents,trashed',{}).then(function(m){
      if(m.id!==r.driveFileId||m.name!==r.filename||!m.parents||m.parents.indexOf(folderId)<0){
        throw new Error('Файл не совпадает с записью или находится вне папки VELARDREAM. Действие отменено.');
      }
      return m;
    });
  }
  function archiveMetadata(r,archived){
    var ref=validateManagedRecording(r),audit=db.collection('vmm_audit').doc();
    return db.runTransaction(function(tx){return tx.get(ref).then(function(snapshot){
      if(!snapshot.exists)throw new Error('Запись отсутствует в Firestore.');
      var data=snapshot.data();
      if(data.driveFileId!==r.driveFileId||data.catalogId!==r.catalogId||data.filename!==r.filename){
        throw new Error('Сведения о файле изменились. Обнови каталог.');
      }
      tx.update(ref,archived?{
        archived:true,archivedAt:firebase.firestore.FieldValue.serverTimestamp(),archivedBy:user.uid
      }:{
        archived:false,restoredAt:firebase.firestore.FieldValue.serverTimestamp(),restoredBy:user.uid
      });
      tx.set(audit,{time:firebase.firestore.FieldValue.serverTimestamp(),
        operation:archived?'Фонограмма перемещена в корзину':'Фонограмма восстановлена',
        subject:data.title||r.title||'',result:r.filename,referenceId:r.id,actor:user.uid});
    });});
  }
  function moveRecording(r,toTrash){
    if(busy)return;
    if(!navigator.onLine)return msg('Для перемещения в корзину или восстановления нужен интернет.');
    try{validateManagedRecording(r);}catch(err){return msg(err.message);}
    if(toTrash&&r.archived)return msg('Эта запись уже в корзине.');
    if(!toTrash&&!r.archived)return msg('Эта запись уже находится в репертуаре.');
    var action=toTrash?'переместить в корзину Google Drive':'восстановить из корзины Google Drive';
    if(!window.confirm('Ты хочешь '+action+' файл «'+r.filename+'»?\n\nТекст песни и запись каталога НЕ удаляются. Операция будет записана в журнал.'))return;
    busy=true;msg('Проверяем Google Drive и запись в Firestore…');
    connect().then(folderForArchive).then(function(folderId){
      return driveInfo(r,folderId);
    }).then(function(m){
      if(!!m.trashed===toTrash)return m;
      return request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(r.driveFileId)+'?fields=id,name,trashed',{
        method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:toTrash})
      });
    }).then(function(m){
      if(!m||m.id!==r.driveFileId||!!m.trashed!==toTrash)throw new Error('Google Drive не подтвердил перемещение файла.');
      msg('Google Drive подтверждён. Обновляем только связанную запись…');
      return archiveMetadata(r,toTrash);
    }).then(function(){
      r.archived=toTrash;
      if(toTrash&&audioFileId===r.driveFileId)clearAudio();
      if(toTrash&&window.VMM_OFFLINE&&isSaved(r.driveFileId)){
        return window.VMM_OFFLINE.remove(user.uid,r.driveFileId).then(function(){
          saved=saved.filter(function(s){return s.fileId!==r.driveFileId;});
          return '';
        }).catch(function(err){
          return ' Локальная офлайн-копия не удалена: '+err.message+'. Сними галочку офлайн после восстановления.';
        });
      }
      return '';
    }).then(function(warning){
      busy=false;renderRecords();renderOfflineList();renderPlayerEditor();
      msg((toTrash?'Готово: файл в корзине Google Drive, запись скрыта, история сохранена.':
        'Готово: файл восстановлен и снова доступен в репертуаре.')+warning);
    }).catch(function(err){
      busy=false;renderRecords();renderOfflineList();
      msg('Операция не завершена полностью: '+err.message+
        '. Если Google Drive уже переместил файл, не удаляй данные вручную: повтори эту же операцию.');
    });
  }
  function actions(e){
    var target=e.target;
    while(target&&target!==panel&&!target.getAttribute('data-r-action'))target=target.parentNode;
    if(!target||target===panel)return;
    var action=target.getAttribute('data-r-action'),r=record(target.getAttribute('data-r-id'));
    if(!r)return;
    if(action==='offline-play'||action==='open-track'){
      setSong(r.catalogId,true);
      if(songId===r.catalogId)play(r);
      return;
    }
    if(action==='restore')moveRecording(r,false);
  }
  function reset(){hide();clearAudio();editOpen=false;driveToken='';driveFolderId='';db=null;user=null;catalog=[];lyrics=[];recordings=[];saved=[];songId='';formSongId='';playerVisible=false;audioFileId='';busy=false;textVisible=false;uploadMessage='';}
  window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};
}());