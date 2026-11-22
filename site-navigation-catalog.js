/* RUN-212 · Public-site navigation for DJ Velar.
   Discovers links/sections actually exposed by the public page. Reads only
   PUBLIC enabled forum sections once; no credentials, user data or writes.
   ES5-compatible (older iPad Safari). Never invent URLs or open arbitrary AI links. */
(function(root){
 'use strict';
 var categories=[],fetched=false,pending=null;
 var forumCollection='https://firestore.googleapis.com/v1/projects/velardream-records-studio/databases/(default)/documents/velar_forum_sections?pageSize=100';
 function norm(value){
   return String(value||'').toLocaleLowerCase('ru').replace(/ё/g,'е')
     .replace(/[^a-zа-я0-9\s-]/g,' ').replace(/\s+/g,' ').trim();
 }
 function isPublic(el){
   var item=el;
   while(item&&item!==document){
     if(item.hidden===true || item.getAttribute&&item.getAttribute('aria-hidden')==='true')return false;
     item=item.parentNode;
   }
   return true;
 }
 function safePage(raw){
   if(typeof raw!=='string'||!/^(?:\/(?!\/)|#)/.test(raw)||/[\s\\]/.test(raw))return '';
   if(raw.charAt(0)==='#')return /^#[a-z][a-z0-9_-]{1,60}$/i.test(raw)?raw:'';
   if(/(?:^|\/)(?:studio|admin|app)(?:\/|$)/i.test(raw))return '';
   try{
     var parsed=new URL(raw,window.location.origin);
     if(parsed.origin!==window.location.origin||!/^\/[a-z0-9\/._-]*$/i.test(parsed.pathname))return '';
     if(parsed.search||parsed.hash)return '';
     return parsed.pathname;
   }catch(e){return '';}
 }
 function discover(){
   var pages=[],seen={};
   function add(target,label,id){
     if(!target||seen[target]||!label)return;
     seen[target]=true;pages.push({target:target,label:String(label).trim(),id:id||''});
   }
   var nav=document.querySelector('.site-nav');
   if(nav){
     Array.prototype.forEach.call(nav.querySelectorAll('a[href]'),function(a){
       if(!isPublic(a))return;
       var target=safePage(a.getAttribute('href')),label=a.textContent&&a.textContent.trim();
       if(!target)return;
       if(target.charAt(0)==='#'){
         var section=document.getElementById(target.slice(1));
         if(section&&isPublic(section))add(target,label,target.slice(1));
       }else add(target,label,target);
     });
   }
   // Newly added PUBLIC sections automatically become discoverable without
   // updating this assistant, even when the site nav lacks a matching link.
   Array.prototype.forEach.call(document.querySelectorAll('main section[id]'),function(el){
     if(!isPublic(el)||!/^[a-z][a-z0-9_-]{1,60}$/i.test(el.id))return;
     var heading=el.querySelector('h2, h3, h1');
     if(!heading||!heading.textContent||!heading.textContent.trim())return;
     add('#'+el.id,heading.textContent.trim(),el.id);
   });
   return pages;
 }
 function refreshForum(){
   if(pending)return pending;
   if(fetched)return Promise.resolve(categories.slice());
   if(typeof window.fetch!=='function'){fetched=true;return Promise.resolve([]);}
   // Public Firestore list; rules require an explicit limit <= 100.
   pending=window.fetch(forumCollection,{method:'GET',credentials:'omit',mode:'cors'})
     .then(function(resp){if(!resp.ok)throw new Error('public sections unavailable');return resp.json();})
     .then(function(body){
       categories=(Array.isArray(body.documents)?body.documents:[]).map(function(doc){
         var id=String(doc.name||'').split('/').pop();
         var fields=doc.fields||{},label=fields.label&&fields.label.stringValue||'';
         return {id:id,label:label,enabled:!!(fields.enabled&&fields.enabled.booleanValue),
           deleted:!!(fields.deleted&&fields.deleted.booleanValue)};
       }).filter(function(x){
         return /^[a-zA-Z0-9_-]{1,32}$/.test(x.id) && x.enabled && !x.deleted &&
           typeof x.label==='string' && x.label.length>=2 && x.label.length<=60;
       });
       fetched=true;pending=null;return categories.slice();
     }).catch(function(){fetched=true;pending=null;categories=[];return [];});
   return pending;
 }
 function forumPath(id){
   var found=categories.some(function(x){return x.id===id;});
   return found?'/forum/?section='+encodeURIComponent(id):'/forum/';
 }
 function option(label,target){
   return {action:'page',target:target,label:label};
 }
 function isKnown(target){
   var entries=discover(),base=entries.some(function(e){return e.target===target;});
   if(base)return true;
   if(target==='/forum/')return entries.some(function(e){return e.target==='/forum/';});
   var match=/^\/forum\/\?section=([a-zA-Z0-9_-]{1,32})$/.exec(target);
   return !!(match&&entries.some(function(e){return e.target==='/forum/';})&&
     categories.some(function(s){return s.id===match[1];}));
 }
 function matchSection(q,entry){
   var key=norm(entry.label);
   if(key.length<3)return false;
   var direct=q===key||q.indexOf(key)!==-1;
   // E.g. "покажи раздел Проект" (new site section) vs unrelated lyrics.
   return direct&&(q===key || /(?:раздел|открой|покажи|где|перейти|посмотри|найти|ссылка|страниц)/.test(q));
 }
 function answer(query){
   var q=norm(query),entries=discover();
   if(!q)return null;
   function has(path){return entries.some(function(e){return e.target===path;});}
   var contacts=has('/contacts/'),forum=has('/forum/');
   var asksContact=/(?:личн\w*\s+сообщени|написать\s+(?:лично|администратору|автору|сообщени)|связаться\s+с|контакт|обратн\w*\s+связ|написать\s+письмо|в\s+личку|электронн\w*\s+почт|заказ\s+песн|заказать\s+песн|ошибк\w*\s+на\s+сайт|сообщить\s+об\s+ошибк)/.test(q);
   var asksCollaboration=/(?:сотруднич|коллаборац|совместн\w*\s+проект|ищу\s+партнер|партнерств|партнёрств)/.test(q);
   if(asksCollaboration&&(forum||contacts)){
     var choices=[];
     if(forum)choices.push(option(categories.some(function(c){return c.id==='collaboration';})?
       'Обсудить сотрудничество':'Открыть форум',forumPath('collaboration')));
     if(contacts)choices.push(option('Написать лично','/contacts/'));
     return {text:'Идею сотрудничества можно обсудить на форуме или отправить администрации лично через раздел «Контакты». Выбери удобный путь.',actions:choices};
   }
   if(asksContact&&contacts)return {text:'Для личного обращения открой раздел «Контакты». Там можно написать администрации о сотрудничестве, заказать песню или сообщить об ошибке на сайте. Ответ придёт на указанную почту.',
     actions:[option('Открыть Контакты','/contacts/')]};
   if(forum){
     var matched=categories.filter(function(c){return matchSection(q,c);})[0];
     if(matched)return {text:'На форуме есть раздел «'+matched.label+'». Можно перейти к обсуждениям и создать свою тему.',
       actions:[option('Перейти к «'+matched.label+'»',forumPath(matched.id))]};
     if(/(?:форум|обсуждени\w*|сообществ\w*|создать\s+тему|написать\s+на\s+форум)/.test(q))
       return {text:'На нашем форуме можно обсудить музыку, предложить идею или присоединиться к разговору.',
         actions:[option('Открыть форум','/forum/')]};
   }
   var page=entries.filter(function(e){
     return e.target.charAt(0)==='#'&&matchSection(q,e);
   })[0];
   if(page)return {text:'Нашёл раздел «'+page.label+'» на сайте. Могу показать его.',
     actions:[{action:'link',target:page.target,label:'Открыть «'+page.label+'»'}]};
   var other=entries.filter(function(e){
     return e.target.charAt(0)==='/' && e.target!=='/forum/'&&e.target!=='/contacts/'&&matchSection(q,e);
   })[0];
   if(other)return {text:'На сайте есть страница «'+other.label+'». Вот переход к ней.',
     actions:[option('Открыть «'+other.label+'»',other.target)]};
   return null;
 }
 function open(target){
   if(!isKnown(target))return false;
   if(target.charAt(0)==='#'){
     window.location.hash=target.slice(1);return true;
   }
   window.location.href=target;return true;
 }
 root.VELAR_SITE_NAV={answer:answer,open:open,discover:discover,refreshForum:refreshForum,
   isKnown:isKnown,norm:norm};
 // One public read per page load; if unavailable, still offer the general forum.
 if(typeof document!=='undefined'){
   if(document.readyState==='loading')
     document.addEventListener('DOMContentLoaded',refreshForum);
   else refreshForum();
 }
}(window));
