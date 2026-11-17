/* RUN-186 — privacy-first instrumentation foundation, ES5 / old Safari.
   No network activity until owner enables it, a dedicated trusted endpoint
   exists, AND visitor explicitly consents. Never read cookies/IP/location.
   IMPORTANT: "player_open" is a click intent, NOT a confirmed stream. */
(function(){
 'use strict';
 var config={enabled:false},consented=false;
 var endpoint='',lastKey='',lastAt=0,pageSent=false;
 var allowed={page_view:true,player_open:true,radio_open:true,radio_next:true};
 function validEndpoint(s){
   // Endpoint must be injected by deployment; never from visitor or Firestore.
   return typeof s==='string'&&/^https:\/\/[-a-zA-Z0-9.]+\/(?:[^?#]*\/)?events$/.test(s);
 }
 function platform(p){return /^(spotify|youtube|appleMusic)$/.test(p||'')?p:'';}
 function short(s){return String(s||'').replace(/[<>]/g,'').slice(0,110);}
 function getConsent(){
   try{return window.localStorage&&window.localStorage.getItem('velar-analytics-consent')==='yes';}
   catch(ignore){return false;}
 }
 function status(){
   return {ready:!!(config.enabled&&consented&&validEndpoint(endpoint)),
     configured:validEndpoint(endpoint),consented:consented};
 }
 function displayConsent(){
   if(!config.enabled||!validEndpoint(endpoint))return;
   var choice;try{choice=window.localStorage.getItem('velar-analytics-consent');}catch(ignore){}
   if(choice==='yes'||choice==='no')return;
   if(!document.body||document.getElementById('velar-analytics-consent'))return;
   var bar=document.createElement('aside');bar.id='velar-analytics-consent';
   bar.setAttribute('role','region');bar.setAttribute('aria-label','Настройки статистики');
   bar.style.cssText='position:fixed;z-index:10000;left:12px;right:12px;bottom:12px;max-width:570px;margin:auto;background:#152642;border:1px solid #e3c68a;border-radius:14px;padding:16px;color:#f8eddb;font:inherit;box-shadow:0 6px 28px rgba(0,0,0,.45)';
   var msg=document.createElement('p');msg.textContent='Разрешить анонимную статистику посещений и открытий плееров? Без регистрации; отказ не мешает слушать музыку. Сведения о действиях хранятся ограниченное время.';
   bar.appendChild(msg);
   function button(label,value){
     var b=document.createElement('button');b.type='button';b.textContent=label;
     b.style.cssText='padding:10px 14px;margin:4px;border:1px solid #d9bd85;border-radius:9px;background:#243753;color:#f7e4bc;font:inherit';
     b.onclick=function(){
       consented=value;
       try{window.localStorage.setItem('velar-analytics-consent',value?'yes':'no');}catch(ignore){}
       if(bar.parentNode)bar.parentNode.removeChild(bar);
       if(value&&!pageSent){pageSent=true;record('page_view',{section:'site'});}
     };bar.appendChild(b);
   }
   button('Разрешить',true);button('Отказаться',false);
   document.body.appendChild(bar);
 }
 function configure(owner){
   config=owner&&typeof owner==='object'?owner:{enabled:false};
   endpoint=window.VELAR_ANALYTICS_ENDPOINT||'';
   consented=getConsent();
   if(config.enabled&&validEndpoint(endpoint)){
     displayConsent();
     if(consented&&!pageSent){pageSent=true;record('page_view',{section:'site'});}
   }
   return status();
 }
 function record(kind,details){
   if(!allowed[kind]||!status().ready)return false;
   var d=details||{},section=short(d.section||'other'),p=platform(d.provider);
   var title=short(d.title),artist=short(d.artist),payload={
     kind:kind,section:section,provider:p,title:title,artist:artist,
     day:(new Date()).toISOString().slice(0,10)
   };
   // Prevent a double click from being counted as two plays. No durable ID.
   var key=JSON.stringify(payload),now=Date.now();
   if(key===lastKey&&now-lastAt<1500)return false;
   lastKey=key;lastAt=now;
   var body=JSON.stringify(payload);
   // No IP, cookies, email, referrer, or raw external URLs in payload.
   try{
     if(navigator.sendBeacon&&navigator.sendBeacon(endpoint,new Blob([body],{type:'application/json'})))return true;
     if(window.fetch){window.fetch(endpoint,{method:'POST',mode:'cors',
       headers:{'Content-Type':'application/json'},body:body,credentials:'omit',keepalive:true}).catch(function(){});return true;}
   }catch(ignore){}
   return false;
 }
 window.VMM_ANALYTICS={configure:configure,record:record,status:status};
}());
