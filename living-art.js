/* RUN-071 — VELARDREAM Living Art, ES5 + progressively enhanced scrolling.
   No background loop, WebGL, fetching, private database or audio.
   A scroll animation frame is requested only while its chapter is visible.
   Older Safari, data saver and reduced-motion retain complete static content. */
(function(){
 'use strict';
 var chapter=null,crystal=null,outer=null,inner=null,far=null,near=null,beams=[],stanzas=[];
 var active=false,scheduled=0,currentPhase=-1,started=false,watcher=null;
 var visibleWatcher=null,media=null;
 function clamp(x){return Math.max(0,Math.min(1,x));}
 function scrollProgress(top,height,viewport){
   return clamp(-top/Math.max(1,height-viewport));
 }
 // RUN-088: readable, read-only diagnostics for desktop Edge/Windows.
 // Never override reduced-motion or Data Saver accessibility preferences.
 function motionStatus(){
   if(!window.IntersectionObserver||!window.requestAnimationFrame||
       !window.cancelAnimationFrame||!window.matchMedia)return 'unsupported-browser';
   if(window.innerHeight<520||window.innerWidth<320)return 'small-viewport';
   try{
     media=window.matchMedia('(prefers-reduced-motion: reduce)');
     if(media.matches)return 'reduced-motion';
     if(window.navigator&&window.navigator.connection&&window.navigator.connection.saveData)return 'data-saver';
     // Older Safari's sticky sections require reliable clip support.
     if(!window.CSS||!window.CSS.supports||!window.CSS.supports('overflow','clip'))
       return 'unsupported-clip';
   }catch(ignore){return 'unsupported-browser';}
   return 'enabled';
 }
 function supportsMotion(){return motionStatus()==='enabled';}
 function phaseFor(p){return p<.31?0:p<.68?1:2;}
 function apply(){
   scheduled=0;if(!active||!chapter)return;
   var rect=chapter.getBoundingClientRect();
   var p=scrollProgress(rect.top,chapter.offsetHeight,window.innerHeight);
   var lift=Math.sin(Math.PI*p);
   var size=(.78+.39*lift).toFixed(3);
   crystal.style.transform='translate3d(-50%,-50%,0) scale('+size+') translate3d(0,'+
      Math.round(-p*18)+'px,0)';
   outer.style.transform='translate3d(-50%,-50%,0) rotate('+
     Math.round(p*34)+'deg) scale('+(1+.08*p).toFixed(3)+')';
   inner.style.transform='translate3d(-50%,-50%,0) rotate('+
     Math.round(-p*42)+'deg) scale('+(1+.13*p).toFixed(3)+')';
   far.style.transform='translate3d(0,'+Math.round(-p*24)+'px,0)';
   near.style.transform='translate3d(0,'+Math.round(p*36)+'px,0)';
   beams.forEach(function(b,i){b.style.opacity=String(.17+p*(i===0?.57:.49));});
   var phase=phaseFor(p);
   if(phase!==currentPhase){
     currentPhase=phase;
     stanzas.forEach(function(el,i){
       el.className='crystal-journey-stanza'+(i===phase?' is-current':'');
     });
     chapter.setAttribute('data-journey-phase',String(phase+1));
   }
 }
 function schedule(){
   if(active&&!scheduled)scheduled=window.requestAnimationFrame(apply);
 }
 function attach(){
   if(active)return;
   active=true;
   window.addEventListener('scroll',schedule,{passive:true});
   window.addEventListener('resize',schedule);
   schedule();
 }
 function detach(){
   if(!active)return;
   active=false;
   window.removeEventListener('scroll',schedule);
   window.removeEventListener('resize',schedule);
   if(scheduled){window.cancelAnimationFrame(scheduled);scheduled=0;}
   // Free transformed surfaces when the chapter is no longer visible.
   // No audio or iframe is touched.
 }
 function enter(entries){
   for(var i=0;i<entries.length;i++){
     if(entries[i].target!==chapter)continue;
     if(entries[i].isIntersecting&&!document.hidden)attach();else detach();
   }
 }
 function reveal(entries){
   for(var i=0;i<entries.length;i++){
     if(!entries[i].isIntersecting)continue;
     var target=entries[i].target;
     if(target.className.indexOf('is-revealed')===-1)
       target.className+=' is-revealed';
     if(visibleWatcher)visibleWatcher.unobserve(target);
   }
 }
 function init(){
   if(started)return;
   chapter=document.getElementById('crystal-journey');
   if(!chapter)return;
   var status=motionStatus();
   chapter.setAttribute('data-motion-status',status);
   if(status!=='enabled')return;
   crystal=chapter.querySelector('.crystal-journey-crystal');
   outer=chapter.querySelector('.crystal-journey-ring--outer');
   inner=chapter.querySelector('.crystal-journey-ring--inner');
   far=chapter.querySelector('.crystal-journey-stars--far');
   near=chapter.querySelector('.crystal-journey-stars--near');
   beams=Array.prototype.slice.call(chapter.querySelectorAll('.crystal-journey-beam'));
   stanzas=Array.prototype.slice.call(chapter.querySelectorAll('.crystal-journey-stanza'));
   if(!crystal||!outer||!inner||!far||!near||stanzas.length!==3)return;
   started=true;
   watcher=new window.IntersectionObserver(enter,{threshold:0});
   watcher.observe(chapter);
   visibleWatcher=new window.IntersectionObserver(reveal,{
     rootMargin:'0px 0px -10% 0px',threshold:0
   });
   var selectors=['#artists .section-heading','#releases .section-heading',
     '#playlists .section-heading','#universe .universe-overline',
     '#languages .universe-overline','#genres .section-heading','#about .section-heading'];
   var sections=[];
   selectors.forEach(function(query){
     var element=document.querySelector(query);
     if(element){element.className+=' art-reveal';sections.push(element);}
   });
   document.documentElement.className+=' has-living-art';
   sections.forEach(function(element){visibleWatcher.observe(element);});
   document.addEventListener('visibilitychange',function(){
     if(document.hidden){detach();return;}
     if(!chapter)return;
     var bounds=chapter.getBoundingClientRect();
     if(bounds.bottom>0&&bounds.top<window.innerHeight)attach();
   });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
 window.VELAR_LIVING_ART={scrollProgress:scrollProgress,phaseFor:phaseFor,motionStatus:motionStatus};
}());
