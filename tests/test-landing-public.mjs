import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schemaSrc=read('landing-schema.js'),publicSrc=read('landing-public.js'),html=read('index.html');
const window={};vm.runInNewContext(schemaSrc,{window,Array,Number,Object,String,JSON,Error},{timeout:1000});
const api=window.VMM_LANDING_SCHEMA;
const elements={};
function el(tag='div'){
 const node={tagName:tag,children:[],className:'',_html:'',textContent:'',style:{},
  setAttribute(k,v){this[k]=v;},appendChild(child){this.children.push(child);},
  removeChild(child){this.children.splice(this.children.indexOf(child),1);},
  get firstChild(){return this.children[0]||null;},
  set innerHTML(value){this._html=value;this.children=[];},
  get innerHTML(){return this._html;}
 };
 return node;
}
for(const id of ['public-hero-subtitle','public-hero-intro','artists-title','public-artists-intro',
 'releases-title','public-releases-intro','genres-title','public-genres-intro','about-title',
 'public-about-intro','public-about-notice','public-genres-tags','public-artists-cards','public-releases-cards'])
 elements[id]=el();
elements['public-artists-cards'].innerHTML='<div>СКОРО: артисты</div>';
elements['public-artists-cards'].className='feature feature-artists';
elements['public-releases-cards'].innerHTML='<div>СКОРО: релизы</div>';
elements['public-releases-cards'].className='feature feature-releases';
const document={
 readyState:'complete',getElementById(id){return elements[id]||null;},createElement(tag){return el(tag);}
};
let listener=null,source=null,collectionName=null,docId=null;
const firebase={
 apps:[{}],
 firestore(){
  return {collection(name){collectionName=name;return {doc(id){docId=id;return {onSnapshot(cb){listener=cb;}};}};}};
 }
};
window.firebase=firebase;window.VELAR_FIREBASE_CONFIG={projectId:'test'};
vm.runInNewContext(publicSrc,{window,document,firebase,Array,Object,String,Error},{timeout:1000});
assert.equal(collectionName,'vmm_public_pages');
assert.equal(docId,'landing');
assert.equal(typeof listener,'function');
assert.match(elements['public-artists-cards'].innerHTML,/СКОРО/);
const defaultPage=api.defaults();
const published=api.normalize({
 ...defaultPage,
 hero:{subtitle:'Обновлённый музыкальный мир',intro:'Новое описание'},
 artists:{...defaultPage.artists,heading:'Наши артисты',cards:[
  {title:'Velar <script>alert(1)</script>',subtitle:'Бас',description:'Артист и композитор',
   url:'https://example.com/velar',imageUrl:'https://example.com/velar.jpg',visible:true}]},
 releases:{...defaultPage.releases,heading:'Новые песни',cards:[
  {title:'Белая берёза',subtitle:'Velar',description:'Новый релиз',
   url:'https://open.spotify.com/track/abc',imageUrl:'',visible:true}]},
 genres:{...defaultPage.genres,tags:['Опера','Поп']},
 about:{...defaultPage.about,notice:'Новый текст о проекте'}
});
listener({exists:true,data:()=>({schemaVersion:1,status:'published',content:published})});
assert.equal(elements['public-hero-subtitle'].textContent,'Обновлённый музыкальный мир');
assert.equal(elements['artists-title'].textContent,'Наши артисты');
assert.equal(elements['releases-title'].textContent,'Новые песни');
assert.equal(elements['public-genres-tags'].children.length,2);
const artistCard=elements['public-artists-cards'].children[0];
assert.equal(artistCard.tagName,'article');
const artistPhotoFrame=artistCard.children[0];
assert.equal(artistPhotoFrame.tagName,'div');
assert.match(artistPhotoFrame.className,/cms-artist-photo--square/);
assert.equal(artistPhotoFrame.children[0].tagName,'img');
assert.match(artistPhotoFrame.children[0].className,/cms-artist-photo-image/);
const copy=artistCard.children[1];
assert.equal(copy.children[0].textContent,'Velar <script>alert(1)</script>');
assert.ok(!JSON.stringify(artistCard.innerHTML).includes('<script>'));
const detail=copy.children.find(x=>x.tagName==='a'&&x.textContent==='Подробнее об артисте');
assert.ok(detail);
assert.match(detail.href,/^artist\.html\?name=/);
const link=copy.children.find(x=>x.tagName==='a'&&x.href==='https://example.com/velar');
assert.equal(link.href,'https://example.com/velar');
assert.equal(link.rel,'noopener noreferrer');
assert.equal(elements['public-releases-cards'].className,'cms-release-showcase');
assert.equal(elements['public-releases-cards'].children[1].children.length,1);
assert.equal(elements['public-releases-cards'].children[1].children[0].children[0].className,'cms-release-art',
  'Release cards without images have a lightweight visual placeholder');
// Changing the admin setting and publishing must switch the SAME photo to a circle.
const circlePublished={...published,artists:{...published.artists,cards:published.artists.cards.map(x=>({...x,imageShape:'circle'}))}};
listener({exists:true,data:()=>({schemaVersion:1,status:'published',content:circlePublished})});
const circleCard=elements['public-artists-cards'].children[0];
assert.match(circleCard.className,/cms-artist-card--circle/);
assert.match(circleCard.children[0].className,/cms-artist-photo--circle/);
assert.equal(circleCard.children[0].children[0].src,artistPhotoFrame.children[0].src);
listener({exists:true,data:()=>({schemaVersion:1,status:'published',content:published})});
assert.match(elements['public-artists-cards'].children[0].children[0].className,/cms-artist-photo--square/);
assert.equal(elements['public-about-notice'].textContent,'Новый текст о проекте');
// Unpublished pages or wrong schema must never paint over an existing page.
listener({exists:true,data:()=>({schemaVersion:1,status:'draft',content:api.defaults()})});
assert.equal(elements['artists-title'].textContent,'Наши артисты');
// All cards hidden in a later approved update restores original public placeholders.
const hidden={...published,
 artists:{...published.artists,cards:published.artists.cards.map(x=>({...x,visible:false}))},
 releases:{...published.releases,cards:[]}
};
listener({exists:true,data:()=>({schemaVersion:1,status:'published',content:hidden})});
assert.match(elements['public-artists-cards'].innerHTML,/СКОРО: артисты/);
assert.match(elements['public-releases-cards'].innerHTML,/СКОРО: релизы/);
assert.equal(elements['public-artists-cards'].className,'feature feature-artists');
assert.doesNotMatch(html,/vmm_lyrics|vmm_recordings/);
assert.doesNotMatch(publicSrc,/\.set\(|\.add\(|\.update\(|\.delete\(/);
console.log('PASS: public landing only listens to approved landing doc, renders safe cards, protects private data and restores static fallbacks');
