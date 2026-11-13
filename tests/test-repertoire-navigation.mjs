import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const studio=read('studio/studio.js');
const workflows=read('studio/workflows.js');
const rec=read('studio/recordings.js');
const offline=read('studio/offline-repertoire.js');
const html=read('studio/index.html');
const css=read('studio/studio.css');
const recordingsCss=read('studio/recordings.css');
const sw=read('sw.js');

// A new browser session should land on overview, while an authenticated page
// refresh keeps the same section, without writing private lyrics to storage.
assert.match(studio,/return match&&validPanel\(match\[1\]\)\?match\[1\]:'overview'/);
assert.match(studio,/window\.location&&window\.location\.hash/);
assert.match(studio,/window\.history\.replaceState\(null,'',here\.pathname\+here\.search\+'#vmm-'\+p\)/);
assert.match(studio,/section==='recordings'&&window\.VMM_RECORDINGS/);
assert.match(studio,/window\.VMM_WORKFLOWS\.open\(section\)/);
assert.match(studio,/if\(authorized&&authorizedUid===user\.uid\)/);
assert.match(studio,/authorizedUid!==user\.uid/);
assert.ok(!/localStorage\\.setItem|sessionStorage\\.setItem/.test(studio));
assert.match(studio,/window\.history\.replaceState\(null,'',here\.pathname\+here\.search\)/);
assert.match(workflows,/window\.VMM_WORKFLOWS=\{open:open\}/);
assert.match(workflows,/window\.VMM_STUDIO\.rememberPanel\(type\)/);
assert.match(rec,/window\.VMM_STUDIO\.rememberPanel\('recordings'\)/);

// The actual user-scoped IndexedDB contents persist across reload; no audio
// or lyrics enter localStorage/sessionStorage and no Drive OAuth token is saved.
assert.match(offline,/indexedDB\.open\(NAME,2\)/);
assert.match(offline,/META='preferences'/);
assert.match(offline,/function rememberSelection\(uid,catalogId\)/);
assert.match(offline,/function lastSelection\(uid\)/);
assert.ok(!/localStorage|sessionStorage/.test(rec+offline));
assert.match(rec,/function renderOfflineList\(\)/);
assert.match(rec,/function toggleText\(yes\)/);
assert.match(rec,/textVisible=false/);
assert.match(rec,/data-r-action="offline-play"/);
assert.match(rec,/window\.VMM_OFFLINE\.rememberSelection\(user\.uid,t\.id\)/);
assert.match(rec,/renderSongs\(\);renderOfflineList\(\);setSong\(''\)/,'On refresh only the offline list opens; playback requires a click');
assert.match(rec,/toggleText\(true\)/);
assert.match(rec,/id\('vmm-r-toggle-text'\)\.onclick/);
assert.match(rec,/function connect\(force\)/);
assert.match(rec,/connect\(true\)\.then\(ensureFolder\)/);
assert.match(rec,/uploadMessage='Ошибка загрузки: '/);

// Confirm the mobile dock is anchored at bottom:0 and safe area padding
assert.match(css,/#workspace \.sidebar\{\s*position:fixed;left:0;right:0;top:auto;bottom:0/);
assert.match(css,/env\(safe-area-inset-bottom,0px\)/);
assert.match(recordingsCss,/vmm-r-pinned/);
assert.match(recordingsCss,/vmm-r-player-title/);
assert.ok(html.includes('src="studio.js?v=11"'));
assert.ok(html.includes('src="workflows.js?v=7"'));
assert.ok(html.includes('src="recordings.js?v=12"'));
assert.ok(html.includes('src="offline-repertoire.js?v=3"'));
assert.ok(html.includes('href="studio.css?v=23"'));
assert.ok(html.includes('href="recordings.css?v=12"'));
assert.ok(sw.includes("STUDIO_PREFIX+'v39'"));

// Live behavior: exercise controller view and pin behavior, without OAuth.
const elems={};
function create(tag){
 const n={tagName:tag||'DIV',style:{},children:[],value:'',className:'',innerHTML:'',textContent:'',disabled:false,
   setAttribute(){},addEventListener(){},scrollIntoView(){},focus(){},pause(){},load(){},removeAttribute(){},
   appendChild(v){this.children.push(v);},removeChild(v){this.children=this.children.filter(x=>x!==v);}};
 Object.defineProperty(n,'firstChild',{get(){return this.children[0]||null;}});
 return n;
}
const document={
 querySelector:q=>q==='#workspace .workspace-content'?create('SECTION'):null,
 getElementById:id=>(elems[id]??=create()),
 createElement:create
};
const window={};
const snippet=rec.replace(
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={_test:{header:header,set:function(rows,offlineRows){catalog=rows;saved=offlineRows;recordings=offlineRows.map(function(s){return {id:"doc"+s.fileId,driveFileId:s.fileId,catalogId:s.catalogId,title:s.title,variant:s.variant,filename:s.filename,size:s.size};});user={uid:"test-user"};},setSong:setSong,renderOfflineList:renderOfflineList,toggleText:toggleText}};');
assert.notEqual(snippet,rec,'Cannot test internal module, export point changed');
vm.runInNewContext(snippet,{window,document,Promise,console,Math,Date,Number,String,Array,Object,Error,navigator:{onLine:true}},{timeout:1000});
const t=window.VMM_RECORDINGS._test;
t.header();
document.getElementById('vmm-r-text-wrapper').className='hidden';
t.set([{id:'1',title:'Дикая вишня',artist:'Velar'}],
 [{fileId:'drive-1',catalogId:'1',title:'Дикая вишня',variant:'Минусовка',filename:'dikaya_vishnya.flac',size:35000000}]);
t.renderOfflineList();
assert.match(elems['vmm-r-offline-list'].innerHTML,/Дикая вишня/);
t.setSong('1');
assert.match(elems['vmm-r-song-title'].textContent,/Дикая вишня/);
assert.match(elems['vmm-r-text-wrapper'].className,/hidden/,'Lyrics must stay collapsed before play');
t.toggleText(true);
assert.doesNotMatch(elems['vmm-r-text-wrapper'].className,/hidden/,'Lyrics should open on user action');
t.setSong('');
assert.match(elems['vmm-r-song-section'].className,/hidden/);
console.log('PASS: overview/default, refresh tab restoration, no reauth reset, pinned offline rows, manual text disclosure, fixed mobile dock');
