import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname), '..');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
const assets = ['index.html', 'app/index.html','style.css','main.js','sw.js','manifest.webmanifest','favicon.svg'];
for (const file of assets) assert.ok(read(file).length > 50, `Missing ${file}`);
assert.equal(read('CNAME').trim(), 'velardream.com');
assert.match(read('index.html'), /<meta name="robots" content="noindex/);
assert.match(read('app/index.html'), /<meta name="robots" content="noindex/);
assert.match(read('index.html'), /lang="ru"/);
assert.ok(!read('index.html').includes('google.script.run'));
const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url, './');
for (const icon of manifest.icons) {
  assert.ok(fs.statSync(path.join(root, icon.src)).size > 100, 'Missing icon ' + icon.src);
}
const sw = read('sw.js');
assert.match(sw, /CACHE_PREFIX/);
assert.match(sw, /isPublicAsset/);
assert.ok(!sw.includes('cache.put(req, response)'), 'Never cache unfiltered responses');
assert.match(read('firestore.rules'), /allow read, write: if false;/);
for (const file of ['index.html','app/index.html','style.css','main.js','sw.js','manifest.webmanifest','favicon.svg']) {
  const content = read(file);
  assert.ok(!/apiKey\s*[:=]|private_key|BEGIN PRIVATE KEY|velardream@gmail\.com|docs\.google\.com\/spreadsheets/i.test(content), `Potential private data in ${file}`);
}
for (const file of ['index.html', 'app/index.html']) {
  const html = read(file);
  const base = path.dirname(file);
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (match[1].startsWith('http') || match[1].startsWith('#')) continue;
    const target = path.join(root, base, match[1].split('#')[0]);
    if (match[1] === '../') continue;
    assert.ok(fs.existsSync(target), `${file} -> broken ${match[1]}`);
  }
}
console.log('PASS: safe public shell, noindex, manifest, static assets, deny-all Firestore rules, links and domain');
