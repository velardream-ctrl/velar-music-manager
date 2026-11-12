import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('landing-schema.js'),publicJS=read('landing-public.js');
const universeJS=read('universe.js'),html=read('index.html');
const sw=read('sw.js'),css=read('style.css'),admin=read('studio/landing-editor.js');
const window={};
vm.runInNewContext(schema,{window,Array,String,Number,Object,JSON,Error},{timeout:1000});
const api=window.VMM_LANDING_SCHEMA;
const link='https://open.spotify.com/playlist/11Vdx5lXmtfMiXh63YhIwh';
const profile='https://open.spotify.com/artist/1PNzGsDcFVuOMBN7Gw12tw';
assert.equal(api.playlistUrl(link+'?si=abc&utm_source=copy','spotify'),link);
assert.equal(api.subscriptionUrl(profile+'?si=ignored','spotify'),profile);
assert.equal(api.playlistUrl('https://drive.google.com/file/d/private','spotify'),'');
assert.equal(api.playlistUrl('https://open.spotify.com/track/0123456789ABCDEFGHIJKL','spotify'),'');
assert.equal(api.playlistUrl('https://example.com/malicious?list=abc','youtube'),'');
assert.equal(api.releaseMediaUrl('https://open.spotify.com/album/0123456789ABCDEFGHIJKL?si=hi','spotify'),
 'https://open.spotify.com/album/0123456789ABCDEFGHIJKL');
assert.equal(api.releaseMediaUrl('javascript:alert(1)','spotify'),'');
assert.throws(()=>api.radioConfig({enabled:true,url:'https://example.com/playlist/invalid'}),/официальную ссылку/);
const d=api.defaults();
assert.equal(d.releases.radio.enabled,false,'RADIO is disabled by default');
assert.equal(d.releases.radio.controlVersion,2);
const legacy={...d.releases.radio,enabled:true};delete legacy.controlVersion;
assert.equal(api.radioConfig(legacy).enabled,false,'Legacy published enabled:true does NOT reactivate radio');
assert.equal(api.radioConfig({...legacy,controlVersion:2}).enabled,true,'Owner can re-enable radio explicitly');
assert.equal(d.releases.playlists[0].url,link);
assert.equal(d.releases.subscriptions[0].url,profile);
const release=(x)=>({...api.blankCard(),title:'Белая берёза',subtitle:'DJ Velar',visible:true,
 mediaProvider:'spotify',mediaUrl:'https://open.spotify.com/track/0123456789ABCDEFGHIJKL',kind:'single',...x});
const page=api.normalize({...d,releases:{...d.releases,
 radio:{...d.releases.radio,enabled:true,controlVersion:2},cards:[
 release({spotlight:'music'}),release({title:'Журавли',kind:'video',mediaProvider:'youtube',
   mediaUrl:'https://youtu.be/ABCDEFGHIjk',spotlight:'video'}),
 release({title:'Северный олень',kind:'album',mediaUrl:'https://open.spotify.com/album/ABCDEFGHIJKLMNOPQRSTUV'})
 ]}});
assert.equal(page.releases.radio.url,link);
assert.equal(page.releases.cards[1].kind,'video');
assert.equal(page.releases.cards[1].mediaUrl,'https://www.youtube.com/watch?v=ABCDEFGHIjk');
assert.doesNotMatch(JSON.stringify(page),/privateToken|driveFileId|lyrics|fileBytes/);
assert.throws(()=>api.normalize({...d,releases:{...d.releases,cards:[release({
 mediaProvider:'spotify',mediaUrl:'https://drive.google.com/file/d/private'
})]}}),/прямая ссылка/);
assert.throws(()=>api.normalize({...d,releases:{...d.releases,cards:[release({
 kind:'video',mediaProvider:'spotify'
})]}}),/YouTube/);
const map={};
function el(tag='div'){
 const n={tagName:tag,children:[],className:'',textContent:'',style:{},attributes:{},
   setAttribute(k,v){this.attributes[k]=v;},
   getAttribute(k){return this.attributes[k];},
   appendChild(child){child.parentNode=this;this.children.push(child);return child;},
   removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parentNode=null;},
   get firstChild(){return this.children[0]||null;},
   set innerHTML(t){this._html=t;this.children=[];},
   get innerHTML(){return this._html||'';}
 };
 return n;
}
const keys=['public-hero-subtitle','public-hero-intro','artists-title','public-artists-intro',
 'releases-title','public-releases-intro','genres-title','public-genres-intro','about-title',
 'public-about-intro','public-about-notice','public-genres-tags','public-artists-cards',
 'public-releases-cards','public-playlists-cards','public-subscriptions','velar-radio',
 'velar-universe-toggle','velar-universe-panel','velar-universe-stage','velar-universe-details'];
for(const id of keys)map[id]=el();
map['public-artists-cards'].innerHTML='СКОРО';
map['public-releases-cards'].innerHTML='СКОРО';
map['public-releases-cards'].className='feature feature-releases';
const roots=Object.values(map);
const walk=(n,cb)=>{cb(n);for(const child of n.children)walk(child,cb);};
const doc={readyState:'complete',getElementById:id=>map[id]||null,createElement:el,
  querySelectorAll(selector){
    const classes=selector.split(',').map(x=>x.trim().split('.')[1]).filter(Boolean);
    const list=[];for(const root of roots)walk(root,node=>{
      if(node.tagName==='iframe'&&classes.some(c=>(' '+node.className+' ').includes(' '+c+' ')))list.push(node);
    });return [...new Set(list)];
  }};
window.matchMedia=()=>({matches:false});
vm.runInNewContext(universeJS,{window,document:doc,Math,Array,String,Number,Error},{timeout:1000});
let observer=null;
const firebase={apps:[{}],firestore(){return {collection(){return {doc(){return {
 onSnapshot(fn){observer=fn;}
 };}};}};}};
window.firebase=firebase;window.VELAR_FIREBASE_CONFIG={projectId:'demo'};
vm.runInNewContext(publicJS,{window,document:doc,firebase,Array,String,Object,Error},{timeout:1000});
assert.equal(typeof observer,'function');
observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:page})});
const gallery=map['public-releases-cards'];
assert.equal(gallery.className,'cms-release-showcase');
const featured=gallery.children[0];
assert.equal(featured.className,'cms-release-features');
assert.equal(featured.children.length,2);
assert.match(featured.children[1].children[0].className,/cms-release-art--video/);
assert.equal(gallery.children[2].className,'cms-release-grid');
assert.equal(gallery.children[2].children.length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0);
const musicBtn=featured.children[0].children[1].children[3].children[0];
assert.equal(musicBtn.tagName,'button');
musicBtn.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe')[0].src,
 'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
// RUN-092: opening control is also the closing control on repeat press.
musicBtn.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0,'Repeat release click unloads Spotify iframe');
assert.equal(musicBtn.attributes['aria-pressed'],'false');
musicBtn.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1,'Third release click reopens it');
const radio=map['velar-radio'];assert.equal(radio.className,'velar-radio');
assert.equal(radio.children.length,2);
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0);
radio.children[0].onclick();
const radioPanel=radio.children[1];
const startRadio=radioPanel.children[2];
startRadio.onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0,'Opening radio closes the release player');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src,
 'https://open.spotify.com/embed/playlist/11Vdx5lXmtfMiXh63YhIwh');
startRadio.onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0,'Repeat radio start click unloads iframe');
assert.equal(startRadio.attributes['aria-pressed'],'false');
startRadio.onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
radio.children[0].onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0,'Closing radio destroys iframe');
// RUN-086: a real click on the assistant's radio action reuses the safe radio UI.
assert.equal(window.VMM_PUBLIC_LANDING.openRadioFromChat(),true);
assert.equal(radio.children[0].attributes['aria-expanded'],'true');
assert.match(radio.className,/velar-radio--chat-open/);
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
assert.equal(window.VMM_PUBLIC_LANDING.openRadioFromChat(),true,
 'Asking again in chat must not toggle the playing radio off');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
radio.children[0].onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0);
assert.doesNotMatch(radio.className,/velar-radio--chat-open/);
assert.equal(map['public-playlists-cards'].children.length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0);
const openPlaylist=map['public-playlists-cards'].children[0].children[1].children[3].children[0];
openPlaylist.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1);
openPlaylist.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0,'Repeat playlist click unloads iframe');
assert.equal(openPlaylist.attributes['aria-pressed'],'false');
openPlaylist.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1);
assert.equal(map['public-subscriptions'].children[0].href,profile);
const toggle=map['velar-universe-toggle'];assert.equal(map['velar-universe-stage'].children.length,0);
toggle.onclick();
assert.equal(toggle.attributes['aria-expanded'],'true');
const constellation=map['velar-universe-stage'];
assert.equal(constellation.children.length,9,'Eight editable constellations and the official crystal core');
const crystalCore=constellation.children[0];
assert.equal(crystalCore.tagName,'button');
assert.equal(crystalCore.children[1].src,'assets/velardream-symbol.svg',
  'Universe center must be the existing official crystal logo, never a generated planet');
assert.match(crystalCore.attributes['aria-label'],/Кристалл VELARDREAM/);
const selected=constellation.children[2];
selected.onclick();
assert.equal(selected.attributes['aria-pressed'],'true');
assert.match(map['velar-universe-details'].children[1].textContent,/Релизы/);
constellation.children[3].onclick();
assert.equal(constellation.children[3].attributes['aria-pressed'],'true');
crystalCore.onclick();
assert.equal(constellation.children[1].attributes['aria-pressed'],'true','Touching the crystal returns to artists');
assert.equal(window.VELAR_UNIVERSE.counts(page).videos,1);
toggle.onclick();
assert.equal(toggle.attributes['aria-expanded'],'false');
const disabledPage={...page,releases:{...page.releases,radio:{...page.releases.radio,enabled:false}}};
observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:disabledPage})});
assert.equal(map['velar-radio'].className,'velar-radio hidden');
assert.equal(window.VMM_PUBLIC_LANDING.openRadioFromChat(),false,'disabled radio cannot launch from chat');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0,'Disabling always unloads the official external player');
assert.doesNotMatch(universeJS,/setInterval\(|setTimeout\(|getContext\(['"]webgl|requestAnimationFrame\(|fetch\(|firestore\(/);
assert.doesNotMatch(publicJS,/autoplay=1|loop=1|muted=1|setInterval\(/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/.cms-release-art::before/);
assert.match(html,/universe\.js\?v=5/);
assert.match(html,/style\.css\?v=27/);
assert.match(sw,/CACHE_PREFIX \+ 'v32'/);
assert.match(sw,/STUDIO_PREFIX\+'v30'/);
assert.match(admin,/function releaseCatalogPicker/);
assert.match(admin,/function playAndFollowEditor/);
console.log('PASS: RUN-069/070 safe releases, Spotify playlists, subscribers, opt-in radio, one active iframe and lazy 2.5D universe');
