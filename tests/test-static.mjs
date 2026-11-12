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
assert.match(sw, /CACHE_PREFIX \+ 'v36'/);
const css = read('style.css');
assert.ok(homepage.includes('class="brand-emblem brand-emblem-header"'), 'Header emblem missing');
assert.ok(homepage.includes('class="brand-emblem brand-emblem-footer"'), 'Footer emblem missing');
assert.ok(!homepage.includes('>◇</span>') && !homepage.includes('>◇ <span>'), 'Old diamonds remain');
assert.ok(homepage.includes('assets/velardream-symbol.svg'), 'Vector emblem is not referenced');
assert.ok(read('favicon.svg').includes('VELARDREAM'), 'Crystal favicon missing');
assert.ok(!css.includes('.mini-mark{'), 'Old diamond CSS present');
assert.match(css, /\.art-wrap\{max-width:315px;width:100%;margin:-8px auto 12px;/);
assert.match(css, /\.art-wrap\{max-width:215px;margin:-5px auto 12px/);
assert.ok(!css.includes('margin:-12px auto -30px') && !css.includes('margin:-12px auto -32px'), 'Logo must not overlap title');
assert.match(homepage, /href="style\.css\?v=30"/);
assert.match(sw, /url\.pathname\.slice\(-10\) === '\/style\.css'/);
assert.match(sw, /'\.\/style\.css\?v=30'/);
assert.match(homepage, /max-width:215px!important;margin:-5px auto 12px!important/);
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
    const target = path.join(root, base, match[1].split(/[?#]/)[0]);
    if (match[1] === '../') continue;
    assert.ok(fs.existsSync(target), `${file} -> broken ${match[1]}`);
  }
}
console.log('PASS: safe public shell, noindex, manifest, static assets, deny-all Firestore rules, links and domain');

// Private studio staging assertions: no embedded user content, no unauthenticated data.
const studioPage = read('studio/index.html');
const studioJs = read('studio/studio.js');
const studioConfig = read('studio/firebase-config.js');
const studioCss = read('studio/studio.css');
const studioRules = read('firestore.rules');
assert.match(studioPage, /content="noindex,nofollow,noarchive"/);
assert.ok(studioPage.includes('Войти через Google'));
assert.ok(studioPage.includes('id="lyric-form"'));
assert.ok(studioPage.includes('href="studio.css?v=18"'));
assert.ok(studioJs.includes("collection('vmm_admins').doc(user.uid).get({source:'server'})"), 'Studio must check the admin allowlist');
assert.ok(studioJs.includes('doc.exists&&doc.data()&&doc.data().enabled===true'), 'Disabled admins denied');
assert.ok(studioJs.includes('signInWithPopup(provider)'), 'Google sign-in must not use redirect');
assert.ok(studioJs.includes("collection('vmm_lyrics')"), 'Lyrics collection required');
assert.ok(studioJs.includes('firebase.firestore.FieldValue.serverTimestamp()'), 'Server timestamp required');
assert.ok(studioConfig.includes('window.VELAR_FIREBASE_CONFIG = {'), 'Web app config must be present');
assert.ok(studioConfig.includes('projectId: "velardream-records-studio"'), 'Wrong Firebase project');
assert.ok(studioConfig.includes('authDomain: "velardream-records-studio.firebaseapp.com"'), 'Wrong Auth domain');
assert.ok(studioConfig.includes('appId: "1:880625703377:web:fc799a186054276d28a8f0"'), 'Wrong web app ID');
assert.ok(!studioConfig.includes('serviceAccount') && !/BEGIN PRIVATE KEY|client_secret|private_key/.test(studioConfig), 'Private credentials must never be stored in web config');
assert.ok(studioJs.includes("prompt:'select_account'"), 'Google popup must allow account selection');
assert.ok(studioCss.includes('@media print'), 'A4 print baseline required');
assert.ok(studioRules.includes("request.auth.token.firebase.sign_in_provider == 'google.com'"));
assert.ok(studioRules.includes('match /vmm_admins/{uid}'));
assert.ok(studioRules.includes('allow list, create, update, delete: if false;'), 'No self-granted admin role');
assert.ok(studioRules.includes('match /{document=**} { allow read, write: if false; }'), 'Unknown collections must be deny-all');
assert.ok(!homepage.includes('href="studio/"') && !homepage.includes('href="app/"'), 'Public landing must not link to private studio yet');
for (const file of ['studio/index.html','studio/studio.js','studio/studio.css','studio/firebase-config.js']) {
  const content=read(file);
  assert.ok(!/BEGIN PRIVATE KEY|serviceAccount|docs\.google\.com\/spreadsheets|velardream@gmail\.com/.test(content), 'Private data leak in ' + file);
}
for (const match of studioPage.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (match[1].startsWith('http') || match[1].startsWith('#')) continue;
  const target = path.join(root,'studio',match[1].split(/[?#]/)[0]);
  assert.ok(fs.existsSync(target), 'Broken studio asset: ' + match[1]);
}
