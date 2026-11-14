/* RUN-083: 113 editorial questions, configurable routing and no fabricated song links. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const schema=read('landing-schema.js'),faq=read('velar-faq-engine.js'),
 bot=read('velar-assistant.js'),topics=read('topics-public.js'),
 languages=read('languages-public.js'),html=read('index.html'),sw=read('sw.js');
new vm.Script(faq);new vm.Script(bot);new vm.Script(topics);new vm.Script(languages);
const w={},doc={readyState:'loading',getElementById:()=>null,addEventListener(){}};
vm.runInNewContext(schema,{window:w,Array,String,Number,Object,JSON,Math,Error},{timeout:1000});
vm.runInNewContext(faq,{window:w,Array,String,Number,Object,JSON,Math,Error},{timeout:1000});
vm.runInNewContext(bot,{window:w,document:doc,Array,String,Number,Object,JSON,Math,Error,Date},{timeout:1000});
const api=w.VMM_LANDING_SCHEMA,defaults=api.defaults(),settings=defaults.genres.assistant;
assert.equal(settings.faq.length,113,'Exactly 113 curated FAQ entries shipped');
assert.equal(new Set(Array.from(settings.faq,x=>x.id)).size,113);
assert.equal(new Set(Array.from(settings.faq,x=>x.group)).size,10);
for(const row of settings.faq){
 assert.ok(row.answer.length>=15,'No hollow answer: '+row.id);
 assert.ok(row.keywords.length>=2);
 const query=row.keywords.split(',')[0];
 const got=w.VELAR_FAQ.answer(query,defaults,settings);
 assert.ok(got&&got.text.length>=10,'Every FAQ has a sample match: '+row.id);
}
function answer(q,data=defaults,conf=settings){return w.VELAR_ASSISTANT.answer(q,data,conf);}
assert.match(answer('кто ты').text,/VELAR/);
assert.match(answer('мне грустно').text,/чувств/);
assert.match(answer('спой мне').text,/телефон/);
assert.equal(answer('свадьба').action,'topic');
assert.equal(answer('свадьба').target,'wedding');
assert.equal(answer('на финском').target,'#languages');
assert.equal(answer('на немецком').target,'#languages');
assert.equal(answer('сотрудничество',{...defaults}, {...settings,contactEmail:'hello@example.com'}).action,'email');
assert.equal(answer('посоветуй музыку').actions.length,3,'Unclear music request has followup buttons');
assert.equal(answer('песня из другой галактики, которых не существует').actions.length,3,
 'Unknown query should ask a clarification, not invent a track');
const owner={...settings,rules:[{keywords:'свадьба',answer:'Моя особая свадьба'}]};
assert.equal(answer('свадьба',defaults,owner).text,'Моя особая свадьба',
 'Original owner-written rules must override the shipped FAQ');
const noFaq={...settings,faq:[]};
assert.equal(w.VELAR_FAQ.answer('спой мне',defaults,noFaq),null);
const disabled={...settings,faq:settings.faq.map(x=>x.id==='sing'?{...x,enabled:false}:x)};
assert.equal(w.VELAR_FAQ.answer('спой мне',defaults,disabled),null);
const old={...defaults,genres:{...defaults.genres,assistant:{
 title:'VELAR',welcome:'Здравствуйте',enabled:true,greetingEnabled:true,
 rules:[],contactEmail:''}}};
assert.equal(api.normalize(old).genres.assistant.faq.length,113,
 'Existing published landing documents gain knowledge without destructive rewrite');
assert.equal(api.normalize({...defaults,genres:{...defaults.genres,
 assistant:{...settings,faq:[]}}}).genres.assistant.faq.length,0);
function invalid(change){return api.normalize({...defaults,genres:{...defaults.genres,
 assistant:{...settings,faq:change}}});}
assert.throws(()=>invalid(Array(151).fill(settings.faq[0])),/150/);
assert.throws(()=>invalid([{...settings.faq[0],route:'https://drive.google.com/private'}]),/маршрут/);
assert.throws(()=>invalid([{...settings.faq[0],followups:'1,2,3,4'}]),/три/);
assert.throws(()=>invalid([{...settings.faq[0],answer:'a'.repeat(470)}]),/460/);
assert.throws(()=>invalid([{...settings.faq[0]},{...settings.faq[0]}]),/уникальным/);
const empty=w.VELAR_FAQ.publishedSongs(defaults);
assert.equal(empty.length,0);
const url='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const video='https://www.youtube.com/watch?v=ABCDEFGHIjk';
const sample=api.defaults();
const love=sample.genres.topics.entries.find(t=>t.slug==='love');
love.tracks=[{title:'Белая берёза',artist:'Velar',provider:'spotify',url}];
const space=sample.genres.topics.entries.find(t=>t.slug==='space');
space.tracks=[{title:'Галактика',artist:'Velar',provider:'youtube',url:video}];
const fi=sample.genres.languages.entries.find(t=>t.code==='fi');
fi.tracks=[{title:'Kesäyö',artist:'Velar',provider:'spotify',url}];
assert.equal(w.VELAR_FAQ.publishedSongs(sample).length,2,'Duplicate public track is reused, not invented');
// RUN-090: different provider choices for the same named composition in
// two visible worlds must not create two music recommendations.
const sameComposition=api.defaults();
sameComposition.genres.topics.entries.find(x=>x.slug==='love').tracks=[
 {title:'Velar Superstar',artist:'Velar',provider:'spotify',url}];
sameComposition.genres.languages.entries.find(x=>x.code==='fi').tracks=[
 {title:'Velar Superstar',artist:'Velar',provider:'youtube',url:video}];
assert.equal(w.VELAR_FAQ.publishedSongs(sameComposition).length,1,
 'VELAR Assistant recommends ONE song, not a separate Spotify and YouTube copy');
const direct=answer('послушать Белая берёза',sample);
assert.equal(direct.action,'song');
assert.equal(direct.url,url);
assert.equal(direct.kind,'topic');
const loveResult=answer('любовь',sample);
assert.equal(loveResult.actions.length,2);
assert.equal(loveResult.actions[0].action,'song');
assert.equal(loveResult.actions[1].action,'topic');
const fiResult=answer('на финском',sample);
assert.equal(fiResult.actions[0].action,'song');
assert.equal(fiResult.actions[1].action,'language');
const original=api.normalize(sample);
assert.equal(original.genres.topics.entries.find(t=>t.slug==='love').tracks.length,1);
sample.genres.topics.entries.find(t=>t.slug==='love').tracks=[{title:'Чужое',provider:'spotify',url:'https://drive.google.com/file/d/private'}];
assert.equal(w.VELAR_FAQ.publishedSongs(sample).length,2,'Other approved topic/language tracks remain visible');
assert.ok(w.VELAR_FAQ.publishedSongs(sample).every(t=>t.url.indexOf('drive.google.com')===-1),
 'Never suggest unapproved private Drive links');
const noSongsResult=answer('любовь',defaults);
assert.ok(!noSongsResult.actions,'No fabricated play buttons when a topic is empty');
assert.match(noSongsResult.text,/нет назначенных/);
// RUN-087: recommendations use only published tracks and never invent audio.
assert.equal(settings.favoriteSongTitle,'Velar Superstar');
const guideFavorite=answer('Какая твоя любимая песня?');
assert.match(guideFavorite.text,/Velar Superstar/);
assert.ok(![...(guideFavorite.actions||[])].some(x=>x.action==='song'),'Private catalog must not produce a public song action');
const advice=answer('А что посоветуешь?');
assert.equal(advice.actions.length,3);
assert.equal(advice.actions[0].target,'#topics','Recommendation directs visitors to topic descriptions');
assert.equal(advice.actions[1].action,'ask');
const randomEmpty=answer('случайную песню');
assert.equal(randomEmpty.action,'link');
assert.equal(randomEmpty.target,'#topics');
const guideSample=api.defaults();
guideSample.genres.topics.entries.find(x=>x.slug==='love').tracks=[
 {title:'Velar Superstar',artist:'Velar',url,provider:'spotify'}];
guideSample.genres.topics.entries.find(x=>x.slug==='space').tracks=[
 {title:'Галактика',artist:'Velar',url:video,provider:'youtube'}];
const availableFavorite=answer('какая твоя любимая песня',guideSample);
assert.ok(availableFavorite.actions.some(x=>x.action==='song'&&x.url===url));
assert.ok(answer('открой песню Велар Суперстар',guideSample).actions.some(x=>x.action==='song'));
const unnamed=answer('открой песню',guideSample);
assert.equal(unnamed.actions[0].target,'#topics','Missing song title asks visitor to choose');
const notPublished=answer('открой песню Совсем другая',guideSample);
assert.ok(notPublished.text.indexOf('нет среди опубликованных')!==-1);
assert.ok(!notPublished.actions.some(x=>x.action==='song'));
assert.equal(answer('открой песню Velar Superstar',guideSample).action,'song');
const firstRandom=answer('выбери случайную песню',guideSample);
assert.equal(firstRandom.actions[0].action,'song');
assert.ok([url,video].includes(firstRandom.actions[0].url));
assert.equal(firstRandom.actions[1].action,'ask');
const secondRandom=answer('случайная песня',guideSample);
assert.notEqual(secondRandom.actions[0].url,firstRandom.actions[0].url,
 'With two tracks consecutive random suggestions must differ');
const ownerAdvice={...settings,rules:[{keywords:'что посоветуешь',answer:'Мой авторский ответ'}]};
assert.equal(answer('что посоветуешь',guideSample,ownerAdvice).text,'Мой авторский ответ');
const ownerFavorite={...settings,favoriteSongTitle:'Галактика'};
assert.ok(answer('какая твоя любимая песня',guideSample,ownerFavorite).actions.some(x=>x.url===video),
 'Changing favorite in Studio affects next public answer');
const noLeaks=api.defaults();
noLeaks.genres.topics.entries.find(x=>x.slug==='love').tracks=[
 {title:'Velar Superstar',artist:'Velar',url:'https://drive.google.com/file/d/private',provider:'spotify'}];
assert.ok(!(answer('какая твоя любимая песня',noLeaks).actions||[]).some(x=>x.action==='song'));
const sampleSection=api.normalize({...defaults,genres:{...defaults.genres,assistant:settings}});
assert.equal(sampleSection.genres.assistant.faq.length,113);
assert.match(html,/velar-faq-engine\.js\?v=3/);
assert.ok(html.indexOf('velar-faq-engine.js?v=3')<html.indexOf('velar-assistant.js?v=11'));
assert.match(sw,/'\.\/velar-faq-engine\.js\?v=3'/);
assert.match(sw,/CACHE_PREFIX \+ 'v47'/);
assert.match(read('style.css'),/velar-chat-actions/);
assert.match(bot,/choice\.action==='song'/);
assert.match(bot,/choice\.action==='ask'/);
assert.match(topics,/window\.VELAR_TOPICS=\{render:render,entries:entries,select:select,openFromChat:openFromChat\}/);
assert.match(languages,/window\.VELAR_LANGUAGES=\{render:render,entries:entries,show:show,openFromChat:openFromChat\}/);
assert.doesNotMatch(faq,/fetch\(|XMLHttpRequest|firebase|localStorage|sessionStorage|setTimeout\(/);
console.log('PASS: 113 editable VELAR FAQ, dynamic published music links, clarifying actions, safety and legacy configs');
