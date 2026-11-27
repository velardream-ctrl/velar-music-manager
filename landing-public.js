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
 function imagePolicy(){return window.VELAR_IMAGE_LOADING;}
 function setImageLoading(img,index){
   var policy=imagePolicy();
   if(policy&&policy.apply)policy.apply(img,index);
   else img.loading='eager';
 }
 function imageNear(element,index,fn){
   var policy=imagePolicy();
   if(policy&&policy.near)policy.near(element,fn,index);
   else fn();
 }
 // RUN-086: only visible, owner-enabled radio controls can be opened from chat.
 var radioControls=null;
 function buildArtistCard(item,type,index){
   var card=create('article','cms-card');
   if(item.imageData||item.imageUrl){
     var img=document.createElement('img');
     // RUN-123: set loading BEFORE src to prevent speculative eager fetching.
     setImageLoading(img,index);
     if(type==='artists'&&index===0)img.setAttribute('fetchpriority','high');
     img.decoding='async';img.referrerPolicy='no-referrer';
     img.alt=item.title;img.src=item.imageData||item.imageUrl;
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
   if(type==='artists'){
     // Open a same-site, read-only detail page for every published artist.
     // Legacy cards without artistId are linked by their public title.
     var detail=create('a','cms-card-link cms-card-link--detail','Подробнее об артисте');
     detail.href='artist.html?'+(item.artistId?
       'id='+encodeURIComponent(item.artistId):
       'name='+encodeURIComponent(item.title));
     copy.appendChild(detail);
   }
   if(item.url){
     var link=create('a','cms-card-link',type==='artists'?'Слушать на площадке':'Открыть релиз');
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
   panel.setAttribute('data-song-artist',item.artistId||item.title);
   var tracks=(item.featuredTracks||[]).slice();
   // Manual order remains opt-in for up to 30 featured songs per artist.
   if(item.featuredSort!=='manual')tracks.sort(compareSong);
   if(!tracks.length){
     panel.className+=' cms-music-panel--empty';
     panel.appendChild(create('p','cms-music-empty','Подборка композиций появится здесь после выбора в музыкальной студии.'));
     return panel;
   }
   view=item.homeDisplay||view;
   if((view==='auto'||view==='rows'||view==='carousel'||view==='classic')&&window.VELAR_PUBLIC_SONGS){
     var carousel=create('div','public-artist-song-list');
     panel.appendChild(carousel);
     // Retain the curator's explicit manual order for an artist's best songs.
     var curated=tracks.map(function(t){
       return {title:t.title,artist:item.title,provider:t.provider,url:t.url,
         alternateProvider:t.alternateProvider,alternateUrl:t.alternateUrl,
         thirdProvider:t.thirdProvider,thirdUrl:t.thirdUrl};
     });
     window.VELAR_PUBLIC_SONGS.mount(carousel,curated,{
       prefix:'artist',motion:item.homeDisplayMotion,view:view==='auto'?'auto':view==='carousel'?'carousel':'rows',batch:30,keepOrder:true
     });
     return panel;
   }
   var list=create('div','cms-music-list'+
     (view==='tiles'?' cms-music-list--tiles':view==='covers'?' cms-music-list--covers':''));
   // RUN-091: player belongs to the clicked row, not after the entire list.
   var active=null,activeProvider='',buttons=[],altButtons=[],thirdButtons=[],players=[],entries=[];
   tracks.forEach(function(track,index){
     var button=create('button','cms-music-track'+
       (view!=='classic'?' cms-music-track--art':''));
     button.type='button';
     button.setAttribute('aria-pressed','false');
     button.appendChild(create('span','cms-music-number',('0'+(index+1)).slice(-2)));
     var cover='';
     (albums&&albums.entries||[]).forEach(function(album){
       if(!album.visible||cover)return;
       (album.tracks||[]).forEach(function(song){
         if(song.url===track.url||song.alternateUrl===track.url)
           cover=album.imageData||album.imageUrl||'';
       });
     });
     var artwork=cover?create('img','cms-music-track-thumb'):
       create('span','cms-music-track-thumb cms-music-track-thumb--empty','♫');
     if(cover){
       setImageLoading(artwork,index);artwork.decoding='async';artwork.referrerPolicy='no-referrer';
       artwork.alt='Обложка: '+track.title;artwork.src=cover;
     }else{
       artwork.setAttribute('aria-hidden','true');
       if(window.VELAR_PUBLIC_SONGS&&window.VELAR_PUBLIC_SONGS.requestArtwork)
         imageNear(button,index,function(){window.VELAR_PUBLIC_SONGS.requestArtwork(track,function(src){
           artwork.className='cms-music-track-thumb cms-music-track-thumb--loaded';
           artwork.textContent='';artwork.style.backgroundImage='url("'+src+'")';
           artwork.style.backgroundSize='cover';artwork.style.backgroundPosition='center';
           artwork.setAttribute('aria-hidden','false');
           artwork.setAttribute('role','img');
           artwork.setAttribute('aria-label','Обложка: '+track.title);
         });});
     }
     if(view!=='classic')button.appendChild(artwork);
     var details=create('span','cms-music-track-info');
     details.appendChild(create('strong','',track.title));
     details.appendChild(create('small','',track.provider==='spotify'?'Spotify':track.provider==='appleMusic'?'Apple Music':'YouTube'));
     button.appendChild(details);
     // Icon is an empty, decorative CSS vector, not a text triangle that
     // Android/Samsung may replace with a blue system emoji.
     var playIcon=create('span','cms-music-play-icon');
     playIcon.setAttribute('aria-hidden','true');
     button.appendChild(playIcon);
     if(view==='classic')button.appendChild(artwork);
     button.setAttribute('aria-label','Слушать: '+track.title+' — '+(track.provider==='spotify'?'Spotify':track.provider==='appleMusic'?'Apple Music':'YouTube'));
     var entry=create('div','cms-music-entry');
     entry.setAttribute('data-song-url',track.url);
     var player=create('div','cms-music-player cms-music-player--inline');
     player.setAttribute('role','region');
     player.setAttribute('aria-label','Плеер: '+track.title);
     var alternateButton=null,thirdButton=null;
     function playFor(provider,link){
       var validated=window.VMM_LANDING_SCHEMA.songUrl(link,provider);
       if(!validated)return;
       if(provider==='youtube'&&legacyYouTubeModal(validated,track.title)){
         if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.record('player_open',{title:track.title,artist:track.artist||'',provider:provider,section:'featured'});
         return;
       }
       if(active===index&&activeProvider===provider&&hasEmbed(player)){
         empty(player);active=null;activeProvider='';
         entry.className=entry.className.replace(/ is-playing/g,'');
         buttons.forEach(function(b){b.setAttribute('aria-pressed','false');});
         altButtons.forEach(function(b){if(b)b.setAttribute('aria-pressed','false');});
         thirdButtons.forEach(function(b){if(b)b.setAttribute('aria-pressed','false');});
         return;
       }
       pauseOtherEmbeds();
       active=index;activeProvider=provider;
       entries.forEach(function(e){e.className=e.className.replace(/ is-playing/g,'');});
       entry.className+=' is-playing';
       buttons.forEach(function(b,i){b.setAttribute('aria-pressed',i===index&&provider===tracks[i].provider?'true':'false');});
       altButtons.forEach(function(b,i){if(b)b.setAttribute('aria-pressed',i===index&&provider===tracks[i].alternateProvider?'true':'false');});
       thirdButtons.forEach(function(b,i){if(b)b.setAttribute('aria-pressed',i===index&&provider===tracks[i].thirdProvider?'true':'false');});
       players.forEach(function(p){empty(p);});
       var frame=document.createElement('iframe');
       frame.className='cms-music-iframe'+(provider==='youtube'?' cms-music-iframe--video':'');
       frame.title=track.title+' — '+(provider==='spotify'?'плеер Spotify':provider==='appleMusic'?'Apple Music':'видео YouTube');
       frame.src=provider==='spotify'?
         'https://open.spotify.com/embed/track/'+validated.split('/').pop():provider==='appleMusic'?
         validated.replace('https://music.apple.com/','https://embed.music.apple.com/'):
         'https://www.youtube-nocookie.com/embed/'+validated.split('v=')[1];
       frame.loading='lazy';frame.setAttribute('allow','clipboard-write; encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       frame.referrerPolicy='strict-origin-when-cross-origin';
       appendOfficialFrame(player,frame,provider,true);
       if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.record('player_open',{title:track.title,artist:track.artist||'',provider:provider,section:'featured'});
       var external=create('a','cms-music-external','Открыть в '+(provider==='spotify'?'Spotify':provider==='appleMusic'?'Apple Music':'YouTube'));
       external.href=validated;external.rel='noopener noreferrer';external.target='_blank';
       player.appendChild(external);
       var dismiss=create('button','cms-music-close','Закрыть');
       dismiss.type='button';
       dismiss.onclick=function(){
         empty(player);active=null;activeProvider='';
         entry.className=entry.className.replace(/ is-playing/g,'');
         button.setAttribute('aria-pressed','false');
         if(alternateButton)alternateButton.setAttribute('aria-pressed','false');
         if(thirdButton)thirdButton.setAttribute('aria-pressed','false');
       };
       player.appendChild(dismiss);
     }
     button.onclick=function(){playFor(track.provider,track.url);};
     if(track.alternateUrl&&track.alternateProvider){
       alternateButton=create('button','cms-music-alt-source',
         'Слушать в '+(track.alternateProvider==='spotify'?'Spotify':track.alternateProvider==='appleMusic'?'Apple Music':'YouTube'));
       alternateButton.type='button';
       alternateButton.setAttribute('aria-pressed','false');
       alternateButton.setAttribute('aria-label','Слушать '+track.title+' в '+
         (track.alternateProvider==='spotify'?'Spotify':'YouTube'));
       alternateButton.onclick=function(){playFor(track.alternateProvider,track.alternateUrl);};
     }
     if(track.thirdUrl&&track.thirdProvider){
       thirdButton=create('button','cms-music-alt-source','Apple Music');
       thirdButton.type='button';thirdButton.setAttribute('aria-pressed','false');
       thirdButton.setAttribute('aria-label','Слушать '+track.title+' в Apple Music');
       thirdButton.onclick=function(){playFor(track.thirdProvider,track.thirdUrl);};
     }
     buttons.push(button);altButtons.push(alternateButton);thirdButtons.push(thirdButton);players.push(player);entries.push(entry);
     var sourceRow=create('div','cms-music-source-row');
     sourceRow.style.display='flex';sourceRow.style.alignItems='center';sourceRow.style.gap='6px';
     button.style.flex='1';button.style.minWidth='0';
     // Keep the existing song row and inline player; only render compact provider controls.
     // A provider icon is visible only when that song has a verified official URL.
     function providerIcon(provider){
       var icon=create('span','cms-platform-symbol');
       icon.setAttribute('aria-hidden','true');
       if(provider==='spotify'){
         icon.textContent='♫';icon.style.background='#1db954';icon.style.color='#fff';
       }else if(provider==='youtube'){
         icon.textContent='▶';icon.style.background='#d71920';icon.style.color='#fff';
       }else{
         icon.textContent='♪';icon.style.background='#f5f5f7';icon.style.color='#242428';
       }
       icon.style.display='inline-flex';icon.style.alignItems='center';icon.style.justifyContent='center';
       icon.style.width='30px';icon.style.height='30px';icon.style.borderRadius='9px';
       icon.style.fontWeight='700';icon.style.fontSize='17px';icon.style.flexShrink='0';
       return icon;
     }
     function compactSource(control,provider){
       if(!control)return;
       control.textContent='';
       control.appendChild(providerIcon(provider));
       control.style.flex='0 0 auto';control.style.width='36px';control.style.minWidth='36px';
       control.style.padding='3px';control.style.border='0';control.style.background='transparent';
       control.style.display='inline-flex';control.style.justifyContent='center';
       control.title=provider==='spotify'?'Spotify':provider==='youtube'?'YouTube':'Apple Music';
       control.setAttribute('aria-label','Слушать '+track.title+' в '+control.title);
       sourceRow.appendChild(control);
     }
     // Preserve RUN-122/131 DOM positions and the original primary song row.
     // Only secondary and third official providers become compact icons.
     sourceRow.appendChild(button);
     if(alternateButton)compactSource(alternateButton,track.alternateProvider);
     if(thirdButton)compactSource(thirdButton,track.thirdProvider);
     entry.appendChild(sourceRow);entry.appendChild(player);
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
     var card=buildArtistCard(item,type,index);
     if(stories){
       var row=create('div','cms-artist-story'+(index%2?' cms-artist-story--reverse':''));
       row.appendChild(card);
       row.appendChild(musicPanel(item,songMode==='auto'?'auto':songMode==='carousel'?'carousel':(featuredView||'classic'),albums));
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
   if(window.VELAR_PUBLIC_SONGS&&window.VELAR_PUBLIC_SONGS.closeActive)window.VELAR_PUBLIC_SONGS.closeActive();
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
 // RUN-147: older iPad Safari misplaces YouTube's own cross-origin play button.
 // Detect the unsupported layout engine, not all iPads or modern iPhones.
 function legacyYouTubeModal(url,title){
   if(!legacyIpadVideo())return false;
   return openYouTubeModal(url,title);
 }
 function openYouTubeModal(url,title){
   var media=officialEmbed(url,'youtube',url.indexOf('/playlist?')>=0?'playlist':'release');
   if(!media)return false;
   showLegacyVideoModal(media,title||'YouTube');return true;
 }
 function legacyIpadVideo(){
   var ua=typeof navigator!=='undefined'?(navigator.userAgent||''):'';
   if(window.VMM_YOUTUBE_COMPAT&&window.VMM_YOUTUBE_COMPAT.required())return true;
   if(!/iPad/i.test(ua))return false;
   return !window.CSS||!window.CSS.supports||
     !window.CSS.supports('aspect-ratio','16 / 9');
 }
 function youtubeWatchUrl(embed){
   var match=(embed||'').match(/^https:\/\/www\.youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})$/);
   return match?'https://www.youtube.com/watch?v='+match[1]:'';
 }
 // RUN-149: old iPad gets a page-local lightbox, never a new browser tab.
 var dismissVideoModal=null;
 function showLegacyVideoModal(media,title,catalogIds){
   if(dismissVideoModal)dismissVideoModal();
   pauseOtherEmbeds();
   var prior=document.getElementById('velar-legacy-video-modal');
   if(prior&&prior.parentNode)prior.parentNode.removeChild(prior);
   var overlay=create('div','velar-video-overlay');
   overlay.id='velar-legacy-video-modal';
   overlay.setAttribute('role','dialog');
   overlay.setAttribute('aria-modal','true');
   overlay.setAttribute('aria-label','Видеоклип: '+title);
   var panel=create('div','velar-video-dialog');
   var close=create('button','velar-video-dialog-close','✕ Закрыть');
   close.type='button';close.setAttribute('aria-label','Закрыть видеоплеер');
   var viewport=create('div','velar-video-viewport');
   var frame=create('iframe','velar-video-dialog-frame');
   frame.title=title+' — YouTube';
   // Old Safari can leave youtube-nocookie embeds blank. Use YouTube's
   // regular player endpoint, inline playback and an explicit 16:9 viewport.
   var id=(media||'').match(/^https:\/\/www\.youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})$/);
   var frameUrl=id?'https://www.youtube.com/embed/'+id[1]:media.replace('www.youtube-nocookie.com','www.youtube.com');
   frameUrl+=(frameUrl.indexOf('?')>=0?'&':'?')+'playsinline=1&rel=0';
   frame.referrerPolicy='strict-origin-when-cross-origin';
   frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
   frame.setAttribute('allowfullscreen','');
   frame.setAttribute('webkitallowfullscreen','');
   frame.setAttribute('playsinline','');
   // RUN-155: use YouTube's supported controls=0 and real API controls
   // inside the modal, outside the broken cross-origin control layout.
   var apiPlayer=null,apiPlay=null,apiMute=null,apiSeek=null,apiStatus=null;
   var ready=false,playing=false,closed=false,apiTimer=null,playTimer=null,clock=null;
   var width=0,height=0,apiReadyCallback=null,previousReady=null;
   var legacy=legacyIpadVideo();
   function clearTimer(timer){if(timer!==null)window.clearTimeout(timer);}
   function failed(message){
     if(closed||!apiStatus)return;
     apiStatus.textContent=message;
   }
   if(legacy){
     frameUrl+='&controls=0';
     apiPlay=create('button','velar-video-api-play','Воспроизвести');
     apiPlay.type='button';apiPlay.disabled=true;
     apiPlay.setAttribute('aria-label','Воспроизвести видео '+title);
     apiMute=create('button','velar-video-api-mute','Выключить звук');
     apiMute.type='button';apiMute.disabled=true;
     apiSeek=create('input','velar-video-api-seek');
     apiSeek.type='range';apiSeek.min='0';apiSeek.max='100';apiSeek.value='0';apiSeek.disabled=true;
     apiSeek.setAttribute('aria-label','Позиция видео');
     apiStatus=create('p','velar-video-api-status','Загрузка плеера YouTube…');
     apiStatus.setAttribute('role','status');apiStatus.setAttribute('aria-live','polite');
     apiPlay.onclick=function(){
       if(!ready||closed)return;
       clearTimer(playTimer);
       try{
         if(playing){apiPlayer.pauseVideo();return;}
         // Must run synchronously in the user's gesture, never in onReady.
         apiStatus.textContent='Ожидаем запуска видео…';
         apiPlayer.playVideo();
         playTimer=window.setTimeout(function(){
           if(!playing)failed('YouTube не подтвердил запуск. Попробуйте ещё раз или используйте запасную ссылку ниже.');
         },8000);
       }catch(err){failed('Не удалось запустить YouTube. Можно повторить нажатие или открыть запасную ссылку.');}
     };
     apiMute.onclick=function(){
       if(!ready||closed)return;
       try{if(apiPlayer.isMuted()){apiPlayer.unMute();apiMute.textContent='Выключить звук';}
       else{apiPlayer.mute();apiMute.textContent='Включить звук';}}catch(err){}
     };
     apiSeek.onchange=function(){
       if(!ready||closed)return;
       try{apiPlayer.seekTo(apiPlayer.getDuration()*Number(apiSeek.value)/100,true);}catch(err){}
     };
   }
   var fallback=create('a','velar-video-fallback','Если видео не запускается — смотреть на YouTube');
   fallback.href=id?'https://www.youtube.com/watch?v='+id[1]:media.replace('https://www.youtube-nocookie.com/embed/videoseries?list=','https://www.youtube.com/playlist?list=');
   fallback.target='_blank';fallback.rel='noopener noreferrer';
   var previousFocus=document.activeElement;
   // RUN-152: avoid percentage iframe height inside a height:0 padding box.
   // Size before navigation; rotation changes dimensions without reloading video.
   function sizeLegacyVideo(){
     if(!legacy)return;
     width=Math.floor(Math.min(940,window.innerWidth*0.94)-26);
     var available=Math.floor(window.innerHeight-235);
     width=Math.max(200,Math.min(width,Math.floor(Math.max(200,available)*16/9)));
     height=Math.max(200,Math.round(width*9/16));
     viewport.style.width=width+'px';
     viewport.style.height=height+'px';
     viewport.style.paddingTop='0';
     viewport.style.margin='0 auto';
     frame.setAttribute('width',String(width));
     frame.setAttribute('height',String(height));
     frame.style.setProperty('width',width+'px','important');
     frame.style.setProperty('height',height+'px','important');
     if(ready&&apiPlayer.setSize)apiPlayer.setSize(width,height);
   }
   function dismiss(){
     closed=true;ready=false;
     clearTimer(apiTimer);clearTimer(playTimer);
     if(clock!==null)window.clearInterval(clock);
     if(window.onYouTubeIframeAPIReady===apiReadyCallback)window.onYouTubeIframeAPIReady=previousReady;
     if(legacy){
       window.removeEventListener('resize',sizeLegacyVideo);
       window.removeEventListener('orientationchange',sizeLegacyVideo);
     }
     dismissVideoModal=null;
     if(apiPlayer&&typeof apiPlayer.destroy==='function')try{apiPlayer.destroy();}catch(err){}
     if(overlay.parentNode)overlay.parentNode.removeChild(overlay);
     document.removeEventListener('keydown',onKey);
     if(previousFocus&&previousFocus.focus)previousFocus.focus();
   }
   function onKey(e){if(e.key==='Escape'||e.keyCode===27)dismiss();}
   close.onclick=dismiss;
   overlay.onclick=function(e){if(e.target===overlay)dismiss();};
   viewport.appendChild(frame);
   panel.appendChild(close);panel.appendChild(viewport);
   if(apiPlay){
     var controls=create('div','velar-video-api-controls');
     controls.appendChild(apiPlay);controls.appendChild(apiMute);controls.appendChild(apiSeek);
     panel.appendChild(controls);panel.appendChild(apiStatus);
   }
   panel.appendChild(fallback);overlay.appendChild(panel);
   document.body.appendChild(overlay);
   sizeLegacyVideo();
   if(apiPlay){
     frameUrl+=(frameUrl.indexOf('?')>=0?'&':'?')+'enablejsapi=1&origin='+encodeURIComponent((window.location&&window.location.origin)||'https://velardream.com');
   }
   frame.src=frameUrl;
   if(apiPlay){
     var attachApi=function(){
       if(closed||!overlay.parentNode||!window.YT||typeof window.YT.Player!=='function')return;
       try{apiPlayer=new window.YT.Player(frame,{events:{
         onReady:function(e){
           if(closed)return;
           apiPlayer=e.target;ready=true;clearTimer(apiTimer);
           if(catalogIds&&catalogIds.length)apiPlayer.cuePlaylist(catalogIds);
           apiPlay.disabled=false;apiMute.disabled=false;apiSeek.disabled=false;
           if(apiPlayer.setSize)apiPlayer.setSize(width,height);
           apiStatus.textContent='Плеер готов. Нажмите «Воспроизвести».';
           clock=window.setInterval(function(){
             if(!ready||closed)return;
             try{var duration=apiPlayer.getDuration();
               if(duration>0)apiSeek.value=String(100*apiPlayer.getCurrentTime()/duration);
             }catch(err){}
           },1000);
         },
         onStateChange:function(e){
           if(closed)return;
           playing=e.data===1;
           apiPlay.textContent=playing?'Пауза':'Воспроизвести';
           if(playing){clearTimer(playTimer);apiStatus.textContent='Видео воспроизводится';}
           else if(e.data===2)apiStatus.textContent='Пауза';
           else if(e.data===0)apiStatus.textContent='Видео завершено';
           else if(e.data===3)apiStatus.textContent='Загрузка видео…';
         },
         onError:function(e){failed('Ошибка YouTube ('+e.data+'). Запасная ссылка доступна ниже.');},
         onAutoplayBlocked:function(){failed('Браузер заблокировал запуск. Нажмите «Воспроизвести» ещё раз.');}
       }});}catch(err){failed('Плеер YouTube недоступен. Запасная ссылка доступна ниже.');}
     };
     apiTimer=window.setTimeout(function(){
       if(!ready)failed('YouTube не подтвердил готовность плеера. Попробуйте закрыть и открыть окно ещё раз.');
     },15000);
     if(window.YT&&typeof window.YT.Player==='function')attachApi();
     else{
       previousReady=window.onYouTubeIframeAPIReady;
       apiReadyCallback=function(){
         if(typeof previousReady==='function')try{previousReady();}catch(err){}
         attachApi();
       };
       window.onYouTubeIframeAPIReady=apiReadyCallback;
       if(!document.getElementById('velar-youtube-iframe-api')){
         var apiScript=document.createElement('script');
         apiScript.id='velar-youtube-iframe-api';
         apiScript.src='https://www.youtube.com/iframe_api';
         apiScript.onerror=function(){
           if(apiScript.parentNode)apiScript.parentNode.removeChild(apiScript);
           failed('Не загрузился плеер YouTube. Закройте и откройте окно для повтора.');
         };
         document.head.appendChild(apiScript);
       }
     }
   }
   if(legacy){
     window.addEventListener('resize',sizeLegacyVideo);
     window.addEventListener('orientationchange',sizeLegacyVideo);
   }
   dismissVideoModal=dismiss;
   document.addEventListener('keydown',onKey);
   if(close.focus)close.focus();
 }
 function releaseCard(item,feature,index){
   index=typeof index==='number'?index:0;
   var isVideo=item.kind==='video';
   var card=create('article','cms-release-card'+(feature?' cms-release-card--featured':''));
   card.setAttribute('data-song-url',item.mediaUrl||'');
   var art=create('div','cms-release-art'+(isVideo?' cms-release-art--video':''));
   if(item.imageData||item.imageUrl){
     var image=create('img','cms-release-cover');
     setImageLoading(image,index);image.decoding='async';image.referrerPolicy='no-referrer';
     image.alt='Обложка: '+item.title;image.src=item.imageData||item.imageUrl;
     art.appendChild(image);
   }else if(isVideo&&item.mediaProvider==='youtube'&&item.mediaUrl){
     var video=window.VMM_LANDING_SCHEMA.releaseMediaUrl(item.mediaUrl,'youtube');
     if(video){
       var thumb=create('img','cms-release-cover');
       setImageLoading(thumb,index);thumb.decoding='async';
       thumb.alt='Обложка видеоклипа: '+item.title;
       thumb.src='https://i.ytimg.com/vi/'+video.split('v=')[1]+'/hqdefault.jpg';
       art.appendChild(thumb);
     }
   }
   if(!art.children||!art.children.length){
     var placeholder=create('div','cms-release-placeholder');
     var emblem=create('span','cms-release-disc');emblem.setAttribute('aria-hidden','true');
     placeholder.appendChild(emblem);art.appendChild(placeholder);
     // Missing single cover: reuse the approved Spotify public metadata,
     // never a private library, Drive, artist profile or an extra image card.
     if(item.mediaProvider==='spotify'&&item.mediaUrl&&
        window.VELAR_PUBLIC_SONGS&&window.VELAR_PUBLIC_SONGS.requestArtwork){
       imageNear(art,index,function(){window.VELAR_PUBLIC_SONGS.requestArtwork({
         title:item.title,provider:'spotify',url:item.mediaUrl
       },function(url){
         var coverImage=create('img','cms-release-cover');
         setImageLoading(coverImage,index);coverImage.decoding='async';
         coverImage.referrerPolicy='no-referrer';
         coverImage.alt='Обложка: '+item.title;coverImage.src=url;
         art.appendChild(coverImage);
       });});
     }
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
   // The existing cover is the video/player stage: do not add another
   // expanding row after the text of the release.
   art.appendChild(player);
   if(media){
     var listen=create('button','cms-release-listen');
     listen.type='button';
     var icon=create('span','cms-release-play');
     icon.setAttribute('aria-hidden','true');listen.appendChild(icon);
     listen.appendChild(create('span','',isVideo?'Смотреть клип':'Слушать'));
     listen.setAttribute('aria-label',(isVideo?'Смотреть клип: ':'Слушать релиз: ')+item.title);
     listen.setAttribute('aria-pressed','false');
     listen.onclick=function(){
       if(isVideo&&item.mediaProvider==='youtube'&&legacyIpadVideo()){
         showLegacyVideoModal(media,item.title);
         if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.record('player_open',{title:item.title,artist:item.subtitle||'',provider:item.mediaProvider,section:'releases'});
         return;
       }
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
       if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.record('player_open',{title:item.title,artist:item.subtitle||'',provider:item.mediaProvider,section:'releases'});
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
   // Distinct optional viewing mode on modern browsers: large page-local overlay.
   // On old iPads the main button already uses this mode, so do not duplicate it.
   if(isVideo&&media&&!legacyIpadVideo()){
     var expand=create('button','cms-card-link cms-release-inline-link','Развернуть видео');
     expand.type='button';
     expand.setAttribute('aria-label','Открыть клип в большом окне: '+item.title);
     expand.onclick=function(){pauseOtherEmbeds();empty(player);listen.setAttribute('aria-pressed','false');showLegacyVideoModal(media,item.title);};
     actions.appendChild(expand);
   }
   var external=item.url||item.mediaUrl;
   if(external&&!isVideo){
     var link=create('a','cms-card-link','На музыкальной площадке');
     link.href=external;link.rel='noopener noreferrer';link.target='_blank';actions.appendChild(link);
   }
   copy.appendChild(actions);card.appendChild(copy);
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
   var others=[],clips=[],clipHost=create('section','video-carousel');
   var useRail=(value.videoView==='carousel'||value.videoView==='auto')&&window.VELAR_PUBLIC_SONGS;
   shown.forEach(function(item){
     if(useRail&&item.kind==='video'){clips.push(item);return;}
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
     empty(grid);empty(clipHost);
     var showClips=clips.length&&(mode==='all'||mode==='video');
     clipHost.hidden=!showClips;
     if(showClips){
       clipHost.appendChild(create('h3','','Видеоклипы'));
       var list=create('div','video-carousel-list');clipHost.appendChild(list);
       var sorted=clips.slice().sort(function(a,b){
         return Number(b.spotlight==='video')-Number(a.spotlight==='video')||compareSong(a,b);
       });
       window.VELAR_PUBLIC_SONGS.mount(list,sorted,{prefix:'video',forceView:value.videoView,
         keepOrder:true,batch:sorted.length,motion:value.videoMotion,
         renderCard:function(item,i){return releaseCard(item,item.spotlight==='video',i);}
       });
     }
     var matches=others.filter(function(item){return mode==='all'||item.kind===mode;});
     matches.slice(0,limit).forEach(function(item,index){grid.appendChild(releaseCard(item,false,index));});
     more.textContent='Показать ещё ('+(matches.length-limit)+')';
     more.className='cms-release-more'+(matches.length>limit?'':' hidden');
     if(!matches.length&&!showClips)
       grid.appendChild(create('p','cms-release-empty','Пока нет релизов в этой категории.'));
   }
   more.onclick=function(){limit+=6;paint();};
   target.appendChild(filters);if(clips.length)target.appendChild(clipHost);target.appendChild(grid);target.appendChild(more);
   paint();
 }

 function playlistGallery(value){
   var grid=byId('public-playlists-cards'),follow=byId('public-subscriptions');
   if(!grid||!follow)return;
   empty(grid);empty(follow);
   var playlists=value.playlists.filter(function(row){return row.visible&&row.url;});
   // RUN-206: one active inline player; shared crystal lives outside these cards.
   var activePlayer=null,activeButton=null;
   playlists.forEach(function(item,index){
     var card=create('article','cms-playlist-card'+(index===0?' cms-playlist-card--featured':''));
     // RUN-207: the artwork is hidden on narrow screens and visible beside
     // each playlist on wider screens. CSS switches instantly on rotation.
     var decoration=create('div','cms-playlist-art');
     decoration.appendChild(create('span','cms-playlist-vinyl'));
     if(window.VELAR_PLAYLIST_RESONANCE&&window.VELAR_PLAYLIST_RESONANCE.decorate)
       window.VELAR_PLAYLIST_RESONANCE.decorate(decoration);
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
     player.id='cms-playlist-player-'+index;
     choose.setAttribute('aria-controls',player.id);
     choose.setAttribute('aria-expanded','false');
     choose.setAttribute('aria-pressed','false');
     function closeInlinePlayer(){
       empty(player);
       choose.setAttribute('aria-pressed','false');
       choose.setAttribute('aria-expanded','false');
       if(activePlayer===player){activePlayer=null;activeButton=null;}
     }
     choose.onclick=function(){
       if(hasEmbed(player)){closeInlinePlayer();return;}
       var src=officialEmbed(item.url,item.provider,'playlist');
       if(!src)return;
       // Collapse a previously opened playlist before opening the next.
       if(activePlayer&&activePlayer!==player){
         empty(activePlayer);
         if(activeButton){
           activeButton.setAttribute('aria-pressed','false');
           activeButton.setAttribute('aria-expanded','false');
         }
         activePlayer=null;activeButton=null;
       }
       if(item.provider==='youtube'&&legacyYouTubeModal(item.url,item.title))return;
       pauseOtherEmbeds();empty(player);
       choose.setAttribute('aria-pressed','true');
       choose.setAttribute('aria-expanded','true');
       activePlayer=player;activeButton=choose;
       var frame=create('iframe','cms-release-iframe'+(item.provider==='youtube'?' cms-release-iframe--video':''));
       frame.src=src;frame.title=item.title+' — официальный плейлист '+item.provider;
       frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
       frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
       frame.setAttribute('allowfullscreen','');
       appendOfficialFrame(player,frame,item.provider,false);
       var close=create('button','cms-release-close','Закрыть плеер');
       close.type='button';close.onclick=closeInlinePlayer;player.appendChild(close);
     };
     if(item.provider!=='appleMusic')actions.appendChild(choose);
     var external=create('a','cms-card-link','Открыть в '+(item.provider==='spotify'?'Spotify':item.provider==='appleMusic'?'Apple Music':'YouTube'));
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
 var radioTimer=null;
 var stopRadioMove=null;
 var radioYoutube=null;
 function radioSchedule(tracks,time){
   var total=tracks.reduce(function(sum,t){return sum+t.seconds;},0);
   var cycle=Math.floor(time/total),offset=time%total,order=tracks.slice();
   var seed=(cycle%2147483646)+1;
   for(var i=order.length-1;i>0;i--){
     seed=seed*16807%2147483647;
     var j=seed%(i+1),swap=order[i];order[i]=order[j];order[j]=swap;
   }
   var index=0;
   while(offset>=order[index].seconds){offset-=order[index++].seconds;}
   return {track:order[index],offset:offset,remaining:order.slice(index+1)};
 }
 function radioMove(host,grip,orb){
   if(!host.getBoundingClientRect||!window.addEventListener)return {sync:function(){},ignoreClick:function(){return false;}};
   var anchor=null,drag=null,ignoreUntil=0;
   var movedByListener=false,initialWidth=window.innerWidth;
   var pendingHeroAnchor=false,heroImg=null,heroFrame=null;
   function clamp(n,max){return Math.max(0,Math.min(n,max));}
   function point(e){return e.touches?(e.touches[0]||e.changedTouches[0]):e;}
   // RUN-169: position a fresh floating orb alongside the hero crystal,
   // below the navigation; keep the viewport-fixed behavior after scroll.
   // Existing manual drag and keyboard positions take precedence until reload.
   function defaultAnchor(){
     var doc=typeof document==='undefined'?null:document;
     var crystal=doc&&doc.getElementById?doc.getElementById('hero-crystal-link'):null;
     var header=doc&&doc.getElementById?doc.getElementById('top'):null;
     var art=crystal&&crystal.getBoundingClientRect?crystal.getBoundingClientRect():null;
     var nav=header&&header.getBoundingClientRect?header.getBoundingClientRect():null;
     var navBottom=nav&&nav.bottom>0?nav.bottom:0;
     var onscreen=art&&art.height>40&&art.right>0&&
       art.left<window.innerWidth&&art.top<window.innerHeight&&art.bottom>navBottom;
     var gap=Math.max(8,Math.min(28,window.innerWidth*.02));
     pendingHeroAnchor=!onscreen;
     var right=onscreen?window.innerWidth-art.right-gap-68:
       Math.max(16,Math.min(34,window.innerWidth*.075));
     // RUN-172: on phones always begin on the RIGHT-hand edge beside the
     // crystal artwork, even if the hero image measured zero at first paint.
     // Leave wide-screen/iPad placement and all manual drag choices intact.
     if(window.innerWidth<=740)
       right=Math.max(12,Math.min(24,window.innerWidth*.045));
     var top=onscreen?art.top+(art.height-68)/2:window.innerHeight*.32;
     // Reserve space for at least the gold 20% default glow and avoid
     // the navigation even if the crystal shrinks on a compact phone.
     return {right:Math.max(12,clamp(right,Math.max(0,window.innerWidth-80))),
       top:clamp(Math.max(top,navBottom+16),Math.max(0,window.innerHeight-80))};
   }
   function settleHeroAnchor(){
     if(movedByListener||!pendingHeroAnchor)return;
     var hero=typeof document!=='undefined'&&document.getElementById?
       document.getElementById('hero-crystal-link'):null;
     var rect=hero&&hero.getBoundingClientRect?hero.getBoundingClientRect():null;
     if(!rect||rect.height<=40||rect.top>=window.innerHeight||rect.bottom<=0)return;
     // The image has now acquired its final layout. Align at its height
     // without moving any previously dragged radio.
     anchor=defaultAnchor();fit();
   }
   // Preserve a logical right-side anchor while wide and narrow panels change size.
   // A large panel is allowed to shift onscreen while the saved orb position survives.
   function fit(){
     if(!anchor)anchor=defaultAnchor();
     var rect=host.getBoundingClientRect();
     // Use the FINAL CSS width rather than a mid-animation width, especially
     // on iOS 12 where ResizeObserver cannot help after transition.
     var width=host.className.indexOf('velar-radio--bubble')!==-1?
       68:Math.min(365,Math.max(0,window.innerWidth-24));
     var right=clamp(anchor.right,Math.max(0,window.innerWidth-width));
     var top=clamp(anchor.top,Math.max(0,window.innerHeight-rect.height));
     host.style.right=right+'px';host.style.left='auto';host.style.top=top+'px';
     if(host.className.indexOf('velar-radio--bubble')!==-1){
       host.className=host.className.replace(/\svelar-radio--popup-left|\svelar-radio--popup-above/g,'');
       // A mini player on the RIGHT must expand toward the LEFT (right:0).
       // Only bubbles on the left half need the alternate left:0 alignment.
       if(window.innerWidth-right-width<window.innerWidth/2)host.className+=' velar-radio--popup-left';
       if(window.innerHeight-top-rect.height<288)host.className+=' velar-radio--popup-above';
     }
   }
   function down(e,kind){
     if(typeof e.button==='number'&&e.button>0)return;
     if(kind==='orb'&&host.className.indexOf('velar-radio--bubble')===-1)return;
     var p=point(e),r=host.getBoundingClientRect();if(!p)return;
     drag={kind:kind,x:p.clientX,y:p.clientY,dx:r.right-p.clientX,dy:p.clientY-r.top,moved:false};
     if(kind==='grip'&&e.cancelable)e.preventDefault();
   }
   function move(e){
     if(!drag)return;
     var p=point(e);if(!p)return;
     if(!drag.moved&&Math.abs(p.clientX-drag.x)+Math.abs(p.clientY-drag.y)<9)return;
     drag.moved=true;movedByListener=true;
     anchor={right:window.innerWidth-p.clientX-drag.dx,top:p.clientY-drag.dy};
     fit();
     if(e.cancelable)e.preventDefault();
   }
   function up(){if(drag&&drag.kind==='orb'&&drag.moved)ignoreUntil=Date.now()+650;drag=null;}
   function resized(){
     // Re-anchor only on an actual viewport-width/layout change and only
     // before a visitor moves the orb. iOS address-bar height changes must
     // not cause a floating radio to jump during scrolling.
     if(!movedByListener&&window.innerWidth!==initialWidth){
       initialWidth=window.innerWidth;anchor=defaultAnchor();
     }
     fit();
   }
   function gripDown(e){down(e,'grip');}
   function orbDown(e){down(e,'orb');}
   grip.addEventListener('mousedown',gripDown);
   grip.addEventListener('touchstart',gripDown,{passive:false});
   orb.addEventListener('mousedown',orbDown);
   orb.addEventListener('touchstart',orbDown,{passive:true});
   window.addEventListener('mousemove',move);
   window.addEventListener('touchmove',move,{passive:false});
   window.addEventListener('mouseup',up);
   window.addEventListener('touchend',up);
   window.addEventListener('touchcancel',up);
   window.addEventListener('resize',resized);
   var observer=window.ResizeObserver?new window.ResizeObserver(fit):null;
   if(observer)observer.observe(host);
   function keys(e){
     var step={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]}[e.key];
     if(!step)return;
     var rect=host.getBoundingClientRect();
     movedByListener=true;
     anchor={right:window.innerWidth-rect.right-step[0],top:rect.top+step[1]};
     fit();e.preventDefault();
   }
   grip.onkeydown=keys;
   orb.onkeydown=function(e){
     if(host.className.indexOf('velar-radio--bubble')!==-1)keys(e);
   };
   stopRadioMove=function(){
     if(observer)observer.disconnect();
     grip.removeEventListener('mousedown',gripDown);grip.removeEventListener('touchstart',gripDown);
     orb.removeEventListener('mousedown',orbDown);orb.removeEventListener('touchstart',orbDown);
     window.removeEventListener('mousemove',move);window.removeEventListener('touchmove',move);
     window.removeEventListener('mouseup',up);window.removeEventListener('touchend',up);window.removeEventListener('touchcancel',up);
     window.removeEventListener('resize',resized);
     if(heroImg&&heroImg.removeEventListener)
       heroImg.removeEventListener('load',settleHeroAnchor);
     if(heroFrame&&window.cancelAnimationFrame)
       window.cancelAnimationFrame(heroFrame);
   };
   // The first paint uses the crystal position instead of CSS top:12px.
   fit();
   var hero=typeof document!=='undefined'&&document.getElementById?
     document.getElementById('hero-crystal-link'):null;
   heroImg=hero&&hero.querySelector?hero.querySelector('img'):null;
   if(heroImg&&heroImg.addEventListener)
     heroImg.addEventListener('load',settleHeroAnchor);
   if(pendingHeroAnchor&&window.requestAnimationFrame)
     heroFrame=window.requestAnimationFrame(settleHeroAnchor);
   return {sync:fit,ignoreClick:function(){
     if(Date.now()<ignoreUntil){ignoreUntil=0;return true;}return false;
   }};
 }
 function stationHelp(standalone){
   var details=create('details','station-help');
   var summary=create('summary','station-help-button','?');
   summary.setAttribute('aria-label','Как слушать и установить VELAR RADIO');
   details.appendChild(summary);
   var bubble=create('div','station-help-bubble');
   bubble.appendChild(create('strong','','Возьмите музыку с собой'));
   function tip(label,text){
     var line=create('p','');
     line.appendChild(create('b','',label+' '));line.appendChild(create('span','',text));bubble.appendChild(line);
   }
   tip('На компьютере.','Откройте радио в отдельном окне и включите эфир. Можно вернуться к работе, оставив окно открытым. Кнопка «Установить» поможет добавить радио как приложение, если браузер это поддерживает.');
   tip('На iPhone и iPad.','Откройте страницу радио в Safari. В меню «Поделиться» выберите «На экран Домой». Радио появится рядом с вашими приложениями.');
   tip('На Android.','Откройте страницу радио в Chrome. В меню браузера выберите «Установить приложение» или «Добавить на главный экран».');
   tip('В наушниках или на колонке.','Выберите устройство в настройках звука. На iPhone и iPad это можно сделать в Пункте управления через значок AirPlay.');
   tip('Для друзей и для вашего сайта.','В отдельном плеере нажмите «Поделиться», чтобы отправить ссылку. Кнопка «Код для сайта» даст код для вставки на страницу, которая поддерживает iframe.');
   if(!standalone){
     var link=create('a','','Открыть отдельный плеер');link.href='radio/';link.target='_blank';link.rel='noopener';bubble.appendChild(link);
   }
   bubble.appendChild(create('p','station-help-signoff','Оставайтесь с нами. Пусть любимая музыка всегда будет рядом с вами.'));
   var close=create('button','','Закрыть подсказку');close.type='button';
   function dismiss(){details.open=false;summary.focus();}
   close.onclick=dismiss;
   details.onkeydown=function(event){if(details.open&&event.key==='Escape'){event.preventDefault();dismiss();}};
   bubble.appendChild(close);details.appendChild(bubble);return details;
 }
 function shuffledRadioUrls(urls){
   var queue=urls.slice();
   for(var i=queue.length-1;i>0;i--){
     var j=Math.floor(Math.random()*(i+1)),swap=queue[i];queue[i]=queue[j];queue[j]=swap;
   }
   return queue;
 }
 // RUN-167: YouTube IFrame API keeps user-started playlists playing and allows
 // manual skips. Long shuffled catalogs are loaded in chunks of at most 100 IDs.
 function cueCatalog(frame,ids,status,startSeconds){
   var active=true,api=null,previous=null,callback=null;
   var order=ids.slice(),offset=0,limit=100,fallbackIndex=0,errors=0,loopEnabled=false;
   function chunk(){return order.slice(offset,offset+limit);}
   function nextChunk(){
     offset+=chunk().length;
     if(offset>=order.length){
       offset=0;
       var last=order[order.length-1];order=shuffledRadioUrls(order);
       if(order.length>1&&order[0]===last){
         var swap=order[0];order[0]=order[1];order[1]=swap;
       }
     }
     fallbackIndex=offset;
     if(!api||typeof api.loadPlaylist!=='function')return false;
     api.loadPlaylist(chunk(),0,0);return true;
   }
   function next(){
     if(!active)return false;
     if(api&&typeof api.nextVideo==='function'){
       if(!order.length||order.length<=limit){api.nextVideo();return true;}
       var index=typeof api.getPlaylistIndex==='function'?Number(api.getPlaylistIndex()):-1;
       if(index>=0&&index>=chunk().length-1)return nextChunk();
       api.nextVideo();return true;
     }
     // Explicit user click fallback, never a timer-driven iframe reload.
     if(!order.length)return false;
     fallbackIndex=(fallbackIndex+1)%order.length;
     var id=order[fallbackIndex],remaining=order.slice(fallbackIndex+1,fallbackIndex+limit);
     var src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&enablejsapi=1&origin='+
       encodeURIComponent((window.location&&window.location.origin)||'https://velardream.com');
     if(remaining.length)src+='&playlist='+remaining.join(',');
     frame.src=src;return true;
   }
   function attach(){
     if(!active||!frame.parentNode||!window.YT||!window.YT.Player)return;
     try{
       new window.YT.Player(frame,{events:{
         onReady:function(e){
           if(!active)return;
           api=e.target;
           if(order.length&&api&&typeof api.cuePlaylist==='function'){
             // Do not interrupt a visitor who started playback before the API loaded.
             var alreadyPlaying=typeof api.getPlayerState==='function'&&api.getPlayerState()===1;
             if(!alreadyPlaying)api.cuePlaylist(chunk(),0,Number(startSeconds)||0);
             if(order.length<=limit&&typeof api.setLoop==='function'){
               api.setLoop(true);loopEnabled=true;
             }
           }
         },
         onStateChange:function(e){
           if(!active)return;
           if(e.data===1){
             errors=0;
             // YouTube IFrame Player API confirms an actual start (not a full
             // play). Spotify/Apple iframe clicks must never use this event.
             var details=e.target&&typeof e.target.getVideoData==='function'?
               e.target.getVideoData():null;
             var videoId=details&&details.video_id||'';
             if(window.VMM_ANALYTICS&&/^[A-Za-z0-9_-]{11}$/.test(videoId))
               window.VMM_ANALYTICS.record('youtube_play_start',{
                 section:'radio',provider:'youtube',mediaId:videoId});
           }
           if(e.data!==0||!order.length)return;
           var i=e.target&&e.target.getPlaylistIndex?Number(e.target.getPlaylistIndex()):-1;
           if(i>=chunk().length-1&&(order.length>limit||!loopEnabled))nextChunk();
         },
         onError:function(e){
           if(!active)return;
           if([100,101,150].indexOf(e.data)>=0&&errors++<3&&next())return;
           if(status)status.textContent='YouTube не смог открыть клип. Нажмите «Следующая песня» или смените площадку.';
         },
         onAutoplayBlocked:function(){
           if(status)status.textContent='Браузер заблокировал запуск. Нажмите ▶ внутри YouTube.';
         }
       }});
     }catch(err){
       if(status)status.textContent='Управление YouTube недоступно. Ручной пропуск остаётся доступен.';
     }
   }
   if(window.YT&&window.YT.Player)attach();
   else if(document.head&&document.head.appendChild){
     previous=window.onYouTubeIframeAPIReady;
     callback=function(){
       if(typeof previous==='function')previous();
       attach();
     };
     window.onYouTubeIframeAPIReady=callback;
     if(!byId('velar-youtube-iframe-api')){
       var script=create('script','');script.id='velar-youtube-iframe-api';
       script.src='https://www.youtube.com/iframe_api';
       script.onerror=function(){
         if(status)status.textContent='API YouTube недоступен. Ручной пропуск работает; автопереход ограничен встроенным плейлистом.';
         if(script.parentNode)script.parentNode.removeChild(script);
       };
       document.head.appendChild(script);
     }
   }
   return {next:next,dispose:function(){
     active=false;api=null;
     if(callback&&window.onYouTubeIframeAPIReady===callback)
       window.onYouTubeIframeAPIReady=previous;
   }};
 }
 function renderRadio(config){
   if(radioYoutube){radioYoutube.dispose();radioYoutube=null;}
   if(radioTimer!==null){window.clearTimeout(radioTimer);radioTimer=null;}
   if(stopRadioMove){stopRadioMove();stopRadioMove=null;}
   var sources=config.sources||[],catalog=config.catalog||{},available=sources.filter(function(p){return catalog[p]&&catalog[p].length;});
   var tracks=sources.length?[]:(config.tracks||[]);
   var names={youtube:'YouTube',spotify:'Spotify',appleMusic:'Apple Music'};
   var selected=available[0],queue=[],cursor=0;

   var host=byId('velar-radio');
   if(!host)return;
   radioControls=null;
   empty(host);
   if(!config.enabled||(!sources.length&&!tracks.length&&!window.VMM_LANDING_SCHEMA.playlistUrl(config.url,config.provider))){
     host.className='velar-radio hidden';return;
   }
   var station=byId('station-page');
   // RUN-162: start collapsed as a real floating logo, no playback until user chooses.
   host.className=station?'velar-radio':'velar-radio velar-radio--bubble';
   applyRadioVisual(config);
   host.setAttribute('data-radio-player-open','false');
   var toggle=create('button','velar-radio-toggle','');
   toggle.type='button';toggle.setAttribute('aria-expanded','false');
   toggle.setAttribute('aria-label',station?'Свернуть VELAR RADIO':'Развернуть VELAR RADIO (можно перетащить)');
   toggle.setAttribute('aria-controls','velar-radio-panel');
   var halo=create('span','velar-radio-halo');
   halo.setAttribute('aria-hidden','true');toggle.appendChild(halo);
   var dot=create('span','velar-radio-dot');dot.setAttribute('aria-hidden','true');
   toggle.appendChild(dot);toggle.appendChild(create('span','',config.title));
   var icon=create('span','velar-radio-chevron');icon.setAttribute('aria-hidden','true');toggle.appendChild(icon);
   host.appendChild(toggle);
   // RUN-168: apply exact radius after the halo node is mounted.
   applyRadioVisual(config);
   var cover=create('img','velar-radio-cover');cover.alt='';
   if(tracks.length){
     toggle.insertBefore(cover,toggle.firstChild);
     var caption=create('span','velar-radio-caption');toggle.appendChild(caption);
     function updateProgramme(){
       var slot=radioSchedule(tracks,Math.floor(Date.now()/1000));
       caption.textContent='В эфире · '+slot.track.title;
       cover.src='https://i.ytimg.com/vi/'+slot.track.url.split('v=')[1]+'/default.jpg';
       radioTimer=window.setTimeout(updateProgramme,(slot.track.seconds-slot.offset)*1000);
     }
     updateProgramme();
   }
   var panel=create('div','velar-radio-panel hidden');panel.id='velar-radio-panel';
   panel.appendChild(create('strong','',config.title+' · музыкальный плейлист'));
   panel.appendChild(create('p','velar-radio-note','Воспроизведение только по вашему выбору, через официальный плеер '+(config.provider==='spotify'?'Spotify':'YouTube')+'.'));
   var player=create('div','velar-radio-player');
   var open=create('button','velar-radio-start','Открыть плейлист');
   if(tracks.length){
     panel.children[0].textContent=config.title+' · эфир YouTube';
     panel.children[1].textContent='Открой плеер и нажми ▶, чтобы присоединиться к эфиру.';
     open.textContent='Открыть эфир';
   }
   if(sources.length){
     panel.children[0].textContent=config.title+' · каталог Velar Dream';
     panel.children[1].textContent=available.length?'Выберите площадку и откройте плеер. YouTube воспроизводит перемешанную очередь клипов.':'Для выбранных площадок пока нет опубликованных ссылок.';
     open.textContent='Открыть плеер';open.disabled=!available.length;
     if(available.length>1){
       var select=create('select','');select.setAttribute('aria-label','Площадка радио');
       available.forEach(function(p){var option=create('option','',names[p]+' · '+catalog[p].length);option.value=p;select.appendChild(option);});
       select.onchange=function(){selected=select.value;queue=[];cursor=0;if(radioYoutube){radioYoutube.dispose();radioYoutube=null;}empty(player);host.setAttribute('data-radio-player-open','false');open.setAttribute('aria-pressed','false');};
       panel.appendChild(select);
     }
   }
   open.type='button';open.setAttribute('aria-pressed','false');
   open.onclick=function(){
     if(hasEmbed(player)){
       if(radioYoutube){radioYoutube.dispose();radioYoutube=null;}
       empty(player);host.setAttribute('data-radio-player-open','false');open.setAttribute('aria-pressed','false');return;
     }
     var provider=config.provider,url=config.url,title=config.title,src;
     var ids=null,startSeconds=0;
     if(sources.length){
       if(!selected)return;
       if(cursor>=queue.length){queue=shuffledRadioUrls(catalog[selected]);cursor=0;}
       provider=selected;url=queue[cursor++];title=config.title+' · '+names[provider];
       if(provider==='youtube'){
         ids=queue.map(function(link){return link.split('v=')[1];});
         src=officialEmbed(queue[0],provider,'release');
         var firstIds=ids.slice(0,100);
         if(firstIds.length>1)src+='?playlist='+firstIds.slice(1).join(',');
         if(legacyIpadVideo()){showLegacyVideoModal(src,title,ids);return;}
         cursor=queue.length;
       }else if(provider==='appleMusic')src=url.replace('https://music.apple.com/','https://embed.music.apple.com/');
       else src=officialEmbed(url,provider,'release');
     }else if(tracks.length){
       var slot=radioSchedule(tracks,Math.floor(Date.now()/1000));
       url=slot.track.url;title=slot.track.title;provider='youtube';
       src=officialEmbed(url,provider,'release')+'?start='+slot.offset;
       ids=[slot.track.url.split('v=')[1]].concat(slot.remaining.map(function(t){return t.url.split('v=')[1];}));
       startSeconds=slot.offset;
       if(ids.length>1)src+='&playlist='+ids.slice(1,100).join(',');
       if(legacyIpadVideo()){showLegacyVideoModal(src,title,ids);return;}
     }else{
       src=officialEmbed(url,provider,'playlist');if(!src)return;
       if(provider==='youtube'&&legacyYouTubeModal(url,title))return;
     }
     pauseOtherEmbeds();if(radioYoutube){radioYoutube.dispose();radioYoutube=null;}
     empty(player);open.setAttribute('aria-pressed','true');
     if(provider==='youtube'){
       src+=(src.indexOf('?')>=0?'&':'?')+'enablejsapi=1&origin='+
         encodeURIComponent((window.location&&window.location.origin)||'https://velardream.com');
       if(ids&&ids.length<=100)src+='&loop=1';
     }
     var frame=create('iframe','velar-radio-iframe'+(provider==='youtube'?' velar-radio-iframe--video':''));
     frame.src=src;frame.title=title+' — '+provider;
     frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     appendOfficialFrame(player,frame,provider,false);
     if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.record('radio_open',{section:'radio',provider:provider});
     host.setAttribute('data-radio-player-open','true');
     if(provider==='youtube')radioYoutube=cueCatalog(frame,ids||[],panel.children[1],startSeconds);
     if(provider==='youtube'||(sources.length&&catalog[provider]&&catalog[provider].length>1)){
       var next=create('button','velar-radio-next','Следующая песня');next.type='button';
       next.onclick=function(){
         if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.record('radio_next',{section:'radio',provider:provider});
         if(provider==='youtube'){if(radioYoutube)radioYoutube.next();return;}
         // A Spotify/Apple embed cannot reliably report the end of a single track.
         // Replacing it only happens after a listener explicitly requests Next.
         empty(player);host.setAttribute('data-radio-player-open','false');open.onclick();
       };
       player.appendChild(next);
     }
     var link=create('a','velar-radio-external','Открыть в '+names[provider]);
     link.href=url;link.target='_blank';link.rel='noopener noreferrer';player.appendChild(link);
   };
   panel.appendChild(open);panel.appendChild(player);
   var hide=create('button','velar-radio-hide','Свернуть радио (сохранить плеер)');
   hide.type='button';
   hide.onclick=function(){
     // Collapse visually but preserve the actual official iframe and its state.
     if(toggle.getAttribute('aria-expanded')==='true')toggle.onclick();
   };
   if(!station){
     panel.appendChild(hide);
     var bubble=create('button','velar-radio-bubble-action','Свернуть в значок');
     bubble.type='button';bubble.setAttribute('aria-label','Минимизировать VELAR RADIO в значок');
     bubble.onclick=function(){
       // The official iframe remains mounted and visible in a small media card.
       // YouTube requires a visible 200×200 player; never hide or shrink it to 60px.
       panel.className=hasEmbed(player)?'velar-radio-panel velar-radio-panel--mini':'velar-radio-panel hidden';
       toggle.setAttribute('aria-expanded','false');
       host.className=host.className.replace(/\svelar-radio--chat-open/g,'')+' velar-radio--bubble';
       radioDrag.sync();
       toggle.setAttribute('aria-label','Развернуть VELAR RADIO');
     };
     panel.appendChild(bubble);
     var stationLink=create('a','velar-radio-external','Отдельный плеер · установить или поделиться');
     stationLink.href='radio/';stationLink.target='_blank';stationLink.rel='noopener';
     panel.appendChild(stationLink);
   }
   host.appendChild(panel);
   var grip=create('button','velar-radio-grip','⠿');
   grip.type='button';grip.setAttribute('aria-label','Переместить радио · перетащите или используйте стрелки');
   var radioDrag={sync:function(){},ignoreClick:function(){return false;}};
   if(!station){host.appendChild(grip);radioDrag=radioMove(host,grip,toggle);host.appendChild(stationHelp(false));}
   radioControls={toggle:toggle,start:open,player:player,host:host};
   toggle.onclick=function(){
     if(radioDrag.ignoreClick())return;
     if(host.className.indexOf('velar-radio--bubble')!==-1){
       host.className=host.className.replace(/\svelar-radio--bubble|\svelar-radio--popup-left|\svelar-radio--popup-above/g,'');
       radioDrag.sync();
       panel.className='velar-radio-panel';
       toggle.setAttribute('aria-expanded','true');
       toggle.setAttribute('aria-label','Свернуть VELAR RADIO');
       return;
     }
     var expanding=toggle.getAttribute('aria-expanded')!=='true';
     // Keep started embeds both mounted AND visibly rendered in the compact
     // panel: display:none is unsafe for media and YouTube requires a visible player.
     panel.className=expanding?'velar-radio-panel':
       (hasEmbed(player)?'velar-radio-panel velar-radio-panel--mini':'velar-radio-panel hidden');
     toggle.setAttribute('aria-expanded',expanding?'true':'false');
     radioDrag.sync();
     if(!expanding)host.className=host.className.replace(/\svelar-radio--chat-open/g,'');
   };
   if(station)toggle.onclick();
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
 // RUN-166: owner may change just the halo while an iframe is playing.
 // Never tear down a live third-party embed for a visual-only publication.
 function radioPlaybackSignature(config){
   var core={};
   Object.keys(config).forEach(function(key){if(key!=='visual')core[key]=config[key];});
   return JSON.stringify(core);
 }
 function applyRadioVisual(config){
   var host=byId('velar-radio');if(!host)return;
   var visual=config.visual||{};
   host.setAttribute('data-radio-effect',visual.mode||'heartbeat');
   host.setAttribute('data-radio-intensity',String(visual.intensity||3));
   var spread=Number(visual.spread);
   if(!(spread>=1&&spread<=100&&Math.floor(spread)===spread))spread=20;
   host.setAttribute('data-radio-spread',String(spread));
   // RUN-168: 68px approved emblem; precise radius for any integer 1–100.
   // Inline styles override legacy 75/100 CSS presets without touching
   // the iframe, the drag position or the radio's playback signature.
   var toggle=host.children&&host.children[0];
   var nodes=toggle&&toggle.children,halo=null;
   for(var i=0;nodes&&i<nodes.length;i++){
     if(nodes[i].className==='velar-radio-halo'){halo=nodes[i];break;}
   }
   if(halo&&halo.style){
     var offset=-(68*spread/100)+'px';
     halo.style.top=offset;
     halo.style.right=offset;
     halo.style.bottom=offset;
     halo.style.left=offset;
   }
 }
 var stationSettings=null,landingRadioSettings=null;
 // Keep controllers and deep links usable before an offscreen section is observed.
 var sectionObserver=null,sectionTasks=Object.create(null);
 function ensureSection(id){
   var work=sectionTasks[id];
   if(!work)return;
   delete sectionTasks[id];
   var section=byId(id);
   if(sectionObserver&&section)sectionObserver.unobserve(section);
   work();
 }
 function configureSections(level){
   if(sectionObserver)sectionObserver.disconnect();
   sectionObserver=null;sectionTasks=Object.create(null);
   if(!level||!window.IntersectionObserver)return;
   var margin=[0,(window.innerHeight||800)*2,window.innerHeight||800,150][level];
   sectionObserver=new window.IntersectionObserver(function(entries){
     entries.forEach(function(entry){if(entry.isIntersecting||entry.intersectionRatio>0)ensureSection(entry.target.id);});
   },{rootMargin:margin+'px'});
 }
 function section(id,work){
   var target=byId(id);
   if(!sectionObserver||!target||window.location.hash==='#'+id){work();return;}
   sectionTasks[id]=work;
   sectionObserver.observe(target);
 }
 function applySectionOrder(order){
   var parent=byId('explore');if(!parent||!parent.children||!parent.appendChild)return;
   var nodes=order.map(function(id){return byId(id);}).filter(function(n){return n&&n.parentNode===parent;});
   var current=Array.prototype.filter.call(parent.children,function(n){return nodes.indexOf(n)>=0;});
   if(current.length===nodes.length&&current.every(function(n,i){return n===nodes[i];}))return;
   nodes.forEach(function(n){parent.appendChild(n);});
 }
 function render(content){
   if(!window.VMM_LANDING_SCHEMA)return false;
   var value;
   try{value=window.VMM_LANDING_SCHEMA.normalize(content);}catch(e){return false;}
   if(byId('station-page')){
     var config=value.releases.radio,signature=radioPlaybackSignature(config);
     if(signature!==stationSettings){renderRadio(config);stationSettings=signature;}
     else applyRadioVisual(config);
     byId('station-status').textContent=config.enabled?'':'Радио сейчас выключено владельцем.';
     return true;
   }
   applySectionOrder(value.hero.sectionOrder);
   if(window.VELAR_STORIES)window.VELAR_STORIES.render(value);
   if(window.VelarHomeSkin)window.VelarHomeSkin.render(value);
   if(imagePolicy()&&imagePolicy().configure)imagePolicy().configure(value.hero.imageLoadingLevel);
   configureSections(imagePolicy()&&imagePolicy().getLevel?imagePolicy().getLevel():0);
   if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.configure(value.hero.analytics,
     !!(value.genres&&value.genres.assistant&&value.genres.assistant.enabled));
   var featured=window.VMM_LANDING_SCHEMA.homepagePlaylist(value);
   (function(){
     var f=featured,host=byId('featured-spotify-playlist'),frame=byId('vd-feature-iframe');
     if(host&&f){host.hidden=f.enabled===false;host.style.display=f.enabled===false?'none':'';
       assign('vd-feature-title',f.title);assign('vd-feature-description',f.description);
       var link=byId('vd-feature-link');if(link)link.href=f.url;
       var match=/\/playlist\/([A-Za-z0-9]{22})/.exec(f.url||'');
       if(frame){
         var src=f.enabled&&match?'https://open.spotify.com/embed/playlist/'+match[1]+'?theme=0':'';
         if(src&&frame.getAttribute('src')!==src)frame.setAttribute('src',src);
         else if(!src&&frame.hasAttribute('src'))frame.removeAttribute('src');
       }
     }
     var c=value.hero.crystalJourney,chapter=byId('crystal-journey');
     if(chapter&&c){chapter.hidden=c.enabled===false;chapter.style.display=c.enabled===false?'none':'';
       var kicker=chapter.querySelector('.crystal-journey-kicker'),description=chapter.querySelector('.crystal-journey-description'),button=chapter.querySelector('.crystal-journey-link');
       if(kicker)kicker.textContent=c.kicker;assign('crystal-journey-title',c.title);if(description)description.textContent=c.description;
       if(button){var first=button.firstChild;if(first&&first.nodeType===3)first.nodeValue=c.linkText+' ';}
       var delta=c.stages.length-3;
       if(c.stages.length>4)chapter.setAttribute('data-many-stages','');
       else chapter.removeAttribute('data-many-stages');
       chapter.style.setProperty('--journey-scroll-delta',(delta*25)+'vh');
       chapter.style.setProperty('--journey-min-delta',(delta*90)+'px');
       var list=chapter.querySelector('.crystal-journey-stanzas');if(list){while(list.firstChild)list.removeChild(list.firstChild);
         c.stages.forEach(function(t,i){var span=document.createElement('span');span.className='crystal-journey-stanza'+(i===0?' is-current':'');span.textContent=t;list.appendChild(span);});
         if(window.VELAR_JOURNEY_REFRESH)window.VELAR_JOURNEY_REFRESH();
       }
     }
   }());
   assign('public-hero-subtitle',value.hero.subtitle);
   assign('public-hero-intro',value.hero.intro);
   assign('artists-title',value.artists.heading);
   assign('public-artists-intro',value.artists.intro);
   assign('releases-title',value.releases.heading);
   assign('public-releases-intro',value.releases.intro);
   assign('genres-title',value.genres.heading);
   assign('public-genres-intro',value.genres.intro);
   renderSocialFooter(value.hero.socialBar);
   assign('about-title',value.about.heading);
   assign('public-about-intro',value.about.intro);
   assign('public-about-notice',value.about.notice);
   renderCatalogProgress(value.about.progress);
   if(window.VELAR_PUBLIC_SONGS&&window.VELAR_PUBLIC_SONGS.configure)
     window.VELAR_PUBLIC_SONGS.configure(
       value.albums.trackView,value.albums.entries,value.genres.songViewMode,value.releases.cards,value.hero.coverSourcePriority,value.genres.displayModes,value.genres.motion);
   section('genres',function(){
   if(window.VELAR_GENRES&&window.VELAR_GENRES.render)
     window.VELAR_GENRES.render(value.genres);
   else{
     var tags=byId('public-genres-tags');if(tags){empty(tags);
       value.genres.tags.forEach(function(tag){tags.appendChild(create('span','',tag));});
     }
   }
   });
   section('artists',function(){cards('public-artists-cards',value.artists.cards,'artists',value.artists.featuredView,value.albums,value.artists.songViewMode||value.genres.songViewMode);});
   section('albums',function(){if(window.VELAR_ALBUMS&&window.VELAR_ALBUMS.render)window.VELAR_ALBUMS.render(value.albums);});
   section('releases',function(){releaseGallery(value.releases);});
   section('playlists',function(){playlistGallery(value.releases);});
   // A new snapshot of another section must never restart an active radio iframe.
   var radioSignature=radioPlaybackSignature(value.releases.radio);
   if(radioSignature!==landingRadioSettings){
     renderRadio(value.releases.radio);landingRadioSettings=radioSignature;
   }else applyRadioVisual(value.releases.radio);
   section('universe',function(){if(window.VELAR_UNIVERSE&&window.VELAR_UNIVERSE.render)window.VELAR_UNIVERSE.render(value);});
   section('languages',function(){if(window.VELAR_LANGUAGES&&window.VELAR_LANGUAGES.render)
     window.VELAR_LANGUAGES.render(value.genres.languages);});
   section('topics',function(){if(window.VELAR_TOPICS&&window.VELAR_TOPICS.render)
     window.VELAR_TOPICS.render(value.genres.topics);});
   if(window.VELAR_ASSISTANT&&window.VELAR_ASSISTANT.render)
     window.VELAR_ASSISTANT.render(value);
   return true;
 }
 // RUN-183: optional footer row, no third-party SDK, no automatic sharing.
 // RUN-184: render only curated published aggregate snapshot, never the private catalog.
 function renderCatalogProgress(p){
   var host=byId('public-catalog-progress');if(!host)return;
   empty(host);
   if(!p||p.enabled!==true){host.hidden=true;return;}
   var title=create('h3','',p.title);title.id='public-catalog-progress-title';host.appendChild(title);
   if(p.intro)host.appendChild(create('p','catalog-progress-intro',p.intro));
   var grid=create('div','catalog-progress-grid');
   (p.metrics||[]).forEach(function(item){
     if(!item.visible)return;
     var card=create('div','catalog-progress-item');
     card.appendChild(create('strong','catalog-progress-number',String(item.value)));
     card.appendChild(create('span','catalog-progress-label',item.label));
     grid.appendChild(card);
   });
   if(grid.children.length)host.appendChild(grid);
   if(p.showBar&&p.total>0){
     var progress=create('div','catalog-progress-summary');
     var header=create('div','catalog-progress-barhead');
     header.appendChild(create('span','',p.barLabel));
     var percent=Math.round(p.completed*100/p.total);
     header.appendChild(create('strong','',percent+'%'));
     progress.appendChild(header);
     var track=create('div','catalog-progress-track');
     var fill=create('span','catalog-progress-fill');
     fill.style.width=percent+'%';track.appendChild(fill);
     track.setAttribute('role','progressbar');track.setAttribute('aria-valuemin','0');
     track.setAttribute('aria-valuemax',String(p.total));
     track.setAttribute('aria-valuenow',String(p.completed));
     track.setAttribute('aria-label',p.barLabel);
     progress.appendChild(track);
     progress.appendChild(create('p','catalog-progress-intro',p.completed+' из '+p.total+' ссылок добавлено'));
     host.appendChild(progress);
   }
   var c=p.coverage;
   function coverageBar(label,done,total,kind,detail){
     if(!total)return;
     var block=create('div','catalog-progress-summary catalog-coverage-summary catalog-coverage-'+kind);
     var head=create('div','catalog-progress-barhead'),percent=Math.round(done*100/total);
     head.appendChild(create('span','',label));head.appendChild(create('strong','',percent+'%'));block.appendChild(head);
     var track=create('div','catalog-progress-track'),fill=create('span','catalog-progress-fill');fill.style.width=(done*100/total)+'%';track.appendChild(fill);
     track.setAttribute('role','progressbar');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax',String(total));track.setAttribute('aria-valuenow',String(done));track.setAttribute('aria-label',label);
     block.appendChild(track);block.appendChild(create('p','catalog-progress-intro',done+' из '+total+' '+detail));host.appendChild(block);
   }
   if(c){
     if(c.showTexts)coverageBar('Заполненность текстов песен',c.textCompleted,c.textTotal,'lyrics','песен с сохранённым текстом (без инструментальных)');
     if(c.showStories)coverageBar('Краткие истории композиций',c.storiesCompleted,c.storiesTotal,'stories','публичных композиций с описанием');
     if(c.updatedAt&&((c.showTexts&&c.textTotal)||(c.showStories&&c.storiesTotal)))host.appendChild(create('p','catalog-progress-date','Тексты и истории: данные на '+c.updatedAt));
   }
   if(p.note)host.appendChild(create('p','catalog-progress-note',p.note));
   if(p.updatedAt)host.appendChild(create('p','catalog-progress-date','Данные на '+p.updatedAt));
   host.hidden=false;
 }
 function renderSocialFooter(config){
   if(!config||config.enabled!==true){
     var existing=byId('public-social-footer');if(existing)existing.style.display='none';
     return;
   }
   var footer=document.querySelector('.site-footer');if(!footer)return;
   var host=byId('public-social-footer');
   if(!host){
     host=document.createElement('nav');host.id='public-social-footer';
     host.setAttribute('aria-label','Социальные сети VELARDREAM');
     host.style.cssText='display:none;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;padding:16px 8px';
     footer.insertBefore(host,footer.firstChild);
   }
   empty(host);
   if(!config||config.enabled!==true){host.style.display='none';return;}
   var names={facebook:'Facebook',vk:'ВКонтакте',instagram:'Instagram',
     tiktok:'TikTok',linkedin:'LinkedIn',youtube:'YouTube',telegram:'Telegram',
     spotify:'Spotify',apple:'Apple Music',soundcloud:'SoundCloud',
     bandcamp:'Bandcamp',yandex:'Яндекс Музыка',deezer:'Deezer',website:'Сайт'};
   (config.links||[]).forEach(function(item){
     if(!item||!item.visible||!item.url||!names[item.platform])return;
     var link=document.createElement('a');link.href=item.url;link.target='_blank';
     link.rel='noopener noreferrer';link.textContent=names[item.platform];
     link.style.cssText='display:inline-flex;min-height:40px;align-items:center;padding:7px 12px;border:1px solid rgba(226,190,117,.45);border-radius:24px;color:#f5d18c;text-decoration:none';
     host.appendChild(link);
   });
   if(config.shareEnabled===true){
     var share=document.createElement('button');share.type='button';
     share.textContent='↗ Поделиться сайтом';
     share.setAttribute('aria-label','Поделиться ссылкой на VELARDREAM');
     share.style.cssText='min-height:40px;padding:7px 14px;border:1px solid #d9b875;border-radius:24px;background:transparent;color:#f5d18c;cursor:pointer;font:inherit';
     share.onclick=function(){
       var address='https://velardream.com/';
       if(navigator.share){navigator.share({title:'VELARDREAM RECORDS',url:address}).catch(function(){});return;}
       if(navigator.clipboard&&navigator.clipboard.writeText){
         navigator.clipboard.writeText(address).then(function(){share.textContent='✓ Ссылка скопирована';})
           .catch(function(){window.prompt('Скопируй ссылку:',address);});
       }else window.prompt('Скопируй ссылку:',address);
     };
     host.appendChild(share);
   }
   host.style.display=host.children.length?'flex':'none';
 }
 function start(){
   if(byId('artist-main'))return; // The profile owns its public snapshot subscription.
   var help=byId("standalone-help");if(help)help.appendChild(stationHelp(true));
   if(!window.VMM_LANDING_SCHEMA)return;
   // Provide the default player when the first public snapshot is unavailable.
   var frame=byId('vd-feature-iframe'),defaultLink=byId('vd-feature-link');
   if(frame&&defaultLink&&!frame.getAttribute('src')){
     var defaultEmbed=officialEmbed(defaultLink.href,'spotify','playlist');
     if(defaultEmbed)frame.setAttribute('src',defaultEmbed+'?theme=0');
   }
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
 window.VMM_PUBLIC_LANDING={render:render,ensureSection:ensureSection,stopExternalPlayers:pauseOtherEmbeds,
   openYouTubeModal:openYouTubeModal,openRadioFromChat:openRadioFromChat}; // public UI only, never writes
}());
