/* RUN-073 — song topics / mood planets and editorial tag cloud.
   No additional Firestore reads, no auto-play, ES5 (Safari12 compatible).
   Only curated public metadata from the one existing landing snapshot. */
(function(){
 'use strict';
 var mounted=null;
 var data=null,active='',buttons=[],showAll=false,activeMood='',moodButtons=[],moodMounted=null;
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
   closeMood();
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

 var icons={
   happy:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
   sad:'<path d="M4 16a5 5 0 0 1-.5-9.98A7 7 0 0 1 17 8h1a4 4 0 0 1 1 7.87M8 16v4m4-3v4m4-5v4"/>',
   dance:'<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
   romance:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
   calm:'<path d="M20.9 13.35A9 9 0 0 1 10.65 3.1 9 9 0 1 0 20.9 13.35Z"/>',
   energy:'<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-6 .2 2-1 3-2 3-1-4-3-7-5-9 0 5-1 6-3 9-1 1-2 3-2 5 0 3 3 5 8 5z"/><path d="M12 22c-2 0-3-1-3-3 0-1 1-3 3-5 2 2 3 4 3 5 0 2-1 3-3 3z"/>'
 };
 function moodConfig(){var api=window.VMM_LANDING_SCHEMA;return data&&data.moods||api&&api.defaultMoods&&api.defaultMoods();}
 function closeMood(){activeMood='';moodMounted=null;var area=byId('public-mood-detail');if(area){clear(area);area.hidden=true;}moodButtons.forEach(function(b){b.element.setAttribute('aria-pressed','false');});}
 function selectMood(id){
   if(window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.ensureSection)window.VMM_PUBLIC_LANDING.ensureSection('topics');
   var cfg=moodConfig(),api=window.VMM_LANDING_SCHEMA,area=byId('public-mood-detail');
   if(!cfg||!cfg.enabled||!api||!area)return false;
   var m=cfg.entries.filter(function(r){return r.id===id&&r.visible;})[0];if(!m)return false;
   // Close an existing thematic player before opening a new selection.
   if(active)select('');closeMood();activeMood=id;
   moodButtons.forEach(function(b){b.element.setAttribute('aria-pressed',String(b.id===id));});
   area.hidden=false;var head=el('div','topic-detail-heading');
   head.appendChild(el('span','universe-info-kicker','МУЗЫКА ПО НАСТРОЕНИЮ'));
   head.appendChild(el('h3','',m.label+' музыка'));
   var close=el('button','topic-tag','Свернуть подборку');close.type='button';close.onclick=closeMood;head.appendChild(close);area.appendChild(head);
   var tracks=api.moodTracks(data,m);
   area.appendChild(el('p','topic-count','Песен в подборке: '+tracks.length));
   if(!tracks.length){area.appendChild(el('p','topic-empty','Эта подборка пока пополняется.'));return true;}
   var host=el('div','topic-song-list');area.appendChild(host);
   if(window.VELAR_PUBLIC_SONGS)moodMounted=window.VELAR_PUBLIC_SONGS.mount(host,tracks,{prefix:'mood',batch:12});
   else area.appendChild(el('p','topic-empty','Плеер временно недоступен.'));
   return true;
 }
 function renderMoods(){
   var host=byId('public-moods'),cfg=moodConfig(),api=window.VMM_LANDING_SCHEMA;if(!host)return;
   clear(host);moodButtons=[];var rows=cfg&&cfg.enabled?cfg.entries.filter(function(m){return m.visible;}):[];
   host.hidden=!rows.length;if(!rows.length){closeMood();return;}
   var title=el('h3','velar-moods-title',cfg.heading);host.appendChild(title);
   var grid=el('div','velar-moods-grid');grid.setAttribute('role','group');grid.setAttribute('aria-label','Музыка по настроению');host.appendChild(grid);
   rows.forEach(function(m){var b=el('button','velar-mood-card');b.type='button';b.setAttribute('data-mood',m.id);b.setAttribute('aria-pressed','false');var icon=el('span','velar-mood-icon');icon.setAttribute('aria-hidden','true');
     // Fixed trusted SVG paths only, never owner/user markup.
     icon.innerHTML='<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[m.id]+'</svg>';
     b.appendChild(icon);b.appendChild(el('strong','',m.label));var count=api&&api.moodTracks?api.moodTracks(data,m).length:0;b.appendChild(el('small','',count+' песен'));
     b.onclick=function(){if(activeMood===m.id)closeMood();else selectMood(m.id);};grid.appendChild(b);moodButtons.push({id:m.id,element:b});
   });host.appendChild(el('p','velar-moods-caption','Выбирайте музыку сердцем'));
 }
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
   var previousMood=activeMood;select(active);renderMoods();if(previousMood)selectMood(previousMood);
 }
 window.VELAR_TOPICS={render:render,entries:entries,select:select,openFromChat:openFromChat,selectMood:selectMood};
}());
