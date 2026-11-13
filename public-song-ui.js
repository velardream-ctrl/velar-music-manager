/* RUN-090 — shared inline player for language and theme song rows.
   One composition, up to two official sources; no autoplay, no Firestore/API.
   Designed for ES5 / Safari 12. */
(function(){
 'use strict';
 function el(tag,cls,text){
   var node=document.createElement(tag);
   if(cls)node.className=cls;
   if(typeof text==='string')node.textContent=text;
   return node;
 }
 function clear(node){while(node&&node.firstChild)node.removeChild(node.firstChild);}
 function compareSong(a,b){
   // Russian/Latin title order, then artist; no mutation of Firestore records.
   var x=String(a&&a.title||'').trim(),y=String(b&&b.title||'').trim();
   var title=x.localeCompare(y,'ru',{numeric:true,sensitivity:'base'});
   return title||String(a&&a.artist||'').trim().localeCompare(
     String(b&&b.artist||'').trim(),'ru',{numeric:true,sensitivity:'base'});
 }

 function approved(track){
   var api=window.VMM_LANDING_SCHEMA,found=[];
   if(!api||!api.songUrl)return found;
   [['provider','url'],['alternateProvider','alternateUrl']].forEach(function(keys){
     var provider=track[keys[0]],url=api.songUrl(track[keys[1]],provider);
     if(url&&found.every(function(item){return item.provider!==provider;}))
       found.push({provider:provider,url:url});
   });
   return found;
 }
 function embed(src){
   if(src.provider==='spotify')return 'https://open.spotify.com/embed/track/'+src.url.split('/').pop();
   if(src.provider==='youtube')return 'https://www.youtube-nocookie.com/embed/'+src.url.split('v=')[1];
   return '';
 }
 var activeMount=null,defaultView='rows',coverMap={},globalMode='standard';
 var artworkCache={};
 // RUN-106: Spotify's public oEmbed thumbnail, fetched only for the visible
 // carousel cards and only when no owner-curated album image exists.
 // Network failure/CORS must never block the song title or player.
 function youtubeArtwork(track){
   var sources=approved(track);
   for(var i=0;i<sources.length;i++)if(sources[i].provider==='youtube'){
     var id=sources[i].url.split('v=')[1];
     if(/^[A-Za-z0-9_-]{11}$/.test(id))
       return 'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
   }
   return '';
 }
 function requestArtwork(track,callback){
   // YouTube preview is a reliable immediate fallback. The selected playback
   // provider does not create a second card or a second cover.
   var youtube=youtubeArtwork(track);
   if(youtube)callback(youtube);
   var spotify=approved(track).filter(function(item){return item.provider==='spotify';})[0];
   if(!spotify||typeof window.fetch!=='function')return;
   var key=spotify.url,record=artworkCache[key];
   if(record){
     if(record.url)callback(record.url);
     else if(record.pending)record.callbacks.push(callback);
     return;
   }
   record={url:'',pending:true,callbacks:[callback]};
   artworkCache[key]=record;
   window.fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(key))
     .then(function(response){if(!response.ok)throw new Error('Artwork unavailable');return response.json();})
     .then(function(json){
       var url=String(json&&json.thumbnail_url||'');
       if(!/^https:\/\/(?:i\.scdn\.co|image-cdn-ak\.spotifycdn\.com)\/image\/[a-z0-9]+$/i.test(url))
         throw new Error('Invalid artwork host');
       record.url=url;record.pending=false;
       record.callbacks.forEach(function(fn){fn(url);});record.callbacks=[];
     }).catch(function(){record.pending=false;record.callbacks=[];});
 }
 function configure(view,albums,mode){
   defaultView=['rows','covers','tiles'].indexOf(view)>=0?view:'rows';
   globalMode=mode==='carousel'?'carousel':'standard';
   coverMap={};
   (albums||[]).filter(function(a){return a.visible;}).forEach(function(album){
     var picture=album.imageData||album.imageUrl||'';
     if(!picture)return;
     (album.tracks||[]).forEach(function(t){
       if(t.url&&!coverMap[t.url])coverMap[t.url]=picture;
       if(t.alternateUrl&&!coverMap[t.alternateUrl])coverMap[t.alternateUrl]=picture;
     });
   });
 }
 function mount(list,tracks,opts){
   opts=opts||{};
   // Alphabetize only the view. All published track order and links stay intact.
   tracks=(tracks||[]).map(function(track,index){return {track:track,index:index};});
   if(!opts.keepOrder)tracks.sort(function(a,b){return compareSong(a.track,b.track)||a.index-b.index;});
   tracks=tracks.map(function(row){return row.track;});
   var classes=opts.prefix==='language'?'language':opts.prefix==='album'?'album':'topic';
   var view=globalMode==='carousel'?'carousel':(opts.view||defaultView);
   if(['rows','covers','tiles','carousel'].indexOf(view)<0)view='rows';
   if(view==='tiles')list.className+=' public-song-list--tiles';
   var isCarousel=view==='carousel';
   var amount=opts.batch||12,index=-1,source='',slots=[],buttons=[],titles=[],entries=[],
     count=0,more=null,instance=null,container=list,rail=null,
     position=0,previous=null,following=null,counter=null,coverRequests={};
   clear(list);
   function loadNear(i){
     if(!isCarousel)return;
     for(var j=Math.max(0,i-1);j<=Math.min(count-1,i+2);j++){
       if(coverRequests[j]){var fn=coverRequests[j];delete coverRequests[j];fn();}
     }
   }
   function updateCarousel(){
     if(!isCarousel)return;
     if(counter)counter.textContent=(tracks.length?position+1:0)+' / '+tracks.length;
     if(previous)previous.disabled=position===0;
     if(following)following.disabled=position>=tracks.length-1;
     loadNear(position);
   }
   function showAt(n){
     if(!isCarousel)return;
     if(n>=count&&count<tracks.length)appendBatch();
     position=Math.max(0,Math.min(count-1,n));
     var item=entries[position];
     if(item&&rail){
       var left=Number(item.offsetLeft)||0;
       if(rail.scrollTo){try{rail.scrollTo({left:left,behavior:'smooth'});}
         catch(e){rail.scrollLeft=left;}}
       else rail.scrollLeft=left;
     }
     updateCarousel();
   }
   if(isCarousel){
     list.className+=' public-song-carousel';
     var nav=el('div','public-song-carousel-controls');
     previous=el('button','public-song-carousel-arrow','‹');
     previous.type='button';previous.setAttribute('aria-label','Предыдущая песня');
     previous.onclick=function(){showAt(position-1);};
     counter=el('span','public-song-carousel-count');
     counter.setAttribute('aria-live','polite');
     following=el('button','public-song-carousel-arrow','›');
     following.type='button';following.setAttribute('aria-label','Следующая песня');
     following.onclick=function(){showAt(position+1);};
     nav.appendChild(previous);nav.appendChild(counter);nav.appendChild(following);
     rail=el('div','public-song-carousel-track');
     rail.setAttribute('role','region');
     rail.setAttribute('aria-label','Песни: листайте влево или вправо');
     rail.onscroll=function(){
       if(!rail.clientWidth||!rail.scrollWidth)return;
       var nearest=position,dist=Infinity;
       for(var j=0;j<count;j++)if(entries[j]){
         var delta=Math.abs((entries[j].offsetLeft||0)-rail.scrollLeft);
         if(delta<dist){dist=delta;nearest=j;}
       }
       if(nearest!==position){position=nearest;updateCarousel();}
     };
     list.appendChild(nav);list.appendChild(rail);container=rail;
   }
   function clearActive(){
     if(index>=0&&slots[index])clear(slots[index]);
     buttons.forEach(function(pair){pair.forEach(function(button){
       button.setAttribute('aria-pressed','false');
     });});
     titles.forEach(function(button){if(button)button.setAttribute('aria-pressed','false');});
     entries.forEach(function(entry){if(entry)entry.className=entry.className.replace(/ is-playing/g,'');});
     index=-1;source='';
     if(activeMount===instance)activeMount=null;
   }
   function open(i,src){
     var link=embed(src);
     if(!link||!slots[i])return false;
     if(coverRequests[i]){var request=coverRequests[i];delete coverRequests[i];request();}
     if(activeMount&&activeMount!==instance)activeMount.close();
     // One official external player only, shared with other public sections.
     if(window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.stopExternalPlayers)
       window.VMM_PUBLIC_LANDING.stopExternalPlayers();
     clearActive();
     index=i;source=src.provider;activeMount=instance;
     if(entries[i])entries[i].className+=' is-playing';
     if(isCarousel)showAt(i);
     var host=slots[i],frame=el('iframe','cms-release-iframe '+classes+'-song-iframe'+
       (src.provider==='youtube'?' cms-release-iframe--video':''));
     frame.title=tracks[i].title+' — официальный плеер '+(src.provider==='spotify'?'Spotify':'YouTube');
     frame.src=link;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     if(src.provider==='spotify'){
       var viewport=el('div','spotify-embed-viewport');
       viewport.appendChild(frame);host.appendChild(viewport);
     }else host.appendChild(frame);
     var external=el('a','cms-card-link','Открыть в '+(src.provider==='spotify'?'Spotify':'YouTube'));
     external.href=src.url;external.rel='noopener noreferrer';external.target='_blank';
     host.appendChild(external);
     var close=el('button','cms-release-close','Закрыть плеер');
     close.type='button';close.onclick=function(){clearActive();};
     host.appendChild(close);
     buttons[i].forEach(function(button){
       button.setAttribute('aria-pressed',button.getAttribute('data-provider')===src.provider?'true':'false');
     });
     if(titles[i])titles[i].setAttribute('aria-pressed','true');
     return true;
   }
   // Explicit repeat click toggles off; picking the other service switches players.
   // The chat deep link calls open() directly so it can always OPEN the requested song.
   function toggle(i,src,fromTitle){
     var slot=slots[i],first=slot&&slot.firstChild,
       playing=!!(first&&(first.tagName==='iframe'||
         first.className==='spotify-embed-viewport'&&
         first.firstChild&&first.firstChild.tagName==='iframe'));
     if(index===i&&playing&&(fromTitle||source===src.provider)){
       clearActive(); // Remove the iframe, not only hide it: external audio stops.
       return true;
     }
     return open(i,src);
   }
   function addRow(i){
     var track=tracks[i],sources=approved(track);
     if(!sources.length)return;
     var item=el('div','public-song-entry '+classes+'-song-entry'+
       (view==='covers'?' public-song-entry--covers':view==='tiles'?' public-song-entry--tiles':
         isCarousel?' public-song-entry--carousel':''));
     entries[i]=item;
     var title=el('div','public-song-label');
     title.appendChild(el('span','public-song-index',('0'+(i+1)).slice(-2)));
     // One artwork box per song, for Spotify OR YouTube. Keep its dimensions
     // when the official player opens; never append a second media card.
     var art=opts.cover||coverMap[track.url]||coverMap[track.alternateUrl]||'';
     var holder=isCarousel?el('div','public-song-artwork'):view==='rows'?
       el('span','public-song-row-artwork'):title;
     var currentCover=art||'',fallbackArtwork=youtubeArtwork(track);
     function putCover(url){
       if(!url||currentCover===url&&holder.firstChild&&holder.firstChild.tagName==='img')return;
       var thumb=el('img','public-song-thumbnail');
       thumb.alt='Обложка: '+track.title;thumb.loading='lazy';
       thumb.decoding='async';thumb.referrerPolicy='no-referrer';
       thumb.onerror=function(){
         if(fallbackArtwork&&url!==fallbackArtwork){putCover(fallbackArtwork);return;}
         clear(holder);
         var music=el('span','public-song-thumbnail public-song-thumbnail--empty','♫');
         music.setAttribute('aria-hidden','true');holder.appendChild(music);
       };
       thumb.src=url;currentCover=url;clear(holder);holder.appendChild(thumb);
     }
     if(art)putCover(art);
     else {
       var placeholder=el('span','public-song-thumbnail public-song-thumbnail--empty','♫');
       placeholder.setAttribute('aria-hidden','true');holder.appendChild(placeholder);
       coverRequests[i]=function(){requestArtwork(track,putCover);};
     }
     if(isCarousel)title.appendChild(holder);
     var copy=el('button','public-song-copy public-song-title-button');
     copy.type='button';copy.setAttribute('aria-label','Открыть или закрыть плеер: '+track.title);
     copy.setAttribute('aria-pressed','false');titles[i]=copy;
     copy.onclick=function(){toggle(i,sources[0],true);};
     copy.appendChild(el('strong','',track.title));
     copy.appendChild(el('small','',(track.artist?track.artist+' · ':'')+
       (sources[0].provider==='spotify'?'Spotify':'YouTube')));
     title.appendChild(copy);
     if(view==='rows')title.appendChild(holder); // CSS orders image before song name.
     item.appendChild(title);
     var controls=el('div','public-song-platforms');
     buttons[i]=[];
     sources.forEach(function(src,j){
       // Preserve the original compact round Play glyph instead of a
       // wide emoji/text button. The optional second service is a small pill.
       var choice=el('button','public-song-source'+(j===0?' is-primary':''),
         j===0?'':(src.provider==='spotify'?'Spotify':'YouTube'));
       choice.type='button';choice.setAttribute('aria-pressed','false');
       choice.setAttribute('data-provider',src.provider);
       choice.setAttribute('aria-label','Слушать '+track.title+' в '+(src.provider==='spotify'?'Spotify':'YouTube'));
       choice.onclick=function(){toggle(i,src,false);};
       controls.appendChild(choice);buttons[i].push(choice);
     });
     item.appendChild(controls);
     var player=el('div','public-song-inline '+classes+'-inline-player');
     slots[i]=player;item.appendChild(player);
     container.appendChild(item);
     // The clicked song must have artwork even when it is not near the
     // beginning of a long list. Lazy lookup is still limited to one song.
     copy.onfocus=function(){if(coverRequests[i]){var fn=coverRequests[i];delete coverRequests[i];fn();}};
   }
   function appendBatch(){
     if(more&&more.parentNode===container)container.removeChild(more);
     var next=Math.min(tracks.length,count+amount);
     for(var i=count;i<next;i++)addRow(i);
     count=next;
     if(!isCarousel){
       // Avoid a bulk request for hundreds of songs at once. The first few
       // rows of each batch are warmed, the rest load when focused or played.
       for(var k=Math.max(0,count-amount);k<Math.min(count,Math.max(0,count-amount)+4);k++){
         if(coverRequests[k]){var request=coverRequests[k];delete coverRequests[k];request();}
       }
     }
     if(count<tracks.length){
       more=el('button',classes==='language'?'language-more':'topic-show-more',
         'Показать ещё ('+(tracks.length-count)+')');
       more.type='button';more.onclick=appendBatch;container.appendChild(more);
     }else more=null;
     updateCarousel();
   }
   function openByUrl(url){
     for(var i=0;i<tracks.length;i++){
       var sources=approved(tracks[i]);
       for(var j=0;j<sources.length;j++)if(sources[j].url===url){
         while(i>=count)appendBatch(); // Preserve mounted players when growing.
         if(isCarousel)showAt(i);
         return open(i,sources[j]);
       }
     }
     return false;
   }
   instance={openByUrl:openByUrl,close:clearActive};
   appendBatch();
   updateCarousel();
   return instance;
 }
 window.VELAR_PUBLIC_SONGS={mount:mount,approved:approved,configure:configure,
   requestArtwork:requestArtwork};
}());
