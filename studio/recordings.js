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
  var db=null,user=null,driveToken='',driveFolderId='',busy=false,active=false,listenersAttached=false;
  var catalog=[],lyrics=[],recordings=[],saved=[],songId='',audioFileId='',audioURL='',mode='a4';
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
      '<div class="vmm-r-pick"><label for="vmm-r-search">Найти композицию</label><input id="vmm-r-search" type="search" placeholder="Название песни или исполнитель" autocomplete="off">'+
      '<label for="vmm-r-song">Выбрать песню</label><select id="vmm-r-song"><option value="">Выбери песню…</option></select></div>'+
      '<div id="vmm-r-song-section" class="hidden">'+
      '<div class="vmm-r-tools"><strong id="vmm-r-song-title"></strong><span id="vmm-r-folder"></span></div>'+
      '<div class="vmm-r-upload"><label for="vmm-r-variant">Вариант фонограммы</label><input id="vmm-r-variant" type="text" maxlength="80" value="Минусовка" placeholder="Минусовка, оригинал, бэк-вокал…">'+
      '<label for="vmm-r-file" class="vmm-r-file-label">Загрузить MP3 или FLAC (до 50 МБ)</label><input id="vmm-r-file" type="file" accept=".mp3,.flac,audio/mpeg,audio/flac,audio/x-flac">'+
      '<p class="sync-note">Файл переименуется латиницей по названию песни и сохранится в твою закрытую папку Google Drive. Доступ к файлам остаётся личным.</p></div>'+
      '<div id="vmm-r-records" class="vmm-r-records"></div>'+
      '<div class="vmm-r-player"><label for="vmm-r-audio">Прослушивание</label><audio id="vmm-r-audio" controls preload="none"></audio><p id="vmm-r-now" class="sync-note">Выбери запись, чтобы включить её.</p></div>'+
      '<div class="vmm-r-text-tools"><strong>Текст композиции</strong><div role="group" aria-label="Вид текста">'+
      '<button type="button" id="vmm-r-a4" class="is-active" aria-pressed="true">A4 · две колонки</button>'+
      '<button type="button" id="vmm-r-large" aria-pressed="false">Читать крупно</button></div></div>'+
      '<div id="vmm-r-lyrics" class="vmm-r-lyrics"></div></div>'+
      '<p id="vmm-r-storage" class="sync-note"></p>';
    id('vmm-r-connect').onclick=function(){connect().then(ensureFolder).then(function(){msg('Google Drive подключён. Можно загружать и воспроизводить записи.');renderFolder();}).catch(function(e){msg('Google Drive: '+e.message);});};
    id('vmm-r-search').oninput=renderSongs;
    id('vmm-r-song').onchange=function(){setSong(this.value);};
    id('vmm-r-file').onchange=function(){var file=this.files&&this.files[0];if(file)upload(file);this.value='';};
    id('vmm-r-a4').onclick=function(){setMode('a4');};
    id('vmm-r-large').onclick=function(){setMode('large');};
    if(!listenersAttached){panel.addEventListener('click',actions);panel.addEventListener('change',offlineChanges);listenersAttached=true;}
  }
  function renderSongs(){
    var sel=id('vmm-r-song');if(!sel)return;
    var q=norm(id('vmm-r-search').value),previous=songId;
    sel.innerHTML='<option value="">Выбери песню…</option>';
    catalog.forEach(function(t){
      var label=clean(t.title)+(t.artist?' — '+clean(t.artist):'');
      if(q&&norm(label).indexOf(q)<0&&String(t.id)!==previous)return;
      var opt=document.createElement('option');opt.value=t.id;opt.textContent=label;sel.appendChild(opt);
    });
    sel.value=previous||'';
  }
  function setSong(key){
    if(songId!==key){clearAudio();audioFileId='';}
    songId=String(key||'');renderSongs();
    var t=song();
    show(id('vmm-r-song-section'),!!t);
    if(!t)return;
    id('vmm-r-song-title').textContent=t.title;
    renderFolder();renderRecords();renderLyrics();
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
  function setMode(which){
    mode=which;
    id('vmm-r-a4').className=mode==='a4'?'is-active':'';
    id('vmm-r-large').className=mode==='large'?'is-active':'';
    id('vmm-r-a4').setAttribute('aria-pressed',mode==='a4'?'true':'false');
    id('vmm-r-large').setAttribute('aria-pressed',mode==='large'?'true':'false');
    renderLyrics();
  }
  function renderRecords(){
    var box=id('vmm-r-records'),t=song();if(!box||!t)return;
    var items=recordings.filter(function(r){return r.catalogId===t.id;});
    box.innerHTML=items.length?items.map(function(r){
      var offline=isSaved(r.driveFileId),name=esc(r.variant||'Фонограмма'),date=r.createdAt&&r.createdAt.toDate?r.createdAt.toDate().toLocaleDateString('ru-RU'):'';
      return '<div class="vmm-r-track">'+
        '<div class="vmm-r-track-info"><strong>'+name+'</strong><small>'+esc((r.filename||'')+' · '+mb(r.size))+(date?' · '+date:'')+'</small></div>'+
        '<div class="vmm-r-track-actions">'+
          '<button type="button" data-r-action="play" data-r-id="'+esc(r.driveFileId)+'">▶ Слушать</button>'+
          '<button type="button" data-r-action="download" data-r-id="'+esc(r.driveFileId)+'">↓ Скачать</button>'+
          '<label class="vmm-r-offline-check"><input type="checkbox" data-r-offline="'+esc(r.driveFileId)+'" '+(offline?'checked':'')+'> Офлайн'+(offline?' ✓':'')+'</label>'+
        '</div></div>';
    }).join(''):'<p class="sync-note">У этой песни пока нет фонограммы. Загрузи MP3 или FLAC выше.</p>';
    updateStorage();
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
    msg('Открываем репертуар…');
    return verify().then(function(){
      return Promise.all([getDocs('vmm_catalog').catch(function(){return [];}),getDocs('vmm_lyrics').catch(function(){return [];}),getDocs('vmm_recordings').catch(function(){return [];}),window.VMM_OFFLINE?readCache():Promise.resolve()]);
    }).then(function(result){
      var current=songId;
      catalog=unique(result[0].concat(catalog),function(x){return x.id;});
      lyrics=result[1];
      recordings=unique(result[2].filter(function(x){return x.driveFileId&&x.catalogId;}).concat(recordings),function(x){return x.driveFileId;});
      catalog.sort(function(a,b){return clean(a.title).localeCompare(clean(b.title),'ru');});
      renderSongs();setSong(current);
      msg('Композиции: '+catalog.length+' · фонограммы: '+recordings.length+' · сохранено офлайн: '+saved.length+
         (navigator.onLine?' · в сети':' · без интернета'));
      return db.collection('vmm_recordings').doc('__audio_settings').get().then(function(d){
        if(d.exists&&d.data())driveFolderId=String(d.data().folderId||'');
        renderFolder();
      }).catch(function(){});
    }).catch(function(e){msg('Ошибка репертуара: '+e.message);});
  }
  function open(){
    if(active){show(panel,true);return;}
    active=true;header();
    var tabs=document.querySelectorAll('#workspace [data-panel]');
    for(var i=0;i<tabs.length;i++)tabs[i].className=tabs[i].getAttribute('data-panel')==='recordings'?'nav-active':'';
    show(id('panel-lyrics'),false);show(id('panel-future'),false);show(id('vmm-workflows'),false);show(panel,true);
    load();
  }
  function hide(){active=false;show(panel,false);}
  function connect(){
    if(!navigator.onLine)return Promise.reject(new Error('Для подключения Google Drive нужен интернет.'));
    if(driveToken)return Promise.resolve(driveToken);
    var u=firebase.auth().currentUser;
    if(!u||!user||u.uid!==user.uid)return Promise.reject(new Error('Нужен вход владельца.'));
    var provider=new firebase.auth.GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    provider.setCustomParameters({prompt:'select_account'});
    // Reauthentication must be launched directly from a button/file/checkbox click.
    return u.reauthenticateWithPopup(provider).then(function(result){
      var cred=firebase.auth.GoogleAuthProvider.credentialFromResult(result);
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
    if(busy)return;
    var t=song();if(!t)return msg('Сначала выбери песню.');
    var ext=(file.name.split('.').pop()||'').toLowerCase();
    if(ext!=='mp3'&&ext!=='flac')return msg('Разрешены только .mp3 и .flac. Конвертируй другой формат заранее.');
    if(!file.size||file.size>MAX)return msg('Файл должен быть не пустым и не больше 50 МБ.');
    if(!navigator.onLine)return msg('Загрузка в Google Drive требует подключения к интернету.');
    var variant=clean(id('vmm-r-variant').value)||'Минусовка';
    var name=filename(t,variant,ext),mime=ext==='flac'?'audio/flac':'audio/mpeg';
    busy=true;msg('Запрашиваем доступ к Google Drive…');
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
        entry.id=ref.id;recordings.push(entry);busy=false;renderRecords();
        msg('Загружено: '+name+'. Можно слушать, скачать или отметить для офлайн.');
      }).catch(function(err){throw new Error('Файл уже в Google Drive, но запись в каталоге не создалась: '+name+'. '+err.message);});
    }).catch(function(e){busy=false;msg('Ошибка загрузки: '+e.message);});
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
    var a=id('vmm-r-audio');
    if(a){a.pause();a.removeAttribute('src');a.load();}
    if(audioURL){URL.revokeObjectURL(audioURL);audioURL='';}
  }
  function play(r){
    var a=id('vmm-r-audio');if(!a)return;
    msg('Подготавливаем '+(r.variant||'фонограмму')+'…');
    var task=stored(r.driveFileId)?audioBlob(r):connect().then(function(){return audioBlob(r);});
    task.then(function(blob){
      if(!active||songId!==r.catalogId)return;
      clearAudio();audioURL=URL.createObjectURL(blob);audioFileId=r.driveFileId;
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
        renderRecords();msg('Убрано из офлайн-подборки. В Google Drive файл сохранён.');
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
        renderRecords();msg('Готово: '+r.title+' сохранена офлайн на этом устройстве. Перед концертом проверь без интернета.');
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
  function actions(e){
    var target=e.target;
    while(target&&target!==panel&&!target.getAttribute('data-r-action'))target=target.parentNode;
    if(!target||target===panel)return;
    var action=target.getAttribute('data-r-action'),r=record(target.getAttribute('data-r-id'));
    if(!r)return;
    if(action==='play')play(r);
    if(action==='download')download(r);
  }
  function offlineChanges(e){
    var input=e.target,attr=input&&input.getAttribute('data-r-offline');
    if(attr){var r=record(attr);if(r)offlineOn(r,!!input.checked);}
  }
  function reset(){hide();clearAudio();driveToken='';driveFolderId='';db=null;user=null;catalog=[];lyrics=[];recordings=[];saved=[];songId='';audioFileId='';busy=false;}
  window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};
}());