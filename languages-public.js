/* RUN-072 — Real & invented languages, grouped by curator-approved songs.
   All data comes from the existing published landing document; no extra reads.
   Spotify/YouTube embeds load only after an explicit click. ES5/iOS12. */
(function(){
 'use strict';
 var current='',dataset=null,buttons=[],moreCount=14;
 function id(k){return document.getElementById(k);}
 function el(tag,cls,t){var n=document.createElement(tag);if(cls)n.className=cls;
   if(typeof t==='string')n.textContent=t;return n;}
 function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function entries(){
   if(!dataset||!Array.isArray(dataset.entries))return [];
   return dataset.entries.filter(function(x){return x.visible===true;});
 }
 function show(code,requestedUrl){
   var lang=null,detail=id('public-language-detail');
   entries().forEach(function(item){if(item.code===code)lang=item;});
   if(!lang)lang=entries()[0]||null;
   current=lang?lang.code:'';
   buttons.forEach(function(item){item.btn.setAttribute('aria-pressed',item.code===current?'true':'false');});
   if(!detail)return;
   clear(detail);
   if(!lang){detail.appendChild(el('p','language-empty','Языки ещё не опубликованы.'));return;}
   var head=el('div','language-detail-heading');
   head.appendChild(el('span','universe-info-kicker',lang.fictional?'АВТОРСКИЙ ВЫМЫШЛЕННЫЙ ЯЗЫК':'ЯЗЫК МУЗЫКИ'));
   head.appendChild(el('h3','',lang.label));
   detail.appendChild(head);
   var count=lang.tracks?lang.tracks.length:0;
   if(!count){
     detail.appendChild(el('p','language-empty','Для этого языка песни ещё не назначены в музыкальной студии. Здесь появятся только подтверждённые публикации.'));
     return;
   }
   detail.appendChild(el('p','language-total','Композиции: '+count+'. Выберите песню, чтобы открыть официальный плеер.'));
   var list=el('div','language-song-list');
   detail.appendChild(list);
   if(!window.VELAR_PUBLIC_SONGS){
     detail.appendChild(el('p','language-empty','Плеер временно недоступен.'));return false;
   }
   var player=window.VELAR_PUBLIC_SONGS.mount(list,lang.tracks,{prefix:'language',batch:14});
   // Chat deep-links are invoked only after the listener clicks its action.
   if(requestedUrl&&lang.code===code)return player.openByUrl(requestedUrl);
   return false;
 }
 function openFromChat(code,url){return show(code,url);}

 function render(config){
   var orbit=id('public-language-orbit'),detail=id('public-language-detail');
   if(!orbit||!detail)return;
   dataset=config||{heading:'Музыка на языках Вселенной',intro:'',entries:[]};
   var title=id('languages-title'),intro=id('languages-intro');
   if(title)title.textContent=dataset.heading;
   if(intro)intro.textContent=dataset.intro;
   clear(orbit);buttons=[];
   var visible=entries(),n=visible.length;
   orbit.className='language-orbit'+(n>16?' is-dense':'');
   // Two constellations surround the brand crystal on wide screens.
   var outer=Math.ceil(n*.68),inner=n-outer;
   visible.forEach(function(lang,index){
     var ring=index<outer?0:1;
     var place=ring===0?index:index-outer;
     var count=ring===0?outer:inner;
     var angle=-Math.PI/2+(Math.PI*2*(place+(ring?.35:0)))/Math.max(1,count);
     var x=50+(ring?25:43)*Math.cos(angle);
     var y=50+(ring?25:41)*Math.sin(angle);
     var chip=el('button','language-orbit-node');chip.type='button';
     chip.style.left=x.toFixed(2)+'%';chip.style.top=y.toFixed(2)+'%';
     chip.setAttribute('aria-label','Выбрать язык: '+lang.label);
     chip.setAttribute('aria-pressed','false');
     chip.appendChild(el('span','language-orbit-label',lang.label));
     chip.appendChild(el('small','',lang.tracks.length?String(lang.tracks.length)+' песен':'скоро'));
     chip.onclick=function(){show(lang.code);};
     buttons.push({btn:chip,code:lang.code});orbit.appendChild(chip);
   });
   show(current);
 }
 window.VELAR_LANGUAGES={render:render,entries:entries,show:show,openFromChat:openFromChat};
}());
