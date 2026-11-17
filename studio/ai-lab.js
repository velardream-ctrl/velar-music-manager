/* RUN-192 - Studio-only AI laboratory. No model loads in the visitor's
   browser. Nothing persists to Firestore, localStorage or the public schema.
   A token pasted here exists only in this editor's DOM until navigation. */
(function(){
 "use strict";
 function make(tag,text){
   var el=document.createElement(tag);
   if(typeof text==="string")el.textContent=text;
   return el;
 }
 function field(host,label,type,placeholder){
   var row=make("label");row.className="landing-field";
   row.appendChild(make("span",label));
   var input=make(type==="textarea"?"textarea":"input");
   if(type!=="textarea")input.type=type||"text";
   if(placeholder)input.placeholder=placeholder;
   input.autocomplete="off";input.spellcheck=false;
   input.style.width="100%";
   row.appendChild(input);host.appendChild(row);
   return input;
 }
 function validEndpoint(value){
   try{
     var url=new URL(value);
     return url.protocol==="https:"&&
       (url.hostname.endsWith(".workers.dev")||url.hostname==="ai.velardream.com")&&
       url.pathname.replace(/\/$/,"")==="/v1/owner-test"&&!url.search&&!url.hash;
   }catch(ignore){return false;}
 }
 function attach(parent){
   if(!parent||!document.createElement)return;
   var section=make("details");section.className="landing-card";
   var title=make("summary","Лаборатория DJ Velar AI — только для владельца");
   section.appendChild(title);
   section.appendChild(make("p","Тест внешней модели через Cloudflare Workers AI. На публичном сайте ИИ выключен; старый DJ Velar продолжает работать как прежде. Ни токен, ни переписка здесь не сохраняются."));
   var endpoint=field(section,"Адрес моего Cloudflare Worker","url","https://...workers.dev/v1/owner-test");
   var token=field(section,"Секрет владельца (не сохраняется)","password","Введите токен из Cloudflare Secrets");
   var languageRow=make("label");languageRow.className="landing-field";
   languageRow.appendChild(make("span","Язык ответа"));
   var language=make("select");
   [["ru","Русский"],["fi","Suomi"],["en","English"]].forEach(function(x){
     var o=make("option",x[1]);o.value=x[0];language.appendChild(o);
   });
   languageRow.appendChild(language);section.appendChild(languageRow);
   var question=field(section,"Тестовый вопрос","textarea","Подбери музыку для спокойного вечера");
   question.value="Расскажи, как ты поможешь выбрать музыку по настроению.";
   question.maxLength=500;
   var catalogRow=make('label');catalogRow.className='landing-field';
   var catalogToggle=make('input');catalogToggle.type='checkbox';
   catalogToggle.checked=false;
   catalogRow.appendChild(catalogToggle);
   catalogRow.appendChild(make('span',' Подбирать из реально опубликованных песен VELARDREAM'));
   section.appendChild(catalogRow);
   section.appendChild(make('p','Если включено, лаборатория по запросу читает только общедоступную опубликованную страницу и передаёт модели короткий перечень до 4 проверенных песен. Приватные записи, черновики, ссылки и личные данные модели не отправляются.'));
   var preview=make('div');preview.className='landing-ai-catalog-preview';
   section.appendChild(preview);
   function showVerified(rows){
     preview.textContent='';
     if(!rows||!rows.length){preview.appendChild(make('p','Подходящих опубликованных песен пока нет.'));return;}
     preview.appendChild(make('p','Проверенные ссылки из опубликованного сайта (не из ответа модели):'));
     rows.forEach(function(row){
       var line=make('p');
       var a=make('a',row.title+(row.artist?' — '+row.artist:'')+
         ' · '+row.provider);
       a.href=row.url;a.target='_blank';a.rel='noopener noreferrer';
       line.appendChild(a);
       if(row.category)line.appendChild(make('span',' · '+row.category));
       preview.appendChild(line);
     });
   }
   // RUN-198: an authenticated on-demand counter in Assistant settings.
   // No token or usage report is stored in browser persistence or Firestore.
   var budgetBox=make("div");budgetBox.className="landing-card";
   var budgetTitle=make("strong","Счётчик DJ Velar AI — сегодня (UTC)");
   var budgetInfo=make("p","Данные не загружены. Счётчик станет доступен после настройки Cloudflare.");
   budgetInfo.className="sync-note";
   var budgetButton=make("button","Обновить счётчик AI");
   budgetButton.type="button";budgetButton.className="landing-add";
   budgetButton.onclick=function(){
     if(!validEndpoint(endpoint.value)||token.value.length<32){
       budgetInfo.textContent="Введите адрес Worker и секрет владельца в лаборатории выше.";
       return;
     }
     if(typeof window.fetch!=="function"){budgetInfo.textContent="Нет поддержки сетевого запроса.";return;}
     budgetButton.disabled=true;budgetInfo.textContent="Получаем защищённый счётчик Cloudflare…";
     var statsUrl=endpoint.value.replace(/\/v1\/owner-test$/,"/v1/owner-stats");
     window.fetch(statsUrl,{method:"GET",mode:"cors",credentials:"omit",
       headers:{"Authorization":"Bearer "+token.value},"cache":"no-store"
     }).then(function(response){
       return response.json().then(function(data){
         if(!response.ok)throw new Error(data&&data.error||"http_"+response.status);
         return data;
       });
     }).then(function(data){
       if(typeof data.used!=="number"||typeof data.day!=="string")
         throw new Error("Некорректные данные счётчика.");
       budgetInfo.textContent="Дата "+data.day+" (UTC) · запросов AI: "+data.used+
         " · успешных: "+data.succeeded+" · ошибок: "+data.failed+
         (typeof data.limit==="number"?" · лимит: "+data.limit+
           " · осталось: "+data.remaining:" · лимит не задан")+
         ". Считаются попытки вызова модели, а не токены или стоимость.";
     }).catch(function(error){
       budgetInfo.textContent="Счётчик недоступен: "+String(error&&error.message||error).slice(0,100)+
         ". Локальный DJ Velar от этого не зависит.";
     }).then(function(){budgetButton.disabled=false;});
   };
   budgetBox.appendChild(budgetTitle);budgetBox.appendChild(budgetInfo);
   budgetBox.appendChild(budgetButton);section.appendChild(budgetBox);
   var button=make("button","Проверить ответ модели");
   button.type="button";button.className="landing-add";
   var fallbackTest=make("button","Проверить отказ ИИ и резервный ответ");
   fallbackTest.type="button";fallbackTest.className="landing-add";
   fallbackTest.style.marginLeft="8px";
   var status=make("p","Не подключено. Сначала разверни Worker в своём бесплатном Cloudflare.");
   status.className="sync-note";
   var result=make("pre");result.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;font:inherit;line-height:1.5";
   button.onclick=function(){
     if(!validEndpoint(endpoint.value)){
       status.textContent="Адрес должен быть HTTPS Cloudflare workers.dev, заканчивающийся /v1/owner-test.";
       return;
     }
     if(token.value.length<32){
       status.textContent="Введите секрет владельца из Cloudflare (не короче 32 символов).";
       return;
     }
     var q=question.value.trim();
     if(q.length<2||q.length>500){status.textContent="Вопрос: 2–500 символов.";return;}
     if(typeof window.fetch!=="function"){status.textContent="Браузер не поддерживает безопасное обращение к Worker.";return;}
     button.disabled=true;result.textContent="";preview.textContent="";
     status.textContent=catalogToggle.checked?'Загружаем только опубликованные песни…':
       "Запрос к Cloudflare… Первый ответ модели может занять больше 12 секунд.";
     var source=window.VELAR_AI_PUBLIC_CATALOG;
     var context=catalogToggle.checked?
       (source&&source.readPublished?source.readPublished():
         Promise.reject(new Error('Модуль опубликованных песен не загружен.'))):
       Promise.resolve(null);
     context.then(function(rows){
       var message=q;
       if(catalogToggle.checked){
         if(!rows||!rows.length)throw new Error('В опубликованных подборках нет доступных песен. Запрос модели не отправлен.');
         var choices=source.shortlist(rows,q,4);
         showVerified(choices);
         message=source.prompt(q,choices);
       }
       return askModel(message);
     }).catch(function(error){
       status.textContent='Подборка не получена: '+String(error&&error.message||error).slice(0,180);
       button.disabled=false;
     });
     function askModel(message){
     // A 12-second browser timeout caused false negatives on iPhone.
     // Allow the first model response up to 60s, show the countdown, and
     // always release the button even on a failed request.
     var timeoutMs=60000,started=Date.now(),timedOut=false;
     var timer=null,progressTimer=null;
     var controller=typeof AbortController!=="undefined"?new AbortController():null;
     if(controller)timer=setTimeout(function(){timedOut=true;controller.abort();},timeoutMs);
     progressTimer=setInterval(function(){
       var seconds=Math.max(0,Math.round((Date.now()-started)/1000));
       status.textContent="Ожидаем Cloudflare Workers AI: "+seconds+
         " с. Максимальное ожидание — 60 с. Можно оставить эту вкладку открытой.";
     },3000);
     window.fetch(endpoint.value,{
       method:"POST",mode:"cors",credentials:"omit",
       headers:{"Content-Type":"application/json","Authorization":"Bearer "+token.value},
       body:JSON.stringify({message:message,language:language.value}),
       signal:controller?controller.signal:undefined
     }).then(function(response){
       return response.json().then(function(body){
         if(!response.ok)throw new Error(body&&body.error||"server_error_"+response.status);
         if(!body||typeof body.reply!=="string")throw new Error("bad_model_response");
         return body;
       });
     }).then(function(body){
       status.textContent="Модель ответила. Это только тест: никакие команды сайта не выполнялись.";
       result.textContent=body.reply.slice(0,1300);
     }).catch(function(error){
       var detail=String(error&&error.message||error).slice(0,120);
       if(timedOut||error&&error.name==="AbortError"){
         status.textContent="Превышено ожидание 60 секунд. Worker готов по /health, "+
           "но модель могла отвечать медленно. Проверь запрос в Cloudflare → "+
           "Workers → dj-velar-private-lab → Observability → Logs, затем попробуй снова.";
       }else if(error&&error.name==="TypeError"){
         status.textContent="Нет соединения с Worker или браузер заблокировал запрос: "+detail+
           ". Проверь адрес /v1/owner-test и CORS, затем Worker Logs.";
       }else{
         status.textContent="Ответ не получен: "+detail+
           ". Проверь адрес Worker, секрет, AI binding и бесплатную квоту.";
       }
     }).then(function(){
       if(timer)clearTimeout(timer);
       if(progressTimer)clearInterval(progressTimer);
       button.disabled=false;
     });
     }
   };
   fallbackTest.onclick=function(){
     var router=window.VELAR_AI_FALLBACK;
     if(!router){status.textContent="Резервный модуль не загрузился.";return;}
     // Simulate an exhausted Cloudflare quota without sending a network request.
     // Production visitor DJ Velar still uses its own published local rules.
     router.reset();
     router.offer(function(){
       return {text:'DJ Velar продолжает работать на своих правилах. Можно выбирать музыку по настроению, открывать артистов, жанры, плейлисты и радио. Внешний ИИ сейчас недоступен.'};
     },function(){return Promise.reject({code:'quota_exhausted'});},
       {enabled:true,timeoutMs:3000}).then(function(out){
       status.textContent=out.source==='local'?
         'Резервный режим сработал: внешний ИИ недоступен, локальный ответ появился. Это симуляция без обращения к Cloudflare.':
         'Ошибка проверки: резервный режим не активировался.';
       result.textContent=out.answer.text;
       router.reset();
     });
   };
   section.appendChild(button);section.appendChild(fallbackTest);section.appendChild(status);section.appendChild(result);
   var doc=make("p");
   doc.textContent="Секрет нельзя помещать в публичный JavaScript или опубликованные настройки Studio. Для подключения его нужно создать как Secret в Cloudflare. Облачный Worker не управляет сайтом и не имеет доступа к Firestore.";
   doc.className="sync-note";section.appendChild(doc);
   parent.appendChild(section);
 }
 window.VELAR_AI_LAB={attach:attach,validEndpoint:validEndpoint};
}());
