import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('studio/recordings.js');
const html=read('studio/index.html');
const sw=read('sw.js');
assert.ok(!source.includes('firebase.auth.GoogleAuthProvider.credentialFromResult'),'Firebase 8 must not call v9 helper');
assert.match(source,/var cred=result&&result\.credential/);
assert.match(source,/aria-controls=\\"vmm-r-results/);
assert.match(source,/function chooseSearchResult/);
assert.match(source,/Найдено: /);
assert.match(source,/errors\.push\('каталог:/);

const elements={};
function el(tag){
 const x={tagName:tag||'div',children:[],value:'',textContent:'',className:'',style:{},disabled:false,
   classList:{add(){},remove(){}},
   appendChild(n){this.children.push(n);n.parentNode=this;},
   removeChild(n){const pos=this.children.indexOf(n);if(pos>=0)this.children.splice(pos,1);},
   addEventListener(){},setAttribute(){},scrollIntoView(){},
   pause(){},load(){},removeAttribute(){}};
 Object.defineProperty(x,'firstChild',{get(){return this.children[0]||null;}});
 Object.defineProperty(x,'innerHTML',{get(){return this._html||'';},set(v){this._html=v;this.children=[];}});
 return x;
}
const shell=el('main');
const document={
 querySelector(q){return q==='#workspace .workspace-content'?shell:null;},
 getElementById(k){return elements[k]||(elements[k]=el());},
 createElement:el
};
const window={};
const script=source.replace('window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename};',
 'window.VMM_RECORDINGS={open:open,hide:hide,reset:reset,translit:translit,filename:filename,_test:{header:header,renderSongs:renderSongs,setSongs:function(items){catalog=items;},setUser:function(u){user=u;},connect:connect}};');
assert.notEqual(script,source,'Test instrumentation point should exist');
const firebase={
 auth:function(){return {currentUser:testUser};}
};
firebase.auth.GoogleAuthProvider=function(){this.addScope=function(){};this.setCustomParameters=function(){};};
const testUser={uid:'test-owner',reauthenticateWithPopup:function(){return Promise.resolve({user:testUser,credential:{accessToken:'token-from-v8'}});}};
const ctx={window,document,navigator:{onLine:true},firebase,Promise,String,Array,Object,Math,Date,Number,URL,Error};
vm.runInNewContext(script,ctx,{timeout:1000});
const t=window.VMM_RECORDINGS._test;
t.header();
t.setUser(testUser);
const token=await t.connect();
assert.equal(token,'token-from-v8','Must use result.credential in Firebase v8');
const song1={id:'1',title:'Белая берёза',artist:'Velar',sourceRow:33,upc:'123'};
const song2={id:'2',title:'А над речкой туман',artist:'Velar',sourceRow:34,upc:'456'};
t.setSongs([song1,song2]);
const input=elements['vmm-r-search'];
input.value='Белая береза';
input.oninput();
const children=elements['vmm-r-results'].children;
assert.match(children[0].textContent,/Найдено: 1/,'Ё should match Е');
const buttons=children.filter(e=>e.tagName==='button');
assert.equal(buttons.length,1,'The match must be a directly tappable button');
assert.match(buttons[0].textContent,/Белая берёза/);
buttons[0].onclick();
assert.equal(elements['vmm-r-song'].value,'1');
assert.match(elements['vmm-r-song-title'].textContent,/Белая берёза/);
assert.equal(input.value,'Белая берёза');
input.value='несуществующее название';
input.oninput();
assert.match(elements['vmm-r-results'].children[0].textContent,/не найдено/);
assert.ok(html.includes('src="recordings.js?v=2"'));
assert.ok(html.includes('href="recordings.css?v=2"'));
assert.ok(sw.includes("recordings.js?v=2"));
console.log('PASS: Firebase v8 Drive credential, iPhone Cyrillic search results/tap, empty-result messaging and cache versions');
