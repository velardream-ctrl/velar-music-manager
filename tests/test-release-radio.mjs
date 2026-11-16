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
assert.equal(radio.children[0].attributes['aria-expanded'],'false','Initial home radio is minimized');
assert.match(radio.children[0].attributes['aria-label'],/Развернуть/,'Orb is accessible by name');
assert.match(css,/assets\/velar-radio-icon\.webp/,'Approved circular logo is rendered');
assert.equal(radio.children.length,4);
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,0);
radio.children[0].onclick();
const help=radio.children[3];
assert.equal(help.tagName,'details');
assert.match(help.children[0].attributes['aria-label'],/установить/);
const radioPanel=radio.children[1];
const startRadio=radioPanel.children[2];
startRadio.onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe').length,1);
assert.equal(doc.querySelectorAll('iframe.cms-release-iframe').length,0,'Opening radio closes the release player');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src,
 'https://open.spotify.com/embed/playlist/11Vdx5lXmtfMiXh63YhIwh');
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0].parentNode.className,
 'spotify-embed-viewport','Spotify radio uses the same masking component');
startRadio.onclick();
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
assert.doesNotMatch(publicJS,/autoplay=1|loop=1|muted=1/);
// The single modal-only clock updates the seek position and is destroyed on close.
assert.equal((publicJS.match(/setInterval\(/g)||[]).length,1);
assert.match(publicJS,/if\(clock!==null\)window.clearInterval\(clock\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/.cms-release-art::before/);
assert.match(css,/\.velar-radio--bubble/);
assert.match(css,/min-height:200px/);
assert.match(html,/universe\.js\?v=7/);
assert.match(html,/style\.css\?v=72/);
assert.match(sw,/CACHE_PREFIX \+ 'v81'/);
assert.match(sw,/STUDIO_PREFIX\+'v51'/);
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
choice.value='appleMusic';choice.onchange();listen.onclick();
assert.equal(doc.querySelectorAll('iframe.velar-radio-iframe')[0].src,apple.replace('music.apple','embed.music.apple'));


// RUN-163: regression for the right-side drag anchor and the draggable logo.
assert.match(css,/\.velar-radio-panel\{/);
assert.match(css,/@keyframes velar-radio-glow/);
assert.match(css,/touch-action:none/);
assert.match(css,/prefers-reduced-motion:reduce/);
const moveStart=publicJS.indexOf(' function radioMove(');
const moveEnd=publicJS.indexOf(' function stationHelp(',moveStart);
assert.ok(moveStart>=0&&moveEnd>moveStart,'The radio movement helper is present');
const listeners={};
const fakeWindow={
 innerWidth:390,innerHeight:844,
 addEventListener(type,fn){listeners[type]=fn;},
 removeEventListener(type,fn){if(listeners[type]===fn)delete listeners[type];}
};
function draggable(){
 return {className:'',style:{},events:{},
  addEventListener(type,fn){this.events[type]=fn;},
  removeEventListener(type,fn){if(this.events[type]===fn)delete this.events[type];},
  getBoundingClientRect(){
   const bubble=this.className.indexOf('velar-radio--bubble')!==-1;
   const width=bubble?68:365,height=bubble?68:245;
   const rightOffset=Number.parseFloat(this.style.right)||12;
   const top=Number.parseFloat(this.style.top)||50;
   return {width,height,left:390-rightOffset-width,right:390-rightOffset,top,bottom:top+height};
  }
 };
}
const movingHost=draggable(),grip=draggable(),movingOrb=draggable();
movingHost.className='velar-radio';
const movingContext={window:fakeWindow,stopRadioMove:null,Date};
const moveHelper=vm.runInNewContext('('+publicJS.slice(moveStart,moveEnd).trim()+')',movingContext,{timeout:1000});
const ignoreDragClick=moveHelper(movingHost,grip,movingOrb);
grip.events.mousedown({button:0,clientX:350,clientY:65,cancelable:true,preventDefault(){}});
listeners.mousemove({clientX:295,clientY:180,cancelable:true,preventDefault(){}});
listeners.mouseup();
const wideRight=movingHost.getBoundingClientRect().right;
const wideTop=movingHost.getBoundingClientRect().top;
movingHost.className='velar-radio velar-radio--bubble';
ignoreDragClick.sync();
const smallRect=movingHost.getBoundingClientRect();
assert.equal(smallRect.right,wideRight,'Collapsing keeps the same right-side grip position');
assert.equal(smallRect.top,wideTop,'Collapsing keeps the same top coordinate');
assert.equal(movingHost.style.left,'auto','Never anchor the small logo to the wide panel left edge');
movingOrb.events.touchstart({touches:[{clientX:smallRect.right-25,clientY:smallRect.top+30}]});
listeners.touchmove({touches:[{clientX:smallRect.right-70,clientY:smallRect.top+65}],cancelable:true,preventDefault(){}});
listeners.touchend();
assert.equal(movingHost.getBoundingClientRect().right,smallRect.right-45,'Touch dragging the orb changes its position');
assert.equal(ignoreDragClick(),true,'Drag must not trigger an expand click');
assert.equal(ignoreDragClick(),false,'A subsequent tap still opens the logo');
const previousRight=movingHost.getBoundingClientRect().right;
movingHost.className='velar-radio';
ignoreDragClick.sync();
const expanded=movingHost.getBoundingClientRect();
assert.ok(expanded.left>=0,'Expanded panel stays inside narrow iPhone viewport');
assert.ok(expanded.right<=390,'Expanded panel stays within viewport');
movingContext.stopRadioMove();
assert.equal(Object.keys(listeners).length,0,'Drag listeners are cleaned up');
