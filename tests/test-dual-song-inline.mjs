/* RUN-090: one track row with 1–2 source buttons and the iframe inline. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),player=read('public-song-ui.js');
new vm.Script(player);
const window={},events=[];
function node(tag='div'){
 return {tagName:tag,className:'',textContent:'',children:[],style:{},attributes:{},
  appendChild(x){x.parentNode=this;this.children.push(x);return x;},
  removeChild(x){this.children.splice(this.children.indexOf(x),1);x.parentNode=null;return x;},
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},
  get firstChild(){return this.children[0]||null;}
 };
}
const document={createElement:node};
vm.runInNewContext(schema,{window,Array,String,Number,Object,JSON,Error},{timeout:1000});
const API=window.VMM_LANDING_SCHEMA;
let stops=0;
window.VMM_PUBLIC_LANDING={stopExternalPlayers(){stops++;}};
vm.runInNewContext(player,{window,document,Array,String,Number,Math,Error},{timeout:1000});
const yt='https://www.youtube.com/watch?v=ABCDEFGHIjk';
const spotify='https://open.spotify.com/track/0123456789ABCDEFGHIJKL';
const dual=API.languageTrack({
 title:'Аа Velar Superstar',artist:'Velar',provider:'spotify',url:spotify,
 alternateProvider:'youtube',alternateUrl:yt},1);
const tracks=[dual];
for(let i=1;i<28;i++)tracks.push({
 title:'Музыка '+i,artist:'Velar',provider:'spotify',
 url:'https://open.spotify.com/track/'+String(i).padStart(22,'0')
});
const mediaFrame=host=>{
 const first=host.children[0];
 return first&&first.tagName==='iframe'?first:first&&first.children[0];
};
const list=node(),app=window.VELAR_PUBLIC_SONGS.mount(list,tracks,{prefix:'topic',batch:12});
// RUN-104: sorting does not overwrite the caller's source list.
assert.equal(tracks[0].title,'Аа Velar Superstar');
assert.equal(tracks[11].title,'Музыка 11');
assert.equal(list.children.length,13,'First 12 songs plus show-more button');
const first=list.children[0];
assert.equal(first.children.length,3,'One song row has label, source controls, inline slot');
assert.equal(first.children[1].children.length,2,'Spotify and YouTube belong to ONE composition');
assert.equal(first.children[1].children[0].textContent,'',
 'Main play button is a CSS vector circle, not an oversized Spotify/emoji label');
assert.equal(first.children[1].children[1].textContent,'YouTube',
 'Secondary source is a compact labeled button on SAME row');
assert.equal(first.children[2].children.length,0,'Nothing loads before visitor click');
assert.equal(typeof window.VELAR_PUBLIC_SONGS.mount,'function');
first.children[0].children[1].onclick();
assert.equal(stops,1);
assert.equal(mediaFrame(first.children[2]).tagName,'iframe');
assert.equal(first.children[2].children[0].className,'spotify-embed-viewport',
 'Spotify iframe must sit inside a cropped viewport rather than expose pale corners');
assert.equal(mediaFrame(first.children[2]).src,'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
assert.equal(first.children[0].children[1].attributes['aria-pressed'],'true');
// RUN-092: click on selected song row again to stop external playback.
first.children[0].children[1].onclick();
assert.equal(first.children[2].children.length,0,'Second title click must unload Spotify iframe');
assert.equal(first.children[1].children[0].attributes['aria-pressed'],'false');
assert.equal(first.children[0].children[1].attributes['aria-pressed'],'false');
first.children[0].children[1].onclick();
assert.equal(mediaFrame(first.children[2]).tagName,'iframe','Third click reopens primary');
assert.equal(mediaFrame(first.children[2]).attributes.allow.includes('autoplay'),false);
assert.equal(list.children[1].children[2].children.length,0);
const originalIframe=mediaFrame(first.children[2]);
const more=list.children[12];
more.onclick();
assert.equal(list.children.length,25,'Second batch appends without moving first row');
assert.equal(mediaFrame(first.children[2]),originalIframe,'Adding more tracks NEVER resets active player');
assert.equal(stops,2,'More does not restart external player');
first.children[1].children[1].onclick();
assert.equal(mediaFrame(first.children[2]).src,'https://www.youtube-nocookie.com/embed/ABCDEFGHIjk');
assert.equal(first.children[1].children[1].attributes['aria-pressed'],'true');
assert.equal(first.children[1].children[0].attributes['aria-pressed'],'false');
assert.equal(stops,3);
first.children[1].children[1].onclick();
assert.equal(first.children[2].children.length,0,'Second click on selected YouTube choice stops iframe');
assert.equal(first.children[1].children[1].attributes['aria-pressed'],'false');
first.children[1].children[0].onclick();
assert.equal(mediaFrame(first.children[2]).src,'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
// Clicking a different source must SWITCH, never toggle off the whole row.
first.children[1].children[1].onclick();
assert.equal(mediaFrame(first.children[2]).src,'https://www.youtube-nocookie.com/embed/ABCDEFGHIjk');
first.children[0].children[1].onclick();
assert.equal(first.children[2].children.length,0,'Song title closes either primary or secondary iframe');
const last=tracks[27];
assert.equal(app.openByUrl(last.url),true,'Deep link to song beyond initial batch opens exact track');
assert.equal(list.children.length,28);
assert.equal(first.children[2].children.length,0,'Last song closes first inline player');
const lastRow=list.children[27];
assert.equal(mediaFrame(lastRow.children[2]).src,
 'https://open.spotify.com/embed/track/'+String(27).padStart(22,'0'));
lastRow.children[2].children[2].onclick();
assert.equal(lastRow.children[2].children.length,0,'Close destroys iframe');
assert.equal(app.openByUrl(last.url),true,'Chat deep link explicitly opens again after a close');
assert.equal(app.openByUrl(last.url),true,'Repeated chat action must OPEN, not toggle off');
assert.equal(mediaFrame(lastRow.children[2]).tagName,'iframe');
app.close();
assert.equal(app.openByUrl('https://drive.google.com/file/d/private'),false,
 'Private Drive URLs never produce a player');
assert.equal(window.VELAR_PUBLIC_SONGS.approved({
 provider:'spotify',url:'https://drive.google.com/file/d/private'}).length,0);
const other=node(),otherApp=window.VELAR_PUBLIC_SONGS.mount(other,[dual],{prefix:'language',batch:14});
other.children[0].children[1].children[0].onclick();
assert.equal(other.children[0].children[2].children.length,3);
assert.equal(app.openByUrl(spotify),true);
assert.equal(other.children[0].children[2].children.length,0,
 'Only one player across topic and language sections');
assert.match(read('style.css'),/\.public-song-inline:not\(:empty\)/);
const maskCSS=read('style.css');
assert.match(maskCSS,/\.spotify-embed-viewport\{[\s\S]*?overflow:hidden/);
assert.match(maskCSS,/\.spotify-embed-viewport>\.cms-music-iframe/);
assert.match(maskCSS,/top:-8px;left:-8px/);
assert.match(maskCSS,/\.spotify-embed-viewport--compact\{height:152px\}/);
const mobileCSS=read('style.css');
assert.match(mobileCSS,/\.public-song-source\.is-primary::before\{/,
 'Old gold play triangle is drawn as CSS, not device emoji');
assert.match(mobileCSS,/\.public-song-source\.is-primary\{[\s\S]*?border-radius:50%/,
 'Primary source must be compact and round');
assert.doesNotMatch(mobileCSS,/\.public-song-platforms\{flex:1 1 100%/,
 'Mobile sources cannot turn into a full-width Spotify button');
assert.doesNotMatch(mobileCSS,/\.public-song-source\{flex:1 1 100px/,
 'Mobile source buttons cannot grow to the entire width');
assert.match(read('index.html'),/public-song-ui\.js\?v=5/);
console.log('PASS: RUN-090 Spotify/YouTube inline single-row player, long lists, safe deep links, one active iframe');
