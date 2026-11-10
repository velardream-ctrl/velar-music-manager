/* RUN-043: VELAR Lyrics Studio A4 & Suno tools. Owner-only UI; existing
   Firebase editor remains the authoritative save path. No personal text in source. */
(function(){
  'use strict';
  var form=document.getElementById('lyric-form');
  var body=document.getElementById('lyric-body');
  if(!form||!body)return;
  var holder=document.createElement('section');
  holder.id='vmm-lyrics-tools';
  holder.innerHTML='<div class="vmm-lyric-buttons"><button type="button" id="vmm-clean-suno">Очистить команды Suno</button><button type="button" id="vmm-show-a4">Лист A4 · две колонки</button></div><p id="vmm-lyric-note" class="sync-note">Исходный текст не изменяется без твоего подтверждения.</p><div id="vmm-clean-preview" class="hidden"><p>Проверь очищенный текст перед заменой. Слова вне квадратных скобок сохранены.</p><textarea id="vmm-clean-result" rows="8" readonly></textarea><div class="vmm-lyric-buttons"><button type="button" id="vmm-apply-clean">Применить очищенный текст</button><button type="button" id="vmm-cancel-clean">Отмена</button></div></div><div id="vmm-paper-preview" class="hidden"><p id="vmm-paper-status" class="sync-note"></p><div id="vmm-paper-stage"><iframe id="vmm-paper-frame" title="Предпросмотр листа A4"></iframe></div></div>';
  body.parentNode.parentNode.insertBefore(holder,body.parentNode.nextSibling);
  var cleanOriginal='',lastProof=null;
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
  function cleanSuno(input){
    var count=0;var text=String(input||'').replace(/\r\n?/g,'\n');
    text=text.replace(/\[([\s\S]*?)\]/g,function(all,cue){
      count++;
      var h=heading(cue);
      return h?'\n**'+h+'**\n':'';
    }).replace(/^\s*\[[^\]\n]*$/gm,'');
    text=text.replace(/\n{4,}/g,'\n\n\n').trim();
    return {text:text,removed:count};
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
      '@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e0e0e0;color:#111;font-family:Arial,sans-serif}.sheet{width:210mm;height:297mm;padding:5mm;background:#fff;overflow:hidden;margin:0 auto}.top{text-align:center;margin:0 0 9px}.top h1{font:bold 19px/1.15 Arial;margin:0 0 4px}.top p{font:11px Arial;margin:0;color:#555}.words{height:calc(100% - 48px);overflow:hidden;column-count:2;column-gap:9mm;column-fill:auto;font:'+font+'px/1.28 Arial,sans-serif}.words h2{font:bold 1.04em Arial;margin:4px 0 4px;break-after:avoid;page-break-after:avoid}.words .stanza{margin:0 0 9px;break-inside:avoid;page-break-inside:avoid;white-space:normal;overflow-wrap:break-word}#toolbar{padding:10px;text-align:center;background:#18233b;color:#fff;font:14px Arial}#toolbar button{font:inherit;padding:10px 15px;border:0;background:#e2c68d;border-radius:7px}@media print{body{background:#fff}#toolbar{display:none}.sheet{margin:0;box-shadow:none}}'+
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
    var input=body.value;
    lastProof=null;
    if(!input.trim()){note('Текст пуст. Сначала выбери песню или введи слова.');return;}
    el('vmm-paper-preview').className='';
    el('vmm-paper-status').textContent='Рассчитываем размещение текста на листе A4…';
    var frame=el('vmm-paper-frame');frame.onload=function(){
      var chosen=0;for(var size=15;size>=9;size-=0.5){if(frameFit(size)){chosen=size;break;}}
      if(chosen){frameFit(chosen);lastProof={text:input,title:title(),font:chosen};el('vmm-paper-status').textContent='Текст помещается на один лист A4. Размер шрифта: '+chosen+' px.';}
      else{el('vmm-paper-status').textContent='Текст не помещается на один лист A4 даже при минимальном шрифте. Печать заблокирована, чтобы не обрезать слова.';}
      resizePreview();
    };
    frame.srcdoc=documentHTML(input,15,false);
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
    if(!lastProof||lastProof.text!==body.value||lastProof.title!==title()){
      note('Сначала нажми «Лист A4», проверь размещение и повтори печать.');preview();return;
    }
    var win=window.open('about:blank','_blank');
    if(!win){note('Safari заблокировал окно печати. Разреши всплывающие окна для сайта.');return;}
    try{
      win.document.open();win.document.write(documentHTML(lastProof.text,lastProof.font,true));win.document.close();
      var button=win.document.getElementById('print-action');if(button)button.onclick=function(){win.focus();win.print();};
      win.focus();
      note('Открылся отдельный лист A4. Нажми «Печать / PDF» в новой вкладке.');
    }catch(err){try{win.close();}catch(ignore){}note('Не удалось открыть печать: '+err.message);}
  }
  el('vmm-clean-suno').onclick=function(){
    cleanOriginal=body.value;var result=cleanSuno(cleanOriginal);
    if(!result.removed){note('Команд Suno в квадратных скобках не обнаружено.');return;}
    el('vmm-clean-result').value=result.text;el('vmm-clean-preview').className='';
    note('Найдено тегов: '+result.removed+'. Исходный текст сохранён без изменений. Сравни результат перед применением.');
  };
  el('vmm-apply-clean').onclick=function(){
    if(cleanOriginal!==body.value){note('Текст изменился после предварительного просмотра. Сначала повтори очистку.');return;}
    if(!window.confirm('Применить очищенный вариант? Автоматически сохранён он НЕ будет — для сохранения отдельно нажми кнопку «Сохранить текст».'))return;
    body.value=el('vmm-clean-result').value;body.dispatchEvent(new Event('input',{bubbles:true}));
    el('vmm-clean-preview').className='hidden';lastProof=null;note('Очистка применена в редакторе. Проверь слова и нажми «Сохранить текст» только после сверки.');
  };
  el('vmm-cancel-clean').onclick=function(){el('vmm-clean-preview').className='hidden';note('Очистка отменена; исходный текст не изменён.');};
  el('vmm-show-a4').onclick=preview;
  var printButton=el('print-lyric');if(printButton)printButton.addEventListener('click',print,true);
  body.addEventListener('input',function(){lastProof=null;});
  form.elements.title.addEventListener('input',function(){lastProof=null;});
  window.addEventListener('resize',function(){if(el('vmm-paper-preview').className.indexOf('hidden')<0)resizePreview();});
}());