import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function stub(){return {className:'',textContent:'',style:{},firstChild:null,appendChild(){},insertBefore(){},setAttribute(){},addEventListener(){},getAttribute(){return null;},querySelector(){return null;}};}
function loadWorkflows(){
  const source=read('studio/workflows.js');
  assert.match(source,/\}\(\)\);\s*$/);
  const altered=source.replace(/\}\(\)\);\s*$/,"window.__test={direct:direct,normalized:normalized,spotifyAlbum:spotifyAlbum,pending:pending};}());");
  const shell=stub(),side=stub();
  const doc={querySelector(x){if(x==='.workspace-content')return shell;if(x==='#workspace .sidebar')return side;return null;},querySelectorAll(){return [];},createElement(){return stub();},getElementById(){return null;}};
  const ctx={document:doc,window:{},Object,Array,Promise,String,Number,Math,parseInt,isFinite,encodeURIComponent};
  vm.runInNewContext(altered,ctx,{timeout:1000});
  return ctx.window.__test;
}
function loadLyrics(){
  const source=read('studio/lyrics-tools.js');
  assert.match(source,/\}\(\)\);\s*$/);
  const altered=source.replace(/\}\(\)\);\s*$/,"window.__test={cleanSuno:cleanSuno,heading:heading,printRows:printRows,documentHTML:documentHTML};}());");
  const nodes={};
  function elem(){return {value:'',className:'',innerHTML:'',parentNode:{parentNode:{insertBefore(){}},nextSibling:null},addEventListener(){},setAttribute(){},style:{}};}
  const form=elem();form.elements={title:{value:'Тестовая песня',addEventListener(){}},language:{value:'Русский'},version:{value:'Основная'}};
  const body=elem();
  const doc={getElementById(k){if(k==='lyric-form')return form;if(k==='lyric-body')return body;return nodes[k]||(nodes[k]=elem());},createElement(){return elem();}};
  const ctx={document:doc,window:{addEventListener(){}},Event:function(){},String,Array,Promise,Number,Math};
  vm.runInNewContext(altered,ctx,{timeout:1000});
  return ctx.window.__test;
}
const w=loadWorkflows();
assert.ok(w.direct('spotify','https://open.spotify.com/track/6Ti53MNZfQirZoZFcyDzpJ'));
assert.ok(!w.direct('spotify','https://open.spotify.com/album/6Ti53MNZfQirZoZFcyDzpJ'));
assert.ok(!w.direct('spotify','https://open.spotify.com/search/dj'));
assert.ok(w.spotifyAlbum('https://open.spotify.com/album/6Ti53MNZfQirZoZFcyDzpJ'));
assert.ok(w.direct('youtube','https://youtu.be/2P5GrU_lE2k'));
assert.ok(w.direct('youtube','https://www.youtube.com/watch?v=2P5GrU_lE2k'));
assert.equal(w.normalized('youtube','https://youtu.be/2P5GrU_lE2k'),w.normalized('youtube','https://www.youtube.com/watch?v=2P5GrU_lE2k'));
assert.ok(w.direct('appleMusic','https://music.apple.com/fi/album/test/1234?i=5678'));
assert.ok(!w.direct('appleMusic','https://music.apple.com/fi/album/test/1234'));
assert.equal(w.normalized('appleMusic','https://music.apple.com/fi/album/x/123?i=1234'),w.normalized('appleMusic','https://music.apple.com/fi/album/y/987?i=1234'));
assert.notEqual(w.normalized('appleMusic','https://music.apple.com/fi/album/x/123?i=1234'),w.normalized('appleMusic','https://music.apple.com/fi/album/x/123?i=5678'));
assert.ok(w.pending({status:'Ожидает подтверждения'}));
assert.ok(!w.pending({status:'Подтверждено'}));
const l=loadLyrics();
assert.equal(l.heading('Verse 2: male vocal'),'Куплет 2');
assert.equal(l.heading('Final Chorus'),'Финальный припев');
const clean=l.cleanSuno('[Verse 2: Male vocals]\nЯ люблю эту песню!\n[Instrumental break]\n[Chorus]\nЛа-ла-ла!');
assert.match(clean.text,/\*\*Куплет 2\*\*/);
assert.match(clean.text,/Я люблю эту песню!/);
assert.match(clean.text,/\*\*Припев\*\*/);
assert.match(clean.text,/Ла-ла-ла!/);
assert.ok(!clean.text.includes('Male vocals'));
assert.ok(clean.removed>=3);
const rendered=l.printRows('**Куплет 1**\nДве строки\nдля печати');
assert.match(rendered,/Две строки<br>для печати/);
assert.match(rendered,/<h2>Куплет 1<\/h2>/);
const html=l.documentHTML('**Куплет 1**\nСтрока',14,true);
assert.match(html,/column-count:2/);assert.match(html,/@page\{size:A4/);assert.match(html,/print-action/);
console.log('PASS: direct URL validation, YouTube/Apple IDs, status, Suno cleanup and A4 rendering');