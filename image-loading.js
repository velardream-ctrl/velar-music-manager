/* RUN-123 — owner-controlled image loading, ES5 / Safari 12.
   Does not delay music embeds, private data or the site's logo. */
(function(){
 'use strict';
 var level=0,observer=null,pending=[];
 var cutoffs=[Infinity,4,2,1];
 function preview(){
   var search=window.location&&window.location.search||'';
   var match=/(?:^|[?&])imageLoadingTest=([0-3])(?:&|$)/.exec(search);
   return match?Number(match[1]):null;
 }
 function configure(saved){
   var selected=preview();
   if(selected===null)selected=saved;
   level=selected===0||selected===1||selected===2||selected===3?selected:0;
   if(observer){observer.disconnect();observer=null;}
   pending=[];
   return level;
 }
 function isFirst(index){
   return (typeof index==='number'?index:0)<cutoffs[level];
 }
 function loadingFor(index){
   return isFirst(index)?'eager':'lazy';
 }
 function apply(image,index){
   if(!image)return;
   image.loading=loadingFor(index);
 }
 function near(element,callback,index){
   if(typeof callback!=='function')return;
   // Gentle mode only adjusts native image scheduling. The first images
   // in any group always request their artwork immediately.
   if(level<2||isFirst(index)||!element||typeof window.IntersectionObserver!=='function'){
     callback();return;
   }
   if(!observer){
     try{
       observer=new window.IntersectionObserver(function(entries){
         entries.forEach(function(entry){
           if(!entry.isIntersecting&&entry.intersectionRatio<=0)return;
           for(var i=pending.length-1;i>=0;i--){
             var task=pending[i];
             if(task.element!==entry.target)continue;
             pending.splice(i,1);
             if(observer)observer.unobserve(task.element);
             task.callback();
           }
         });
       },{root:null,rootMargin:level===2?'950px':'300px',threshold:0});
     }catch(e){observer=null;callback();return;}
   }
   pending.push({element:element,callback:callback});
   try{observer.observe(element);}
   catch(ignore){
     pending.pop();callback();
   }
 }
 window.VELAR_IMAGE_LOADING={
   configure:configure,preview:preview,getLevel:function(){return level;},
   loadingFor:loadingFor,apply:apply,near:near
 };
}());
