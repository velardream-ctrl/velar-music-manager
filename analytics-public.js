/* RUN-187 — VELARDREAM GA4: basic consent mode, Safari 12 compatible.
   No Google tag/network request before explicit permission. No authenticated
   Firestore reads, IP collection by our code, user registrations or autoplay.
   "player_open" means opening a player, NOT a completed stream. */
(function(){
 'use strict';
 var config={enabled:false}, consented=false, initialized=false, pageSent=false;
 var gaId='', lastKey='', lastAt=0;
 var allowed={page_view:true,player_open:true,radio_open:true,radio_next:true,youtube_play_start:true};
 var names={player_open:'velar_player_open',radio_open:'velar_radio_open',
   radio_next:'velar_radio_next',youtube_play_start:'velar_youtube_start'};
 function text(s){return String(s||'').replace(/[<>]/g,'').slice(0,100);}
 function provider(p){return /^(spotify|youtube|appleMusic)$/.test(p||'')?p:'';}
 function consentValue(){
   try{return window.localStorage.getItem('velar-analytics-consent')||'';}
   catch(ignore){return '';}
 }
 function remember(yes){
   try{window.localStorage.setItem('velar-analytics-consent',yes?'yes':'no');}
   catch(ignore){}
 }
 function validId(s){return typeof s==='string'&&/^G-[A-Z0-9]{7,16}$/.test(s);}
 function status(){return {ready:!!(config.enabled&&consented&&initialized),
   configured:validId(gaId),consented:consented,provider:'ga4'};}
 function command(){window.dataLayer.push(Array.prototype.slice.call(arguments));}
 function setConsent(value){
   if(!initialized)return;
   command('consent','update',{analytics_storage:value?'granted':'denied',
     ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 }
 function init(){
   if(initialized||!consented||!config.enabled||!validId(gaId))return false;
   // Queue a denied default BEFORE config; basic consent loads the external
   // Google script only AFTER permission. No cookieless denial pings.
   window.dataLayer=window.dataLayer||[];
   command('consent','default',{analytics_storage:'denied',
     ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
   command('js',new Date());
   setConsentEarly();
   command('config',gaId,{send_page_view:false,
     allow_google_signals:false,allow_ad_personalization_signals:false});
   initialized=true;
   var tag=document.createElement('script');tag.async=true;
   tag.src='https://www.googletagmanager.com/gtag/js?id='+gaId;
   if(document.head&&document.head.appendChild)document.head.appendChild(tag);
   else {initialized=false;return false;}
   return true;
 }
 function setConsentEarly(){
   command('consent','update',{analytics_storage:'granted',
     ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 }
 function record(kind,details){
   if(!allowed[kind]||!status().ready)return false;
   var d=details||{};
   var mediaId=/^[A-Za-z0-9_-]{11}$/.test(d.mediaId||'')?d.mediaId:'';
   if(kind==='youtube_play_start'&&!mediaId)return false;
   var payload={section:text(d.section||'other'),provider:provider(d.provider),
     song_title:text(d.title),artist_name:text(d.artist),video_id:mediaId};
   var eventName=kind==='page_view'?'page_view':names[kind];
   if(!eventName)return false;
   if(kind==='page_view'){
     payload.page_location='https://velardream.com'+(window.location&&window.location.pathname||'/');
     payload.page_title=document.title||'VELARDREAM Records';
   }
   var key=eventName+JSON.stringify(payload),now=Date.now();
   if(key===lastKey&&now-lastAt<1500)return false;
   lastKey=key;lastAt=now;
   command('event',eventName,payload);
   return true;
 }
 function pageView(){
   if(!pageSent&&status().ready){
     pageSent=true;record('page_view',{section:'site'});
   }
 }
 function removeCookie(name){
   try{
     document.cookie=name+'=; Max-Age=0; path=/; SameSite=Lax';
     document.cookie=name+'=; Max-Age=0; path=/; domain=.velardream.com; SameSite=Lax';
   }catch(ignore){}
 }
 function revoke(){
   consented=false;
   setConsent(false);
   // Remove first-party Google Analytics cookies on this domain after revoke.
   try{
     var cookies=String(document.cookie||'').split(';');
     cookies.forEach(function(cookie){
       var name=cookie.split('=')[0].trim();
       if(/^_ga(?:_|$)/.test(name))removeCookie(name);
     });
   }catch(ignore){}
 }
 function banner(){
   if(!config.enabled||!validId(gaId)||consentValue()||!document.body||
     document.getElementById('velar-analytics-consent'))return;
   var node=document.createElement('aside');node.id='velar-analytics-consent';
   node.setAttribute('role','region');node.setAttribute('aria-label','Согласие на статистику');
   node.style.cssText='position:fixed;z-index:10000;left:12px;right:12px;bottom:12px;max-width:570px;margin:auto;background:#152642;border:1px solid #e3c68a;border-radius:14px;padding:16px;color:#f8eddb;font:inherit;box-shadow:0 6px 28px rgba(0,0,0,.45)';
   var message=document.createElement('p');
   message.textContent='Разрешить Google Analytics собирать статистику посещений и открытий музыкальных плееров? Данные передаются Google. Без регистрации; отказ не мешает слушать музыку.';
   node.appendChild(message);
   function button(label,value){
     var b=document.createElement('button');b.type='button';b.textContent=label;
     b.style.cssText='padding:10px 14px;margin:4px;border:1px solid #d9bd85;border-radius:9px;background:#243753;color:#f7e4bc;font:inherit';
     b.onclick=function(){
       remember(value);consented=value;
       if(!value)revoke();
       if(node.parentNode)node.parentNode.removeChild(node);
       if(value){init();pageView();}
     };
     node.appendChild(b);
   }
   button('Разрешить аналитику',true);button('Отказаться',false);
   document.body.appendChild(node);
 }
 function control(){
   if(!config.enabled||!validId(gaId)||!document.querySelector)return;
   var footer=document.querySelector('footer');
   if(!footer||document.getElementById('velar-analytics-settings'))return;
   var button=document.createElement('button');button.id='velar-analytics-settings';button.type='button';
   button.textContent='Настройки статистики';
   button.style.cssText='display:block;margin:10px auto;background:transparent;border:0;color:#c9d4e5;text-decoration:underline;cursor:pointer;font:inherit;font-size:.85rem';
   button.onclick=function(){
     remember(false);revoke();
     // Offer reversible choice rather than treating a revoke as permanent.
     try{window.localStorage.removeItem('velar-analytics-consent');}catch(ignore){}
     banner();
   };
   footer.appendChild(button);
 }
 function configure(owner){
   config=owner&&typeof owner==='object'?owner:{enabled:false};
   gaId=window.VELAR_GA4_MEASUREMENT_ID||'';
   if(!config.enabled){revoke();return status();}
   consented=consentValue()==='yes';
   control();
   if(consented){init();pageView();}
   else banner();
   return status();
 }
 window.VMM_ANALYTICS={configure:configure,record:record,status:status};
}());
