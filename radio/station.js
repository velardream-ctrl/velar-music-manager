(function(){
  'use strict';
  function el(id){return document.getElementById(id);}
  var embedded=window.self!==window.top;
  var url=new URL('./',window.location.href).href;
  var promptEvent=null;
  var install=el('install'),message=el('action-status'),field=el('copy-value');
  function report(text){field.hidden=true;message.textContent=text;}
  function copy(value,label){
    function manual(){field.hidden=false;field.value=value;field.focus();field.select();message.textContent='Скопируйте выделенный текст.';}
    if(!navigator.clipboard){manual();return;}
    navigator.clipboard.writeText(value).then(function(){report(label);},manual);
  }
  el('share').onclick=function(){
    if(!navigator.share){copy(url,'Ссылка скопирована.');return;}
    navigator.share({title:'VELAR RADIO',url:url}).catch(function(err){if(err.name!=='AbortError')copy(url,'Ссылка скопирована.');});
  };
  el('embed').onclick=function(){
    copy('<iframe src="'+url+'" title="VELAR RADIO" width="420" height="660" style="max-width:100%;border:0" loading="lazy" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>','Код плеера скопирован.');
  };
  el('output').onclick=function(){report('На iPhone или iPad откройте Пункт управления и выберите устройство в карточке воспроизведения. На компьютере выберите наушники или колонку в настройках вывода звука.');};
  install.hidden=embedded||navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;
  el('open-station').hidden=!embedded;
  window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();promptEvent=event;});
  window.addEventListener('appinstalled',function(){promptEvent=null;install.hidden=true;report('Радио установлено.');});
  install.onclick=function(){
    if(promptEvent){var event=promptEvent;promptEvent=null;event.prompt();return;}
    report('На iPhone и iPad откройте радио в Safari, нажмите «Поделиться» → «На экран Домой». На компьютере выберите установку страницы как приложения в меню браузера, если она доступна. Можно также сохранить закладку.');
  };
  if(!embedded&&'serviceWorker' in navigator)navigator.serviceWorker.register('../sw.js').catch(function(){});
  window.setTimeout(function(){if(el('station-status').textContent==='Подключаемся к эфиру…')el('station-status').textContent='Не удалось получить настройки эфира. Проверьте подключение и обновите страницу.';},12000);
}());
