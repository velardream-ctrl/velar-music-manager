/* RUN-182: exact-ID existing-link reconciliation; never search web or write DB. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),moduleSource=read('studio/existing-links-reconcile.js');
const w={};vm.runInNewContext(schema,{window:w},{timeout:1000});
vm.runInNewContext(moduleSource,{window:w},{timeout:1000});
const api=w.VMM_LANDING_SCHEMA,reconcile=w.VMM_EXISTING_LINKS;
assert.ok(reconcile&&typeof reconcile.audit==='function');
const spotify='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const youtube='https://www.youtube.com/watch?v=ABCDEFGHIjk';
const youtubeShort='https://youtu.be/ABCDEFGHIjk';
const apple='https://music.apple.com/fi/album/test/1234567890?i=1234567891';
const catalog=[
 {id:'track-1',title:'Звёзды',artist:'Velar',links:{spotify,youtube:youtubeShort,appleMusic:apple}},
 {id:'track-2',title:'Другая песня',artist:'Velar',links:{youtube:'https://youtu.be/ZYXWVUTSRQP'}}
];
const page=api.defaults();page.artists.cards=[{
 title:'Velar',visible:true,featuredTracks:[{title:'Звёзды',provider:'youtube',url:youtube}],
 biography:'',socialLinks:[]
}];
page.genres.topics.entries[0].tracks=[{title:'Звёзды',artist:'Velar',provider:'youtube',url:youtube}];
page.genres.languages.entries[0].tracks=[{title:'Звёзды',artist:'Velar',provider:'spotify',url:spotify}];
page.albums.entries=[{id:'test-album',title:'Тест',artist:'Velar',visible:true,tracks:[
 {title:'Звёзды',artist:'Velar',provider:'spotify',url:spotify}]}];
const original=JSON.stringify(page);
const result=reconcile.audit(page,catalog,api);
assert.equal(JSON.stringify(page),original,'Audit never mutates original public draft');
assert.equal(result.summary.catalogSongs,2);
assert.equal(result.summary.addedSongs,4);
assert.equal(result.summary.addedLinks,8);
assert.equal(result.summary.unmatched,0);
assert.equal(result.summary.conflict,0);
const featured=result.next.artists.cards[0].featuredTracks[0];
assert.equal(featured.provider,'youtube','Primary source remains unchanged');
assert.equal(featured.alternateProvider,'spotify');
assert.equal(featured.thirdProvider,'appleMusic');
const topic=result.next.genres.topics.entries[0].tracks[0];
assert.equal(topic.alternateProvider,'spotify');
assert.equal(topic.thirdProvider,'appleMusic');
const fresh=reconcile.audit(result.next,catalog,api);
assert.equal(fresh.summary.addedLinks,0,'Reconciliation is idempotent');
// Two catalog rows sharing one Spotify song => never guess or merge.
const collision=reconcile.audit(page,[...catalog,
 {id:'track-3',title:'Другой дубль',artist:'Crazy Bobr',links:{youtube}}],api);
assert.ok(collision.summary.ambiguous>=2);
assert.equal(collision.next.genres.topics.entries[0].tracks[0].alternateUrl,undefined);
// Existing conflicting secondary platform URL must not be overwritten.
const conflicting=api.defaults();
conflicting.genres.topics.entries[0].tracks=[{
 title:'Звёзды',artist:'Velar',provider:'spotify',url:spotify,
 alternateProvider:'youtube',alternateUrl:'https://www.youtube.com/watch?v=ZYXWVUTSRQP'
}];
const cf=reconcile.audit(conflicting,catalog,api);
assert.equal(cf.summary.ambiguous,1);
assert.equal(cf.summary.addedLinks,0);
// No fuzzy title matching without a verified original source.
const noUrl=api.defaults();noUrl.genres.topics.entries[0].tracks=[{
 title:'Звёзды',artist:'Velar',provider:'youtube',url:'https://youtu.be/ASDFGHJKL01'
}];
assert.equal(reconcile.audit(noUrl,catalog,api).summary.addedLinks,0);
assert.match(read('studio/landing-editor.js'),/Перенести точные совпадения в черновик/);
assert.match(read('studio/landing-editor.js'),/source:'server'/);
assert.match(read('studio/index.html'),/existing-links-reconcile\.js\?v=1/);
console.log('PASS RUN-182: conservative exact-ID link recovery, 3 sources, topic/language/album/artist, ambiguity, idempotence and no silent writes');
