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
   // RUN-171: a non-sticky iPhone chapter can be shorter than the visual
   // viewport. Animate over at least half a viewport instead of jumping
   // immediately from progress 0 to 1 on the first downward scroll.
   return clamp(-top/Math.max(1,height-viewport,isIPhoneWebKit()?viewport*.5:1));
 }
 function isIPhoneWebKit(){
   var ua=window.navigator&&window.navigator.userAgent||'';
   // All iPhone browsers use WebKit. Deliberately EXCLUDE iPads.
   return /iPhone|iPod/.test(ua);
 }
 function isLegacyIpad(){
   var ua=window.navigator&&window.navigator.userAgent||'';
   if(!/iPad/.test(ua))return false;
   var os=ua.match(/\bOS\s+(\d+)[_.]/);
   // RUN-173: on pre-iPadOS-14 iPad WebKit, CSS inset can collapse the
   // absolute sky to zero height. Leave every iPhone/new iPad untouched.
   return !!(os&&Number(os[1])<14);
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
 function phaseFor(p){var count=chapter?chapter.querySelectorAll('.crystal-journey-stanza').length:3;count=Math.max(1,count);if(count===3)return p<.31?0:p<.68?1:2;return Math.min(count-1,Math.floor(Math.min(.999999,Math.max(0,p))*count));}
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
 // RUN-176: Safari 12 old iPad uses a scroll-synchronized fixed stage
 // because CSS sticky can fail even when transforms and rAF work.
 // The chapter keeps its 200vh placeholder; the art does not leave the
 // viewport until all three narrative phases have been displayed.
 function legacyIpadFirstScreen(){
   // RUN-176: on iPad the header and hero together fill the first viewport.
   // The following crystal section starts BELOW it, never as a partial ring.
   var hero=document.querySelector('.hero');
   var header=document.querySelector('.site-header');
   if(!hero||!header)return;
   function fit(){
     var headerHeight=header.getBoundingClientRect().height||header.offsetHeight||0;
     hero.style.minHeight=Math.max(0,window.innerHeight-headerHeight)+'px';
   }
   window.addEventListener('resize',fit,false);
   window.addEventListener('orientationchange',fit,false);
   fit();
 }
 function legacyIpadMotion(){
   var stage=chapter.querySelector('.crystal-journey-stage');
   var image=chapter.querySelector('.crystal-journey-crystal');
   var outerRing=chapter.querySelector('.crystal-journey-ring--outer');
   var innerRing=chapter.querySelector('.crystal-journey-ring--inner');
   var captions=chapter.querySelectorAll('.crystal-journey-stanza');
   if(!stage||!image||!outerRing||!innerRing||!captions||!captions.length)return;
   var reduced=false,saveData=false;
   try{reduced=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
   catch(ignore){}
   saveData=!!(window.navigator&&window.navigator.connection&&window.navigator.connection.saveData);
   if(reduced||saveData)return; // Static full-screen scene; never pin without motion.
   if(!window.requestAnimationFrame)return;
   var queued=false,lastPhase=-1;
   function draw(){
     queued=false;
     if(document.hidden)return;
     var r=chapter.getBoundingClientRect(),viewport=window.innerHeight;
     var duration=Math.max(1,chapter.offsetHeight-viewport);
     // Before chapter: ordinary flow. In chapter: fixed to viewport.
     // After chapter: settle at bottom, without layout jumps.
     if(r.top>0){
       stage.className=stage.className.replace(/ legacy-crystal-pinned| legacy-crystal-ended/g,'');
     }else if(r.bottom>viewport){
       if(stage.className.indexOf('legacy-crystal-pinned')===-1)
         stage.className=stage.className.replace(/ legacy-crystal-ended/g,'')+' legacy-crystal-pinned';
     }else{
       if(stage.className.indexOf('legacy-crystal-ended')===-1)
         stage.className=stage.className.replace(/ legacy-crystal-pinned/g,'')+' legacy-crystal-ended';
     }
     if(r.bottom<0||r.top>viewport)return;
     var p=clamp(-r.top/duration);
     captions=chapter.querySelectorAll('.crystal-journey-stanza');
     image.style.transform='translate(-50%,-50%) scale('+(0.90+.27*p).toFixed(3)+')';
     outerRing.style.transform='translate(-50%,-50%) rotate('+Math.round(65*p)+'deg)';
     innerRing.style.transform='translate(-50%,-50%) rotate('+Math.round(-75*p)+'deg)';
     var phase=phaseFor(p);
     if(phase!==lastPhase){
       lastPhase=phase;
       for(var i=0;i<captions.length;i++)
         captions[i].className='crystal-journey-stanza'+(i===phase?' is-current':'');
       chapter.setAttribute('data-journey-phase',String(phase+1));
     }
   }
   function schedule(){if(!queued){queued=true;window.requestAnimationFrame(draw);}}
   window.addEventListener('scroll',schedule,false);
   window.addEventListener('resize',schedule,false);
   window.addEventListener('orientationchange',schedule,false);
   document.addEventListener('visibilitychange',schedule,false);
   schedule();
 }
 function init(){
   if(started)return;
   chapter=document.getElementById('crystal-journey');
   if(!chapter)return;
   // RUN-171: iOS WebKit may scroll sticky/fixed layers as though they
   // belong to the document. Limit the stable-layout override to iPhone.
   // Keep the scroll-driven animations in JS; only the sticky CSS changes.
   if(isIPhoneWebKit()&&document.documentElement.className.indexOf('ios-scroll-stable')===-1)
     document.documentElement.className+=' ios-scroll-stable';
   var legacy=isLegacyIpad();
   if(legacy&&document.documentElement.className.indexOf('legacy-ipad-crystal')===-1)
     document.documentElement.className+=' legacy-ipad-crystal';
   var status=motionStatus();
   chapter.setAttribute('data-motion-status',status);
   // Old iPad never gets has-living-art sticky heights. The ES5 scroll
   // animation is independent of IntersectionObserver and remains optional.
   if(legacy){legacyIpadFirstScreen();legacyIpadMotion();return;}
   if(status!=='enabled')return;
   crystal=chapter.querySelector('.crystal-journey-crystal');
   outer=chapter.querySelector('.crystal-journey-ring--outer');
   inner=chapter.querySelector('.crystal-journey-ring--inner');
   far=chapter.querySelector('.crystal-journey-stars--far');
   near=chapter.querySelector('.crystal-journey-stars--near');
   beams=Array.prototype.slice.call(chapter.querySelectorAll('.crystal-journey-beam'));
   stanzas=Array.prototype.slice.call(chapter.querySelectorAll('.crystal-journey-stanza'));
   if(!crystal||!outer||!inner||!far||!near||!stanzas.length)return;
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
 window.VELAR_JOURNEY_REFRESH=function(){if(!chapter)return;stanzas=Array.prototype.slice.call(chapter.querySelectorAll('.crystal-journey-stanza'));currentPhase=-1;schedule();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
 else init();
 window.VELAR_LIVING_ART={scrollProgress:scrollProgress,phaseFor:phaseFor,motionStatus:motionStatus};
}());
