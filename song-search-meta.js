/* RUN-221: public-safe song descriptions and discovery tags.
   ES5 compatible (old iPad Safari). No private Firestore, lyrics or cookies. */
(function(root){
 'use strict';
 var MAX_TAGS=18,MAX_TAG_LEN=48,MAX_DESCRIPTION=280,MAX_SERIALIZED=640;
 function trim(x){return String(x==null?'':x).replace(/^\s+|\s+$/g,'');}
 function fold(x){return trim(x).toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ');}
 function validateDescription(x){
   var s=trim(x);
   if(s.length>MAX_DESCRIPTION)throw new Error('Описание темы: максимум '+MAX_DESCRIPTION+' символов.');
   if(/[\u0000-\u001f<>]/.test(s))throw new Error('Описание темы: недопустимые символы.');
   return s;
 }
 function validateTags(raw){
   var source=Array.isArray(raw)?raw.join(','):String(raw==null?'':raw);
   if(source.length>1500)throw new Error('Теги: слишком длинное поле.');
   if(/[\u0000-\u001f<>]/.test(source))throw new Error('Теги: недопустимые символы.');
   var parts=source.split(/[,;]+/),seen={},words=[];
   parts.forEach(function(part){
     var v=trim(part).replace(/\s+/g,' ');
     if(!v)return;
     if(v.length>MAX_TAG_LEN)throw new Error('Тег «'+v.slice(0,32)+'…» длиннее '+MAX_TAG_LEN+' символов.');
     var key=fold(v);if(seen[key])return;seen[key]=true;words.push(v);
   });
   if(words.length>MAX_TAGS)throw new Error('Максимум '+MAX_TAGS+' поисковых тегов на песню.');
   var result=words.join(', ');
   if(result.length>MAX_SERIALIZED)throw new Error('Поле тегов: максимум '+MAX_SERIALIZED+' символов.');
   return result;
 }
 function keywords(row){
   var tags=row&&row.searchTags||'',description=row&&row.searchDescription||'';
   return fold([row&&row.title,row&&row.artist,row&&row.subtitle,
     tags,description].join(' '));
 }
 function matches(row,query){
   var q=fold(query);if(!q)return true;
   var text=keywords(row);
   return q.split(' ').every(function(part){return text.indexOf(part)>=0;});
 }
 root.VELAR_SONG_SEARCH_META={
   normalizeTags:validateTags,normalizeDescription:validateDescription,
   matches:matches,keywords:keywords,fold:fold
 };
})(window);
