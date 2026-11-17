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

 function platformName(provider){
   return provider==='spotify'?'Spotify':provider==='appleMusic'?'Apple Music':'YouTube';
 }
 function groupSongs(tracks){
   var groups=[],api=window.VMM_LANDING_SCHEMA;
   (tracks||[]).forEach(function(track){
     if(!track||!track.title)return;
     var sources=[],seen={};
     [['provider','url'],['alternateProvider','alternateUrl'],['thirdProvider','thirdUrl']].forEach(function(keys){
       var provider=track[keys[0]],url=api.songUrl(track[keys[1]]||'',provider);
       if(url&&!seen[provider]){seen[provider]=true;sources.push({provider:provider,url:url});}
     });
     if(!sources.length)return;
     var title=String(track.title||'').trim(),key=title.toLocaleLowerCase('ru').replace(/ё/g,'е');
     // Legacy per-platform rows may share a title. Merge only when their
     // platforms do NOT overlap. Different recordings on the same platform
     // remain separate even if the titles happen to be identical.
     var target=null;
     groups.forEach(function(group){
       if(target||group.key!==key)return;
       if(!sources.some(function(src){
         return group.sources.some(function(other){return src.provider===other.provider;});
       }))target=group;
     });
     if(target)target.sources=target.sources.concat(sources);
     else groups.push({title:title,key:key,sources:sources});
   });
   return groups;
 }
 function render(content){
   if(!window.VMM_LANDING_SCHEMA)return false;
   var safe;
   try{safe=window.VMM_LANDING_SCHEMA.normalize(content);}catch(ignore){return false;}
   if(window.VELAR_IMAGE_LOADING&&window.VELAR_IMAGE_LOADING.configure)
     window.VELAR_IMAGE_LOADING.configure(safe.hero.imageLoadingLevel);
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
     if(window.VELAR_IMAGE_LOADING&&window.VELAR_IMAGE_LOADING.apply)
       window.VELAR_IMAGE_LOADING.apply(image,0);
     image.referrerPolicy='no-referrer';
     image.alt='Портрет артиста '+artist.title;image.src=pic;
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
   // RUN-181: the same song appears once, with source buttons in its row.
   // Only published "best songs" are available here (up to 30); never query
   // the private vmm_catalog, lyrics, offline audio or Studio assignments.
   var tracks=node('artist-tracks');clean(tracks);
   var sorted=(artist.featuredTracks||[]).slice();
   if(artist.featuredSort!=='manual')
     sorted.sort(function(a,b){return a.title.localeCompare(b.title,'ru');});
   var grouped=groupSongs(sorted),layout=safe.artists.detailTrackView||'compact';
   tracks.className='artist-tracks artist-tracks--'+layout;
   var activeCard=null,activeProvider='',activePlayer=null,activeButtons=[];
   function closePlayer(){
     if(activePlayer)clean(activePlayer);
     activeButtons.forEach(function(b){b.setAttribute('aria-pressed','false');});
     activeCard=null;activeProvider='';activePlayer=null;activeButtons=[];
   }
   function play(card,holder,buttons,track,src){
     if(activeCard===card&&activeProvider===src.provider){closePlayer();return;}
     closePlayer();
     var url=window.VMM_LANDING_SCHEMA.songUrl(src.url,src.provider);
     if(!url)return;
     var playerUrl=src.provider==='spotify'?
       'https://open.spotify.com/embed/track/'+url.split('/').pop():
       src.provider==='youtube'?
         'https://www.youtube-nocookie.com/embed/'+url.split('v=')[1]:
         url.replace('https://music.apple.com/','https://embed.music.apple.com/');
     activeCard=card;activeProvider=src.provider;activePlayer=holder;activeButtons=buttons;
     buttons.forEach(function(b){b.setAttribute('aria-pressed',
       b.getAttribute('data-provider')===src.provider?'true':'false');});
     var frame=make('iframe','artist-track-player'+(src.provider==='youtube'?' artist-track-player--video':''));
     frame.title=track.title+' — '+platformName(src.provider);
     frame.src=playerUrl;frame.loading='lazy';
     frame.referrerPolicy='strict-origin-when-cross-origin';
     frame.setAttribute('allow','encrypted-media; fullscreen; picture-in-picture');
     frame.setAttribute('allowfullscreen','');
     holder.appendChild(frame);
     var open=external(holder,url,'Открыть в '+platformName(src.provider),'','artist-track-external');
     var close=make('button','artist-track-close','Закрыть плеер');close.type='button';close.onclick=closePlayer;
     holder.appendChild(close);
   }
   var search=null,page=0,pageSize=20,list=make('div','artist-track-list');
   function draw(){
     closePlayer();clean(list);
     var q=search?String(search.value||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е'):'';
     var filtered=grouped.filter(function(song){
       return !q||song.title.toLocaleLowerCase('ru').replace(/ё/g,'е').indexOf(q)>=0;
     });
     var totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
     page=Math.max(0,Math.min(page,totalPages-1));
     var pageRows=filtered.slice(page*pageSize,(page+1)*pageSize);
     pageRows.forEach(function(track,index){
       var item=make('div','artist-track-card');
       var headline=make('div','artist-track-headline');
       if(layout!=='compact'){
         var artwork=make('span','artist-track-artwork','♫');
         artwork.setAttribute('aria-hidden','true');
         headline.appendChild(artwork);
       }
       headline.appendChild(make('strong','artist-track-name',track.title));
       var sources=make('div','artist-track-sources'),controls=[];
       track.sources.forEach(function(src){
         var button=make('button','artist-track-source artist-track-source--'+src.provider,
           src.provider==='spotify'?'♫':src.provider==='youtube'?'▶':'♪');
         button.type='button';button.setAttribute('data-provider',src.provider);
         button.setAttribute('aria-label','Слушать «'+track.title+'» в '+platformName(src.provider));
         button.setAttribute('aria-pressed','false');button.title=platformName(src.provider);
         controls.push(button);sources.appendChild(button);
       });
       var holder=make('div','artist-track-inline-player');
       controls.forEach(function(button,i){
         button.onclick=function(){play(item,holder,controls,track,track.sources[i]);};
       });
       item.appendChild(headline);item.appendChild(holder);item.appendChild(sources);list.appendChild(item);
     });
     if(!pageRows.length)list.appendChild(make('p','artist-hint','Песни не найдены.'));
     var footer=node('artist-track-pagination');
     if(footer){clean(footer);
       if(filtered.length>pageSize){
         var back=make('button','artist-track-page-button','← Назад');back.type='button';
         back.disabled=page===0;back.onclick=function(){page--;draw();};
         var current=make('span','',((page*pageSize)+1)+'–'+Math.min((page+1)*pageSize,filtered.length)+' / '+filtered.length);
         var next=make('button','artist-track-page-button','Далее →');next.type='button';
         next.disabled=page>=totalPages-1;next.onclick=function(){page++;draw();};
         footer.appendChild(back);footer.appendChild(current);footer.appendChild(next);
       }
     }
   }
   if(grouped.length){
     if(grouped.length>8){
       search=make('input','artist-track-search');search.type='search';
       search.placeholder='Найти песню…';
       search.setAttribute('aria-label','Найти песню артиста');
       search.oninput=function(){page=0;draw();};
       tracks.appendChild(search);
     }
     tracks.appendChild(list);draw();
   }
   show('artist-tracks-section',grouped.length>0);
   var albums=node('artist-albums');clean(albums);
   // Exact published name only. Never infer a link from private catalog data.
   (safe.albums.entries||[]).forEach(function(album,index){
     if(!album.visible||!album.artist||album.artist.toLocaleLowerCase('ru')!==artist.title.toLocaleLowerCase('ru'))return;
     var tile=make('div','artist-album');
     if(album.imageData||album.imageUrl){
       var img=make('img');
       if(window.VELAR_IMAGE_LOADING&&window.VELAR_IMAGE_LOADING.apply)
         window.VELAR_IMAGE_LOADING.apply(img,index);
       else img.loading='eager';
       img.alt='Обложка: '+album.title;img.src=album.imageData||album.imageUrl;
       tile.appendChild(img);
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
