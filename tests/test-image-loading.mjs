/* RUN-123: owner slider modes, test-only URL override and legacy-safe fallbacks. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const script=read('image-loading.js');
const schema=read('landing-schema.js');
const globalWindow={location:{search:''}};
const observers=[];
globalWindow.IntersectionObserver=class{
  constructor(cb,config){this.callback=cb;this.config=config;this.elements=[];this.disconnected=false;observers.push(this);}
  observe(el){this.elements.push(el);}
  unobserve(el){this.elements=this.elements.filter(x=>x!==el);}
  disconnect(){this.disconnected=true;}
  show(el){this.callback([{target:el,isIntersecting:true,intersectionRatio:1}]);}
};
vm.runInNewContext(schema,{window:globalWindow,Array,String,Object,Number,JSON,Error},{timeout:1500});
const api=globalWindow.VMM_LANDING_SCHEMA;
const defaultPage=api.normalize(api.defaults());
assert.equal(defaultPage.hero.imageLoadingLevel,0,'Existing public documents must remain eager');
assert.equal(api.normalize({...api.defaults(),hero:{intro:'Здравствуйте',subtitle:'VELAR'}}).hero.imageLoadingLevel,0);
for(const x of [1,2,3]){
 const page=api.normalize({...api.defaults(),hero:{...api.defaults().hero,imageLoadingLevel:x}});
 assert.equal(page.hero.imageLoadingLevel,x,'Published setting survives normalization');
}
for(const invalid of [-1,4,1.5,'2',null,false,{},[]]){
 assert.throws(()=>api.normalize({...api.defaults(),hero:{...api.defaults().hero,imageLoadingLevel:invalid}}),
  /уровень от 0 до 3/,String(invalid)+' must be rejected');
}
vm.runInNewContext(script,{window:globalWindow,Number,Math,Array,Error},{timeout:1500});
const loading=globalWindow.VELAR_IMAGE_LOADING;
assert.ok(loading);
function policy(n,index){loading.configure(n);const img={};loading.apply(img,index);return img.loading;}
assert.equal(policy(0,500),'eager');
assert.equal(policy(1,0),'eager');
assert.equal(policy(1,3),'eager');
assert.equal(policy(1,4),'lazy');
assert.equal(policy(2,1),'eager');
assert.equal(policy(2,2),'lazy');
assert.equal(policy(3,0),'eager');
assert.equal(policy(3,1),'lazy');
let calls=0;
loading.configure(0);loading.near({},()=>{calls++;},300);
assert.equal(calls,1,'Off always starts image metadata request');
loading.configure(1);loading.near({},()=>{calls++;},40);
assert.equal(calls,2,'Gentle mode does not gate Spotify metadata');
loading.configure(2);
loading.near({},()=>{calls++;},0);
assert.equal(calls,3,'The first cover of each group must load immediately');
const moderate={};loading.near(moderate,()=>{calls++;},8);
assert.equal(calls,3,'Moderate level holds off-screen official metadata');
assert.equal(observers.at(-1).config.rootMargin,'950px');
observers.at(-1).show(moderate);
assert.equal(calls,4,'Approaching an item starts its Spotify artwork request');
const strong={};loading.configure(3);loading.near(strong,()=>{calls++;},5);
assert.equal(calls,4);
assert.equal(observers.at(-1).config.rootMargin,'300px');
observers.at(-1).show(strong);assert.equal(calls,5);
loading.configure(3);
delete globalWindow.IntersectionObserver;
loading.near({},()=>{calls++;},10);
assert.equal(calls,6,'Safari 12 without native observer must fetch immediately');
globalWindow.location.search='?imageLoadingTest=2';
assert.equal(loading.configure(0),2,'URL preview must override the published setting for only this tab');
globalWindow.location.search='?imageLoadingTest=3&foo=bar';
assert.equal(loading.configure(0),3);
globalWindow.location.search='?imageLoadingTest=4';
assert.equal(loading.configure(0),0,'Invalid preview must not override saved config');
const html=read('index.html'),detail=read('artist.html'),studio=read('studio/index.html');
for(const page of [html,detail])assert.ok(page.includes('image-loading.js?v=1'));
assert.ok(read('sw.js').includes("./image-loading.js?v=1"));
assert.match(read('studio/landing-editor.js'),/imageLoadingTest/);
assert.match(read('studio/landing-editor.js'),/imageLoadingLevel/);
assert.match(read('landing-public.js'),/\.configure\(value\.hero\.imageLoadingLevel\)/);
assert.match(read('artist-detail.js'),/\.configure\(safe\.hero\.imageLoadingLevel\)/);
assert.match(studio,/landing-editor\.js\?v=43/);
assert.match(read('public-song-ui.js'),/images\.near\(item,function\(\)\{requestArtwork/);
assert.match(read('public-song-ui.js'),/frame\.loading='lazy'/,'Embedded music players remain on click');
console.log('PASS RUN-123: four loading levels, owner publish safety, preview-only URL, Safari fallback, gated Spotify thumbnails');
