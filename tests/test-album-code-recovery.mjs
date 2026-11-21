import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const editor = readFileSync(new URL('../studio/landing-editor.js', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../studio/index.html', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../landing-schema.js', import.meta.url), 'utf8');

new vm.Script(editor, {filename:'studio/landing-editor.js'});
assert.match(studio,/landing-editor\.js\?v=50&fix=album-code/);
assert.match(editor,/albumCodeInput\.value=fixed/);
assert.match(editor,/updateAlbumCodeHint\(\)/);
assert.match(editor,/recoverLocal\(\)/);
assert.match(schema,/\^\[a-z0-9-\]\{2,55\}\$/);

const start = editor.indexOf(' function cleanAlbumCode(value){');
const end = editor.indexOf(' function recoverLocal(){', start);
assert.ok(start >= 0 && end > start);
const helpers = editor.slice(start, end);
const sandbox = {
  clone:x=>JSON.parse(JSON.stringify(x)),
  API:{
    normalize(raw){
      const used = new Set();
      for(const entry of raw.albums.entries){
        if(!/^[a-z0-9-]{2,55}$/.test(entry.id))throw new Error('Invalid album code');
        if(used.has(entry.id))throw new Error('Duplicate album ID');
        used.add(entry.id);
      }
      return raw;
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(helpers,sandbox);

assert.equal(vm.runInContext("cleanAlbumCode('igristaja_vesna')", sandbox), 'igristaja-vesna');
assert.equal(vm.runInContext("cleanAlbumCode('  my_album   2026 ')", sandbox), 'my-album-2026');
assert.equal(vm.runInContext("cleanAlbumCode('my-album')", sandbox), 'my-album');
sandbox.sample = {albums:{entries:[{id:'igristaja_vesna'},{id:'album-1'}]}};
const recovered = vm.runInContext('normalizeWithLinkCapacity(sample)', sandbox);
assert.equal(recovered.albums.entries[0].id,'igristaja-vesna');
assert.equal(sandbox.sample.albums.entries[0].id,'igristaja_vesna',
  'Original local copy must remain untouched');
sandbox.sampleCollision={albums:{entries:[{id:'abc_def'},{id:'abc-def'}]}};
assert.throws(()=>vm.runInContext('normalizeWithLinkCapacity(sampleCollision)',sandbox),/Duplicate album ID/,
  'Never silently overwrite album with colliding slug');
console.log('PASS: Studio repairs album underscore safely, preserves offline copy, rejects collisions.');
