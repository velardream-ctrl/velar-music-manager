import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={};
vm.runInNewContext(read('landing-schema.js'),{window,Array,String,Number,Object,JSON,Error},{timeout:1000});
const api=window.VMM_LANDING_SCHEMA,d=api.defaults().releases.radio;
assert.equal(d.visual.mode,'heartbeat');
assert.equal(d.visual.intensity,3);
assert.equal(d.visual.spread,20);
for(const mode of ['heartbeat','shimmer','broadcast','music','off']){
 const cfg=api.radioConfig({...d,visual:{mode,intensity:5,spread:100}});
 assert.equal(cfg.visual.mode,mode);assert.equal(cfg.visual.intensity,5);assert.equal(cfg.visual.spread,100);
}
for(const spread of [1,2,37,42,49,50,75,99,100]){
 assert.equal(api.radioConfig({...d,visual:{mode:'heartbeat',intensity:3,spread}}).visual.spread,spread,
  'Every integer from 1 to 100 must pass normalization');
}
const legacy=api.radioConfig({...d,visual:undefined});
assert.equal(legacy.visual.mode,'heartbeat');
assert.equal(legacy.visual.spread,20);
assert.equal(api.radioConfig({...d,visual:{mode:'heartbeat',intensity:3,spread:50}}).visual.spread,50,'Previously saved 50% is respected');
const bad=api.radioConfig({...d,visual:{mode:'evil',intensity:99,spread:-1}});
assert.equal(bad.visual.mode,'heartbeat');assert.equal(bad.visual.intensity,3);assert.equal(bad.visual.spread,20);
const css=read('style.css'),ui=read('landing-public.js'),studio=read('studio/landing-editor.js');
for(const mode of ['shimmer','broadcast','music','off'])assert.ok(css.includes('data-radio-effect="'+mode+'"'));
assert.match(css,/velar-radio-afterglow/);assert.match(css,/top:-34px;right:-34px;bottom:-34px;left:-34px/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(ui,/data-radio-player-open/);assert.match(ui,/velar-radio-halo/);
assert.match(studio,/Режим анимации радио/);assert.match(studio,/Размер светового ореола/);
assert.match(studio,/radioVisualSlider\('Размер светового ореола','spread',1,100,1/);

 // RUN-177: the help control is <summary>, NOT a button. Safari 12 must
 // use flex instead of unsupported place-items; do not alter other devices.
assert.match(ui,/create\('summary','station-help-button','\?'\)/);
assert.match(css,/html\.legacy-ipad-crystal \.velar-radio > \.station-help > \.station-help-button\{[^}]*display:-webkit-flex;display:flex;[^}]*align-items:center;[^}]*justify-content:center;/);
assert.match(css,/html\.legacy-ipad-crystal \.velar-radio > \.station-help > \.station-help-button::-webkit-details-marker\{[^}]*display:none;/);
console.log('PASS: RUN-166 VELAR RADIO visual modes, gold glow and validated Studio controls');
