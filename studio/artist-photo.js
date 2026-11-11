/* RUN-065. Artist portrait crop/compress/upload, compatible with Safari 12.
   Public thumbnails only: no private music, lyrics, Drive URLs or tokens. */
(function(){
  'use strict';
  var MAX_SOURCE=20*1024*1024, MAX_RESULT=320*1024;
  var sdkPromise=null, activeObjectUrl='';
  function text(node,value){node.textContent=String(value||'');}
  function el(tag,cls,words){
    var node=document.createElement(tag);
    if(cls)node.className=cls;
    if(typeof words==='string')node.textContent=words;
    return node;
  }
  function clamp(n,min,max){return Math.min(max,Math.max(min,n));}
  function geometry(w,h,size,zoom,x,y){
    var factor=Math.max(size/w,size/h)*zoom;
    var rw=w*factor,rh=h*factor;
    return {x:clamp((size-rw)/2+x*size/300,size-rw,0),
      y:clamp((size-rh)/2+y*size/300,size-rh,0),w:rw,h:rh};
  }
  function script(){
    if(window.firebase&&typeof firebase.storage==='function')return Promise.resolve();
    if(sdkPromise)return sdkPromise;
    sdkPromise=new Promise(function(resolve,reject){
      var s=document.createElement('script');
      s.src='https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js';
      s.onload=function(){if(window.firebase&&firebase.storage)resolve();else reject(new Error('Firebase Storage не загрузился.'));};
      s.onerror=function(){reject(new Error('Не удалось загрузить модуль хранения фотографий.'));};
      document.head.appendChild(s);
    }).catch(function(err){sdkPromise=null;throw err;});
    return sdkPromise;
  }
  function randomHex(){
    if(!window.crypto||!window.crypto.getRandomValues)throw new Error('Для безопасной загрузки требуется HTTPS и Web Crypto.');
    var a=new Uint8Array(8);window.crypto.getRandomValues(a);
    return Array.prototype.map.call(a,function(n){return ('0'+n.toString(16)).slice(-2);}).join('');
  }
  function attach(parent,item,handlers){
    var wrap=el('section','artist-photo-editor');
    var title=el('strong','artist-photo-heading','Фото артиста');wrap.appendChild(title);
    var note=el('p','sync-note','Фото загружается с телефона или компьютера. Настрой кадр, затем отправь готовое изображение; после загрузки сохрани черновик.');
    wrap.appendChild(note);
    var layout=el('label','landing-field');
    layout.appendChild(el('span','','Оформление фотографии'));
    var shape=document.createElement('select');
    shape.className='artist-photo-shape';
    [['square','Квадрат'],['circle','Круг']].forEach(function(row){
      var option=el('option','',row[1]);option.value=row[0];shape.appendChild(option);
    });
    shape.value=item.imageShape==='circle'?'circle':'square';
    shape.onchange=function(){item.imageShape=this.value;preview.className='artist-photo-canvas-wrap'+(this.value==='circle'?' is-circle':'');handlers.changed();};
    layout.appendChild(shape);wrap.appendChild(layout);
    if(item.imageUrl){
      var current=el('img','artist-photo-current');
      current.src=item.imageUrl;current.alt='Текущая фотография: '+(item.title||'артист');
      current.loading='lazy';wrap.appendChild(current);
    }
    var fileLabel=el('label','landing-field');
    fileLabel.appendChild(el('span','','Выбрать фотографию (JPEG, PNG, WebP, HEIC)'));
    var file=document.createElement('input');
    file.type='file';file.accept='image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';
    fileLabel.appendChild(file);wrap.appendChild(fileLabel);
    var editor=el('div','artist-photo-tools hidden'),preview=el('div','artist-photo-canvas-wrap');
    var canvas=document.createElement('canvas');canvas.width=300;canvas.height=300;
    canvas.className='artist-photo-preview';canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Предпросмотр квадратной области фотографии; перетащи изображение для кадрирования');
    preview.appendChild(canvas);editor.appendChild(preview);
    var zoomLabel=el('label','artist-photo-zoom','Масштаб');
    var zoomInput=document.createElement('input');zoomInput.type='range';zoomInput.min='1';zoomInput.max='3';zoomInput.step='0.05';zoomInput.value='1';
    zoomLabel.appendChild(zoomInput);editor.appendChild(zoomLabel);
    var controls=el('div','artist-photo-actions');
    var reset=el('button','landing-small','По центру');reset.type='button';
    var upload=el('button','landing-add','Загрузить обработанное фото');upload.type='button';
    controls.appendChild(reset);controls.appendChild(upload);editor.appendChild(controls);
    var status=el('p','sync-note artist-photo-status','');status.setAttribute('role','status');
    editor.appendChild(status);wrap.appendChild(editor);
    parent.appendChild(wrap);
    var img=null,zoom=1,offsetX=0,offsetY=0,working=false;
    function drawOn(target){
      if(!img)return;
      var size=target.width,geom=geometry(img.naturalWidth||img.width,img.naturalHeight||img.height,size,zoom,offsetX,offsetY);
      var ctx=target.getContext('2d');
      if(!ctx)throw new Error('Браузер не поддерживает обработку изображения.');
      ctx.clearRect(0,0,size,size);
      ctx.fillStyle='#11182a';ctx.fillRect(0,0,size,size);
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(img,geom.x,geom.y,geom.w,geom.h);
    }
    function redraw(){try{drawOn(canvas);}catch(e){text(status,e.message);}}
    function closeUrl(){if(activeObjectUrl){URL.revokeObjectURL(activeObjectUrl);activeObjectUrl='';}}
    function readyPicture(){
      if(!img)return;
      editor.className='artist-photo-tools';
      preview.className='artist-photo-canvas-wrap'+(shape.value==='circle'?' is-circle':'');
      text(status,'Перетащи фотографию пальцем или мышью, увеличь масштаб и нажми «Загрузить».');
      redraw();
    }
    file.onchange=function(){
      var candidate=this.files&&this.files[0];
      if(!candidate)return;
      img=null;editor.className='artist-photo-tools hidden';upload.disabled=false;
      if(candidate.size>MAX_SOURCE){handlers.info('Слишком большой файл. Максимум 20 МБ.');return;}
      if(!/^image\/(?:jpeg|png|webp|heic|heif)$/i.test(candidate.type||'')&&!/\.(?:jpe?g|png|webp|heic|heif)$/i.test(candidate.name||'')){
        handlers.info('Поддерживаются только фотографии JPEG, PNG, WebP или HEIC.');return;
      }
      closeUrl();activeObjectUrl=URL.createObjectURL(candidate);
      var loaded=new Image();
      loaded.onload=function(){
        if(!loaded.naturalWidth||!loaded.naturalHeight){handlers.info('Не удалось прочитать размеры фотографии.');return;}
        img=loaded;zoom=1;offsetX=0;offsetY=0;zoomInput.value='1';readyPicture();
      };
      loaded.onerror=function(){closeUrl();handlers.info('Этот формат не открывается в браузере. Попробуй сохранить фото как JPEG.');};
      loaded.src=activeObjectUrl;
    };
    zoomInput.oninput=function(){zoom=Number(this.value)||1;redraw();};
    reset.onclick=function(){zoom=1;offsetX=0;offsetY=0;zoomInput.value='1';redraw();};
    // Mouse and touch events deliberately work on iOS 12 (before PointerEvent).
    function coordinates(evt){var p=evt.touches&&evt.touches.length?evt.touches[0]:evt;return {x:p.clientX,y:p.clientY};}
    var drag=null;
    function start(evt){
      if(!img)return;
      var p=coordinates(evt);drag={x:p.x,y:p.y,ox:offsetX,oy:offsetY};
      if(evt.cancelable)evt.preventDefault();
    }
    function move(evt){
      if(!drag||!img)return;
      var p=coordinates(evt),r=canvas.getBoundingClientRect();
      var scale=300/Math.max(r.width,1);
      offsetX=drag.ox+(p.x-drag.x)*scale;offsetY=drag.oy+(p.y-drag.y)*scale;
      var g=geometry(img.naturalWidth||img.width,img.naturalHeight||img.height,300,zoom,offsetX,offsetY);
      offsetX=(g.x-(300-g.w)/2);offsetY=(g.y-(300-g.h)/2);
      if(evt.cancelable)evt.preventDefault();redraw();
    }
    function end(){drag=null;}
    canvas.addEventListener('mousedown',start);
    canvas.addEventListener('touchstart',start,{passive:false});
    document.addEventListener('mousemove',move);
    document.addEventListener('mouseup',end);
    canvas.addEventListener('touchmove',move,{passive:false});
    canvas.addEventListener('touchend',end);
    canvas.addEventListener('touchcancel',end);
    function exportBlob(targetSize,quality,type){
      var output=document.createElement('canvas');output.width=targetSize;output.height=targetSize;
      drawOn(output);
      return new Promise(function(resolve,reject){
        if(!output.toBlob){reject(new Error('Браузер не поддерживает безопасное сжатие фотографий.'));return;}
        output.toBlob(function(blob){if(blob)resolve(blob);else reject(new Error('Не удалось конвертировать фотографию.'));},type,quality);
      });
    }
    function prepare(){
      var dimensions=[720,640,560,480],qualities=[0.85,0.77,0.68],idx=0;
      function attempt(type){
        var dimension=dimensions[Math.min(Math.floor(idx/qualities.length),dimensions.length-1)];
        var quality=qualities[idx%qualities.length];
        return exportBlob(dimension,quality,type).then(function(blob){
          if(type==='image/webp'&&blob.type!=='image/webp'){idx=0;return attempt('image/jpeg');}
          if(!/^image\/(?:webp|jpeg)$/.test(blob.type))throw new Error('Браузер не смог создать JPEG или WebP.');
          if(blob.size<=MAX_RESULT)return blob;
          idx++;
          if(idx<dimensions.length*qualities.length)return attempt(type);
          throw new Error('Даже после сжатия файл больше 320 КБ. Выбери другое фото.');
        });
      }
      return attempt('image/webp');
    }
    upload.onclick=function(){
      if(!img||working)return;
      if(!item.artistId||!/^[a-z0-9-]{1,80}$/.test(item.artistId)){
        text(status,'Сначала добавь артиста из каталога, чтобы у него был постоянный ID.');return;
      }
      if(!navigator.onLine){text(status,'Для загрузки фотографии нужен интернет.');return;}
      working=true;upload.disabled=true;file.disabled=true;
      text(status,'Кадрируем и сжимаем фотографию…');
      Promise.all([handlers.authorized(),script(),prepare()]).then(function(parts){
        var auth=parts[0],blob=parts[2];
        if(!auth||!auth.user||!auth.db)throw new Error('Не удалось проверить права администратора.');
        var mime=blob.type,ext=mime==='image/webp'?'webp':'jpg';
        var path='public/artist-avatars/'+item.artistId+'/'+Date.now()+'-'+randomHex()+'.'+ext;
        text(status,'Сжатый файл '+Math.ceil(blob.size/1024)+' КБ. Загружаем…');
        var reference=firebase.storage().ref().child(path);
        return reference.put(blob,{contentType:mime,cacheControl:'public,max-age=31536000,immutable'}).then(function(){
          return reference.getDownloadURL();
        });
      }).then(function(url){
        item.imageUrl=url;
        if(current){current.src=url;}else{
          current=el('img','artist-photo-current');current.alt='Загруженное фото '+(item.title||'артиста');
          wrap.insertBefore(current,fileLabel);
          current.src=url;
        }
        handlers.changed();
        text(status,'Фотография загружена. Осталось нажать «Сохранить черновик», затем при необходимости «Опубликовать».');
        handlers.info('Фото артиста загружено. Не забудь сохранить черновик.');
      }).catch(function(err){
        var message=err&&err.message||'Ошибка загрузки.';
        if(err&&(/storage\/unauthorized|storage\/unknown|storage\/bucket-not-found|storage\/quota-exceeded/.test(err.code||'')))message+=' Проверь Cloud Storage, тариф Blaze и опубликованные правила Storage.';
        text(status,'Не удалось загрузить: '+message);
      }).then(function(){working=false;upload.disabled=false;file.disabled=false;});
    };
  }
  window.VMM_ARTIST_PHOTO={attach:attach,geometry:geometry};
}());
