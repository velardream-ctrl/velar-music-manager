/* RUN-083: editorial FAQ and verified-song discovery. No network, tokens or tracking.
   Only music already published by the owner in the landing CMS may get a play button.
   ES5 / iOS12 compatible. */
(function(){
 'use strict';
 function norm(s){return String(s||'').toLowerCase().replace(/ё/g,'е')
   .replace(/[^a-zа-я0-9\s-]/g,' ').replace(/\s+/g,' ').trim();}
 function matches(q,term){var n=norm(term);return n.length>=2&&
   (' '+q+' ').indexOf(' '+n+' ')!==-1;}
 function publishedSongs(data){
   var items=[],seen={},api=window.VMM_LANDING_SCHEMA;
   function add(group,kind,id){
     if(!group||group.visible!==true||!Array.isArray(group.tracks))return;
     group.tracks.forEach(function(track){
       var url='';
       try{url=api&&api.songUrl&&api.songUrl(track.url,track.provider)||'';}catch(ignore){}
       if(!url||!track.title||seen[url])return;
       seen[url]=true;
       items.push({title:track.title,artist:track.artist||'',url:url,
         provider:track.provider,kind:kind,id:id});
     });
   }
   var genres=data&&data.genres||{},topics=genres.topics&&genres.topics.entries||[],
     languages=genres.languages&&genres.languages.entries||[];
   topics.forEach(function(t){add(t,'topic',t.slug);});
   languages.forEach(function(l){add(l,'language',l.code);});
   return items;
 }
 function buttons(songs){return songs.slice(0,2).map(function(t){
   return {action:'song',target:t.id,kind:t.kind,url:t.url,label:'▶ '+t.title.slice(0,64)};
 });}
 function make(text,actions){
   var result={text:text},items=(actions||[]).filter(function(a){return a&&a.label;}).slice(0,3);
   if(items.length===1){
     result.action=items[0].action;result.target=items[0].target;
     result.label=items[0].label;
     if(items[0].kind)result.kind=items[0].kind;
     if(items[0].url)result.url=items[0].url;
   }else if(items.length>1)result.actions=items;
   return result;
 }
 function find(q,settings){
   var best=null,score=-1;
   (settings&&settings.faq||[]).forEach(function(item){
     if(item.enabled===false)return;
     String(item.keywords||'').split(',').forEach(function(word){
       var w=norm(word);if(!matches(q,w))return;
       var rank=(q===w?10000:0)+w.length*10+(w.indexOf(' ')>=0?12:0);
       if(rank>score){best=item;score=rank;}
     });
   });
   return best;
 }
 function songMatch(q,songs){
   if(q.length<4)return [];
   return songs.filter(function(s){
     var title=norm(s.title);
     return title.length>=4&&(q===title||(' '+q+' ').indexOf(' '+title+' ')!==-1);
   }).slice(0,2);
 }
 function topicResult(item,data){
   var topics=data&&data.genres&&data.genres.topics&&data.genres.topics.entries||[];
   var selected=topics.filter(function(t){
     return t.slug===item.route.slice(6)&&t.visible===true;
   })[0];
   if(!selected)return make(item.answer,[{action:'link',target:'#topics',label:'Музыкальные темы'}]);
   var songs=publishedSongs({genres:{topics:{entries:[selected]},languages:{entries:[]}}});
   var actions=buttons(songs);
   actions.push({action:'topic',target:selected.slug,label:'Подборка: '+selected.label});
   return make(item.answer+(songs.length?'':' Пока в этой теме нет назначенных опубликованных песен.'),actions);
 }
 function languageResult(item,data){
   var languages=data&&data.genres&&data.genres.languages&&data.genres.languages.entries||[];
   var selected=languages.filter(function(l){
     return l.code===item.route.slice(9)&&l.visible===true;
   })[0];
   if(!selected)return make(item.answer,[{action:'link',target:'#languages',label:'Миры языков'}]);
   var songs=publishedSongs({genres:{topics:{entries:[]},languages:{entries:[selected]}}});
   var actions=buttons(songs);
   if(songs.length)actions.push({action:'language',target:selected.code,label:'Мир языка: '+selected.label});
   else actions=[{action:'link',target:'#languages',label:'Мир языка: '+selected.label}];
   return make(item.answer+(songs.length?'':' Пока для этого языка песни не назначены.'),actions);
 }
 function answer(raw,data,settings){
   var q=norm(raw);
   if(!q)return null;
   var songs=publishedSongs(data),exact=songMatch(q,songs);
   if(exact.length)return make('Нашёл опубликованную песню «'+exact[0].title+
     '». Нажми на название, чтобы открыть официальный плеер.',buttons(exact));
   var item=find(q,settings);
   if(!item)return null;
   var route=item.route||'none';
   if(route.indexOf('topic:')===0)return topicResult(item,data);
   if(route.indexOf('language:')===0)return languageResult(item,data);
   if(route.indexOf('section:')===0)return make(item.answer,
     [{action:'link',target:'#'+route.slice(8),label:'Перейти в раздел'}]);
   if(route==='contact'){
     if(settings&&settings.contactEmail)
       return make(item.answer,[{action:'email',target:'',label:'Написать автору'}]);
     return make(item.answer+' Публичная почта пока не настроена.',
       [{action:'link',target:'#about',label:'О проекте'}]);
   }
   if(route==='clarify'){
     var questions=String(item.followups||'').split(',').map(function(x){return x.trim();})
       .filter(function(x){return !!x;}).slice(0,3);
     return make(item.answer,questions.map(function(q){
       return {action:'ask',target:q,label:q};
     }));
   }
   return {text:item.answer};
 }
 window.VELAR_FAQ={answer:answer,publishedSongs:publishedSongs,
   find:find,songMatch:songMatch};
}());