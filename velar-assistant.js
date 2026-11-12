/* RUN-074 — VELAR Assistant, offline rule-based music concierge.
   No external AI/API, no per-message Firestore reads/writes, no tracking.
   User messages live only in this tab's memory; mail is never sent silently.
   ES5 / Safari12 compatible. */
(function(){
 'use strict';
 var root=null,dialog=null,log=null,input=null,prompt=null,buttons=null,header=null;
 var config=null,published=null,opened=false,initialized=false;
 var MAX_INPUT=360,activeTyping=null,announcer=null,jokeCursor=-1;
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
   setAvatar(face,expression||'neutral');
   return face;
 }
 function setAvatar(face,expression){
   if(!face)return;
   var chosen=String(expression||'neutral'),images=config&&config.avatars&&config.avatars.customImages;
   var customIndex=chosen==='custom1'?0:chosen==='custom2'?1:-1;
   var photo=customIndex>=0&&images&&images[customIndex]&&images[customIndex].dataUrl||'';
   face.className=face.className.replace(/\svelar-expression--custom/g,'');
   if(photo&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)&&photo.length<=24000){
     face.className+=' velar-expression--custom';
     face.style.backgroundImage='url("'+photo+'")';
     face.setAttribute('data-expression','neutral');
   }else{
     face.style.backgroundImage='';
     face.setAttribute('data-expression',customIndex>=0?'neutral':chosen);
   }
 }
 function greetingChoice(){
   var selected=config&&config.avatars&&config.avatars.greeting;
   return selected&&selected!=='auto'?selected:greetingFace();
 }
 function reactionChoice(raw,reply){
   var avatars=config&&config.avatars;
   if(avatars){
     var rules=avatars.keywordRules||[];
     for(var i=0;i<rules.length;i++){
       var r=rules[i],source=r.source||'question';
       if((source==='question'||source==='both')&&contains(norm(raw),r.keywords))
         return r.expression;
       if((source==='answer'||source==='both')&&contains(norm(reply),r.keywords))
         return r.expression;
     }
     var type=expressionFor(raw);
     return avatars.reactions&&avatars.reactions[type]||type;
   }
   return expressionFor(raw);
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
 // Explicit UI command: narrower than general FAQ, no implicit playback.
 function radioCommand(q){
   return /^(?:(?:velar|велар)\s+)?(?:включи|включить|запусти|открой|поставь|покажи|хочу|слушать)\s+(?:(?:velar|велар)\s+)?(?:радио|radio)$/.test(q)||
     /^(?:(?:velar|велар)\s+)?(?:play|open|start)\s+(?:(?:velar|велар)\s+)?(?:radio|радио)$/.test(q);
 }
 function answer(raw,data,settings){
   var q=norm(raw);
   if(!q)return {text:replyText(settings,'emptyInput')};
   settings=settings||{};
   // RUN-086: direct radio control overrides text-only FAQ, never the owner's OFF gate.
   if(radioCommand(q)){
     var radio=data&&data.releases&&data.releases.radio,api=window.VMM_LANDING_SCHEMA;
     var ready=!!(radio&&radio.enabled===true&&radio.controlVersion===2&&
       api&&api.playlistUrl&&api.playlistUrl(radio.url,radio.provider));
     if(ready)return {text:'VELAR RADIO готово. Нажми кнопку ниже, чтобы открыть официальный плеер. Воспроизведение выбираешь ты.',
       action:'radio',target:'',label:'▶ Открыть VELAR RADIO'};
     return {text:'VELAR RADIO сейчас выключено владельцем сайта или не настроено. Другие доступные плейлисты можно открыть в музыкальном разделе.',
       action:'link',target:'#playlists',label:'Посмотреть плейлисты'};
   }
   // Custom answers written by the owner have priority over the FAQ library.
   var rules=settings.rules||[];
   for(var i=0;i<rules.length;i++){
     if(contains(q,rules[i].keywords))return {text:rules[i].answer};
   }
   // RUN-084: original, owner-editable jokes; each request gets the next one.
   // No timer, tracking or cloud call. A special owner rule still wins.
   if(settings.jokesEnabled!==false&&Array.isArray(settings.jokes)&&settings.jokes.length&&
      contains(q,'анекдот,анекдоты,еще анекдот,ещё анекдот,ещё шутку,еще шутку,шутка,шутки,пошути,расскажи смешное,рассмеши,про музыкантов пошути')){
     jokeCursor=(jokeCursor+1)%settings.jokes.length;
     return {text:settings.jokes[jokeCursor],
       action:'ask',target:'ещё анекдот',label:'Ещё анекдот 🎵'};
   }
   // RUN-087: contextual music guide keeps owner rules above defaults.
   var guide=window.VELAR_FAQ&&window.VELAR_FAQ.guide&&window.VELAR_FAQ.guide(q,data,settings);
   if(guide)return guide;
   var suggested=window.VELAR_FAQ&&window.VELAR_FAQ.answer(q,data,settings);
   if(suggested)return suggested;
   if(contains(q,'оператор,поговорить с оператором,свяжи с автором,человек,сотрудничество,сотрудничать,певец,певица,артист для песни,выступление,выступить,концерт,предложение,коллаборация,контакт,почта,написать автору')){
     return {text:replyText(settings,settings.contactEmail?'contactEnabled':'contactDisabled'),
       action:settings.contactEmail?'email':'link',target:settings.contactEmail?'':'#playlists',
       label:replyText(settings,settings.contactEmail?'contactEnabledButton':'contactDisabledButton')};
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
   // Unknown question: use the owner's configured quick topics to clarify.
   var suggestions=(settings.quickTopics||[]).slice(0,2).map(function(t){
     return {action:'ask',target:t.query,label:t.label};
   });
   suggestions.push({action:'link',target:'#topics',
     label:replyText(settings,'fallbackButton')});
   return {text:replyText(settings,settings.contactEmail?'fallbackEnabled':'fallbackDisabled'),
     actions:suggestions.filter(function(x){return !!x.label;})};

 }
 // RUN-082: one cancellable timer, no cloud traffic or stored chat history.
 function finishTyping(){
   if(activeTyping&&activeTyping.finish)activeTyping.finish();
 }
 // RUN-088: a read-only reason code helps diagnose Windows and Safari.
 function typingStatus(){
   if(!config||!config.typing||config.typing.enabled===false)return 'disabled-in-studio';
   if(typeof window.setTimeout!=='function')return 'unsupported-browser';
   try{
     if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)
       return 'reduced-motion';
   }catch(ignore){}
   return 'enabled';
 }
 function typingAllowed(){return typingStatus()==='enabled';}
 // ES5-safe Unicode code points: avoid drawing half of an emoji surrogate pair.
 function characters(value){
   return String(value||'').match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g)||[];
 }
 function scrollChat(){
   if(log&&log.scrollHeight)log.scrollTop=log.scrollHeight;
 }
 function typeMessage(para,text,onFinish){
   var letters=characters(text);
   var speed=config&&config.typing&&config.typing.speedMs||35;
   var ms=Math.min(speed,Math.max(8,Math.floor(4800/Math.max(letters.length,1))));
   var position=0,session={timer:null,finish:null};
   function finish(){
     if(activeTyping!==session)return;
     if(session.timer!==null&&typeof window.clearTimeout==='function')
       window.clearTimeout(session.timer);
     session.timer=null;
     para.textContent=text;
     para.className=para.className.replace(/\s*velar-chat-typing\b/g,'');
     activeTyping=null;
     if(log)log.setAttribute('aria-live','off');
     onFinish();
     if(announcer)announcer.textContent=text;
     scrollChat();
   }
   session.finish=finish;
   activeTyping=session;
   para.className+=' velar-chat-typing';
   if(log)log.setAttribute('aria-live','off');
   function step(){
     if(activeTyping!==session)return;
     position++;
     para.textContent=letters.slice(0,position).join('');
     scrollChat();
     if(position>=letters.length){finish();return;}
     session.timer=window.setTimeout(step,ms);
   }
   session.timer=window.setTimeout(step,120);
 }
 function itemMessage(role,text,action,expression,animate){
   if(!log)return;
   var row=el('div','velar-chat-line '+(role==='visitor'?'is-visitor':'is-assistant'));
   if(role==='assistant'){
     row.appendChild(avatarFace('velar-chat-avatar',expression));
   }
   var shouldType=role==='assistant'&&animate&&text&&typingAllowed();
   var paragraph=el('p','',shouldType?'':text);
   row.appendChild(paragraph);
   function addAction(){
     var list=action&&action.actions?action.actions:(action&&action.label?[action]:[]);
     if(!list.length)return;
     var group=list.length>1?el('div','velar-chat-actions'):row;
     list.slice(0,3).forEach(function(choice){
       if(!choice||!choice.label)return;
       var a=el('button','velar-chat-action',choice.label);
       a.type='button';
       a.onclick=function(){
         if(choice.action==='email'){
           var email=config&&config.contactEmail;
           if(!email)return;
           var subject='VELARDREAM — предложение о сотрудничестве';
           var body='Здравствуйте!%0A%0AЯ хочу обсудить сотрудничество с VELARDREAM.%0A';
           window.location.href='mailto:'+email+'?subject='+encodeURIComponent(subject)+'&body='+body;
         }else if(choice.action==='topic'){
           if(window.VELAR_TOPICS&&window.VELAR_TOPICS.select)
             window.VELAR_TOPICS.select(choice.target);
           window.location.hash='topics';
         }else if(choice.action==='song'){
           var openedSong=false;
           if(choice.kind==='topic'&&window.VELAR_TOPICS&&window.VELAR_TOPICS.openFromChat)
             openedSong=window.VELAR_TOPICS.openFromChat(choice.target,choice.url);
           if(choice.kind==='language'&&window.VELAR_LANGUAGES&&window.VELAR_LANGUAGES.openFromChat)
             openedSong=window.VELAR_LANGUAGES.openFromChat(choice.target,choice.url);
           window.location.hash=choice.kind==='language'?'languages':'topics';
           if(!openedSong&&choice.kind==='topic'&&window.VELAR_TOPICS&&window.VELAR_TOPICS.select)
             window.VELAR_TOPICS.select(choice.target);
         }else if(choice.action==='radio'){
           // One explicit click: reuse existing Spotify/YouTube embed path, no autoplay.
           var openedRadio=window.VMM_PUBLIC_LANDING&&window.VMM_PUBLIC_LANDING.openRadioFromChat&&
             window.VMM_PUBLIC_LANDING.openRadioFromChat();
           if(!openedRadio)itemMessage('assistant','Радио сейчас недоступно. Проверь настройки VELAR RADIO или открой раздел плейлистов.',null,'neutral',false);
         }else if(choice.action==='language'){
           if(window.VELAR_LANGUAGES&&window.VELAR_LANGUAGES.show)
             window.VELAR_LANGUAGES.show(choice.target);
           window.location.hash='languages';
         }else if(choice.action==='ask'){
           say(choice.target);
         }else if(choice.action==='link'&&choice.target&&choice.target.charAt(0)==='#'){
           window.location.hash=choice.target.slice(1);
           // On narrow screens reveal the requested section instead of covering it with chat.
           if(choice.target==='#topics'&&root&&root.querySelector){
             var closeChat=root.querySelector('.velar-assistant-close');
             if(closeChat&&closeChat.onclick)closeChat.onclick();
           }
         }
       };
       group.appendChild(a);
     });
     if(group!==row&&group.children.length)row.appendChild(group);
   }
   log.appendChild(row);
   if(shouldType)typeMessage(paragraph,text,addAction);
   else {addAction();if(role==='assistant'&&announcer)announcer.textContent=text;}
   scrollChat();
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
   finishTyping(); // complete prior reply before showing another visitor question
   itemMessage('visitor',t);
   var result=answer(t,published,config);
   itemMessage('assistant',result.text,(result.actions&&result.actions.length)||result.action?result:null,reactionChoice(t,result.text),true);
   if(input)input.value='';
 }
 function paint(){
   if(initialized)return;
   root=find('velar-assistant');if(!root)return;
   initialized=true;root.className='velar-assistant';
   var launcher=el('button','velar-assistant-launch');
   launcher.type='button';launcher.setAttribute('aria-controls','velar-assistant-dialog');
   launcher.setAttribute('aria-expanded','false');
   var symbol=avatarFace('velar-assistant-symbol',config&&config.avatars&&config.avatars.launcher||'neutral');
   launcher.appendChild(symbol);launcher.appendChild(el('span','velar-assistant-launch-label','Помощник VELAR'));
   root.appendChild(launcher);
   prompt=el('div','velar-assistant-greeting hidden');
   var helloSticker=avatarFace('velar-assistant-greeting-avatar',greetingChoice());
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
   var face=avatarFace('velar-assistant-header-avatar',config&&config.avatars&&config.avatars.header||'neutral');
   header.appendChild(face);header.appendChild(headerTitle);
   header.appendChild(el('span','velar-assistant-header-note','Локальный бот · без платного ИИ'));
   var close=el('button','velar-assistant-close','×');close.type='button';
   close.setAttribute('aria-label','Закрыть помощника');header.appendChild(close);
   dialog.appendChild(header);
   log=el('div','velar-assistant-log');log.setAttribute('role','log');
   log.setAttribute('aria-live','off');log.setAttribute('aria-relevant','additions');
   dialog.appendChild(log);
   announcer=el('div','velar-assistant-announcement');
   announcer.setAttribute('role','status');announcer.setAttribute('aria-live','polite');
   announcer.setAttribute('aria-atomic','true');dialog.appendChild(announcer);
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
       if(!log.children.length)itemMessage('assistant',config.welcome,null,greetingChoice(),true);
       if(input&&input.focus&&(!window.matchMedia||!window.matchMedia('(max-width:590px)').matches))input.focus();
     }else{
       finishTyping();
       if(launcher.focus)launcher.focus();
     }
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
   var avatars=config&&config.avatars||{};
   setAvatar(root.querySelector&&root.querySelector('.velar-assistant-symbol'),
     avatars.launcher||'neutral');
   setAvatar(root.querySelector&&root.querySelector('.velar-assistant-header-avatar'),
     avatars.header||'neutral');
   setAvatar(root.querySelector&&root.querySelector('.velar-assistant-greeting-avatar'),
     greetingChoice());
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
   finishTyping(); // never leave an orphaned timer after live configuration updates
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
 window.VELAR_ASSISTANT={render:render,answer:answer,norm:norm,topicFor:topicFor,
   expressionFor:expressionFor,typingStatus:typingStatus};
}());
