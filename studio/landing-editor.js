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
 var languageEditorCode='',languageCatalogSearch='',languageTrackFilter='';
 var topicEditorSlug='',topicCatalogSearch='',topicTrackFilter='';
 var tabs={hero:'Первый экран',artists:'Артисты',releases:'Музыка и релизы',playlists:'Плейлисты и подписки',universe:'Созвездия',languages:'Языки песен',topics:'Темы песен',assistant:'Помощник VELAR',genres:'Жанры',about:'О проекте',publish:'Публикация'};
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
     if(tab==='artists'||tab==='releases'||tab==='languages'||tab==='topics')render();
   }).catch(function(err){
     if(generation!==loadGeneration||account!==uid)return;
     catalogLoading=false;catalogError=err&&err.message||'Каталог или связи песен временно недоступны.';
     if(tab==='artists'||tab==='releases'||tab==='languages'||tab==='topics')render();
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
     'Выбери до 3 опубликованных композиций этого артиста. Подтягиваются только проверенные прямые ссылки Spotify/YouTube из музыкального каталога; ничего не загружается на сайт.');
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
   var songUrl=API.songUrl,selected=item.featuredTracks||[];
   var options=[];
   catalogArtists.forEach(function(t){
     if(window.VMM_ARTIST_TRACKS.effective(t,trackLinks.overrides)!==item.artistId)return;
     var links=t.links||{},spotify=songUrl(links.spotify||'','spotify'),
       youtube=songUrl(links.youtube||'','youtube');
     if(spotify||youtube)options.push({title:String(t.title||'Без названия'),
       id:t.id,spotify:spotify,youtube:youtube});
   });
   if(!options.length){
     var empty=document.createElement('p');empty.className='sync-note';
     empty.textContent='У артиста пока нет привязанных песен с прямой ссылкой Spotify или YouTube. Сначала проверь ссылки в «Каталог релизов» и, если нужно, назначь песни артисту.';
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
   function chosen(t){
     for(var k=0;k<selected.length;k++)
       if(selected[k].url===t.spotify||selected[k].url===t.youtube)return k;
     return -1;
   }
   function markChanged(){
     item.featuredTracks=selected.slice();updateButtons();
   }
   function draw(){
     clear(rows);clear(selectedHost);
     counter.textContent='Выбрано '+selected.length+'/3 · доступны '+options.length+' композиций. Порядок списка можно изменить.';
     selected.forEach(function(song,index){
       var line=document.createElement('div');line.className='landing-featured-chosen';
       var name=document.createElement('span');
       name.textContent=(index+1)+'. '+song.title+' — '+(song.provider==='spotify'?'Spotify':'YouTube');
       line.appendChild(name);
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
       selectedHost.appendChild(line);
     });
     var q=String(search.value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').trim();
     var found=options.filter(function(t){return !q||(t.title.toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0);});
     found.sort(function(a,b){
       var as=chosen(a)>=0,bs=chosen(b)>=0;
       return as===bs?a.title.localeCompare(b.title,'ru'):(as?-1:1);
     });
     var visible=found.slice(0,36);
     visible.forEach(function(t){
       var at=chosen(t),yes=at>=0;
       var row=document.createElement('div');row.className='landing-featured-row';
       var tick=document.createElement('input');tick.type='checkbox';tick.checked=yes;
       tick.setAttribute('aria-label','Выбрать '+t.title);
       var label=document.createElement('span');label.textContent=t.title;row.appendChild(tick);row.appendChild(label);
       var provider=document.createElement('select');provider.className='landing-featured-provider';
       var available=[];
       if(t.spotify)available.push(['spotify','Spotify']);
       if(t.youtube)available.push(['youtube','YouTube']);
       available.forEach(function(p){
         var option=document.createElement('option');option.value=p[0];option.textContent=p[1];provider.appendChild(option);
       });
       provider.value=yes?selected[at].provider:(t.spotify?'spotify':'youtube');
       provider.setAttribute('aria-label','Площадка для песни '+t.title);
       row.appendChild(provider);
       tick.onchange=function(){
         if(tick.checked){
           if(selected.length>=3){tick.checked=false;info('Выбери не более трёх лучших песен для каждого артиста.');return;}
           var choice=provider.value,link=choice==='spotify'?t.spotify:t.youtube;
           if(!link){tick.checked=false;return;}
           selected.push({title:t.title,provider:choice,url:link});
         }else{
           var removeAt=chosen(t);
           if(removeAt>=0)selected.splice(removeAt,1);
         }
         markChanged();draw();
       };
       provider.onchange=function(){
         var i=chosen(t);
         if(i<0)return;
         var link=this.value==='spotify'?t.spotify:t.youtube;
         if(!link)return;
         selected[i]={title:t.title,provider:this.value,url:link};
         markChanged();draw();
       };
       rows.appendChild(row);
     });
     if(found.length>visible.length){
       var note=document.createElement('p');note.className='sync-note';
       note.textContent='Показаны первые '+visible.length+' из '+found.length+'. Уточни название в поиске.';
       rows.appendChild(note);
     }else if(!found.length){
       var noResult=document.createElement('p');noResult.className='sync-note';
       noResult.textContent='Нет песен с подтверждёнными прямыми ссылками по этому запросу.';
       rows.appendChild(noResult);
     }
   }
   search.oninput=draw;
   draw();
   var note=document.createElement('p');note.className='sync-note';
   note.textContent='Посетитель нажимает на песню и открывает официальный встроенный плеер. Никакого автозапуска. Короткое превью Spotify может не засчитываться как полноценное прослушивание.';
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
 function playAndFollowEditor(parent){
   var radio=data.releases.radio;
   if(!radio){radio={enabled:false,title:'VELAR RADIO',provider:'spotify',url:''};data.releases.radio=radio;}
   heading(parent,'VELAR RADIO','Только официальный плейлист Spotify или YouTube. Без автостарта, фонового цикла или накрутки прослушиваний.');
   var enabled=document.createElement('label');enabled.className='landing-checkbox';
   var check=document.createElement('input');check.type='checkbox';check.checked=radio.enabled===true;
   check.onchange=function(){radio.enabled=this.checked;updateButtons();};
   var label=document.createElement('span');label.textContent='Показывать кнопку радио';enabled.appendChild(check);enabled.appendChild(label);parent.appendChild(enabled);
   field(parent,'Название радио',radio.title||'VELAR RADIO',function(v){radio.title=v;});
   selectField(parent,'Площадка радио',[['spotify','Spotify'],['youtube','YouTube']],
     radio.provider||'spotify',function(v){radio.provider=v;radio.url='';render();});
   field(parent,'Публичная ссылка на плейлист радио',radio.url||'',function(v){radio.url=v;});
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
       ['artists','Артисты'],['releases','Релизы и клипы'],['playlists','Плейлисты'],
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
 function languageEditor(parent){
   var config=data.genres.languages,langs=config.entries;
   heading(parent,'Миры языков',
     'Привязывай только проверенные опубликованные песни. Язык автоматически по названию не угадывается. До 20 языков и 300 песен на каждый, с общим ограничением объёма Firestore.');
   field(parent,'Заголовок языкового мира',config.heading,function(v){config.heading=v;});
   field(parent,'Описание языкового мира',config.intro,function(v){config.intro=v;},true);
   var menu=document.createElement('div');menu.className='landing-language-menu';
   langs.forEach(function(lang,index){
     var item=document.createElement('div');item.className='landing-language-menu-item';
     var show=button(lang.label+(lang.fictional?' · вымышленный':'')+
       ' · '+lang.tracks.length+' песен',function(){
         languageEditorCode=lang.code;languageCatalogSearch='';languageTrackFilter='';render();
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
     languageEditorCode=code;languageCatalogSearch='';render();
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
   heading(card,'Подтверждённые песни ('+active.tracks.length+')','Можно добавить песни одного языка из каталога или удалить неверную привязку.');
   var trackSearch=document.createElement('input');trackSearch.type='search';
   trackSearch.className='landing-release-search';trackSearch.placeholder='Найти привязанную песню для удаления…';
   trackSearch.value=languageTrackFilter;card.appendChild(trackSearch);
   var rows=document.createElement('div');rows.className='landing-language-songs';card.appendChild(rows);
   function drawTracks(){
     clear(rows);
     var query=languageTrackFilter.toLocaleLowerCase('ru').replace(/ё/g,'е');
     var matches=active.tracks.filter(function(t){
       return !query||(t.title+' '+t.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(query)>=0;
     });
     matches.slice(0,40).forEach(function(t){
       var item=document.createElement('div');item.className='landing-language-song-row';
       var title=document.createElement('span');
       title.textContent=t.title+' · '+t.artist+' · '+t.provider;
       item.appendChild(title);
       item.appendChild(button('Убрать',function(){
         var index=active.tracks.indexOf(t);
         if(index<0)return;
         active.tracks.splice(index,1);render();
       },'landing-danger'));rows.appendChild(item);
     });
     if(matches.length>40){
       var note=document.createElement('p');note.className='sync-note';
       note.textContent='Показаны первые 40 из '+matches.length+' найденных. Уточни поиск.';
       rows.appendChild(note);
     }
     if(!matches.length){
       var empty=document.createElement('p');empty.className='sync-note';
       empty.textContent='Песни пока не выбраны.';rows.appendChild(empty);
     }
   }
   trackSearch.oninput=function(){languageTrackFilter=this.value;drawTracks();};drawTracks();
   heading(card,'Найти и добавить из каталога',
     'Проверенная прямая ссылка Spotify/YouTube. Неизвестные языки не назначаются автоматически.');
   if(!catalogLoaded){
     var msg=document.createElement('p');msg.className='sync-note';
     msg.textContent=catalogLoading?'Загружаем каталог…':catalogError?
       'Ошибка каталога: '+catalogError:'Каталог ещё не загружен.';
     card.appendChild(msg);
     card.appendChild(button('Загрузить каталог',function(){
       catalogLoaded=false;loadCatalogArtists(true);
     }));
   }else{
     var search=document.createElement('input');search.type='search';
     search.className='landing-language-catalog-search';
     search.placeholder='Поиск по названию или артисту…';
     search.value=languageCatalogSearch;card.appendChild(search);
     var found=document.createElement('div');found.className='landing-language-catalog-list';
     card.appendChild(found);
     var options=[];
     catalogArtists.forEach(function(song){
       var urls=song.links||{},spotify=API.songUrl(urls.spotify||'','spotify'),
         youtube=API.songUrl(urls.youtube||'','youtube');
       if(spotify||youtube)options.push({
         title:String(song.title||'Без названия'),
         artist:String(song.artist||''),
         spotify:spotify,youtube:youtube
       });
     });
     function drawCatalog(){
       clear(found);
       var q=languageCatalogSearch.toLocaleLowerCase('ru').replace(/ё/g,'е');
       var total=0;
       options.forEach(function(song){
         if(q&&(song.title+' '+song.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)<0)return;
         if(total++>=35)return;
         var entry=document.createElement('div');entry.className='landing-language-song-row';
         var title=document.createElement('span');title.textContent=song.title+' · '+song.artist;
         entry.appendChild(title);
         [['spotify',song.spotify],['youtube',song.youtube]].forEach(function(pair){
           if(!pair[1])return;
           var onList=active.tracks.some(function(t){return t.url===pair[1];});
           var add=button(onList?'✓ '+pair[0]:'+ '+pair[0],function(){
             if(onList)return;
             if(active.tracks.length>=300){info('Не больше 300 песен на один язык.');return;}
             active.tracks.push({
               title:song.title,artist:song.artist,provider:pair[0],url:pair[1]
             });
             // Keep the current search and scroll position when tagging many
             // catalog songs. Save/publish still require explicit actions.
             add.disabled=true;add.textContent='✓ '+pair[0];
             drawTracks();updateButtons();
             info('Песня назначена языку '+active.label+'. Сохрани черновик перед публикацией.');
           },'landing-small');
           add.disabled=onList;entry.appendChild(add);
         });
         found.appendChild(entry);
       });
       if(total>35){
         var note=document.createElement('p');note.className='sync-note';
         note.textContent='Первые 35 из '+total+'. Уточни поиск, чтобы выбрать другую песню.';
         found.appendChild(note);
       }
     }
     search.oninput=function(){languageCatalogSearch=this.value;drawCatalog();};
     drawCatalog();
   }
   parent.appendChild(card);
 }

 // RUN-073: editorial tagging. A public song can be assigned to any number
 // of topics, like private artist-track assignments, without copying audio.
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
       topicEditorSlug=topic.slug;topicCatalogSearch='';topicTrackFilter='';render();
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
     topicEditorSlug=slug;topicCatalogSearch='';topicTrackFilter='';render();
   },'landing-add'));
   var current=topics.filter(function(x){return x.slug===topicEditorSlug;})[0];
   if(!current){current=topics[0];if(current)topicEditorSlug=current.slug;}
   if(!current)return;
   var card=document.createElement('section');card.className='landing-card landing-topic-editor';
   heading(card,'Подборка: '+current.label,
     'Тема и прикреплённые композиции попадут к слушателям только после сохранения и отдельной публикации.');
   field(card,'Уникальный код темы (латиница)',current.slug,function(v){
     current.slug=v.trim().toLowerCase();topicEditorSlug=current.slug;
   });
   field(card,'Название темы',current.label,function(v){current.label=v;});
   field(card,'Описание темы для слушателей',current.description||'',function(v){current.description=v;},true);
   var visibility=document.createElement('label');visibility.className='landing-checkbox';
   var check=document.createElement('input');check.type='checkbox';check.checked=current.visible===true;
   check.onchange=function(){current.visible=this.checked;updateButtons();};
   visibility.appendChild(check);
   var name=document.createElement('span');name.textContent='Показывать тему на сайте';
   visibility.appendChild(name);card.appendChild(visibility);
   heading(card,'Назначенные песни ('+current.tracks.length+')',
     'Одна песня может быть прикреплена к любви, свадьбе, верности и другим темам одновременно.');
   var assignedSearch=document.createElement('input');assignedSearch.type='search';
   assignedSearch.className='landing-release-search';
   assignedSearch.placeholder='Найти уже прикреплённую песню…';
   assignedSearch.value=topicTrackFilter;card.appendChild(assignedSearch);
   var assigned=document.createElement('div');assigned.className='landing-language-songs';
   card.appendChild(assigned);
   function drawAssigned(){
     clear(assigned);
     var query=topicTrackFilter.toLocaleLowerCase('ru').replace(/ё/g,'е');
     var matches=current.tracks.filter(function(t){
       return !query||(t.title+' '+t.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(query)>=0;
     });
     matches.slice(0,40).forEach(function(t){
       var row=document.createElement('div');row.className='landing-language-song-row';
       var title=document.createElement('span');
       title.textContent=t.title+' · '+t.artist+' · '+t.provider;row.appendChild(title);
       row.appendChild(button('Открепить',function(){
         var position=current.tracks.indexOf(t);
         if(position>=0){current.tracks.splice(position,1);drawAssigned();updateButtons();}
       },'landing-danger'));assigned.appendChild(row);
     });
     if(matches.length>40){
       var note=document.createElement('p');note.className='sync-note';
       note.textContent='Показаны первые 40 из '+matches.length+'. Уточни поиск.';
       assigned.appendChild(note);
     }
     if(!matches.length){
       var empty=document.createElement('p');empty.className='sync-note';
       empty.textContent='Песен пока нет. Отметь их галочками в каталоге ниже.';
       assigned.appendChild(empty);
     }
   }
   assignedSearch.oninput=function(){topicTrackFilter=this.value;drawAssigned();};drawAssigned();
   heading(card,'Каталог песен — отметь галочками',
     'Список из защищённого каталога. У каждой песни можно выбрать Spotify или YouTube; сохранится только официальная ссылка и публичное название. Поиск не сбрасывается после выбора.');
   if(!catalogLoaded){
     var loading=document.createElement('p');loading.className='sync-note';
     loading.textContent=catalogLoading?'Загружаем каталог…':catalogError?
       'Ошибка: '+catalogError:'Каталог ещё не загружен.';
     card.appendChild(loading);
     card.appendChild(button('Загрузить каталог',function(){catalogLoaded=false;loadCatalogArtists(true);}));
   }else{
     var search=document.createElement('input');search.type='search';
     search.className='landing-language-catalog-search';
     search.placeholder='Название песни или исполнитель…';
     search.value=topicCatalogSearch;card.appendChild(search);
     var results=document.createElement('div');results.className='landing-language-catalog-list';
     card.appendChild(results);
     var songOptions=[];
     catalogArtists.forEach(function(t){
       var urls=t.links||{},spotify=API.songUrl(urls.spotify||'','spotify'),
         youtube=API.songUrl(urls.youtube||'','youtube');
       if(spotify||youtube)songOptions.push({
         title:String(t.title||'Без названия'),artist:String(t.artist||''),
         spotify:spotify,youtube:youtube
       });
     });
     function drawCatalog(){
       clear(results);
       var query=topicCatalogSearch.toLocaleLowerCase('ru').replace(/ё/g,'е'),matches=0;
       songOptions.forEach(function(song){
         if(query&&(song.title+' '+song.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(query)<0)return;
         if(matches++>=50)return;
         var urls=[['spotify',song.spotify],['youtube',song.youtube]].filter(function(x){return !!x[1];});
         var currentTrack=current.tracks.filter(function(t){
           return urls.some(function(pair){return t.url===pair[1];});
         })[0];
         var row=document.createElement('div');row.className='landing-topic-catalog-row';
         var wrap=document.createElement('label');wrap.className='landing-checkbox';
         var checkbox=document.createElement('input');checkbox.type='checkbox';
         checkbox.checked=!!currentTrack;
         wrap.appendChild(checkbox);
         var label=document.createElement('span');label.textContent=song.title+' · '+song.artist;
         wrap.appendChild(label);row.appendChild(wrap);
         var platform=document.createElement('select');platform.className='landing-release-select';
         platform.setAttribute('aria-label','Плеер для '+song.title);
         urls.forEach(function(pair){
           var opt=document.createElement('option');opt.value=pair[0];
           opt.textContent=pair[0]==='spotify'?'Spotify':'YouTube';platform.appendChild(opt);
         });
         platform.value=currentTrack?currentTrack.provider:urls[0][0];row.appendChild(platform);
         function put(checked){
           var provider=platform.value||urls[0][0],link='';
           urls.forEach(function(pair){if(pair[0]===provider)link=pair[1];});
           if(checked&&!link){info('У песни нет подтверждённой ссылки на выбранную площадку.');return;}
           var old=current.tracks.filter(function(t){
             return urls.some(function(pair){return t.url===pair[1];});
           });
           if(checked&&!old.length&&current.tracks.length>=300){
             checkbox.checked=false;info('Максимум 300 песен на тему.');return;
           }
           old.forEach(function(t){var idx=current.tracks.indexOf(t);if(idx>=0)current.tracks.splice(idx,1);});
           if(checked)current.tracks.push({title:song.title,artist:song.artist,provider:provider,url:link});
           drawAssigned();updateButtons();
         }
         checkbox.onchange=function(){put(this.checked);};
         platform.onchange=function(){if(checkbox.checked)put(true);};
         results.appendChild(row);
       });
       if(matches>50){
         var note=document.createElement('p');note.className='sync-note';
         note.textContent='Показаны 50 из '+matches+' найденных. Уточни поиск.';
         results.appendChild(note);
       }
       if(!matches){
         var none=document.createElement('p');none.className='sync-note';
         none.textContent='Нет песен с прямыми ссылками. Уточни название.';results.appendChild(none);
       }
     }
     search.oninput=function(){topicCatalogSearch=this.value;drawCatalog();};
     drawCatalog();
   }
   parent.appendChild(card);
 }

 function assistantEditor(parent){
   var assistant=data.genres.assistant;
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
   field(parent,'Имя помощника',assistant.title,function(v){assistant.title=v;});
   field(parent,'Текст приветствия',assistant.welcome,function(v){assistant.welcome=v;},true);
   heading(parent,'Связь с автором',
     'Необходим публичный рабочий email. Адрес будет виден посетителям и в опубликованных данных. Пока поле пустое, бот предложит официальные страницы артистов. Письмо открывается как черновик в почте посетителя; автоматическая отправка, Telegram/WhatsApp и хранение обращений пока не включены.');
   field(parent,'Публичный email для предложений (необязательно)',assistant.contactEmail||'',function(v){
     assistant.contactEmail=v.trim();
   });
   heading(parent,'Ответы по ключевым словам',
     'Правила проверяются перед общими подсказками по музыке. Ключевые слова перечисляются через запятую; ответ виден посетителям. Не вводи сюда личные данные или секретные ключи. До 25 правил.');
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
     if(key==='artists')artistPhotoControls(card,item);
     else {field(card,'HTTPS-ссылка на публичную обложку — необязательно',item.imageUrl,function(v){item.imageUrl=v;});releaseExtras(card,item);}
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
   }else if(tab==='playlists'){
     playAndFollowEditor(panel);
   }else if(tab==='universe'){
     universeEditor(panel);
   }else if(tab==='languages'){
     languageEditor(panel);
   }else if(tab==='topics'){
     topicEditor(panel);
   }else if(tab==='assistant'){
     assistantEditor(panel);
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
   if(loaded&&!force){render();if(tab==='artists'||tab==='releases'||tab==='languages'||tab==='topics')loadCatalogArtists();return Promise.resolve();}
   if(force&&dirty()&&!window.confirm('Несохранённые изменения карточек или привязок будут потеряны. Обновить из облака?'))return Promise.resolve();
   if(force){trackEditorArtist='';trackChecked={};trackSearch='';languageEditorCode='';languageCatalogSearch='';languageTrackFilter='';topicEditorSlug='';topicCatalogSearch='';topicTrackFilter='';catalogLoaded=false;trackLinksLoaded=false;}
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
       if(tab==='artists'||tab==='releases'||tab==='languages'||tab==='topics')loadCatalogArtists();
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
   data=API.defaults();baseline='';published=null;tab='hero';languageEditorCode='';languageCatalogSearch='';languageTrackFilter='';topicEditorSlug='';topicCatalogSearch='';topicTrackFilter='';hide();updateButtons();
 }
 var nav=document.querySelectorAll('#landing-tabs [data-landing-tab]');
 for(var i=0;i<nav.length;i++)nav[i].onclick=function(){
   tab=this.getAttribute('data-landing-tab');render();
   if(tab==='artists'||tab==='releases'||tab==='languages'||tab==='topics')loadCatalogArtists();
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
