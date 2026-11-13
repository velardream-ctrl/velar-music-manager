import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const src=read('landing-schema.js'),html=read('index.html'),studio=read('studio/index.html'),rules=read('firestore.rules');
const window={};vm.runInNewContext(src,{window,Array,String,Object,JSON,Number,Error},{timeout:1000});
const api=window.VMM_LANDING_SCHEMA;
const def=api.normalize(api.defaults());
assert.equal(def.artists.cards.length,0);
assert.equal(def.releases.cards.length,0);
assert.equal(def.genres.tags.length,7);
assert.equal(def.genres.universe.nodes.length,8);
assert.equal(def.genres.languages.entries.length,13);
assert.ok(def.genres.languages.entries.some(x=>x.code==='beaver'&&x.fictional));
assert.ok(def.genres.languages.entries.some(x=>x.code==='alien'&&x.fictional));
assert.equal(def.genres.languages.entries.every(x=>x.tracks.length===0),true);

assert.ok(Object.keys(def).join(',')==='hero,artists,albums,releases,genres,about');
assert.match(def.hero.subtitle,/Разные голоса/);
assert.throws(()=>api.normalize({...def,hero:{subtitle:'',intro:'A'}}),/обязательно/);
assert.throws(()=>api.normalize({...def,hero:{subtitle:'x'.repeat(161),intro:'A'}}),/160/);
assert.throws(()=>api.normalize({...def,genres:{...def.genres,tags:Array(21).fill('Поп')}}),/20/);
assert.throws(()=>api.normalize({...def,releases:{...def.releases,cards:Array(13).fill(api.blankCard())}}),/12/);
function cardWith(url,imageUrl){return {...api.blankCard(),title:'Первый альбом',subtitle:'Velar',visible:true,url,imageUrl};}
assert.throws(()=>api.normalize({...def,releases:{...def.releases,cards:[cardWith('javascript:alert(1)','')]}}),/HTTPS/);
assert.throws(()=>api.normalize({...def,releases:{...def.releases,cards:[cardWith('https://drive.google.com/file/d/private','')]}}),/приватные ссылки/);
assert.throws(()=>api.normalize({...def,releases:{...def.releases,cards:[cardWith('https://open.spotify.com/album/ok','https://firebasestorage.googleapis.com/v0/b/private')]}}),/приватные ссылки/);
const safe=api.normalize({...def,releases:{...def.releases,cards:[cardWith('https://open.spotify.com/album/abc','https://example.com/cover.jpg')]}});
assert.equal(safe.releases.cards[0].title,'Первый альбом');
assert.equal(safe.releases.cards[0].url,'https://open.spotify.com/album/abc');
assert.equal(safe.releases.cards[0].visible,true);
const privateObject={...def,secretToken:'abc123',lyrics:[{text:'не публиковать'}]};
const clean=JSON.stringify(api.normalize(privateObject));
assert.doesNotMatch(clean,/secretToken|не публиковать/);
assert.match(html,/landing-public\.js\?v=20/);
assert.match(html,/landing-schema\.js\?v=18/);
assert.match(studio,/landing-editor\.js\?v=27/);
assert.match(studio,/data-panel="landing"/);
assert.match(studio,/data-landing-tab="universe"/);
assert.match(studio,/data-landing-tab="languages"/);

for(const tab of ['hero','artists','releases','genres','about','publish'])
 assert.match(studio,new RegExp('data-landing-tab="'+tab+'"'));
// RUN-098 regression: Firestore write allowlists must track every safe
// top-level field emitted by the current landing schema. No private fields.
const expectedLandingFields=Object.keys(def).sort();
const contentAllowlists=[...rules.matchAll(
 /request\.resource\.data\.content\.keys\(\)\.has(?:Only|All)\(\[([\s\S]*?)\]\)/g
)];
assert.equal(contentAllowlists.length,2,'Expected exactly two public landing field allowlists');
for(const [,list] of contentAllowlists){
 const actual=[...list.matchAll(/'([^']+)'/g)].map(x=>x[1]).sort();
 assert.deepEqual(actual,expectedLandingFields,'Landing Firestore allowlist and schema must stay synchronized');
}
assert.match(rules,/content\.albums is map/,'Album section must be a map');
assert.match(rules,/content\.albums\.entries is list/,'Album entries must be a list');
assert.match(rules,/content\.albums\.entries\.size\(\) <= 8/,'Album entries limited to 8');

assert.match(rules,/match \/vmm_public_drafts\/\{pageId\}/);
assert.match(rules,/match \/vmm_public_pages\/\{pageId\}/);
assert.match(rules,/allow get: if pageId == 'landing'/);
assert.match(rules,/resource\.data\.status == 'published'/);
assert.match(rules,/studioAdmin\(\)\s*\|\|/,'Owner can read landing document before initial publication');
assert.match(rules,/resource != null/,'Unauthenticated read must require an existing published resource');
assert.match(rules,/allow list, delete: if false;/);
assert.match(rules,/allow read, write: if false;/);

const assistant=def.genres.assistant;
assert.equal(assistant.quickTopics.length,4);
assert.equal(assistant.typing.enabled,true);
assert.equal(assistant.typing.speedMs,35);
assert.equal(assistant.favoriteSongTitle,'Velar Superstar');
assert.equal(assistant.labels.launcher,'Помощник VELAR');
assert.equal(assistant.labels.privacy,'Не сохраняем и не отправляем автору');
assert.equal(assistant.avatars.reactions.heart,'heart');
assert.equal(assistant.avatars.keywordRules.length,0);
assert.equal(assistant.avatars.customImages.length,2);
const legacy={...def,genres:{...def.genres,assistant:{enabled:true,greetingEnabled:true,
 title:'Старый бот',welcome:'Привет из старой версии!',contactEmail:'',rules:[]}}};
const migrated=api.normalize(legacy).genres.assistant;
assert.equal(migrated.labels.greetingBubble,'Привет из старой версии!');
assert.equal(migrated.quickTopics.length,4);
assert.equal(migrated.typing.enabled,true,'Older published configs gain default typing');
assert.equal(migrated.favoriteSongTitle,'Velar Superstar','Old published assistants receive editorial favorite without migration');
assert.equal(migrated.avatars.greeting,'auto');
const ownerConfig={...assistant,
 labels:{...assistant.labels,privacy:'',submit:'Отправить'},
 quickTopics:[{label:'Север',query:'природа'}],
 avatars:{...assistant.avatars,greeting:'night',reactions:{...assistant.avatars.reactions,
  heart:'wave'},keywordRules:[{keywords:'счастье,тепло',source:'answer',expression:'heart'}]}};
const normalized=api.normalize({...def,genres:{...def.genres,assistant:ownerConfig}}).genres.assistant;
assert.equal(normalized.labels.privacy,'');
assert.equal(normalized.labels.submit,'Отправить');
assert.equal(normalized.quickTopics[0].query,'природа');
const noTyping=api.normalize({...def,genres:{...def.genres,assistant:{...assistant,typing:{enabled:false,speedMs:80}}}}).genres.assistant;
assert.equal(noTyping.typing.enabled,false);
assert.equal(noTyping.typing.speedMs,80);
assert.equal(normalized.avatars.greeting,'night');
assert.equal(normalized.avatars.reactions.heart,'wave');
assert.equal(normalized.avatars.keywordRules[0].source,'answer');
function invalidAssistant(patch){
 return api.normalize({...def,genres:{...def.genres,assistant:{...assistant,...patch}}});
}
assert.throws(()=>invalidAssistant({typing:{enabled:true,speedMs:1}}),/15 до 90/);
assert.throws(()=>invalidAssistant({typing:{enabled:true,speedMs:100}}),/15 до 90/);
assert.throws(()=>invalidAssistant({typing:{enabled:true,speedMs:'35'}}),/15 до 90/);
assert.throws(()=>invalidAssistant({quickTopics:Array(13).fill({label:'Тема',query:'музыка'})}),/12/);
assert.throws(()=>invalidAssistant({quickTopics:[{label:' ',query:'музыка'}]}),/обязательно/);
assert.throws(()=>invalidAssistant({labels:{...assistant.labels,submit:'x'.repeat(41)}}),/40/);
assert.throws(()=>invalidAssistant({favoriteSongTitle:'x'.repeat(115)}),/110/);
assert.throws(()=>invalidAssistant({replies:{...assistant.replies,hello:'x'.repeat(501)}}),/500/);
assert.throws(()=>invalidAssistant({avatars:{...assistant.avatars,launcher:'remote-url'}}),/Аватар/);
assert.throws(()=>invalidAssistant({avatars:{...assistant.avatars,keywordRules:Array(21).fill({keywords:'любовь',source:'question',expression:'heart'})}}),/20/);
assert.throws(()=>invalidAssistant({avatars:{...assistant.avatars,keywordRules:[{keywords:'любовь',source:'invalid',expression:'heart'}]}}),/где искать/);
assert.throws(()=>invalidAssistant({avatars:{...assistant.avatars,customImages:[
 {name:'Небезопасный',dataUrl:'data:image/svg+xml,<svg onload=alert(1)>'},
 {name:'Второй',dataUrl:''}]}}),/JPEG/);
assert.throws(()=>invalidAssistant({avatars:{...assistant.avatars,customImages:[
 {name:'Слишком большой',dataUrl:'data:image/jpeg;base64,'+'A'.repeat(25000)},
 {name:'Второй',dataUrl:''}]}}),/JPEG/);
const validJPEG='data:image/jpeg;base64,'+'A'.repeat(300);
assert.equal(api.normalize({...def,genres:{...def.genres,assistant:{...assistant,
 avatars:{...assistant.avatars,customImages:[
 {name:'Новая аватарка',dataUrl:validJPEG},{name:'Вторая',dataUrl:''}]}}}}).genres.assistant.avatars.customImages[0].dataUrl,validJPEG);

console.log('PASS: curated landing schema, private field stripping, only HTTPS public links, precise public read and admin-only draft rules');
