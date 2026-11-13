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
   var title=x.localeCompare(y,'ru');
   return title||String(a&&a.artist||'').trim().localeCompare(
     String(b&&b.artist||'').trim(),'ru');
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
 var activeMount=null,defaultView='rows',coverMap={};
 function configure(view,albums){
   defaultView=['rows','covers','tiles'].indexOf(view)>=0?view:'rows';
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
   tracks.sort(function(a,b){return compareSong(a.track,b.track)||a.index-b.index;});
   tracks=tracks.map(function(row){return row.track;});
   var classes=opts.prefix==='language'?'language':opts.prefix==='album'?'album':'topic';
   var view=opts.view||defaultView;
   if(['rows','covers','tiles'].indexOf(view)<0)view='rows';
   if(view==='tiles')list.className+=' public-song-list--tiles';
   var amount=opts.batch||12,index=-1,source='',slots=[],buttons=[],titles=[],entries=[],count=0,more=null,instance=null;
   clear(list);
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
       (view==='covers'?' public-song-entry--covers':view==='tiles'?' public-song-entry--tiles':''));
     entries[i]=item;
     var title=el('div','public-song-label');
     title.appendChild(el('span','public-song-index',('0'+(i+1)).slice(-2)));
     if(view==='covers'||view==='tiles'){
       var art=opts.cover||coverMap[track.url]||coverMap[track.alternateUrl]||'';
       if(art){
         var thumb=el('img','public-song-thumbnail');
         thumb.src=art;thumb.alt='Обложка: '+track.title;thumb.loading='lazy';
         thumb.decoding='async';thumb.referrerPolicy='no-referrer';title.appendChild(thumb);
       }else{
         var placeholder=el('span','public-song-thumbnail public-song-thumbnail--empty','♫');
         placeholder.setAttribute('aria-hidden','true');title.appendChild(placeholder);
       }
     }
     var copy=el('button','public-song-copy public-song-title-button');
     copy.type='button';copy.setAttribute('aria-label','Открыть или закрыть плеер: '+track.title);
     copy.setAttribute('aria-pressed','false');titles[i]=copy;
     copy.onclick=function(){toggle(i,sources[0],true);};
     copy.appendChild(el('strong','',track.title));
     copy.appendChild(el('small','',(track.artist?track.artist+' · ':'')+
       (sources[0].provider==='spotify'?'Spotify':'YouTube')));
     title.appendChild(copy);item.appendChild(title);
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
     list.appendChild(item);
   }
   function appendBatch(){
     if(more&&more.parentNode===list)list.removeChild(more);
     var next=Math.min(tracks.length,count+amount);
     for(var i=count;i<next;i++)addRow(i);
     count=next;
     if(count<tracks.length){
       more=el('button',classes==='language'?'language-more':'topic-show-more',
         'Показать ещё ('+(tracks.length-count)+')');
       more.type='button';more.onclick=appendBatch;list.appendChild(more);
     }else more=null;
   }
   function openByUrl(url){
     for(var i=0;i<tracks.length;i++){
       var sources=approved(tracks[i]);
       for(var j=0;j<sources.length;j++)if(sources[j].url===url){
         while(i>=count)appendBatch(); // Preserve mounted players when growing.
         return open(i,sources[j]);
       }
     }
     return false;
   }
   instance={openByUrl:openByUrl,close:clearActive};
   appendBatch();
   return instance;
 }
 window.VELAR_PUBLIC_SONGS={mount:mount,approved:approved,configure:configure};
}());
