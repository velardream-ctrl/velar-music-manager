/* Public stories use the approved landing snapshot only. ES5 / no private reads. */
(function(){
 'use strict';
 var data=null,host=null,opened=false,query='',topic='',language='',genre='',page=0;
 function el(tag,cls,t){var n=document.createElement(tag);if(cls)n.className=cls;if(t!==undefined)n.textContent=t;return n;}
 function clear(n){while(n.firstChild)n.removeChild(n.firstChild);}
 function norm(x){return String(x||'').toLowerCase().replace(/ё/g,'е').trim();}
 function urls(s){return [s.url,s.alternateUrl,s.thirdUrl].filter(Boolean);}
 function shares(a,b){return urls(a).some(function(u){return urls(b).indexOf(u)>=0;});}
 function model(value){
   var api=window.VMM_LANDING_SCHEMA;if(!api||!value)return [];
   var songs=api.homepageSongs(value),groups=value.genres||{},config=value.hero.songStories||{entries:[]};
   return songs.map(function(s){
     var r=(config.entries||[]).filter(function(x){return urls(s).indexOf(x.url)>=0;})[0];
     var release=(value.releases.cards||[]).filter(function(x){return x.visible&&x.kind==='single'&&urls(s).indexOf(x.mediaUrl)>=0&&norm(x.title)===norm(s.title);})[0];
     function labels(list){return (list||[]).filter(function(g){return g.visible&&!g.searchOnly&&(g.tracks||[]).some(function(t){return shares(t,s);});}).map(function(g){return g.label;});}
     return {song:s,description:r&&r.description||release&&release.description||'',keywords:r&&r.keywords||'',topics:labels(groups.topics&&groups.topics.entries),languages:labels(groups.languages&&groups.languages.entries),genres:labels(groups.entries)};
   });
 }
 function words(q){return norm(q).split(/[^a-zа-яäöå0-9]+/i).filter(function(w){return w.length>1&&['для','мне','про','песня','песню','песни','хочу','есть','подбери','посоветуй','найди','музыку','музыка','которая','чтобы','что','какая','какие','могу','об','на','как','расскажи','о','прошу'].indexOf(w)<0;});}
 function rank(r,q){if(!norm(q))return 1;if(norm(r.song.title)===norm(q))return 100;var hay=norm([r.song.title,r.song.artist,r.description,r.keywords,r.topics.join(' '),r.languages.join(' '),r.genres.join(' ')].join(' '));return words(q).reduce(function(n,w){return n+(hay.indexOf(w)>=0?3:w.length>=5&&hay.indexOf(w.slice(0,-1))>=0?1:0);},0);}
 function lookup(value,q){return model(value).filter(function(r){return !!r.description&&rank(r,q)>0;}).sort(function(a,b){return rank(b,q)-rank(a,q);});}
 function button(t,fn,cls){var n=el('button',cls||'story-chip',t);n.type='button';n.onclick=fn;return n;}
 function grouped(rows,key){var counts=Object.create(null);rows.forEach(function(r){r[key].forEach(function(t){counts[t]=(counts[t]||0)+1;});});return counts;}
 function tone(t){return /любов|расстав|имен|ревност/i.test(t)?'rose':/семь|друж|счаст|надеж|празд|верност/i.test(t)?'gold':/космос|природ|груст|путешеств/i.test(t)?'blue':'violet';}
 function card(r){var a=el('article','story-card'),title=el('h3','',r.song.title),meta=el('p','story-meta',[r.song.artist].concat(r.languages,r.genres).filter(Boolean).join(' · ')),desc=el('p','story-description',r.description||'Краткое описание готовится.');a.appendChild(title);a.appendChild(meta);a.appendChild(desc);
   var chips=el('div','story-cloud');r.topics.forEach(function(t){var b=button(t,function(){topic=t;query='';page=0;opened=true;draw();});b.setAttribute('data-tone',tone(t));chips.appendChild(b);});a.appendChild(chips);
   var links=el('div','story-links');[['provider','url'],['alternateProvider','alternateUrl'],['thirdProvider','thirdUrl']].forEach(function(keys){var p=r.song[keys[0]],u=r.song[keys[1]];if(!u)return;var l=el('a','button button-secondary',p==='spotify'?'Spotify':p==='appleMusic'?'Apple Music':'YouTube');l.href=u;l.target='_blank';l.rel='noopener noreferrer';links.appendChild(l);});a.appendChild(links);return a;
 }
 function draw(){if(!host||!data)return;clear(host);var rows=model(data),config=data.hero.songStories||{mode:'showcase'},described=rows.filter(function(r){return !!r.description;});
   if(!opened&&config.mode==='showcase'){
     if(described.length){var sorted=described.slice().sort(function(a,b){return a.song.title.localeCompare(b.song.title,'ru');});var day=Math.floor(Date.now()/86400000);host.appendChild(el('p','story-meta','ИСТОРИЯ ДНЯ'));host.appendChild(card(sorted[day%sorted.length]));}
     else host.appendChild(el('p','story-meta','Краткие истории готовятся. Уже можно искать музыку по темам, жанрам и языкам.'));
     host.appendChild(button('Открыть музыкальные истории',function(){opened=true;draw();},'button button-primary'));return;
   }
   if(config.mode==='showcase')host.appendChild(button('Свернуть каталог',function(){opened=false;draw();},'story-chip'));
   var cloud=el('div','story-cloud'),counts=grouped(rows,'topics');
   var all=button('Все темы',function(){topic='';page=0;update();});cloud.appendChild(all);
   Object.keys(counts).sort(function(a,b){return counts[b]-counts[a]||a.localeCompare(b,'ru');}).forEach(function(t){var b=button(t+' · '+counts[t],function(){topic=t;page=0;update();});b.style.fontSize=(13+Math.min(10,Math.sqrt(counts[t])*2))+'px';b.setAttribute('data-tone',tone(t));b.setAttribute('data-topic',t);cloud.appendChild(b);});host.appendChild(cloud);
   var filters=el('div','story-filters'),input=el('input','');input.type='search';input.placeholder='Имя, название или смысл песни';input.setAttribute('aria-label','Поиск музыкальных историй');input.value=query;input.oninput=function(){query=input.value;page=0;update();};filters.appendChild(input);
   function dropdown(key,label,current,change){var s=el('select',''),o=el('option','',label);o.value='';s.appendChild(o);Object.keys(grouped(rows,key)).sort().forEach(function(t){var o=el('option','',t);o.value=t;s.appendChild(o);});s.value=current;s.setAttribute('aria-label',label);s.onchange=function(){change(s.value);page=0;update();};filters.appendChild(s);return s;}
   var ls=dropdown('languages','Все языки',language,function(v){language=v;}),gs=dropdown('genres','Все жанры',genre,function(v){genre=v;});
   filters.appendChild(button('Сбросить',function(){query=topic=language=genre='';input.value=ls.value=gs.value='';page=0;update();}));host.appendChild(filters);
   var count=el('p','story-meta'),list=el('div','story-grid'),pager=el('div','story-links');count.setAttribute('aria-live','polite');host.appendChild(count);host.appendChild(list);host.appendChild(pager);
   function update(){clear(list);clear(pager);Array.prototype.forEach.call(cloud.children,function(b){b.setAttribute('aria-pressed',String((b.getAttribute('data-topic')||'')===topic));});
     var found=rows.filter(function(r){return (!topic||r.topics.indexOf(topic)>=0)&&(!language||r.languages.indexOf(language)>=0)&&(!genre||r.genres.indexOf(genre)>=0)&&rank(r,query)>0;});found.sort(function(a,b){return (query?rank(b,query)-rank(a,query):0)||a.song.title.localeCompare(b.song.title,'ru');});
     page=Math.max(0,Math.min(page,Math.max(0,Math.ceil(found.length/12)-1)));count.textContent='Найдено песен: '+found.length;found.slice(page*12,page*12+12).forEach(function(r){list.appendChild(card(r));});if(!found.length)list.appendChild(el('p','story-meta','Нет совпадений. Попробуйте другой запрос.'));
     if(page>0)pager.appendChild(button('← Назад',function(){page--;update();}));if((page+1)*12<found.length)pager.appendChild(button('Ещё песни →',function(){page++;update();}));
   }update();
 }
 function render(v){data=v;var palette=v.hero.palette==='classic'?'classic':'amethyst';if(document.body&&document.body.setAttribute)document.body.setAttribute('data-velar-palette',palette);
   host=document.getElementById('song-stories-host');var section=document.getElementById('song-stories');if(!section||!host)return;var config=v.hero.songStories||{mode:'showcase'};section.hidden=config.mode==='off';var nav=document.getElementById('story-nav');if(nav)nav.hidden=section.hidden;if(!section.hidden)draw();
 }
 function answer(q,v){if(!v||!v.hero.songStories||v.hero.songStories.mode==='off'||!/песн|музык|композиц|послуш|song|music/i.test(q))return null;var found=lookup(v,q).slice(0,3);if(!found.length)return null;return {text:found.map(function(r){return r.song.title+' — '+r.description;}).join('\n\n'),actions:[{action:'link',target:'#song-stories',query:q,label:'Открыть музыкальные истории'}]};}
 function open(q){if(!data||!host||data.hero.songStories.mode==='off')return false;opened=true;query=String(q||'');topic=language=genre='';page=0;draw();return true;}
 window.VELAR_STORIES={render:render,model:model,lookup:lookup,answer:answer,open:open};
}());