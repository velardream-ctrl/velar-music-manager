/* RUN-096: public album gallery from already published landing document.
   Official albums and curated singles are explicitly distinguished. ES5 Safari 12.
   No private catalog, audio, lyrics or new Firestore reads. */
(function(){
 'use strict';
 var active=null,openers=Object.create(null);
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
   if(active.card)active.card.className=active.card.className.replace(/ is-expanded/g,'');
   active=null;
 }
 function spotifyEmbedUrl(link){
   var match=/^https:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]{22})$/.exec(String(link||''));
   return match?'https://open.spotify.com/embed/album/'+match[1]:'';
 }
 function render(config){
   var host=document.getElementById('public-albums-cards');
   if(!host||!config)return;
   closeCurrent();clear(host);openers=Object.create(null);
   var heading=document.getElementById('albums-title'),intro=document.getElementById('public-albums-intro');
   if(heading)heading.textContent=config.heading;
   if(intro)intro.textContent=config.intro;
   host.className='cms-album-gallery'+(config.view==='list'?' cms-album-gallery--list':'');
   var items=(config.entries||[]).filter(function(row){return row.visible===true;});
   if(!items.length){
     host.appendChild(el('p','cms-album-empty','Альбомы появятся здесь после публикации в VELARDREAM Studio.'));
     return;
   }
   items.forEach(function(album,index){
     var card=el('article','cms-album-card');
     var visual=el('div','cms-album-cover');
     var cover=album.imageData||album.imageUrl;
     if(cover){
       var img=el('img','cms-album-cover-image');
       if(window.VELAR_IMAGE_LOADING&&window.VELAR_IMAGE_LOADING.apply)
         window.VELAR_IMAGE_LOADING.apply(img,index);
       else img.loading='eager';
       img.decoding='async';img.referrerPolicy='no-referrer';
       img.alt='Обложка альбома «'+album.title+'»';img.src=cover;
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
     body.appendChild(el('p','cms-album-count',album.tracks.length?
       album.tracks.length+' песен сопоставлено с каталогом':
       (album.kind==='official'&&spotifyEmbedUrl(album.mediaUrl)?
         'Полный список композиций — в Spotify':'Песни пока не назначены')));
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
       card.className+=' is-expanded';
       var player=null;
       if(album.tracks.length&&window.VELAR_PUBLIC_SONGS){
         player=window.VELAR_PUBLIC_SONGS.mount(songs,album.tracks,{
           prefix:'album',batch:12,view:config.trackView||'rows',cover:cover
         });
       }else if(!spotifyEmbedUrl(album.mediaUrl)){
         songs.appendChild(el('p','cms-album-empty','Песни ещё не добавлены.'));
       }
       // Spotify owns the official album tracklist. Its embed is shown only
       // after a visitor clicks: no unauthorized API reads or pre-click tracking.
       var spotifySrc=album.kind==='official'?spotifyEmbedUrl(album.mediaUrl):'';
       if(spotifySrc){
         songs.appendChild(el('p','cms-album-spotify-label',
           'Полный список песен официального альбома в Spotify'));
         var frame=el('iframe','cms-album-spotify-embed');
         frame.src=spotifySrc;
         frame.title='Spotify: альбом «'+album.title+'»';
         frame.loading='lazy';
         frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
         frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
         songs.appendChild(frame);
       }
       active={button:open,host:songs,player:player,card:card};
     };
     openers[album.id]=function(){
       if(!active||active.button!==open)open.onclick();
       return active&&active.player;
     };
     body.appendChild(open);
     card.appendChild(body);
     card.appendChild(songs);
     host.appendChild(card);
   });
 }
 window.VELAR_ALBUMS={render:render,expand:function(id){
   if(window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.ensureSection)window.VMM_PUBLIC_LANDING.ensureSection('albums');
return openers[id]&&openers[id]();}};
}());
