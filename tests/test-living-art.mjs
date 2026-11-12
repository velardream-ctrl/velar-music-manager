import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),css=read('style.css'),sw=read('sw.js');
const universe=read('universe.js'),art=read('living-art.js');
new vm.Script(art);
new vm.Script(universe);
assert.match(html,/id="crystal-journey"/);
assert.match(html,/src="assets\/velardream-crystal\.png"/);
assert.match(html,/id="hero-crystal-link"/);
assert.match(html,/class="crystal-journey-crystal"[\s\S]*?assets\/velardream-symbol\.svg/);
assert.doesNotMatch(html,/class="crystal-journey-crystal"[\s\S]{0,250}assets\/velardream-crystal\.png/);
assert.match(html,/href="#universe" id="hero-crystal-link"/);
assert.match(html,/living-art\.js\?v=2/);
assert.match(html,/universe\.js\?v=5/);
assert.match(html,/style\.css\?v=29/);
assert.match(universe,/crystal\.src='assets\/velardream-symbol\.svg'/);
assert.match(universe,/var center=el\('button','universe-core'\)/);
assert.match(universe,/universe-beam is-active/);
assert.match(css,/\.universe-core-crystal\{/);
assert.match(css,/\.crystal-journey-ring--outer/);
assert.match(css,/\.crystal-journey-stars--near/);
assert.match(css,/\.has-living-art \.crystal-journey-stage\{/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(sw,/CACHE_PREFIX \+ 'v35'/);
assert.match(sw,/'\.\/living-art\.js\?v=2'/);
assert.match(sw,/'\.\/universe\.js\?v=5'/);
assert.doesNotMatch(art,/setTimeout\(|setInterval\(|fetch\(|firebase|firestore\(|XMLHttpRequest|WebSocket|getContext\(/);
assert.doesNotMatch(universe,/setTimeout\(|setInterval\(|fetch\(|firestore\(/);
assert.doesNotMatch(art,/autoplay|\.play\(|\.pause\(/);

function node(className){
 return {className:className||'',style:{},attributes:{},
  setAttribute(k,v){this.attributes[k]=v;},
  getBoundingClientRect(){return {top:-380,bottom:1140};}};
}
function environment(opts={}){
 const beams=[node('crystal-journey-beam'),node('crystal-journey-beam')];
 const stanzas=['crystal-journey-stanza is-current','crystal-journey-stanza','crystal-journey-stanza'].map(node);
 const names=['.crystal-journey-crystal','.crystal-journey-ring--outer','.crystal-journey-ring--inner',
  '.crystal-journey-stars--far','.crystal-journey-stars--near'];
 const parts=Object.fromEntries(names.map(n=>[n,node(n)]));
 const chapter=node('crystal-journey');
 chapter.offsetHeight=1520;chapter.querySelector=q=>parts[q]||null;
 chapter.querySelectorAll=q=>q==='.crystal-journey-beam'?beams:q==='.crystal-journey-stanza'?stanzas:[];
 const headings=Array.from({length:7},()=>node('section-heading'));
 const names2=['#artists .section-heading','#releases .section-heading','#playlists .section-heading',
  '#universe .universe-overline','#languages .universe-overline','#genres .section-heading','#about .section-heading'];
 const map=Object.fromEntries(names2.map((key,i)=>[key,headings[i]]));
 const doc={readyState:'complete',hidden:false,documentElement:{className:''},
  getElementById:id=>id==='crystal-journey'?chapter:null,querySelector:q=>map[q]||null,
  events:{},addEventListener(type,fn){this.events[type]=fn;}};
 const events={},observers=[],queued=[];
 const win={innerWidth:opts.width||1200,innerHeight:opts.height||800,
   navigator:{connection:{saveData:!!opts.saveData}},
   CSS:{supports:()=>opts.clip!==false},
   matchMedia:()=>({matches:!!opts.reduced}),
   IntersectionObserver:class {
    constructor(fn,config){this.fn=fn;this.config=config;this.targets=[];this.unobserved=[];observers.push(this);}
    observe(x){this.targets.push(x);}
    unobserve(x){this.unobserved.push(x);}
   },
   requestAnimationFrame:fn=>{queued.push(fn);return queued.length;},
   cancelAnimationFrame:()=>{},
   addEventListener:(k,fn)=>events[k]=fn,removeEventListener:k=>delete events[k]};
 vm.runInNewContext(art,{window:win,document:doc,Array,Math,Number,String,Error},{timeout:1000});
 return {win,doc,parts,chapter,beams,stanzas,headings,observers,queued,events,api:win.VELAR_LIVING_ART};
}
const r=environment();
assert.equal(r.api.scrollProgress(-380,1520,800),380/720);
assert.equal(r.api.scrollProgress(150,1520,800),0);
assert.equal(r.api.scrollProgress(-2000,1520,800),1);
assert.equal(r.api.phaseFor(.1),0);
assert.equal(r.api.phaseFor(.4),1);
assert.equal(r.api.phaseFor(.9),2);
assert.match(r.doc.documentElement.className,/has-living-art/);
assert.equal(r.api.motionStatus(),'enabled');
assert.equal(r.chapter.attributes['data-motion-status'],'enabled');
assert.equal(r.observers.length,2,'Only two IntersectionObservers, no timers');
assert.equal(r.observers[0].targets[0],r.chapter);
assert.equal(r.observers[1].targets.length,7);
assert.equal(r.queued.length,0,'Nothing animates while offscreen');
r.observers[0].fn([{target:r.chapter,isIntersecting:true}]);
assert.equal(typeof r.events.scroll,'function');
assert.equal(r.queued.length,1);
r.queued.shift()();
assert.match(r.parts['.crystal-journey-crystal'].style.transform,/scale\(/);
assert.match(r.parts['.crystal-journey-ring--outer'].style.transform,/rotate\(/);
assert.equal(r.chapter.attributes['data-journey-phase'],'2');
assert.match(r.stanzas[1].className,/is-current/);
assert.ok(!r.stanzas[0].className.includes('is-current'));
r.events.scroll();r.events.scroll();r.events.scroll();
assert.equal(r.queued.length,1,'Scroll work is coalesced to one animation frame');
r.queued.shift()();
r.observers[1].fn([{target:r.headings[0],isIntersecting:true}]);
assert.match(r.headings[0].className,/is-revealed/);
assert.equal(r.observers[1].unobserved.length,1,'Reveals stop observing after use');
r.observers[0].fn([{target:r.chapter,isIntersecting:false}]);
assert.equal(r.events.scroll,undefined,'Scroll event detached offscreen');
assert.equal(r.queued.length,0,'No loop continues');
r.doc.hidden=true;r.doc.events.visibilitychange();
assert.equal(r.events.scroll,undefined,'No scroll animation in hidden tab');
for(const opt of [{reduced:true},{saveData:true},{clip:false},{height:490},{width:300}]){
 const e=environment(opt);
 assert.equal(e.observers.length,0,'Fallback must be static: '+JSON.stringify(opt));
 assert.equal(e.queued.length,0);
 assert.ok(!e.doc.documentElement.className.includes('has-living-art'));
 const expected=opt.reduced?'reduced-motion':opt.saveData?'data-saver':opt.clip===false?'unsupported-clip':'small-viewport';
 assert.equal(e.api.motionStatus(),expected);
 assert.equal(e.chapter.attributes['data-motion-status'],expected);
}
console.log('PASS: RUN-071 real crystal core, visible-only scroll layers, reduced motion/data saver/old browser fallback, no media or requests');