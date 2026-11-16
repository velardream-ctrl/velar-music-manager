/* RUN-143: scroll-driven musical resonance for playlist artwork. ES5/Safari12.
   Decorative only: no media, external requests, autoplay, timers or changes to playlist controls. */
(function(){
 'use strict';
 var arts=[],pending=false,reduced=false;
 try{reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(ignore){}
 function add(parent,tag,cls,words){
   var n=document.createElement(tag);n.className=cls;
   if(words)n.textContent=words;parent.appendChild(n);return n;
 }
 function decorate(art){
   if(!art||art.getAttribute('data-resonance-ready')==='true')return;
   art.setAttribute('data-resonance-ready','true');
   art.className+=' cms-playlist-art--resonance';
   while(art.firstChild)art.removeChild(art.firstChild);
   add(art,'span','playlist-resonance-halo');
   var a=add(art,'span','playlist-resonance-orbit playlist-resonance-orbit--one');
   add(a,'span','playlist-resonance-note playlist-resonance-note--top','♫');
   add(a,'span','playlist-resonance-note playlist-resonance-note--right','♪');
   var b=add(art,'span','playlist-resonance-orbit playlist-resonance-orbit--two');
   add(b,'span','playlist-resonance-note playlist-resonance-note--left','♬');
   add(b,'span','playlist-resonance-note playlist-resonance-note--upper','♪');
   add(art,'span','playlist-resonance-orbit playlist-resonance-orbit--three');
   add(art,'span','playlist-resonance-spark playlist-resonance-spark--one');
   add(art,'span','playlist-resonance-spark playlist-resonance-spark--two');
   add(art,'span','playlist-resonance-spark playlist-resonance-spark--three');
   add(art,'span','playlist-resonance-wave');
   var crystal=add(art,'span','playlist-resonance-crystal');
   var img=add(crystal,'img','playlist-resonance-symbol');
   img.src='assets/velardream-symbol.svg';img.alt='';img.setAttribute('aria-hidden','true');
   img.setAttribute('width','100');img.setAttribute('height','180');img.loading='lazy';
   add(art,'span','playlist-resonance-caption','МУЗЫКАЛЬНЫЙ РЕЗОНАНС');
   art.setAttribute('aria-label','Музыкальный резонанс — декоративная композиция');
   arts.push(art);schedule();
 }
 function draw(){
   pending=false;if(reduced)return;
   var height=window.innerHeight||700;
   arts.forEach(function(art){
     if(!art.getBoundingClientRect)return;
     var rect=art.getBoundingClientRect();
     if(rect.bottom<0||rect.top>height)return;
     var progress=Math.max(-1,Math.min(1,(height*.55-rect.top)/Math.max(1,height)));
     var angle=progress*75;
     art.style.setProperty('--resonance-one',angle.toFixed(2)+'deg');
     art.style.setProperty('--resonance-two',(-angle*.65).toFixed(2)+'deg');
     art.style.setProperty('--resonance-three',(angle*.35).toFixed(2)+'deg');
     art.style.setProperty('--resonance-pulse',(1+Math.abs(progress)*.045).toFixed(3));
     art.style.setProperty('--resonance-wave-opacity',(Math.abs(progress)*.26).toFixed(3));
     art.style.setProperty('--resonance-wave-scale',(1+Math.abs(progress)*.55).toFixed(3));
   });
 }
 function schedule(){if(!pending&&!reduced&&window.requestAnimationFrame){pending=true;window.requestAnimationFrame(draw);}}
 function init(){
   var nodes=document.querySelectorAll('.cms-playlist-art'),i;
   for(i=0;i<nodes.length;i++)decorate(nodes[i]);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 window.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',schedule);
 window.VELAR_PLAYLIST_RESONANCE={decorate:decorate,refresh:schedule};
}());
