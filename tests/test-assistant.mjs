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
assert.equal(answer('на финском').target,'#languages');
assert.equal(answer('песня на немецком').target,'#languages');
const custom={...settings,rules:[{keywords:'эксклюзив',answer:'У нас есть особая подборка.'}]};
assert.equal(answer('эксклюзив',custom).text,'У нас есть особая подборка.');
assert.match(html,/id="velar-assistant"/);
assert.match(html,/velar-assistant\.js\?v=4/);
assert.match(html,/name="robots" content="noindex,nofollow,noarchive"/);
assert.match(css,/\.velar-assistant-launch/);
assert.match(css,/\.velar-assistant-wave/);
assert.ok(css.includes("dj-velar-expressions.jpg"));
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
assert.match(sw,/'\.\/velar-assistant\.js\?v=4'/);
assert.match(publicCode,/velar-radio-hidden/);
assert.match(publicCode,/VELAR_ASSISTANT\.render\(value\)/);
assert.doesNotMatch(code,/fetch\(|firebase|XMLHttpRequest|setInterval\(|setTimeout\(|WebSocket|autoplay=|\.play\(/);
assert.match(css,/\.velar-assistant\{[\s\S]*?bottom:0;/);
assert.match(css,/\.velar-assistant-dialog\{[\s\S]*?margin-bottom:0;/);
assert.doesNotMatch(css,/bottom:calc\(max\(16px,env\(safe-area-inset-bottom,0px\)\) \+ 6[36]px\)/);
assert.match(css,/grid-template-columns:34px minmax\(0,1fr\)/);
assert.match(css,/\.velar-chat-line\.is-assistant \.velar-chat-action\{grid-column:2;grid-row:2/);
assert.match(code,/querySelector\('\.velar-assistant-title'\)/);
assert.match(code,/Не сохраняем и не отправляем автору/);
assert.doesNotMatch(code,/Ответы формируются на устройстве\. Сообщения не сохраняются/);
assert.match(css,/\.velar-assistant-launch\[aria-expanded="true"\]\{display:none\}/);
assert.match(css,/\.velar-assistant-log\{min-height:96px;max-height:235px/);
assert.match(css,/\.velar-assistant-suggestion\{min-height:28px;padding:2px 7px/);
assert.match(css,/\.velar-assistant-privacy\{padding:1px 7px 3px/);
assert.match(css,/\.velar-assistant-header-note\{display:none\}/);
assert.match(css,/\.velar-assistant-input\{height:36px;padding:6px 8px;font-size:16px\}/);
assert.match(sw,/CACHE_PREFIX \+ 'v22'/);
assert.match(html,/style\.css\?v=20/);
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
const deviceWindow={};
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

console.log('PASS: RUN-079 compact mobile assistant and one-line privacy');