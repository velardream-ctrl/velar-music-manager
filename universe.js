/* RUN-070. VELARDREAM UNIVERSE — opt-in CSS depth, zero external requests.
   ES5/Safari12: no WebGL, timers, idle animation or private catalog reads. */
(function(){
 'use strict';
 var stage=null,details=null,opened=false,buttons=[],beams=[],data=null,active='artists',initialized=false;
 var nodes=[
  ['artists','Артисты','#artists',19,29,'Голоса и истории исполнителей'],
  ['releases','Релизы','#releases',50,17,'Синглы и альбомы'],
  ['videos','Клипы','#releases',81,29,'Видео и музыкальные премьеры'],
  ['playlists','Плейлисты','#playlists',23,76,'Авторские музыкальные подборки'],
  ['genres','Жанры','#genres',51,75,'От оперы до новых звуков'],
  ['radio','VELAR RADIO','#playlists',79,74,'Официальный плейлист для слушателей']
 ];
 function el(tag,cls,t){var n=document.createElement(tag);if(cls)n.className=cls;
   if(typeof t==='string')n.textContent=t;return n;}
 function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function counts(d){
   d=d||{};var a=(d.artists||{}).cards||[],r=d.releases||{},c=r.cards||[];
   return {artists:a.filter(function(x){return x.visible;}).length,
     releases:c.filter(function(x){return x.visible&&x.kind!=='video';}).length,
     videos:c.filter(function(x){return x.visible&&x.kind==='video';}).length,
     playlists:(r.playlists||[]).filter(function(x){return x.visible;}).length,
     genres:((d.genres||{}).tags||[]).length,radio:r.radio&&r.radio.enabled?1:0};
 }
 function select(id){
   active=id;var node=null;
   nodes.forEach(function(n,i){if(n[0]===id)node=n;
     if(buttons[i])buttons[i].setAttribute('aria-pressed',n[0]===id?'true':'false');});
   if(!node||!details)return;
   beams.forEach(function(line,i){line.setAttribute('class',nodes[i][0]===id?'universe-beam is-active':'universe-beam');});
   clear(details);
   details.appendChild(el('span','universe-info-kicker','ВЫБРАННОЕ СОЗВЕЗДИЕ'));
   details.appendChild(el('h3','',node[1]));details.appendChild(el('p','',node[5]));
   var count=counts(data)[id];
   details.appendChild(el('span','universe-info-count',id==='radio'?
     (count?'Плейлист доступен':'Плейлист готовится'):
     count?count+' в открытом каталоге':'Скоро здесь будет музыка'));
   var link=el('a','universe-go','Открыть раздел');link.href=node[2];
   details.appendChild(link);
 }
 function draw(){
   if(!stage)return;clear(stage);buttons=[];beams=[];
   // Decorative star lines: SVG markup is local, not a fetched image.
   if(document.createElementNS){
     var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
     svg.setAttribute('viewBox','0 0 960 560');svg.setAttribute('aria-hidden','true');
     svg.setAttribute('class','universe-connectors');
     svg.setAttribute('preserveAspectRatio','none');
     nodes.forEach(function(n){
       var p=document.createElementNS('http://www.w3.org/2000/svg','path');
       p.setAttribute('d','M480 280 L'+Math.round(n[3]*9.6)+' '+Math.round(n[4]*5.6));
       p.setAttribute('class','universe-beam');beams.push(p);svg.appendChild(p);
     });
     stage.appendChild(svg);
   }
   // The universe is built around the *actual* VELARDREAM crystal mark,
   // reused from the hero asset already cached by the public shell.
   // Never synthesize a planet/orb in place of the logo.
   var center=el('button','universe-core');center.type='button';
   center.setAttribute('aria-label','Кристалл VELARDREAM — показать мир артистов');
   center.onclick=function(){select('artists');};
   var light=el('span','universe-core-light');center.appendChild(light);
   var crystal=el('img','universe-core-crystal');crystal.src='assets/velardream-crystal.png';
   crystal.alt='';crystal.loading='lazy';crystal.decoding='async';
   center.appendChild(crystal);stage.appendChild(center);
   nodes.forEach(function(n,i){
     var btn=el('button','universe-node universe-node--'+n[0]);btn.type='button';
     btn.setAttribute('aria-label','Выбрать: '+n[1]);btn.setAttribute('aria-pressed','false');
     btn.style.left=n[3]+'%';btn.style.top=n[4]+'%';
     btn.appendChild(el('span','universe-node-mark',('0'+(i+1)).slice(-2)));
     btn.appendChild(el('span','universe-node-name',n[1]));
     btn.onclick=function(){select(n[0]);};btn.onfocus=function(){select(n[0]);};
     buttons.push(btn);stage.appendChild(btn);
   });
   select(active);
 }
 function init(){
   if(initialized)return;
   var toggle=document.getElementById('velar-universe-toggle');
   var panel=document.getElementById('velar-universe-panel');
   stage=document.getElementById('velar-universe-stage');
   details=document.getElementById('velar-universe-details');
   if(!toggle||!panel||!stage||!details)return;
   initialized=true;
   var heroCrystal=document.getElementById('hero-crystal-link');
   if(heroCrystal)heroCrystal.onclick=function(){
     if(!opened)toggle.onclick();
   };
   toggle.onclick=function(){
     opened=!opened;panel.className=opened?'universe-panel':'universe-panel hidden';
     toggle.setAttribute('aria-expanded',opened?'true':'false');
     toggle.textContent=opened?'Закрыть вселенную':'Исследовать вселенную';
     if(opened)draw();else stage.style.transform='';
   };
   var hover=false;
   try{hover=!!(window.matchMedia&&window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches);}catch(e){}
   if(hover){
     stage.onmousemove=function(e){
       if(!opened||!stage.getBoundingClientRect)return;
       var box=stage.getBoundingClientRect();
       if(!box.width||!box.height)return;
       var x=(e.clientX-box.left)/box.width-.5,y=(e.clientY-box.top)/box.height-.5;
       stage.style.transform='perspective(900px) rotateY('+(x*8).toFixed(1)+'deg) rotateX('+(-y*8).toFixed(1)+'deg)';
     };
     stage.onmouseleave=function(){stage.style.transform='';};
   }
 }
 function render(d){data=d||data;init();if(opened)draw();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.VELAR_UNIVERSE={render:render,counts:counts};
}());
