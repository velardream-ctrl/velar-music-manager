import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const photo=read('studio/artist-image-editor.js');
const schema=read('landing-schema.js'),editor=read('studio/landing-editor.js');
const publicJS=read('landing-public.js'),publicHTML=read('index.html'),studioHTML=read('studio/index.html'),sw=read('sw.js');
const context={window:{},Array,Object,JSON,String,Number,Math,Error};
vm.runInNewContext(schema,context,{timeout:1000});
const fakeURL='data:image/webp;base64,'+'A'.repeat(2048);
let drawn=[];
const document={createElement(tag){
 if(tag!=='canvas')return {appendChild(){},setAttribute(){}};
 return {width:0,height:0,
  getContext(){return {fillRect(){},set fillStyle(v){},
   drawImage(img,...args){drawn.push(args);}};},
  toDataURL(type,quality){
   if(type==='image/webp')return fakeURL;
   return 'data:image/jpeg;base64,'+'A'.repeat(2048);
  }};
}};
vm.runInNewContext(photo,{window:context.window,document,Math,Number,String,Error},{timeout:1000});
const imgTool=context.window.VMM_ARTIST_IMAGE;
assert.ok(imgTool);
const rect=imgTool.cropRect(1200,800,1,0,0);
assert.equal(rect.sx,200);assert.equal(rect.sy,0);assert.equal(rect.sw,800);assert.equal(rect.sh,800);
const rect2=imgTool.cropRect(1200,800,2,1,-1);
assert.equal(rect2.sw,400);assert.equal(rect2.sx,800);assert.equal(rect2.sy,0);
assert.throws(()=>imgTool.cropRect(20000,500,1,0,0),/размер/);
assert.equal(imgTool.validate(fakeURL),fakeURL);
assert.throws(()=>imgTool.validate('data:image/svg+xml;base64,AAAA'),/WebP|JPEG/);
assert.throws(()=>imgTool.validate('data:text/html;base64,PHNjcmlwdD4='),/WebP|JPEG/);
assert.throws(()=>imgTool.validate('data:image/webp;base64,'+'A'.repeat(150000)),/WebP|JPEG/);
assert.equal(imgTool.compress({naturalWidth:1200,naturalHeight:800},1.5,0,0),fakeURL);
assert.equal(drawn.length,1);
assert.equal(drawn[0][0],(1200-800/1.5)/2);
const api=context.window.VMM_LANDING_SCHEMA;
const original=api.defaults();
const portraitCard={
 title:'Илья Дмитриев',subtitle:'Бас',description:'Певец',
 url:'',imageUrl:'',visible:true,artistId:'ilya-dmitriev',imageData:fakeURL,imageShape:'circle'
};
const normalized=api.normalize({...original,artists:{...original.artists,cards:[portraitCard]}});
assert.equal(normalized.artists.cards[0].imageData,fakeURL);
assert.equal(normalized.artists.cards[0].imageShape,'circle');
assert.equal(normalized.artists.cards[0].artistId,'ilya-dmitriev');
assert.ok(!normalized.releases.cards.some(x=>x.imageData),'Release links stay separate from private portrait upload');
const invalid={...portraitCard,imageData:'data:image/svg+xml;base64,'+'A'.repeat(10)};
assert.throws(()=>api.normalize({...original,artists:{...original.artists,cards:[invalid]}}),/фотография/);
const invalidShape={...portraitCard,imageShape:'triangle'};
assert.throws(()=>api.normalize({...original,artists:{...original.artists,cards:[invalidShape]}}),/Форма/);
const many=Array.from({length:12},(_,i)=>({...portraitCard,title:'Артист '+i,
 imageData:'data:image/webp;base64,'+'A'.repeat(100000)}));
assert.throws(()=>api.normalize({...original,artists:{...original.artists,cards:many}}),/Изображений слишком много/);
assert.match(editor,/function artistPhotoControls/);
assert.match(editor,/Загрузить фотографию/);
assert.match(editor,/Использовать фото|VMM_ARTIST_IMAGE\.open/);
assert.match(editor,/imageShape/);
assert.match(editor,/imageData/);
assert.match(publicJS,/img\.src=item\.imageData\|\|item\.imageUrl/);
assert.match(publicJS,/cms-artist-photo--/);
assert.match(publicJS,/portraitShape=item.imageShape==='circle'\?'circle':'square'/);
assert.match(read('style.css'),/cms-artist-photo--square/);
assert.match(read('style.css'),/cms-artist-photo--circle/);
assert.match(publicHTML,/landing-public\.js\?v=13/);
assert.match(studioHTML,/artist-image-editor\.js\?v=1/);
assert.match(studioHTML,/landing-editor\.js\?v=16/);
assert.match(studioHTML,/landing-schema\.js\?v=15/);
assert.match(sw,/STUDIO_PREFIX\+'v30'/);
assert.match(sw,/CACHE_PREFIX \+ 'v34'/);
assert.doesNotMatch(sw,/data:image\/webp/);
console.log('PASS: local crop geometry, WebP/JPEG compression, image MIME/size validation, circle/square, public-only opt-in and no new Storage costs');
