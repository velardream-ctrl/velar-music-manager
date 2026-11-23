// RUN-222: Suno prompts and lyric directions remain separate, private and offline-safe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const w={};
vm.runInNewContext(read('studio/suno-style-data.js'),{window:w,String,Array,Object,RegExp,Error}, {timeout:1500});
const h=w.VMM_SUNO_STYLE_DATA;
assert.ok(h);
const lyrics='[Verse 1]\nПривет, Миша!\n\n[Chorus: huge male choir, reverb]\nПою\n\n[Guitar Solo]\n[Bridge]\n[Female whisper]\n[Outro]';
assert.equal(h.extractCues(lyrics),
  '[Chorus: huge male choir, reverb]\n[Guitar Solo]\n[Female whisper]');
assert.equal(h.extractCues('[Verse 1]\n[Chorus]\n[Bridge]\n[Outro]'),'');
assert.equal(h.extractCues('ordinary [Verse] lyric'),'', 'Do not move inline literal brackets');
assert.equal(h.mergeCues('[Guitar Solo]','[Guitar Solo]\n[Female whisper]'),
  '[Guitar Solo]\n[Female whisper]');
assert.ok(h.equal({},h.fields({})));
assert.ok(h.equal({sunoStyle:'folk, baritone',styleVerdict:'unrated'},
  {sunoStyle:'folk, baritone'}));
assert.ok(!h.equal({sunoStyle:'folk'}, {sunoStyle:'rock'}));
assert.ok(!h.equal({sunoStyle:'folk'}, {sunoStyle:'folk',sunoCues:'[soft]'}));
assert.throws(()=>h.validate({sunoStyle:'x'.repeat(6001)}),/лимит/);
assert.throws(()=>h.validate({sunoCues:'x'.repeat(16001)}),/лимит/);
assert.throws(()=>h.validate({styleNotes:'x'.repeat(2401)}),/лимит/);
assert.equal(h.validate({sunoStyle:'dark pop',styleVerdict:'successful'}).styleVerdict,'successful');
assert.ok(h.fingerprint(' Dance   POP ')===h.fingerprint('dance pop'));
for(const path of ['studio/studio.js','studio/offline-lyrics-sync.js','studio/lyrics-tools.js','studio/style-library.js','sw.js'])
  assert.doesNotThrow(()=>new Function(read(path)),path);
const html=read('studio/index.html');
for(const id of ['lyric-suno-style-details','lyric-suno-style','lyric-suno-cues',
 'lyric-style-notes','lyric-style-verdict','style-library-search',
 'style-library-filter','style-library-results','style-library-export'])
  assert.ok(html.includes('id="'+id+'"'),'Missing form control '+id);
assert.match(html,/<details id="lyric-suno-style-details"/);
assert.match(html,/<details class="vmm-style-details vmm-style-library" id="vmm-style-library"/);
assert.match(html,/suno-style-data\.js\?v=222/);
assert.match(html,/lyrics-tools\.js\?v=5&styles=222/);
assert.match(html,/offline-lyrics-sync\.js\?v=2&styles=222/);
assert.match(html,/style-library\.js\?v=222/);
const core=read('studio/studio.js'),offline=read('studio/offline-lyrics-sync.js'),tools=read('studio/lyrics-tools.js'),
 library=read('studio/style-library.js'),rules=read('firestore.rules'),sw=read('sw.js');
assert.match(core,/sunoStyle:styleFields\.sunoStyle/);
assert.match(core,/styleHelper\(\)\.equal\(snapshot\.data\(\),baselineStyles\)/);
assert.match(core,/styles:stylesFromForm\(\),baseStyles:/);
assert.match(core,/styleLibraryData:function/);
assert.match(core,/openLyricStyle:function/);
assert.match(offline,/styles:styleHelper\(\)\.validate\(c\.styles\)/);
assert.match(offline,/styleHelper\(\)\.equal\(snapshot\.data\(\),beforeStyles\)/);
assert.match(offline,/sunoStyle:currentStyles\.sunoStyle/);
assert.match(offline,/styleHelper\(\)\.equal\(c\.styles,persistedStyles\)/);
assert.match(tools,/function archiveSunoDirections\(raw\)/);
assert.match(tools,/if\(!archiveSunoDirections\(original===undefined\?current:original\)\)return false/);
assert.match(tools,/if\(!archiveSunoDirections\(cleanOriginal\)\)return/);
assert.doesNotMatch(library,/collection\(|\bfetch\(|\bXMLHttpRequest\(|sendBeacon/);
assert.match(library,/studio\(\)\.styleLibraryData/);
assert.match(library,/JSON\.stringify\(pack/);
assert.match(rules,/match \/vmm_lyrics\/\{itemId\} \{ allow read, write: if studioAdmin\(\); \}/);
assert.match(sw,/studio\/suno-style-data\.js\?v=222/);
assert.match(sw,/studio\/style-library\.js\?v=222/);
assert.doesNotMatch(read('landing-public.js'),/sunoStyle|sunoCues|styleVerdict|styleNotes/);
console.log('RUN-222 PASS: Suno style preservation, private fields, offline conflicts, library and PWA');
