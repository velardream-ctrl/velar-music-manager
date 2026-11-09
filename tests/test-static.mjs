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
const homepage = read('index.html');
assert.match(homepage, /<h1[^>]*id="hero-title"/);
assert.match(homepage, /assets\/velardream-crystal\.png/);
assert.ok(fs.statSync(path.join(root, 'assets/velardream-crystal.png')).size > 10000, 'Missing transparent emblem');
assert.ok(fs.statSync(path.join(root, 'assets/velardream-crystal.png')).size < 120000, 'Emblem too heavy');
assert.match(homepage, /<h1 class="hero-title" id="hero-title"><span class="brand-main">VELARDREAM<\/span><span class="brand-records">RECORDS<\/span><\/h1>/);
assert.ok(!homepage.includes('Музыкальный мир VELARDREAM RECORDS'), 'Duplicate hero text');
assert.ok(!homepage.includes('<img class="hero-logo"'), 'The old combined logo should no longer render');
for (const section of ['artists', 'releases', 'genres', 'about']) {
  assert.ok(homepage.includes('id="' + section + '"'), 'Missing section ' + section);
  assert.ok(homepage.includes('href="#' + section + '"'), 'Missing navigation to ' + section);
}
assert.match(homepage, /<meta name="description"/);
assert.match(homepage, /alt="" fetchpriority="high"/);
const sw = read('sw.js');
assert.match(sw, /CACHE_PREFIX/);
assert.match(sw, /isPublicAsset/);
assert.match(sw, /velardream-crystal\.png/);
assert.match(sw, /CACHE_PREFIX \+ 'v4'/);
const css = read('style.css');
assert.match(css, /\.art-wrap\{max-width:280px;width:100%;margin:6px auto 18px;/);
assert.match(css, /\.art-wrap\{max-width:185px;margin:4px auto 16px/);
assert.ok(!css.includes('margin:-12px auto -30px') && !css.includes('margin:-12px auto -32px'), 'Logo must not overlap title');
assert.match(homepage, /max-width:185px;margin:4px auto 16px/);
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
