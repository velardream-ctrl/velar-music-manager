/* RUN-182: read-only, catalog-authoritative reconciliation preview.
   No network requests or database writes. ES5 for legacy iPad Safari. */
(function(root){
 'use strict';
 var PROVIDERS=['spotify','youtube','appleMusic'];
 function copy(x){return JSON.parse(JSON.stringify(x));}
 function key(provider,raw,API){
   var url=API.songUrl(raw||'',provider),m;
   if(!url)return '';
   if(provider==='spotify'){
     m=/\/track\/([A-Za-z0-9]{22})/.exec(url);
     return m?'spotify:'+m[1]:'';
   }
   if(provider==='youtube'){
     m=/[?&]v=([A-Za-z0-9_-]{11})/.exec(url);
     return m?'youtube:'+m[1]:'';
   }
   m=/[?&]i=(\d+)/.exec(url);
   if(!m)m=/\/song\/[^/?#]+\/(\d+)/.exec(url);
   return m?'appleMusic:'+m[1]:'';
 }
 function rowSources(row,API){
   var found=[];
   [['provider','url'],['alternateProvider','alternateUrl'],['thirdProvider','thirdUrl']]
     .forEach(function(fields){
       var p=row[fields[0]],raw=row[fields[1]],k=key(p,raw,API);
       if(k)found.push({provider:p,url:API.songUrl(raw,p),key:k});
     });
   return found;
 }
 function catalogSources(row,API){
   var found=[],links=row.links||{};
   PROVIDERS.forEach(function(p){
     var url=API.songUrl(links[p]||'',p),k=key(p,url,API);
     if(k)found.push({provider:p,url:url,key:k});
   });
   return found;
 }
 function indexCatalog(catalog,API){
   var index={},catalogRows={},distinct={},counts={spotify:0,youtube:0,appleMusic:0};
   (catalog||[]).forEach(function(song,i){
     if(!song||!song.id||catalogRows[song.id])return;
     var sources=catalogSources(song,API);
     catalogRows[song.id]={id:song.id,title:String(song.title||''),
       artist:String(song.artist||''),sources:sources};
     sources.forEach(function(source){
       counts[source.provider]++;
       if(!index[source.key])index[source.key]=[];
       if(index[source.key].indexOf(song.id)<0)index[source.key].push(song.id);
     });
   });
   return {index:index,rows:catalogRows,counts:counts};
 }
 function mergeRow(row,idx,API,kind){
   var known=rowSources(row,API),candidates={},unique=[],id;
   known.forEach(function(source){
     var ids=idx.index[source.key]||[];
     ids.forEach(function(value){if(!candidates[value]){candidates[value]=true;unique.push(value);}});
   });
   if(!known.length)return {status:'unmatched'};
   if(unique.length!==1)return {status:unique.length?'ambiguous':'unmatched'};
   id=unique[0];
   var catalog=idx.rows[id],sources=catalog.sources,oldByProvider={},newByProvider={};
   known.forEach(function(x){oldByProvider[x.provider]=x;});
   sources.forEach(function(x){newByProvider[x.provider]=x;});
   for(var i=0;i<known.length;i++){
     var source=known[i],hits=idx.index[source.key]||[];
     if(hits.length!==1||hits[0]!==id)return {status:'ambiguous'};
     if(newByProvider[source.provider]&&newByProvider[source.provider].key!==source.key)
       return {status:'conflict'};
   }
   var joined=known.slice(),added=[];
   sources.forEach(function(source){
     if(!oldByProvider[source.provider]){
       if(joined.length<3){joined.push(source);added.push(source.provider);}
     }
   });
   if(!added.length)return {status:'complete',catalogId:id};
   var updated=copy(row);
   updated.provider=joined[0].provider;updated.url=joined[0].url;
   delete updated.alternateProvider;delete updated.alternateUrl;
   delete updated.thirdProvider;delete updated.thirdUrl;
   if(joined[1]){updated.alternateProvider=joined[1].provider;updated.alternateUrl=joined[1].url;}
   if(joined[2]){updated.thirdProvider=joined[2].provider;updated.thirdUrl=joined[2].url;}
   try{
     updated=kind==='artist'?API.featuredTrack(updated,1):API.languageTrack(updated,1);
   }catch(e){return {status:'conflict'};}
   return {status:'added',catalogId:id,row:updated,added:added};
 }
 function audit(data,catalog,API){
   if(!API||typeof API.songUrl!=='function'||typeof API.normalize!=='function')
     throw new Error('Модуль валидации публикации недоступен.');
   if(!Array.isArray(catalog)||catalog.length>=1200)
     throw new Error('Каталог не загружен полностью или достиг лимита 1200 записей.');
   var normalized=API.normalize(data),next=copy(normalized),idx=indexCatalog(catalog,API);
   var summary={catalogSongs:catalog.length,linked:0,addedSongs:0,addedLinks:0,
     complete:0,unmatched:0,ambiguous:0,conflict:0,genreIds:0,
     catalogLinks:idx.counts,bySection:{},examples:[]};
   function scan(label,rows,kind){
     if(!Array.isArray(rows))return;
     if(!summary.bySection[label])summary.bySection[label]={checked:0,improved:0,newLinks:0};
     rows.forEach(function(row,i){
       summary.linked++;summary.bySection[label].checked++;
       var result=mergeRow(row,idx,API,kind);
       if(result.status==='added'){
         rows[i]=result.row;
         summary.addedSongs++;summary.addedLinks+=result.added.length;
         summary.bySection[label].improved++;summary.bySection[label].newLinks+=result.added.length;
         if(summary.examples.length<20)summary.examples.push({
           section:label,title:String(row.title||''),
           added:result.added.join(', '),catalogId:result.catalogId
         });
       }else summary[result.status]++;
     });
   }
   (next.artists.cards||[]).forEach(function(a){
     scan('Артисты · '+a.title,a.featuredTracks,'artist');
   });
   ((next.genres.topics||{}).entries||[]).forEach(function(topic){
     scan('Темы · '+topic.label,topic.tracks,'collection');
   });
   ((next.genres.languages||{}).entries||[]).forEach(function(lang){
     scan('Языки · '+lang.label,lang.tracks,'collection');
   });
   (next.albums.entries||[]).forEach(function(album){
     scan('Альбомы · '+album.title,album.tracks,'collection');
   });
   (next.genres.entries||[]).forEach(function(g){
     summary.genreIds+=(g.songIds||[]).length;
   });
   // Strictly validate the whole next public/draft document; if any
   // cross-row constraint fails, report a conflict and refuse to apply.
   if(summary.addedLinks)next=API.normalize(next);
   return {next:next,summary:summary};
 }
 root.VMM_EXISTING_LINKS={audit:audit,key:key};
}(window));
