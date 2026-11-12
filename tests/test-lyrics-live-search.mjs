import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const src=read('studio/studio.js'),html=read('studio/index.html'),css=read('studio/studio.css'),sw=read('sw.js');
assert.match(html,/id="lyric-search-results"/);
assert.match(html,/aria-controls="lyric-search-results"/);
assert.match(css,/\.lyrics-search-hit/);
assert.match(css,/min-height:48px/);
assert.ok(html.includes('src="studio.js?v=10"'));
assert.ok(html.includes('href="studio.css?v=18"'));
assert.ok(sw.includes("STUDIO_PREFIX+'v30'"));
assert.doesNotMatch(src,/localStorage\.setItem|sessionStorage\.setItem/);
assert.match(src,/function pickLyricSearchResult\(key\)/);
assert.match(src,/key!==songKey&&!chooseSong\(key\)/);
const code=src.replace(/\}\(\)\);\s*$/,
 'window.__test={load:function(c,l){catalog=c;lyrics=l;songOptions();},results:renderSongChoices,search:lyricSearchMatches,pick:pickLyricSearchResult,selected:function(){return songKey;},meta:metadata,dirty:isDirty};}());');
assert.notEqual(code,src);
function node(){
 const el={value:'',textContent:'',className:'',disabled:false,readOnly:false,
  children:[],events:{},style:{},
  setAttribute(k,v){this[k]=v;},
  addEventListener(k,fn){this.events[k]=fn;},
  appendChild(c){this.children.push(c);},
  removeChild(c){this.children.splice(this.children.indexOf(c),1);}
 };
 Object.defineProperty(el,'firstChild',{get(){return this.children[0]||null;}});
 return el;
}
const nodes={},get=id=>nodes[id]||(nodes[id]=node());
get('lyric-form').className='hidden';
get('no-lyric-selected').className='';
const document={getElementById:get,querySelectorAll:()=>[],createElement:node,head:{appendChild(){}}};
let allowDiscard=false,asked=0;
const window={VELAR_FIREBASE_CONFIG:null,addEventListener(){},
 confirm(){asked++;return allowDiscard;},
 VMM_LYRICS_TOOLS:{onRecordLoaded(){},refreshPreview(){},notifyDirty(){}}};
vm.runInNewContext(code,{document,window,navigator:{onLine:true},Promise,Object,Number,Array,String,Math,Date,Error},{timeout:1000});
const t=window.__test;
const catalog=[
 {id:'a',title:'Дикая вишня',artist:'Velar',sourceRow:1},
 {id:'b',title:'Белая берёза',artist:'Илья Дмитриев',sourceRow:2},
 {id:'c',title:'Ёлочка',artist:'Velar',sourceRow:3},
 {id:'d',title:'Без текста',artist:'Гость',sourceRow:4}
];
const lyrics=[
 {id:'a-ru',title:'Дикая вишня',catalogRow:'1',language:'Русский',version:'Основная',text:'Вишня дикая пахнет'},
 {id:'a-fi',title:'Дикая вишня',catalogRow:'1',language:'Финский',version:'Käännös',text:'Kirsikka'},
 {id:'b-ru',title:'Белая берёза',catalogRow:'2',language:'Русский',version:'Основная',text:'Белая берёза'}];
t.load(catalog,lyrics);
assert.match(get('lyric-search-results').className,/hidden/,'Empty query should not display all 278 suggestions');
get('lyrics-filter').value='ДикаЯ';
t.results();
let rows=get('lyric-search-results').children;
assert.equal(rows.length,2);
assert.match(rows[0].textContent,/Найдено: 1/);
assert.equal(rows[1].textContent,'Дикая вишня — Velar');
rows[1].onclick();
assert.equal(t.selected(),'catalog:a');
assert.equal(get('lyric-body').value,'Вишня дикая пахнет');
assert.equal(get('lyrics-filter').value,'');
assert.match(get('lyric-search-results').className,/hidden/);
assert.equal(get('lyric-version-select').children.length,2,'Language versions must remain available');
// New search must protect an unsaved lyric body, including if the user selects
// the same song twice by mistake.
get('lyric-body').value='Моя несохранённая строка';
get('lyrics-filter').value='дикая';t.results();
get('lyric-search-results').children[1].onclick();
assert.equal(get('lyric-body').value,'Моя несохранённая строка');
assert.equal(asked,0,'Reselecting same song must not ask to discard changes');
get('lyrics-filter').value='береза';t.results();
assert.equal(t.search('береза').length,1,'е matches ё');
get('lyric-search-results').children[1].onclick();
assert.equal(t.selected(),'catalog:a');
assert.equal(get('lyric-body').value,'Моя несохранённая строка');
assert.equal(get('lyrics-filter').value,'береза','Rejected navigation must preserve query');
assert.equal(asked,1);
allowDiscard=true;
get('lyric-search-results').children[1].onclick();
assert.equal(t.selected(),'catalog:b');
assert.equal(get('lyric-body').value,'Белая берёза');
assert.equal(get('lyric-song-select').value,'catalog:b');
assert.equal(get('lyrics-filter').value,'');
// Artist queries and Enter key open first match.
get('lyrics-filter').value='velar';t.results();
assert.equal(t.search('velar').length,2);
let prevented=false;
get('lyrics-filter').onkeydown({key:'Enter',preventDefault(){prevented=true;}});
assert.equal(prevented,true);
assert.equal(t.selected(),'catalog:a');
assert.equal(get('lyric-body').value,'Вишня дикая пахнет');
// Escape closes suggestions without selecting another song.
get('lyrics-filter').value='неизвестная';t.results();
assert.match(get('lyric-search-results').children[0].textContent,/не найдено/);
get('lyrics-filter').onkeydown({key:'Escape',preventDefault(){}});
assert.equal(get('lyrics-filter').value,'');
assert.match(get('lyric-search-results').className,/hidden/);
// No lyrics yet: selection prepares a safe draft, not a song from a shared UPC.
get('lyrics-filter').value='Гость';t.results();
get('lyric-search-results').children[1].onclick();
assert.equal(t.selected(),'catalog:d');
assert.equal(t.meta().title,'Без текста');
assert.equal(get('lyric-body').value,'');
// Limit result DOM to 25 clickable suggestions without dropping true count.
const many=Array.from({length:31},(_,i)=>({id:'n'+i,title:'Тестовая песня '+i,artist:'Velar',sourceRow:i+100}));
t.load(many,[]);
get('lyrics-filter').value='Тестовая';t.results();
assert.equal(get('lyric-search-results').children.length,27);
assert.match(get('lyric-search-results').children[0].textContent,/Найдено: 31/);
assert.match(get('lyric-search-results').children[26].textContent,/первые 25/);
console.log('PASS: live lyric suggestions by title/artist, ё normalization, Enter/Escape, 25 max, versions, safe drafts, dirty text preserved');
