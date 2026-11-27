import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('studio/index.html','utf8'), code=fs.readFileSync('studio/studio.js','utf8'), sw=fs.readFileSync('sw.js','utf8');
assert.match(page,/data-panel="recordings">Фонограммы<\/button>\s*<button type="button" data-panel="converter">Аудиоконвертер<\/button>/);
assert.match(page,/<iframe id="converter-admin-frame"[^>]*sandbox="allow-scripts allow-same-origin allow-downloads"[^>]*>/);
assert.doesNotMatch(page,/<iframe id="converter-admin-frame"[^>]*\ssrc=/);
assert.match(code,/if\(id==='converter'&&!authorized\)return/);
assert.match(code,/id==='converter'&&authorized&&converterFrame/);
assert.match(code,/section==='converter'/);
assert.match(code,/function clearConverter\(\).*removeAttribute\('src'\)/);
assert.match(code,/function unauthorized\(note\)[\s\S]*?clearConverter\(\)/);
assert.match(sw,/admin-converter1/);
assert.doesNotMatch(fs.readFileSync('index.html','utf8'),/converter-admin|mp3-converter/);
assert.match(page,/<script src="studio\.js\?v=19"><\/script>/);
assert.match(sw,/studio\/studio\.js\?v=19/);
assert.doesNotMatch(sw,/studio\/studio\.js\?v=17/);
assert.match(sw,/studio-nav19/);
assert.match(code,/mp3-converter\/\?v=217/);
assert.match(page,/V217/);
console.log('Admin converter: menu order, lazy auth gate, sign-out and public menu checks passed');

// Exercise actual section routing instead of merely searching source strings.
import vm from 'node:vm';
const nodes={};
function node(){return {value:'',className:'',textContent:'',children:[],style:{},attrs:{},addEventListener(){},appendChild(n){this.children.push(n);},setAttribute(k,v){this.attrs[k]=v;},hasAttribute(k){return Object.prototype.hasOwnProperty.call(this.attrs,k);},removeAttribute(k){delete this.attrs[k];}};}
const get=id=>nodes[id]||(nodes[id]=node());
const button=node();button.setAttribute('data-panel','converter');button.getAttribute=k=>button.attrs[k];
const document={getElementById:get,querySelectorAll(q){return q==='#workspace [data-panel]'?[button]:[];},createElement:node,head:node()};
const window={VELAR_FIREBASE_CONFIG:null,addEventListener(){},location:{hash:''},history:{replaceState(){}}};
const script=code.replace(/\}\(\)\);\s*$/,"window.__route={go:selectPanel,allow:function(v){authorized=v;},clear:clearConverter};}());");
vm.runInNewContext(script,{document,window,navigator:{onLine:true},Promise,Array,Object,Number,String,Math,Date,Error,parseInt,isFinite});
const route=window.__route,frame=get('converter-admin-frame');
route.go('converter');assert.equal(frame.hasAttribute('src'),false);
route.allow(true);button.onclick();assert.equal(get('converter-admin').className,'');assert.match(get('future-content').className,/hidden/);assert.equal(button.className,'nav-active');assert.match(frame.attrs.src,/mp3-converter\/\?v=217/);
route.go('lyrics');assert.match(get('converter-admin').className,/hidden/);assert.equal(frame.hasAttribute('src'),true);
route.clear();assert.equal(frame.hasAttribute('src'),false);
console.log('PASS: actual converter navigation, auth gate, visibility and frame cleanup');
