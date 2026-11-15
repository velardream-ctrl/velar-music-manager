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
   [['provider','url'],['alternateProvider','alternateUrl'],['thirdProvider','thirdUrl']].forEach(function(keys){
     var provider=track[keys[0]],url=api.songUrl(track[keys[1]],provider);
     if(url&&found.every(function(item){return item.provider!==provider;}))
       found.push({provider:provider,url:url});
   });
   return found;
 }
 function platformName(p){return p==='spotify'?'Spotify':p==='appleMusic'?'Apple Music':'YouTube';}
 function embed(src){
   if(src.provider==='spotify')return 'https://open.spotify.com/embed/track/'+src.url.split('/').pop();
   if(src.provider==='youtube')return 'https://www.youtube-nocookie.com/embed/'+src.url.split('v=')[1];
   if(src.provider==='appleMusic')return src.url.replace('https://music.apple.com/','https://embed.music.apple.com/');
   return '';
 }
 var activeMount=null,defaultView='rows',coverMap={},globalMode='standard',coverPriority='spotify-first';
 var artworkCache={};
 // RUN-121: every rendered song card requests its cover immediately.
 // Owner-approved artwork still takes precedence over official oEmbed.
 // Network failure/CORS must never block song titles or players.
 function youtubeArtwork(track){
   var sources=approved(track);
   for(var i=0;i<sources.length;i++)if(sources[i].provider==='youtube'){
     var id=sources[i].url.split('v=')[1];
     if(/^[A-Za-z0-9_-]{11}$/.test(id))
       return 'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
   }
   return '';
 }
 function requestArtwork(track,callback,only){
   // RUN-132: artwork is Spotify-only. YouTube/Apple Music remain playable
   // sources, but never provide an image or replace a failed Spotify cover.
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
   var finished=false,timer=null;
   function settle(url){
     if(finished)return;
     finished=true;
     if(timer!==null)window.clearTimeout(timer);
     record.url=url;record.pending=false;
     var listeners=record.callbacks.slice();record.callbacks=[];
     listeners.forEach(function(fn){if(url)fn(url);});
     if(!url&&artworkCache[key]===record)delete artworkCache[key];
   }
   if(typeof window.setTimeout==='function')
     timer=window.setTimeout(function(){settle('');},3000);
   try{
     window.fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(key))
       .then(function(response){if(!response.ok)throw new Error('Artwork unavailable');return response.json();})
       .then(function(json){
         var url=String(json&&json.thumbnail_url||'');
         if(!/^https:\\/\\/(?:i\\.scdn\\.co|image-cdn-ak\\.spotifycdn\\.com)\\/image\\/[a-z0-9]+$/i.test(url))
           throw new Error('Invalid artwork host');
         settle(url);
       }).catch(function(){settle('');});
   }catch(e){settle('');}
 }
 function configure(view,albums,mode,releases,priority){
   coverPriority=priority==='youtube-first'?'youtube-first':'spotify-first';
   defaultView=['rows','covers','tiles'].indexOf(view)>=0?view:'rows';
   globalMode=mode==='carousel'?'carousel':'standard';
   coverMap={};
   var api=window.VMM_LANDING_SCHEMA;
   function remember(verifiedUrl,picture){
     if(!picture||!verifiedUrl||!api||!api.songUrl)return;
     // Match a published recording by its exact official track/video URL.
     // Never guess by a similar title or load the private studio catalog.
     var url=api.songUrl(verifiedUrl,'spotify')||api.songUrl(verifiedUrl,'youtube')||api.songUrl(verifiedUrl,'appleMusic');
     if(url&&!coverMap[url])coverMap[url]=picture;
   }
   (albums||[]).filter(function(a){return a.visible;}).forEach(function(album){
     var picture=album.imageData||album.imageUrl||'';
     if(!picture)return;
     (album.tracks||[]).forEach(function(t){
       remember(t.url,picture);
       remember(t.alternateUrl,picture);
       remember(t.thirdUrl,picture);
     });
   });
   // RUN-117: released singles can already have approved cover art even
   // before the artist publishes an album collecting those singles.
   (releases||[]).filter(function(r){return r.visible;}).forEach(function(r){
     var picture=r.imageData||r.imageUrl||'';
     if(!picture)return;
     remember(r.mediaUrl,picture);
     remember(r.url,picture);
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
     position=0,previous=null,following=null,counter=null;
   clear(list);
   function updateCarousel(){
     if(!isCarousel)return;
     if(counter)counter.textContent=(tracks.length?position+1:0)+' / '+tracks.length;
     if(previous)previous.disabled=position===0;
     if(following)following.disabled=position>=tracks.length-1;
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
     frame.title=tracks[i].title+' — официальный плеер '+platformName(src.provider);
     frame.src=link;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     if(src.provider==='spotify'){
       var viewport=el('div','spotify-embed-viewport');
       viewport.appendChild(frame);host.appendChild(viewport);
     }else host.appendChild(frame);
     var external=el('a','cms-card-link','Открыть в '+platformName(src.provider));
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
     var art=''; // Spotify artwork only; published album/release and video art do not override it.
     var holder=isCarousel?el('div','public-song-artwork'):view==='rows'?
       el('span','public-song-row-artwork'):title;
     var currentCover=art||'',failedCovers={};
     function clearArtwork(){
       if(holder!==title){clear(holder);return;}
       // In row/tiles/covers modes the title also owns the song number and
       // the click-to-play button. Never erase those when artwork is refreshed.
       var children=title.children;
       for(var k=children.length-1;k>=0;k--){
         var child=children[k],cls=child.className||'';
         if((' '+cls+' ').indexOf(' public-song-thumbnail ')>=0||
            cls.indexOf('public-song-thumbnail--empty')>=0)
           title.removeChild(child);
       }
     }
     function note(){
       var music=el('span','public-song-thumbnail public-song-thumbnail--empty','♫');
       music.setAttribute('aria-hidden','true');
       return music;
     }
     function putCover(url){
       if(!url||failedCovers[url]||
         currentCover===url&&holder.firstChild&&holder.firstChild.tagName==='img')return;
       var thumb=el('img','public-song-thumbnail');
       thumb.alt='Обложка: '+track.title;
       // Keep RUN-123 loading levels unchanged; show a local note when the
       // connection stalls instead of an unpainted image rectangle.
       if(window.VELAR_IMAGE_LOADING&&window.VELAR_IMAGE_LOADING.apply)
         window.VELAR_IMAGE_LOADING.apply(thumb,i);
       else thumb.loading='eager';
       if(isCarousel&&i===0)thumb.setAttribute('fetchpriority','high');
       thumb.decoding='async';thumb.referrerPolicy='no-referrer';
       if(isCarousel)thumb.style.visibility='hidden';
       thumb.onerror=function(){
         if(currentCover!==url)return;
         failedCovers[url]=true;
         clearArtwork();
         holder.appendChild(note());
         // Keep the local note; never fall back to YouTube or Apple artwork.
       };
       thumb.onload=function(){
         if(currentCover!==url)return;
         thumb.onerror=null;
         if(isCarousel){
           thumb.style.visibility='visible';
           for(var j=holder.children.length-1;j>=0;j--){
             var child=holder.children[j];
             if(child!==thumb&&String(child.className||'').indexOf('public-song-thumbnail--empty')>=0)
               holder.removeChild(child);
           }
         }
       };
       currentCover=url;clearArtwork();
       holder.appendChild(thumb);
       if(isCarousel)holder.appendChild(note());
       thumb.src=url; // The fallback is already attached before network starts.
     }
     if(art)putCover(art);
     else {
       var placeholder=el('span','public-song-thumbnail public-song-thumbnail--empty','♫');
       placeholder.setAttribute('aria-hidden','true');holder.appendChild(placeholder);
       // External metadata is scheduled after the card is appended.
     }
     if(isCarousel)title.appendChild(holder);
     var copy=el('button','public-song-copy public-song-title-button');
     copy.type='button';copy.setAttribute('aria-label','Открыть или закрыть плеер: '+track.title);
     copy.setAttribute('aria-pressed','false');titles[i]=copy;
     copy.onclick=function(){toggle(i,sources[0],true);};
     copy.appendChild(el('strong','',track.title));
     copy.appendChild(el('small','',(track.artist?track.artist+' · ':'')+
       platformName(sources[0].provider)));
     title.appendChild(copy);
     if(view==='rows')title.appendChild(holder); // CSS orders image before song name.
     item.appendChild(title);
     var controls=el('div','public-song-platforms');
     buttons[i]=[];
     sources.forEach(function(src,j){
       // Preserve the original compact round Play glyph instead of a
       // wide emoji/text button. The optional second service is a small pill.
       var choice=el('button','public-song-source'+(j===0?' is-primary':'')+' public-song-source--'+src.provider,
         src.provider==='spotify'?'♫':src.provider==='youtube'?'▶':'♪');
       choice.type='button';choice.setAttribute('aria-pressed','false');
       choice.setAttribute('data-provider',src.provider);
       choice.setAttribute('aria-label','Слушать '+track.title+' в '+platformName(src.provider));
       choice.onclick=function(){toggle(i,src,false);};
       controls.appendChild(choice);buttons[i].push(choice);
     });
     item.appendChild(controls);
     var player=el('div','public-song-inline '+classes+'-inline-player');
     slots[i]=player;item.appendChild(player);
     container.appendChild(item);
     if(!art){
       var images=window.VELAR_IMAGE_LOADING;
       if(images&&images.near)
         images.near(item,function(){requestArtwork(track,putCover);},i);
       else requestArtwork(track,putCover);
     }
     // Moderate/strong modes delay oEmbed until near the viewport, not
     // until user focus or a playback click. Legacy mode remains eager.
   }
   function appendBatch(){
     if(more&&more.parentNode===container)container.removeChild(more);
     var next=Math.min(tracks.length,count+amount);
     for(var i=count;i<next;i++)addRow(i);
     count=next;
     // Every rendered card in this batch has already requested its image.
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
