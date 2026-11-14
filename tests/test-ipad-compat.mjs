/* RUN-089 — old iPad mini / Safari 12: chat alignment and safe rotation layouts.
   Source-level regression: the live 768px/1024px visual check stays manual. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const css=read('style.css'),html=read('index.html'),sw=read('sw.js');

// Safari 12 ignores invalid clamp/min declarations. Keep valid, earlier fallback.
const assistant=css.match(/\.velar-assistant\{([^}]+)\}/);
assert.ok(assistant,'Assistant outer box exists');
assert.match(assistant[1],/position:fixed;right:12px;right:clamp\(/);
assert.match(assistant[1],/width:calc\(100% - 24px\);max-width:345px;\s*width:min\(/);
assert.match(css,/\.velar-assistant-dialog\{[\s\S]*?max-height:65vh;max-height:min\(/);
assert.match(css,/@media\(max-width:590px\)\{[\s\S]*?\.velar-assistant\{[\s\S]*?width:calc\(100% - 24px\);max-width:360px;\s*width:min\(/);
assert.match(css,/\.velar-assistant\{width:calc\(100% - 24px\);max-width:306px;\s*width:min\(306px/);
assert.match(css,/\.velar-assistant-launch\[aria-expanded="true"\]\{display:none\}/);

// 768px portrait and 1024px landscape must share safe grid rules; no jump
// back to absolute-positioned 43%-radius labels in landscape.
const tabletWidth=1100;
for(const width of [768,1024]){
 assert.ok(width<=tabletWidth,'iPad orientation must use tablet layout');
}
assert.match(css,/@media\(max-width:1100px\)\{\.universe-panel\{grid-template-columns:1fr\}/);
assert.match(css,/@media\(max-width:1100px\)\{\s*\.languages-section/);
assert.match(css,/@media\(max-width:1100px\)\{\s*\.topics-section/);
assert.match(css,/\.language-orbit,\.language-orbit\.is-dense\{[\s\S]*?display:grid;width:100%;max-width:100%;box-sizing:border-box/);
assert.match(css,/\.language-orbit-node,\.language-orbit\.is-dense \.language-orbit-node\{[\s\S]*?left:auto!important;top:auto!important;transform:none!important/);
assert.match(css,/\.topic-planet\{position:relative;top:auto!important;left:auto!important;transform:none!important/);
assert.match(css,/\.language-cosmos\{[\s\S]*?max-width:100%;box-sizing:border-box/);
assert.match(css,/\.topics-cosmos\{[\s\S]*?max-width:100%;box-sizing:border-box/);
assert.match(css,/\.language-orbit-label\{word-wrap:break-word;overflow-wrap:break-word;/);
assert.match(css,/\.universe-node-name\{word-wrap:break-word;overflow-wrap:break-word;/);
assert.match(css,/\.topic-planet-name\{line-height:1\.24;word-wrap:break-word;/);

// Only public static assets change; Studio cache and audio remain untouched.
assert.match(html,/href="style\.css\?v=37"/);
assert.match(sw,/'\.\/style\.css\?v=37'/);
assert.match(sw,/CACHE_PREFIX \+ 'v46'/);
assert.match(sw,/STUDIO_PREFIX\+'v45'/);
console.log('PASS: RUN-089 Safari12 chat fallback; stable 768/1024px language, topic and universe layouts');
