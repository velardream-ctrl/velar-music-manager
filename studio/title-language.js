/* RUN-075 — Safe title-language suggestions for VELAR's own Firestore catalog.
   No LLM, API, new public reads or server-side functions. ES5 / Safari12.
   "titleLanguage" labels the TITLE, not the language of the lyrics/vocal.
   Conservatively leave ambiguous Latin/mixed/instrumental titles for review. */
(function(){
'use strict';
var supported=[
 ['ru','Русский'],['en','Английский'],['fi','Финский'],['de','Немецкий'],
 ['es','Испанский'],['it','Итальянский'],['fr','Французский'],
 ['hu','Венгерский'],['nl','Нидерландский'],['tr','Турецкий'],
 ['ur','Урду'],['beaver','Бобриный (авторский)'],['alien','Инопланетный (авторский)']
];
var known={
 // Exact title-language clues from historical 09.11 backup. This is NOT
 // a classification of sung/spoken lyrics, and should never overwrite one.
 'amore oltre il tempo':'it','lo specchio e la rosa':'it',
 'la croce del silenzio eterno':'it',
 'corazon del beat':'es','bajo el cielo de mallorca':'es',
 'lambada del amor':'es','noche de bachata':'es','bailando en palma':'es',
 'les chats et l amour a paris':'fr','taxi de paris':'fr',
 'liebe im neonlicht':'de','suomen kesan taika':'fi',
 'butterfly':'en','russian boy':'en','vampire love':'en',
 'move your body':'en','the pulse':'en','highway dream':'en',
 'stay in the light':'en','light it up':'en','no rush just vibe':'en',
 'welcome':'en'
};
var wordSets={
 fi:['suomen','kesan','taika','perjantai','joulupukki','joulu','joulun','rakkaus','sydan','hyvaa','kiitos','sinun','minun','metsa','taivas','totta','kai','mina','sina'],
 de:['liebe','liebst','dich','mein','meine','dein','deine','herz','immer','traum','sehnsucht','licht','nacht','leben','uber','schon','heute','morgen','fur','im','der'],
 es:['corazon','bailando','noche','cielo','siempre','contigo','quiero','vida','amor','beso','luna','sol','del','bajo','en','para','mi','tu'],
 it:['amore','tempo','specchio','rosa','croce','silenzio','eterno','bella','notte','cuore','ciao','oltre','il','lo','della','e','la'],
 fr:['chats','amour','paris','avec','bonjour','toujours','coeur','nuit','etoile','mon','ma','les','et','dans'],
 hu:['szerelem','szeretlek','sziv','ejjel','boldog','vilag','vagy','veled','szeretem'],
 nl:['liefde','mijn','jij','leven','mooi','dank','dag','nacht','wij','jouw'],
 tr:['ask','askim','sevgi','seni','kalbim','guzel','merhaba','benim','hayat'],
 en:['the','of','in','my','your','night','nights','light','love','dream','dreams',
 'never','you','me','without','we','don','t','speak','hello','goodbye','highway',
 'forever','butterfly','whispers','winter','winter','woodland','northern','solace',
 'echoes','silent','flowing','dancing','aurora','arctic','strings','ibiza',
 'rave','dance','move','body','heart','life','forest','soul','rhythm','vampire',
 'stay','welcome','sunrise','haze','lightning','driving','engine','pulse',
 'desert','summer','reflection','reflections','dreamshift','galaxy','power',
 'without','rush','just','vibe','spirit','mystery','final','superstar']
};
function plain(v){return String(v||'').trim();}
function key(v){
 var s=plain(v).toLowerCase();
 var from='àáâäãåèéêëìíîïòóôöõùúûüýÿñçšžőűðþ',to='aaaaaaeeeeiiiiooooouuuuyyncszou';
 for(var i=0;i<from.length;i++)s=s.split(from.charAt(i)).join(to.charAt(i)||'');
 return s.replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function knownCode(v){return known[key(v)]||'';}
function guess(title){
 var raw=plain(title),k=key(raw);
 if(!raw)return {code:'',confidence:'review',reason:'Нет названия'};
 if(/[\u0404\u0406\u0407\u0490\u0454\u0456\u0457\u0491\u040e\u045e]/.test(raw))
   return {code:'',confidence:'review',reason:'Кириллица другого языка — требуется сверка'};
 if(/[\u0400-\u04ff]/.test(raw)){
   if(/[\u0600-\u06ff]|[a-z]/i.test(raw.replace(/[\u0400-\u04ff]/g,'')))
     return {code:'',confidence:'review',reason:'Смешанные алфавиты'};
   return {code:'ru',confidence:'high',reason:'Кириллица, русский предполагается по каталогу'};
 }
 if(/[\u0600-\u06ff]/.test(raw))
   return {code:'',confidence:'review',reason:'Арабская письменность — урду/арабский/персидский требуют сверки'};
 if(/[^\x00-\x7F]/.test(raw)&&!/[a-z]/i.test(raw))
   return {code:'',confidence:'review',reason:'Неподдерживаемая письменность'};
 if(/\b(bobr|bobriki|crazy bobr|bobrik)\b/i.test(raw))
   return {code:'',confidence:'review',reason:'Bobr может быть английским названием авторского языка'};
 if(/\b(lux|requiem|aeternam|spiritus|oratio|um brarum|obscura|occulta|templum|internum|miserere)\b/i.test(k))
   return {code:'',confidence:'review',reason:'Похоже на латинский (ещё не добавлен как языковой мир)'};
 if(/\b(noor|dil|tum|sapna|namaste|india)\b/i.test(k))
   return {code:'',confidence:'review',reason:'Похоже на урду/хинди, название в транслитерации'};
 if(/\b(axe|axé|linda|bossa|saudade)\b/i.test(raw.toLowerCase()))
   return {code:'',confidence:'review',reason:'Возможен португальский или испанский'};
 if(knownCode(raw))return {code:knownCode(raw),confidence:'high',reason:'Проверенная форма названия'};
 var words=k.split(/\s+/),scores={};
 Object.keys(wordSets).forEach(function(code){
   var score=0;words.forEach(function(word){
     if(word.length<2)return;
     if(wordSets[code].indexOf(word)>=0)score+=word.length>3?2:1;
   });if(score)scores[code]=score;
 });
 var sorted=Object.keys(scores).sort(function(a,b){return scores[b]-scores[a];});
 if(!sorted.length)return {code:'',confidence:'review',reason:'По названию язык определить нельзя'};
 var best=sorted[0],score=scores[best],second=sorted[1]?scores[sorted[1]]:0;
 if(score>=3&&score>=second+2)
   return {code:best,confidence:'high',reason:'Характерные слова '+best};
 return {code:best,confidence:'review',reason:'Неоднозначное название (требуется проверка)'};
}
function selectedLanguage(record){
 var raw=plain(record.titleLanguage||record.title_language||'').toLowerCase();
 for(var i=0;i<supported.length;i++){
   if(raw===supported[i][0]||raw===supported[i][1].toLowerCase())return supported[i][0];
 }
 return raw;
}
function options(languages){
 var out=supported.slice();
 ((languages||{}).entries||[]).forEach(function(lang){
   if(!out.some(function(x){return x[0]===lang.code;}))
     out.push([lang.code,lang.label]);
 });
 return out;
}
function proposals(catalog,langs){
 var allowed=options(langs).map(function(x){return x[0];});
 return (catalog||[]).filter(function(r){return r&&r.id&&r.title;}).map(function(r){
   var current=selectedLanguage(r),predicted=guess(r.title);
   var valid=allowed.indexOf(current)>=0;
   return {id:String(r.id),title:plain(r.title),artist:plain(r.artist),
     before:current||'',guess:predicted.code,
     code:valid?current:(current?'':predicted.confidence==='high'?predicted.code:''),
     review:!valid&&(!current&&predicted.confidence!=='high'),
     reason:valid?'Уже указано в каталоге':current?
       'Неизвестное существующее значение — не перезаписывается автоматически':predicted.reason,
     accepted:valid,
     changed:false,
     record:r};
 });
}
function el(tag,cls,t){var n=document.createElement(tag);if(cls)n.className=cls;
 if(typeof t==='string')n.textContent=t;return n;}
function clear(n){while(n&&n.firstChild)n.removeChild(n.firstChild);}
var state={results:[],shown:35,onlyReview:false,opened:false,busy:false};
function attach(opts){
 var parent=opts.parent,host=el('section','landing-card vmm-lang-bulk');
 parent.appendChild(host);
 var h=el('h3','', 'Массовое определение языков названий');host.appendChild(h);
 host.appendChild(el('p','sync-note','В Firestore поле titleLanguage относится только к названию. Язык текста песни (vmm_lyrics.language) не изменяется. Кириллица = предварительно русский; латиница и смешанные названия требуют проверки. Никаких изменений без отдельного подтверждения.'));
 if(!opts.catalogLoaded||!opts.db||!opts.uid){
   host.appendChild(el('p','sync-note','Для работы открой каталог и войди как администратор.'));
   var load=el('button','landing-small','Загрузить каталог');
   load.type='button';load.onclick=function(){if(opts.onLoad)opts.onLoad();};host.appendChild(load);return;
 }
 var top=el('div','landing-item-actions');host.appendChild(top);
 var start=el('button','landing-add','Проверить языки каталога');
 start.type='button';top.appendChild(start);
 var status=el('p','sync-note','Сначала проверь предложения. Уже заполненные значения сохраняются.');
 host.appendChild(status);
 var controls=el('div','landing-item-actions');host.appendChild(controls);
 var show=el('div','vmm-language-review-list');host.appendChild(show);
 function draw(){
   clear(controls);clear(show);
   if(!state.opened)return;
   var rows=state.results,unassigned=rows.filter(function(r){return !r.before&&r.code;}),
     manual=rows.filter(function(r){return !r.before&&r.review;}),
     published=rows.filter(function(r){return r.before;});
   status.textContent='В живом каталоге: '+rows.length+' · ранее указано: '+published.length+
     ' · предложено для заполнения: '+unassigned.length+
     ' · требуется проверка: '+manual.length;
   var apply=el('button','landing-add','Сохранить подтверждённые языки ('+unassigned.length+')');
   apply.type='button';apply.disabled=state.busy||unassigned.length===0;
   controls.appendChild(apply);
   var sync=el('button','landing-small','Подключить языки к созвездиям (черновик)');
   sync.type='button';sync.disabled=state.busy;
   controls.appendChild(sync);
   var review=el('button','landing-small',state.onlyReview?'Показать все':'Только требующие проверки');
   review.type='button';controls.appendChild(review);
   var rowsShown=state.onlyReview?manual:rows;
   var cap=state.shown;
   rowsShown.slice(0,cap).forEach(function(rec){
     var row=el('div','vmm-language-review-row');
     row.appendChild(el('span','',rec.title+' · '+rec.artist));
     var select=el('select','');
     select.setAttribute('aria-label','Язык названия: '+rec.title);
     var optionsList=[['','Не определено']].concat(options(opts.languages));
     optionsList.forEach(function(pair){
       var option=el('option','',pair[1]);option.value=pair[0];select.appendChild(option);
     });select.value=rec.code;select.disabled=!!rec.before;
     select.onchange=function(){rec.code=this.value;rec.changed=true;rec.review=!rec.code;draw();};
     row.appendChild(select);
     row.appendChild(el('small','sync-note',rec.reason));
     show.appendChild(row);
   });
   if(rowsShown.length>cap){
     var more=el('button','landing-small','Показать ещё ('+(rowsShown.length-cap)+')');
     more.type='button';more.onclick=function(){state.shown+=35;draw();};
     show.appendChild(more);
   }
   review.onclick=function(){state.onlyReview=!state.onlyReview;state.shown=35;draw();};
   apply.onclick=function(){
     if(!unassigned.length||state.busy)return;
     var user=window.firebase&&firebase.auth().currentUser;
     if(!user||user.uid!==opts.uid||!user.emailVerified){
       status.textContent='Вход администратора устарел. Войди снова.';return;
     }
     if(!window.confirm('Сохранить языки названий для '+unassigned.length+
       ' композиций в приватном каталоге? Тексты и опубликованная главная страница не меняются.'))return;
     state.busy=true;draw();
     // Safe Firestore 400-write batches; leaves all other existing fields.
     var chunks=[],i;
     for(i=0;i<unassigned.length;i+=200)chunks.push(unassigned.slice(i,i+200));
     var work=Promise.resolve();
     chunks.forEach(function(chunk){
       work=work.then(function(){
         var batch=opts.db.batch();
         chunk.forEach(function(row){
           var ref=opts.db.collection('vmm_catalog').doc(row.id);
           batch.update(ref,{titleLanguage:row.code,
             titleLanguageMethod:row.changed?'reviewed':'title-inference',
             titleLanguageUpdatedAt:firebase.firestore.FieldValue.serverTimestamp()});
         });
         return batch.commit().then(function(){
           chunk.forEach(function(row){row.before=row.code;row.record.titleLanguage=row.code;row.accepted=true;});
         });
       });
     });
     work.then(function(){
       state.busy=false;draw();
       status.textContent='Сохранены языки названий. Теперь подключи их к языковым мирам через отдельный черновик.';
     }).catch(function(err){
       state.busy=false;draw();
       status.textContent='Не удалось завершить: '+String(err&&err.message||err);
     });
   };
   sync.onclick=function(){
     var langs=opts.languages,created=0,excluded=0;
     var byCode={};
     langs.entries.forEach(function(t){byCode[t.code]=t;});
     rows.forEach(function(row){
       // Only persisted catalog language values feed public worlds. Preview guesses
     // remain private until the administrator explicitly commits them.
     var code=row.before,lang=byCode[code],record=row.record;
       if(!code||!lang){excluded++;return;}
       var urls=record.links||{};
       var spotify=window.VMM_LANDING_SCHEMA.songUrl(urls.spotify||'','spotify'),
         youtube=window.VMM_LANDING_SCHEMA.songUrl(urls.youtube||'','youtube');
       var link=spotify||youtube,provider=spotify?'spotify':'youtube';
       if(!link){excluded++;return;}
       if(lang.tracks.some(function(t){return t.url===link;}))return;
       if(lang.tracks.length>=300){excluded++;return;}
       lang.tracks.push({title:row.title,artist:row.artist,provider:provider,url:link});
       created++;
     });
     if(opts.onDraftChanged)opts.onDraftChanged();
     status.textContent='В черновик языковых миров добавлено '+created+
       ' официальных ссылок; пропущено '+excluded+
       ' без надёжного языка, группы или публичной ссылки. Нажми «Сохранить черновик», затем «Опубликовать».';
   };
 }
 start.onclick=function(){
   state.results=proposals(opts.catalog,opts.languages);
   state.opened=true;state.shown=35;state.onlyReview=false;state.busy=false;draw();
 };
 if(state.opened&&state.results.length)draw();
}
window.VMM_TITLE_LANGUAGE={guess:guess,knownCode:knownCode,proposals:proposals,attach:attach};
}());
