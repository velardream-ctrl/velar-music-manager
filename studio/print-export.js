/* RUN-046: A4 print viewer and private, in-browser PDF hand-off.
   No window.open: safe for an iPhone Home Screen web app without browser Back.
   No network calls, user lyrics stay on the device for PDF export. */
(function () {
  'use strict';
  var active=null, overlay=null, opener=null, printPrepared=false;
  function byId(id){return document.getElementById(id);}
  function escapeHTML(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function safeName(s){
    var name=String(s||'Текст песни').replace(/[\u0000-\u001f\u007f\\\/:*?"<>|]/g,' ').replace(/\s+/g,' ').replace(/^[.\s]+|[.\s]+$/g,'').slice(0,100);
    return name||'Текст песни';
  }
  function setMessage(s){var n=byId('vmm-export-message');if(n)n.textContent=s;}
  function standalone(){
    return navigator.standalone===true||!!(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
  }
  function close(){
    if(!overlay)return;
    overlay.parentNode.removeChild(overlay);
    overlay=null;active=null;printPrepared=false;
    document.body.classList.remove('vmm-print-open');
    if(opener&&opener.focus)opener.focus();
  }
  function resize(){
    if(!overlay)return;
    var stage=byId('vmm-export-stage'),frame=byId('vmm-export-frame');
    if(!stage||!frame)return;
    var scale=Math.min(1,Math.max(.2,(stage.clientWidth-4)/794));
    frame.style.transform='scale('+scale+')';
    stage.style.height=(1123*scale)+'px';
  }
  function markup(p){
    return '<div class="vmm-print-sheet"><div class="vmm-print-top"><h1>'+escapeHTML(p.title||'Текст песни')+'</h1><p>'+escapeHTML(p.language+(p.version?' · '+p.version:''))+'</p></div><div class="vmm-print-words" style="font-size:'+Number(p.font||12)+'px">'+p.rowsHTML+'</div></div>';
  }
  function preparePrint(){
    if(!active)return;
    byId('print-page').innerHTML=markup(active);
    printPrepared=true;
  }
  function show(p){
    if(!p||!p.text)return;
    close();
    active=p;
    opener=document.activeElement;
    overlay=document.createElement('div');
    overlay.id='vmm-export-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Предпросмотр печати текста песни');
    overlay.innerHTML=
      '<div class="vmm-export-toolbar">'+
        '<button type="button" id="vmm-export-close" class="vmm-export-back">← Назад в редактор</button>'+
        '<span class="vmm-export-title">Лист A4 · две колонки</span>'+
        '<button type="button" id="vmm-export-print">Печать</button>'+
        '<button type="button" id="vmm-export-pdf">Сохранить PDF</button>'+
      '</div>'+
      '<p id="vmm-export-message" role="status" aria-live="polite"></p>'+
      '<div class="vmm-export-preview"><div id="vmm-export-stage"><iframe id="vmm-export-frame" title="Предпросмотр A4" loading="eager"></iframe></div></div>';
    document.body.appendChild(overlay);
    document.body.classList.add('vmm-print-open');
    byId('vmm-export-close').onclick=close;
    byId('vmm-export-pdf').onclick=sharePDF;
    byId('vmm-export-print').onclick=function(){
      if(standalone()){sharePDF();return;}
      preparePrint();
      try{window.print();setMessage('Если системная печать не открылась, выбери «Сохранить PDF».');}
      catch(err){setMessage('Печать недоступна в этом браузере. Используй «Сохранить PDF».');}
    };
    var f=byId('vmm-export-frame');
    f.onload=resize;
    f.srcdoc=p.pageHTML;
    resize();
    if(standalone())setMessage('На iPhone из домашнего экрана печать может блокироваться iOS. Нажми «Печать» или «Сохранить PDF», затем выбери «Печать» либо «Сохранить в Файлы» в системном меню.');
    else setMessage('Печать отправит лист на принтер. «Сохранить PDF» создаст отдельный файл с названием песни.');
    byId('vmm-export-close').focus();
  }

  function blocks(text){
    var lines=String(text||'').replace(/\r\n?/g,'\n').split('\n'),result=[],stanza=[];
    function flush(){if(stanza.length){result.push({type:'stanza',lines:stanza});stanza=[];}}
    for(var i=0;i<lines.length;i++){
      var s=lines[i].trim(),m;
      if(!s){flush();continue;}
      m=s.match(/^\*\*(.*?)\*\*$/);
      if(m){flush();result.push({type:'heading',lines:[m[1]]});continue;}
      if(/^#{2,6}\s+/.test(s)){flush();result.push({type:'heading',lines:[s.replace(/^#{2,6}\s+/,'')]});continue;}
      if(/^#\s+/.test(s)){flush();continue;}
      stanza.push(s.replace(/\*\*/g,''));
    }
    flush();
    return result;
  }
  function wrap(ctx,line,maxWidth){
    var words=String(line).split(/\s+/),out=[],part='';
    for(var i=0;i<words.length;i++){
      var word=words[i],trial=part?part+' '+word:word;
      if(ctx.measureText(trial).width<=maxWidth){part=trial;continue;}
      if(part){out.push(part);part='';}
      if(ctx.measureText(word).width<=maxWidth){part=word;continue;}
      var piece='';
      for(var j=0;j<word.length;j++){
        if(piece&&ctx.measureText(piece+word[j]).width>maxWidth){out.push(piece);piece='';}
        piece+=word[j];
      }
      part=piece;
    }
    if(part)out.push(part);
    return out.length?out:[''];
  }
  function renderCanvas(p){
    var scale=2, W=794,H=1123,canvas=document.createElement('canvas');
    canvas.width=W*scale;canvas.height=H*scale;
    var ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas недоступен');
    ctx.scale(scale,scale);
    var items=blocks(p.text),font=Math.min(15,Math.max(9,Number(p.font)||12));
    function layout(size,draw){
      var x=[19,414],y=77,column=0,cw=361,bottom=1104,lineHeight=size*1.28, gap=9;
      ctx.textBaseline='alphabetic';ctx.fillStyle='#111';
      for(var i=0;i<items.length;i++){
        var b=items[i],isHeading=b.type==='heading',fontFace=isHeading?'bold ':'';
        ctx.font=fontFace+(isHeading?(size*1.04):size)+'px Arial, sans-serif';
        var rows=[];
        for(var k=0;k<b.lines.length;k++){
          var wrapped=wrap(ctx,b.lines[k],cw);
          for(var n=0;n<wrapped.length;n++)rows.push(wrapped[n]);
        }
        var blockHeight=rows.length*lineHeight+(isHeading?4:gap);
        if(isHeading&&items[i+1]){
          var next=items[i+1];
          if(next.type==='stanza'){
            ctx.font=size+'px Arial, sans-serif';
            var first=wrap(ctx,next.lines[0],cw).length*lineHeight+gap;
            if(y+blockHeight+first>bottom&&column===0){column=1;y=77;}
          }
        }
        if(y+blockHeight>bottom){
          if(column===1)return false;
          column=1;y=77;
        }
        if(y+blockHeight>bottom)return false;
        if(draw){
          ctx.font=fontFace+(isHeading?(size*1.04):size)+'px Arial, sans-serif';
          for(var r=0;r<rows.length;r++)ctx.fillText(rows[r],x[column],y+(r+1)*lineHeight-3);
        }
        y+=blockHeight;
      }
      return true;
    }
    while(font>=8&&!layout(font,false))font-=.5;
    if(font<8)throw new Error('Текст не помещается на одном листе A4');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#111';ctx.textAlign='center';
    var heading=String(p.title||'Текст песни');
    ctx.font='bold 19px Arial,sans-serif';
    if(ctx.measureText(heading).width>760){
      while(ctx.measureText(heading).width>760&&heading.length>10)heading=heading.slice(0,-1);
      heading+='…';
    }
    ctx.fillText(heading,W/2,40);
    ctx.font='11px Arial,sans-serif';ctx.fillStyle='#555';
    ctx.fillText(p.language+(p.version?' · '+p.version:''),W/2,60);
    ctx.textAlign='left';ctx.fillStyle='#111';
    layout(font,true);
    return canvas;
  }
  function ascii(s){
    var out=new Uint8Array(s.length);
    for(var i=0;i<s.length;i++)out[i]=s.charCodeAt(i)&255;
    return out;
  }
  function pdfBlob(canvas){
    var b64=canvas.toDataURL('image/jpeg',.94).split(',')[1],binary=atob(b64),jpg=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++)jpg[i]=binary.charCodeAt(i);
    var chunks=[],position=0,offsets=[0];
    function add(b){chunks.push(b);position+=b.length;}
    function addText(t){add(ascii(t));}
    function obj(n,contents){offsets[n]=position;addText(n+' 0 obj\n'+contents+'\nendobj\n');}
    addText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>');
    offsets[4]=position;
    addText('4 0 obj\n<< /Type /XObject /Subtype /Image /Width '+canvas.width+' /Height '+canvas.height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');
    add(jpg);
    addText('\nendstream\nendobj\n');
    var stream='q\n595.28 0 0 841.89 0 0 cm\n/Im1 Do\nQ\n';
    obj(5,'<< /Length '+ascii(stream).length+' >>\nstream\n'+stream+'endstream');
    var xref=position;
    addText('xref\n0 6\n0000000000 65535 f \n');
    for(var k=1;k<=5;k++)addText(('0000000000'+offsets[k]).slice(-10)+' 00000 n \n');
    addText('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');
    return new Blob(chunks,{type:'application/pdf'});
  }
  function sharePDF(){
    if(!active)return;
    var blob;
    try{blob=pdfBlob(renderCanvas(active));}
    catch(err){setMessage('Не удалось создать PDF: '+err.message);return;}
    var filename=safeName(active.title)+'.pdf', file;
    try{file=new File([blob],filename,{type:'application/pdf'});}catch(err){file=null;}
    if(file&&navigator.share&&navigator.canShare){
      var supported=false;
      try{supported=navigator.canShare({files:[file]});}catch(ignore){}
      if(supported){
        navigator.share({files:[file],title:active.title||'Текст песни'})
          .catch(function(err){if(!err||err.name!=='AbortError')setMessage('Передача PDF не удалась: '+(err.message||'ошибка'));});
        return;
      }
    }
    try{
      var url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);
      setMessage('PDF создан. Если загрузка не началась, открой сайт в Safari и повтори. Кнопка «Назад в редактор» остаётся доступна.');
      setTimeout(function(){URL.revokeObjectURL(url);},60000);
    }catch(err){setMessage('Это устройство не может сохранить PDF из приложения. Открой страницу в Safari.');}
  }
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay)close();});
  window.addEventListener('resize',resize);
  window.VMM_PRINT_EXPORT={show:show,close:close,safeName:safeName};
}());