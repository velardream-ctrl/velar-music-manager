/* RUN-074 — VELAR Assistant, offline rule-based music concierge.
   No external AI/API, no per-message Firestore reads/writes, no tracking.
   User messages live only in this tab's memory; mail is never sent silently.
   ES5 / Safari12 compatible. */
(function(){
 'use strict';
 var root=null,dialog=null,log=null,input=null,prompt=null,buttons=null,header=null;
 var config=null,published=null,opened=false,initialized=false;
 var MAX_INPUT=360;
 function find(id){return document.getElementById(id);}
 function el(tag,cls,t){
   var e=document.createElement(tag);
   if(cls)e.className=cls;
   if(typeof t==='string')e.textContent=t;
   return e;
 }
 function clear(e){while(e&&e.firstChild)e.removeChild(e.firstChild);}
 function norm(s){
   return String(s||'').toLowerCase().replace(/ё/g,'е')
     .replace(/[^a-zа-я0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
 }
 function contains(query,words){
   var terms=String(words||'').split(',');
   return terms.some(function(w){
     var needle=norm(w);
     return needle.length>=2&&(' '+query+' ').indexOf(' '+needle+' ')!==-1;
   });
 }
 var moodWords=[
   {id:'wedding',words:'свадьба,свадьбу,свадебные,свадебную,женитьба,брак,замуж,торжество'},
   {id:'sadness',words:'грустно,грусть,печаль,печально,тоска,погрустить,меланхолия,одиноко'},
   {id:'happiness',words:'радость,радостно,счастье,счастлив,весело,позитив'},
   {id:'love',words:'любовь,любви,влюблен,романтика,любимая,романтическая'},
   {id:'humor',words:'юмор,смешная,смешные,смешно,шутка,веселая'},
   {id:'space',words:'космос,космический,звезды,вселенная,галактика'},
   {id:'loyalty',words:'верность,верный,преданность'},
   {id:'jealousy',words:'ревность,ревную,ревнивый'},
   {id:'nature',words:'природа,лес,озеро,олень'},
   {id:'dance',words:'танцы,танцевать,дискотека,танцевальная'}
 ];
 function topicFor(q,data){
   var ts=data&&data.genres&&data.genres.topics;
   if(!ts||!Array.isArray(ts.entries))return null;
   var found=null,topic=null;
   moodWords.some(function(entry){
     if(!contains(q,entry.words))return false;
     topic=ts.entries.filter(function(t){return t.slug===entry.id&&t.visible;})[0]||null;
     if(topic)found=topic;
     return !!topic;
   });
   if(!found){
     ts.entries.some(function(t){
       if(!t.visible)return false;
       var needle=norm(t.label);
       if(needle.length>=3&&(' '+q+' ').indexOf(' '+needle+' ')!==-1){found=t;return true;}
       return false;
     });
   }
   return found;
 }
 function answer(raw,data,settings){
   var q=norm(raw);
   if(!q)return {text:'Расскажи, что тебе интересно: музыка, настроение, артисты или сотрудничество.'};
   if(contains(q,'оператор,свяжи с автором,человек,сотрудничество,сотрудничать,певец,певица,артист для песни,выступление,выступить,концерт,предложение,коллаборация,контакт,почта,написать автору')){
     return {text:settings.contactEmail?
       'Я цифровой помощник, не живой оператор. Могу помочь составить письмо о сотрудничестве. Отправка состоится только из твоей почтовой программы после подтверждения.':
       'Я цифровой помощник, не живой оператор. Автоматическая отправка сообщений пока отключена. Контактная почта ещё не настроена; можно найти официальные страницы артистов в разделе подписок.',
       action:settings.contactEmail?'email':'link',target:settings.contactEmail?'':'#playlists',
       label:settings.contactEmail?'Написать автору':'Перейти к официальным страницам'};
   }
   var rules=settings.rules||[];
   for(var i=0;i<rules.length;i++){
     if(contains(q,rules[i].keywords))return {text:rules[i].answer};
   }
   var mood=topicFor(q,data);
   if(mood){
     return {text:mood.tracks&&mood.tracks.length?
       'Для настроения «'+mood.label+'» найдены песни: '+mood.tracks.length+'. Открой подборку и выбери композицию — воспроизведение начнётся только после твоего нажатия.':
       'Тема «'+mood.label+'» уже есть во вселенной VELARDREAM, но её песни пока готовятся к публикации. Можешь посмотреть и другие тематические миры.',
       action:'topic',target:mood.slug,label:'Открыть «'+mood.label+'»'};
   }
   if(contains(q,'привет,здравствуй,здравствуйте,добрый день,hello,hi')){
     return {text:'Привет! Рад встрече во вселенной VELARDREAM. Какую музыку хочется услышать: грустную, свадебную, романтическую или весёлую?'};
   }
   if(contains(q,'радио,radio,плейлист,музыку подряд')){
     return {text:'VELAR RADIO — официальный музыкальный плейлист. Он запускается только по твоему выбору. Можно также открыть другие плейлисты.',
       action:'link',target:'#playlists',label:'Посмотреть плейлисты'};
   }
   if(contains(q,'язык,финский,немецкий,испанский,русский,английский,на каком языке')){
     return {text:'В нашей вселенной есть миры настоящих и придуманных языков. Выбери язык и открой его подборку.',
       action:'link',target:'#languages',label:'Выбрать язык'};
   }
   if(contains(q,'клип,клипы,видео,релиз,альбом,новая песня')){
     return {text:'В разделе релизов представлены синглы, альбомы и видеоклипы. Можно отфильтровать нужный формат.',
       action:'link',target:'#releases',label:'Открыть релизы'};
   }
   if(contains(q,'артист,исполнитель,кто поет,певцы,певица')){
     return {text:'Здесь есть отдельные миры артистов. Выбери исполнителя, чтобы узнать больше и услышать его музыку.',
       action:'link',target:'#artists',label:'Открыть артистов'};
   }
   return {text:settings.contactEmail?
     'Я пока не умею уверенно отвечать на этот вопрос. Могу открыть музыкальную вселенную или помочь написать автору.':
     'Я ещё учусь отвечать на вопросы. Попробуй написать «свадьба», «грустно», «радио», «артисты» или «сотрудничество».',
     action:'link',target:'#topics',label:'Исследовать темы'};
 }
 function itemMessage(role,text,action){
   if(!log)return;
   var row=el('div','velar-chat-line '+(role==='visitor'?'is-visitor':'is-assistant'));
   row.appendChild(el('p','',text));
   if(action){
     var a=el('button','velar-chat-action',action.label);
     a.type='button';
     a.onclick=function(){
       if(action.action==='email'){
         var email=config&&config.contactEmail;
         if(!email)return;
         var subject='VELARDREAM — предложение о сотрудничестве';
         var body='Здравствуйте!%0A%0AЯ хочу обсудить сотрудничество с VELARDREAM.%0A';
         // The browser opens a *draft* in the visitor's mail application.
         // No sender data is transmitted by this website.
         window.location.href='mailto:'+email+'?subject='+encodeURIComponent(subject)+'&body='+body;
       }else if(action.action==='topic'){
         if(window.VELAR_TOPICS&&window.VELAR_TOPICS.select)
           window.VELAR_TOPICS.select(action.target);
         window.location.hash='topics';
       }else if(action.action==='link'){
         window.location.hash=action.target.slice(1);
       }
     };
     row.appendChild(a);
   }
   log.appendChild(row);
   if(log.scrollHeight)log.scrollTop=log.scrollHeight;
 }
 function greetingSeen(){
   try{return !!(window.sessionStorage&&window.sessionStorage.getItem('velar-assistant-greeted'));}
   catch(ignore){return false;}
 }
 function markGreeting(){
   try{if(window.sessionStorage)window.sessionStorage.setItem('velar-assistant-greeted','1');}
   catch(ignore){}
 }
 function say(query){
   var t=String(query||'').trim().slice(0,MAX_INPUT);
   if(!t)return;
   itemMessage('visitor',t);
   var result=answer(t,published,config);
   itemMessage('assistant',result.text,result.action?result:null);
   if(input)input.value='';
 }
 function paint(){
   if(initialized)return;
   root=find('velar-assistant');if(!root)return;
   initialized=true;root.className='velar-assistant';
   var launcher=el('button','velar-assistant-launch');
   launcher.type='button';launcher.setAttribute('aria-controls','velar-assistant-dialog');
   launcher.setAttribute('aria-expanded','false');
   var symbol=el('img','velar-assistant-symbol');
   symbol.src='assets/velardream-symbol.svg';symbol.alt='';symbol.loading='lazy';
   launcher.appendChild(symbol);launcher.appendChild(el('span','', 'Помощник VELAR'));
   root.appendChild(launcher);
   prompt=el('div','velar-assistant-greeting hidden');
   prompt.appendChild(el('span','velar-assistant-wave','')); // SVG/CSS waves, no platform emoji
   prompt.appendChild(el('span','velar-assistant-greeting-text','Добро пожаловать! Подобрать музыку?'));
   var dismiss=el('button','velar-assistant-greeting-close','×');
   dismiss.type='button';dismiss.setAttribute('aria-label','Скрыть приветствие');
   dismiss.onclick=function(){prompt.className='velar-assistant-greeting hidden';markGreeting();};
   prompt.appendChild(dismiss);root.appendChild(prompt);
   dialog=el('div','velar-assistant-dialog hidden');dialog.id='velar-assistant-dialog';
   dialog.setAttribute('role','region');dialog.setAttribute('aria-label','VELAR — музыкальный помощник');
   header=el('div','velar-assistant-header');
   var headerTitle=el('strong','velar-assistant-title');
   header.appendChild(headerTitle);
   header.appendChild(el('span','velar-assistant-header-note','Самостоятельный бот · без платного ИИ'));
   var close=el('button','velar-assistant-close','×');close.type='button';
   close.setAttribute('aria-label','Закрыть помощника');header.appendChild(close);
   dialog.appendChild(header);
   log=el('div','velar-assistant-log');log.setAttribute('role','log');
   log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
   dialog.appendChild(log);
   buttons=el('div','velar-assistant-suggestions');
   [['Мне грустно','грустно'],['Свадебная музыка','свадьба'],['Космос','космос'],
     ['Сотрудничество','сотрудничество']].forEach(function(pair){
       var button=el('button','velar-assistant-suggestion',pair[0]);button.type='button';
       button.onclick=function(){say(pair[1]);};buttons.appendChild(button);
     });
   dialog.appendChild(buttons);
   var form=el('form','velar-assistant-form');
   input=el('input','velar-assistant-input');
   input.type='text';input.maxLength=MAX_INPUT;input.autocomplete='off';
   input.setAttribute('aria-label','Напиши вопрос помощнику');
   input.placeholder='Например: нужна грустная песня…';
   var submit=el('button','velar-assistant-submit','Спросить');submit.type='submit';
   form.appendChild(input);form.appendChild(submit);
   form.onsubmit=function(event){
     if(event&&event.preventDefault)event.preventDefault();
     say(input.value);
     return false;
   };
   dialog.appendChild(form);
   dialog.appendChild(el('p','velar-assistant-privacy',
     'Ответы формируются на устройстве. Сообщения не сохраняются и не отправляются автору.'));
   root.appendChild(dialog);
   function toggle(open){
     opened=!!open;
     dialog.className=opened?'velar-assistant-dialog':'velar-assistant-dialog hidden';
     launcher.setAttribute('aria-expanded',opened?'true':'false');
     prompt.className='velar-assistant-greeting hidden';markGreeting();
     if(opened){
       if(!log.children.length)itemMessage('assistant',config.welcome);
       if(input&&input.focus)input.focus();
     }else if(launcher.focus)launcher.focus();
   }
   launcher.onclick=function(){toggle(!opened);};
   close.onclick=function(){toggle(false);};
   dialog.onkeydown=function(e){
     if(e&&e.key==='Escape')toggle(false);
   };
 }
 function render(data){
   published=data||published;
   var settings=published&&published.genres&&published.genres.assistant;
   if(!settings&&window.VMM_LANDING_SCHEMA)
     settings=window.VMM_LANDING_SCHEMA.defaults().genres.assistant;
   if(!settings)return;
   config=settings;
   paint();
   if(!root)return;
   if(!config.enabled){
     root.className='velar-assistant hidden';
     if(dialog)dialog.className='velar-assistant-dialog hidden';
     opened=false;return;
   }
   root.className='velar-assistant';
   if(header&&header.firstChild)header.firstChild.textContent=config.title;
   if(prompt&&config.greetingEnabled&&!greetingSeen()&&!opened){
     prompt.className='velar-assistant-greeting';
     var span=prompt.querySelector&&prompt.querySelector('.velar-assistant-greeting-text');
     if(span)span.textContent=config.welcome;
   }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){
   if(window.VMM_LANDING_SCHEMA)render(window.VMM_LANDING_SCHEMA.defaults());
 });
 else if(window.VMM_LANDING_SCHEMA)render(window.VMM_LANDING_SCHEMA.defaults());
 window.VELAR_ASSISTANT={render:render,answer:answer,norm:norm,topicFor:topicFor};
}());
