/* RUN-072 — editable music constellations, genuine logo-crystal center.
   ES5 / Safari12, no WebGL, no timed orbit, no extra Firestore or media. */
(function(){
 'use strict';
 var stage=null,details=null,opened=false,buttons=[],beams=[],data=null;
 var selected='',initialized=false,orbitStep=0;
 var allowed={artists:'#artists',releases:'#releases',playlists:'#playlists',
   genres:'#genres',languages:'#languages',about:'#about',radio:'#playlists'};
 function el(tag,cls,t){
   var n=document.createElement(tag);if(cls)n.className=cls;
   if(typeof t==='string')n.textContent=t;
   return n;
 }
 function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
 function config(){
   if(data&&data.genres&&data.genres.universe)return data.genres.universe;
   if(window.VMM_LANDING_SCHEMA)return window.VMM_LANDING_SCHEMA.defaults().genres.universe;
   return {heading:'Вселенная, которую можно услышать',intro:'Откройте мир музыки',nodes:[]};
 }
 function visibleNodes(){
   return config().nodes.filter(function(n){return n.visible===true;});
 }
 function counts(d){
   d=d||{};
   var artist=(d.artists||{}).cards||[],releases=(d.releases||{}).cards||[];
   var r=d.releases||{},g=d.genres||{};
   return {
     artists:artist.filter(function(x){return x.visible;}).length,
     releases:releases.filter(function(x){return x.visible&&x.kind!=='video';}).length,
     videos:releases.filter(function(x){return x.visible&&x.kind==='video';}).length,
     playlists:(r.playlists||[]).filter(function(x){return x.visible;}).length,
     genres:(g.tags||[]).length,
     languages:((g.languages||{}).entries||[]).filter(function(x){return x.visible;}).length,
     radio:r.radio&&r.radio.enabled?1:0,
     about:1
   };
 }
 function nodeCount(n){
   var countsNow=counts(data),key=n.id==='videos'?'videos':n.target;
   return typeof countsNow[key]==='number'?countsNow[key]:null;
 }
 function choose(id){
   var nodes=visibleNodes(),item=null;
   nodes.forEach(function(n){if(n.id===id)item=n;});
   if(!item){item=nodes[0]||null;if(item)id=item.id;}
   selected=item?item.id:'';
   nodes.forEach(function(n,i){
     if(buttons[i])buttons[i].setAttribute('aria-pressed',n.id===selected?'true':'false');
   });
   beams.forEach(function(p,i){p.setAttribute('class',nodes[i]&&nodes[i].id===selected?
     'universe-beam is-active':'universe-beam');});
   if(!details)return;
   clear(details);
   if(!item){
     details.appendChild(el('p','universe-info-count','Добавьте созвездия в музыкальной студии.'));
     return;
   }
   details.appendChild(el('span','universe-info-kicker','ВЫБРАННОЕ СОЗВЕЗДИЕ'));
   details.appendChild(el('h3','',item.label));
   if(item.description)details.appendChild(el('p','',item.description));
   var count=nodeCount(item);
   if(count!==null){
     var info=item.target==='radio'?(count?'Плейлист доступен':'Плейлист готовится'):
       (count?String(count)+' в открытом каталоге':'Здесь готовится музыка');
     details.appendChild(el('span','universe-info-count',info));
   }
   var go=el('a','universe-go',item.target==='languages'?'Выбрать язык':'Открыть раздел');
   go.href=allowed[item.target]||'#universe';
   details.appendChild(go);
 }
 function draw(){
   if(!stage)return;
   clear(stage);buttons=[];beams=[];
   var nodes=visibleNodes(),dense=nodes.length>8;
   stage.className='universe-stage'+(dense?' is-dense':'');
   if(document.createElementNS&&!dense){
     var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
     svg.setAttribute('viewBox','0 0 960 560');svg.setAttribute('aria-hidden','true');
     svg.setAttribute('class','universe-connectors');svg.setAttribute('preserveAspectRatio','none');
     stage.appendChild(svg);
   }
   // Official standalone logo symbol only. No planet, wave or drawn substitute.
   var center=el('button','universe-core');center.type='button';
   center.setAttribute('aria-label','Кристалл VELARDREAM — выбрать первое созвездие');
   center.onclick=function(){var list=visibleNodes();if(list.length)choose(list[0].id);};
   center.appendChild(el('span','universe-core-light'));
   var crystal=el('img','universe-core-crystal');
   crystal.src='assets/velardream-symbol.svg';crystal.alt='';
   crystal.loading='lazy';crystal.decoding='async';
   center.appendChild(crystal);stage.appendChild(center);
   nodes.forEach(function(n,i){
     // Orbit is visitor-driven (next/previous), never a costly idle loop.
     var a=(-Math.PI/2)+(2*Math.PI*(i+orbitStep))/Math.max(1,nodes.length);
     var x=50+37*Math.cos(a),y=50+34*Math.sin(a);
     if(!dense&&document.createElementNS){
       var p=document.createElementNS('http://www.w3.org/2000/svg','path');
       p.setAttribute('d','M480 280 L'+Math.round(960*x/100)+' '+Math.round(560*y/100));
       p.setAttribute('class','universe-beam');
       beams.push(p);stage.firstChild.appendChild(p);
     }
     var btn=el('button','universe-node');btn.type='button';
     btn.style.left=x.toFixed(2)+'%';btn.style.top=y.toFixed(2)+'%';
     btn.setAttribute('aria-label','Выбрать созвездие: '+n.label);
     btn.setAttribute('aria-pressed','false');
     btn.appendChild(el('span','universe-node-mark',('0'+(i+1)).slice(-2)));
     btn.appendChild(el('span','universe-node-name',n.label));
     btn.onclick=function(){choose(n.id);};
     btn.onfocus=function(){choose(n.id);};
     buttons.push(btn);stage.appendChild(btn);
   });
   choose(selected);
 }
 function init(){
   if(initialized)return;
   var toggle=document.getElementById('velar-universe-toggle');
   var panel=document.getElementById('velar-universe-panel');
   stage=document.getElementById('velar-universe-stage');
   details=document.getElementById('velar-universe-details');
   if(!toggle||!panel||!stage||!details)return;
   initialized=true;
   var hero=document.getElementById('hero-crystal-link');
   if(hero)hero.onclick=function(){if(!opened)toggle.onclick();};
   toggle.onclick=function(){
     opened=!opened;panel.className=opened?'universe-panel':'universe-panel hidden';
     toggle.setAttribute('aria-expanded',opened?'true':'false');
     toggle.textContent=opened?'Закрыть вселенную':'Исследовать вселенную';
     if(opened)draw();else stage.style.transform='';
   };
   function rotate(direction){
     if(!opened)return;
     var total=visibleNodes().length;
     orbitStep=total?(orbitStep+direction+total)%total:0;
     draw();
   }
   var left=document.getElementById('universe-orbit-left');
   var right=document.getElementById('universe-orbit-right');
   if(left)left.onclick=function(){rotate(-1);};
   if(right)right.onclick=function(){rotate(1);};
   var hover=false;
   try{hover=!!(window.matchMedia&&window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches);}
   catch(ignore){}
   if(hover){
     stage.onmousemove=function(evt){
       if(!opened||!stage.getBoundingClientRect)return;
       var box=stage.getBoundingClientRect();
       if(!box.width||!box.height)return;
       var dx=(evt.clientX-box.left)/box.width-.5,dy=(evt.clientY-box.top)/box.height-.5;
       stage.style.transform='perspective(900px) rotateY('+(dx*7).toFixed(1)+'deg) rotateX('+(-dy*7).toFixed(1)+'deg)';
     };
     stage.onmouseleave=function(){stage.style.transform='';};
   }
 }
 function render(d){
   data=d||data;init();
   var c=config();
   var title=document.getElementById('universe-title'),intro=document.getElementById('universe-intro');
   if(title)title.textContent=c.heading;
   if(intro)intro.textContent=c.intro;
   if(opened)draw();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.VELAR_UNIVERSE={render:render,counts:counts,visibleNodes:visibleNodes};
}());
