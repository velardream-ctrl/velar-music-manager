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
   var songs=el('div','topic-song-list');
   area.appendChild(songs);
   if(!window.VELAR_PUBLIC_SONGS){
     area.appendChild(el('p','topic-empty','Плеер временно недоступен.'));return false;
   }
   var player=window.VELAR_PUBLIC_SONGS.mount(songs,selected.tracks,{prefix:'topic',batch:12});
   // A requested source opens inline immediately below its one song row.
   if(requestedUrl&&selected.slug===slug)return player.openByUrl(requestedUrl);
   return false;
 }
 function openFromChat(slug,url){return select(slug,url);}

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
 window.VELAR_TOPICS={render:render,entries:entries,select:select,openFromChat:openFromChat};
}());
