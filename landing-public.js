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
 // RUN-094: mask Spotify's own pale iframe corners in a Safari12-safe viewport.
 // Never alter YouTube video iframes or Spotify cross-origin document styles.
 function appendOfficialFrame(host,frame,provider,compact){
   if(provider!=='spotify'){host.appendChild(frame);return;}
   var mask=create('div','spotify-embed-viewport'+(compact?' spotify-embed-viewport--compact':''));
   mask.appendChild(frame);host.appendChild(mask);
 }
 var original={};
 // RUN-086: only visible, owner-enabled radio controls can be opened from chat.
 var radioControls=null;
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
 function compareSong(a,b){
   // Russian/Latin title order, then artist; no mutation of Firestore records.
   var x=String(a&&a.title||'').trim(),y=String(b&&b.title||'').trim();
   var title=x.localeCompare(y,'ru',{numeric:true,sensitivity:'base'});
   return title||String(a&&a.artist||'').trim().localeCompare(
     String(b&&b.artist||'').trim(),'ru',{numeric:true,sensitivity:'base'});
 }
 function musicPanel(item,view,albums){
   view=view||'classic';
   var panel=create('aside','cms-music-panel');
   panel.setAttribute('aria-label','Лучшие песни: '+item.title);
   var title=create('div','cms-music-heading');
   title.appendChild(create('span','cms-music-kicker','СЛУШАТЬ АРТИСТА'));
   title.appendChild(create('h3','','Лучшие песни'));
   panel.appendChild(title);
   var tracks=(item.featuredTracks||[]).slice();
   // Manual order remains opt-in for the artist's three featured songs.
   if(item.featuredSort!=='manual')tracks.sort(compareSong);
   if(!tracks.length){
     panel.className+=' cms-music-panel--empty';
     panel.appendChild(create('p','cms-music-empty','Подборка композиций появится здесь после выбора в музыкальной студии.'));
     return panel;
   }
   if(view==='carousel'&&window.VELAR_PUBLIC_SONGS){
     var carousel=create('div','cms-music-list');
     panel.appendChild(carousel);
     // Retain the curator's explicit manual order for an artist's best songs.
     var curated=tracks.map(function(t){
       return {title:t.title,artist:item.title,provider:t.provider,url:t.url,
         alternateProvider:t.alternateProvider,alternateUrl:t.alternateUrl};
     });
     window.VELAR_PUBLIC_SONGS.mount(carousel,curated,{
       prefix:'artist',view:'carousel',batch:12,keepOrder:true
     });
     return panel;
   }
   var list=create('div','cms-music-list'+
     (view==='tiles'?' cms-music-list--tiles':view==='covers'?' cms-music-list--covers':''));
   // RUN-091: player belongs to the clicked row, not after the entire list.
   var active=null,buttons=[],players=[],entries=[];
   tracks.forEach(function(track,index){
     var button=create('button','cms-music-track'+
       (view!=='classic'?' cms-music-track--art':''));
     button.type='button';
     button.setAttribute('aria-pressed','false');
     button.appendChild(create('span','cms-music-number',('0'+(index+1)).slice(-2)));
     if(view!=='classic'){
       var cover='';
       (albums&&albums.entries||[]).forEach(function(album){
         if(!album.visible||cover)return;
         (album.tracks||[]).forEach(function(song){
           if(song.url===track.url||song.alternateUrl===track.url)
             cover=album.imageData||album.imageUrl||'';
         });
       });
       if(cover){
         var thumb=create('img','cms-music-track-thumb');
         thumb.src=cover;thumb.alt='Обложка: '+track.title;
         thumb.loading='lazy';thumb.decoding='async';thumb.referrerPolicy='no-referrer';
         button.appendChild(thumb);
       }else{
         var note=create('span','cms-music-track-thumb cms-music-track-thumb--empty','♫');
         note.setAttribute('aria-hidden','true');button.appendChild(note);
       }
     }
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
     var entry=create('div','cms-music-entry');
     var player=create('div','cms-music-player cms-music-player--inline');
     player.setAttribute('role','region');
     player.setAttribute('aria-label','Плеер: '+track.title);
     button.onclick=function(){
       if(active===index&&hasEmbed(player)){
         empty(player);active=null;entry.className=entry.className.replace(/ is-playing/g,'');
         buttons.forEach(function(b){b.setAttribute('aria-pressed','false');});
         return; // second click stops Spotify/YouTube and collapses the row.
       }
       var validated=window.VMM_LANDING_SCHEMA.songUrl(track.url,track.provider);
       if(!validated)return;
       pauseOtherEmbeds();
       active=index;
       entries.forEach(function(e){e.className=e.className.replace(/ is-playing/g,'');});
       entry.className+=' is-playing';
       buttons.forEach(function(b,i){b.setAttribute('aria-pressed',i===index?'true':'false');});
       players.forEach(function(p){empty(p);});
       var frame=document.createElement('iframe');
       frame.className='cms-music-iframe'+(track.provider==='youtube'?' cms-music-iframe--video':'');
       frame.title=track.title+' — '+(track.provider==='spotify'?'плеер Spotify':'видео YouTube');
       frame.src=track.provider==='spotify'?
         'https://open.spotify.com/embed/track/'+validated.split('/').pop():
         'https://www.youtube-nocookie.com/embed/'+validated.split('v=')[1];
       frame.loading='lazy';frame.setAttribute('allow','clipboard-write; encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       frame.referrerPolicy='strict-origin-when-cross-origin';
       appendOfficialFrame(player,frame,track.provider,true);
       var external=create('a','cms-music-external','Открыть в '+(track.provider==='spotify'?'Spotify':'YouTube'));
       external.href=validated;external.rel='noopener noreferrer';external.target='_blank';
       player.appendChild(external);
     };
     buttons.push(button);players.push(player);entries.push(entry);
     entry.appendChild(button);entry.appendChild(player);
     list.appendChild(entry);
   });
   panel.appendChild(list);
   return panel;
 }
 function cards(id,rows,type,featuredView,albums,songMode){
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
       row.appendChild(musicPanel(item,songMode==='carousel'?'carousel':featuredView,albums));
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
 // Repeated play clicks must detect a LIVE iframe, not a stale external link
 // left after another public section has unloaded the previous iframe.
 function hasEmbed(host){
   if(!host||!host.firstChild)return false;
   var first=host.firstChild;
   return first.tagName==='iframe'||!!(first.className&&
     (' '+first.className+' ').indexOf(' spotify-embed-viewport ')>=0&&
     first.firstChild&&first.firstChild.tagName==='iframe');
 }
 function pauseOtherEmbeds(){
   // Remove any previous external embed instead of starting parallel players.
   // Cross-origin APIs must not be used to simulate streams or playback.
   if(typeof document.querySelectorAll!=='function')return;
   var frames=document.querySelectorAll('iframe.cms-music-iframe,iframe.cms-release-iframe,iframe.velar-radio-iframe');
   for(var i=0;i<frames.length;i++)if(frames[i].parentNode){
     var parent=frames[i].parentNode;
     if(parent.className&&(' '+parent.className+' ').indexOf(' spotify-embed-viewport ')>=0&&
        parent.parentNode)parent.parentNode.removeChild(parent);
     else parent.removeChild(frames[i]);
   }
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
     listen.setAttribute('aria-pressed','false');
     listen.onclick=function(){
       if(hasEmbed(player)){
         empty(player);listen.setAttribute('aria-pressed','false');return;
       }
       pauseOtherEmbeds();empty(player);listen.setAttribute('aria-pressed','true');
       var frame=create('iframe','cms-release-iframe'+(item.mediaProvider==='youtube'?' cms-release-iframe--video':''));
       frame.title=item.title+' — '+(item.mediaProvider==='spotify'?'Spotify':'YouTube');
       frame.src=media;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
       frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       appendOfficialFrame(player,frame,item.mediaProvider,false);
       var close=create('button','cms-release-close','Закрыть плеер');close.type='button';
       close.onclick=function(){empty(player);listen.setAttribute('aria-pressed','false');};player.appendChild(close);
       if(isVideo)revealInlineVideo();
     };
     actions.appendChild(listen);
   }
   function revealInlineVideo(){
     // Keep YouTube playback in the same page, including old iOS Safari.
     if(!player.scrollIntoView)return;
     try{player.scrollIntoView({block:'center'});}
     catch(ignore){player.scrollIntoView();}
   }
   var external=item.url||item.mediaUrl;
   if(isVideo&&media){
     // The old "Открыть видео" link used target=_blank and opened another tab.
     // Now both clip actions point to the ONE in-card official iframe.
     var openHere=create('button','cms-card-link cms-release-inline-link','Открыть видео здесь');
     openHere.type='button';
     openHere.setAttribute('aria-label','Открыть клип на этой странице: '+item.title);
     openHere.onclick=function(){
       if(!hasEmbed(player))listen.onclick();
       else revealInlineVideo();
     };
     actions.appendChild(openHere);
   }else if(external&&!isVideo){
     var link=create('a','cms-card-link','На музыкальной площадке');
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
   // Featured releases stay pinned, regular release cards default to A–Я.
   others.sort(compareSong);
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
     choose.setAttribute('aria-pressed','false');
     choose.onclick=function(){
       if(hasEmbed(player)){
         empty(player);choose.setAttribute('aria-pressed','false');return;
       }
       var src=officialEmbed(item.url,item.provider,'playlist');
       if(!src)return;
       pauseOtherEmbeds();empty(player);choose.setAttribute('aria-pressed','true');
       var frame=create('iframe','cms-release-iframe'+(item.provider==='youtube'?' cms-release-iframe--video':''));
       frame.src=src;frame.title=item.title+' — официальный плейлист '+item.provider;
       frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
       frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       appendOfficialFrame(player,frame,item.provider,false);
       var close=create('button','cms-release-close','Закрыть плеер');
       close.type='button';close.onclick=function(){empty(player);choose.setAttribute('aria-pressed','false');};player.appendChild(close);
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
   radioControls=null;
   empty(host);
   if(!config.enabled||!window.VMM_LANDING_SCHEMA.playlistUrl(config.url,config.provider)){
     host.className='velar-radio hidden';return;
   }
   var radioHidden=false;
   try{radioHidden=!!(window.localStorage&&window.localStorage.getItem('velar-radio-hidden')==='1');}
   catch(ignore){}
   if(radioHidden){
     host.className='velar-radio velar-radio--minimized';
     var restore=create('button','velar-radio-restore','VELAR RADIO · показать');
     restore.type='button';
     restore.onclick=function(){
       try{if(window.localStorage)window.localStorage.removeItem('velar-radio-hidden');}
       catch(ignore){}
       renderRadio(config);
     };
     host.appendChild(restore);
     radioControls={restore:restore,host:host};
     return;
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
   open.type='button';open.setAttribute('aria-pressed','false');
   open.onclick=function(){
     if(hasEmbed(player)){
       empty(player);open.setAttribute('aria-pressed','false');return;
     }
     var src=officialEmbed(config.url,config.provider,'playlist');if(!src)return;
     pauseOtherEmbeds();empty(player);open.setAttribute('aria-pressed','true');
     var frame=create('iframe','velar-radio-iframe'+(config.provider==='youtube'?' velar-radio-iframe--video':''));
     frame.src=src;frame.title=config.title+' — '+config.provider;
     frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     appendOfficialFrame(player,frame,config.provider,false);
     var link=create('a','velar-radio-external','Открыть в '+(config.provider==='spotify'?'Spotify':'YouTube'));
     link.href=config.url;link.target='_blank';link.rel='noopener noreferrer';player.appendChild(link);
   };
   panel.appendChild(open);panel.appendChild(player);
   var hide=create('button','velar-radio-hide','Скрыть радио на этом устройстве');
   hide.type='button';
   hide.onclick=function(){
     empty(player);open.setAttribute('aria-pressed','false');
     try{if(window.localStorage)window.localStorage.setItem('velar-radio-hidden','1');}
     catch(ignore){}
     renderRadio(config);
   };
   panel.appendChild(hide);
   host.appendChild(panel);
   radioControls={toggle:toggle,start:open,player:player,host:host};
   toggle.onclick=function(){
     var shown=panel.className.indexOf(' hidden')!==-1;
     panel.className=shown?'velar-radio-panel':'velar-radio-panel hidden';
     toggle.setAttribute('aria-expanded',shown?'true':'false');
     if(!shown){
       empty(player);open.setAttribute('aria-pressed','false'); // stop the iframe.
       host.className=host.className.replace(/\svelar-radio--chat-open/g,'');
     }
   };
 }
 // Only call this synchronously from the visitor's explicit chat button click.
 // Respect the owner's OFF switch and local hidden state; never autoplay media.
 function openRadioFromChat(){
   if(!radioControls)return false;
   if(radioControls.restore)radioControls.restore.onclick();
   if(!radioControls||!radioControls.toggle||!radioControls.start)return false;
   var controls=radioControls;
   if(controls.toggle.getAttribute('aria-expanded')!=='true')controls.toggle.onclick();
   if(controls.host.className.indexOf('velar-radio--chat-open')===-1)
     controls.host.className+=' velar-radio--chat-open';
   if(!hasEmbed(controls.player))controls.start.onclick(); // Chat command means OPEN, not toggle.
   return true;
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
   if(window.VELAR_PUBLIC_SONGS&&window.VELAR_PUBLIC_SONGS.configure)
     window.VELAR_PUBLIC_SONGS.configure(value.albums.trackView,value.albums.entries,value.genres.songViewMode);
   cards('public-artists-cards',value.artists.cards,'artists',value.artists.featuredView,value.albums,value.genres.songViewMode);
   if(window.VELAR_ALBUMS&&window.VELAR_ALBUMS.render)window.VELAR_ALBUMS.render(value.albums);
   releaseGallery(value.releases);
   playlistGallery(value.releases);
   renderRadio(value.releases.radio);
   if(window.VELAR_UNIVERSE&&window.VELAR_UNIVERSE.render)window.VELAR_UNIVERSE.render(value);
   if(window.VELAR_LANGUAGES&&window.VELAR_LANGUAGES.render)
     window.VELAR_LANGUAGES.render(value.genres.languages);
   if(window.VELAR_TOPICS&&window.VELAR_TOPICS.render)
     window.VELAR_TOPICS.render(value.genres.topics);
   if(window.VELAR_ASSISTANT&&window.VELAR_ASSISTANT.render)
     window.VELAR_ASSISTANT.render(value);
   return true;
 }
 function start(){
   if(!window.VMM_LANDING_SCHEMA)return;
   var fresh=false;
   // Public-only IndexedDB snapshot restores every published section and the
   // local assistant even when the Firebase SDK cannot load without network.
   if(window.VMM_PUBLIC_OFFLINE)window.VMM_PUBLIC_OFFLINE.read().then(function(saved){
     if(saved&&!fresh)render(saved);
   }).catch(function(){});
   if(!window.firebase||!window.VELAR_FIREBASE_CONFIG)return;
   try{
     if(!firebase.apps.length)firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
     // Anonymous public document only. Never load private drafts or catalog.
     firebase.firestore().collection('vmm_public_pages').doc('landing').onSnapshot(function(snapshot){
       if(!snapshot.exists)return;
       var d=snapshot.data()||{};
       if(d.status!=='published'||d.schemaVersion!==1)return;
       if(render(d.content)){
         fresh=true;
         if(window.VMM_PUBLIC_OFFLINE)window.VMM_PUBLIC_OFFLINE.put(d.content).catch(function(){});
       }
     },function(){
       // Use the last verified public snapshot on temporary network failures.
     });
   }catch(ignore){/* Cached public copy still works without Firebase. */}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
 else start();
 window.VMM_PUBLIC_LANDING={render:render,stopExternalPlayers:pauseOtherEmbeds,
   openRadioFromChat:openRadioFromChat}; // public UI only, never writes
}());
