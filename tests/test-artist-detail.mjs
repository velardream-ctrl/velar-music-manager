import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schemaSrc=read('landing-schema.js'),src=read('artist-detail.js'),
 html=read('artist.html'),sw=read('sw.js');
const window={location:{search:'?id=velar'}},elements={};
function el(tag='div'){
 const obj={tagName:tag,children:[],className:'',textContent:'',style:{},hidden:false,
  setAttribute(k,v){this[k]=v;},appendChild(x){this.children.push(x);return x;},
  removeChild(x){this.children.splice(this.children.indexOf(x),1);},
  get firstChild(){return this.children[0]||null;}};
 return obj;
}
for(const id of ['artist-message','artist-content','artist-name','artist-role','artist-description',
 'artist-portrait-wrap','artist-portrait','artist-biography','artist-biography-section',
 'artist-social-links','artist-social-section','artist-tracks','artist-tracks-section',
 'artist-albums','artist-albums-section','artist-share','artist-meta-description',
 'artist-og-title','artist-og-description','artist-og-url','artist-jsonld'])elements[id]=el();
elements['artist-content'].hidden=true;
const hero=el();
const document={readyState:'loading',title:'Artist',head:el(),
 getElementById(id){return elements[id]||null;},querySelector(s){return s==='.artist-hero'?hero:null;},
 createElement(tag){return el(tag);},addEventListener(){}};
const navigator={};
vm.runInNewContext(schemaSrc,{window,Array,String,Object,JSON,Number,Error},{timeout:1500});
vm.runInNewContext(src,{window,document,navigator,Array,String,Object,JSON,Number,Error},{timeout:1500});
const api=window.VMM_LANDING_SCHEMA,renderer=window.VMM_ARTIST_DETAIL;
assert.ok(renderer);
const profile={title:'DJ Velar',artistId:'velar',subtitle:'Музыкант',description:'О музыке',
 biography:'Подробная история без выдуманных фактов',visible:true,imageUrl:'https://example.com/photo.jpg',
 socialLinks:[
  {platform:'spotify',url:'https://open.spotify.com/artist/1PNzGsDcFVuOMBN7Gw12tw',visible:true},
  {platform:'telegram',url:'https://t.me/velarmusic',visible:false}
 ],
 featuredTracks:[{title:'Песня',provider:'spotify',url:'https://open.spotify.com/track/4P1nQxu1C6WlL9OiZ0r5HL'}]
};
const data=api.defaults();data.artists.cards=[profile];
assert.equal(renderer.render(data),true);
assert.equal(elements['artist-name'].textContent,'DJ Velar');
assert.equal(elements['artist-biography'].textContent,'Подробная история без выдуманных фактов');
assert.equal(elements['artist-content'].hidden,false);
assert.equal(elements['artist-social-links'].children.length,1);
assert.equal(elements['artist-social-links'].children[0].href,profile.socialLinks[0].url);
assert.equal(elements['artist-tracks'].children.length,1);
assert.equal(elements['artist-tracks'].children[0].href,profile.featuredTracks[0].url);
assert.equal(elements['artist-portrait'].src,profile.imageUrl);
const jsonLd=JSON.parse(elements['artist-jsonld'].textContent);
assert.equal(jsonLd.mainEntity.name,'DJ Velar');
assert.deepEqual(JSON.parse(JSON.stringify(jsonLd.mainEntity.sameAs)),[profile.socialLinks[0].url]);
assert.match(document.title,/DJ Velar/);
assert.equal(renderer.profileUrl(profile),'https://velardream.com/artist.html?id=velar');
assert.equal(renderer.selectedArtist({artists:{cards:[{...profile,visible:false}]}},{key:'id',value:'velar'}),null);
assert.equal(renderer.render({...data,artists:{...data.artists,cards:[{...profile,visible:false}]}}),false);
assert.equal(elements['artist-content'].hidden,true);
assert.match(elements['artist-message'].textContent,/не опубликован/);
assert.match(html,/noindex,nofollow/);
assert.match(html,/artist-detail\.js\?v=1/);
assert.match(sw,/artist-detail\.js\?v=1/);
assert.doesNotMatch(src,/\.collection\(['"]vmm_(?:lyrics|catalog|recordings|public_drafts)['"]\)/);
assert.doesNotMatch(src,/\.set\(|\.add\(|\.update\(|\.delete\(/);
console.log('PASS: individual artist pages render only published allowed profile information, with safe external links');
