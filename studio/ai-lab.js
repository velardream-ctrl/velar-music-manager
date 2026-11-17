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
   var button=make("button","Проверить ответ модели");
   button.type="button";button.className="landing-add";
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
     button.disabled=true;result.textContent="";
     status.textContent="Запрос к Cloudflare…";
     var timer=null,controller=typeof AbortController!=="undefined"?new AbortController():null;
     if(controller)timer=setTimeout(function(){controller.abort();},12000);
     window.fetch(endpoint.value,{
       method:"POST",mode:"cors",credentials:"omit",
       headers:{"Content-Type":"application/json","Authorization":"Bearer "+token.value},
       body:JSON.stringify({message:q,language:language.value}),
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
       status.textContent="Ответ не получен: "+String(error.message||error).slice(0,120)+
         ". Проверь адрес Worker, секрет, AI binding и бесплатную квоту.";
     }).then(function(){if(timer)clearTimeout(timer);button.disabled=false;});
   };
   section.appendChild(button);section.appendChild(status);section.appendChild(result);
   var doc=make("p");
   doc.textContent="Секрет нельзя помещать в публичный JavaScript или опубликованные настройки Studio. Для подключения его нужно создать как Secret в Cloudflare. Облачный Worker не управляет сайтом и не имеет доступа к Firestore.";
   doc.className="sync-note";section.appendChild(doc);
   parent.appendChild(section);
 }
 window.VELAR_AI_LAB={attach:attach,validEndpoint:validEndpoint};
}());
