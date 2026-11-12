/* RUN-096: public album gallery from already published landing document.
   Official albums and curated singles are explicitly distinguished. ES5 Safari 12.
   No private catalog, audio, lyrics or new Firestore reads. */
(function(){
 'use strict';
 var active=null;
 function el(tag,cls,txt){
   var e=document.createElement(tag);if(cls)e.className=cls;
   if(typeof txt==='string')e.textContent=txt;return e;
 }
 function clear(e){while(e&&e.firstChild)e.removeChild(e.firstChild);}
 function closeCurrent(){
   if(!active)return;
   if(active.player)active.player.close();
   clear(active.host);
   active.button.setAttribute('aria-expanded','false');
   active.button.textContent='Показать песни';
   active=null;
 }
 function render(config){
   var host=document.getElementById('public-albums-cards');
   if(!host||!config)return;
   closeCurrent();clear(host);
   var heading=document.getElementById('albums-title'),intro=document.getElementById('public-albums-intro');
   if(heading)heading.textContent=config.heading;
   if(intro)intro.textContent=config.intro;
   host.className='cms-album-gallery'+(config.view==='list'?' cms-album-gallery--list':'');
   var items=(config.entries||[]).filter(function(row){return row.visible===true;});
   if(!items.length){
     host.appendChild(el('p','cms-album-empty','Альбомы появятся здесь после публикации в VELARDREAM Studio.'));
     return;
   }
   items.forEach(function(album){
     var card=el('article','cms-album-card');
     var visual=el('div','cms-album-cover');
     var cover=album.imageData||album.imageUrl;
     if(cover){
       var img=el('img','cms-album-cover-image');
       img.src=cover;img.alt='Обложка альбома «'+album.title+'»';
       img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
       visual.appendChild(img);
     }else{
       var symbol=el('span','cms-album-cover-placeholder','♫');
       symbol.setAttribute('aria-hidden','true');visual.appendChild(symbol);
     }
     card.appendChild(visual);
     var body=el('div','cms-album-body');
     body.appendChild(el('span','cms-album-kind',album.kind==='official'?
       'ОФИЦИАЛЬНЫЙ АЛЬБОМ':'АВТОРСКАЯ КОЛЛЕКЦИЯ ИЗ СИНГЛОВ'));
     body.appendChild(el('h3','',album.title));
     body.appendChild(el('p','cms-album-artist',album.artist));
     if(album.description)body.appendChild(el('p','cms-album-description',album.description));
     body.appendChild(el('p','cms-album-count',album.tracks.length+' песен'));
     if(album.kind==='official'&&album.mediaUrl){
       var official=el('a','cms-card-link','Открыть официальный альбом в Spotify');
       official.href=album.mediaUrl;official.target='_blank';official.rel='noopener noreferrer';
       body.appendChild(official);
     }
     var open=el('button','cms-album-toggle','Показать песни');
     open.type='button';open.setAttribute('aria-expanded','false');
     var songs=el('div','cms-album-songs');
     open.onclick=function(){
       if(active&&active.button===open){closeCurrent();return;}
       closeCurrent();clear(songs);
       open.setAttribute('aria-expanded','true');open.textContent='Скрыть песни';
       var player=null;
       if(album.tracks.length&&window.VELAR_PUBLIC_SONGS){
         player=window.VELAR_PUBLIC_SONGS.mount(songs,album.tracks,{
           prefix:'album',batch:12,view:config.trackView||'rows',cover:cover
         });
       }else songs.appendChild(el('p','cms-album-empty','Песни ещё не добавлены.'));
       active={button:open,host:songs,player:player};
     };
     body.appendChild(open);
     card.appendChild(body);
     card.appendChild(songs);
     host.appendChild(card);
   });
 }
 window.VELAR_ALBUMS={render:render};
}());
