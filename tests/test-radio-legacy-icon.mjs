import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const png=read('assets/velar-radio-icon-gold-bold.png');
const css=read('style.css').toString('utf8');
const sw=read('sw.js').toString('utf8');
const html=read('index.html').toString('utf8');
const station=read('radio/index.html').toString('utf8');
const filename='assets/velar-radio-icon-gold-bold.png';
assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Real PNG must have the PNG signature');
assert.equal(png.readUInt32BE(16),112,'Approved PNG logo should retain width');
assert.equal(png.readUInt32BE(20),112,'Approved PNG logo should retain height');
assert.ok(png.includes(Buffer.from('tRNS')),'Transparent PNG is necessary for circular logo');
const back=(css.match(/\.velar-radio--bubble\s*>\s*\.velar-radio-toggle\s*\{[^}]*\}/g)||[])
 .filter(rule=>/background\s*:[^;]*url\(/.test(rule));
assert.equal(back.length,2,'Both image-backed bubble CSS declarations must load the logo');
for(const rule of back){
 assert.ok(rule.includes(filename),'All bubble background declarations must use PNG');
 assert.ok(!rule.includes('.webp'),'Old Safari must never be left with an unsupported WebP source');
}
assert.match(css,/velar-radio-halo/,'Do not remove heartbeat halo');
assert.match(css,/animation:velar-radio-heartbeat/,'Do not remove logo animation');
assert.match(sw,/CACHE_PREFIX \+ 'v98'/);
assert.ok(sw.includes("'./"+filename+"'"),'Service Worker must cache approved PNG offline');
assert.match(html,/style\.css\?v=84/);
assert.match(station,/style\.css\?v=80/);
console.log('PASS: RUN-170 legacy Safari displays the original gold radio PNG with working halo and SW fallback');
