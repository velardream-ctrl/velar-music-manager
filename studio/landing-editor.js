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
 var albumEditorId='',albumCatalogSearch='',albumTrackFilter='';
 var faqSearch='',faqGroup='',faqPage=0;
 var tabs={hero:'Первый экран',artists:'Артисты',releases:'Музыка и релизы',albums:'Альбомы',playlists:'Плейлисты и подписки',radio:'VELAR RADIO',universe:'Созвездия',languages:'Языки песен',topics:'Темы песен',assistant:'Помощник VELAR',genres:'Жанры',about:'О проекте',publish:'Публикация'};
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
     if(tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics')render();
   }).catch(function(err){
     if(generation!==loadGeneration||account!==uid)return;
     catalogLoading=false;catalogError=err&&err.message||'Каталог или связи песен временно недоступны.';
     if(tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics')render();
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
 function attachedSongSources(t){
   var result={spotify:'',youtube:''};
   if(t&&result.hasOwnProperty(t.provider))result[t.provider]=t.url||'';
   if(t&&t.alternateUrl&&result.hasOwnProperty(t.alternateProvider))
     result[t.alternateProvider]=t.alternateUrl;
   return result;
 }
 function attachedSongMode(t){
   return t&&t.alternateUrl?t.provider+'+'+t.alternateProvider:t&&t.provider||'spotify';
 }
 function attachedCatalogOptions(){
   var result=[];
   (catalogArtists||[]).forEach(function(song){
     var urls=song.links||{};
     var spotify=API.songUrl(urls.spotify||'','spotify'),
       youtube=API.songUrl(urls.youtube||'','youtube');
     if(spotify||youtube)result.push({title:String(song.title||'Без названия'),
       artist:String(song.artist||''),spotify:spotify,youtube:youtube});
   });
   return result;
 }
 function attachedSongKey(t){
   return String(t.title||'').trim().toLocaleLowerCase('ru')+'|'+
     String(t.artist||'').trim().toLocaleLowerCase('ru');
 }
 function attachedFind(target,song){
   var key=attachedSongKey(song),urls=[song.spotify,song.youtube].filter(function(u){return !!u;});
   for(var i=0;i<target.tracks.length;i++){
     var row=target.tracks[i],links=attachedSongSources(row);
     if(attachedSongKey(row)===key||(urls.some(function(url){
       return url===links.spotify||url===links.youtube;
     })))return row;
   }
   return null;
 }
 // RUN-097: visual checkbox picker only; RUN-090's single-track data model stays intact.
 function attachedCheckMode(currentPrimary,spotifyChecked,youtubeChecked){
   if(!spotifyChecked&&!youtubeChecked)return '';
   if(spotifyChecked&&youtubeChecked)
     return currentPrimary==='youtube'?'youtube+spotify':'spotify+youtube';
   return spotifyChecked?'spotify':'youtube';
 }
 function attachedSourceCheckbox(parent,provider,checked,disabled){
   var label=document.createElement('label');label.className='landing-source-check'+(disabled?' is-disabled':'');
   var box=document.createElement('input');box.type='checkbox';box.checked=!!checked;
   box.disabled=!!disabled;box.setAttribute('aria-label',provider==='spotify'?'Spotify':'YouTube');
   label.appendChild(box);
   var title=document.createElement('span');title.textContent=provider==='spotify'?'Spotify':'YouTube';
   label.appendChild(title);parent.appendChild(label);return box;
 }
 function attachedBuildSong(song,mode,sources){
   var parts=String(mode||'').split('+'),primary=parts[0],second=parts[1]||'';
   var raw={title:song.title,artist:song.artist,provider:primary,url:sources[primary]||''};
   if(second){raw.alternateProvider=second;raw.alternateUrl=sources[second]||'';}
   // Never allow a Drive/Storage URL or a provider with no verified track.
   return API.languageTrack(raw,1);
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
     if((links.spotify&&links.spotify===existing.spotify)||
        (links.spotify&&links.spotify===existing.youtube)||
        (links.youtube&&links.youtube===existing.youtube)||
        (links.youtube&&links.youtube===existing.spotify))
       throw new Error('Одна ссылка уже назначена другой композиции.');
   });
   if(!old&&target.tracks.length>=300)throw new Error('Максимум 300 песен на подборку.');
   if(old){
     // Preserve exact list position; never remove/push when switching player.
     old.title=clean.title;old.artist=clean.artist;old.provider=clean.provider;old.url=clean.url;
     delete old.alternateProvider;delete old.alternateUrl;
     if(clean.alternateUrl){old.alternateProvider=clean.alternateProvider;old.alternateUrl=clean.alternateUrl;}
   }else target.tracks.push(clean);
   return clean;
 }
 function attachedSongsEditor(parent,entry,opts){
   var mode=opts.mode||'language',isLanguage=mode==='language';
   var filter=opts.getFilter||function(){return '';},setFilter=opts.setFilter||function(){};
   var getCatalogSearch=opts.getCatalogSearch||function(){return '';},
     setCatalogSearch=opts.setCatalogSearch||function(){};
   var options=attachedCatalogOptions();
   heading(parent,isLanguage?'Подтверждённые песни ('+entry.tracks.length+')':
     'Назначенные песни ('+entry.tracks.length+')',
     'Найди композицию по названию или выбери из списка. Галочками отметь Spotify, YouTube или оба источника. Одна песня остаётся одной строкой. Изменения сохраняются сначала в черновике.');
   var search=document.createElement('input');search.type='search';search.className='landing-release-search';
   search.placeholder='Найти прикреплённую песню…';search.value=filter();parent.appendChild(search);
   var assigned=document.createElement('div');assigned.className='landing-language-songs';
   parent.appendChild(assigned);
   function catalogFor(t){
     var key=attachedSongKey(t);
     for(var i=0;i<options.length;i++){
       if(attachedSongKey(options[i])===key)return options[i];
     }
     return null;
   }
   function drawAssigned(){
     clear(assigned);
     var q=filter().toLocaleLowerCase('ru').replace(/ё/g,'е');
     var found=entry.tracks.filter(function(t){
       return !q||(t.title+' '+t.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0;
     });
     found.slice(0,40).forEach(function(t){
       var outer=document.createElement('div');outer.className='landing-attached-song';
       var line=document.createElement('div');line.className='landing-language-song-row';
       var title=document.createElement('span');
       title.textContent=t.title+' · '+t.artist+' · '+(t.provider==='spotify'?'Spotify':'YouTube')+
         (t.alternateUrl?' + '+(t.alternateProvider==='spotify'?'Spotify':'YouTube'):'');
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
         }
         var wrap=document.createElement('div');wrap.className='landing-attached-fields';
         var activeSources=attachedSongSources(t);
         var checks=document.createElement('div');checks.className='landing-song-sources';
         checks.setAttribute('role','group');
         checks.setAttribute('aria-label','Источники записи: '+t.title);
         var spotifyCheck=attachedSourceCheckbox(checks,'spotify',!!activeSources.spotify,false);
         var youtubeCheck=attachedSourceCheckbox(checks,'youtube',!!activeSources.youtube,false);
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
         var buttons=document.createElement('div');buttons.className='landing-item-actions';
         buttons.appendChild(button('Применить',function(){
           try{
             var chosen=attachedCheckMode(t.provider,spotifyCheck.checked,youtubeCheck.checked);
             if(!chosen)throw new Error('Отметь Spotify, YouTube или оба источника.');
             attachedReplace(entry,t,t,chosen,
               {spotify:spotify.value.trim(),youtube:youtube.value.trim()});
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
   drawAssigned();
   heading(parent,'Каталог песен — быстрый выбор',
     'Найди песню по названию или исполнителю и нажми на неё. Spotify и YouTube выбираются отдельными галочками; обе площадки относятся к одной песне.');
   if(!catalogLoaded){
     var msg=document.createElement('p');msg.className='sync-note';
     msg.textContent=catalogLoading?'Загружаем каталог…':catalogError?
       'Ошибка каталога: '+catalogError:'Каталог ещё не загружен.';
     parent.appendChild(msg);
     parent.appendChild(button('Загрузить каталог',function(){
       catalogLoaded=false;loadCatalogArtists(true);
     }));
     return;
   }
   var catalogSearch=document.createElement('input');catalogSearch.type='search';
   catalogSearch.className='landing-language-catalog-search';
   catalogSearch.placeholder='Название песни или артист…';
   catalogSearch.value=getCatalogSearch();parent.appendChild(catalogSearch);
   var results=document.createElement('div');results.className='landing-language-catalog-list';
   parent.appendChild(results);
   function drawCatalog(){
     clear(results);
     var q=getCatalogSearch().toLocaleLowerCase('ru').replace(/ё/g,'е'),count=0;
     options.forEach(function(song){
       if(q&&(song.title+' '+song.artist).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)<0)return;
       if(count++>=40)return;
       var existing=attachedFind(entry,song),sources={spotify:song.spotify,youtube:song.youtube};
       if(existing){
         var old=attachedSongSources(existing);
         if(!sources.spotify)sources.spotify=old.spotify;
         if(!sources.youtube)sources.youtube=old.youtube;
       }
       if(!sources.spotify&&!sources.youtube)return;
       var row=document.createElement('div');row.className='landing-topic-catalog-row';
       var holder=document.createElement('label');holder.className='landing-checkbox';
       var check=document.createElement('input');check.type='checkbox';check.checked=!!existing;
       holder.appendChild(check);
       var name=document.createElement('span');name.textContent=song.title+' · '+song.artist;
       holder.appendChild(name);row.appendChild(holder);
       var currentSources=existing?attachedSongSources(existing):{spotify:'',youtube:''};
       var choices=document.createElement('div');choices.className='landing-song-sources';
       choices.setAttribute('role','group');choices.setAttribute('aria-label','Источники: '+song.title);
       var spotifyCheck=attachedSourceCheckbox(choices,'spotify',!!currentSources.spotify,!sources.spotify);
       var youtubeCheck=attachedSourceCheckbox(choices,'youtube',!!currentSources.youtube,!sources.youtube);
       row.appendChild(choices);
       function applySources(){
         var current=attachedFind(entry,song);
         var mode=attachedCheckMode(current&&current.provider,spotifyCheck.checked,youtubeCheck.checked);
         if(!mode){
           if(current)entry.tracks.splice(entry.tracks.indexOf(current),1);
           check.checked=false;drawAssigned();updateButtons();
           info('Песня откреплена от этой подборки только в черновике.');
           return;
         }
         try{attachedReplace(entry,current,song,mode,sources);}
         catch(e){
           var restore=current?attachedSongSources(current):{spotify:'',youtube:''};
           spotifyCheck.checked=!!restore.spotify;
           youtubeCheck.checked=!!restore.youtube;
           check.checked=!!current;
           info('Нельзя прикрепить песню: '+e.message);return;
         }
         check.checked=true;drawAssigned();updateButtons();
         info('Привязка обновлена в черновике. Сохрани и опубликуй, чтобы изменения увидели слушатели.');
       }
       check.onchange=function(){
         if(!this.checked){spotifyCheck.checked=false;youtubeCheck.checked=false;}
         else if(!spotifyCheck.checked&&!youtubeCheck.checked){
           if(sources.spotify)spotifyCheck.checked=true;
           else youtubeCheck.checked=true;
         }
         applySources();
       };
       spotifyCheck.onchange=applySources;
       youtubeCheck.onchange=applySources;
       results.appendChild(row);
     });
     if(count>40){
       var note=document.createElement('p');note.className='sync-note';
       note.textContent='Первые 40 из '+count+'. Уточни поиск.';
       results.appendChild(note);
     }
     if(!count){
       var empty=document.createElement('p');empty.className='sync-note';
       empty.textContent='Нет песен с проверенными ссылками в каталоге.';
       results.appendChild(empty);
     }
   }
   catalogSearch.oninput=function(){setCatalogSearch(this.value);drawCatalog();};
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
   attachedSongsEditor(card,active,{mode:'language',
     getFilter:function(){return languageTrackFilter;},
     setFilter:function(v){languageTrackFilter=v;},
     getCatalogSearch:function(){return languageCatalogSearch;},
     setCatalogSearch:function(v){languageCatalogSearch=v;}
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
   selectField(parent,'Показ обложек альбомов',
     [['grid','Квадратные обложки — сетка'],['list','Обложка + описание — список']],
     cfg.view,function(v){cfg.view=v;});
   selectField(parent,'Вид песен в альбомах, языках и темах',
     [['rows','Обычные строки без миниатюр'],['covers','Строки с миниатюрой обложки'],['tiles','Квадратные карточки']],
     cfg.trackView,function(v){cfg.trackView=v;});
   var menu=document.createElement('div');menu.className='landing-language-menu';
   entries.forEach(function(album,index){
     var group=document.createElement('div');group.className='landing-language-menu-item';
     var select=button((album.title||album.id)+' · '+album.tracks.length+' песен',function(){
       albumEditorId=album.id;albumCatalogSearch='';albumTrackFilter='';render();
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
     albumEditorId=key;albumCatalogSearch='';albumTrackFilter='';render();
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
     setCatalogSearch:function(v){albumCatalogSearch=v;}
   });
   parent.appendChild(box);
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
   attachedSongsEditor(card,current,{mode:'topic',
     getFilter:function(){return topicTrackFilter;},
     setFilter:function(v){topicTrackFilter=v;},
     getCatalogSearch:function(){return topicCatalogSearch;},
     setCatalogSearch:function(v){topicCatalogSearch=v;}
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
     if(tab==='artists'){
       artistPicker(panel);
       selectField(panel,'Вид лучших песен',
         [['classic','Обычные строки (как сейчас)'],['covers','Строки с маленькими обложками'],['tiles','Квадратные карточки']],
         data.artists.featuredView||'classic',function(v){data.artists.featuredView=v;});
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
   if(loaded&&!force){render();if(tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics')loadCatalogArtists();return Promise.resolve();}
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
       if(tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics')loadCatalogArtists();
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
   if(tab==='artists'||tab==='releases'||tab==='albums'||tab==='languages'||tab==='topics')loadCatalogArtists();
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
