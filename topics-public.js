/* RUN-073 — song topics / mood planets and editorial tag cloud.
   No additional Firestore reads, no auto-play, ES5 (Safari12 compatible).
   Only curated public metadata from the one existing landing snapshot. */
(function(){
 'use strict';
 var data=null,active='',buttons=[],showAll=false;
 function byId(s){return document.getElementById(s);}
 function el(tag,cls,t){var n=document.createElement(tag);if(cls)n.className=cls;
   if(typeof t==='string')n.textContent=t;return n;}
 function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function entries(){return data&&Array.isArray(data.entries)?
   data.entries.filter(function(t){return t.visible===true;}):[];}
 function approvedLink(t){
   return window.VMM_LANDING_SCHEMA?window.VMM_LANDING_SCHEMA.songUrl(t.url,t.provider):'';
 }
 function playerUrl(t){
   var link=approvedLink(t);if(!link)return '';
   if(t.provider==='spotify')return 'https://open.spotify.com/embed/track/'+link.split('/').pop();
   if(t.provider==='youtube')return 'https://www.youtube-nocookie.com/embed/'+link.split('v=')[1];
   return '';
 }
 function select(slug,requestedUrl){
   var selected=null,list=entries(),area=byId('public-topic-detail');
   list.forEach(function(t){if(t.slug===slug)selected=t;});
   if(!selected)selected=list[0]||null;
   active=selected?selected.slug:'';
   buttons.forEach(function(b){b.element.setAttribute('aria-pressed',b.slug===active?'true':'false');});
   if(!area)return;
   clear(area);
   if(!selected){area.appendChild(el('p','topic-empty','Тематические миры пока не опубликованы.'));return;}
   var header=el('div','topic-detail-heading');
   header.appendChild(el('span','universe-info-kicker','МУЗЫКАЛЬНАЯ ТЕМА'));
   header.appendChild(el('h3','',selected.label));
   if(selected.description)header.appendChild(el('p','',selected.description));
   area.appendChild(header);
   if(!selected.tracks.length){
     area.appendChild(el('p','topic-empty','Пока в этом мире нет назначенных песен. Новые композиции появятся после проверки и публикации.'));
     return;
   }
   area.appendChild(el('p','topic-count','Песен по теме: '+selected.tracks.length));
   var songs=el('div','topic-song-list'),player=el('div','topic-player');
   var requestedIndex=-1;
   if(requestedUrl&&selected.slug===slug)selected.tracks.forEach(function(t,i){
     if(t.url===requestedUrl&&approvedLink(t)===requestedUrl)requestedIndex=i;
   });
   var limit=Math.max(12,requestedIndex+1),playing=-1;
   function paint(){
     clear(songs);
     selected.tracks.slice(0,limit).forEach(function(t,i){
       var song=el('button','topic-song');song.type='button';
       song.setAttribute('aria-label','Слушать: '+t.title);
       song.setAttribute('aria-pressed',playing===i?'true':'false');
       var number=el('span','topic-song-index',String(i+1).padStart?String(i+1).padStart(2,'0'):('0'+(i+1)).slice(-2));
       var info=el('span','topic-song-info');
       info.appendChild(el('strong','',t.title));
       info.appendChild(el('small','',(t.artist?t.artist+' · ':'')+(t.provider==='spotify'?'Spotify':'YouTube')));
       var play=el('span','topic-song-play');play.setAttribute('aria-hidden','true');
       song.appendChild(number);song.appendChild(info);song.appendChild(play);
       song.onclick=function(){
         var src=playerUrl(t);if(!src)return;
         if(window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.stopExternalPlayers)
           window.VMM_PUBLIC_LANDING.stopExternalPlayers();
         clear(player);playing=i;
         var iframe=el('iframe','cms-release-iframe topic-song-iframe'+
           (t.provider==='youtube'?' cms-release-iframe--video':''));
         iframe.title=t.title+' — '+t.provider;iframe.src=src;iframe.loading='lazy';
         iframe.referrerPolicy='strict-origin-when-cross-origin';
         iframe.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
         iframe.setAttribute('allowfullscreen','');
         player.appendChild(iframe);
         var external=el('a','cms-card-link','Открыть в '+(t.provider==='spotify'?'Spotify':'YouTube'));
         external.href=approvedLink(t);external.rel='noopener noreferrer';
         external.target='_blank';player.appendChild(external);
         var stop=el('button','cms-release-close','Закрыть плеер');
         stop.type='button';stop.onclick=function(){clear(player);playing=-1;paint();};
         player.appendChild(stop);paint();
       };
       songs.appendChild(song);
     });
     if(limit<selected.tracks.length){
       var more=el('button','topic-show-more','Показать ещё ('+(selected.tracks.length-limit)+')');
       more.type='button';more.onclick=function(){limit+=12;paint();};songs.appendChild(more);
     }
   }
   area.appendChild(songs);area.appendChild(player);paint();
   if(requestedIndex>=0&&songs.children[requestedIndex]){
     // This is called ONLY from the visitor's explicit click on a chat song.
     songs.children[requestedIndex].onclick();return true;
   }
   return false;
 }
 function play(slug,url){return select(slug,url);}

 function render(value){
   var cloud=byId('public-topic-cloud'),orbit=byId('public-topic-orbit');
   if(!cloud||!orbit)return;
   data=value||{heading:'Созвездия чувств и историй',intro:'',entries:[]};
   var title=byId('topics-title'),intro=byId('topics-intro');
   if(title)title.textContent=data.heading;
   if(intro)intro.textContent=data.intro;
   clear(cloud);clear(orbit);buttons=[];
   var available=entries(),featured=available.slice(0,10);
   featured.forEach(function(t,i){
     var angle=-Math.PI/2+2*Math.PI*i/Math.max(1,featured.length);
     var chip=el('button','topic-planet');
     chip.type='button';chip.setAttribute('aria-label','Музыкальная тема: '+t.label);
     chip.setAttribute('aria-pressed','false');
     chip.style.left=(50+38*Math.cos(angle)).toFixed(2)+'%';
     chip.style.top=(50+36*Math.sin(angle)).toFixed(2)+'%';
     chip.appendChild(el('span','topic-planet-name',t.label));
     chip.appendChild(el('small','',t.tracks.length?String(t.tracks.length)+' песен':'скоро'));
     chip.onclick=function(){select(t.slug);};
     orbit.appendChild(chip);buttons.push({element:chip,slug:t.slug});
   });
   available.forEach(function(t){
     var chip=el('button','topic-tag',t.label);
     chip.type='button';chip.setAttribute('aria-pressed','false');
     chip.setAttribute('aria-label','Подборка: '+t.label);
     chip.onclick=function(){select(t.slug);};
     cloud.appendChild(chip);buttons.push({element:chip,slug:t.slug});
   });
   select(active);
 }
 window.VELAR_TOPICS={render:render,entries:entries,select:select,play:play};
}());
