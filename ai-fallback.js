/* RUN-195 — fallback policy for optional Cloudflare responses.
   No secrets or external calls here. Public chatbot remains local-only
   until a separately approved server-side public gateway is deployed. */
(function(root){
 "use strict";
 var cooldownUntil=0, failures=0;
 var DAY=24*60*60*1000;
 function quota(error){
   var s=String(error&&((error.code||error.error)||error.message)||error||'').toLowerCase();
   return /quota|limit|neurons|exhausted|429|resource_exhausted/.test(s);
 }
 function offer(localAnswer,externalRequest,options){
   options=options||{};
   var now=typeof options.now==='function'?options.now:Date.now;
   var local=typeof localAnswer==='function'?localAnswer:function(){return {text:'DJ Velar работает в обычном режиме.'};};
   function fallback(reason){
     var value;
     try{value=local();}catch(e){value={text:'Помощник доступен. Попробуйте спросить о музыке, жанрах или артистах.'};}
     return {source:'local',reason:reason,answer:value};
   }
   if(options.enabled!==true||typeof externalRequest!=='function')
     return Promise.resolve(fallback('ai-disabled'));
   if(now()<cooldownUntil)return Promise.resolve(fallback('cooldown'));
   if(typeof navigator!=='undefined'&&navigator.onLine===false)
     return Promise.resolve(fallback('offline'));
   var timeout=Math.max(1000,Math.min(Number(options.timeoutMs)||8000,60000));
   var timer=null,settled=false;
   return new Promise(function(resolve){
     function end(value){if(settled)return;settled=true;if(timer!==null)clearTimeout(timer);resolve(value);}
     timer=setTimeout(function(){failures++;end(fallback('timeout'));},timeout);
     try{
       Promise.resolve(externalRequest()).then(function(remote){
         if(settled)return;
         var text=remote&&typeof remote.reply==='string'?remote.reply.trim():'';
         if(!text){failures++;end(fallback('empty-response'));return;}
         failures=0;cooldownUntil=0;
         end({source:'ai',reason:'ok',answer:{text:text.slice(0,1300)}});
       },function(error){
         if(settled)return;
         failures++;
         var reached=quota(error);
         if(reached)cooldownUntil=now()+DAY;
         else if(failures>=3)cooldownUntil=now()+60000;
         end(fallback(reached?'quota': 'network-or-provider-error'));
       });
     }catch(e){
       failures++;end(fallback('network-or-provider-error'));
     }
   });
 }
 function state(now){return {cooldown:Math.max(0,cooldownUntil-(typeof now==='number'?now:Date.now())),failures:failures};}
 function reset(){cooldownUntil=0;failures=0;}
 var api={offer:offer,quota:quota,state:state,reset:reset};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.VELAR_AI_FALLBACK=api;
}(typeof window!=='undefined'?window:null));
