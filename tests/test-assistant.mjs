import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const code=read('velar-assistant.js'),schema=read('landing-schema.js'),html=read('index.html'),
 publicCode=read('landing-public.js'),css=read('style.css'),sw=read('sw.js');
new vm.Script(code);
const w={},doc={readyState:'loading',getElementById:()=>null,addEventListener:()=>{}};
vm.runInNewContext(schema,{window:w,Array,Object,String,Math,Error,JSON},{timeout:1000});
const settings=w.VMM_LANDING_SCHEMA.defaults().genres.assistant;
assert.equal(settings.enabled,true);
assert.equal(settings.greetingEnabled,true);
assert.equal(settings.contactEmail,'');
assert.deepEqual(Array.from(settings.rules),[]);
assert.equal(w.VMM_LANDING_SCHEMA.normalize(w.VMM_LANDING_SCHEMA.defaults()).genres.assistant.enabled,true);
assert.throws(()=>w.VMM_LANDING_SCHEMA.assistantConfig({contactEmail:'not-an-email'},settings),/email/);
assert.equal(w.VMM_LANDING_SCHEMA.assistantConfig({rules:[{keywords:'hey',answer:'<script>bad</script>'}]},settings).rules[0].answer,'<script>bad</script>','UI must render all replies with textContent, not innerHTML');
assert.throws(()=>w.VMM_LANDING_SCHEMA.assistantConfig({rules:Array(26).fill({keywords:'x,y',answer:'A'})},settings),/25/);
vm.runInNewContext(code,{window:w,document:doc,Array,String,Math,Number,Error},{timeout:1000});
const answer=(s,terms=settings)=>w.VELAR_ASSISTANT.answer(s,w.VMM_LANDING_SCHEMA.defaults(),terms);
assert.match(answer('привет').text,/Привет/);
assert.match(answer('Мне грустно').text,/Грусть/);
assert.equal(answer('свадьба').action,'topic');
assert.equal(answer('свадьба').target,'wedding');
assert.equal(answer('космос').target,'space');
assert.equal(answer('поговорить с оператором').action,'link');
assert.equal(answer('сотрудничество',{...settings,contactEmail:'hello@example.com'}).action,'email');
assert.equal(answer('хочу радио').target,'#playlists');
// RUN-086: explicit player commands work only when owner enabled a valid radio.
const radioData=w.VMM_LANDING_SCHEMA.defaults();
radioData.releases.radio={...radioData.releases.radio,enabled:true,controlVersion:2};
assert.equal(w.VELAR_ASSISTANT.answer('Velar, включи радио!',radioData,settings).action,'radio');
assert.equal(w.VELAR_ASSISTANT.answer('включи Velar Radio',radioData,settings).action,'radio');
assert.equal(w.VELAR_ASSISTANT.answer('start radio',radioData,settings).action,'radio');
assert.equal(answer('Velar, включи радио!').target,'#playlists','OFF switch wins');
assert.notEqual(w.VELAR_ASSISTANT.answer('выключи радио',radioData,settings).action,'radio');
const ruleOverride={...settings,rules:[{keywords:'радио',answer:'Только текст'}]};
assert.equal(w.VELAR_ASSISTANT.answer('включи радио',radioData,ruleOverride).action,'radio','explicit UI command wins over text-only FAQ');

assert.equal(answer('на финском').target,'#languages');
assert.equal(answer('песня на немецком').target,'#languages');
const custom={...settings,rules:[{keywords:'эксклюзив',answer:'У нас есть особая подборка.'}]};
assert.equal(answer('эксклюзив',custom).text,'У нас есть особая подборка.');
assert.match(html,/id="velar-assistant"/);
assert.match(html,/velar-assistant\.js\?v=12/);
assert.match(html,/name="robots" content="noindex,nofollow,noarchive"/);
assert.match(css,/\.velar-assistant-launch/);
assert.match(css,/\.velar-assistant-wave/);
assert.ok(css.includes("dj-velar-expressions.jpg"));
const spriteRule=css.match(/\.velar-expression::before\{([^}]+)\}/);
assert.ok(spriteRule,'The DJ Velar JPEG sprite must remain attached to avatar pseudo-element');
for(const side of ['top','right','bottom','left']){
 assert.match(spriteRule[1],new RegExp('(?:^|;)'+side+':0(?:;|$)'),
  'Safari 12 requires explicit '+side+':0 instead of unsupported inset shorthand');
}
assert.doesNotMatch(spriteRule[1],/(?:^|;)inset:/,
 'Old iOS Safari ignores inset, collapsing portrait and exposing the fallback V');
assert.match(spriteRule[1],/background-image:url\('assets\/dj-velar-expressions\.jpg'\)/);

const sprite=fs.readFileSync(new URL('../assets/dj-velar-expressions.jpg',import.meta.url));
assert.ok(sprite.length<30000,'ten portraits must remain small');
assert.equal(sprite[0],0xff);assert.equal(sprite[1],0xd8);
assert.equal(w.VELAR_ASSISTANT.expressionFor('спасибо'),'thanks');
assert.equal(w.VELAR_ASSISTANT.expressionFor('доброе утро'),'morning');
assert.equal(w.VELAR_ASSISTANT.expressionFor('выключи'),'off');
assert.equal(w.VELAR_ASSISTANT.expressionFor('любовь'),'heart');
assert.equal(w.VELAR_ASSISTANT.expressionFor('OK'),'okay');
assert.ok(css.includes("max-height:min(390px,50vh)"));
assert.ok(!code.includes("dj-velar-assistant.webp"));
assert.match(code,/sessionStorage/);
assert.match(sw,/'\.\/velar-assistant\.js\?v=12'/);
assert.match(publicCode,/velar-radio-hidden/);
assert.match(publicCode,/VELAR_ASSISTANT\.render\(value\)/);
assert.doesNotMatch(code,/fetch\(|firebase|XMLHttpRequest|setInterval\(|WebSocket|autoplay=|\.play\(/);
assert.match(code,/window\.setTimeout\(step,/,'typing uses one cancellable local timer');
assert.match(code,/window\.clearTimeout\(session\.timer\)/,'typing must cancel on close');
assert.match(css,/\.velar-assistant\{[\s\S]*?bottom:0;/);
assert.match(css,/\.velar-assistant-dialog\{[\s\S]*?margin-bottom:0;/);
assert.doesNotMatch(css,/bottom:calc\(max\(16px,env\(safe-area-inset-bottom,0px\)\) \+ 6[36]px\)/);
assert.match(css,/grid-template-columns:34px minmax\(0,1fr\)/);
assert.match(css,/\.velar-chat-line\.is-assistant \.velar-chat-action\{grid-column:2;grid-row:2/);
assert.match(code,/querySelector\('\.velar-assistant-title'\)/);
assert.match(code,/Не сохраняем и не отправляем автору/);
assert.doesNotMatch(code,/Ответы формируются на устройстве\. Сообщения не сохраняются/);
assert.match(css,/\.velar-assistant-launch\[aria-expanded="true"\]\{display:none\}/);
// RUN-088: launcher must disappear at DESKTOP width, not only in mobile media.
const globalLauncherRule=css.indexOf('.velar-assistant-launch[aria-expanded="true"]{display:none}');
const mobileAssistantMedia=css.indexOf('/* RUN-079 — denser mobile assistant');
assert.ok(globalLauncherRule>0&&globalLauncherRule<mobileAssistantMedia,
 'Hide expanded launcher before mobile @media; desktop should not show duplicate title');
assert.match(css,/\.velar-assistant-log\{min-height:96px;max-height:235px/);
assert.match(css,/\.velar-assistant-suggestion\{min-height:28px;padding:2px 7px/);
assert.match(css,/\.velar-assistant-privacy\{padding:1px 7px 3px/);
assert.match(css,/\.velar-assistant-header-note\{display:none\}/);
assert.match(css,/\.velar-assistant-input\{height:36px;padding:6px 8px;font-size:16px\}/);
assert.match(sw,/CACHE_PREFIX \+ 'v48'/);
assert.match(html,/style\.css\?v=39/);
assert.ok(code.includes("querySelector('.velar-assistant-launch')"));

const customLabels={...settings,labels:{...settings.labels,
 launcher:'Мой VELAR',privacy:'',submit:'Отправить',
 inputPlaceholder:'Выбери музыку'}};
const customReplies={...settings,replies:{...settings.replies,
 hello:'Привет от владельца',radio:'Мой плейлист',radioButton:'Слушать',
 contactEnabledButton:''}};
assert.equal(answer('привет',customReplies).text,'Привет от владельца');
assert.equal(answer('радио',customReplies).label,'Слушать');
assert.equal(answer('контакт',{...customReplies,contactEmail:'owner@example.com'}).label,'');
assert.match(css,/\.velar-assistant-suggestions:empty\{display:none\}/);
const avatarValues=w.VMM_LANDING_SCHEMA.defaults().genres.assistant.avatars;
assert.deepEqual(Array.from(Object.keys(avatarValues.reactions)),
 ['neutral','wave','morning','night','thanks','heart','okay','peace','off','celebrate']);
assert.match(code,/function reactionChoice\(raw,reply\)/);
assert.match(code,/r\.source\|\|'question'/);
assert.match(code,/function setAvatar\(face,expression\)/);
assert.match(code,/velar-expression--custom/);
assert.match(code,/face\.style\.backgroundImage=/);
assert.match(code,/greetingChoice\(\)/);
assert.match(code,/applyConfigText\(\)/);
assert.match(code,/renderQuickTopics\(\)/);
// Simulate browser DOM: owner edits should rerender without page reload.
function node(tag){
 return {tagName:tag,textContent:'',className:'',value:'',children:[],
   attributes:{},style:{},scrollHeight:0,scrollTop:0,
   appendChild(el){this.children.push(el);return el;},
   removeChild(el){this.children.splice(this.children.indexOf(el),1);},
   setAttribute(k,v){this.attributes[k]=v;},
   getAttribute(k){return this.attributes[k];},
   get firstChild(){return this.children[0]||null;},
   focus(){},
   querySelector(selector){
     let name=selector.slice(1);
     for(const child of this.children){
       if((child.className||'').split(/\s+/).includes(name))return child;
       if(child.querySelector){const found=child.querySelector(selector);if(found)return found;}
     }
     return null;
   }
 };
}
const host=node('div'),deviceDoc={readyState:'loading',createElement:node,
 addEventListener(){},getElementById:id=>id==='velar-assistant'?host:null};
const deviceEvents={};
const deviceWindow={pageYOffset:0,addEventListener(name,callback){deviceEvents[name]=callback;}};
vm.runInNewContext(schema,{window:deviceWindow,Array,String,Math,Number,Object,JSON,Error},{timeout:1000});
vm.runInNewContext(code,{window:deviceWindow,document:deviceDoc,
 Array,String,Number,Math,Object,JSON,Error,Date},{timeout:1000});
const config=deviceWindow.VMM_LANDING_SCHEMA.defaults();
config.genres.assistant={...config.genres.assistant,...customLabels,
 quickTopics:[{label:'Любовь',query:'любовь'}],
 avatars:{...config.genres.assistant.avatars,
  launcher:'heart',header:'night',greeting:'morning',
  reactions:{...config.genres.assistant.avatars.reactions,heart:'thanks'},
  keywordRules:[{keywords:'любовь',source:'question',expression:'okay'}]}};
deviceWindow.VELAR_ASSISTANT.render(config);
assert.equal(host.querySelector('.velar-assistant-launch-label').textContent,'Мой VELAR');
assert.equal(host.querySelector('.velar-assistant-launch').attributes['aria-label'],'Мой VELAR',
 'Collapsed scroll launcher retains an accessible label');
assert.ok(css.includes('.velar-assistant.is-browsing .velar-assistant-launch-label{display:none}'),
 'Only the visible text collapses after scrolling, not access to the chat');
assert.ok(css.includes('.velar-assistant.is-browsing .velar-assistant-launch{'),
 'On scroll the helper becomes a compact icon rather than covering song titles');
assert.equal(typeof deviceEvents.scroll,'function','Browsing state reacts to native scroll');
assert.equal(host.querySelector('.velar-assistant-submit').textContent,'Отправить');
assert.equal(host.querySelector('.velar-assistant-input').placeholder,'Выбери музыку');
assert.equal(host.querySelector('.velar-assistant-privacy').style.display,'none');
assert.equal(host.querySelector('.velar-assistant-symbol').attributes['data-expression'],'heart');
assert.equal(host.querySelector('.velar-assistant-header-avatar').attributes['data-expression'],'night');
assert.equal(host.querySelector('.velar-assistant-greeting-avatar').attributes['data-expression'],'morning');
const tags=host.querySelector('.velar-assistant-suggestions');
assert.equal(tags.children.length,1);assert.equal(tags.children[0].textContent,'Любовь');
config.genres.assistant.quickTopics=[];
deviceWindow.VELAR_ASSISTANT.render(config);
assert.equal(tags.children.length,0,'Zero quick tags must be supported');
config.genres.assistant.quickTopics=Array(12).fill(0).map((_,i)=>({label:'Тема '+i,query:'привет'}));
deviceWindow.VELAR_ASSISTANT.render(config);
assert.equal(tags.children.length,12);


// RUN-082: precise character-by-character reveal with controllable fake timers.
let typeReduced=false,typeId=0;
const scheduled=new Map();
deviceWindow.setTimeout=(fn,ms)=>{const id=++typeId;scheduled.set(id,{fn,ms});return id;};
deviceWindow.clearTimeout=id=>scheduled.delete(id);
deviceWindow.matchMedia=()=>({matches:typeReduced});
function tickOne(){
 const item=scheduled.entries().next().value;
 assert.ok(item,'No pending typing timer');
 scheduled.delete(item[0]);item[1].fn();return item[1].ms;
}
function tickAll(){
 let n=0;while(scheduled.size){assert.ok(n++<650,'Typing is not bounded');tickOne();}
}
config.genres.assistant.quickTopics=[{label:'Любовь',query:'любовь'}];
deviceWindow.VELAR_ASSISTANT.render(config);
const control=host.querySelector('.velar-assistant-launch');
deviceWindow.pageYOffset=500;
deviceEvents.scroll();
assert.equal(host.className,'velar-assistant is-browsing',
 'After scrolling to songs, the closed assistant no longer covers titles');
assert.match(host.querySelector('.velar-assistant-greeting').className,/hidden/,
 'Welcome balloon disappears once the visitor browses songs');
control.onclick();
assert.equal(host.className,'velar-assistant',
 'Opening the assistant restores the full-width conversation');
const conversation=host.querySelector('.velar-assistant-log');
assert.equal(conversation.children.length,1);
const greetingRow=conversation.children[0];
const greetingP=greetingRow.children[1];
assert.equal(greetingP.textContent,'','Greeting starts empty and types letter by letter');
assert.equal(scheduled.size,1);
tickOne();
assert.equal(greetingP.textContent.length,1);
assert.match(greetingP.className,/velar-chat-typing/);
tickAll();
assert.equal(greetingP.textContent,config.genres.assistant.welcome);
assert.doesNotMatch(greetingP.className,/velar-chat-typing/);
assert.equal(host.querySelector('.velar-assistant-announcement').textContent,config.genres.assistant.welcome);
tags.children[0].onclick(); // 'Любовь' with a music-topic button
const firstAnswer=conversation.children[conversation.children.length-1];
const firstParagraph=firstAnswer.children[1];
assert.equal(firstParagraph.textContent,'','A configured music reply is typed');
assert.equal(firstAnswer.children.length,2,'Action button is hidden until reply finishes');
const firstActionText=deviceWindow.VELAR_ASSISTANT.answer('любовь',config,config.genres.assistant).label;
tickOne();
assert.equal(firstParagraph.textContent.length,1);
tickAll();
assert.ok(firstParagraph.textContent.length>15);
if(firstActionText)assert.equal(firstAnswer.children[2].textContent,firstActionText);
// A second question while typing must finish the first reply with no ghost timers.
tags.children[0].onclick();
const pendingParagraph=conversation.children[conversation.children.length-1].children[1];
tickOne();
assert.equal(pendingParagraph.textContent.length,1);
tags.children[0].onclick();
assert.ok(pendingParagraph.textContent.length>5,'Previous answer completes before new user row');
assert.equal(scheduled.size,1,'Only one typing timer can be active');
const close=host.querySelector('.velar-assistant-close');
close.onclick();
assert.equal(host.className,'velar-assistant is-browsing',
 'After closing the chat on a long page, return to a small icon');
deviceWindow.pageYOffset=0;deviceEvents.scroll();
assert.equal(host.className,'velar-assistant',
 'Near the top of the page the launcher returns to its original width');
assert.equal(scheduled.size,0,'Closing chat cancels animation');
assert.equal(deviceWindow.VELAR_ASSISTANT.typingStatus(),'enabled');
assert.equal(pendingParagraph.className.includes('velar-chat-typing'),false);
// Option to disable animation, including legacy/reduced-motion users.
config.genres.assistant.typing.enabled=false;
deviceWindow.VELAR_ASSISTANT.render(config);
assert.equal(deviceWindow.VELAR_ASSISTANT.typingStatus(),'disabled-in-studio');
deviceWindow.VELAR_ASSISTANT.render(config);
control.onclick();
tags.children[0].onclick();
assert.ok(conversation.children[conversation.children.length-1].children[1].textContent.length>5);
assert.equal(scheduled.size,0);
config.genres.assistant.typing.enabled=true;typeReduced=true;
deviceWindow.VELAR_ASSISTANT.render(config);
tags.children[0].onclick();
assert.ok(conversation.children[conversation.children.length-1].children[1].textContent.length>5);
assert.equal(scheduled.size,0,'prefers-reduced-motion never starts timers');
assert.equal(deviceWindow.VELAR_ASSISTANT.typingStatus(),'reduced-motion');
typeReduced=false;
// Unicode surrogate pairs should appear as one character, not a broken half.
config.genres.assistant.rules=[{keywords:'тест эмодзи',answer:'🐣Привет'}];
deviceWindow.VELAR_ASSISTANT.render(config);
const question=host.querySelector('.velar-assistant-input');
const form=host.querySelector('.velar-assistant-form');
question.value='тест эмодзи';form.onsubmit({preventDefault(){}});
const emojiAnswer=conversation.children[conversation.children.length-1].children[1];
tickOne();
assert.equal(emojiAnswer.textContent,'🐣');
tickAll();
assert.equal(emojiAnswer.textContent,'🐣Привет');
assert.equal(scheduled.size,0);
assert.match(css,/velar-typing-caret/);
assert.match(css,/prefers-reduced-motion:reduce/);

console.log('PASS: RUN-082 local typewriter, Unicode, rapid messages and reduced motion');