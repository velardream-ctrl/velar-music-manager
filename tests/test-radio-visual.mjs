import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={};
vm.runInNewContext(read('landing-schema.js'),{window,Array,String,Number,Object,JSON,Error},{timeout:1000});
const api=window.VMM_LANDING_SCHEMA,d=api.defaults().releases.radio;
assert.equal(d.visual.mode,'heartbeat');
assert.equal(d.visual.intensity,3);
assert.equal(d.visual.spread,50);
for(const mode of ['heartbeat','shimmer','broadcast','music','off']){
 const cfg=api.radioConfig({...d,visual:{mode,intensity:5,spread:100}});
 assert.equal(cfg.visual.mode,mode);assert.equal(cfg.visual.intensity,5);assert.equal(cfg.visual.spread,100);
}
const legacy=api.radioConfig({...d,visual:undefined});
assert.equal(legacy.visual.mode,'heartbeat');
const bad=api.radioConfig({...d,visual:{mode:'evil',intensity:99,spread:-1}});
assert.equal(bad.visual.mode,'heartbeat');assert.equal(bad.visual.intensity,3);assert.equal(bad.visual.spread,50);
const css=read('style.css'),ui=read('landing-public.js'),studio=read('studio/landing-editor.js');
for(const mode of ['shimmer','broadcast','music','off'])assert.ok(css.includes('data-radio-effect="'+mode+'"'));
assert.match(css,/velar-radio-afterglow/);assert.match(css,/top:-34px;right:-34px;bottom:-34px;left:-34px/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(ui,/data-radio-player-open/);assert.match(ui,/velar-radio-halo/);
assert.match(studio,/Режим анимации радио/);assert.match(studio,/Размер светового ореола/);
console.log('PASS: RUN-166 VELAR RADIO visual modes, gold glow and validated Studio controls');
