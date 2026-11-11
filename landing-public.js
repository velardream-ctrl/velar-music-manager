/* RUN-061 — public read-only renderer. Only vmm_public_pages/landing.
   Existing static content is the fallback when not yet published/offline/denied. */
(function(){
 'use strict';
 function byId(id){return document.getElementById(id);}
 function assign(id,value){var target=byId(id);if(target)target.textContent=value;}
 function empty(node){while(node.firstChild)node.removeChild(node.firstChild);}
 function create(tag,cls,words){
   var n=document.createElement(tag);
   if(cls)n.className=cls;
   if(typeof words==='string')n.textContent=words;
   return n;
 }
 var original={};
 function buildArtistCard(item,type){
   var card=create('article','cms-card');
   if(item.imageData||item.imageUrl){
     var img=document.createElement('img');
     img.src=item.imageData||item.imageUrl;img.alt=item.title;img.loading='lazy';img.decoding='async';
     img.referrerPolicy='no-referrer';
     if(type==='artists'){
       var portraitShape=item.imageShape==='circle'?'circle':'square';
       var frame=create('div','cms-artist-photo cms-artist-photo--'+portraitShape);
       frame.appendChild(img);
       card.className+=' cms-artist-card cms-artist-card--'+portraitShape;
       img.className='cms-card-art cms-artist-photo-image';
       card.appendChild(frame);
     }else{
       img.className='cms-card-art';
       card.appendChild(img);
     }
   }
   var copy=create('div','cms-card-copy');
   copy.appendChild(create('h3','',item.title));
   if(item.subtitle)copy.appendChild(create('p','cms-card-subtitle',item.subtitle));
   if(item.description)copy.appendChild(create('p','',item.description));
   if(item.url){
     var link=create('a','cms-card-link',type==='artists'?'Профиль артиста':'Открыть релиз');
     link.href=item.url;link.rel='noopener noreferrer';link.target='_blank';
     copy.appendChild(link);
   }
   card.appendChild(copy);
   return card;
 }
 function musicPanel(item){
   var panel=create('aside','cms-music-panel');
   panel.setAttribute('aria-label','Лучшие песни: '+item.title);
   var title=create('div','cms-music-heading');
   title.appendChild(create('span','cms-music-kicker','СЛУШАТЬ АРТИСТА'));
   title.appendChild(create('h3','','Лучшие песни'));
   panel.appendChild(title);
   var tracks=item.featuredTracks||[];
   if(!tracks.length){
     panel.className+=' cms-music-panel--empty';
     panel.appendChild(create('p','cms-music-empty','Подборка композиций появится здесь после выбора в музыкальной студии.'));
     return panel;
   }
   var list=create('div','cms-music-list');
   var player=create('div','cms-music-player');
   player.setAttribute('role','region');
   player.setAttribute('aria-label','Встроенный музыкальный плеер');
   var active=null,buttons=[];
   tracks.forEach(function(track,index){
     var button=create('button','cms-music-track');
     button.type='button';
     button.setAttribute('aria-pressed','false');
     button.appendChild(create('span','cms-music-number',('0'+(index+1)).slice(-2)));
     var details=create('span','cms-music-track-info');
     details.appendChild(create('strong','',track.title));
     details.appendChild(create('small','',track.provider==='spotify'?'Spotify':'YouTube'));
     button.appendChild(details);
     // Icon is an empty, decorative CSS vector, not a text triangle that
     // Android/Samsung may replace with a blue system emoji.
     var playIcon=create('span','cms-music-play-icon');
     playIcon.setAttribute('aria-hidden','true');
     button.appendChild(playIcon);
     button.setAttribute('aria-label','Слушать: '+track.title+' — '+(track.provider==='spotify'?'Spotify':'YouTube'));
     button.onclick=function(){
       if(active===index)return;
       active=index;
       buttons.forEach(function(b,i){b.setAttribute('aria-pressed',i===index?'true':'false');});
       empty(player);
       var validated=window.VMM_LANDING_SCHEMA.songUrl(track.url,track.provider);
       if(!validated)return;
       var frame=document.createElement('iframe');
       frame.className='cms-music-iframe'+(track.provider==='youtube'?' cms-music-iframe--video':'');
       frame.title=track.title+' — '+(track.provider==='spotify'?'плеер Spotify':'видео YouTube');
       frame.src=track.provider==='spotify'?
         'https://open.spotify.com/embed/track/'+validated.split('/').pop():
         'https://www.youtube-nocookie.com/embed/'+validated.split('v=')[1];
       frame.loading='lazy';frame.setAttribute('allow','autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       frame.referrerPolicy='strict-origin-when-cross-origin';
       player.appendChild(frame);
       var external=create('a','cms-music-external','Открыть в '+(track.provider==='spotify'?'Spotify':'YouTube'));
       external.href=validated;external.rel='noopener noreferrer';external.target='_blank';
       player.appendChild(external);
     };
     buttons.push(button);list.appendChild(button);
   });
   panel.appendChild(list);
   player.appendChild(create('p','cms-music-hint','Выбери песню, чтобы открыть официальный плеер. Никаких аудиофайлов на сайте нет.'));
   panel.appendChild(player);
   return panel;
 }
 function cards(id,rows,type){
   var target=byId(id);
   if(!target)return;
   var shown=rows.filter(function(x){return x.visible===true;});
   if(!original[id])original[id]={markup:target.innerHTML,css:target.className};
   if(!shown.length){
     target.className=original[id].css;
     target.innerHTML=original[id].markup;
     return;
   }
   empty(target);
   // Without curated songs, tile the portraits across the full width, instead
   // of leaving an empty left column. With music, form alternating story rows.
   var stories=type==='artists'&&shown.some(function(x){return !!(x.featuredTracks&&x.featuredTracks.length);});
   target.className=type==='artists'?(stories?'cms-artist-stories':'cms-card-grid cms-artist-tiles'):'cms-card-grid';
   shown.forEach(function(item,index){
     var card=buildArtistCard(item,type);
     if(stories){
       var row=create('div','cms-artist-story'+(index%2?' cms-artist-story--reverse':''));
       row.appendChild(card);
       row.appendChild(musicPanel(item));
       target.appendChild(row);
     }else target.appendChild(card);
   });
 }
 function render(content){
   if(!window.VMM_LANDING_SCHEMA)return false;
   var value;
   try{value=window.VMM_LANDING_SCHEMA.normalize(content);}catch(e){return false;}
   assign('public-hero-subtitle',value.hero.subtitle);
   assign('public-hero-intro',value.hero.intro);
   assign('artists-title',value.artists.heading);
   assign('public-artists-intro',value.artists.intro);
   assign('releases-title',value.releases.heading);
   assign('public-releases-intro',value.releases.intro);
   assign('genres-title',value.genres.heading);
   assign('public-genres-intro',value.genres.intro);
   assign('about-title',value.about.heading);
   assign('public-about-intro',value.about.intro);
   assign('public-about-notice',value.about.notice);
   var tags=byId('public-genres-tags');if(tags){empty(tags);
     value.genres.tags.forEach(function(tag){tags.appendChild(create('span','',tag));});
   }
   cards('public-artists-cards',value.artists.cards,'artists');
   cards('public-releases-cards',value.releases.cards,'releases');
   return true;
 }
 function start(){
   if(!window.firebase||!window.VELAR_FIREBASE_CONFIG||!window.VMM_LANDING_SCHEMA)return;
   try{
     if(!firebase.apps.length)firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
     // Anonymous document listening, no login and no access to the private catalog.
     firebase.firestore().collection('vmm_public_pages').doc('landing').onSnapshot(function(snapshot){
       if(!snapshot.exists)return; // existing static homepage remains in place
       var d=snapshot.data()||{};
       if(d.status!=='published'||d.schemaVersion!==1)return;
       render(d.content);
     },function(){
       // Missing staged rules or temporary network error: preserve static page.
     });
   }catch(ignore){/* Never block public landing if SDK or network fails. */}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
 else start();
 window.VMM_PUBLIC_LANDING={render:render}; // pure UI hook, never writes
}());
