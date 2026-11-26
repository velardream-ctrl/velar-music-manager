const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={};const context={window,Array,String,Number,Object,JSON,Math,Error,Date};
vm.runInNewContext(fs.readFileSync('landing-schema.js','utf8'),context);
vm.runInNewContext(fs.readFileSync('song-stories.js','utf8'),context);
const api=window.VMM_LANDING_SCHEMA,d=api.defaults(),url='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
assert.equal(api.normalize(d).hero.palette,'amethyst');d.hero.palette='classic';d.hero.skin='compact';assert.equal(api.normalize(d).hero.palette,'classic');assert.equal(api.normalize(d).hero.skin,'compact');
const t={title:'Друг',artist:'Velar',provider:'spotify',url};d.genres.topics.entries.find(x=>x.slug==='friendship').tracks=[t];d.hero.songStories.entries=[{url,description:'История о собаке',keywords:'собака',lyrics:'PRIVATE'}];
const v=api.normalize(d);assert.equal(v.hero.songStories.entries[0].lyrics,undefined);assert.equal(window.VELAR_STORIES.lookup(v,'собака')[0].song.title,'Друг');assert.equal(window.VELAR_STORIES.answer('Песня о собаке',v).actions[0].target,'#song-stories');v.hero.songStories.mode='off';assert.equal(window.VELAR_STORIES.answer('Песня о собаке',v),null);d.hero.songStories.entries=[{url:'https://example.com/private',description:'bad'}];assert.throws(()=>api.normalize(d));console.log('PASS: independent palette, safe public stories and assistant lookup');
