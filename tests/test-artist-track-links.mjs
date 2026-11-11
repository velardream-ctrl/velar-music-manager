import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const choiceSource=read('studio/artist-choices.js'),linkSource=read('studio/artist-track-links.js');
const editor=read('studio/landing-editor.js'),studio=read('studio/index.html'),workflows=read('studio/workflows.js'),
 schema=read('landing-schema.js'),rules=read('firestore.rules'),sw=read('sw.js');
const window={};
const firebase={firestore:{FieldValue:{serverTimestamp(){return 'SERVER_TIME';}}}};
vm.runInNewContext(choiceSource,{window,Math,String,Object,Array,Error},{timeout:1000});
vm.runInNewContext(linkSource,{window,firebase,navigator:{onLine:true},Math,String,Object,Array,Promise,Error},{timeout:1000});
const choice=window.VMM_ARTIST_CHOICES,link=window.VMM_ARTIST_TRACKS;
const tracks=[
 {id:'trackA',title:'Белая берёза',artist:'Velar'},
 {id:'trackB',title:'Бобр пришёл',artist:'Velar'},
 {id:'trackC',title:'Полёт',artist:'Ilya Dmitriev'},
 {id:'trackD',title:'Песенка',artist:'Илья Дмитриев'},
 {id:'trackE',title:'Шутка',artist:'Crazy Bobr'},
 {id:'trackF',title:'Ещё один трек',artist:'Новый артист'}
];
const options=choice.choices(tracks);
assert.equal(options[0].id,'velar');
assert.equal(options[0].label,'DJ Velar');
assert.equal(options[0].count,2);
assert.equal(options[1].id,'ilya-dmitriev');
assert.equal(options[1].count,2);
assert.equal(options[2].id,'crazy-bobr');
assert.equal(options[2].count,1);
assert.equal(options[3].label,'Новый артист');
assert.equal(choice.newCard(options[2]).visible,false);
assert.equal(choice.newCard(options[2]).artistId,'crazy-bobr');
assert.equal(choice.inferredId('VELAR'),'velar');
assert.equal(choice.inferredId('Ilya Dmitriev'),'ilya-dmitriev');
assert.equal(choice.inferredId('Илья Дмитриев'),'ilya-dmitriev');
assert.equal(link.effective(tracks[1],{}),'velar');
assert.equal(link.effective(tracks[4],{}),'crazy-bobr');
const moved=link.apply({},'crazy-bobr',['trackB','trackE'],tracks);
assert.equal(moved.trackB,'crazy-bobr');
assert.equal(link.effective(tracks[1],moved),'crazy-bobr');
assert.equal(link.effective(tracks[0],moved),'velar');
assert.equal(link.effective(tracks[2],moved),'ilya-dmitriev');
assert.equal(moved.trackE,undefined,'Native Crazy Bobr credits do not require overrides');
const issue=link.conflicts({},'crazy-bobr',['trackB'],tracks);
assert.equal(issue.length,1);
assert.equal(issue[0].previous,'velar');
const fromCrazy=link.apply(moved,'crazy-bobr',['trackE'],tracks);
assert.equal(fromCrazy.trackB,undefined,'Releasing manually assigned song restores original Velar attribution');
const fromVelar=link.apply({},'velar',['trackA'],tracks);
assert.equal(fromVelar.trackB,'unassigned','Unchecking an inferred Velar song must not resurrect it');
assert.equal(link.effective(tracks[1],fromVelar),'');
assert.throws(()=>link.apply({},'crazy-bobr',['unknown'],tracks),/отсутствующая/);
assert.throws(()=>link.apply({},'crazy-bobr',['trackB'],[{id:'trackB'},{id:'trackB'}]),/Повторяющийся/);
const dbState=new Map(),calls=[];
const db={
 collection(name){calls.push(name);return {doc(id){
   assert.equal(name,'vmm_links');assert.equal(id,'artist_track_assignments_v1');
   return {id,get(){return Promise.resolve({exists:dbState.has(id),data(){return dbState.get(id);}});}};
 }};},
 runTransaction(callback){
   const writes=[];
   const tx={get(ref){return Promise.resolve({exists:dbState.has(ref.id),data(){return dbState.get(ref.id);}});},
     set(ref,data){writes.push({ref,data});}};
   return Promise.resolve().then(()=>callback(tx)).then(result=>{
     writes.forEach(w=>dbState.set(w.ref.id,w.data));return result;
   });
 }
};
const initial=await link.read(db);
assert.equal(initial.revision,0);
const saved=await link.save(db,'owner123','crazy-bobr',['trackB','trackE'],tracks,0);
assert.equal(saved.revision,1);
assert.equal(saved.overrides.trackB,'crazy-bobr');
assert.equal(dbState.get(link.documentId).updatedBy,'owner123');
assert.equal(dbState.get(link.documentId).updatedAt,'SERVER_TIME');
assert.equal(calls.every(x=>x==='vmm_links'),true,'No catalog writes or public documents');
await assert.rejects(link.save(db,'owner123','velar',['trackA'],tracks,0),/другом окне/);
assert.equal(dbState.get(link.documentId).revision,1);
const next=await link.save(db,'owner123','ilya-dmitriev',['trackC','trackD'],tracks,1);
assert.equal(next.overrides.trackB,'crazy-bobr','Other artist assignments are preserved');
assert.equal(next.revision,2);
const stateString=JSON.stringify(dbState.get(link.documentId));
assert.doesNotMatch(stateString,/UPC|ISRC|spotify|flac|secret|lyrics/);
assert.match(editor,/Назначить песни/);
assert.match(editor,/trackEditor\(/);
assert.match(editor,/loadTrackLinks|VMM_ARTIST_TRACKS\.read/);
assert.match(editor,/VMM_ARTIST_TRACKS\.save/);
assert.match(workflows,/d\.id==='artist_track_assignments_v1'/);
assert.match(studio,/artist-track-links\.js\?v=1/);
assert.match(studio,/artist-choices\.js\?v=1/);
assert.match(sw,/STUDIO_PREFIX\+'v24'/);
assert.match(rules,/match \/vmm_links\/\{itemId\}/);
assert.match(schema,/artistId/);
console.log('PASS: three canonical artists, private overrides, checkbox reassignment, optimistic concurrency, no original catalog writes');
