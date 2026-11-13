/* RUN-108: pure and conservative three-way merge of conflicting landing drafts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const apiSrc=read('landing-schema.js');
const src=read('studio/landing-merge.js');
new vm.Script(src);
const window={};
vm.runInNewContext(apiSrc,{window,Array,String,Object,JSON,Number,Error},{timeout:1000});
vm.runInNewContext(src,{window,Array,String,Object,JSON,Number,Error},{timeout:1000});
const api=window.VMM_LANDING_SCHEMA,merge=window.VMM_LANDING_MERGE.threeWay;
const base=JSON.parse(JSON.stringify(api.normalize(api.defaults())));
function topic(slug,label){return {slug,label,description:'',visible:false,tracks:[]};}
const local=JSON.parse(JSON.stringify(base));
local.genres.topics.entries.push(topic('meditation','Медитация'));
const remote=JSON.parse(JSON.stringify(base));
remote.hero.intro='Изменения облака в описании главной страницы';
const result=merge(base,local,remote);
assert.equal(result.conflicts.length,0);
assert.equal(result.value.hero.intro,remote.hero.intro,
 'Remote hero changes must survive local topic creation');
assert.equal(result.value.genres.topics.entries.length,base.genres.topics.entries.length+1);
assert.equal(result.value.genres.topics.entries.at(-1).slug,'meditation');
assert.equal(remote.genres.topics.entries.some(t=>t.slug==='meditation'),false,'Merge must never mutate cloud data');
assert.equal(local.hero.intro,base.hero.intro,'Merge must never mutate local data');
const local2=JSON.parse(JSON.stringify(local));
local2.genres.topics.entries.at(-1).label='Медитация и отдых';
const remote2=JSON.parse(JSON.stringify(remote));
remote2.genres.topics.entries.push(topic('meditation','Другая тема'));
const overlap=merge(base,local2,remote2);
assert.ok(overlap.conflicts.some(x=>x.includes('meditation')),
 'Same new topic slug modified differently is a conflict; never overwrite');
const editOne=JSON.parse(JSON.stringify(base)),editOther=JSON.parse(JSON.stringify(base));
editOne.genres.topics.entries[0].description='Локальный комментарий';
editOther.genres.topics.entries[0].visible=true;
const independent=merge(base,editOne,editOther);
assert.equal(independent.conflicts.length,0,'Different fields of same topic merge safely');
assert.equal(independent.value.genres.topics.entries[0].description,'Локальный комментарий');
assert.equal(independent.value.genres.topics.entries[0].visible,true);
const conflictingA=JSON.parse(JSON.stringify(base)),conflictingB=JSON.parse(JSON.stringify(base));
conflictingA.genres.topics.entries[0].label='Одно название';
conflictingB.genres.topics.entries[0].label='Другое название';
assert.ok(merge(base,conflictingA,conflictingB).conflicts.some(x=>x.includes('.label')));
const differentLocales=JSON.parse(JSON.stringify(base));
differentLocales.genres.languages.entries.push({
 code:'newfictional',label:'Новый',fictional:true,visible:false,tracks:[]});
assert.equal(merge(base,differentLocales,remote).value.genres.languages.entries.length,
 base.genres.languages.entries.length+1);
const listA=JSON.parse(JSON.stringify(base)),listB=JSON.parse(JSON.stringify(base));
listA.genres.tags=['Опера','Новый'];
listB.genres.tags=['Поп','Ещё один'];
assert.ok(merge(base,listA,listB).conflicts.includes('genres.tags'),
 'Unkeyed list changes are blocked rather than guessed');
const html=read('studio/index.html'),editor=read('studio/landing-editor.js');
assert.ok(html.includes('id="landing-merge-offline"'));
assert.ok(html.indexOf('landing-merge.js')<html.indexOf('landing-editor.js'),
 'Pure merge helper must be loaded before owner editor');
assert.match(editor,/function reconcileOffline\(\)/);
assert.match(editor,/VMM_LANDING_MERGE\.threeWay/);
assert.match(editor,/runTransaction/);
assert.match(editor,/offlineStore\.acknowledge\(account,pendingName\(\),nonce\)/);
assert.match(editor,/showOfflineConflict\(true\)/);
const css=read('style.css');
assert.match(css,/\.public-song-inline:not\(:empty\) \.spotify-embed-viewport\{/);
assert.match(css,/height:152px/);
assert.match(css,/\.public-song-inline:not\(:empty\) \.cms-release-close\{[\s\S]*?top:4px/);
console.log('PASS RUN-108: safe three-way keyed merge, overlap refusal, preserved offline copy, compact Spotify and top close controls');