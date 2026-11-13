/* RUN-115: public read-only artist profiles. Only approved published landing data.
   No private catalog, lyrics, drafts, admin account, analytics or writes.
   ES5 syntax for Safari 12 / older iPad. */
(function(){
 'use strict';
 function node(id){return document.getElementById(id);}
 function make(tag,cls,label){
   var el=document.createElement(tag);
   if(cls)el.className=cls;
   if(typeof label==='string')el.textContent=label;
   return el;
 }
 function clean(host){while(host.firstChild)host.removeChild(host.firstChild);}
 function text(id,value){if(node(id))node(id).textContent=String(value||'');}
 function show(id,visible){if(node(id))node(id).hidden=!visible;}
 var platforms={
   spotify:'Spotify',youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok',
   telegram:'Telegram',facebook:'Facebook',apple:'Apple Music',
   soundcloud:'SoundCloud',bandcamp:'Bandcamp',vk:'ВКонтакте',
   yandex:'Яндекс Музыка',deezer:'Deezer',website:'Сайт артиста'
 };
 function query(){
   var params={},search=String(window.location&&window.location.search||'').replace(/^\?/,'').split('&');
   search.forEach(function(pair){
     if(!pair)return;
     var idx=pair.indexOf('='),key=idx<0?pair:pair.slice(0,idx),val=idx<0?'':pair.slice(idx+1);
     try{params[decodeURIComponent(key)]=decodeURIComponent(val.replace(/\+/g,' '));}catch(ignore){}
   });
   if(params.id&&/^[a-z0-9-]{1,80}$/.test(params.id))return {key:'id',value:params.id};
   if(params.name&&params.name.length<=110)return {key:'name',value:params.name};
   return null;
 }
 function selectedArtist(content,identifier){
   if(!identifier||!content||!content.artists)return null;
   var found=(content.artists.cards||[]).filter(function(item){
     if(item.visible!==true)return false;
     if(identifier.key==='id')return item.artistId===identifier.value;
     return !item.artistId&&item.title===identifier.value;
   });
   return found.length===1?found[0]:null; // Never guess between duplicate legacy names.
 }
 function profileUrl(item){
   var suffix=item.artistId?
     'id='+encodeURIComponent(item.artistId):
     'name='+encodeURIComponent(item.title);
   return 'https://velardream.com/artist.html?'+suffix;
 }
 function external(host,url,label,detail,cls){
   var a=make('a',cls||'artist-link');
   a.href=url;a.target='_blank';a.rel='noopener noreferrer';
   a.appendChild(make('span','',label));
   if(detail)a.appendChild(make('small','',detail));
   host.appendChild(a);
   return a;
 }
 function setMeta(id,value){var el=node(id);if(el)el.setAttribute('content',value);}
 function publishedMetadata(item,canonical,description){
   document.title=item.title+' — VELARDREAM Records';
   setMeta('artist-meta-description',description.slice(0,240));
   setMeta('artist-og-title',document.title);
   setMeta('artist-og-description',description.slice(0,240));
   setMeta('artist-og-url',canonical);
   // SEO metadata is populated from published content only. This dynamic
   // prototype remains noindex until static prerender + approval are ready.
   var canonicalLink=node('artist-canonical');
   if(!canonicalLink){
     canonicalLink=document.createElement('link');
     canonicalLink.id='artist-canonical';canonicalLink.rel='canonical';
     document.head.appendChild(canonicalLink);
   }
   canonicalLink.href=canonical;
   var sameAs=(item.socialLinks||[]).filter(function(x){return x.visible&&x.url;})
     .map(function(x){return x.url;});
   var entity={'@type':'MusicGroup','@id':canonical+'#artist',name:item.title,url:canonical};
   if(description)entity.description=description;
   if(sameAs.length)entity.sameAs=sameAs;
   // Data URIs are not public image URLs suitable for JSON-LD image.
   if(item.imageUrl)entity.image=item.imageUrl;
   var script=node('artist-jsonld');
   if(script)script.textContent=JSON.stringify({
     '@context':'https://schema.org','@type':'ProfilePage',
     '@id':canonical+'#profile',url:canonical,mainEntity:entity
   });
 }
 function render(content){
   if(!window.VMM_LANDING_SCHEMA)return false;
   var safe;
   try{safe=window.VMM_LANDING_SCHEMA.normalize(content);}catch(ignore){return false;}
   var artist=selectedArtist(safe,query());
   if(!artist){
     show('artist-content',false);
     text('artist-message','Этот профиль пока не опубликован или недоступен. Вернись к списку артистов.');
     show('artist-message',true);
     return false;
   }
   text('artist-name',artist.title);
   text('artist-role',artist.subtitle);show('artist-role',!!artist.subtitle);
   text('artist-description',artist.description);show('artist-description',!!artist.description);
   var pic=artist.imageData||artist.imageUrl;
   show('artist-portrait-wrap',!!pic);
   var hero=document.querySelector('.artist-hero');
   if(hero)hero.className='artist-hero'+(!pic?' artist-hero--text-only':'');
   if(pic){
     var image=node('artist-portrait');
     image.src=pic;image.alt='Портрет артиста '+artist.title;
     image.referrerPolicy='no-referrer';
   }
   text('artist-biography',artist.biography);
   show('artist-biography-section',!!artist.biography);
   var social=node('artist-social-links');clean(social);
   var seen={};
   if(artist.url){
     external(social,artist.url,'Основной музыкальный профиль','Открыть площадку');
     seen[artist.url]=true;
   }
   (artist.socialLinks||[]).forEach(function(link){
     if(!link.visible||!link.url||seen[link.url])return;
     seen[link.url]=true;
     external(social,link.url,platforms[link.platform]||'Официальная страница','Перейти на платформу');
   });
   show('artist-social-section',social.children.length>0);
   var tracks=node('artist-tracks');clean(tracks);
   var sorted=(artist.featuredTracks||[]).slice();
   if(artist.featuredSort!=='manual')sorted.sort(function(a,b){return a.title.localeCompare(b.title,'ru');});
   sorted.forEach(function(track){
     if(!track.url)return;
     external(tracks,track.url,track.title,track.provider==='spotify'?'Spotify':'YouTube','artist-track');
     if(track.alternateUrl&&track.alternateProvider)
       external(tracks,track.alternateUrl,track.title+' · '+(track.alternateProvider==='spotify'?'Spotify':'YouTube'),
         'Альтернативная площадка','artist-track');
   });
   show('artist-tracks-section',tracks.children.length>0);
   var albums=node('artist-albums');clean(albums);
   // Exact published name only. Never infer a link from private catalog data.
   (safe.albums.entries||[]).forEach(function(album){
     if(!album.visible||!album.artist||album.artist.toLocaleLowerCase('ru')!==artist.title.toLocaleLowerCase('ru'))return;
     var tile=make('div','artist-album');
     if(album.imageData||album.imageUrl){
       var img=make('img');img.src=album.imageData||album.imageUrl;
       img.alt='Обложка: '+album.title;img.loading='lazy';tile.appendChild(img);
     }
     tile.appendChild(make('strong','',album.title));
     if(album.description)tile.appendChild(make('small','',album.description));
     if(album.mediaUrl){
       var link=make('a','',album.mediaProvider==='spotify'?'Слушать в Spotify':'Открыть на YouTube');
       link.href=album.mediaUrl;link.target='_blank';link.rel='noopener noreferrer';tile.appendChild(link);
     }
     albums.appendChild(tile);
   });
   show('artist-albums-section',albums.children.length>0);
   var canonical=profileUrl(artist);
   publishedMetadata(artist,canonical,artist.description||artist.biography||'Музыка и история артиста VELARDREAM Records');
   var share=node('artist-share');
   if(share)share.onclick=function(){
     if(navigator.share){navigator.share({title:document.title,url:canonical}).catch(function(){});}
     else if(navigator.clipboard&&navigator.clipboard.writeText){
       navigator.clipboard.writeText(canonical).then(function(){share.textContent='Ссылка скопирована';})
         .catch(function(){window.prompt('Скопируй адрес:',canonical);});
     }else window.prompt('Скопируй адрес:',canonical);
   };
   show('artist-message',false);show('artist-content',true);
   return true;
 }
 function start(){
   if(!query()){text('artist-message','Не указан артист. Открой страницу из раздела «Артисты» на главной.');return;}
   var fresh=false;
   if(window.VMM_PUBLIC_OFFLINE)window.VMM_PUBLIC_OFFLINE.read().then(function(saved){
     if(saved&&!fresh)render(saved);
   }).catch(function(){});
   if(!window.firebase||!window.VELAR_FIREBASE_CONFIG)return;
   try{
     if(!firebase.apps.length)firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
     firebase.firestore().collection('vmm_public_pages').doc('landing').onSnapshot(function(snap){
       if(!snap.exists)return;
       var data=snap.data()||{};
       if(data.schemaVersion!==1||data.status!=='published')return;
       fresh=true;
       render(data.content);
       if(window.VMM_PUBLIC_OFFLINE)window.VMM_PUBLIC_OFFLINE.put(data.content).catch(function(){});
     },function(){
       if(!node('artist-content').hidden)return;
       text('artist-message','Не удалось загрузить профиль. Проверь соединение и открой страницу снова.');
     });
   }catch(ignore){text('artist-message','Не удалось подключиться. Попробуй обновить страницу при наличии сети.');}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
 else start();
 window.VMM_ARTIST_DETAIL={render:render,selectedArtist:selectedArtist,profileUrl:profileUrl};
}());
