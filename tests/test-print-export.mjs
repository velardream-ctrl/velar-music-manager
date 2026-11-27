import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const tools=read('studio/lyrics-tools.js');
const exporter=read('studio/print-export.js');
const html=read('studio/index.html');
const css=read('studio/studio.css');

assert.match(tools,/new File\(\[cleaned\],name\+'\.txt'/,'TXT must use the song title, not generic Text');
assert.match(tools,/navigator\.canShare\(\{files:\[file\]\}\)/);
assert.ok(!/window\.open\('about:blank'/.test(tools),'No window.open for PWA printing');
assert.ok(html.indexOf('print-export.js?v=2') < html.indexOf('lyrics-tools.js?v=6'),'Print module must load first');
assert.match(css,/#vmm-export-overlay/);
assert.match(css,/#print-page \.vmm-print-words/);
assert.match(exporter,/← Назад в редактор/);

const nodes={}, clicks=[],attrs={}, events={};
function node(){
  return {style:{},clientWidth:320,parentNode:null,className:'',textContent:'',innerHTML:'',
    setAttribute(k,v){attrs[k]=v;},focus(){},addEventListener(k,fn){events[k]=fn;}};
}
const get=id=>(nodes[id] ||= node());
const body={classList:{add(){},remove(){}},appendChild(n){n.parentNode=body;},removeChild(n){n.parentNode=null;}};
const document={
  getElementById:get,createElement(tag){
    if(tag==='canvas'){
      return {width:0,height:0,getContext(){return {
        font:'',textBaseline:'',fillStyle:'',textAlign:'',
        scale(){},measureText(s){return {width:String(s).length*7};},
        fillText(){},fillRect(){}
      };},
      toDataURL(){return 'data:image/jpeg;base64,'+Buffer.from([0xff,0xd8,0xff,0xd9]).toString('base64');}};
    }
    return node();
  },body,activeElement:node(),addEventListener(k,fn){events[k]=fn;}
};
let data=null;
const navigator={standalone:true,canShare(v){return !!(v.files&&v.files.length);},share(v){data=v;return Promise.resolve();}};
const window={addEventListener(){},matchMedia(){return {matches:true};},print(){throw Error('Do not call print in PWA');}};
const ctx={window,document,navigator,File,Blob,Uint8Array,atob,URL,Buffer,setTimeout,Math,Number,String,Error,Promise,Array};
vm.runInNewContext(exporter,ctx,{timeout:1000});
const p={title:'А над речкой туман',language:'Русский',version:'Основная',
  text:'**Куплет 1**\nУ калитки вишня белая качается,\nТёплый вечер стелется рекой.',
  font:15,rowsHTML:'<h2>Куплет 1</h2><div class="stanza">Тёплый вечер стелется рекой.</div>',
  pageHTML:'<!doctype html><html><body><div>Лист A4</div></body></html>'};
assert.equal(window.VMM_PRINT_EXPORT.safeName(' А над речкой: туман? '),'А над речкой туман');
window.VMM_PRINT_EXPORT.show(p);
assert.match(get('vmm-export-message').textContent,/iPhone/);
get('vmm-export-pdf').onclick();
assert.equal(data.files[0].name,'А над речкой туман.pdf');
assert.equal(data.files[0].type,'application/pdf');
const pdf=Buffer.from(await data.files[0].arrayBuffer());
assert.match(pdf.subarray(0,9).toString('latin1'),/%PDF-1\.4/);
assert.match(pdf.toString('latin1'),/\/Type \/Page /);
assert.match(pdf.toString('latin1'),/xref\n0 6\n/);
data=null;
get('vmm-export-print').onclick();
assert.equal(data.files[0].name,'А над речкой туман.pdf','Standalone print must use PDF sharing, not broken window.print()');
get('vmm-export-close').onclick();
assert.equal(window.VMM_PRINT_EXPORT.safeName('/////'),'Текст песни');
console.log('PASS: named TXT sharing, no print dead end, in-app Back, standalone PDF share, valid PDF container');

// Stage sheet: font-sensitive layout tests, no real song data.
const metrics={font:'',measureText(s){const size=Number((this.font.match(/([\d.]+)px/)||[])[1])||12;return {width:String(s).length*size*.52};}};
const build=window.VMM_PRINT_EXPORT.buildLayout;
const short={title:'Короткая песня',text:'**Куплет 1**\nМоя родная сторона\nСветит тихая луна\n\n**Припев**\nДом родной, родной мой дом\nСердце остаётся в нём'};
const shortPlan=build(short,metrics);assert.ok(shortPlan.font>20);
const stanza=Array.from({length:8},(_,i)=>'Строка песни '+(i+1)+' звучит над землёй').join('\n');
const long={title:'Длинная песня',text:Array.from({length:7},(_,i)=>'**Куплет '+(i+1)+'**\n'+stanza).join('\n\n')};
const plan=build(long,metrics);
assert.equal(plan.columns,2);assert.ok(plan.font>=16);assert.equal(plan.rows.filter(r=>r.bold).length,7);
assert.equal(plan.rows.filter(r=>!r.bold).length,56,'All lyric lines survive');
assert.ok(Math.abs(plan.ends[0]-plan.ends[1])<plan.lineHeight*8,'Columns should be balanced');
assert.ok(plan.rows.every(r=>r.y<=plan.bottom));assert.ok(plan.margin>=20);
for(let i=1;i<plan.rows.length;i++){let a=plan.rows[i-1],b=plan.rows[i];if(a.column===b.column&&b.bold)assert.ok(b.y-a.y>=plan.lineHeight*1.99,'At least one blank line between sections');}
assert.match(window.VMM_PRINT_EXPORT.prepare(short).pageHTML,/data:image\/jpeg/);
console.log('PASS: short-song font, balanced sections, complete A4, blank-line gaps, shared print image');
