/* RUN-222: private Suno style metadata helpers.
   Style prompts and original performance cues are never published or sent externally.
   ES5 compatible with older iPad Safari. */
(function(root){
  'use strict';
  var FIELDS=['sunoStyle','sunoCues','styleNotes','styleVerdict'];
  var LIMITS={sunoStyle:6000,sunoCues:16000,styleNotes:2400};
  var VERDICTS={unrated:true,successful:true,candidate:true,weak:true};
  function str(v){return typeof v==='string'?v:'';}
  function fields(src){
    src=src||{};
    return {sunoStyle:str(src.sunoStyle),sunoCues:str(src.sunoCues),
      styleNotes:str(src.styleNotes),
      styleVerdict:VERDICTS[src.styleVerdict]?src.styleVerdict:'unrated'};
  }
  function validate(raw){
    var copy=fields(raw);
    Object.keys(LIMITS).forEach(function(key){
      if(copy[key].length>LIMITS[key])throw new Error(key+': лимит '+LIMITS[key]+' символов.');
      if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(copy[key]))
        throw new Error(key+': недопустимые служебные символы.');
    });
    if(!VERDICTS[copy.styleVerdict])throw new Error('Неизвестная оценка стиля.');
    return copy;
  }
  function equal(a,b){
    var left=fields(a),right=fields(b);
    return FIELDS.every(function(k){return left[k]===right[k];});
  }
  function pureHeading(cue){
    return /^(?:(?:verse|куплет|chorus|припев|pre[- ]?chorus|предприпев|post[- ]?chorus|постприпев|bridge|бридж|переход|intro|вступление|outro|ending|финал|instrumental|инструментал|interlude|проигрыш)\s*\d*)$/i.test(cue.trim());
  }
  function extractCues(raw){
    var result=[],text=str(raw).replace(/\r\n?/g,'\n');
    // Preserve every standalone square-bracket direction EXCEPT plain stanza names.
    // Annotated structure like [Chorus: bright female choir] must be retained.
    text.replace(/(^|\n)[ \t]*\[([^\]\r\n]{1,240})\][ \t]*(?=\n|$)/g,function(all,prefix,cue){
      if(!pureHeading(cue))result.push('['+cue+']');
      return all;
    });
    return result.join('\n');
  }
  function mergeCues(oldText,incoming){
    var existing=str(oldText).split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean),
      added=str(incoming).split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);
    var seen={},result=[];
    existing.concat(added).forEach(function(x){
      if(seen[x])return;
      seen[x]=true;result.push(x);
    });
    return result.join('\n');
  }
  function fingerprint(s){
    return str(s).replace(/\r\n?/g,'\n').trim().replace(/[ \t]+/g,' ')
      .toLocaleLowerCase('ru').replace(/ё/g,'е');
  }
  root.VMM_SUNO_STYLE_DATA={
    fields:fields,validate:validate,equal:equal,
    extractCues:extractCues,mergeCues:mergeCues,fingerprint:fingerprint
  };
})(window);
