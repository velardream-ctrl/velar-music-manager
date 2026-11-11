/* RUN-072 — Real & invented languages, grouped by curator-approved songs.
   All data comes from the existing published landing document; no extra reads.
   Spotify/YouTube embeds load only after an explicit click. ES5/iOS12. */
(function(){
 'use strict';
 var current='',dataset=null,buttons=[],moreCount=14;
 function id(k){return document.getElementById(k);}
 function el(tag,cls,t){var n=document.createElement(tag);if(cls)n.className=cls;
   if(typeof t==='string')n.textContent=t;return n;}
 function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function entries(){
   if(!dataset||!Array.isArray(dataset.entries))return [];
   return dataset.entries.filter(function(x){return x.visible===true;});
 }
 function embed(track){
   if(!window.VMM_LANDING_SCHEMA)return '';
   var link=window.VMM_LANDING_SCHEMA.songUrl(track.url,track.provider);
   if(!link)return '';
   if(track.provider==='spotify')return 'https://open.spotify.com/embed/track/'+link.split('/').pop();
   if(track.provider==='youtube')return 'https://www.youtube-nocookie.com/embed/'+link.split('v=')[1];
   return '';
 }
 function show(code,requestedUrl){
   var lang=null,detail=id('public-language-detail');
   entries().forEach(function(item){if(item.code===code)lang=item;});
   if(!lang)lang=entries()[0]||null;
   current=lang?lang.code:'';
   buttons.forEach(function(item){item.btn.setAttribute('aria-pressed',item.code===current?'true':'false');});
   if(!detail)return;
   clear(detail);
   if(!lang){detail.appendChild(el('p','language-empty','Языки ещё не опубликованы.'));return;}
   var head=el('div','language-detail-heading');
   head.appendChild(el('span','universe-info-kicker',lang.fictional?'АВТОРСКИЙ ВЫМЫШЛЕННЫЙ ЯЗЫК':'ЯЗЫК МУЗЫКИ'));
   head.appendChild(el('h3','',lang.label));
   detail.appendChild(head);
   var count=lang.tracks?lang.tracks.length:0;
   if(!count){
     detail.appendChild(el('p','language-empty','Для этого языка песни ещё не назначены в музыкальной студии. Здесь появятся только подтверждённые публикации.'));
     return;
   }
   detail.appendChild(el('p','language-total','Композиции: '+count+'. Выберите песню, чтобы открыть официальный плеер.'));
   var list=el('div','language-song-list'),player=el('div','language-player');
   var requestedIndex=-1;
   if(requestedUrl&&lang.code===code)lang.tracks.forEach(function(t,i){
     var approved='';try{approved=window.VMM_LANDING_SCHEMA.songUrl(t.url,t.provider);}catch(ignore){}
     if(t.url===requestedUrl&&approved===requestedUrl)requestedIndex=i;
   });
   var limit=Math.max(moreCount,requestedIndex+1),selected=-1;
   function draw(){
     clear(list);
     lang.tracks.slice(0,limit).forEach(function(track,index){
       var song=el('button','language-song');song.type='button';
       song.setAttribute('aria-label','Слушать: '+track.title);
       song.setAttribute('aria-pressed',selected===index?'true':'false');
       song.appendChild(el('span','language-song-num',('0'+(index+1)).slice(-2)));
       var title=el('span','language-song-copy');
       title.appendChild(el('strong','',track.title));
       title.appendChild(el('small','',(track.artist?track.artist+' · ':'')+
         (track.provider==='spotify'?'Spotify':'YouTube')));
       song.appendChild(title);
       var icon=el('span','language-song-play');icon.setAttribute('aria-hidden','true');
       song.appendChild(icon);
       song.onclick=function(){
         var src=embed(track);
         if(!src)return;
         // Only one external player: shut down earlier embeds from releases,
         // artist profiles, playlists or the radio before opening this one.
         if(window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.stopExternalPlayers)
           window.VMM_PUBLIC_LANDING.stopExternalPlayers();
         clear(player);selected=index;
         var frame=el('iframe','cms-release-iframe language-song-iframe'+
           (track.provider==='youtube'?' cms-release-iframe--video':''));
         frame.title=track.title+' — официальный плеер '+track.provider;
         frame.src=src;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
         frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
         frame.setAttribute('allowfullscreen','');
         player.appendChild(frame);
         var open=el('a','cms-card-link','Открыть в '+(track.provider==='spotify'?'Spotify':'YouTube'));
         open.href=window.VMM_LANDING_SCHEMA.songUrl(track.url,track.provider);
         open.rel='noopener noreferrer';open.target='_blank';player.appendChild(open);
         var stop=el('button','cms-release-close','Закрыть плеер');
         stop.type='button';stop.onclick=function(){clear(player);selected=-1;draw();};
         player.appendChild(stop);draw();
       };
       list.appendChild(song);
     });
     if(limit<lang.tracks.length){
       var more=el('button','language-more','Показать ещё ('+(lang.tracks.length-limit)+')');
       more.type='button';more.onclick=function(){limit+=14;draw();};
       list.appendChild(more);
     }
   }
   detail.appendChild(list);detail.appendChild(player);draw();
   if(requestedIndex>=0&&list.children[requestedIndex]){
     // Only a direct click on a chat recommendation calls this playback route.
     list.children[requestedIndex].onclick();return true;
   }
   return false;
 }
 function play(code,url){return show(code,url);}

 function render(config){
   var orbit=id('public-language-orbit'),detail=id('public-language-detail');
   if(!orbit||!detail)return;
   dataset=config||{heading:'Музыка на языках Вселенной',intro:'',entries:[]};
   var title=id('languages-title'),intro=id('languages-intro');
   if(title)title.textContent=dataset.heading;
   if(intro)intro.textContent=dataset.intro;
   clear(orbit);buttons=[];
   var visible=entries(),n=visible.length;
   orbit.className='language-orbit'+(n>16?' is-dense':'');
   // Two constellations surround the brand crystal on wide screens.
   var outer=Math.ceil(n*.68),inner=n-outer;
   visible.forEach(function(lang,index){
     var ring=index<outer?0:1;
     var place=ring===0?index:index-outer;
     var count=ring===0?outer:inner;
     var angle=-Math.PI/2+(Math.PI*2*(place+(ring?.35:0)))/Math.max(1,count);
     var x=50+(ring?25:43)*Math.cos(angle);
     var y=50+(ring?25:41)*Math.sin(angle);
     var chip=el('button','language-orbit-node');chip.type='button';
     chip.style.left=x.toFixed(2)+'%';chip.style.top=y.toFixed(2)+'%';
     chip.setAttribute('aria-label','Выбрать язык: '+lang.label);
     chip.setAttribute('aria-pressed','false');
     chip.appendChild(el('span','language-orbit-label',lang.label));
     chip.appendChild(el('small','',lang.tracks.length?String(lang.tracks.length)+' песен':'скоро'));
     chip.onclick=function(){show(lang.code);};
     buttons.push({btn:chip,code:lang.code});orbit.appendChild(chip);
   });
   show(current);
 }
 window.VELAR_LANGUAGES={render:render,entries:entries,show:show,play:play};
}());
