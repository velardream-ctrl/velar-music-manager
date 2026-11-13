/* RUN-112 — unified private song distribution and the first Smart Site index.
   ES5/Safari12. No Firestore/network calls, no second assignment database.
   The caller owns current draft, publish and conflict-safe offline handling. */
(function(){
 'use strict';
 var state={search:'',filter:'all',group:'all',page:0},PAGE=25;
 function str(x){return String(x==null?'':x).trim();}
 function norm(x){return str(x).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');}
 function tokens(x){return norm(x).split(/[^a-z0-9а-яа-ӿ]+/).filter(function(t){return !!t;});}
 function safeUrl(API,url,provider){
   try{return API.songUrl(str(url),provider)||'';}catch(e){return '';}
 }
 function sources(API,song){
   var x=song&&song.links||{};
   return {spotify:safeUrl(API,x.spotify,'spotify'),youtube:safeUrl(API,x.youtube,'youtube')};
 }
 function refs(track){
   var a=[];
   if(track&&track.url)a.push(str(track.url));
   if(track&&track.alternateUrl)a.push(str(track.alternateUrl));
   return a;
 }
 function groupList(page){
   var out=[];
   if(!page)return out;
   function add(kind,arr,label,idField){
     (arr||[]).forEach(function(entry){
       if(!entry||!entry[idField])return;
       out.push({kind:kind,id:String(entry[idField]),label:label+': '+str(entry.label||entry.title||entry[idField]),
         visible:entry.visible===true,entry:entry,tracks:entry.featuredTracks||entry.tracks||[]});
     });
   }
   var g=page.genres||{};
   add('topic',g.topics&&g.topics.entries,'Тема','slug');
   add('language',g.languages&&g.languages.entries,'Язык','code');
   add('album',page.albums&&page.albums.entries,'Альбом','id');
   add('featured',page.artists&&page.artists.cards,'Лучшие песни','artistId');
   return out;
 }
 function sameGroup(a,b){return a.kind===b.kind&&a.id===b.id;}
 function sameTrack(a,b){
   return refs(a).some(function(url){return refs(b).indexOf(url)>=0;});
 }
 function build(catalog,draft,publicPage,linkData,API,artistEffective){
   var all=[],byId={},byUrl={},issues=[];
   (catalog||[]).forEach(function(song){
     if(!song||!str(song.id)||byId[str(song.id)])return;
     var row={id:str(song.id),title:str(song.title)||'Без названия',
       artist:str(song.artist),sources:sources(API,song),draft:[],live:[],
       artistId:'',searchText:'',display:[]};
     row.hasSource=!!(row.sources.spotify||row.sources.youtube);
     row.artistId=artistEffective?artistEffective(song,linkData&&linkData.overrides||{}):'';
     all.push(row);byId[row.id]=row;
     [row.sources.spotify,row.sources.youtube].forEach(function(url){
       if(!url)return;
       if(!byUrl[url])byUrl[url]=[];
       if(byUrl[url].indexOf(row.id)<0)byUrl[url].push(row.id);
     });
   });
   function unique(track){
     var ids=[];
     refs(track).forEach(function(url){
       (byUrl[url]||[]).forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});
     });
     return ids.length===1?ids[0]:null;
   }
   function ingest(page,scope){
     groupList(page).forEach(function(group){
       group.tracks.forEach(function(track){
         var id=unique(track);
         if(id){
           var row=byId[id],item={kind:group.kind,id:group.id,label:group.label,visible:group.visible};
           var a=scope==='live'?row.live:row.draft;
           if(!a.some(function(existing){return sameGroup(existing,item);}))a.push(item);
         }else issues.push({scope:scope,group:group.label,title:str(track&&track.title),
           reason:'Не удалось однозначно сопоставить по официальной ссылке'});
       });
     });
   }
   ingest(draft,'draft');ingest(publicPage,'live');
   all.forEach(function(row){
     row.ambiguous=!!(row.sources.spotify&&byUrl[row.sources.spotify].length!==1||
       row.sources.youtube&&byUrl[row.sources.youtube].length!==1);
     row.draft.forEach(function(group){
       var liveGroup=row.live.filter(function(old){return sameGroup(group,old);})[0];
       // The group may exist in both documents yet its visibility has changed.
       row.display.push({kind:group.kind,id:group.id,label:group.label,
         visible:group.visible,stage:!liveGroup||liveGroup.visible!==group.visible?'draft':
           group.visible?'published':'hidden'});
     });
     row.live.forEach(function(group){
       if(!row.draft.some(function(item){return sameGroup(item,group);}))
         row.display.push({kind:group.kind,id:group.id,label:group.label,
           visible:group.visible,stage:'removed'});
     });
     row.searchText=norm([row.title,row.artist,row.id,row.artistId,row.sources.spotify,
       row.sources.youtube].concat(row.display.map(function(item){return item.label;})).join(' '));
     row.searchTokens=tokens(row.searchText);
   });
   all.sort(function(a,b){
     return a.title.localeCompare(b.title,'ru',{numeric:true,sensitivity:'base'})||
       a.artist.localeCompare(b.artist,'ru',{numeric:true,sensitivity:'base'});
   });
   return {rows:all,byId:byId,issues:issues,targets:groupList(draft),
     counts:{total:all.length,without:all.filter(function(row){return !row.draft.length;}).length,
       many:all.filter(function(row){return row.draft.length>1;}).length,
       noSource:all.filter(function(row){return !row.hasSource;}).length},
     unique:unique};
 }
 function search(model,query,filter,group){
   var q=tokens(query);
   return model.rows.filter(function(row){
     if(filter==='without'&&row.draft.length)return false;
     if(filter==='many'&&row.draft.length<2)return false;
     if(filter==='changed'&&!row.display.some(function(a){return a.stage!=='published';}))return false;
     if(filter==='noSource'&&row.hasSource)return false;
     if(group&&group!=='all'&&!row.display.some(function(a){return a.kind+':'+a.id===group;}))return false;
     return q.every(function(word){
       return row.searchText.indexOf(word)>=0||
         row.searchTokens.some(function(t){return t.indexOf(word)===0;});
     });
   });
 }
 function modify(catalog,draft,action,API,artistEffective,linkData){
   var model=build(catalog,draft,null,linkData,API,artistEffective);
   var row=model.byId[action.songId];
   if(!row)throw new Error('Песня отсутствует в полном каталоге.');
   // Removing an existing matched assignment must remain possible even
   // when one provider disappeared from the private catalog.
   if(action.enabled&&!row.hasSource)throw new Error('У песни нет проверенной публичной Spotify/YouTube ссылки.');
   if(row.ambiguous)throw new Error('Официальная ссылка встречается у нескольких записей. Назначение запрещено до устранения неоднозначности.');
   var target=model.targets.filter(function(x){return x.kind===action.kind&&x.id===action.targetId;})[0];
   if(!target)throw new Error('Подборка изменилась или удалена — обнови редактор.');
   var current=[];
   target.tracks.forEach(function(track){
     if(model.unique(track)===row.id)current.push(track);
   });
   if(current.length>1)throw new Error('Найдены повторные назначения этой песни. Исправь их в разделе подборки.');
   if(action.enabled&&current.length||!action.enabled&&!current.length)return false;
   if(action.enabled){
     var provider=row.sources.spotify?'spotify':'youtube',url=row.sources[provider];
     if(target.kind==='featured'){
       if(row.artistId!==target.id)throw new Error('Для «Лучших песен» сначала назначь композицию нужному артисту в разделе «Артисты».');
       if(target.tracks.length>=3)throw new Error('Для артиста допускаются только три лучшие песни.');
       if(target.tracks.some(function(t){return sameTrack(t,{url:url});}))
         throw new Error('Эта ссылка уже есть в лучших песнях.');
       target.tracks.push(API.featuredTrack({title:row.title,provider:provider,url:url},target.tracks.length+1));
     }else{
       var limit=target.kind==='album'?60:300;
       if(target.tracks.length>=limit)throw new Error('В этой подборке уже '+limit+' песен — максимум, допустимый схемой.');
       if(target.tracks.some(function(t){
         return norm(t.title)===norm(row.title)&&norm(t.artist)===norm(row.artist);
       }))throw new Error('Такая песня уже присутствует с другой ссылкой. Проверь её в исходном разделе.');
       var record={title:row.title,artist:row.artist,provider:provider,url:url};
       var secondary=provider==='spotify'?'youtube':'spotify';
       if(row.sources[secondary]){record.alternateProvider=secondary;record.alternateUrl=row.sources[secondary];}
       target.tracks.push(API.languageTrack(record,target.tracks.length+1));
     }
   }else{
     target.tracks.splice(target.tracks.indexOf(current[0]),1);
   }
   return true;
 }
 function reset(){state={search:'',filter:'all',group:'all',page:0};}
 function render(host,context){
   while(host.firstChild)host.removeChild(host.firstChild);
   var el=function(tag,cls,txt){
     var node=document.createElement(tag);
     if(cls)node.className=cls;
     if(typeof txt!=='undefined')node.textContent=txt;
     return node;
   };
   function option(select,val,label){
     var opt=el('option','',label);opt.value=val;select.appendChild(opt);
     if(!select.value)select.value=val;
     return opt;
   }
   var h=el('h3','','Распределение песен');host.appendChild(h);
   host.appendChild(el('p','sync-note',
     'Все назначения в одном месте. Изменения затрагивают только текущий черновик; публикация выполняется отдельно. Артист показан для справки, его привязка меняется в разделе «Артисты».'));
   if(!context.loaded){
     host.appendChild(el('p','sync-note','Загружаем защищённый каталог…'));
     var load=el('button','landing-add','Загрузить каталог');
     load.type='button';load.onclick=context.onLoad;host.appendChild(load);return;
   }
   var model=build(context.catalog,context.draft,context.published,
     context.links,context.API,context.artistEffective);
   var stat=el('p','landing-distribution-summary');
   function refreshSummary(){
     model=build(context.catalog,context.draft,context.published,
       context.links,context.API,context.artistEffective);
     stat.textContent='Всего '+model.counts.total+' · Без подборок '+model.counts.without+
       ' · В нескольких '+model.counts.many+' · Без публичной ссылки '+model.counts.noSource;
   }
   refreshSummary();host.appendChild(stat);
   if(model.issues.length){
     var warning=el('p','landing-distribution-warning',
       'Неоднозначные/старые привязки: '+model.issues.length+
       '. Они не меняются автоматически; проверь их в исходных разделах.');
     host.appendChild(warning);
   }
   var toolbar=el('div','landing-distribution-toolbar');
   var input=el('input','landing-distribution-search');
   input.type='search';input.placeholder='Найти песню, артиста, раздел…';
   input.value=state.search;input.setAttribute('aria-label','Поиск по всем песням и назначениям');
   toolbar.appendChild(input);
   var filter=el('select','landing-distribution-filter');
   filter.setAttribute('aria-label','Фильтр песен');
   [['all','Все песни'],['without','Без подборок'],['many','Несколько разделов'],
    ['changed','Изменения в черновике'],['noSource','Нет ссылки для публикации']].forEach(function(x){option(filter,x[0],x[1]);});
   filter.value=state.filter;toolbar.appendChild(filter);
   var group=el('select','landing-distribution-filter');
   group.setAttribute('aria-label','Выбрать раздел назначения');
   option(group,'all','Все разделы');
   model.targets.forEach(function(target){option(group,target.kind+':'+target.id,target.label);});
   group.value=state.group;toolbar.appendChild(group);host.appendChild(toolbar);
   var list=el('div','landing-distribution-results');host.appendChild(list);
   var pager=el('div','landing-distribution-pagination');host.appendChild(pager);
   var hint=el('p','sync-note','');host.appendChild(hint);
   function putStatus(text){hint.textContent=text;}
   function assignmentChips(holder,row){
     while(holder.firstChild)holder.removeChild(holder.firstChild);
     if(!row.display.length)holder.appendChild(el('span','landing-distribution-empty','Не назначена в подборки'));
     row.display.forEach(function(item){
       var label=item.label+(item.stage==='draft'?' · изменение в черновике':
         item.stage==='removed'?' · снято в черновике':item.stage==='hidden'?' · скрыто':
         !item.visible?' · скрыто':'');
       var chip=el('span','landing-distribution-chip'+
         (item.stage==='removed'?' is-removed':item.stage==='draft'?' is-draft':''),label);
       if(item.stage!=='removed'){
         var x=el('button','landing-distribution-remove','×');
         x.type='button';x.setAttribute('aria-label','Убрать '+row.title+' из '+item.label);
         x.onclick=function(){apply(row,{songId:row.id,kind:item.kind,targetId:item.id,enabled:false},holder);};
         chip.appendChild(x);
       }
       holder.appendChild(chip);
     });
   }
   function apply(row,action,holder){
     if(context.blocked&&context.blocked()){
       putStatus('Запись остановлена: сначала разреши конфликт черновика или дождись завершения сохранения.');
       return;
     }
     try{
       var changed=context.onModify(action);
       if(!changed){putStatus('Это назначение уже в нужном состоянии.');return;}
       refreshSummary();
       var next=model.byId[row.id];
       assignmentChips(holder,next);
       putStatus('Изменено только в черновике: '+row.title+'. Чтобы увидеть на сайте, сохрани и отдельно опубликуй.');
     }catch(err){putStatus('Не удалось изменить назначение: '+err.message);}
   }
   function drawPage(){
     while(list.firstChild)list.removeChild(list.firstChild);
     while(pager.firstChild)pager.removeChild(pager.firstChild);
     var matched=search(model,state.search,state.filter,state.group);
     var pages=Math.max(1,Math.ceil(matched.length/PAGE));
     if(state.page>=pages)state.page=pages-1;
     if(state.page<0)state.page=0;
     var start=state.page*PAGE;
     matched.slice(start,start+PAGE).forEach(function(row){
       var card=el('section','landing-distribution-row');
       var title=el('div','landing-distribution-title',row.title+' · '+(row.artist||'Исполнитель не указан'));
       card.appendChild(title);
       card.appendChild(el('div','landing-distribution-artist',
         'Артист: '+(row.artistId||'не определён')+
         ' · Spotify: '+(row.sources.spotify?'есть':'нет')+
         ' · YouTube: '+(row.sources.youtube?'есть':'нет')+
         (row.ambiguous?' · ⚠ Совпадающая ссылка у нескольких песен':'')));
       var chips=el('div','landing-distribution-chips');assignmentChips(chips,row);
       card.appendChild(chips);
       var controls=el('div','landing-distribution-controls');
       var select=el('select','landing-distribution-target');
       select.setAttribute('aria-label','Добавить песню '+row.title+' в раздел');
       var targets=model.targets.filter(function(t){
         return t.kind!=='featured'||row.artistId===t.id;
       });
       targets.forEach(function(t){option(select,t.kind+':'+t.id,t.label);});
       controls.appendChild(select);
       var add=el('button','landing-distribution-add','+ Добавить');
       add.type='button';add.disabled=!row.hasSource||row.ambiguous||!targets.length;
       add.onclick=function(){
         var val=select.value,pos=val.indexOf(':');if(pos<0)return;
         apply(row,{songId:row.id,kind:val.slice(0,pos),targetId:val.slice(pos+1),enabled:true},chips);
       };
       controls.appendChild(add);
       card.appendChild(controls);list.appendChild(card);
     });
     if(!matched.length)list.appendChild(el('p','sync-note',
       'Песни с таким поиском и фильтром не найдены.'));
     var status=el('span','landing-distribution-page',
       (matched.length?start+1:0)+'–'+Math.min(start+PAGE,matched.length)+' из '+matched.length);
     pager.appendChild(status);
     if(pages>1){
       var prev=el('button','landing-small','← Назад');prev.type='button';prev.disabled=state.page===0;
       prev.onclick=function(){state.page--;drawPage();};
       pager.appendChild(prev);
       var next=el('button','landing-small','Вперёд →');next.type='button';next.disabled=state.page===pages-1;
       next.onclick=function(){state.page++;drawPage();};
       pager.appendChild(next);
     }
   }
   input.oninput=function(){state.search=input.value;state.page=0;drawPage();};
   filter.onchange=function(){state.filter=filter.value;state.page=0;drawPage();};
   group.onchange=function(){state.group=group.value;state.page=0;drawPage();};
   drawPage();
 }
 window.VMM_SONG_DISTRIBUTION={
   build:build,search:search,modify:modify,render:render,reset:reset
 };
}());