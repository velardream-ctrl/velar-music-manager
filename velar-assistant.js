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
 /* RUN-077: source portraits packed into one Safari12-compatible JPEG sprite. */
 function avatarFace(cls,expression){
   var face=el('span',cls+' velar-expression','V');
   face.setAttribute('aria-hidden','true');
   face.setAttribute('data-expression',expression||'neutral');
   return face;
 }
 function expressionFor(raw){
   var q=norm(raw);
   if(contains(q,'выключи,отключи,выключить,отключить'))return 'off';
   if(contains(q,'доброе утро,good morning'))return 'morning';
   if(contains(q,'доброй ночи,спокойной ночи,good night'))return 'night';
   if(contains(q,'спасибо,благодарю,thank you,thanks'))return 'thanks';
   if(contains(q,'любовь,любви,люблю,сердце,романтика,романтическая'))return 'heart';
   if(contains(q,'ок,окей,понятно,договорились,ok,okay'))return 'okay';
   if(contains(q,'ура,радость,весело,праздник'))return 'celebrate';
   if(contains(q,'молодец,победа,peace'))return 'peace';
   if(contains(q,'привет,здравствуй,здравствуйте,hello,добрый день'))return 'wave';
   return 'neutral';
 }
 function greetingFace(){
   var hour=new Date().getHours();
   return hour<6||hour>=22?'night':hour<12?'morning':'wave';
 }
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
 // All visible automatic replies come from the owner's published settings.
 // The schema supplies backwards-compatible defaults for older publications.
 function replyText(settings,key){
   var r=settings&&settings.replies;
   if(r&&typeof r[key]==='string')return r[key];
   var schema=window.VMM_LANDING_SCHEMA;
   if(schema&&schema.defaults)return schema.defaults().genres.assistant.replies[key]||'';
   return '';
 }
 function fillTopic(text,topic){
   return String(text||'').split('{topic}').join(topic.label)
     .split('{count}').join(String(topic.tracks&&topic.tracks.length||0));
 }
 function answer(raw,data,settings){
   var q=norm(raw);
   if(!q)return {text:replyText(settings,'emptyInput')};
   if(contains(q,'оператор,свяжи с автором,человек,сотрудничество,сотрудничать,певец,певица,артист для песни,выступление,выступить,концерт,предложение,коллаборация,контакт,почта,написать автору')){
     return {text:replyText(settings,settings.contactEmail?'contactEnabled':'contactDisabled'),
       action:settings.contactEmail?'email':'link',target:settings.contactEmail?'':'#playlists',
       label:replyText(settings,settings.contactEmail?'contactEnabledButton':'contactDisabledButton')};
   }
   var rules=settings.rules||[];
   for(var i=0;i<rules.length;i++){
     if(contains(q,rules[i].keywords))return {text:rules[i].answer};
   }
   var mood=topicFor(q,data);
   if(mood){
     return {text:fillTopic(replyText(settings,mood.tracks&&mood.tracks.length?'moodWithTracks':'moodWithoutTracks'),mood),
       action:'topic',target:mood.slug,label:fillTopic(replyText(settings,'moodButton'),mood)};
   }
   if(contains(q,'привет,здравствуй,здравствуйте,добрый день,hello,hi'))
     return {text:replyText(settings,'hello')};
   if(contains(q,'радио,radio,плейлист,музыку подряд'))
     return {text:replyText(settings,'radio'),action:'link',target:'#playlists',
       label:replyText(settings,'radioButton')};
   if(contains(q,'язык,финский,финском,немецкий,немецком,испанский,испанском,русский,русском,английский,английском,на каком языке'))
     return {text:replyText(settings,'languages'),action:'link',target:'#languages',
       label:replyText(settings,'languagesButton')};
   if(contains(q,'клип,клипы,видео,релиз,альбом,новая песня'))
     return {text:replyText(settings,'releases'),action:'link',target:'#releases',
       label:replyText(settings,'releasesButton')};
   if(contains(q,'артист,исполнитель,кто поет,певцы,певица'))
     return {text:replyText(settings,'artists'),action:'link',target:'#artists',
       label:replyText(settings,'artistsButton')};
   return {text:replyText(settings,settings.contactEmail?'fallbackEnabled':'fallbackDisabled'),
     action:'link',target:'#topics',label:replyText(settings,'fallbackButton')};
 }
 function itemMessage(role,text,action,expression){
   if(!log)return;
   var row=el('div','velar-chat-line '+(role==='visitor'?'is-visitor':'is-assistant'));
   if(role==='assistant'){
     row.appendChild(avatarFace('velar-chat-avatar',expression));
   }
   row.appendChild(el('p','',text));
   if(action&&action.label){
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
   itemMessage('assistant',result.text,result.action?result:null,expressionFor(t));
   if(input)input.value='';
 }
 function paint(){
   if(initialized)return;
   root=find('velar-assistant');if(!root)return;
   initialized=true;root.className='velar-assistant';
   var launcher=el('button','velar-assistant-launch');
   launcher.type='button';launcher.setAttribute('aria-controls','velar-assistant-dialog');
   launcher.setAttribute('aria-expanded','false');
   var symbol=avatarFace('velar-assistant-symbol','neutral');
   launcher.appendChild(symbol);launcher.appendChild(el('span','velar-assistant-launch-label','Помощник VELAR'));
   root.appendChild(launcher);
   prompt=el('div','velar-assistant-greeting hidden');
   var helloSticker=avatarFace('velar-assistant-greeting-avatar',greetingFace());
   prompt.appendChild(helloSticker);
   prompt.appendChild(el('span','velar-assistant-wave','')); // CSS waving hand; no emoji
   prompt.appendChild(el('span','velar-assistant-greeting-text','Добро пожаловать! Подобрать музыку?'));
   var dismiss=el('button','velar-assistant-greeting-close','×');
   dismiss.type='button';dismiss.setAttribute('aria-label','Скрыть приветствие');
   dismiss.onclick=function(){prompt.className='velar-assistant-greeting hidden';markGreeting();};
   prompt.appendChild(dismiss);root.appendChild(prompt);
   dialog=el('div','velar-assistant-dialog hidden');dialog.id='velar-assistant-dialog';
   dialog.setAttribute('role','region');dialog.setAttribute('aria-label','VELAR — музыкальный помощник');
   header=el('div','velar-assistant-header');
   var headerTitle=el('strong','velar-assistant-title');
   var face=avatarFace('velar-assistant-header-avatar','neutral');
   header.appendChild(face);header.appendChild(headerTitle);
   header.appendChild(el('span','velar-assistant-header-note','Локальный бот · без платного ИИ'));
   var close=el('button','velar-assistant-close','×');close.type='button';
   close.setAttribute('aria-label','Закрыть помощника');header.appendChild(close);
   dialog.appendChild(header);
   log=el('div','velar-assistant-log');log.setAttribute('role','log');
   log.setAttribute('aria-live','polite');log.setAttribute('aria-relevant','additions');
   dialog.appendChild(log);
   buttons=el('div','velar-assistant-suggestions');
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
     'Не сохраняем и не отправляем автору'));
   root.appendChild(dialog);
   function toggle(open){
     opened=!!open;
     dialog.className=opened?'velar-assistant-dialog':'velar-assistant-dialog hidden';
     launcher.setAttribute('aria-expanded',opened?'true':'false');
     prompt.className='velar-assistant-greeting hidden';markGreeting();
     if(opened){
       if(!log.children.length)itemMessage('assistant',config.welcome,null,greetingFace());
       if(input&&input.focus&&(!window.matchMedia||!window.matchMedia('(max-width:590px)').matches))input.focus();
     }else if(launcher.focus)launcher.focus();
   }
   launcher.onclick=function(){toggle(!opened);};
   close.onclick=function(){toggle(false);};
   dialog.onkeydown=function(e){
     if(e&&e.key==='Escape')toggle(false);
   };
 }
 function configLabel(key,fallback){
   var labels=config&&config.labels;
   return labels&&typeof labels[key]==='string'?labels[key]:fallback;
 }
 function renderQuickTopics(){
   if(!buttons)return;
   clear(buttons);
   var entries=config&&Array.isArray(config.quickTopics)?config.quickTopics:[
     {label:'Мне грустно',query:'грустно'},
     {label:'Свадебная музыка',query:'свадьба'},
     {label:'Космос',query:'космос'},
     {label:'Сотрудничество',query:'сотрудничество'}
   ];
   entries.forEach(function(topic){
     var button=el('button','velar-assistant-suggestion',topic.label);
     button.type='button';
     button.onclick=function(){say(topic.query);};
     buttons.appendChild(button);
   });
 }
 function applyConfigText(){
   if(!root||!config)return;
   function setText(selector,text){
     var el=root.querySelector&&root.querySelector(selector);
     if(el)el.textContent=text;
     return el;
   }
   setText('.velar-assistant-launch-label',configLabel('launcher','Помощник VELAR'));
   setText('.velar-assistant-header-note',configLabel('headerNote','Локальный бот · без платного ИИ'));
   setText('.velar-assistant-greeting-text',configLabel('greetingBubble',config.welcome));
   setText('.velar-assistant-greeting-close',configLabel('greetingCloseText','×'));
   setText('.velar-assistant-close',configLabel('closeText','×'));
   setText('.velar-assistant-submit',configLabel('submit','Спросить'));
   var privacy=setText('.velar-assistant-privacy',
     configLabel('privacy','Не сохраняем и не отправляем автору'));
   if(privacy){
     privacy.title=privacy.textContent;
     privacy.style.display=privacy.textContent?'':'none';
   }
   var note=root.querySelector&&root.querySelector('.velar-assistant-header-note');
   if(note)note.style.display=note.textContent?'':'none';
   var dismiss=root.querySelector&&root.querySelector('.velar-assistant-greeting-close');
   if(dismiss)dismiss.setAttribute('aria-label',
     configLabel('greetingCloseAria','Скрыть приветствие'));
   var close=root.querySelector&&root.querySelector('.velar-assistant-close');
   if(close)close.setAttribute('aria-label',configLabel('closeAria','Закрыть помощника'));
   if(dialog)dialog.setAttribute('aria-label',
     configLabel('dialogAria','VELAR — музыкальный помощник'));
   if(input){
     input.setAttribute('aria-label',configLabel('inputAria','Напиши вопрос помощнику'));
     input.placeholder=configLabel('inputPlaceholder','Например: нужна грустная песня…');
   }
   renderQuickTopics();
 }
 function render(data){
   published=data||published;
   var settings=published&&published.genres&&published.genres.assistant;
   if(!settings&&window.VMM_LANDING_SCHEMA)
     settings=window.VMM_LANDING_SCHEMA.defaults().genres.assistant;
   if(!settings)return;
   config=settings;
   paint();
   applyConfigText();
   if(!root)return;
   if(!config.enabled){
     root.className='velar-assistant hidden';
     if(dialog)dialog.className='velar-assistant-dialog hidden';
     var trigger=root.querySelector&&root.querySelector('.velar-assistant-launch');
     if(trigger)trigger.setAttribute('aria-expanded','false');
     opened=false;return;
   }
   root.className='velar-assistant';
   if(header&&header.querySelector){
     var title=header.querySelector('.velar-assistant-title');
     if(title)title.textContent=config.title;
   }
   if(prompt&&config.greetingEnabled&&!greetingSeen()&&!opened){
     prompt.className='velar-assistant-greeting';
     var span=prompt.querySelector&&prompt.querySelector('.velar-assistant-greeting-text');
     if(span)span.textContent=configLabel('greetingBubble',config.welcome);
   }
 }
 // Do not guess public visibility from schema defaults before the verified
 // published landing snapshot arrives. Respect owner opt-out without flicker.
 window.VELAR_ASSISTANT={render:render,answer:answer,norm:norm,topicFor:topicFor,expressionFor:expressionFor};
}());
