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
       pauseOtherEmbeds();
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
       frame.loading='lazy';frame.setAttribute('allow','clipboard-write; encrypted-media; fullscreen; picture-in-picture');
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

 // RUN-069: user-initiated official playback only. The site never
 // produces a stream, auto-plays muted music or loops tracks for metrics.
 function officialEmbed(link,provider,category){
   var verified=category==='playlist'?
     window.VMM_LANDING_SCHEMA.playlistUrl(link,provider):
     window.VMM_LANDING_SCHEMA.releaseMediaUrl(link,provider);
   if(!verified)return '';
   if(provider==='spotify'){
     var match=verified.match(/^https:\/\/open\.spotify\.com\/(track|album|playlist)\/([A-Za-z0-9]{22})$/);
     return match?'https://open.spotify.com/embed/'+match[1]+'/'+match[2]:'';
   }
   if(provider==='youtube'){
     if(category==='playlist'){
       var list=verified.split('list=')[1];
       return list?'https://www.youtube-nocookie.com/embed/videoseries?list='+list:'';
     }
     var video=verified.split('v=')[1];
     return video?'https://www.youtube-nocookie.com/embed/'+video:'';
   }
   return '';
 }
 function pauseOtherEmbeds(){
   // Remove any previous external embed instead of starting parallel players.
   // Cross-origin APIs must not be used to simulate streams or playback.
   if(typeof document.querySelectorAll!=='function')return;
   var frames=document.querySelectorAll('iframe.cms-music-iframe,iframe.cms-release-iframe,iframe.velar-radio-iframe');
   for(var i=0;i<frames.length;i++)if(frames[i].parentNode)
     frames[i].parentNode.removeChild(frames[i]);
 }
 function releaseCard(item,feature){
   var isVideo=item.kind==='video';
   var card=create('article','cms-release-card'+(feature?' cms-release-card--featured':''));
   var art=create('div','cms-release-art'+(isVideo?' cms-release-art--video':''));
   if(item.imageData||item.imageUrl){
     var image=create('img','cms-release-cover');
     image.src=item.imageData||item.imageUrl;image.alt='Обложка: '+item.title;
     image.loading='lazy';image.decoding='async';image.referrerPolicy='no-referrer';
     art.appendChild(image);
   }else if(isVideo&&item.mediaProvider==='youtube'&&item.mediaUrl){
     var video=window.VMM_LANDING_SCHEMA.releaseMediaUrl(item.mediaUrl,'youtube');
     if(video){
       var thumb=create('img','cms-release-cover');
       thumb.src='https://i.ytimg.com/vi/'+video.split('v=')[1]+'/hqdefault.jpg';
       thumb.alt='Обложка видеоклипа: '+item.title;
       thumb.loading='lazy';thumb.decoding='async';
       art.appendChild(thumb);
     }
   }
   if(!art.children||!art.children.length){
     var placeholder=create('div','cms-release-placeholder');
     var emblem=create('span','cms-release-disc');emblem.setAttribute('aria-hidden','true');
     placeholder.appendChild(emblem);art.appendChild(placeholder);
   }
   if(item.spotlight!=='none'&&feature)
     art.appendChild(create('span','cms-release-ribbon',isVideo?'ВИДЕОПРЕМЬЕРА':'ИЗБРАННЫЙ РЕЛИЗ'));
   card.appendChild(art);
   var copy=create('div','cms-release-copy');
   copy.appendChild(create('span','cms-release-type',isVideo?'Видеоклип':item.kind==='album'?'Альбом':'Сингл'));
   copy.appendChild(create('h3','',item.title));
   if(item.subtitle)copy.appendChild(create('p','cms-release-artist',item.subtitle));
   if(item.description)copy.appendChild(create('p','cms-release-description',item.description));
   var actions=create('div','cms-release-actions'),media=officialEmbed(item.mediaUrl,item.mediaProvider,'release');
   var player=create('div','cms-release-player');
   if(media){
     var listen=create('button','cms-release-listen');
     listen.type='button';
     var icon=create('span','cms-release-play');
     icon.setAttribute('aria-hidden','true');listen.appendChild(icon);
     listen.appendChild(create('span','',isVideo?'Смотреть клип':'Слушать'));
     listen.setAttribute('aria-label',(isVideo?'Смотреть клип: ':'Слушать релиз: ')+item.title);
     listen.onclick=function(){
       pauseOtherEmbeds();empty(player);
       var frame=create('iframe','cms-release-iframe'+(item.mediaProvider==='youtube'?' cms-release-iframe--video':''));
       frame.title=item.title+' — '+(item.mediaProvider==='spotify'?'Spotify':'YouTube');
       frame.src=media;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
       frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       player.appendChild(frame);
       var close=create('button','cms-release-close','Закрыть плеер');close.type='button';
       close.onclick=function(){empty(player);};player.appendChild(close);
     };
     actions.appendChild(listen);
   }
   var external=item.url||item.mediaUrl;
   if(external){
     var link=create('a','cms-card-link',isVideo?'Открыть видео':'На музыкальной площадке');
     link.href=external;link.rel='noopener noreferrer';link.target='_blank';actions.appendChild(link);
   }
   copy.appendChild(actions);card.appendChild(copy);card.appendChild(player);
   return card;
 }
 function releaseGallery(value){
   var target=byId('public-releases-cards');
   if(!target)return;
   if(!original['public-releases-cards'])original['public-releases-cards']={
     markup:target.innerHTML,css:target.className};
   var shown=value.cards.filter(function(item){return item.visible===true;});
   if(!shown.length){
     target.className=original['public-releases-cards'].css;
     target.innerHTML=original['public-releases-cards'].markup;
     return;
   }
   empty(target);target.className='cms-release-showcase';
   var features=create('div','cms-release-features'),spotlight={music:false,video:false};
   var others=[];
   shown.forEach(function(item){
     var slot=item.spotlight;
     if((slot==='music'||slot==='video')&&!spotlight[slot]){
       spotlight[slot]=true;features.appendChild(releaseCard(item,true));
     }else others.push(item);
   });
   if(features.children&&features.children.length)target.appendChild(features);
   var filters=create('div','cms-release-filters');
   filters.setAttribute('role','group');filters.setAttribute('aria-label','Фильтровать релизы');
   var grid=create('div','cms-release-grid'),more=create('button','cms-release-more','Показать ещё');
   more.type='button';
   var mode='all',limit=6,buttons=[];
   [['all','Все'],['single','Синглы'],['album','Альбомы'],['video','Видеоклипы']].forEach(function(pair){
     var b=create('button','cms-release-filter',pair[1]);b.type='button';
     b.setAttribute('aria-pressed',pair[0]==='all'?'true':'false');
     b.onclick=function(){
       mode=pair[0];limit=6;paint();
     };
     b.value=pair[0];buttons.push(b);filters.appendChild(b);
   });
   function paint(){
     buttons.forEach(function(b){b.setAttribute('aria-pressed',b.value===mode?'true':'false');});
     empty(grid);
     var matches=others.filter(function(item){return mode==='all'||item.kind===mode;});
     matches.slice(0,limit).forEach(function(item){grid.appendChild(releaseCard(item,false));});
     more.textContent='Показать ещё ('+(matches.length-limit)+')';
     more.className='cms-release-more'+(matches.length>limit?'':' hidden');
     if(!matches.length)
       grid.appendChild(create('p','cms-release-empty','Пока нет релизов в этой категории.'));
   }
   more.onclick=function(){limit+=6;paint();};
   target.appendChild(filters);target.appendChild(grid);target.appendChild(more);
   paint();
 }

 function playlistGallery(value){
   var grid=byId('public-playlists-cards'),follow=byId('public-subscriptions');
   if(!grid||!follow)return;
   empty(grid);empty(follow);
   var playlists=value.playlists.filter(function(row){return row.visible&&row.url;});
   playlists.forEach(function(item,index){
     var card=create('article','cms-playlist-card'+(index===0?' cms-playlist-card--featured':''));
     var decoration=create('div','cms-playlist-art');
     decoration.appendChild(create('span','cms-playlist-vinyl'));
     card.appendChild(decoration);
     var details=create('div','cms-playlist-copy');
     if(index===0)details.appendChild(create('span','cms-release-type','ВЫБОР VELAR'));
     details.appendChild(create('h3','',item.title));
     if(item.description)details.appendChild(create('p','',item.description));
     var actions=create('div','cms-playlist-actions');
     var choose=create('button','cms-release-listen','Послушать плейлист');
     choose.type='button';
     choose.setAttribute('aria-label','Открыть официальный плейлист: '+item.title);
     var player=create('div','cms-playlist-player');
     choose.onclick=function(){
       var src=officialEmbed(item.url,item.provider,'playlist');
       if(!src)return;
       pauseOtherEmbeds();empty(player);
       var frame=create('iframe','cms-release-iframe'+(item.provider==='youtube'?' cms-release-iframe--video':''));
       frame.src=src;frame.title=item.title+' — официальный плейлист '+item.provider;
       frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
       frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       player.appendChild(frame);
       var close=create('button','cms-release-close','Закрыть плеер');
       close.type='button';close.onclick=function(){empty(player);};player.appendChild(close);
     };
     actions.appendChild(choose);
     var external=create('a','cms-card-link','Открыть в '+(item.provider==='spotify'?'Spotify':'YouTube'));
     external.href=item.url;external.target='_blank';external.rel='noopener noreferrer';
     actions.appendChild(external);details.appendChild(actions);
     card.appendChild(details);card.appendChild(player);grid.appendChild(card);
   });
   if(!playlists.length)
     grid.appendChild(create('p','cms-release-empty','Здесь появятся официальные плейлисты.'));
   value.subscriptions.filter(function(row){return row.visible&&row.url;}).forEach(function(item){
     var link=create('a','cms-subscription-link');
     link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';
     link.appendChild(create('span','cms-subscription-icon'));
     link.appendChild(create('span','',item.title));
     follow.appendChild(link);
   });
   if(!follow.children||!follow.children.length)
     follow.appendChild(create('p','cms-release-empty','Ссылки для подписки появятся здесь.'));
 }
 function renderRadio(config){
   var host=byId('velar-radio');
   if(!host)return;
   empty(host);
   if(!config.enabled||!window.VMM_LANDING_SCHEMA.playlistUrl(config.url,config.provider)){
     host.className='velar-radio hidden';return;
   }
   host.className='velar-radio';
   var toggle=create('button','velar-radio-toggle','');
   toggle.type='button';toggle.setAttribute('aria-expanded','false');
   toggle.setAttribute('aria-controls','velar-radio-panel');
   var dot=create('span','velar-radio-dot');dot.setAttribute('aria-hidden','true');
   toggle.appendChild(dot);toggle.appendChild(create('span','',config.title));
   var icon=create('span','velar-radio-chevron');icon.setAttribute('aria-hidden','true');toggle.appendChild(icon);
   host.appendChild(toggle);
   var panel=create('div','velar-radio-panel hidden');panel.id='velar-radio-panel';
   panel.appendChild(create('strong','',config.title+' · музыкальный плейлист'));
   panel.appendChild(create('p','velar-radio-note','Воспроизведение только по вашему выбору, через официальный плеер '+(config.provider==='spotify'?'Spotify':'YouTube')+'.'));
   var player=create('div','velar-radio-player');
   var open=create('button','velar-radio-start','Открыть плейлист');
   open.type='button';
   open.onclick=function(){
     var src=officialEmbed(config.url,config.provider,'playlist');if(!src)return;
     pauseOtherEmbeds();empty(player);
     var frame=create('iframe','velar-radio-iframe'+(config.provider==='youtube'?' velar-radio-iframe--video':''));
     frame.src=src;frame.title=config.title+' — '+config.provider;
     frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     player.appendChild(frame);
     var link=create('a','velar-radio-external','Открыть в '+(config.provider==='spotify'?'Spotify':'YouTube'));
     link.href=config.url;link.target='_blank';link.rel='noopener noreferrer';player.appendChild(link);
   };
   panel.appendChild(open);panel.appendChild(player);
   host.appendChild(panel);
   toggle.onclick=function(){
     var shown=panel.className.indexOf(' hidden')!==-1;
     panel.className=shown?'velar-radio-panel':'velar-radio-panel hidden';
     toggle.setAttribute('aria-expanded',shown?'true':'false');
     if(!shown)empty(player); // closing stops external playback.
   };
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
   releaseGallery(value.releases);
   playlistGallery(value.releases);
   renderRadio(value.releases.radio);
   if(window.VELAR_UNIVERSE&&window.VELAR_UNIVERSE.render)window.VELAR_UNIVERSE.render(value);
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
