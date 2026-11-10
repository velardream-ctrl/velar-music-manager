/* RUN-043: VELAR Lyrics Studio A4 & Suno tools. Owner-only UI; existing
   Firebase editor remains the authoritative save path. No personal text in source. */
(function(){
  'use strict';
  var form=document.getElementById('lyric-form');
  var body=document.getElementById('lyric-body');
  if(!form||!body)return;
  var holder=document.createElement('section');
  holder.id='vmm-lyrics-tools';
  holder.innerHTML='<div class="vmm-lyric-buttons"><button type="button" id="vmm-paste-text">Вставить из буфера</button><button type="button" id="vmm-clean-suno">Очистить Suno</button><button type="button" id="vmm-show-a4">Лист A4 · две колонки</button></div><div class="vmm-lyric-buttons vmm-lyric-format"><button type="button" data-vmm-section="Куплет">Куплет</button><button type="button" data-vmm-section="Припев">Припев</button><button type="button" data-vmm-section="Бридж">Бридж</button><button type="button" data-vmm-section="Финал">Финал</button><button type="button" id="vmm-bold-text"><strong>Жирный</strong></button><button type="button" id="vmm-undo-clean" class="hidden">Отменить очистку</button></div><p id="vmm-lyric-note" class="sync-note">Вставь текст с командами Suno в поле выше. Лист A4 создаётся автоматически; исходник не меняется до подтверждения очистки.</p><div id="vmm-clean-preview" class="hidden"><p>Сравни автоматически очищенный текст с оригиналом. Незнакомые команды в квадратных скобках сохранены для проверки.</p><textarea id="vmm-clean-result" rows="8" readonly></textarea><div class="vmm-lyric-buttons"><button type="button" id="vmm-apply-clean">Применить очищенный текст</button><button type="button" id="vmm-cancel-clean">Отмена</button></div></div><div id="vmm-paper-preview" class="hidden"><p id="vmm-paper-status" class="sync-note"></p><div id="vmm-paper-stage"><iframe id="vmm-paper-frame" title="Предпросмотр листа A4"></iframe></div><p class="sync-note">Печать: формат A4, две колонки, масштаб 100%, поля без дополнительных отступов и колонтитулов.</p></div>';
  body.parentNode.parentNode.insertBefore(holder,body.parentNode.nextSibling);
  var cleanOriginal='',lastProof=null,renderTimer=null,renderSeq=0,undoClean=null;
  function el(n){return document.getElementById(n);}
  function note(s){el('vmm-lyric-note').textContent=s;}
  function title(){return String(form.elements.title.value||'').trim();}
  function lang(){return String(form.elements.language.value||'').trim();}
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

  function printRows(text){
    var lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),parts=[],stanza=[];
    function flush(){if(stanza.length){parts.push('<div class="stanza">'+stanza.map(function(x){return esc(x);}).join('<br>')+'</div>');stanza=[];}}
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
      '<div class="sheet" id="sheet"><div class="top"><h1>'+esc(title()||'Текст песни')+'</h1><p>'+esc(lang()+(form.elements.version.value?' · '+form.elements.version.value:''))+'</p></div>'+
      '<div class="words" id="words">'+printRows(text)+'</div></div></body></html>';
    return html;
  }
  function frameFit(font){
    var doc=el('vmm-paper-frame').contentDocument;if(!doc)return false;
    var words=doc.getElementById('words'),sheet=doc.getElementById('sheet');if(!words||!sheet)return false;
    words.style.fontSize=font+'px';
    // Multi-column overflow can expand the scroll width, not just the height.
    return words.scrollWidth<=words.clientWidth+3&&words.scrollHeight<=words.clientHeight+3&&sheet.scrollWidth<=sheet.clientWidth+3&&sheet.scrollHeight<=sheet.clientHeight+3;
  }
  function preview(){
    var input=body.value,sourceTitle=title();
    lastProof=null;
    if(!input.trim()){
      el('vmm-paper-preview').className='hidden';
      note('Вставь текст песни (можно прямо с командами Suno).');
      return;
    }
    var parsed=cleanSuno(input);
    el('vmm-paper-preview').className='';
    el('vmm-paper-status').textContent='Подгонка A4…';
    note(parsed.removed?'Автоформатирование: '+parsed.removed+' команд Suno; исходный текст остаётся в редакторе.':'Предпросмотр обновляется автоматически. Слова песни не изменены.');
    var frame=el('vmm-paper-frame');
    var seq=++renderSeq;
    frame.onload=function(){
      if(seq!==renderSeq)return;
      try{
        var chosen=0;
        for(var size=15;size>=9;size-=0.5){
          if(frameFit(size)){chosen=size;break;}
        }
        if(chosen){
          frameFit(chosen);
          lastProof={source:input,text:parsed.text,title:sourceTitle,language:lang(),version:form.elements.version.value,font:chosen};
          el('vmm-paper-status').textContent='✓ 1 лист A4 · 2 колонки · шрифт '+(chosen*0.75).toFixed(1)+' pt · команд Suno обработано: '+parsed.removed;
        }else{
          el('vmm-paper-status').textContent='Не весь текст помещается в A4. Печать заблокирована, чтобы ничего не обрезать; попробуй более короткую версию.';
        }
        resizePreview();
      }catch(err){lastProof=null;el('vmm-paper-status').textContent='Ошибка предпросмотра: '+err.message;}
    };
    frame.srcdoc=documentHTML(parsed.text,15,false);
  }
  function schedulePreview(){
    lastProof=null;
    if(renderTimer)clearTimeout(renderTimer);
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
    e.preventDefault();e.stopImmediatePropagation();
    if(!lastProof||lastProof.source!==body.value||lastProof.title!==title()||lastProof.language!==lang()||lastProof.version!==form.elements.version.value){
      note('Сначала дождись автоматической проверки листа A4 и повтори печать.');preview();return;
    }
    var win=window.open('about:blank','_blank');
    if(!win){note('Safari заблокировал окно печати. Разреши всплывающие окна для сайта.');return;}
    try{
      win.document.open();win.document.write(documentHTML(lastProof.text,lastProof.font,true));win.document.close();
      var button=win.document.getElementById('print-action');if(button)button.onclick=function(){win.focus();win.print();};
      win.focus();
      note('Открылся отдельный лист A4 в две колонки. Нажми «Печать / PDF» в новой вкладке.');
    }catch(err){try{win.close();}catch(ignore){}note('Не удалось открыть печать: '+err.message);}
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
    undoClean=null;this.className='hidden';
    body.dispatchEvent(new Event('input',{bubbles:true}));
    note('Предыдущий текст восстановлен в редакторе. Сохранённая запись Firestore не менялась.');
  };

  el('vmm-clean-suno').onclick=function(){
    cleanOriginal=body.value;var result=cleanSuno(cleanOriginal);
    if(!result.removed){note('Команд Suno в квадратных скобках не обнаружено.');return;}
    el('vmm-clean-result').value=result.text;el('vmm-clean-preview').className='';
    note('Найдено тегов: '+result.removed+'. Исходный текст сохранён без изменений. Сравни результат перед применением.');
  };
  el('vmm-apply-clean').onclick=function(){
    if(cleanOriginal!==body.value){note('Текст изменился после предварительного просмотра. Сначала повтори очистку.');return;}
    if(!window.confirm('Применить очищенный вариант? Автоматически сохранён он НЕ будет — для сохранения отдельно нажми кнопку «Сохранить текст».'))return;
    undoClean={before:cleanOriginal,after:el('vmm-clean-result').value};el('vmm-undo-clean').className='';body.value=undoClean.after;body.dispatchEvent(new Event('input',{bubbles:true}));
    el('vmm-clean-preview').className='hidden';lastProof=null;schedulePreview();note('Очистка применена в редакторе. Проверь слова и нажми «Сохранить текст» только после сверки.');
  };
  el('vmm-cancel-clean').onclick=function(){el('vmm-clean-preview').className='hidden';note('Очистка отменена; исходный текст не изменён.');};
  el('vmm-show-a4').onclick=preview;
  el('vmm-paste-text').onclick=function(){
    if(!navigator.clipboard||!navigator.clipboard.readText){
      note('В Safari удерживай палец в поле текста и выбери «Вставить». Предпросмотр сформируется автоматически.');body.focus();return;
    }
    navigator.clipboard.readText().then(function(text){
      if(!text.trim())return note('Буфер обмена пуст.');
      if(body.value.trim()&&!window.confirm('Заменить текущий текст содержимым буфера? Сохранённая запись не изменится до нажатия «Сохранить текст».'))return;
      body.value=text;body.dispatchEvent(new Event('input',{bubbles:true}));note('Текст вставлен. Автоматически формируем A4 в две колонки.');
    }).catch(function(){
      note('Safari не предоставил доступ к буферу. Удержи палец на поле текста и выбери «Вставить».');body.focus();
    });
  };
  var printButton=el('print-lyric');if(printButton)printButton.addEventListener('click',print,true);
  body.addEventListener('input',schedulePreview);
  body.addEventListener('paste',function(){setTimeout(schedulePreview,0);});
  form.elements.title.addEventListener('input',schedulePreview);
  form.elements.version.addEventListener('input',schedulePreview);
  form.elements.language.addEventListener('input',schedulePreview);
  // Programmatic lyric selection does not fire input; the main editor calls this hook.
  window.VMM_LYRICS_TOOLS={refreshPreview:schedulePreview,cleanSuno:cleanSuno};
  window.addEventListener('resize',function(){if(el('vmm-paper-preview').className.indexOf('hidden')<0)resizePreview();});
}());