/* RUN-154: iOS 12 embed UI failed physical acceptance on iPad mini 3.
   Use the official watch page confirmed working by the owner; no stream proxy. */
(function(){
 'use strict';
 function needsExternal(ua){
   var match=String(ua||'').match(/(?:CPU(?: iPhone)? OS|iPhone OS) (\d+)[_\.]/);
   return /iPad|iPhone|iPod/.test(ua||'')&&!!match&&Number(match[1])<=12;
 }
 function required(){
   return needsExternal(typeof navigator==='undefined'?'':navigator.userAgent);
 }
 function official(url){
   return /^https:\/\/www\.youtube\.com\/(?:watch\?v=[A-Za-z0-9_-]{11}|playlist\?list=[A-Za-z0-9_-]+)$/.test(url||'');
 }
 function open(url){
   if(!required()||!official(url))return false;
   // Synchronous same-tab navigation survives popup restrictions. Browser Back
   // returns to the site; do not wait for API readiness or manufacture Play UI.
   window.location.assign(url);
   return true;
 }
 window.VMM_YOUTUBE_COMPAT={required:required,needsExternal:needsExternal,open:open};
}());
