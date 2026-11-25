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
assert.match(html,/living-art\.js\?v=8/);
assert.match(html,/universe\.js\?v=7/);
assert.match(html,/style\.css\?v=85/);
assert.match(universe,/crystal\.src='assets\/velardream-symbol\.svg'/);
assert.match(universe,/var center=el\('button','universe-core'\)/);
assert.match(universe,/universe-beam is-active/);
assert.match(css,/\.universe-core-crystal\{/);
assert.match(css,/\.crystal-journey-ring--outer/);
assert.match(css,/\.crystal-journey-stars--near/);
assert.match(css,/\.has-living-art \.crystal-journey-stage\{/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(sw,/CACHE_PREFIX \+ 'v100'/);
assert.match(sw,/'\.\/living-art\.js\?v=8'/);
assert.match(sw,/'\.\/universe\.js\?v=7'/);
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
 const names=['.crystal-journey-stage','.crystal-journey-crystal','.crystal-journey-ring--outer','.crystal-journey-ring--inner',
  '.crystal-journey-stars--far','.crystal-journey-stars--near'];
 const parts=Object.fromEntries(names.map(n=>[n,node(n)]));
 const chapter=node('crystal-journey');
 chapter.offsetHeight=1520;chapter.querySelector=q=>parts[q]||null;
 chapter.querySelectorAll=q=>q==='.crystal-journey-beam'?beams:q==='.crystal-journey-stanza'?stanzas:[];
 const headings=Array.from({length:7},()=>node('section-heading'));
 const names2=['#artists .section-heading','#releases .section-heading','#playlists .section-heading',
  '#universe .universe-overline','#languages .universe-overline','#genres .section-heading','#about .section-heading'];
 const map=Object.fromEntries(names2.map((key,i)=>[key,headings[i]]));
 const hero=node('hero'),header=node('site-header');
 hero.style={};header.offsetHeight=96;header.getBoundingClientRect=()=>({height:96});
 map['.hero']=hero;map['.site-header']=header;
 const doc={readyState:'complete',hidden:false,documentElement:{className:''},
  getElementById:id=>id==='crystal-journey'?chapter:null,querySelector:q=>map[q]||null,
  events:{},addEventListener(type,fn){this.events[type]=fn;}};
 const events={},observers=[],queued=[];
 const win={innerWidth:opts.width||1200,innerHeight:opts.height||800,
   navigator:{userAgent:opts.userAgent||'Mozilla/5.0 (X11; Linux)',connection:{saveData:!!opts.saveData}},
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
 return {win,doc,parts,chapter,hero,header,beams,stanzas,headings,observers,queued,events,api:win.VELAR_LIVING_ART};
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
// RUN-171: iPhone WebKit may scroll sticky scenes and viewport-fixed controls
// up with the document. The targeted CSS fallback must never hit iPad/desktop.
const iphone=environment({width:390,height:844,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X)'});
const ipad=environment({width:768,height:1024,userAgent:'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X)'});
const desktop=environment({width:1366,height:768,userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)'});
assert.match(iphone.doc.documentElement.className,/ios-scroll-stable/);
assert.match(iphone.doc.documentElement.className,/has-living-art/,
 'iPhone scroll artwork remains animated rather than disabled');
assert.doesNotMatch(ipad.doc.documentElement.className,/ios-scroll-stable/,
 'Legacy iPad position and static fallback must remain unchanged');
assert.doesNotMatch(desktop.doc.documentElement.className,/ios-scroll-stable/);
assert.equal(iphone.api.scrollProgress(-100,650,844),100/422,
 'A short, non-sticky crystal chapter must animate smoothly on downward scroll');
assert.match(css,/html\.ios-scroll-stable\.has-living-art \.crystal-journey-stage\{[\s\S]*?position:relative;top:auto;height:auto/,
 'iPhone scene must avoid sticky 100vh scroll blanking');
assert.match(css,/html\.ios-scroll-stable body\.public-site\{overflow-x:visible\}/,
 'Remove the body clipping scroll container on iPhone only');
assert.match(css,/html\.ios-scroll-stable \.velar-radio,[\s\S]*?html\.ios-scroll-stable \.velar-assistant\{/,
 'Keep the radio and assistant on separate composited fixed layers');
assert.match(css,/html\.ios-scroll-stable\.has-living-art \.art-reveal\{[\s\S]*?opacity:1/,
 'Section headings must remain visible if iPhone observer callbacks are lost');
// RUN-173: only old iPads get the legacy crystal sky/layout and its small
// scroll animation. Modern devices keep exactly their previous CSS and JS.
const oldIpad=environment({width:768,height:1024,clip:false,
 userAgent:'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/90.0 Mobile/15E148 Safari/604.1'});
assert.equal(oldIpad.hero.style.minHeight,'928px','iPad header and hero should fill exactly one portrait viewport');
assert.match(oldIpad.doc.documentElement.className,/legacy-ipad-crystal/,
 'Old Safari 12 iPad must receive the narrowly scoped sky/size fallbacks');
assert.doesNotMatch(oldIpad.doc.documentElement.className,/ios-scroll-stable/,
 'The iPhone scroll correction must never apply to an old iPad');
assert.doesNotMatch(oldIpad.doc.documentElement.className,/has-living-art/,
 'Legacy iPad does not enable the costly sticky 158vh scene');
assert.equal(oldIpad.chapter.attributes['data-motion-status'],'unsupported-clip');
assert.equal(oldIpad.queued.length,1,'Old Safari receives an initial lightweight animation frame');
oldIpad.queued.shift()();
assert.match(oldIpad.parts['.crystal-journey-crystal'].style.transform,/scale\(/);
assert.match(oldIpad.parts['.crystal-journey-ring--outer'].style.transform,/rotate\(/);
assert.equal(typeof oldIpad.events.scroll,'function');
oldIpad.events.scroll();oldIpad.events.scroll();
assert.equal(oldIpad.queued.length,1,'Old iPad scroll animation is rAF-throttled');
oldIpad.queued.shift()();

// RUN-176: emulate legacy viewport pinning and assert all three caption phases.
assert.equal(oldIpad.chapter.attributes['data-journey-phase'],'3');
assert.match(oldIpad.parts['.crystal-journey-stage'].className,/legacy-crystal-pinned/);
oldIpad.chapter.offsetHeight=2048;
oldIpad.chapter.getBoundingClientRect=()=>({top:-100,bottom:1948});
oldIpad.events.scroll();oldIpad.queued.shift()();
assert.equal(oldIpad.chapter.attributes['data-journey-phase'],'1');
oldIpad.chapter.getBoundingClientRect=()=>({top:-500,bottom:1548});
oldIpad.events.scroll();oldIpad.queued.shift()();
assert.equal(oldIpad.chapter.attributes['data-journey-phase'],'2');
assert.match(oldIpad.parts['.crystal-journey-stage'].className,/legacy-crystal-pinned/);
oldIpad.chapter.getBoundingClientRect=()=>({top:-900,bottom:1148});
oldIpad.events.scroll();oldIpad.queued.shift()();
assert.equal(oldIpad.chapter.attributes['data-journey-phase'],'3');
oldIpad.chapter.getBoundingClientRect=()=>({top:-1100,bottom:948});
oldIpad.events.scroll();oldIpad.queued.shift()();
assert.match(oldIpad.parts['.crystal-journey-stage'].className,/legacy-crystal-ended/);
assert.doesNotMatch(oldIpad.parts['.crystal-journey-stage'].className,/legacy-crystal-pinned/);
const newIpad=environment({width:768,height:1024,
 userAgent:'Mozilla/5.0 (iPad; CPU OS 16_7_10 like Mac OS X)'});
assert.doesNotMatch(newIpad.doc.documentElement.className,/legacy-ipad-crystal/,
 'Current iPad must retain its existing responsive scene');
assert.match(newIpad.doc.documentElement.className,/has-living-art/);
const oldIphone=environment({width:390,height:844,clip:false,
 userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 12_5 like Mac OS X)'});
assert.doesNotMatch(oldIphone.doc.documentElement.className,/legacy-ipad-crystal/,
 'Older iPhones must not receive the iPad-specific artwork correction');
const reducedOldIpad=environment({width:768,height:1024,clip:false,reduced:true,
 userAgent:'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X)'});
assert.match(reducedOldIpad.doc.documentElement.className,/legacy-ipad-crystal/,
 'Static fallback must still show the crystal when motion is disabled');
assert.equal(reducedOldIpad.queued.length,0,'Reduced motion must disable legacy animation');
for(const selector of [
 '.crystal-journey-stage','.crystal-journey-sky','.crystal-journey-crystal',
 '.crystal-journey-ring--outer','.crystal-journey-ring--inner',
 '.crystal-journey-beam','.crystal-journey-stars'
]){
 assert.ok(css.includes('html.legacy-ipad-crystal '+selector+'{'),
   'Old Safari layout uses explicit bounds only for '+selector);
}
assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey-sky\{[^}]*top:0;right:0;bottom:0;left:0;/,
 'Legacy Safari sky must fill the stage without unsupported CSS inset');
assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey-crystal\{[^}]*width:140px;/,
 'Legacy crystal must have an explicit non-clamp width');
assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey-ring--outer\{[^}]*width:72vw;height:72vw;/,
 'Legacy ring must have normal CSS values without CSS min()');
// RUN-174: the final device-specific overrides must restore viewport geometry
// without leaking onto desktop or newer iPads.
assert.match(css,/html\.ios-scroll-stable\.has-living-art \.crystal-journey\{\s*height:200vh;/);
assert.match(css,/html\.ios-scroll-stable\.has-living-art \.crystal-journey-stage\{\s*position:-webkit-sticky;position:sticky;top:0;\s*height:100vh;/);
assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey-stage\{\s*height:100vh;min-height:700px;/);
assert.match(art,/RUN-176: Safari 12 old iPad uses a scroll-synchronized fixed stage/);
// RUN-175: old-iPad-only sticky scene with the correct scroll progress.
assert.match(css,/html\.legacy-ipad-crystal body\.public-site\{overflow-x:visible\}/);
assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey\{\s*position:relative;height:200vh;/);
assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey-stage\{\s*position:-webkit-sticky;position:sticky;top:0;/);
assert.match(art,/var duration=Math.max\(1,chapter.offsetHeight-viewport\)/);
assert.doesNotMatch(iphone.doc.documentElement.className,/legacy-ipad-crystal/);
assert.doesNotMatch(desktop.doc.documentElement.className,/legacy-ipad-crystal/);
assert.doesNotMatch(newIpad.doc.documentElement.className,/legacy-ipad-crystal/);

assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey-stage\.legacy-crystal-pinned\{/);
assert.match(css,/html\.legacy-ipad-crystal \.crystal-journey-stage\.legacy-crystal-ended\{/);
assert.match(art,/legacy-crystal-pinned/);
assert.match(art,/legacyIpadFirstScreen\(\)/);
assert.match(art,/data-journey-phase/);
console.log('PASS: RUN-071/171/173 iPhone and modern iPad untouched; Safari12 iPad receives the missing crystal, rings and throttled scroll motion');