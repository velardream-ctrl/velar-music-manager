/* RUN-043: VELAR Lyrics Studio A4 & Suno tools. Owner-only UI; existing
   Firebase editor remains the authoritative save path. No personal text in source. */
(function(){
  'use strict';
  var form=document.getElementById('lyric-form');
  var body=document.getElementById('lyric-body');
  if(!form||!body)return;
  var holder=document.createElement('section');
  holder.id='vmm-lyrics-tools';
  holder.innerHTML='<div class="vmm-lyric-buttons"><button type="button" id="vmm-paste-text">Вставить текст</button><button type="button" id="vmm-clean-suno">Очистить Suno</button><button type="button" data-vmm-section="Куплет">Куплет</button><button type="button" data-vmm-section="Припев">Припев</button><button type="button" data-vmm-section="Бридж">Бридж</button><button type="button" data-vmm-section="Финал">Финал</button><button type="button" id="vmm-bold-text"><strong>Жирный</strong></button><button type="button" id="vmm-undo-clean" class="hidden">Отменить очистку</button></div><p id="vmm-lyric-note" class="sync-note">При вставке известные команды Suno очищаются автоматически. «Очистить Suno» удаляет все закрытые квадратные скобки; очистку можно отменить.</p><div id="vmm-clean-preview" class="hidden"><p>Результат полной очистки Suno. Слова вне квадратных скобок сохранены.</p><textarea id="vmm-clean-result" rows="6" readonly></textarea><div class="vmm-lyric-buttons"><button type="button" id="vmm-apply-clean">Применить</button><button type="button" id="vmm-cancel-clean">Отмена</button></div></div>';
  el('vmm-lyrics-toolbar').appendChild(holder);
  var cleanOriginal='',lastProof=null,renderTimer=null,renderSeq=0,undoClean=null,suppressAutoOnce=false,autoDisabledAfterUndo=false;
  function el(n){return document.getElementById(n);}
  function note(s){el('vmm-lyric-note').textContent=s;}
  function meta(){return window.VMM_STUDIO&&window.VMM_STUDIO.getLyricsMeta?window.VMM_STUDIO.getLyricsMeta():null;}
  function title(){return String((meta()||{}).title||'').trim();}
  function lang(){return String((meta()||{}).language||'').trim();}
  function version(){return String((meta()||{}).version||'').trim();}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
  function heading(cue) {
    var s=String(cue||'').replace(/\s+/g,' ').trim(),m;
    m=/^(?:final[ -]?chorus|финальный\s+припев)\s*(\d+)?(?=$|[\s:—–(),.;-])/i.exec(s);
    if(m)return 'Финальный припев'+(m[1]?' '+m[1]:'');
    m=/^(?:pre[ -]?chorus|предприпев)\s*(\d+)?(?=$|[\s:—–(),.;-])/i.exec(s);
    if(m)return 'Предприпев'+(m[1]?' '+m[1]:'');
    m=/^(?:post[ -]?chorus|постприпев)\s*(\d+)?(?=$|[\s:—–(),.;-])/i.exec(s);
    if(m)return 'Постприпев'+(m[1]?' '+m[1]:'');
    m=/^(?:verse|куплет)\s*(\d+)?(?=$|[\s:—–(),.;-])/i.exec(s);
    if(m)return 'Куплет'+(m[1]?' '+m[1]:'');
    m=/^(?:chorus|припев)\s*(\d+)?(?=$|[\s:—–(),.;-])/i.exec(s);
    if(m)return 'Припев'+(m[1]?' '+m[1]:'');
    if(/^(?:bridge|бридж|переход)(?=$|[\s:—–(),.;-])/i.test(s))return 'Бридж';
    if(/^(?:intro|вступление)(?=$|[\s:—–(),.;-])/i.test(s))return 'Вступление';
    if(/^(?:outro|ending|finale|финал|завершение|окончание)(?=$|[\s:—–(),.;-])/i.test(s))return 'Финал';
    if(/^(?:instrumental|interlude|solo|интерлюдия|проигрыш|музыкальный проигрыш)(?=$|[\s:—–(),.;-])/i.test(s))return 'Проигрыш';
    return '';
  }
  function isMusicCue(cue){
    var x=String(cue||'').trim();
    return /^(?:instrumental|interlude|solo|guitar|piano|drums?|bass|saxophone|violin|synth|outro|intro|breakdown|break|fade|build|drop|riff|vocal(?:s)?|spoken|whisper|harmony|adlib|echo|reverb|music|beat|tempo|bpm|style|genre|mood|key|repeat|distorted|quiet|loud|soft|female|male|duet|choir|music\s+fades|проигрыш|инструментал|соло|голос|хор|ритм|темп|музыка)(?:$|[\s:,_;./!()—–-])/i.test(x);
  }
  function cleanSuno(input){
    var count=0,recognized=0;var text=String(input||'').replace(/\r\n?/g,'\n');
    // Only replace standalone one-line tags. Inline brackets in actual lyrics
    // and unknown cues must be preserved (a lyric should never be silently lost).
    text=text.replace(/(^|\n)[ \t]*\[([^\]\r\n]{1,240})\][ \t]*(?=\n|$)/g,function(all,prefix,cue){
      var h=heading(cue);
      if(h){count++;recognized++;return prefix+'**'+h+'**';}
      if(isMusicCue(cue)){count++;return prefix;}
      return all;
    });
    text=text.replace(/\n{4,}/g,'\n\n\n').trim();
    return {text:text,removed:count,headings:recognized};
  }

  // Explicit owner action only. Match balanced brackets across lines and nested
  // cues; never consume an unmatched opening bracket or ordinary parentheses.
  function cleanAllSuno(input){
    var src=String(input||'').replace(/\r\n?/g,'\n'),out='',removed=0,headings=0,i=0;
    while(i<src.length){
      if(src.charAt(i)!=='['){out+=src.charAt(i++);continue;}
      var start=i,depth=1,j=i+1;
      for(;j<src.length&&depth;j++){
        if(src.charAt(j)==='[')depth++;
        else if(src.charAt(j)===']')depth--;
      }
      if(depth){out+=src.charAt(i++);continue;}
      var cue=src.slice(start+1,j-1),h=heading(cue);
      var lineStart=src.lastIndexOf('\n',start-1)+1;
      var lineEnd=src.indexOf('\n',j);if(lineEnd<0)lineEnd=src.length;
      var standalone=!src.slice(lineStart,start).trim()&&!src.slice(j,lineEnd).trim();
      if(h&&standalone&&cue.indexOf('\n')===-1){out+='**'+h+'**';headings++;}
      else if(!standalone&&start>0&&j<src.length&&/[^\s]/.test(src.charAt(start-1))&&/[^\s.,!?;:…]/.test(src.charAt(j)))out+=' ';
      removed++;i=j;
    }
    // Remove only now-empty lines and excess whitespace introduced by cues.
    if(removed)out=out.replace(/[ \t]+(?=\n|$)/g,'').replace(/\n[ \t]*\n(?:[ \t]*\n)+/g,'\n\n').trim();
    return {text:out,removed:removed,headings:headings};
  }

  function printRows(text){
    var lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),parts=[],stanza=[];
    function flush(){if(stanza.length){parts.push('<div class="stanza">'+stanza.map(function(x){return esc(x).replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');}).join('<br>')+'</div>');stanza=[];}}
    for(var i=0;i<lines.length;i++){
      var s=lines[i].trim(),head=null;
      if(!s){flush();continue;}
      var m=s.match(/^\*\*(.*?)\*\*$/);
      if(m)head=m[1];else if(/^#{2,6}\s+/.test(s))head=s.replace(/^#{2,6}\s+/,'');
      if(head!==null){flush();parts.push('<h2>'+esc(head)+'</h2>');continue;}
      if(/^#\s+/.test(s)){flush();continue;}
      stanza.push(lines[i]);
    }
    flush();return parts.join('');
  }
  function documentHTML(text,font,toolbar){
    var html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title()||'Текст песни')+' — VELAR</title><style>'+
      '@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e0e0e0;color:#111;font-family:Arial,sans-serif}.sheet{width:210mm;height:297mm;padding:5mm;background:#fff;overflow:hidden;margin:0 auto}.top{text-align:center;margin:0 0 9px}.top h1{font:bold 19px/1.15 Arial;margin:0 0 4px}.top p{font:11px Arial;margin:0;color:#555}.words{height:calc(100% - 48px);overflow:hidden;column-count:2;column-gap:9mm;column-fill:balance;font:'+font+'px/1.28 Arial,sans-serif}.words h2{font:bold 1.04em Arial;margin:4px 0 4px;break-after:avoid;page-break-after:avoid}.words .stanza{margin:0 0 9px;break-inside:avoid;page-break-inside:avoid;white-space:normal;overflow-wrap:break-word}#toolbar{padding:10px;text-align:center;background:#18233b;color:#fff;font:14px Arial}#toolbar button{font:inherit;padding:10px 15px;border:0;background:#e2c68d;border-radius:7px}@media print{body{background:#fff}#toolbar{display:none}.sheet{margin:0;box-shadow:none}}'+
      '</style></head><body>'+(toolbar?'<div id="toolbar">Только текст песни · A4 · две колонки <button type="button" id="print-action">Печать / PDF</button></div>':'')+
      '<div class="sheet" id="sheet"><div class="top"><h1>'+esc(title()||'Текст песни')+'</h1><p>'+esc(lang()+(version()?' · '+version():''))+'</p></div>'+
      '<div class="words" id="words">'+printRows(text)+'</div></div></body></html>';
    return html;
  }
  var readerActive=false;
  function renderReader(){
    var source=cleanSuno(body.value).text;
    el('vmm-performance-reader').innerHTML='<h3>'+esc(title()||'Текст песни')+'</h3><p class="vmm-reader-meta">'+esc(lang()+(version()?' · '+version():''))+'</p>'+printRows(source);
  }
  function toggleReader(forceOff){
    readerActive=forceOff?false:!readerActive;
    el('vmm-read-mode').textContent=readerActive?'Показать A4':'Читать крупно';
    el('vmm-read-mode').setAttribute('aria-pressed',readerActive?'true':'false');
    el('vmm-performance-reader').className=readerActive?'':'hidden';
    if(readerActive){
      el('vmm-paper-preview').className='hidden';
      renderReader();
      note('Режим сцены: увеличенный текст только для чтения. Сохранённые данные не меняются.');
    }else{
      el('vmm-paper-preview').className='';
      schedulePreview();
    }
  }

  function preview(){
    var input=body.value,sourceTitle=title();lastProof=null;
    if(!input.trim()){el('vmm-paper-preview').className='hidden';note('Вставь текст песни (можно прямо с командами Suno).');return;}
    var parsed=cleanAllSuno(input);
    el('vmm-paper-preview').className='';
    el('vmm-paper-status').textContent='Подбор размера и балансировка A4…';
    note(parsed.removed?'Предпросмотр: команды Suno скрыты только на листе A4. Исходный текст не изменён.':'Предпросмотр обновляется автоматически. Слова песни не изменены.');
    var frame=el('vmm-paper-frame'),seq=++renderSeq;
    try{
      if(!window.VMM_PRINT_EXPORT||!window.VMM_PRINT_EXPORT.prepare)throw new Error('Модуль верстки ещё не загружен. Обнови страницу.');
      var p={source:input,text:parsed.text,title:sourceTitle,language:lang(),version:version()};
      p.prepared=window.VMM_PRINT_EXPORT.prepare(p);
      var plan=p.prepared.layout;
      lastProof=p;
      frame.onload=function(){if(seq===renderSeq)resizePreview();};
      frame.srcdoc=p.prepared.pageHTML;
      el('vmm-paper-status').textContent='✓ 1 лист A4 · '+(plan.columns===1?'1 колонка':'2 сбалансированные колонки')+' · '+(plan.font*.75).toFixed(1)+' pt'+(plan.font<16?' · плотный текст, мелкий шрифт':'');
      resizePreview();
    }catch(err){lastProof=null;frame.srcdoc='';el('vmm-paper-status').textContent='Печать недоступна: '+err.message;}
  }
  function recordLoaded(){
    if(readerActive)toggleReader(true);
    lastInput=body.value;undoClean=null;autoDisabledAfterUndo=false;
    var undo=el('vmm-undo-clean');if(undo)undo.className='hidden';
    var clean=el('vmm-clean-preview');if(clean)clean.className='hidden';
    note('Текст готов. Вставь команды Suno — они очистятся автоматически. «Лист A4» подберёт размер шрифта и расположение текста.');
    if(el('vmm-paper-view').className.indexOf('hidden')<0)schedulePreview();
  }
  function autoCleanEditor(reason,original){
    var current=body.value,result=cleanSuno(current);
    if(!result.removed)return false;
    // Preserve the unmodified raw input for explicit undo (never save raw input by accident).
    undoClean={before:original===undefined?current:original,after:result.text};
    body.value=result.text;
    el('vmm-undo-clean').className='';
    note('Автоматически обработано команд Suno: '+result.removed+'. Чтобы вернуть исходный код, нажми «Отменить очистку».');
    body.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }

  function schedulePreview(){
    if(undoClean&&body.value!==undoClean.after){undoClean=null;var undoNode=el('vmm-undo-clean');if(undoNode)undoNode.className='hidden';}
    lastProof=null;
    if(renderTimer)clearTimeout(renderTimer);
    if(el('vmm-paper-view').className.indexOf('hidden')!==-1)return;
    if(readerActive){renderReader();return;}
    renderTimer=setTimeout(function(){
      renderTimer=null;
      if(form.className.indexOf('hidden')!==-1)return;
      preview();
    },340);
  }

  function resizePreview(){
    var stage=el('vmm-paper-stage'),frame=el('vmm-paper-frame');
    if(!stage||!frame)return;
    var scale=Math.min(1,Math.max(0.2,(stage.clientWidth-2)/794));
    frame.style.transform='scale('+scale+')';
    stage.style.height=(1123*scale)+'px';
  }
  function print(e){
    if(e){e.preventDefault();e.stopImmediatePropagation();}
    if(readerActive){toggleReader(true);note('Вернулись к листу A4. Нажми «Печать / PDF» ещё раз.');return;}
    if(el('vmm-paper-view').className.indexOf('hidden')!==-1){
      el('lyric-view-paper').click();
      note('Лист A4 открыт. Проверь расположение текста, затем повторно нажми «Печать / PDF».');
      return;
    }
    if(!lastProof||lastProof.source!==body.value||lastProof.title!==title()||lastProof.language!==lang()||lastProof.version!==version()){
      note('Сначала дождись автоматической проверки листа A4 и повтори печать.');preview();return;
    }
    if(!window.VMM_PRINT_EXPORT){note('Модуль печати ещё не загружен. Обнови страницу.');return;}
    window.VMM_PRINT_EXPORT.show(lastProof);
  }

  function replaceSelection(txt,wrap){
    if(form.className.indexOf('hidden')!==-1)return;
    var start=body.selectionStart||0,end=body.selectionEnd||0;
    var current=body.value,selected=current.slice(start,end),replacement=wrap?txt+selected+txt:txt;
    body.value=current.slice(0,start)+replacement+current.slice(end);
    body.focus();
    try{body.setSelectionRange(start+(wrap?txt.length:replacement.length),start+(wrap?txt.length+selected.length:replacement.length));}catch(ignore){}
    body.dispatchEvent(new Event('input',{bubbles:true}));
  }
  holder.addEventListener('click',function(e){
    var target=e.target;
    while(target&&target!==holder&&!target.getAttribute('data-vmm-section'))target=target.parentNode;
    if(!target||target===holder)return;
    var section=target.getAttribute('data-vmm-section');
    if(section)replaceSelection('\n**'+section+'**\n',false);
  });
  el('vmm-bold-text').onclick=function(){
    if(body.selectionStart===body.selectionEnd){note('Сначала выдели слова в редакторе, затем нажми «Жирный».');body.focus();return;}
    replaceSelection('**',true);
  };
  el('vmm-undo-clean').onclick=function(){
    if(!undoClean)return;
    if(body.value!==undoClean.after){note('После очистки текст уже изменён. Автоматическая отмена заблокирована, чтобы не стереть новые слова.');return;}
    body.value=undoClean.before;
    undoClean=null;this.className='hidden';suppressAutoOnce=true;autoDisabledAfterUndo=true;
    body.dispatchEvent(new Event('input',{bubbles:true}));
    note('Предыдущий текст восстановлен в редакторе. Сохранённая запись Firestore не менялась.');
  };

  el('vmm-clean-suno').onclick=function(){
    if(body.readOnly||form.className.indexOf('hidden')!==-1)return;
    cleanOriginal=body.value;var result=cleanAllSuno(cleanOriginal);
    if(!result.removed){note('Закрытых квадратных скобок не обнаружено. Текст уже очищен или содержит незакрытую скобку.');return;}
    el('vmm-clean-result').value=result.text;
    applyCleanResult();
    note('Удалено тегов Suno: '+result.removed+'. Текст изменён только в редакторе. Можно отменить очистку или сохранить.');
  };
  function applyCleanResult(){
    if(cleanOriginal!==body.value){note('Текст изменился после предварительного просмотра. Сначала повтори очистку.');return;}
    if(body.readOnly||form.className.indexOf('hidden')!==-1)return;
    undoClean={before:cleanOriginal,after:el('vmm-clean-result').value};el('vmm-undo-clean').className='';body.value=undoClean.after;body.dispatchEvent(new Event('input',{bubbles:true}));
    el('vmm-clean-preview').className='hidden';lastProof=null;schedulePreview();note('Очистка применена в редакторе. Проверь слова и нажми «Сохранить текст» только после сверки.');
  }
  el('vmm-apply-clean').onclick=applyCleanResult;
  el('vmm-cancel-clean').onclick=function(){el('vmm-clean-preview').className='hidden';note('Очистка отменена; исходный текст не изменён.');};

  el('vmm-read-mode').onclick=function(){toggleReader(false);};
  function share(){
    if(!body.value.trim())return note('Выбери песню с текстом перед отправкой.');
    var cleaned=cleanSuno(body.value).text;
    var name=window.VMM_PRINT_EXPORT?window.VMM_PRINT_EXPORT.safeName(title()):String(title()||'Текст песни').replace(/[\\/:*?"<>|]/g,' ').trim();
    var file=null;
    try{if(typeof File!=='undefined')file=new File([cleaned],name+'.txt',{type:'text/plain;charset=utf-8'});}catch(ignore){}
    if(file&&navigator.share&&navigator.canShare){
      var supported=false;
      try{supported=navigator.canShare({files:[file]});}catch(ignore){}
      if(supported){
        navigator.share({files:[file],title:title()||'Текст песни'}).catch(function(err){
          if(!err||err.name!=='AbortError')note('Не удалось передать файл: '+(err&&err.message||'ошибка'));
        });
        return;
      }
    }
    if(navigator.share){
      navigator.share({title:title()||'Текст песни',text:cleaned}).catch(function(err){
        if(!err||err.name!=='AbortError')note('Не удалось открыть меню передачи: '+(err&&err.message||'ошибка'));
      });
      note('На этом устройстве передаётся текст, а не файл с названием песни.');
      return;
    }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(cleaned).then(function(){note('Очищенный текст скопирован. Его можно вставить в письмо или сообщение.');}).catch(function(){note('Буфер недоступен. Выдели текст и скопируй вручную.');});
    }else note('На этом устройстве системное меню «Поделиться» недоступно.');
  }

  el('vmm-paste-text').onclick=function(){
    if(!navigator.clipboard||!navigator.clipboard.readText){
      note('Удерживай палец в поле текста и нажми «Вставить». Suno очистится автоматически.');body.focus();return;
    }
    navigator.clipboard.readText().then(function(t){
      if(!t.trim())return note('Буфер обмена пуст.');
      if(body.value.trim()&&!window.confirm('Заменить текст песни текстом из буфера? Старый вариант будет доступен через «Отменить очистку» до следующего редактирования.'))return;
      body.value=t;autoDisabledAfterUndo=false;
      if(!autoCleanEditor('paste',t)){body.dispatchEvent(new Event('input',{bubbles:true}));note('Текст вставлен в редактор.');}
    }).catch(function(){note('Разрешение на буфер не предоставлено. Вставь текст обычным способом.');body.focus();});
  };

  var lastInput='';
  body.addEventListener('input',function(){
    // Covers iPhone paste, typed brackets and clipboard fallback.
    // Never run while a saved record is being populated programmatically.
    var latest=body.value;
    if(suppressAutoOnce){suppressAutoOnce=false;lastInput=latest;schedulePreview();return;}
    if(autoDisabledAfterUndo){lastInput=latest;schedulePreview();return;}
    if(latest!==lastInput && autoCleanEditor('input',latest)){lastInput=body.value;return;}
    lastInput=body.value;schedulePreview();
  });
  body.addEventListener('paste',function(){autoDisabledAfterUndo=false;setTimeout(function(){
    if(autoCleanEditor('paste'))lastInput=body.value;
    else schedulePreview();
  },0);});


  // Programmatic lyric selection does not fire input; the main editor calls this hook.
  window.VMM_LYRICS_TOOLS={refreshPreview:schedulePreview,cleanSuno:cleanSuno,cleanAllSuno:cleanAllSuno,print:print,share:share,onRecordLoaded:recordLoaded};
  window.addEventListener('resize',function(){if(el('vmm-paper-preview').className.indexOf('hidden')<0)resizePreview();});
}());