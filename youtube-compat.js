/* RUN-154: iOS 12 embed UI failed physical acceptance on iPad mini 3.
   Detect the old engine for modal API playback; never navigate away. */
(function(){
 'use strict';
 function needsExternal(ua){
   var match=String(ua||'').match(/(?:CPU(?: iPhone)? OS|iPhone OS) (\d+)[_\.]/);
   return /iPad|iPhone|iPod/.test(ua||'')&&!!match&&Number(match[1])<=12;
 }
 function required(){
   return needsExternal(typeof navigator==='undefined'?'':navigator.userAgent);
 }
 window.VMM_YOUTUBE_COMPAT={required:required,needsExternal:needsExternal};
}());
