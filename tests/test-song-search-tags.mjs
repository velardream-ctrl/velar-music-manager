// RUN-221: tags are owner-editable and searchable only for explicitly published songs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const ctx={window:{},Array,String,Object,Number,JSON,Error,RegExp,Math};
for(const name of ['landing-schema.js','song-search-meta.js','public-song-search.js'])
  vm.runInNewContext(read(name),ctx,{filename:name,timeout:3000});
const schema=ctx.window.VMM_LANDING_SCHEMA;
const meta=ctx.window.VELAR_SONG_SEARCH_META;
const pub=ctx.window.VELAR_PUBLIC_SONG_SEARCH;
assert.ok(schema&&meta&&pub);
assert.equal(meta.normalizeTags(' Миша, Михаил, миша, Именная песня, день рождения '),
  'Миша, Михаил, Именная песня, день рождения');
assert.equal(meta.normalizeDescription(' Именная песня-подарок для Михаила '),
  'Именная песня-подарок для Михаила');
assert.throws(()=>meta.normalizeTags(Array.from({length:20},(_,i)=>'tag'+i).join(', ')),/Максимум/);
assert.throws(()=>meta.normalizeTags('тег,<script>'),/недопустимые символы/);
assert.throws(()=>meta.normalizeDescription('x'.repeat(281)),/максимум/);
const url='https://open.spotify.com/track/0123456789012345678901';
const another='https://www.youtube.com/watch?v=abcdefghijk';
const song={
  title:'Ты мой плюшевый мишка',artist:'Velar',provider:'spotify',url,
  searchTags:'Миша, Михаил, именная песня, день рождения',
  searchDescription:'Песня-поздравление для Михаила'
};
const normalized=schema.languageTrack(song,1);
assert.equal(normalized.searchTags,song.searchTags);
assert.equal(schema.featuredTrack(song,1).searchDescription,song.searchDescription);
const joined=schema.consolidateAttachedTracks([
  song,
  {title:song.title,artist:song.artist,provider:'youtube',url:another,
    searchTags:song.searchTags}
],'Тест');
assert.equal(joined.length,1);
assert.equal(joined[0].searchTags,song.searchTags);
const page={
  genres:{entries:[],topics:{entries:[
    {visible:true,label:'Имена',tracks:[song]},
    {visible:false,label:'Закрыто',tracks:[{title:'Секрет',provider:'spotify',url:'https://open.spotify.com/track/0123456789012345678902',searchTags:'секретный тег'}]}
  ]},languages:{entries:[]}},
  albums:{entries:[]},
  artists:{cards:[]},
  releases:{cards:[
    {visible:true,title:'Другая премьера',subtitle:'Velar',
     mediaProvider:'youtube',mediaUrl:another,
     searchTags:'свадьба',searchDescription:'Свадебное поздравление'},
    {visible:false,title:'Неизданная песня',subtitle:'Velar',
     mediaProvider:'spotify',mediaUrl:'https://open.spotify.com/track/0123456789012345678903',
     searchTags:'Миша'}
  ]},
  vmm_catalog:[{title:'Приватный релиз',searchTags:'Миша'}],
  vmm_lyrics:[{title:'Приватный текст',text:'Миша'}]
};
const all=pub.collect(page);
assert.equal(all.length,2,'Only public direct URLs included');
assert.equal(pub.find(page,'Миша').length,1);
assert.equal(pub.find(page,'Михаил').length,1);
assert.equal(pub.find(page,'песня для Михаила').length,1);
assert.equal(pub.find(page,'свадьба').length,1);
assert.equal(pub.find(page,'секретный тег').length,0);
assert.equal(pub.find(page,'Приватный').length,0);
assert.equal(pub.find(page,'Неизданная').length,0);
assert.equal(pub.find(page,'Миш').length,1);
assert.equal(pub.find(page,'').length,0);
const studio=read('studio/workflows.js');
const editor=read('studio/landing-editor.js');
const landing=read('landing-public.js');
const homepage=read('index.html');
const studioHtml=read('studio/index.html');
const artistHtml=read('artist.html');
const sw=read('sw.js');
for(const source of [studio,editor,landing,read('public-song-ui.js')])new Function(source);
assert.match(studio,/name="searchTags"/);
assert.match(studio,/name="searchDescription"/);
assert.match(studio,/searchTags:searchTags,searchDescription:searchDescription/);
assert.match(studio,/t\.searchTags,t\.searchDescription/);
assert.match(editor,/Обновить темы и теги из каталога/);
assert.match(editor,/syncPublicSearchMetadata/);
assert.match(editor,/if\(fold\(it\.song\.title\)!==fold\(row\.title\)\)return/);
assert.match(editor,/if\(urls\.some\(function\(u\)\{return it\.urls\[u\];\}\)\)/);
assert.match(landing,/function createSongDiscovery\(page\)/);
assert.match(landing,/releaseGallery\(value\.releases,value\)/);
assert.match(homepage,/song-search-meta\.js\?v=221/);
assert.match(homepage,/public-song-search\.js\?v=221/);
assert.match(studioHtml,/song-search-meta\.js\?v=221/);
assert.match(artistHtml,/song-search-meta\.js\?v=221/);
assert.match(artistHtml,/public-song-ui\.js\?v=26&clips=1&tags=221/);
assert.match(read('public-song-ui.js'),/meta\.matches\(track,needle\)/);
assert.match(sw,/public-song-search\.js\?v=221/);
assert.doesNotMatch(read('public-song-search.js'),/collection\(['"]vmm_catalog/);
console.log('PASS RUN-221: song tagging, public-only matching, owner editors and PWA references');
