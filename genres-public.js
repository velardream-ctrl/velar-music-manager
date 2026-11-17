/* RUN-178 — published genre selections, no private catalog reads.
   ES5-compatible for legacy iPad Safari; iframe created only after interaction. */
(function(){
 'use strict';
 var current='',items=[],buttons=[];
 function byId(id){return document.getElementById(id);}
 function el(tag,cls,content){var n=document.createElement(tag);if(cls)n.className=cls;if(typeof content==='string')n.textContent=content;return n;}
 function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function available(){return items.filter(function(g){return g.visible===true;});}
 function select(id){
   var list=available(),selected=null,detail=byId('public-genre-detail');
   list.forEach(function(g){if(g.id===id)selected=g;});
   if(!selected)selected=list[0]||null;
   current=selected?selected.id:'';
   buttons.forEach(function(b){b.node.setAttribute('aria-pressed',b.id===current?'true':'false');});
   if(!detail)return;
   clear(detail);
   if(!selected){detail.appendChild(el('p','topic-empty','Жанры пока не опубликованы.'));return;}
   var heading=el('h3','genre-detail-title',selected.label);
   detail.appendChild(heading);
   if(!selected.tracks.length){
     detail.appendChild(el('p','topic-empty','В этом жанре пока нет опубликованных песен.'));
     return;
   }
   detail.appendChild(el('p','topic-count','Песен в жанре: '+selected.tracks.length));
   var songs=el('div','topic-song-list');
   detail.appendChild(songs);
   if(!window.VELAR_PUBLIC_SONGS||!window.VELAR_PUBLIC_SONGS.mount){
     detail.appendChild(el('p','topic-empty','Плеер временно недоступен.'));return;
   }
   window.VELAR_PUBLIC_SONGS.mount(songs,selected.tracks,{prefix:'genre',batch:12});
 }
 function render(value){
   var holder=byId('public-genres-tags');
   if(!holder)return;
   items=value&&Array.isArray(value.entries)?value.entries:[];
   clear(holder);buttons=[];
   available().forEach(function(g){
     var button=el('button','genre-select',g.label);
     button.type='button';button.setAttribute('aria-pressed','false');
     button.setAttribute('aria-label','Показать песни жанра '+g.label);
     button.onclick=function(){select(g.id);};
     holder.appendChild(button);buttons.push({id:g.id,node:button});
   });
   select(current);
 }
 window.VELAR_GENRES={render:render,select:select};
}());
