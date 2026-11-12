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
 var activeMount=null;
 function mount(list,tracks,opts){
   opts=opts||{};
   var classes=opts.prefix==='language'?'language':'topic';
   var amount=opts.batch||12,index=-1,source='',slots=[],buttons=[],count=0,more=null,instance=null;
   clear(list);
   function clearActive(){
     if(index>=0&&slots[index])clear(slots[index]);
     buttons.forEach(function(pair){pair.forEach(function(button){
       button.setAttribute('aria-pressed','false');
     });});
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
     var host=slots[i],frame=el('iframe','cms-release-iframe '+classes+'-song-iframe'+
       (src.provider==='youtube'?' cms-release-iframe--video':''));
     frame.title=tracks[i].title+' — официальный плеер '+(src.provider==='spotify'?'Spotify':'YouTube');
     frame.src=link;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     host.appendChild(frame);
     var external=el('a','cms-card-link','Открыть в '+(src.provider==='spotify'?'Spotify':'YouTube'));
     external.href=src.url;external.rel='noopener noreferrer';external.target='_blank';
     host.appendChild(external);
     var close=el('button','cms-release-close','Закрыть плеер');
     close.type='button';close.onclick=function(){clearActive();};
     host.appendChild(close);
     buttons[i].forEach(function(button){
       button.setAttribute('aria-pressed',button.getAttribute('data-provider')===src.provider?'true':'false');
     });
     return true;
   }
   function addRow(i){
     var track=tracks[i],sources=approved(track);
     if(!sources.length)return;
     var item=el('div','public-song-entry '+classes+'-song-entry');
     var title=el('div','public-song-label');
     title.appendChild(el('span','public-song-index',('0'+(i+1)).slice(-2)));
     var copy=el('button','public-song-copy public-song-title-button');
     copy.type='button';copy.setAttribute('aria-label','Слушать '+track.title+' в основном плеере');
     copy.onclick=function(){open(i,sources[0]);};
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
       choice.onclick=function(){open(i,src);};
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
 window.VELAR_PUBLIC_SONGS={mount:mount,approved:approved};
}());
