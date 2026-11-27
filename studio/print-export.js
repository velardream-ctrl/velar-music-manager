/* RUN-046: A4 print viewer and private, in-browser PDF hand-off.
   No window.open: safe for an iPhone Home Screen web app without browser Back.
   No network calls, user lyrics stay on the device for PDF export. */
(function () {
  'use strict';
  var active=null, overlay=null, opener=null, printPrepared=false, pdfBusy=false;
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
    byId('print-page').innerHTML='<img alt="Лист A4" style="display:block;width:210mm;height:297mm;margin:0" src="'+active.prepared.image+'">';
    printPrepared=true;
  }
  function show(p){
    if(!p||!p.text)return;
    close();
    try{p.prepared=p.prepared||prepare(p);}catch(err){return;}
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
        '<span class="vmm-export-title">Лист A4 · адаптивная верстка</span>'+
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
    f.srcdoc=p.prepared.pageHTML;
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
  // Shared measured layout for A4 preview, PDF and print.
  function authorCredit(artist){
    var name=String(artist||'').trim().replace(/\s+/g,' '),key=name.toLowerCase();
    var base='Стихи: Илья Дмитриев';
    if(/^(?:dj\s+)?velar$/.test(key))return base+' (Velar)';
    if(!name||/^(?:илья дмитриев|ilya dmitriev|ilia dmitriev|ilja dmitriev|ilya dmitryev|ilya dmitriyev)$/.test(key))return base;
    return base+' · Исполнитель: '+name;
  }
  function buildLayout(p,ctx){
    var W=794,H=1123,groups=[];
    blocks(p.text).forEach(function(b){
      var g=groups[groups.length-1];
      if(b.type==='stanza'&&g&&g.headingOnly){g.parts.push(b);g.headingOnly=false;}
      else groups.push({parts:[b],headingOnly:b.type==='heading'});
    });
    if(!groups.length)throw new Error('Нет текста для печати.');
    var title=String(p.title||'Текст песни'),meta=authorCredit(p.artist);
    function font(size,bold){ctx.font=(bold?'bold ':'')+size+'px Arial, sans-serif';}
    function candidate(size,margin,cols,allowSplit){
      // Permanent 20 mm left binding gutter; never shrink it for dense lyrics.
      var leftMargin=76,rightMargin=margin,gap=Math.max(32,margin),usable=W-leftMargin-rightMargin,width=(usable-(cols-1)*gap)/cols;
      var titleSize=Math.max(22,Math.min(34,size*1.12)),titleLH=titleSize*1.18;
      font(titleSize,true);var titleRows=wrap(ctx,title,usable);
      font(13,false);var metaRows=meta?wrap(ctx,meta,usable):[];
      var top=margin+titleRows.length*titleLH+metaRows.length*17+Math.max(18,size*.6);
      var bottom=H-margin,available=bottom-top,lh=size*1.28;
      var flat=[],boundaries=[],sums=[0];
      groups.forEach(function(g,i){
        if(i)boundaries.push(flat.length);
        var first=true;
        g.parts.forEach(function(part){
          var bold=part.type==='heading';font(size,bold);
          part.lines.forEach(function(line){wrap(ctx,line,width).forEach(function(t){
            var gapBefore=i>0&&first?lh:0;first=false;
            flat.push({text:t,bold:bold,gapBefore:gapBefore});
            sums.push(sums[sums.length-1]+lh+gapBefore);
          });});
        });
      });
      function height(a,b){return sums[b]-sums[a]-(a<b?flat[a].gapBefore:0);}
      var ranges,heights,best=Infinity;
      if(cols===1){
        var total=height(0,flat.length);if(total>available+.01)return null;
        ranges=[[0,flat.length]];heights=[total];
      }else{
        var choices=boundaries.slice();
        if(allowSplit)for(var i=2;i<flat.length-1;i++){
          if(!flat[i-2].bold&&!flat[i-1].bold&&!flat[i].bold&&!flat[i+1].bold&&choices.indexOf(i)<0)choices.push(i);
        }
        choices.forEach(function(cut){
          if(cut<=0||cut>=flat.length)return;
          if(flat[cut-1].bold&&!flat[cut].bold&&!flat[cut].gapBefore)return;
          var a=height(0,cut),b=height(cut,flat.length);
          if(Math.max(a,b)>available+.01)return;
          var score=Math.max(a,b)+Math.abs(a-b)*.15+(boundaries.indexOf(cut)<0?lh*2.5:0);
          if(score<best){best=score;ranges=[[0,cut],[cut,flat.length]];heights=[a,b];}
        });
        if(!ranges)return null;
      }
      return {font:size,columns:cols,margin:margin,leftMargin:leftMargin,rightMargin:rightMargin,centerX:leftMargin+usable/2,columnWidth:width,columnGap:gap,top:top,bottom:bottom,lineHeight:lh,flat:flat,ranges:ranges,heights:heights,titleRows:titleRows,titleSize:titleSize,titleLH:titleLH,metaRows:metaRows,available:available};
    }
    var chosen=null;
    [38,28,20].some(function(margin){
      var best=null;
      for(var size=44;size>=8;size-=.5){
        var one=candidate(size,margin,1,false),two=candidate(size,margin,2,false);
        if(one||two){best=one||two;break;}
      }
      if(!best)return false;
      if(!chosen||best.font>chosen.font)chosen=best;
      return best.font>=18;
    });
    if(chosen&&chosen.columns===2&&Math.abs(chosen.heights[0]-chosen.heights[1])>chosen.lineHeight*7){
      var balanced=candidate(chosen.font,chosen.margin,2,true);
      if(balanced&&Math.abs(balanced.heights[0]-balanced.heights[1])+chosen.lineHeight*3<Math.abs(chosen.heights[0]-chosen.heights[1]))chosen=balanced;
    }
    // Only exceptionally dense or unbroken text may split at lyric-line boundaries.
    if(!chosen||chosen.font<16){
      for(var s=44;s>=8;s-=.5){var split=candidate(s,20,2,true);if(split){if(!chosen||split.font>chosen.font)chosen=split;break;}}
    }
    if(!chosen)throw new Error('Весь текст не помещается на одном листе A4 без обрезки.');
    var placed=[],ends=[];
    chosen.ranges.forEach(function(range,col){
      var a=range[0],b=range[1],gaps=0;
      for(var i=a+1;i<b;i++)if(chosen.flat[i].gapBefore)gaps++;
      var slack=Math.max(0,chosen.available-chosen.heights[col]);
      var extra=gaps?Math.min(slack/gaps,chosen.lineHeight*1.2):0;
      var residual=Math.max(0,slack-extra*gaps),y=chosen.top;
      // A very short song is centered vertically instead of creating giant gaps.
      if(chosen.columns===1&&residual>chosen.lineHeight*3)y+=residual*.35;
      for(var j=a;j<b;j++){
        var row=chosen.flat[j];if(j>a&&row.gapBefore)y+=row.gapBefore+extra;
        placed.push({text:row.text,bold:row.bold,x:chosen.leftMargin+col*(chosen.columnWidth+chosen.columnGap),y:y+chosen.font,column:col});
        y+=chosen.lineHeight;
      }
      ends.push(y);
    });
    chosen.rows=placed;chosen.ends=ends;return chosen;
  }
  function renderCanvas(p){
    var scale=3,W=794,H=1123,canvas=document.createElement('canvas');
    canvas.width=W*scale;canvas.height=H*scale;
    var ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas недоступен');
    ctx.scale(scale,scale);var plan=buildLayout(p,ctx);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.textBaseline='alphabetic';ctx.textAlign='center';ctx.fillStyle='#111';
    ctx.font='bold '+plan.titleSize+'px Arial, sans-serif';
    plan.titleRows.forEach(function(t,i){ctx.fillText(t,plan.centerX,plan.margin+plan.titleSize+i*plan.titleLH);});
    ctx.font='13px Arial, sans-serif';ctx.fillStyle='#555';
    plan.metaRows.forEach(function(t,i){ctx.fillText(t,plan.centerX,plan.margin+plan.titleRows.length*plan.titleLH+13+i*17);});
    ctx.textAlign='left';ctx.fillStyle='#111';
    plan.rows.forEach(function(row){ctx.font=(row.bold?'bold ':'')+plan.font+'px Arial, sans-serif';ctx.fillText(row.text,row.x,row.y);});
    return {canvas:canvas,layout:plan};
  }
  function prepare(p){
    var result=renderCanvas(p),image=result.canvas.toDataURL('image/jpeg',.96);
    return {canvas:result.canvas,layout:result.layout,image:image,pageHTML:'<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}img{display:block;width:794px;height:1123px}@media print{img{width:210mm;height:297mm}}</style></head><body><img alt="Лист A4" src="'+image+'"></body></html>'};
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
    if(!active||pdfBusy)return;
    var blob;
    try{blob=pdfBlob(active.prepared.canvas);}
    catch(err){setMessage('Не удалось создать PDF: '+err.message);return;}
    var filename=safeName(active.title)+' — текст.pdf', file;
    try{file=new File([blob],filename,{type:'application/pdf'});}catch(err){file=null;}
    if(file&&navigator.share&&navigator.canShare){
      var supported=false;
      try{supported=navigator.canShare({files:[file]});}catch(ignore){}
      if(supported){
        pdfBusy=true;
        try{
          // Exactly one file, no separate text, image, or second download.
          Promise.resolve(navigator.share({files:[file]})).then(function(){pdfBusy=false;},function(err){pdfBusy=false;if(!err||err.name!=='AbortError')setMessage('Передача PDF не удалась: '+(err&&err.message||'ошибка'));});
        }catch(err){pdfBusy=false;setMessage('Не удалось открыть меню PDF: '+(err.message||'ошибка'));}
        return;
      }
    }
    try{
      pdfBusy=true;
      var url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);
      setMessage('PDF создан. Если загрузка не началась, открой сайт в Safari и повтори. Кнопка «Назад в редактор» остаётся доступна.');
      setTimeout(function(){pdfBusy=false;},1000);
      setTimeout(function(){URL.revokeObjectURL(url);},60000);
    }catch(err){pdfBusy=false;setMessage('Это устройство не может сохранить PDF из приложения. Открой страницу в Safari.');}
  }
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&overlay)close();});
  window.addEventListener('resize',resize);
  window.VMM_PRINT_EXPORT={show:show,close:close,safeName:safeName,prepare:prepare,buildLayout:buildLayout,authorCredit:authorCredit};
}());