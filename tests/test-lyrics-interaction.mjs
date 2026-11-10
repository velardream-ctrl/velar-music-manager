import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../studio/studio.js',import.meta.url),'utf8');
assert.match(code,/\}\(\)\);\s*$/);
const script=code.replace(/\}\(\)\);\s*$/,"window.__test={setRecords:function(c,l){catalog=c;lyrics=l;songOptions();},chooseSong:chooseSong,versions:versions,songs:function(){return songs;},songByKey:songByKey,getMeta:metadata,dirty:isDirty,guard:confirmDiscard,fill:fillLyric};}());");
function node() {
 const n={value:'',className:'',textContent:'',disabled:false,readOnly:false,children:[],style:{},events:{},
    setAttribute(){},addEventListener(k,fn){this.events[k]=fn;},dispatchEvent(e){if(this.events[e.type])this.events[e.type](e);},
    appendChild(c){this.children.push(c);},removeChild(c){this.children.splice(this.children.indexOf(c),1);}};
 Object.defineProperty(n,'firstChild',{get(){return this.children[0]||null;}});
 return n;
}
const nodes={},query=function(k){return nodes[k]||(nodes[k]=node());};
query('lyric-form').className='hidden';
query('panel-lyrics').className='';
query('panel-future').className='hidden';
query('no-lyric-selected').className='';
const document={getElementById:query,querySelectorAll(){return[];},createElement(){return node();},head:{appendChild(){}}};
let allowDiscard=false;
const window={VELAR_FIREBASE_CONFIG:null,addEventListener(){},confirm(){return allowDiscard;},
 VMM_LYRICS_TOOLS:{onRecordLoaded(){},refreshPreview(){},notifyDirty(){}}};
const ctx={window,document,navigator:{onLine:true},Promise,Array,Object,Number,String,Math,Date,Error,parseInt,isFinite};
vm.runInNewContext(script,ctx,{timeout:1000});
const t=window.__test;
const catalog=[
 {id:'releaseA',title:'Журавли',artist:'Velar',sourceRow:33,upc:'1234567890'},
 {id:'releaseB',title:'Совсем другая песня',artist:'Velar',sourceRow:34,upc:'1234567890'}];
const versions=[{id:'textA',title:'Журавли',catalogRow:'33',upc:'1234567890',language:'Русский',version:'Основная',text:'Первый куплет'}];
t.setRecords(catalog,versions);
assert.equal(t.versions(t.songByKey('catalog:releaseA')).length,1);
assert.equal(t.versions(t.songByKey('catalog:releaseB')).length,0,'Same album UPC alone MUST NOT join two songs');
assert.equal(t.chooseSong('catalog:releaseA'),true);
assert.equal(t.getMeta().id,'textA');
assert.equal(query('lyric-body').value,'Первый куплет');
assert.equal(t.dirty(),false);
query('lyric-body').value='Изменённый куплет';
assert.equal(t.dirty(),true);
assert.equal(t.chooseSong('catalog:releaseB'),false,'Unsaved song switch must be blockable');
assert.equal(t.getMeta().id,'textA','Denied navigation must keep same text');
assert.equal(query('lyric-body').value,'Изменённый куплет');
allowDiscard=true;
assert.equal(t.chooseSong('catalog:releaseB'),true);
assert.equal(t.getMeta().title,'Совсем другая песня');
assert.equal(t.getMeta().catalogRow,'34');
assert.equal(query('lyric-body').value,'');
assert.equal(t.dirty(),false);
console.log('PASS: catalog/lyrics pairing, no UPC-only cross-link, unsaved change confirmation and safe new song draft');