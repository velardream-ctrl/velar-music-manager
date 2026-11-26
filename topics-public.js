/* RUN-073 — song topics / mood planets and editorial tag cloud.
   No additional Firestore reads, no auto-play, ES5 (Safari12 compatible).
   Only curated public metadata from the one existing landing snapshot. */
(function(){
 'use strict';
 var mounted=null;
 var data=null,active='',buttons=[],showAll=false;
 function byId(s){return document.getElementById(s);}
 function el(tag,cls,t){var n=document.createElement(tag);if(cls)n.className=cls;
   if(typeof t==='string')n.textContent=t;return n;}
 function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function entries(){return data&&Array.isArray(data.entries)?
   data.entries.filter(function(t){return t.visible===true;}):[];}
 function pulse(){var section=byId('topics'),core=section&&section.querySelector('.topics-cosmos-core');
   if(!core)return;core.className=core.className.replace(/ crystal-selection-pulse/g,'');void core.offsetWidth;
   core.className+=' crystal-selection-pulse';
 }
 function select(slug,requestedUrl,play){
   if(window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.ensureSection)window.VMM_PUBLIC_LANDING.ensureSection('topics');
   if(requestedUrl&&mounted&&slug===active)return mounted.openByUrl(requestedUrl,play);
   mounted=null;
   var selected=null,list=entries(),area=byId('public-topic-detail');
   list.forEach(function(t){if(t.slug===slug)selected=t;});

   active=selected?selected.slug:'';
   buttons.forEach(function(b){b.element.setAttribute('aria-pressed',b.slug===active?'true':'false');});
   if(!area)return;
   clear(area);
   if(!selected){area.appendChild(el('p','topic-empty','Выберите тему, чтобы открыть её песни.'));return;}
   var header=el('div','topic-detail-heading');
   header.appendChild(el('span','universe-info-kicker','МУЗЫКАЛЬНАЯ ТЕМА'));
   header.appendChild(el('h3','',selected.label));
   if(selected.description)header.appendChild(el('p','',selected.description));
   area.appendChild(header);
   var root=selected.parentSlug||selected.slug,children=list.filter(function(t){return t.parentSlug===root&&t.tracks.length&&!t.searchOnly;});
   if(children.length){
     var related=el('div','topics-cloud');
     list.filter(function(t){return t.slug===root;}).concat(children).forEach(function(t){
       var chip=el('button','topic-tag',t.label);chip.type='button';chip.setAttribute('aria-pressed',String(t.slug===slug));
       chip.onclick=function(){select(t.slug);};related.appendChild(chip);
     });
     header.appendChild(related);
   }
   var tracks=selected.tracks.slice();
   if(!selected.parentSlug){
     var seen=Object.create(null);
     tracks.forEach(function(t){seen[t.url]=true;});
     list.filter(function(t){return t.parentSlug===root;}).forEach(function(t){
       t.tracks.forEach(function(song){if(!seen[song.url]){seen[song.url]=true;tracks.push(song);}});
     });
   }
   if(!tracks.length){
     area.appendChild(el('p','topic-empty','Пока в этом мире нет назначенных песен. Новые композиции появятся после проверки и публикации.'));
     return;
   }
   area.appendChild(el('p','topic-count','Песен по теме: '+tracks.length));
   var songs=el('div','topic-song-list');
   area.appendChild(songs);
   if(!window.VELAR_PUBLIC_SONGS){
     area.appendChild(el('p','topic-empty','Плеер временно недоступен.'));return false;
   }
   var player=mounted=window.VELAR_PUBLIC_SONGS.mount(songs,tracks,{prefix:'topic',batch:12});
   // A requested source opens inline immediately below its one song row.
   if(requestedUrl&&selected.slug===slug)return player.openByUrl(requestedUrl,play);
   return false;
 }
 function openFromChat(slug,url,play){return select(slug,url,play);}

 function render(value){
   mounted=null;
   var cloud=byId('public-topic-cloud'),orbit=byId('public-topic-orbit');
   if(!cloud||!orbit)return;
   data=value||{heading:'Созвездия чувств и историй',intro:'',entries:[]};
   var title=byId('topics-title'),intro=byId('topics-intro');
   if(title)title.textContent=data.heading;
   if(intro)intro.textContent=data.intro;
   clear(cloud);clear(orbit);buttons=[];
   var all=entries(),available=all.filter(function(t){
     return !t.searchOnly&&(!t.parentSlug||!all.some(function(p){return p.slug===t.parentSlug;}))&&
       (t.tracks.length||all.some(function(child){return child.parentSlug===t.slug&&child.tracks.length;}));
   }),featured=available.slice(0,10);
   featured.forEach(function(t,i){
     var angle=-Math.PI/2+2*Math.PI*i/Math.max(1,featured.length);
     var chip=el('button','topic-planet');
     chip.type='button';chip.setAttribute('aria-label','Музыкальная тема: '+t.label);
     chip.setAttribute('aria-pressed','false');
     chip.style.left=(50+38*Math.cos(angle)).toFixed(2)+'%';
     chip.style.top=(50+36*Math.sin(angle)).toFixed(2)+'%';
     chip.appendChild(el('span','topic-planet-name',t.label));
     chip.appendChild(el('small','',t.tracks.length?String(t.tracks.length)+' песен':'Подборки'));
     chip.onclick=function(){select(t.slug);pulse();};
     orbit.appendChild(chip);buttons.push({element:chip,slug:t.slug});
   });
   available.forEach(function(t){
     var chip=el('button','topic-tag',t.label);
     var seen=Object.create(null),count=0;
     [t].concat(all.filter(function(c){return c.parentSlug===t.slug&&!c.searchOnly;})).forEach(function(g){g.tracks.forEach(function(s){var urls=[s.url,s.alternateUrl,s.thirdUrl].filter(Boolean);if(!urls.some(function(u){return seen[u];}))count++;urls.forEach(function(u){seen[u]=true;});});});
     chip.style.fontSize=(13+Math.min(10,Math.sqrt(count)*2))+'px';
     var tones={love:'rose',family:'gold',loyalty:'gold',space:'blue',nature:'blue',journey:'blue',dance:'violet',dreams:'violet',hope:'gold',friendship:'gold',happiness:'gold',humor:'gold',sadness:'blue',separation:'rose',nostalgia:'violet',names:'rose'};
     chip.setAttribute('data-tone',tones[t.slug]||'violet');
     chip.setAttribute('title',count+' песен');
     chip.type='button';chip.setAttribute('aria-pressed','false');
     chip.setAttribute('aria-label','Подборка: '+t.label);
     chip.onclick=function(){select(t.slug);pulse();};
     cloud.appendChild(chip);buttons.push({element:chip,slug:t.slug});
   });
   select(active);
 }
 window.VELAR_TOPICS={render:render,entries:entries,select:select,openFromChat:openFromChat};
}());
