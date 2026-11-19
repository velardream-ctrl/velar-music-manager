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
 var activeMount=null,defaultView='rows',coverMap={},globalMode='standard',coverPriority='spotify-first',sectionModes={};
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
   if(!spotify)return;
   // Locally cached official Spotify thumbnail, matched by canonical track URL.
   if(spotify.url==='https://open.spotify.com/track/3u4nP80fuKrYdfpM7AipMK'){
     callback('assets/spotify-3u4nP80fuKrYdfpM7AipMK.jpg');
     return;
   }
   if(typeof window.fetch!=='function')return;
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
     timer=window.setTimeout(function(){settle('');},8000);
   try{
     window.fetch('https://open.spotify.com/oembed?url='+encodeURIComponent(key))
       .then(function(response){if(!response.ok)throw new Error('Artwork unavailable');return response.json();})
       .then(function(json){
         var url=String(json&&json.thumbnail_url||'');
         if(!/^https:\/\/(?:i\.scdn\.co|image-cdn-[a-z]{2}\.spotifycdn\.com)\/image\/[a-z0-9]+$/i.test(url))
           throw new Error('Invalid artwork host');
         settle(url);
       }).catch(function(){settle('');});
   }catch(e){settle('');}
 }
 var motions={},navigation=0,mounts=[],cleanupObserver=null;
 function observeMount(element,dispose){
   if(!window.MutationObserver)return;
   mounts.push({element:element,dispose:dispose});
   if(cleanupObserver)return;
   cleanupObserver=new window.MutationObserver(function(){
     mounts=mounts.filter(function(row){
       if(document.documentElement.contains(row.element))return true;
       row.dispose();return false;
     });
     if(!mounts.length){cleanupObserver.disconnect();cleanupObserver=null;}
   });
   cleanupObserver.observe(document.body,{childList:true,subtree:true});
 }
 function configure(view,albums,mode,releases,priority,modes,motion){
   motions=motion||{};
   sectionModes=modes&&typeof modes==='object'?modes:{};
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
   var displayKey=opts.prefix==='language'?'languages':opts.prefix==='topic'?'topics':
     opts.prefix==='genre'?'genres':opts.prefix==='album'?'albums':opts.prefix;
   var configured=sectionModes[displayKey]||
     (globalMode==='carousel'?'carousel':(opts.view||defaultView));
   var view=opts.forceView||(opts.prefix==='artist'?(opts.view||'rows'):configured);
   if(['compact','rows','covers','tiles','carousel','auto'].indexOf(view)<0)view='rows';
   var motion=opts.motion||motions[displayKey]||{};
   if(view==='compact'&&!opts._compactInternal){
     clear(list);list.className+=' public-song-compact';
     var toolbar=el('div','public-song-compact-toolbar');
     var search=el('input','public-song-compact-search');
     search.type='search';search.placeholder='Найти песню или исполнителя…';
     search.setAttribute('aria-label','Поиск песни по названию или исполнителю');
     var state=el('span','public-song-compact-status');
     toolbar.appendChild(search);toolbar.appendChild(state);
     var rows=el('div','public-song-compact-results');
     var pages=el('div','public-song-compact-pages');
     var prev=el('button','public-song-page-button','← Назад');
     var next=el('button','public-song-page-button','Вперёд →');
     prev.type='button';next.type='button';
     var progress=el('span','public-song-compact-progress');
     pages.appendChild(prev);pages.appendChild(progress);pages.appendChild(next);
     list.appendChild(toolbar);list.appendChild(rows);list.appendChild(pages);
     var currentPage=0,current=null,filtered=[],size=25;
     function redraw(){
       if(current)current.close();
       clear(rows);filtered=tracks.filter(function(track){
         var needle=String(search.value||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
         return !needle||(String(track.title||'')+' '+String(track.artist||'')).toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(needle)>=0;
       });
       var totalPages=Math.max(1,Math.ceil(filtered.length/size));
       currentPage=Math.min(Math.max(0,currentPage),totalPages-1);
       var first=currentPage*size;
       state.textContent='Найдено: '+filtered.length+' из '+tracks.length;
       progress.textContent=filtered.length?(first+1)+'–'+Math.min(first+size,filtered.length):'0';
       progress.textContent+=' / '+filtered.length;
       prev.disabled=currentPage===0;next.disabled=currentPage>=totalPages-1;
       pages.hidden=filtered.length<=size;
       var selected=filtered.slice(first,first+size);
       if(selected.length)current=mount(rows,selected,{
         prefix:opts.prefix,forceView:'rows',view:'rows',batch:25,keepOrder:true,_compactInternal:true
       });
       else {current=null;rows.appendChild(el('p','topic-empty','Песни не найдены. Измени запрос.'));}
     }
     prev.onclick=function(){currentPage--;redraw();};
     next.onclick=function(){currentPage++;redraw();};
     search.oninput=function(){currentPage=0;redraw();};
     var outer={
       close:function(){if(current)current.close();},
       openByUrl:function(url,play){
         for(var i=0;i<tracks.length;i++){
           if(approved(tracks[i]).some(function(source){return source.url===url;})){
             search.value='';currentPage=Math.floor(i/size);redraw();
             return current&&current.openByUrl(url,play);
           }
         }
         return false;
       }
     };
     list.velarSongs=outer;redraw();return outer;
   }
   if(view==='tiles')list.className+=' public-song-list--tiles';
   var isCarousel=view==='carousel'||view==='auto',firstRendered=0,cycling=false;
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
   function center(item){
     if(!item.getBoundingClientRect)return Number(item.offsetLeft)||0;
     return rail.scrollLeft+item.getBoundingClientRect().left-rail.getBoundingClientRect().left+(item.offsetWidth-rail.clientWidth)/2;
   }
   function showAt(n){
     if(!isCarousel)return;
     if(n<0||n>=tracks.length)return;
     if(!entries[n]&&(cycling||n<firstRendered||n>=count+amount))windowAt(n);
     if(!entries[n]&&n>=count&&count<tracks.length)appendBatch();
     position=Math.max(0,Math.min(tracks.length-1,n));
     var item=entries[position];
     if(item&&rail){
       var left=center(item);
       if(rail.scrollTo){try{rail.scrollTo({left:left,behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
         catch(e){rail.scrollLeft=left;}}
       else rail.scrollLeft=left;
     }
     updateCarousel();
   }
   if(isCarousel){
     list.className+=' public-song-carousel';
     var nav=el('div','public-song-carousel-controls');
     previous=el('button','public-song-carousel-arrow','‹');
     previous.type='button';previous.setAttribute('aria-label',opts.renderCard?'Предыдущий клип':'Предыдущая песня');
     previous.onclick=function(){manualUntil=Date.now()+1400;showAt(position-1);};
     counter=el('span','public-song-carousel-count');
     counter.setAttribute('aria-live','polite');
     following=el('button','public-song-carousel-arrow','›');
     following.type='button';following.setAttribute('aria-label',opts.renderCard?'Следующий клип':'Следующая песня');
     following.onclick=function(){manualUntil=Date.now()+1400;showAt(position+1);};
     nav.appendChild(previous);nav.appendChild(counter);nav.appendChild(following);
     rail=el('div','public-song-carousel-track');
     rail.setAttribute('role','region');
     rail.setAttribute('aria-label',opts.renderCard?'Видеоклипы':'Песни: листайте влево или вправо');
     rail.onscroll=function(){
       if(moving)return;
       if(!rail.clientWidth||!rail.scrollWidth)return;
       var nearest=position,dist=Infinity;
       for(var j=0;j<rail.children.length;j++){
         var row=rail.children[j];if(typeof row.velarIndex!=='number')continue;
         var delta=Math.abs(center(row)-rail.scrollLeft);
         if(delta<dist){dist=delta;nearest=row.velarIndex;}
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
   function open(i,src,play){
     if(src.provider==='youtube'&&window.VMM_YOUTUBE_COMPAT&&window.VMM_YOUTUBE_COMPAT.required()&&
       window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.openYouTubeModal){
       if(activeMount)activeMount.close();
       return window.VMM_PUBLIC_LANDING.openYouTubeModal(src.url,tracks[i].title);
     }
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
     frame.src=link+(play&&src.provider==='youtube'?(link.indexOf('?')<0?'?':'&')+'autoplay=1':'');frame.loading='lazy';
     if(window.VMM_ANALYTICS)window.VMM_ANALYTICS.record('player_open',{title:tracks[i].title,artist:tracks[i].artist||'',provider:src.provider,section:classes||'collections'});frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow',(play?'autoplay; ':'')+'encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     var external=el('a','cms-card-link','Открыть в '+platformName(src.provider));
     external.href=src.url;external.rel='noopener noreferrer';external.target='_blank';
     // Keep the external link outside the embedded provider's drawing surface.
     host.appendChild(external);
     if(src.provider==='spotify'){
       var viewport=el('div','spotify-embed-viewport');
       viewport.appendChild(frame);host.appendChild(viewport);
     }else host.appendChild(frame);
     buttons[i].forEach(function(button){
       button.setAttribute('aria-pressed',button.getAttribute('data-provider')===src.provider?'true':'false');
     });
     if(titles[i])titles[i].setAttribute('aria-pressed','true');
     return true;
   }
   // Explicit repeat click toggles off; picking the other service switches players.
   // The chat deep link calls open() directly so it can always OPEN the requested song.
   function toggle(i,src,fromTitle){
     navigation++;moving=false;if(rail&&view!=='auto')rail.style.scrollSnapType='';
     // RUN-140: use our own active state, never inspect third-party iframe DOM.
     // Mobile Safari may report iframe children inconsistently while loading.
     if(index===i&&(fromTitle||source===src.provider)){
       clearActive();
       return true;
     }
     return open(i,src);
   }
   function addRow(i){
     if(opts.renderCard){
       var card=opts.renderCard(tracks[i],i);
       entries[i]=card;card.velarIndex=i;container.appendChild(card);return;
     }
     var track=tracks[i],sources=approved(track);
     if(!sources.length)return;
     var item=el('div','public-song-entry '+classes+'-song-entry'+
       (view==='covers'?' public-song-entry--covers':view==='tiles'?' public-song-entry--tiles':
         isCarousel?' public-song-entry--carousel':''));
     item.setAttribute('data-song-url',track.url);item.velarIndex=i;
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
         src.provider==='spotify'?'♫':src.provider==='youtube'?'▶':'♫');
       choice.type='button';choice.setAttribute('aria-pressed','false');
       choice.setAttribute('data-provider',src.provider);
       choice.setAttribute('aria-label','Слушать '+track.title+' в '+platformName(src.provider));
       choice.onclick=function(){toggle(i,src,false);};
       controls.appendChild(choice);buttons[i].push(choice);
     });
     var player=el('div','public-song-inline '+classes+'-inline-player');
     slots[i]=player;item.appendChild(player);
     // RUN-140: controls always FOLLOW the player, in every view.
     // The media panel replaces the song summary while expanded.
     item.appendChild(controls);
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
   function windowAt(target){
     cycling=false;clearActive();clear(container);
     entries=[];slots=[];buttons=[];titles=[];more=null;
     firstRendered=Math.max(0,target-Math.floor(amount/2));
     count=firstRendered;appendBatch();
   }
   function appendBatch(){
     if(more&&more.parentNode===container)container.removeChild(more);
     var next=Math.min(tracks.length,count+amount);
     for(var i=count;i<next;i++)addRow(i);
     count=next;
     // Every rendered card in this batch has already requested its image.
     if(count<tracks.length&&view!=='auto'){
       more=el('button',classes==='language'?'language-more':'topic-show-more',
         'Показать ещё ('+(tracks.length-count)+')');
       more.type='button';more.onclick=appendBatch;container.appendChild(more);
     }else more=null;
     updateCarousel();
   }
   function openByUrl(url,play){
     for(var i=0;i<tracks.length;i++){
       var sources=approved(tracks[i]);
       for(var j=0;j<sources.length;j++)if(sources[j].url===url){
         if(isCarousel&&!entries[i]&&(cycling||i<firstRendered||i>=count+amount))windowAt(i);
         while(!entries[i]&&i>=count)appendBatch(); // Preserve mounted players when growing.
         var card=entries[i],ticket=++navigation;
         if(!card)return false;
         var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
         if(card.scrollIntoView){
           (rail||card).scrollIntoView({block:'start',behavior:reduced?'auto':'smooth'});
         }
         function arrive(){
           moving=false;
           if(rail&&view!=='auto')rail.style.scrollSnapType='';
           if(ticket!==navigation||card.isConnected===false)return;
           if(index!==i||source!==sources[j].provider||play)open(i,sources[j],play);
           if(card.classList){card.classList.add('song-found');window.setTimeout(function(){card.classList.remove('song-found');},2400);}
         }
         if(!rail||reduced||!window.requestAnimationFrame){arrive();return true;}
         var start=rail.scrollLeft,time=null;rail.style.scrollSnapType='none';
         moving=true;
         function step(now){
           if(ticket!==navigation||card.isConnected===false){if(ticket===moveTicket)moving=false;return;}
           if(time===null)time=now;
           var progress=Math.min(1,(now-time)/800);
           rail.scrollLeft=start+(center(card)-start)*(1-Math.pow(1-progress,3));
           if(progress<1)window.requestAnimationFrame(step);else arrive();
         }
         moveTicket=ticket;window.requestAnimationFrame(step);return true;
       }
     }
     return false;
   }
   var moving=false,moveTicket=0,manualUntil=0;
   instance={openByUrl:openByUrl,close:clearActive};
   list.velarSongs=instance;
   appendBatch();
   updateCarousel();
   if(rail&&window.requestAnimationFrame)attachMotion();
   return instance;
   function attachMotion(){
     var direction=motion.direction==='left'?-1:1,paused=false,hover=false,held=false;
     var last=0,fraction=0,until=0,frame=0,seen=true;
     rail.style.scrollBehavior='auto';
     function margins(){
       var card=entries[position]||entries[0];
       if(!card)card=rail.firstElementChild;
       if(card){var space=Math.max(0,(rail.clientWidth-card.offsetWidth)/2);
         rail.style.setProperty('--song-edge',space+'px');}
       if(index>=0&&!moving)rail.scrollLeft=center(entries[index]);
     }
     var resize=window.ResizeObserver?new window.ResizeObserver(margins):null;
     observeMount(list,function(){
       if(resize)resize.disconnect();else window.removeEventListener('resize',margins);
       if(observer)observer.disconnect();if(frame)window.cancelAnimationFrame(frame);
       document.removeEventListener('visibilitychange',visibility);
     });
     if(resize){resize.observe(rail);if(entries[0])resize.observe(entries[0]);}
     else window.addEventListener('resize',margins);
     window.requestAnimationFrame(margins);
     if(view!=='auto')return;
     rail.style.scrollSnapType='none';
     counter.setAttribute('aria-live','off');
     var pause=el('button','public-song-page-button','Пауза');
     pause.type='button';pause.setAttribute('aria-pressed','false');
     pause.onclick=function(){paused=!paused;pause.textContent=paused?'Продолжить':'Пауза';pause.setAttribute('aria-pressed',String(paused));};
     nav.appendChild(pause);
     list.onmouseenter=function(){hover=window.matchMedia('(hover: hover)').matches;};list.onmouseleave=function(){hover=false;};
     list.ontouchstart=function(){held=true;};
     list.ontouchend=list.ontouchcancel=function(){held=false;until=Date.now()+1400;};
     list.onwheel=function(){until=Date.now()+1400;};
     var reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
     function trimInvisible(){
       if(count-firstRendered<=amount*3)return;
       var anchor=entries[position];
       if(!anchor||!rail.contains(anchor))return;
       var before=anchor.getBoundingClientRect().left;
       var limit=direction>0?firstRendered+amount:count-amount;
       if(direction>0&&position<=limit||direction<0&&position>=limit)return;
       function remove(k){
         if(entries[k])rail.removeChild(entries[k]);
         delete entries[k];delete buttons[k];delete titles[k];delete slots[k];
       }
       if(direction>0){while(firstRendered<limit)remove(firstRendered++);}
       else {while(count>limit)remove(--count);}
       rail.scrollLeft+=anchor.getBoundingClientRect().left-before;
     }
     function prependPrevious(){
       var anchor=rail.firstElementChild,before=anchor.getBoundingClientRect().left;
       var first=Math.max(0,firstRendered-amount);
       for(var k=firstRendered-1;k>=first;k--){
         addRow(k);if(entries[k])rail.insertBefore(entries[k],rail.firstElementChild);
       }
       firstRendered=first;rail.scrollLeft+=anchor.getBoundingClientRect().left-before;
     }
     if(direction<0&&tracks.length>1)window.requestAnimationFrame(function(){
       if(index<0&&!moving){windowAt(tracks.length-1);margins();rail.scrollLeft=center(entries[tracks.length-1]);}
     });
     function extendLoop(){
       var forward=direction>0,anchor=forward?rail.lastElementChild:rail.firstElementChild;
       var k=(anchor.velarIndex+direction+tracks.length)%tracks.length;
       var before=anchor.getBoundingClientRect().left;
       if(!entries[k])addRow(k);
       if(forward)rail.appendChild(entries[k]);else rail.insertBefore(entries[k],rail.firstElementChild);
       if(rail.children.length>amount*3){
         var old=forward?rail.firstElementChild:rail.lastElementChild,idx=old.velarIndex;
         rail.removeChild(old);delete entries[idx];delete slots[idx];delete buttons[idx];delete titles[idx];
       }
       rail.scrollLeft+=anchor.getBoundingClientRect().left-before;
       cycling=true;
     }
     function tick(now){
       frame=0;
       if(!list.isConnected)return;
       var dt=last?Math.min(40,now-last):0;last=now;
       if(seen&&!document.hidden&&!reduced.matches&&!paused&&!hover&&!held&&!moving&&index<0&&!(opts.renderCard&&rail.querySelector('iframe'))&&Date.now()>Math.max(until,manualUntil)&&!document.getElementById('velar-legacy-video-modal')&&tracks.length>1){
         var edge=rail.scrollWidth-rail.clientWidth;
         if(!cycling&&direction>0&&edge-rail.scrollLeft<rail.clientWidth&&count<tracks.length){appendBatch();trimInvisible();}
         if(!cycling&&direction<0&&rail.scrollLeft<rail.clientWidth&&firstRendered>0){prependPrevious();trimInvisible();}
         edge=rail.scrollWidth-rail.clientWidth;
         if(edge>0){
           fraction+=dt*(8+Number(motion.speed||35)*1.6)/1000;
           var pixels=Math.floor(fraction);fraction-=pixels;
           if(pixels){
             var next=rail.scrollLeft+direction*pixels;
             if(next>edge||next<0){
               if(motion.end==='swing'){direction*=-1;next=Math.max(0,Math.min(edge,next));}
               else {extendLoop();next=rail.scrollLeft+direction*pixels;}
             }
             rail.scrollLeft=next;
           }
         }
       }
       if(seen&&!document.hidden)frame=window.requestAnimationFrame(tick);
     }
     function wake(){last=0;if(!frame)frame=window.requestAnimationFrame(tick);}
     var observer=window.IntersectionObserver?new window.IntersectionObserver(function(rows){seen=rows[0].isIntersecting;if(seen)wake();}):null;
     if(observer)observer.observe(list);
     function visibility(){
       if(!list.isConnected){document.removeEventListener('visibilitychange',visibility);return;}
       if(!document.hidden)wake();
     }
     document.addEventListener('visibilitychange',visibility);
     wake();
   }
 }
 window.VELAR_PUBLIC_SONGS={mount:mount,approved:approved,configure:configure,
   cancelNavigation:function(){navigation++;},closeActive:function(){if(activeMount)activeMount.close();},requestArtwork:requestArtwork};
}());
