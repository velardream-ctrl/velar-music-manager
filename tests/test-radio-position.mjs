import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const code=read('landing-public.js');
const start=code.indexOf(' function radioMove('),end=code.indexOf(' function stationHelp(',start);
assert.ok(start>=0&&end>start);
const radioMoveSource='('+code.slice(start,end).trim()+')';

function scenario(width,height,artRect,headerBottom){
 const events={},win={innerWidth:width,innerHeight:height,
   addEventListener(k,fn){events[k]=fn;},
   removeEventListener(k,fn){if(events[k]===fn)delete events[k];}};
 const elements={
  'top':{getBoundingClientRect(){return {bottom:headerBottom};}},
  'hero-crystal-link':{getBoundingClientRect(){return artRect;}}
 };
 const doc={getElementById:id=>elements[id]||null};
 const box=(className)=>({
  className,style:{},events:{},
  addEventListener(k,fn){this.events[k]=fn;},
  removeEventListener(k,fn){if(this.events[k]===fn)delete this.events[k];},
  getBoundingClientRect(){
   const bubble=this.className.includes('velar-radio--bubble');
   const w=bubble?68:365,h=bubble?68:270;
   const right=win.innerWidth-Number.parseFloat(this.style.right||'12');
   const top=Number.parseFloat(this.style.top||'12');
   return {width:w,height:h,top,left:right-w,right,bottom:top+h};
  }
 });
 const host=box('velar-radio velar-radio--bubble');
 const grip=box('velar-radio-grip'),orb=box('velar-radio-toggle');
 const context={window:win,document:doc,Date};
 const move=vm.runInNewContext(radioMoveSource,context,{timeout:1000});
 const controller=move(host,grip,orb);
 return {host,orb,grip,events,win,doc,elements,controller,context};
}
// Screenshot-sized phone: header ends at 124 CSS pixels, crystal occupies
// y=184..369, and the radio must start BESIDE the crystal, never in the menu.
{
 const e=scenario(414,896,{left:99,right:314,top:184,bottom:369,height:185},124);
 const rect=e.host.getBoundingClientRect();
 assert.ok(rect.top>140,'Initial floating radio must be below navigation');
 assert.ok(Math.abs(rect.top+34-(184+185/2))<1,'Orb aligns with crystal middle');
 assert.ok(rect.left>=314,'The circular logo must not obscure the crystal');
 assert.ok(rect.right<=414-12,'The orb must remain inside the viewport');
 assert.ok(!e.host.className.includes('popup-left'),
   'Right-hand orb uses right-aligned mini player to avoid overflow');
 // Rotation / layout width change re-anchors ONLY before a visitor drags.
 e.win.innerWidth=844;
 e.elements['hero-crystal-link'].getBoundingClientRect=()=>({
   left:260,right:575,top:151,bottom:422,height:271
 });
 e.events.resize();
 const after=e.host.getBoundingClientRect();
 assert.ok(after.left>575,'Untouched radio reflows beside landscape crystal');
 assert.ok(Math.abs(after.top+34-(151+271/2))<1);
 // Manual dragging overrides crystal anchoring and preserves position.
 e.orb.events.touchstart({touches:[{clientX:after.right-25,clientY:after.top+25}]});
 e.events.touchmove({touches:[{clientX:after.right-325,clientY:after.top+45}],
   cancelable:true,preventDefault(){}});
 e.events.touchend();
 const custom=e.host.getBoundingClientRect();
 assert.ok(e.controller.ignoreClick(),'Dragging suppresses accidental player opening');
 assert.ok(e.host.className.includes('popup-left'),
   'Left-hand floating orb opens the mini player to the right');
 e.host.className='velar-radio';e.controller.sync();
 assert.ok(e.host.getBoundingClientRect().left>=0,'Expanded radio stays in viewport');
 e.host.className='velar-radio velar-radio--bubble';e.controller.sync();
 assert.equal(e.host.getBoundingClientRect().right,custom.right,
   'Collapsing returns the orb to the manually selected point');
 e.win.innerWidth=800;e.events.resize();
 assert.equal(e.host.style.right,custom.right+'px',
   'Later rotation must not discard manual drag preference');
 e.context.stopRadioMove();
 assert.equal(Object.keys(e.events).length,0,'Position listeners are disposed');
}
// Narrower phones: no overlap with menu and no horizontal clipping.
{
 const e=scenario(320,700,{left:62,right:257,top:195,bottom:362,height:167},134);
 const r=e.host.getBoundingClientRect();
 assert.ok(r.top>134&&r.left>=0&&r.right<=320);
 e.context.stopRadioMove();
}
// Deep link / return to an already-scrolled page: no offscreen crystal anchor.
{
 const e=scenario(390,780,{left:90,right:305,top:-800,bottom:-615,height:185},-500);
 const r=e.host.getBoundingClientRect();
 assert.ok(r.top>=0&&r.bottom<=780,'Offscreen hero falls back to safe viewport position');
 e.context.stopRadioMove();
}
const css=read('style.css');
assert.match(css,/velar-radio--bubble\\.velar-radio--popup-left>\\.velar-radio-panel--mini/);
assert.match(code,/hero-crystal-link/);
assert.match(code,/movedByListener/);
console.log('PASS: RUN-169 hero-crystal initial radio position, menu clearance, rotation, manual drag, mini popup and cleanup');
