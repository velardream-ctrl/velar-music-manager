/* RUN-222: private Suno style card library. Reads owner-verified in-memory lyrics
   from VMM_STUDIO only; never touches published CMS, analytics or external services.
   ES5 for old iPad Safari. */
(function(){
  'use strict';
  var panel=document.getElementById('vmm-style-library');
  if(!panel)return;
  var search=document.getElementById('style-library-search'),
      filter=document.getElementById('style-library-filter'),
      status=document.getElementById('style-library-status'),
      host=document.getElementById('style-library-results'),
      badge=document.getElementById('style-library-count'),
      exportButton=document.getElementById('style-library-export'),
      rows=[];
  var labels={unrated:'Без оценки',successful:'Удачный',
    candidate:'Проверить',weak:'Не подошёл'};
  function studio(){return window.VMM_STUDIO;}
  function helper(){return window.VMM_SUNO_STYLE_DATA;}
  function el(tag,css,text){
    var node=document.createElement(tag);if(css)node.className=css;
    if(text!==undefined)node.textContent=text;return node;
  }
  function clearNode(node){while(node.firstChild)node.removeChild(node.firstChild);}
  function pick(){
    return studio()&&studio().styleLibraryData?studio().styleLibraryData():[];
  }
  function groups(items){
    var map={},list=[];
    items.forEach(function(item){
      var style=(item.sunoStyle||'').trim(),
          cues=(item.sunoCues||'').trim();
      if(!style&&!cues)return;
      var key=(style?'style:':'cues:')+helper().fingerprint(style||cues),
          group=map[key];
      if(!group){
        group={title:style||'Команды из текста Suno',style:style,
          cues:cues,songs:[],key:key};
        map[key]=group;list.push(group);
      }
      group.songs.push(item);
      if(!group.cues&&cues)group.cues=cues;
    });
    return list;
  }
  function resultFilter(group,query,verdict){
    var qualifying=group.songs.filter(function(s){
      return verdict==='all'||(s.styleVerdict||'unrated')===verdict;
    });
    if(!qualifying.length)return false;
    var hay=helper().fingerprint([group.style,group.cues].concat(
      qualifying.map(function(s){return [s.title,s.artist,s.styleNotes].join(' ');})
    ).join(' ')),terms=helper().fingerprint(query).split(/\s+/);
    return terms.every(function(t){return !t||hay.indexOf(t)>=0;});
  }
  function render(){
    clearNode(host);
    var query=search.value||'',verdict=filter.value||'all';
    var items=groups(rows).filter(function(g){return resultFilter(g,query,verdict);});
    items.sort(function(a,b){
      function rank(g){return g.songs.some(function(s){return s.styleVerdict==='successful';})?0:
        g.songs.some(function(s){return s.styleVerdict==='candidate';})?1:2;}
      return rank(a)-rank(b)||a.title.toLocaleLowerCase('ru').localeCompare(b.title.toLocaleLowerCase('ru'),'ru');
    });
    badge.textContent=' · '+groups(rows).length+' стилей';
    status.textContent=items.length?'Найдено карточек: '+items.length+
      (items.length>100?' · показаны первые 100':'')+
      '. Список составлен из загруженных владельцем версий текстов.':
      'Пока нет подходящих сохранённых стилей. Скопируй Style of Music в поле песни и сохрани.';
    items.slice(0,100).forEach(function(group){
      var card=el('article','vmm-style-card'),title=el('h4','',group.title.length>150?group.title.slice(0,147)+'…':group.title);
      card.appendChild(title);
      var summary=el('p','vmm-style-card-summary','Использований: '+group.songs.length+
        ' · удачных оценок: '+group.songs.filter(function(s){return s.styleVerdict==='successful';}).length);
      card.appendChild(summary);
      var extra=el('details','vmm-style-card-detail'),
          name=el('summary','','Стиль, команды и связанные песни');
      extra.appendChild(name);
      if(group.style){
        extra.appendChild(el('strong','','Стиль Suno:'));
        extra.appendChild(el('pre','vmm-style-pre',group.style));
      }
      if(group.cues){
        extra.appendChild(el('strong','','Команды в тексте Suno:'));
        extra.appendChild(el('pre','vmm-style-pre',group.cues));
      }
      group.songs.forEach(function(song){
        var row=el('div','vmm-style-song');
        row.appendChild(el('span','',song.title+
          (song.version?' · '+song.version:'')+
          ' · '+(labels[song.styleVerdict]||labels.unrated)));
        if(song.styleNotes)row.appendChild(el('p','vmm-style-song-note',song.styleNotes));
        var open=el('button','secondary','Открыть');
        open.type='button';
        open.onclick=function(){
          if(!studio()||!studio().openLyricStyle||!studio().openLyricStyle(song.id))
            status.textContent='Нельзя открыть выбранную версию. Сначала сохрани текущие изменения или проверь доступ.';
        };
        row.appendChild(open);extra.appendChild(row);
      });
      card.appendChild(extra);
      var copy=el('button','secondary vmm-style-copy','Копировать стиль');
      copy.type='button';copy.disabled=!group.style;
      copy.onclick=function(){
        if(!navigator.clipboard||!navigator.clipboard.writeText){
          status.textContent='Буфер обмена недоступен. Открой карточку и выдели стиль вручную.';return;
        }
        navigator.clipboard.writeText(group.style).then(function(){
          status.textContent='Промпт Suno скопирован для нового творческого проекта.';
        }).catch(function(){status.textContent='Копирование заблокировано браузером.';});
      };
      card.appendChild(copy);host.appendChild(card);
    });
  }
  function refresh(){
    rows=pick();render();
  }
  function clear(){
    rows=[];clearNode(host);
    badge.textContent=' · нет данных';
    status.textContent='Личная картотека закрыта.';
  }
  search.addEventListener('input',render);
  filter.addEventListener('change',render);
  panel.addEventListener('toggle',function(){if(panel.open)refresh();});
  exportButton.onclick=function(){
    if(!studio()||!studio().styleLibraryData){
      status.textContent='Сначала войди в закрытую Studio.';return;
    }
    var items=pick().filter(function(r){return r.sunoStyle||r.sunoCues;});
    if(!items.length){status.textContent='Пока нет стилей для экспорта.';return;}
    var pack={format:'velardream-private-style-library-v1',
      warning:'Личный архив автора. Не публиковать без согласия.',
      exportedAt:new Date().toISOString(),
      count:items.length,styles:items};
    var blob=new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}),
        link=document.createElement('a'),url=URL.createObjectURL(blob);
    link.href=url;link.download='VelarDream_Suno_Styles_Private.json';
    document.body.appendChild(link);link.click();document.body.removeChild(link);
    window.setTimeout(function(){URL.revokeObjectURL(url);},1000);
    status.textContent='Личная картотека подготовлена к скачиванию. В файле нет текстов песен.';
  };
  window.VMM_STYLE_LIBRARY={refresh:refresh,clear:clear};
  clear();
})();
