/* RUN-194: AI laboratory reads ONLY the already-public landing snapshot.
 * No Firestore private catalog, no drafts, no images, no account identifiers.
 * Recommendations are local, curated and carry official verified platform URLs.
 * The external AI receives at most four titles/artists/categories as optional
 * context; these are explicitly public and owner-confirmed. */
(function(){
 "use strict";
 function clean(s,n){
   return typeof s==='string'?s.replace(/[\x00-\x1f<>]/g,' ').trim().slice(0,n):'';
 }
 function official(row){
   if(!row||typeof row!=='object')return null;
   var provider=clean(row.provider,20),url=clean(row.url,350);
   if(!row.title||!provider||!url)return null;
   var m;
   if(provider==='spotify'){
     m=/^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})(?:\?[^#]*)?$/i.exec(url);
     if(!m)return null;
     url='https://open.spotify.com/track/'+m[1];
   }else if(provider==='youtube'){
     m=/^https:\/\/(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})(?:&[^#]*)?$/i.exec(url)||
       /^https:\/\/youtu\.be\/([A-Za-z0-9_-]{11})(?:\?[^#]*)?$/i.exec(url);
     if(!m)return null;
     url='https://www.youtube.com/watch?v='+m[1];
   }else if(provider==='appleMusic'){
     m=/^https:\/\/music\.apple\.com\/([A-Za-z-]+)\/(?:album\/[^?#]+\?[^#]*\bi=\d+|song\/[^?#]+)(?:[&#][^\s]*)?$/i.exec(url);
     if(!m)return null;
   }else return null;
   return {title:clean(row.title,100),artist:clean(row.artist,90),
     provider:provider,url:url};
 }
 function extract(documentData){
   if(!documentData||documentData.status!=='published'||documentData.schemaVersion!==1||
     !documentData.content||typeof documentData.content!=='object')return [];
   var page=documentData.content,seen={},all=[];
   function add(rows,group,label){
     if(!Array.isArray(rows))return;
     rows.forEach(function(raw){
       var row=official(raw);
       if(!row||!row.title)return;
       var key=row.provider+':'+row.url;
       if(seen[key])return;
       seen[key]=true;
       row.section=group;row.category=clean(label,70);
       all.push(row);
     });
   }
   function groups(rows,section){
     if(!Array.isArray(rows))return;
     rows.forEach(function(row){
       if(!row||row.visible!==true)return;
       add(row.tracks,section,row.label||row.title||'');
     });
   }
   var genres=page.genres||{};
   groups(genres.entries,'genre');
   groups(genres.topics&&genres.topics.entries,'topic');
   groups(genres.languages&&genres.languages.entries,'language');
   groups(page.albums&&page.albums.entries,'album');
   // Artist spotlight tracks are explicitly visible in public cards.
   (page.artists&&page.artists.cards||[]).forEach(function(artist){
     if(!artist||artist.visible!==true)return;
     add(artist.featuredTracks,'artist',artist.title||'');
   });
   return all.slice(0,800);
 }
 function shortlist(rows,question,max){
   var q=clean(question,500).toLocaleLowerCase('ru').replace(/ё/g,'е');
   var words=q.split(/[^a-zа-яёäöå0-9]+/i).filter(function(x){return x.length>2;}).slice(0,20);
   var ranked=rows.map(function(t,i){
     var hay=(t.title+' '+t.artist+' '+t.category).toLocaleLowerCase('ru').replace(/ё/g,'е');
     var score=0;
     words.forEach(function(w){if(hay.indexOf(w)>=0)score+=2;});
     if(/любов|романт|love|rakkaus/.test(q)&&/любов|романт|love|rakkaus/.test(hay))score+=5;
     if(/груст|печал|sad|surull/.test(q)&&/груст|печал|sad|surull/.test(hay))score+=5;
     if(/космос|звезд|space|avaruus/.test(q)&&/космос|звезд|space|avaruus/.test(hay))score+=5;
     return {track:t,score:score,index:i};
   });
   ranked.sort(function(a,b){return b.score-a.score||a.index-b.index;});
   return ranked.slice(0,Math.min(max||4,4)).map(function(x){return x.track;});
 }
 function prompt(question,rows){
   var query=clean(question,500);
   if(!rows.length)return query;
   // Same Worker rejects messages longer than 500 chars; leave 180 chars for
   // title/artist/category context and never send official URLs or IDs.
   var out='Запрос: '+query.slice(0,220)+
     '\nВыбери только из этих ОПУБЛИКОВАННЫХ песен (не выдумывай):';
   rows.slice(0,4).forEach(function(r,i){
     var line='\n'+(i+1)+'. '+clean(r.title,42)+
       (r.artist?' — '+clean(r.artist,24):'')+
       (r.category?' ['+clean(r.category,24)+']':'');
     if(out.length+line.length<=486)out+=line;
   });
   return out.slice(0,500);
 }
 function readPublished(){
   if(!window.firebase||!window.VELAR_FIREBASE_CONFIG||
       !firebase.firestore)return Promise.reject(new Error('Firebase недоступен.'));
   try{
     if(!firebase.apps.length)firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
     return firebase.firestore().collection('vmm_public_pages').doc('landing')
       .get({source:'server'}).then(function(snap){
         if(!snap.exists)throw new Error('Опубликованная страница не найдена.');
         var d=snap.data()||{};
         if(d.status!=='published'||d.schemaVersion!==1)
           throw new Error('Нет действующей публикации каталога.');
         return extract(d);
       });
   }catch(e){return Promise.reject(e);}
 }
 window.VELAR_AI_PUBLIC_CATALOG={extract:extract,shortlist:shortlist,prompt:prompt,
   readPublished:readPublished,official:official};
}());
