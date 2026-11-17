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
assert.equal(d.releases.radio.visual.mode,'heartbeat');
assert.equal(d.releases.radio.visual.spread,20);
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
   insertBefore(child,before){child.parentNode=this;this.children.splice(this.children.indexOf(before),0,child);},
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
// RUN-150: one video action; modern browsers still play in-card.
const videoCard=featured.children[1],videoActions=videoCard.children[1].children[3];
assert.equal(videoActions.children.length,2,'Inline play and expanded overlay are distinct actions');
const videoPrimary=videoActions.children[0];
assert.equal(videoPrimary.tagName,'button');
videoPrimary.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe')[0].src,
 'https://www.youtube-nocookie.com/embed/ABCDEFGHIjk');
const videoPlayer=videoCard.children[0].children[videoCard.children[0].children.length-1];
assert.equal(videoCard.children.length,2);
assert.equal(videoPlayer.children[0].tagName,'iframe');
assert.equal(videoPlayer.children[1].textContent,'Закрыть плеер');
videoPrimary.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0);
videoPrimary.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1);
videoPlayer.children[1].onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0);
const musicActions=featured.children[0].children[1].children[3];
assert.equal(musicActions.children[1].tagName,'a',
 'Spotify keeps its existing explicit external link');
assert.equal(musicActions.children[1].target,'_blank');
assert.match(css,/\.cms-release-inline-link::after\{display:none\}/);
const musicBtn=featured.children[0].children[1].children[3].children[0];
assert.equal(musicBtn.tagName,'button');
musicBtn.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe')[0].src,
 'https://open.spotify.com/embed/track/0123456789ABCDEFGHIJKL');
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe')[0].parentNode.className,
 'spotify-embed-viewport','Large Spotify release player hides rounded corner artifacts');
// RUN-092: opening control is also the closing control on repeat press.
musicBtn.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0,'Repeat release click unloads Spotify iframe');
assert.equal(musicBtn.attributes['aria-pressed'],'false');
musicBtn.onclick();
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,1,'Third release click reopens it');
const radio=map['velar-radio'];assert.equal(radio.className,'velar-radio velar-radio--bubble');
assert.equal(radio.children[0].children.find(c=>c.className==='velar-radio-halo').style.top,'-13.6px',
 'New default 20% equals a 13.6px halo radius on a 68px emblem');
assert.equal(radio.attributes['data-radio-effect'],'heartbeat');
assert.equal(radio.attributes['data-radio-player-open'],'false');
assert.ok(radio.children[0].children.some(c=>c.className==='velar-radio-halo'));
assert.equal(radio.children[0].attributes['aria-expanded'],'false','Initial home radio is minimized');
assert.match(radio.children[0].attributes['aria-label'],/Развернуть/,'Orb is accessible by name');
assert.match(css,/assets\/velar-radio-icon-gold-bold\.png/,'Approved circular logo is rendered even on old Safari');
assert.equal(radio.children.length,4);
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0);
radio.children[0].onclick();
const help=radio.children[3];
assert.equal(help.tagName,'details');
assert.match(help.children[0].attributes['aria-label'],/установить/);
const radioPanel=radio.children[1];
const startRadio=radioPanel.children[2];
startRadio.onclick();
assert.equal(radio.attributes['data-radio-player-open'],'true');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0,'Opening radio closes the release player');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src,
 'https://open.spotify.com/embed/playlist/11Vdx5lXmtfMiXh63YhIwh');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0].parentNode.className,
 'spotify-embed-viewport','Spotify radio uses the same masking component');
startRadio.onclick();
assert.equal(radio.attributes['data-radio-player-open'],'false');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0,'Repeat radio start click unloads iframe');
assert.equal(startRadio.attributes['aria-pressed'],'false');
startRadio.onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
const beforeMinimize=doc.querySelectorAll('iframe.velar-radio-iframe')[0];
radio.children[0].onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1,'Minimizing keeps the official iframe');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],beforeMinimize,'Iframe identity stays stable');
assert.match(radioPanel.className,/velar-radio-panel--mini/);
assert.equal(radio.children[0].attributes['aria-expanded'],'false');
radio.children[0].onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],beforeMinimize,'Expanding does not restart a song');
// RUN-158: the old tiny cloud control returns, without unmounting a playing embed.
const cloud=radioPanel.children.find(c=>c.className==='velar-radio-bubble-action');
assert.ok(cloud,'A dedicated minimize-to-cloud control exists on the homepage');
cloud.onclick();
assert.match(radio.className,/velar-radio--bubble/,'Radio shrinks to cloud mode');
assert.equal(radio.children[0].attributes['aria-expanded'],'false');
assert.match(radioPanel.className,/velar-radio-panel--mini/,'Playing media stays visibly accessible');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],beforeMinimize,'Cloud preserves the same iframe');
radio.children[0].onclick();
assert.doesNotMatch(radio.className,/velar-radio--bubble/,'Cloud opens the main radio');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],beforeMinimize,'Opening cloud never restarts song');
assert.equal(radio.children[0].attributes['aria-expanded'],'true');
radio.children[0].onclick();
// RUN-086: a real click on the assistant's radio action reuses the safe radio UI.
assert.equal(window.VMM_PUBLIC_LANDING.openRadioFromChat(),true);
assert.equal(radio.children[0].attributes['aria-expanded'],'true');
assert.match(radio.className,/velar-radio--chat-open/);
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
assert.equal(window.VMM_PUBLIC_LANDING.openRadioFromChat(),true,
 'Asking again in chat must not toggle the playing radio off');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
radio.children[0].onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1,'Chat-open player survives minimizing');
assert.doesNotMatch(radio.className,/velar-radio--chat-open/);
const radioBeforeSnapshot=doc.querySelectorAll('iframe.velar-radio-iframe')[0];
observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:page})});
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],radioBeforeSnapshot,'Unchanged snapshot preserves playback');
const liveVisual={...page,releases:{...page.releases,radio:{...page.releases.radio,
  visual:{mode:'broadcast',intensity:5,spread:100}}}};
observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:liveVisual})});
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],radioBeforeSnapshot,
 'Changing only the halo via published Studio settings must not restart a playing iframe');
assert.equal(radio.attributes['data-radio-effect'],'broadcast');
assert.equal(radio.attributes['data-radio-intensity'],'5');
assert.equal(radio.attributes['data-radio-spread'],'100');
assert.equal(radio.children[0].children.find(c=>c.className==='velar-radio-halo').style.top,'-68px');
for(const spread of [1,37,42,75,99]){
 const custom={...page,releases:{...page.releases,radio:{...page.releases.radio,
   visual:{mode:'broadcast',intensity:5,spread}}}};
 observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:custom})});
 assert.equal(radio.attributes['data-radio-spread'],String(spread));
 assert.equal(radio.children[0].children.find(c=>c.className==='velar-radio-halo').style.top,
   -(68*spread/100)+'px','The aura radius must match the selected percentage');
 assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],radioBeforeSnapshot,
   'The current song cannot restart because the halo radius changed');
}
observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:page})});
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0],radioBeforeSnapshot,
 'Restoring the default glow does not restart playback');
radio.children[0].onclick();
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
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe')[0].parentNode.className,'spotify-embed-viewport');
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
// Explicit manual Next may request autoplay after a user click. The initial
// radio-open action must not request autoplay without a Play gesture.
const radioOpenStart=publicJS.indexOf('   open.onclick=function(){',publicJS.indexOf(' function renderRadio('));
const radioOpenEnd=publicJS.indexOf('   panel.appendChild(open);',radioOpenStart);
assert.ok(radioOpenStart>=0&&radioOpenEnd>radioOpenStart);
assert.doesNotMatch(publicJS.slice(radioOpenStart,radioOpenEnd),/autoplay=1|muted=1/);
// The single modal-only clock updates the seek position and is destroyed on close.
assert.equal((publicJS.match(/setInterval\(/g)||[]).length,1);
assert.match(publicJS,/if\(clock!==null\)window.clearInterval\(clock\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/.cms-release-art::before/);
assert.match(css,/\.velar-radio--bubble/);
assert.match(css,/min-height:200px/);
assert.match(html,/universe\.js\?v=7/);
assert.match(html,/style\.css\?v=82/);
assert.match(sw,/CACHE_PREFIX \+ 'v94'/);
assert.match(sw,/STUDIO_PREFIX\+'v56'/);
assert.match(admin,/function releaseCatalogPicker/);
assert.match(admin,/function playAndFollowEditor/);
console.log('PASS: RUN-069/070 safe releases, Spotify playlists, subscribers, opt-in radio, one active iframe and lazy 2.5D universe');
// RUN-155: iOS12 main action restores a modal button, never a watch navigation.
window.VMM_YOUTUBE_COMPAT={required:()=>true};
observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:page})});
const legacyVideo=map['public-releases-cards'].children[0].children[1];
const legacyActions=legacyVideo.children[1].children[3];
assert.equal(legacyActions.children.length,1);
assert.equal(legacyActions.children[0].tagName,'button');
assert.equal(legacyActions.children[0].href,undefined);
assert.equal(legacyActions.children[0].children[1].textContent,'Смотреть клип');

// A saved schedule without a fallback playlist opens only on listener input.
window.VMM_YOUTUBE_COMPAT={required:()=>false};
window.setTimeout=()=>1;window.clearTimeout=()=>{};
const tracks=[{url:'https://youtu.be/ABCDEFGHIjk',title:'Первая',seconds:180},
 {url:'https://youtu.be/abcdefghijk',title:'Вторая',seconds:120}];
const scheduled={...page,releases:{...page.releases,radio:{...page.releases.radio,url:'',tracks}}};
assert.throws(()=>api.radioConfig({...scheduled.releases.radio,tracks:[tracks[0],tracks[0]]}),/повторы/);
observer({exists:true,data:()=>({status:'published',schemaVersion:1,content:scheduled})});
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0);
assert.match(radio.children[0].children.at(-1).textContent,/В эфире · (Первая|Вторая)/);
radio.children[0].onclick();
radio.children[1].children[2].onclick();
assert.match(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src,/^https:\/\/www.youtube-nocookie.com\/embed\/[A-Za-z]{11}\?start=\d+/);

// The installable page reads the same station, ignores the homepage collapse
// preference, and keeps playback intact on unrelated published-page updates.
map['station-page']=el();map['station-status']=el();
const stationPage={...page,releases:{...page.releases,radio:{...page.releases.radio,title:'Station'}}};
window.VMM_PUBLIC_LANDING.render(stationPage);
assert.equal(radio.children[0].getAttribute('aria-expanded'),'true');
assert.equal(radio.children.length,2);
radio.children[1].children[2].onclick();
const stationPlayer=radio.children[1].children[3].firstChild;
window.VMM_PUBLIC_LANDING.render(stationPage);
assert.equal(radio.children[1].children[3].firstChild,stationPlayer);
window.VMM_PUBLIC_LANDING.render(disabledPage);
assert.equal(radio.className,'velar-radio hidden');
assert.match(map['station-status'].textContent,/выключено/);

const checked=['youtube','spotify','appleMusic'];
const apple='https://music.apple.com/fi/album/test/123?i=456';
const collected=api.radioCatalog(page,[{links:{youtube:tracks[0].url,apple,spotify:'https://example.com/private'},secret:'private'},
 {links:{youtube:tracks[1].url}},{links:{youtube:tracks[0].url}}],checked);
assert.equal(collected.youtube.length,2);
assert.equal(collected.appleMusic[0],apple);
assert.doesNotMatch(JSON.stringify(collected),/example.com|private/);
const catalogPage={...page,releases:{...page.releases,radio:{...scheduled.releases.radio,sources:checked,catalog:collected}}};
window.VMM_PUBLIC_LANDING.render(catalogPage);
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0);
const catalogPanel=radio.children[1],choice=catalogPanel.children.find(c=>c.tagName==='select');
const listen=catalogPanel.children.find(c=>c.className==='velar-radio-start');
listen.onclick();
const videoURL=new URL(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src);
assert.deepEqual([videoURL.pathname.split('/').pop(),videoURL.searchParams.get('playlist')].sort(),['ABCDEFGHIjk','abcdefghijk']);
const youtubeNext=catalogPanel.children.find(c=>c.className==='velar-radio-player')
 .children.find(c=>c.className==='velar-radio-next');
assert.ok(youtubeNext,'YouTube radio must have a manual Next button');
const previousVideo=doc.querySelectorAll('iframe.velar-radio-iframe')[0].src;
youtubeNext.onclick();
assert.notEqual(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src,previousVideo,
 'When IFrame API is unavailable, an explicit YouTube Next still changes the clip');
choice.value='appleMusic';choice.onchange();listen.onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src,apple.replace('music.apple','embed.music.apple'));


// RUN-164: gold logo, subtle animation and stable drag coordinates (desktop/touch).
assert.match(css,/assets\/velar-radio-icon-gold-bold\.png/);
assert.match(css,/@keyframes velar-radio-heartbeat/);
const boldRadioLogo=fs.readFileSync(new URL('../assets/velar-radio-icon-gold-bold.png',import.meta.url));
assert.equal(boldRadioLogo.toString('hex',0,8),'89504e470d0a1a0a','Bold radio icon uses old-Safari-compatible PNG');
assert.equal(boldRadioLogo.toString('ascii',12,16),'IHDR','PNG image contains IHDR header');
assert.ok(boldRadioLogo.length<12000,'Small radio badge remains light to download');
assert.match(css,/animation:velar-radio-heartbeat 2\.65s/);
assert.match(css,/animation-play-state:paused/);
assert.match(css,/transform:scale\(1\.065\)/);
assert.match(css,/velar-radio-panel-appear/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(sw,/assets\/velar-radio-icon-gold-bold\.png/);
const radioDragStart164=publicJS.indexOf(' function radioMove(');
const radioDragEnd164=publicJS.indexOf(' function stationHelp(',radioDragStart164);
assert.ok(radioDragStart164>=0&&radioDragEnd164>radioDragStart164);
const listeners164={};
const win164={innerWidth:390,innerHeight:844,
 addEventListener(k,fn){listeners164[k]=fn;},
 removeEventListener(k,fn){if(listeners164[k]===fn)delete listeners164[k];}};
function fakeMoveElement164(name){
 return {className:name,style:{},events:{},
 addEventListener(k,fn){this.events[k]=fn;},
 removeEventListener(k,fn){if(this.events[k]===fn)delete this.events[k];},
 getBoundingClientRect(){
  const bubble=this.className.indexOf('velar-radio--bubble')>=0;
  const width=bubble?68:365,height=bubble?68:270;
  const offset=this.style.right?parseFloat(this.style.right):12;
  const top=this.style.top?parseFloat(this.style.top):40;
  return {width,height,top,left:390-offset-width,right:390-offset,bottom:top+height};
 }};
}
const host164=fakeMoveElement164('velar-radio velar-radio--bubble'),
 grip164=fakeMoveElement164('velar-radio-grip'),orb164=fakeMoveElement164('velar-radio-toggle');
const context164={window:win164,Date};
const move164=vm.runInNewContext('('+publicJS.slice(radioDragStart164,radioDragEnd164).trim()+')',
 context164,{timeout:1000});
const control164=move164(host164,grip164,orb164);
const initial164=host164.getBoundingClientRect();
orb164.events.touchstart({touches:[{clientX:initial164.right-20,clientY:initial164.top+30}]});
listeners164.touchmove({touches:[{clientX:initial164.right-120,clientY:initial164.top+90}],
 cancelable:true,preventDefault(){}});
listeners164.touchend();
const orbAfterMove164=host164.getBoundingClientRect();
assert.equal(orbAfterMove164.right,initial164.right-100,'Orb follows touch movement');
assert.equal(control164.ignoreClick(),true,'Finger drag does not immediately expand logo');
assert.equal(control164.ignoreClick(),false,'Normal click will still expand logo');
host164.className='velar-radio';control164.sync();
const expanded164=host164.getBoundingClientRect();
assert.ok(expanded164.left>=0,'Expanded radio stays within iPhone viewport');
assert.ok(expanded164.right<=390);
host164.className='velar-radio velar-radio--bubble';control164.sync();
assert.equal(host164.getBoundingClientRect().right,orbAfterMove164.right,
 'After closing, the floating logo returns to its former right-side position');
host164.className='velar-radio';control164.sync();
const wide164=host164.getBoundingClientRect();
grip164.events.mousedown({button:0,clientX:wide164.right-15,clientY:wide164.top+25,
 cancelable:true,preventDefault(){}});
listeners164.mousemove({clientX:wide164.right-10,clientY:wide164.top+40,
 cancelable:true,preventDefault(){}});
listeners164.mouseup();
const wideMoved164=host164.getBoundingClientRect();
host164.className='velar-radio velar-radio--bubble';control164.sync();
assert.equal(host164.getBoundingClientRect().right,wideMoved164.right,
 'The small logo remains alongside the former right-side wide-panel grip');
assert.equal(host164.style.left,'auto','Do not anchor the small logo to the left edge');
context164.stopRadioMove();
assert.equal(Object.keys(listeners164).length,0,'Radio drag listeners are cleaned up');
