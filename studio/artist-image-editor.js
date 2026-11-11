/* RUN-065 — local crop + optimized portrait, no paid Firebase Storage.
   Images are small, sanitized WebP/JPEG data URLs stored only on explicit
   landing draft-save/publish. Supports old Safari, touch sliders and pointer. */
(function(){
  'use strict';
  var MAX_SOURCE=15*1024*1024,MAX_DIMENSION=14000,MAX_IMAGE_CHARS=126000;
  function validate(image){
    if(typeof image!=='string'||image.length>MAX_IMAGE_CHARS||
      !/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image))
      throw new Error('Фотография должна быть сжатым WebP или JPEG до 90 КБ.');
    return image;
  }
  function cropRect(w,h,zoom,x,y){
    if(!(w>0&&h>0)||w>MAX_DIMENSION||h>MAX_DIMENSION)throw new Error('Недопустимый размер изображения.');
    zoom=Math.max(1,Math.min(3,Number(zoom)||1));
    x=Math.max(-1,Math.min(1,Number(x)||0));
    y=Math.max(-1,Math.min(1,Number(y)||0));
    var side=Math.min(w,h)/zoom;
    var left=(w-side)*(x+1)/2,top=(h-side)*(y+1)/2;
    return {sx:left,sy:top,sw:side,sh:side};
  }
  function makeCanvas(size){
    var c=document.createElement('canvas');c.width=size;c.height=size;return c;
  }
  function paint(canvas,img,zoom,x,y){
    var w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
    var r=cropRect(w,h,zoom,x,y);
    var ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas недоступен.');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,r.sx,r.sy,r.sw,r.sh,0,0,canvas.width,canvas.height);
  }
  function compress(img,zoom,x,y){
    var sizes=[720,640,560,480],quality=[.86,.79,.72,.64,.56,.48],best='';
    for(var i=0;i<sizes.length;i++){
      var canvas=makeCanvas(sizes[i]);paint(canvas,img,zoom,x,y);
      for(var j=0;j<quality.length;j++){
        var output=canvas.toDataURL('image/webp',quality[j]);
        if(!/^data:image\/webp;base64,/.test(output))
          output=canvas.toDataURL('image/jpeg',quality[j]);
        if(!best||output.length<best.length)best=output;
        if(output.length<=MAX_IMAGE_CHARS)return validate(output);
      }
    }
    throw new Error('Не удалось уменьшить изображение до безопасного размера. Попробуй другую фотографию.');
  }
  function open(file,onSave,onError){
    if(!file){return;}
    if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type||'')||
      file.size>MAX_SOURCE||file.size===0){
      onError('Нужна фотография JPEG, PNG или WebP размером до 15 МБ.');
      return;
    }
    var reader=new FileReader();
    reader.onerror=function(){onError('Не удалось прочитать фотографию.');};
    reader.onload=function(){
      var image=new Image();
      image.onerror=function(){onError('Не удалось открыть фотографию. Попробуй JPEG или PNG.');};
      image.onload=function(){
        try{
          cropRect(image.naturalWidth,image.naturalHeight,1,0,0);
        }catch(e){onError(e.message);return;}
        dialog(image,onSave,onError);
      };
      image.src=reader.result;
    };
    reader.readAsDataURL(file);
  }
  function dialog(img,onSave,onError){
    var overlay=document.createElement('div');overlay.className='vmm-photo-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Кадрирование фотографии артиста');
    var panel=document.createElement('div');panel.className='vmm-photo-dialog';
    var title=document.createElement('h3');title.textContent='Подогнать фотографию';panel.appendChild(title);
    var instructions=document.createElement('p');instructions.textContent='Перемести кадр ползунками, увеличь при необходимости. Фотография станет квадратной; круглый вид выбирается отдельно в карточке артиста.';panel.appendChild(instructions);
    var canvas=makeCanvas(360);canvas.className='vmm-photo-canvas';canvas.setAttribute('aria-label','Предварительный просмотр кадра');panel.appendChild(canvas);
    var controls={},config=[
      {id:'zoom',label:'Увеличение',min:1,max:3,step:.05,value:1},
      {id:'x',label:'Горизонтально',min:-1,max:1,step:.05,value:0},
      {id:'y',label:'Вертикально',min:-1,max:1,step:.05,value:0}
    ];
    function setting(id){return Number(controls[id].value);}
    function redraw(){paint(canvas,img,setting('zoom'),setting('x'),setting('y'));}
    config.forEach(function(entry){
      var label=document.createElement('label');label.className='vmm-photo-control';
      var caption=document.createElement('span');caption.textContent=entry.label;label.appendChild(caption);
      var range=document.createElement('input');range.type='range';range.min=entry.min;range.max=entry.max;
      range.step=entry.step;range.value=entry.value;range.oninput=redraw;controls[entry.id]=range;
      label.appendChild(range);panel.appendChild(label);
    });
    var status=document.createElement('p');status.className='sync-note';status.setAttribute('role','status');panel.appendChild(status);
    var actions=document.createElement('div');actions.className='vmm-photo-actions';
    function close(){if(overlay.parentNode)overlay.parentNode.removeChild(overlay);}
    function button(label,cb){
      var b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=cb;return b;
    }
    actions.appendChild(button('Отмена',close));
    actions.appendChild(button('Использовать фото',function(){
      try{
        status.textContent='Сжимаем изображение…';
        var data=compress(img,setting('zoom'),setting('x'),setting('y'));
        onSave(data);close();
      }catch(err){status.textContent=err.message;onError(err.message);}
    }));
    panel.appendChild(actions);overlay.appendChild(panel);document.body.appendChild(overlay);
    redraw();
  }
  window.VMM_ARTIST_IMAGE={open:open,compress:compress,cropRect:cropRect,validate:validate,maxChars:MAX_IMAGE_CHARS};
}());
