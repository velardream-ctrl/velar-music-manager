/* Owner-only file workflow. No network calls except existing authenticated reads in caller. */
(function(){
 'use strict';
 function str(x){return String(x==null?'':x).trim();}
 function key(x){return str(x).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');}
 function words(x){return str(x).replace(/\[[^\]]*\]/g,'').replace(/^\s*\*\*[^\n]*\*\*\s*$/gm,'').replace(/^\s*#{1,6}[^\n]*$/gm,'').trim();}
 function links(s){return [s.url,s.alternateUrl,s.thirdUrl].filter(Boolean);}
 function official(t,api){return ['spotify','youtube','appleMusic'].map(function(p){return api.songUrl((t.links||{})[p]||'',p);}).filter(Boolean);}
 function overlap(a,b){return a.some(function(u){return b.indexOf(u)>=0;});}
 function existing(s,config){return config.entries.filter(function(r){return links(s).indexOf(r.url)>=0;})[0];}
 function matchLyric(l,catalog){
   var matches=catalog.filter(function(c){return key(c.title)===key(l.title)&&str(c.sourceRow)&&str(l.catalogRow)&&str(c.sourceRow)===str(l.catalogRow);});
   if(matches.length===1)return matches[0];if(matches.length)return null;
   matches=catalog.filter(function(c){return key(c.title)===key(l.title)&&str(c.upc)&&str(c.upc)===str(l.upc);});
   return matches.length===1?matches[0]:null;
 }
 function build(data,catalog,lyrics,api){
   var songs=api.homepageSongs(data),config=data.hero.songStories,items=[],stats={existing:0,instrumental:0,missing:0,ambiguous:0};
   var assigned=Object.create(null);
   lyrics.forEach(function(l){var c=matchLyric(l,catalog);if(c&&words(l.text)){(assigned[c.id]||(assigned[c.id]=[])).push(l);}});
   songs.forEach(function(s){
     var r=existing(s,config);if(r&&r.description){stats.existing++;return;}
     var m=catalog.filter(function(c){return overlap(links(s),official(c,api));});
     if(m.length!==1){stats.ambiguous++;return;}var c=m[0];if(c.instrumental===true){stats.instrumental++;return;}
     var records=assigned[c.id]||[];if(!records.length){stats.missing++;return;}
     items.push({url:s.url,title:s.title,artist:s.artist,versions:records.map(function(l){return {language:str(l.language),version:str(l.version),text:str(l.text)};})});
   });
   return {format:'velar-story-analysis-v1',instructions:'Return JSON object {format:"velar-story-results-v1",items:[{url,title,description,keywords,topics:[existing topic labels]}]}. Read lyrics; describe meaning in Russian, 1-2 original sentences, max 420 chars; keywords max 250 chars. Do not quote lyrics or invent details. If versions differ materially, omit and flag separately. Use existing broad themes; do not infer musical genre from lyrics.',topics:data.genres.topics.entries.filter(function(t){return t.visible&&!t.searchOnly;}).map(function(t){return {label:t.label,slug:t.slug};}),stats:stats,items:items};
 }
 function review(raw,data,api){
   var rows=Array.isArray(raw)?raw:raw&&raw.format==='velar-story-results-v1'?raw.items:null;
   if(!Array.isArray(rows)||rows.length>400)throw Error('Нужен файл результатов анализа (до 400 записей).');
   var songs=api.homepageSongs(data),config=data.hero.songStories,seen=Object.create(null),out=[],skipped=[];
   rows.forEach(function(row){
     if(!row||typeof row.url!=='string'||typeof row.description!=='string'||!row.description.trim()||row.description.trim().length>420||typeof row.title!=='string'){skipped.push({title:row&&row.title||'Запись',reason:'Некорректное описание или ссылка'});return;}
     var u=api.songUrl(row.url,'spotify')||api.songUrl(row.url,'youtube')||api.songUrl(row.url,'appleMusic');
     var m=songs.filter(function(s){return u&&links(s).indexOf(u)>=0;});
     if(m.length!==1||key(m[0].title)!==key(row.title)||seen[m[0].url]){skipped.push({title:row.title,reason:'Неоднозначная, повторная или изменившаяся запись'});return;}var s=m[0],old=existing(s,config);
     if(old&&old.description){skipped.push({title:s.title,reason:'Описание уже существует'});return;}
     seen[s.url]=true;var topics=[],unknown=[];
     (Array.isArray(row.topics)?row.topics:[]).slice(0,8).forEach(function(t){if(typeof t!=='string')return;var found=data.genres.topics.entries.filter(function(g){return g.visible&&!g.searchOnly&&(key(g.label)===key(t)||g.slug===t);});if(found.length===1){if(topics.indexOf(found[0].slug)<0)topics.push(found[0].slug);}else unknown.push(t);});
     out.push({url:s.url,title:s.title,artist:s.artist,description:row.description.trim(),keywords:typeof row.keywords==='string'?row.keywords.trim().slice(0,250):'',topics:topics,unknown:unknown});
   });return {items:out,skipped:skipped};
 }
 function apply(rows,data,api,addTopics){
   var copy=JSON.parse(JSON.stringify(data)),songs=api.homepageSongs(copy),config=copy.hero.songStories,added=0,assigned=0;
   rows.forEach(function(row){var matches=songs.filter(function(s){return links(s).indexOf(row.url)>=0&&key(s.title)===key(row.title);});if(matches.length!==1)return;var s=matches[0],r=existing(s,config);if(r&&r.description)return;if(!r){r={url:s.url,description:'',keywords:''};config.entries.push(r);}r.description=row.description;if(!r.keywords)r.keywords=row.keywords;added++;
     if(addTopics)(row.topics||[]).forEach(function(slug){var g=copy.genres.topics.entries.filter(function(t){return t.slug===slug&&t.visible&&!t.searchOnly;})[0];if(!g||g.tracks.some(function(t){return overlap(links(s),links(t))||key(t.title)===key(s.title)&&key(t.artist)===key(s.artist);}))return;g.tracks.push(api.languageTrack(s,g.tracks.length+1));assigned++;});
   });var validated=api.normalize(copy);return {hero:validated.hero.songStories,topics:validated.genres.topics,added:added,assigned:assigned};
 }
 // Owner-only aggregation; never returns lyric content, titles, IDs or links.
 function coverage(data,catalog,lyrics,api){
   var c=data.about.progress.coverage||{},done=Object.create(null);
   lyrics.forEach(function(l){
     var song=matchLyric(l,catalog),text=words(l.text);
     // Formatting-only records are not words; count each matched song once, not versions.
     if(song&&song.instrumental!==true&&/[A-Za-z\u00C0-\u02AF\u0370-\u052F\u0590-\u08FF\u0900-\u1FFF\u3040-\u30FF\u3400-\u9FFF]/.test(text))done[song.id]=true;
   });
   var songs=api.homepageSongs(data),entries=data.hero.songStories.entries||[];
   return {automatic:c.automatic!==false,showLyrics:c.showLyrics!==false,showStories:c.showStories!==false,
     lyricsTotal:catalog.filter(function(s){return s.instrumental!==true;}).length,lyricsCompleted:Object.keys(done).length,
     storiesTotal:songs.length,storiesCompleted:songs.filter(function(s){return entries.some(function(r){return str(r.description)&&links(s).indexOf(r.url)>=0;})||(data.releases.cards||[]).some(function(r){return r.visible&&r.kind==='single'&&key(r.title)===key(s.title)&&links(s).indexOf(r.mediaUrl)>=0&&str(r.description);});}).length,
     updatedAt:new Date().toISOString().slice(0,10)};
 }
 window.VMM_STORY_BATCH={build:build,review:review,apply:apply,coverage:coverage};
}());