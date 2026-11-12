/* RUN-084: lossless rule audit, curated templates and local music jokes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),bot=read('velar-assistant.js'),
 editor=read('studio/landing-editor.js');
const w={},document={readyState:'loading',getElementById:()=>null,addEventListener(){}};
vm.runInNewContext(schema,{window:w,String,Number,Math,Array,Object,JSON,Error},{timeout:2000});
vm.runInNewContext(bot,{window:w,document,String,Number,Math,Array,Object,JSON,Error,Date},{timeout:2000});
const api=w.VMM_LANDING_SCHEMA;
const full=api.defaults(),settings=full.genres.assistant;
assert.equal(settings.rules.length,0,'Old empty default remains empty; no forced write into Firestore');
assert.equal(settings.jokes.length,18);
assert.equal(settings.jokesEnabled,true);
assert.equal(new Set(Array.from(settings.jokes)).size,18);
assert.ok(settings.jokes.every(x=>typeof x==='string'&&x.length>15&&x.length<=220));
assert.ok(settings.jokes.some(x=>x.includes('контрабас')));
const q=(text,conf=settings)=>w.VELAR_ASSISTANT.answer(text,full,conf);
assert.equal(q('расскажи анекдот').text,settings.jokes[0]);
assert.equal(q('ещё анекдот').text,settings.jokes[1]);
assert.equal(q('пошути').text,settings.jokes[2]);
assert.equal(q('еще шутку').label,'Ещё анекдот 🎵');
for(let i=4;i<18;i++)assert.ok(q('анекдот').text.length);
assert.equal(q('анекдот').text,settings.jokes[0],'Jokes cycle without a timer or user-data storage');
const custom={...settings,rules:[{keywords:'анекдот',answer:'Свой ответ автора про анекдот.'}]};
assert.equal(q('анекдот',custom).text,'Свой ответ автора про анекдот.',
 'Published owner-written answers must always override general jokes');
const disabled={...settings,jokesEnabled:false};
assert.notEqual(q('анекдот',disabled).text,settings.jokes[1]);
assert.notEqual(q('анекдот',{...settings,jokes:[]}).text,settings.jokes[1]);
const legacy={...full,genres:{...full.genres,assistant:{title:'Old',welcome:'Hi',
 enabled:true,greetingEnabled:true,contactEmail:'',rules:[]}}};
const migrated=api.normalize(legacy).genres.assistant;
assert.equal(migrated.jokes.length,18,'Old published landing documents gain safe joke defaults');
assert.equal(migrated.jokesEnabled,true);
const changed=api.normalize({...full,genres:{...full.genres,assistant:{
 ...settings,jokes:['— Один музыкант сказал другому: привет!'],jokesEnabled:false}}}).genres.assistant;
assert.equal(changed.jokes.length,1);
assert.equal(changed.jokesEnabled,false);
assert.throws(()=>api.assistantConfig({...settings,jokes:Array(41).fill('Любая музыкальная шутка')},settings),/40/);
assert.throws(()=>api.assistantConfig({...settings,jokes:['а'.repeat(221)]},settings),/220/);
assert.throws(()=>api.assistantConfig({...settings,jokes:[' ']},settings),/обязательно/);
// A genuinely different human-authored answer is NEVER removed automatically.
const authored=[
 {keywords:'свадьба,СВАДЬБА,любовь',answer:'Ответ A'},
 {keywords:'свадьба,космос',answer:'Ответ A'},
 {keywords:'свадьба,моя свадьба',answer:'Ответ B'}
];
const original=JSON.stringify(authored);
const result=api.auditAssistantRules(authored,settings.faq);
assert.equal(JSON.stringify(authored),original,'Audit is pure and preserves the input');
assert.equal(result.rules.length,2,'Same reply may merge, conflicting reply remains');
assert.equal(result.rules[0].answer,'Ответ A');
assert.equal(result.rules[1].answer,'Ответ B');
assert.ok(result.rules[0].keywords.includes('космос'));
assert.ok(result.conflicts>=1,'Conflicts must be reported, never silently deleted');
assert.ok(result.overlaps>=1,'Potential overlap with the FAQ is reported');
assert.equal(result.changed,true);
assert.equal(api.auditAssistantRules(result.rules,settings.faq).changed,false,
 'A second cleanup makes no extra changes');
const separate=[
 {keywords:'уникальный вопрос',answer:'Первый ответ'},
 {keywords:'уникальный вопрос',answer:'Второй ответ'}
];
const conflict=api.auditAssistantRules(separate,settings.faq);
assert.equal(conflict.rules.length,2);
assert.equal(conflict.conflicts,1);
assert.equal(conflict.changed,false,'A conflict needs the owner, not automatic deletion');
const suggestions=api.recommendedAssistantRules();
assert.equal(suggestions.length,6);
assert.ok(suggestions.every(r=>r.keywords&&r.answer));
const injected=api.addRecommendedAssistantRules(authored,settings.faq);
assert.equal(injected.added,6);
assert.equal(injected.rules.length,authored.length+6);
assert.equal(api.addRecommendedAssistantRules(injected.rules,settings.faq).added,0,
 'Second click cannot duplicate suggested answers');
const maxed=Array(25).fill(0).map((_,i)=>({keywords:'свой запрос '+i,answer:'Мой ответ '+i}));
assert.equal(api.addRecommendedAssistantRules(maxed,settings.faq).added,0);
assert.match(editor,/Проверка повторов ответов/);
assert.match(editor,/Очистить только точные повторы/);
assert.match(editor,/Добавить 6 особых ответов/);
assert.match(editor,/Музыкальные анекдоты/);
assert.match(editor,/Редактировать анекдоты/);
assert.match(editor,/Сохрани и опубликуй/);
assert.match(read('index.html'),/landing-schema\.js\?v=16/);
assert.match(read('index.html'),/velar-assistant\.js\?v=11/);
assert.match(read('studio/index.html'),/landing-editor\.js\?v=21/);
assert.match(read('sw.js'),/CACHE_PREFIX \+ 'v37'/);
assert.match(read('sw.js'),/STUDIO_PREFIX\+'v34'/);
assert.doesNotMatch(bot,/fetch\(|XMLHttpRequest|WebSocket|firebase|localStorage\.setItem/);
console.log('PASS RUN-084: editable musical jokes, rotation, special rule templates, lossless collision audit and cache');
