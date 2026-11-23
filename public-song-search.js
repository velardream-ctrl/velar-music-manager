/* RUN-221: Search only the manually approved PUBLIC landing content.
   No reads from vmm_catalog, vmm_lyrics, private CMS drafts or accounts. */
(function(root){
 'use strict';
 function text(x){return typeof x==='string'?x:'';}
 function fold(x){return text(x).trim().toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');}
 function collect(page){
   page=page||{};var schema=root.VMM_LANDING_SCHEMA,all=[],seen={};
   if(!schema||typeof schema.songUrl!=='function')return all;
   function add(raw,group,artist,isRelease){
     if(!raw||typeof raw!=='object')return;
     var p=isRelease?raw.mediaProvider:raw.provider,
         u=isRelease?raw.mediaUrl:raw.url,
         url=schema.songUrl(u||'',p||'');
     if(!url||!text(raw.title).trim())return;
     var key=p+'|'+url,record=seen[key],
         title=text(raw.title).slice(0,110),
         label=text(isRelease?raw.subtitle:(raw.artist||artist)).slice(0,100),
         tags=text(raw.searchTags).slice(0,640),
         description=text(raw.searchDescription).slice(0,280);
     if(record){
       // Multiple approved placements of the same URL may each have owner tags.
       if(tags&&record.searchTags.indexOf(tags)<0)
         record.searchTags=(record.searchTags?record.searchTags+', ':'')+tags;
       if(!record.searchDescription&&description)record.searchDescription=description;
       return;
     }
     record={title:title,artist:label,provider:p,url:url,searchTags:tags,
       searchDescription:description,section:group};
     seen[key]=record;all.push(record);
   }
   function groupItems(rows,category){
     if(!Array.isArray(rows))return;
     rows.forEach(function(g){
       if(!g||g.visible!==true||!Array.isArray(g.tracks))return;
       g.tracks.forEach(function(song){add(song,category,g.artist||'',false);});
     });
   }
   groupItems(page.genres&&page.genres.entries,'genre');
   groupItems(page.genres&&page.genres.topics&&page.genres.topics.entries,'topic');
   groupItems(page.genres&&page.genres.languages&&page.genres.languages.entries,'language');
   groupItems(page.albums&&page.albums.entries,'album');
   (page.artists&&page.artists.cards||[]).forEach(function(a){
     if(a&&a.visible===true&&Array.isArray(a.featuredTracks))
       a.featuredTracks.forEach(function(song){add(song,'artist',a.title||'',false);});
   });
   (page.releases&&page.releases.cards||[]).forEach(function(release){
     if(release&&release.visible===true)add(release,'release','',true);
   });
   return all;
 }
 function matches(row,q){
   var search=root.VELAR_SONG_SEARCH_META;
   if(search&&search.matches)return search.matches(row,q);
   var query=fold(q),combined=fold([row.title,row.artist,row.searchTags,row.searchDescription].join(' '));
   return query.split(' ').every(function(t){return combined.indexOf(t)>=0;});
 }
 function find(page,q,limit){
   q=text(q).trim();if(q.length<2)return[];
   var rows=collect(page),hits=rows.filter(function(t){return matches(t,q);});
   hits.sort(function(a,b){return fold(a.title).localeCompare(fold(b.title),'ru');});
   return hits.slice(0,Math.max(1,Math.min(Number(limit)||40,100)));
 }
 root.VELAR_PUBLIC_SONG_SEARCH={collect:collect,find:find,matches:matches};
})(window);