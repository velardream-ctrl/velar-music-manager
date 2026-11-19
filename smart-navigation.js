/* Search only the same normalized snapshot that built the public sections. */
(function(){
 'use strict';
 function norm(value){
   return String(value||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9\u00c0-\u024f]+/g,' ').trim();
 }
 function near(a,b){
   if(Math.min(a.length,b.length)<3||Math.abs(a.length-b.length)>1)return false;
   var i=0,j=0,errors=0;
   while(i<a.length&&j<b.length){
     if(a[i]===b[j]){i++;j++;continue;}
     if(++errors>1)return false;
     if(a.length>=b.length)i++;
     if(a.length<=b.length)j++;
   }
   return errors+a.length-i+b.length-j<=1;
 }
 function artistMatch(name,query){
   var words=norm(name).split(' '),parts=query.split(' ');
   return parts.every(function(part){return words.some(function(word){
     return word===part||word.length>=4&&word===part.replace(/[ая]$/,'')||
       word==='илья'&&part==='ильи';
   });});
 }
 function command(raw,data){
   var match=/^(найди|покажи|открой|включи|play|find|open)\s+(?:(песню|песни|трек|song)\s+)?(.+)$/i.exec(String(raw).trim());
   if(!match||!data)return null;
   var query=norm(match[3]),play=/включи|play/i.test(match[1]);
   if(!query||/^(радио|radio|velar radio|велар радио)$/.test(query))return null;
   var found=[],seen=Object.create(null),best=0,genres=data.genres||{};
   function add(track,artist,kind,key){
     var api=window.VELAR_PUBLIC_SONGS,sources=api&&api.approved(track);
     if(!sources||!sources.length)return;
     var title=norm(track.title),who=track.artist||artist||'';
     var direct=title===query||play&&title.slice(-1)==='а'&&title.slice(0,-1)+'у'===query;
     var rank=direct?4:(title.indexOf(query)>=0||artistMatch(who,query))?3:near(title,query)?2:0;
     if(!rank||rank<best)return;
     if(rank>best){found=[];seen=Object.create(null);best=rank;}
     if(sources.some(function(src){return seen[src.url];}))return;
     sources.forEach(function(src){seen[src.url]=true;});
     found.push({action:'navigate-song',kind:kind,target:key,url:sources[0].url,play:play,
       label:track.title+(who?' — '+who:'')});
   }
   function scan(section,kind,key){
     (section&&section.entries||[]).forEach(function(group){
       if(group.visible)(group.tracks||[]).forEach(function(track){add(track,group.artist,kind,group[key]);});
     });
   }
   (data.artists&&data.artists.cards||[]).forEach(function(a){
     if(a.visible)(a.featuredTracks||[]).forEach(function(t){add(t,a.title,'artist',a.artistId||a.title);});
   });
   scan(genres.topics,'topic','slug');scan(genres.languages,'language','code');
   scan(genres,'genre','id');scan(data.albums,'album','id');
   (data.releases&&data.releases.cards||[]).forEach(function(r){
     if(r.visible)add({title:r.title,url:r.mediaUrl,provider:r.mediaProvider},r.subtitle,'release','');
   });
   if(!found.length)return match[2]||/найди|включи|find|play/i.test(match[1])?
     {text:'В опубликованном каталоге совпадений нет. Попробуй часть названия или имя артиста.'}:null;
   if(found.length===1&&best>2)return {text:found[0].label,selection:found[0]};
   return {text:best===2?'Возможно, ты ищешь одну из этих песен?':'Какую композицию открыть?',actions:found};
 }
 function navigate(choice){
   var base=document,controller;
   if(choice.kind==='topic')return window.VELAR_TOPICS.openFromChat(choice.target,choice.url,choice.play);
   if(choice.kind==='language')return window.VELAR_LANGUAGES.openFromChat(choice.target,choice.url,choice.play);
   if(choice.kind==='genre')controller=window.VELAR_GENRES.select(choice.target);
   if(choice.kind==='album')controller=window.VELAR_ALBUMS.expand(choice.target);
   if(controller)return controller.openByUrl(choice.url,choice.play);
   if(choice.kind==='artist'){
     var groups=document.querySelectorAll('[data-song-artist]');
     for(var g=0;g<groups.length;g++)if(groups[g].getAttribute('data-song-artist')===choice.target){base=groups[g];break;}
     if(base===document)return false;
     var list=base.querySelector('.public-artist-song-list');
     if(list&&list.velarSongs)return list.velarSongs.openByUrl(choice.url,choice.play);
   }
   var cards=base.querySelectorAll('[data-song-url]');
   for(var i=0;i<cards.length;i++){
     var card=cards[i];if(card.getAttribute('data-song-url')!==choice.url)continue;
     var button=card.querySelector('.cms-music-track,.cms-release-listen');
     if(button){
       card.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
       if(button.getAttribute('aria-pressed')!=='true')button.click();
       var frame=card.querySelector('iframe');
       if(choice.play&&frame&&/^https:\/\/www\.youtube-nocookie\.com\/embed\//.test(frame.src)){
         frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
         if(frame.src.indexOf('autoplay=1')<0)frame.src+=(frame.src.indexOf('?')<0?'?':'&')+'autoplay=1';
       }
       card.classList.add('song-found');window.setTimeout(function(){card.classList.remove('song-found');},2400);
       return true;
     }
   }
   return false;
 }
 window.VELAR_NAVIGATION={command:command,navigate:navigate};
}());
