import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schemaSrc=read('landing-schema.js'),src=read('artist-detail.js'),
 html=read('artist.html'),sw=read('sw.js'),css=read('artist-detail.css'),
 shared=read('public-song-ui.js');
const window={location:{search:'?id=velar'}},elements={};
const artworkCalls=[],verifiedCover='https://i.scdn.co/image/1234567890abcdef';
window.VELAR_PUBLIC_SONGS={requestArtwork(track,onCover){
 artworkCalls.push(track);onCover(verifiedCover);
}};
function el(tag='div'){
 const obj={tagName:tag,children:[],className:'',textContent:'',style:{},hidden:false,attributes:{},
  setAttribute(k,v){this.attributes[k]=v;this[k]=v;},
  getAttribute(k){return this.attributes[k]||'';},
  appendChild(x){this.children.push(x);return x;},
  removeChild(x){this.children.splice(this.children.indexOf(x),1);},
  get firstChild(){return this.children[0]||null;}};
 return obj;
}
for(const id of ['artist-message','artist-content','artist-name','artist-role','artist-description',
 'artist-portrait-wrap','artist-portrait','artist-biography','artist-biography-section',
 'artist-social-links','artist-social-section','artist-tracks','artist-tracks-section','artist-track-pagination',
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
 featuredTracks:[
  {title:'Песня',provider:'spotify',url:'https://open.spotify.com/track/4P1nQxu1C6WlL9OiZ0r5HL'},
  {title:'Песня',provider:'youtube',url:'https://www.youtube.com/watch?v=ABCDEFGHIjk'},
  {title:'Песня',provider:'appleMusic',url:'https://music.apple.com/fi/album/white-birch/1234567890?i=1234567891'}
 ]
};
const data=api.defaults();data.artists.cards=[profile];
assert.equal(renderer.render(data),true);
assert.equal(elements['artist-name'].textContent,'DJ Velar');
assert.equal(elements['artist-biography'].textContent,'Подробная история без выдуманных фактов');
assert.equal(elements['artist-content'].hidden,false);
assert.equal(elements['artist-social-links'].children.length,1);
assert.equal(elements['artist-social-links'].children[0].href,profile.socialLinks[0].url);
assert.equal(elements['artist-tracks'].children.length,1,
 'Exactly one list should be rendered with published songs');
const songList=elements['artist-tracks'].children[0];
assert.equal(songList.children.length,1,
 'Three legacy provider records of the same composition should be grouped');
const card=songList.children[0];
assert.equal(card.children[0].children[0].textContent,'Песня');
const platforms=card.children[2].children;
assert.equal(platforms.length,3,'Spotify, YouTube and Apple Music share one song card');
assert.equal(platforms[0].attributes['data-provider'],'spotify');
assert.equal(platforms[1].attributes['data-provider'],'youtube');
assert.equal(platforms[2].attributes['data-provider'],'appleMusic');
assert.ok(platforms[0].className.includes('artist-track-source--spotify'));
assert.ok(platforms[1].className.includes('artist-track-source--youtube'));
assert.ok(platforms[2].className.includes('artist-track-source--appleMusic'));
assert.equal(card.children[1].children.length,0,'No audio player before user interaction');
platforms[2].onclick();
assert.equal(card.children[1].children[0].tagName,'iframe');
assert.match(card.children[1].children[0].src,/^https:\/\/embed\.music\.apple\.com/);
platforms[2].onclick();
assert.equal(card.children[1].children.length,0,'Tapping the same platform closes the iframe');

assert.equal(elements['artist-portrait'].src,profile.imageUrl);
data.artists.detailTrackView='tiles';
assert.equal(renderer.render(data),true);
assert.match(elements['artist-tracks'].className,/artist-tracks--tiles/);
assert.equal(artworkCalls.length,1,'Cover request made exactly once for grouped song');
assert.equal(artworkCalls[0].provider,'spotify','Art lookup uses verified Spotify URL');
assert.equal(artworkCalls[0].alternateProvider,'youtube');
assert.equal(artworkCalls[0].thirdProvider,'appleMusic');
const tileCard=elements['artist-tracks'].children[0].children[0];
const imageHolder=tileCard.children[0].children[0];
assert.ok(imageHolder.className.includes('artist-track-artwork'));
assert.equal(imageHolder.children[0].textContent,'♫','Note remains until art loads');
assert.equal(imageHolder.children[1].tagName,'img');
assert.equal(imageHolder.children[1].src,verifiedCover);
imageHolder.children[1].onload();
assert.equal(imageHolder.children[0].hidden,true,'Note disappears after official cover loads');
assert.match(imageHolder.children[1].className,/is-loaded/);
data.artists.detailTrackView='covers';
assert.equal(renderer.render(data),true);
const coverRow=elements['artist-tracks'].children[0].children[0];
assert.match(coverRow.children[0].children[0].className,/artist-track-artwork/);
coverRow.children[0].children[0].children[1].onerror();
assert.equal(coverRow.children[0].children[0].children.length,1,'On image failure note stays visible');
assert.equal(coverRow.children[0].children[0].children[0].hidden,false);
data.artists.detailTrackView='compact';
assert.equal(renderer.render(data),true);
assert.match(elements['artist-tracks'].className,/artist-tracks--compact/);

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
assert.match(html,/artist-detail\.js\?v=5/);
assert.match(sw,/artist-detail\.js\?v=5/);
assert.match(html,/public-song-ui\.js\?v=25/,'Same public art module is loaded before profile');
assert.ok(html.indexOf('public-song-ui.js')<html.indexOf('artist-detail.js'));
assert.match(sw,/artist-detail\.css\?v=3/);
assert.match(css,/artist-track-source--spotify::after/);
assert.match(css,/artist-track-source--appleMusic::after/);
assert.match(css,/artist-track-source--youtube::after/);
assert.match(shared,/requestArtwork:requestArtwork/);
assert.doesNotMatch(src,/\.collection\(['"]vmm_(?:lyrics|catalog|recordings|public_drafts)['"]\)/);
assert.doesNotMatch(src,/\.set\(|\.add\(|\.update\(|\.delete\(/);
console.log('PASS: individual artist pages render only published allowed profile information, with safe external links');
