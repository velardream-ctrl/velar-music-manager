// RUN-213. Static integration and privacy guard for the MP3 conversion utility.
// Browser/codec and old Safari runtime tests remain separate and are NOT claimed here.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const page = readFileSync(join(root, 'mp3-converter/index.html'), 'utf8');
const home = readFileSync(join(root, 'index.html'), 'utf8');
const navigation = readFileSync(join(root, 'site-navigation-catalog.js'), 'utf8');

assert.match(page, /<title>Бесплатный MP3-конвертер/);
assert.match(page, /type="file"/);
assert.match(page, /accept="audio\/\*/);
assert.match(page, /new window\.lamejs\.Mp3Encoder/);
assert.match(page, /decodeAudioData/);
assert.match(page, /new Blob\(chunks,\{type:'audio\/mpeg'\}\)/);
assert.match(page, /URL\.createObjectURL\(blob\)/);
assert.match(page, /URL\.revokeObjectURL\(objectUrl\)/);
assert.match(page, /reader\.readAsArrayBuffer\(file\)/);
assert.match(page, /value="128"/);
assert.match(page, /value="192" checked/);
assert.match(page, /value="320"/);
assert.match(page, /cdn\.jsdelivr\.net\/npm\/lamejs@1\.2\.1\/lame\.min\.js/);
assert.doesNotMatch(page, /XMLHttpRequest\s*\(|\bfetch\s*\(|\bFormData\s*\(|\.upload\s*\(/);
assert.doesNotMatch(page, /firebase(?:js)?|firestore|gstatic\.com/);
assert.match(home, /href="\/mp3-converter\/">MP3-конвертер/);
assert.match(navigation, /has\('\/mp3-converter\/'\)/);
assert.match(navigation, /querySelector\('\.site-footer'\)/);
console.log('RUN-213: MP3 converter static integration and privacy checks passed');
