import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const c=read('studio/ai-public-catalog.js'),lab=read('studio/ai-lab.js');
new vm.Script(c);new vm.Script(lab);
const window={};
vm.runInNewContext(c,{window,Promise,Array,Object,RegExp,String,URL,Error,console});
const api=window.VELAR_AI_PUBLIC_CATALOG;
const good='https://open.spotify.com/track/0123456789012345678901';
const yt='https://www.youtube.com/watch?v=abcdefghijk';
const fake='https://evil.example/track/0123456789012345678901';
const draft={status:'draft',schemaVersion:1,content:{genres:{topics:{entries:[{visible:true,tracks:[{title:'Secret',provider:'spotify',url:good}]}]}}}};
assert.equal(api.extract(draft).length,0,'Drafts must never enter external context');
const pub={status:'published',schemaVersion:1,content:{
 genres:{
   entries:[{visible:false,label:'Private',tracks:[{title:'Hidden',provider:'spotify',url:good}]},
     {visible:true,label:'Любовь',tracks:[{title:'Сердце',artist:'Velar',provider:'spotify',url:good},
       {title:'Bad host',provider:'spotify',url:fake}]}],
   topics:{entries:[{visible:true,label:'Космос',tracks:[{title:'Космический сон',artist:'Velar',provider:'youtube',url:yt}]}]},
   languages:{entries:[{visible:false,label:'Unpublished',tracks:[{title:'No',provider:'youtube',url:yt}]}]}
 },
 artists:{cards:[{visible:true,title:'Velar',featuredTracks:[{title:'Сердце',provider:'spotify',url:good}]}]},
 albums:{entries:[{visible:false,title:'Unpublished album',tracks:[{title:'Hidden song',provider:'spotify',url:'https://open.spotify.com/track/0123456789012345678902'}]}]}
}};
const rows=api.extract(pub);
assert.equal(rows.length,2,'Only visible, validated, deduplicated public links');
assert.ok(rows.every(r=>r.url.startsWith('https://')));
assert.equal(rows[0].title,'Сердце');
assert.equal(api.official({title:'x',provider:'spotify',url:fake}),null);
assert.equal(api.shortlist(rows,'космос',4)[0].title,'Космический сон');
const msg=api.prompt('Что послушать про любовь?',rows);
assert.ok(msg.includes('ОПУБЛИКОВАННЫХ'));
assert.ok(msg.length<=500);
assert.ok(!msg.includes('spotify.com'),'No official URLs sent to external model');
assert.ok(!msg.includes('youtube.com'),'No official URLs sent to external model');
assert.match(lab,/catalogToggle\.checked/);
assert.match(lab,/source\.readPublished\(\)/);
assert.match(lab,/source\.shortlist\(rows,q,4\)/);
assert.match(lab,/source\.prompt\(q,choices\)/);
assert.match(lab,/a\.href=row\.url/);
assert.doesNotMatch(c,/collection\(['"]vmm_catalog['"]\)/);
assert.doesNotMatch(c,/collection\(['"]vmm_landing_drafts['"]\)/);
assert.match(c,/collection\('vmm_public_pages'\)/);
assert.match(read('studio/index.html'),/ai-public-catalog\.js\?v=1/);
assert.match(read('studio/index.html'),/ai-lab\.js\?v=5/);
assert.match(read('sw.js'),/catalog194/);
assert.doesNotMatch(read('index.html'),/ai-public-catalog/);
console.log('PASS RUN-194 published-only catalog recommendations, verified links, no private reads');