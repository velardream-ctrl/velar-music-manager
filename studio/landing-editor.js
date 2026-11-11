/* RUN-061 — protected landing CMS, ES5 / Safari 12 compatible.
   Draft and publication are separate Firestore documents. No user lyrics/audio. */
(function(){
 'use strict';
 var API=window.VMM_LANDING_SCHEMA,root=document.getElementById('panel-landing');
 if(!root||!API)return;
 var tab='hero',data=API.defaults(),baseline='',published=null;
 var uid='',db=null,loaded=false,busy=false,draftRev=0,publishedRev=0,loadGeneration=0;
 var catalogArtists=[],catalogLoaded=false,catalogLoading=false,catalogError='';
 var trackLinks={revision:0,overrides:{}},trackLinksLoaded=false;
 var trackEditorArtist='',trackChecked={},trackSearch='',trackSaving=false;
 var tabs={hero:'Первый экран',artists:'Артисты',releases:'Музыка и релизы',genres:'Жанры',about:'О проекте',publish:'Публикация'};
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
   id('landing-save').disabled=!loaded||busy||!draftDirty();
   id('landing-publish').disabled=!loaded||busy||!draftRev||dirty()||trackSaving;
   id('landing-reload').disabled=busy||trackSaving;
   id('landing-restore').disabled=!published||busy||trackSaving;
   text(id('landing-dirty'),busy?'Идёт операция…':trackSaving?'Сохраняем связи песен…':!loaded?'Данные ещё не загружены':dirty()?'Есть несохранённые изменения':'Изменения сохранены');
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
   return database.collection('vmm_admins').doc(u.uid).get({source:'server'}).then(function(s){
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
     if(tab==='artists')render();
   }).catch(function(err){
     if(generation!==loadGeneration||account!==uid)return;
     catalogLoading=false;catalogError=err&&err.message||'Каталог или связи песен временно недоступны.';
     if(tab==='artists')render();
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
   if(!navigator.onLine){info('Без сети изменения не сохраняются. Оставь галочки до подключения.');return;}
   var tracks=catalogArtists.slice(),selected=tracks.filter(function(t){return !!trackChecked[t.id];}).map(function(t){return t.id;});
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
     }).sort(function(a,b){return String(a.title||'').localeCompare(String(b.title||''),'ru');});
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
     field(card,'HTTPS-ссылка на публичную обложку — необязательно',item.imageUrl,function(v){item.imageUrl=v;});
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
     }
     wrap.appendChild(card);
   });
   if(key==='releases'){
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
     ['Жанры',data.genres.heading,data.genres.intro],
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
 function render(){
   var host=id('landing-fields');if(!host)return;
   clear(host);
   var panel=document.createElement('div');panel.className='landing-editor-panel';host.appendChild(panel);
   if(tab==='hero'){
     heading(panel,'Первый экран','Эмблема, название VELARDREAM и кнопки остаются частью оформления сайта; здесь меняются подпись и вступление.');
     field(panel,'Подзаголовок',data.hero.subtitle,function(v){data.hero.subtitle=v;});
     field(panel,'Основное описание',data.hero.intro,function(v){data.hero.intro=v;},true);
   }else if(tab==='artists'||tab==='releases'){
     heading(panel,tabs[tab],tab==='artists'?'Профили артистов публикуются только после включения галочки.':'Добавляй только ссылки на публичные релизы, без приватных фонограмм и текстов.');
     sectionFields(panel,tab);
     if(tab==='artists')artistPicker(panel);
     cardFields(panel,tab);
   }else if(tab==='genres'){
     heading(panel,'Жанры и подборки','Публичные названия музыкальных направлений.');
     sectionFields(panel,tab);
     field(panel,'Жанры (через запятую или с новой строки)',data.genres.tags.join(', '),function(v){
       data.genres.tags=v.split(/[,\n]/).map(function(x){return x.trim();}).filter(Boolean);
     },true);
   }else if(tab==='about'){
     heading(panel,'О проекте','Информация, видимая всем посетителям.');
     sectionFields(panel,tab);
     field(panel,'Объявление внизу раздела',data.about.notice,function(v){data.about.notice=v;},true);
   }else if(tab==='publish'){
     heading(panel,'Проверить и опубликовать','Сначала сохрани черновик. Кнопка «Опубликовать» обновит только отдельный публичный документ.');
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
   if(loaded&&!force){render();if(tab==='artists')loadCatalogArtists();return Promise.resolve();}
   if(force&&dirty()&&!window.confirm('Несохранённые изменения карточек или привязок будут потеряны. Обновить из облака?'))return Promise.resolve();
   if(force){trackEditorArtist='';trackChecked={};trackSearch='';catalogLoaded=false;trackLinksLoaded=false;}
   var currentLoad=++loadGeneration;
   busy=true;updateButtons();info('Проверяем права и загружаем черновик…');
   return authorized().then(function(auth){
     if(currentLoad!==loadGeneration)return null;
     uid=auth.user.uid;db=auth.db;var r=refs();
     return Promise.all([r.draft.get({source:'server'}),r.live.get({source:'server'})]).then(function(list){
       if(currentLoad!==loadGeneration)return;
       var draft=list[0].exists?list[0].data():null,live=list[1].exists?list[1].data():null;
       published=live&&live.status==='published'?API.normalize(live.content):null;
       publishedRev=live?Number(live.revision)||0:0;
       draftRev=draft?Number(draft.revision)||0:0;
       data=API.normalize(draft&&draft.content?draft.content:published||API.defaults());
       baseline=JSON.stringify(data);loaded=true;busy=false;render();
       if(tab==='artists')loadCatalogArtists();
       info(draft?'Черновик загружен. Изменения пока не опубликованы.':
          (published?'Загружена последняя публикация. Сохрани черновик, прежде чем публиковать изменения.':
          'Публикаций пока нет. Подготовь разделы и сохрани первый черновик.'));
     });
   }).catch(function(err){
     if(currentLoad!==loadGeneration)return;
     busy=false;loaded=false;updateButtons();info('Не удалось открыть редактор: '+safeStatus(err));
   });
 }
 function save(){
   if(!loaded||busy)return;
   if(!navigator.onLine){info('Нет сети. Черновик остаётся в редакторе, но в Firestore не сохранён.');return;}
   var cleanData;try{cleanData=API.normalize(data);}catch(e){info('Проверь поля: '+e.message);return;}
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
     draftRev=v;baseline=JSON.stringify(cleanData);busy=false;render();
     info('Черновик сохранён (версия '+v+'). '+(dirty()?'Есть более поздние несохранённые правки.':'Главная страница ещё не изменилась.'));
   }).catch(function(e){busy=false;updateButtons();info('Черновик не сохранён: '+safeStatus(e));});
 }
 function publish(){
   if(!loaded||busy||!draftRev)return;
   if(dirty()){info('Сначала сохрани изменения в черновике и привязки песен.');return;}
   if(!navigator.onLine){info('Публикация требует интернета.');return;}
   if(!window.confirm('Опубликовать выбранные артистов, релизы и тексты на открытой главной странице velardream.com?'))return;
   var cleanData;try{cleanData=API.normalize(data);}catch(e){info('Публикация остановлена: '+e.message);return;}
   var account=uid,expectedDraft=draftRev,expectedLive=publishedRev;
   busy=true;updateButtons();info('Публикуем проверенные данные…');
   authorized().then(function(a){
     if(a.user.uid!==account)throw new Error('Учётная запись изменилась.');
     var r=refs();
     return db.runTransaction(function(tx){
       return tx.get(r.draft).then(function(s){
         if(!s.exists||(Number(s.data().revision)||0)!==expectedDraft||
           JSON.stringify(API.normalize(s.data().content))!==JSON.stringify(cleanData))
           throw new Error('Черновик изменился в другом окне. Публикация остановлена.');
         return tx.get(r.live).then(function(pub){
           var v=pub.exists?(Number(pub.data().revision)||0):0;
           if(v!==expectedLive)throw new Error('Главная страница уже опубликована из другого окна. Обнови редактор.');
           tx.set(r.live,{schemaVersion:1,status:'published',revision:v+1,content:cleanData,
             updatedBy:account,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
           return v+1;
         });
       });
     });
   }).then(function(v){
     published=clone(cleanData);publishedRev=v;busy=false;updateButtons();
     info('Опубликовано! Версия '+v+'. Открой главную страницу в новой вкладке, чтобы проверить.');
   }).catch(function(e){busy=false;updateButtons();info('Публикация не выполнена: '+safeStatus(e));});
 }
 function canLeave(){
   if(busy||trackSaving){info('Дождись завершения сохранения или публикации.');return false;}
   if(!dirty())return true;
   if(!window.confirm('В главной странице или связях песен есть несохранённые изменения. Отменить их и выйти из раздела?'))return false;
   data=JSON.parse(baseline);trackEditorArtist='';trackChecked={};trackSearch='';render();return true;
 }
 function open(){
   show(root,true);
   load(false);
 }
 function hide(){show(root,false);}
 function reset(){
   loadGeneration++;
   uid='';db=null;loaded=false;busy=false;draftRev=0;publishedRev=0;
   catalogArtists=[];catalogLoaded=false;catalogLoading=false;catalogError='';
   trackLinks={revision:0,overrides:{}};trackLinksLoaded=false;trackEditorArtist='';trackChecked={};trackSearch='';trackSaving=false;
   data=API.defaults();baseline='';published=null;tab='hero';hide();updateButtons();
 }
 var nav=document.querySelectorAll('#landing-tabs [data-landing-tab]');
 for(var i=0;i<nav.length;i++)nav[i].onclick=function(){
   tab=this.getAttribute('data-landing-tab');render();
   if(tab==='artists')loadCatalogArtists();
 };
 id('landing-save').onclick=save;
 id('landing-publish').onclick=publish;
 id('landing-reload').onclick=function(){load(true);};
 id('landing-restore').onclick=function(){
   if(!published||!canLeave())return;
   data=clone(published);tab='publish';render();
   info('Последняя опубликованная версия возвращена в редактор. Сохрани как черновик, если нужно продолжить работу.');
 };
 window.VMM_LANDING={open:open,hide:hide,reset:reset,canLeave:canLeave,isDirty:dirty};
}());
