/* Regression: official album listing and deliberate, unambiguous catalog matching. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const matcher = read('studio/album-auto-match.js');
const albums = read('albums-public.js');
const editor = read('studio/landing-editor.js');
const studio = read('studio/index.html');
const home = read('index.html');
const sw = read('sw.js');
new vm.Script(matcher);
new vm.Script(albums);
new vm.Script(editor);

const window = {};
vm.runInNewContext(matcher,{window,String,Array,Object},{timeout:1000});
const {propose,parse,spotifyTrack}=window.VMM_ALBUM_MATCH;
const one='https://open.spotify.com/track/ABCDEFGHIJKLMNOPQRSTUV';
const two='https://open.spotify.com/track/ABCDEFGHIJKLMNOPQRSTUW';
const catalog=[
 {title:'Игристая Весна',artist:'Velar',spotify:one,youtube:'',appleMusic:''},
 {title:'Ночь звёзд',artist:'Velar',spotify:two,youtube:'',appleMusic:''},
 {title:'Песня',artist:'Velar',spotify:'',youtube:'https://www.youtube.com/watch?v=ABCDEFGHIjk',appleMusic:''},
 {title:'Песня',artist:'Илья Дмитриев',spotify:'',youtube:'https://www.youtube.com/watch?v=12345678901',appleMusic:''}
];
assert.equal(spotifyTrack(one+'?si=abcd'),one);
assert.equal(parse('1. Игристая Весна — Velar\n2. Ночь звёзд — Velar').length,2);
const good=propose('Игристая Весна — Velar\nНочь звезд\nПесня',catalog,'Velar',[]);
assert.equal(good.matchCount,3);
assert.equal(good.rows[2].song.artist,'Velar');
const byUrl=propose(one+'?si=abcd',catalog,'Velar',[]);
assert.equal(byUrl.matchCount,1);
assert.equal(byUrl.rows[0].song.title,'Игристая Весна');
const assigned=propose('Игристая Весна',catalog,'Velar',
 [{title:'Игристая Весна',artist:'Velar',provider:'spotify',url:one}]);
assert.equal(assigned.existingCount,1);
assert.equal(assigned.matchCount,0);
assert.equal(propose('Песня',catalog,'',[]).ambiguousCount,1);
assert.equal(propose('Неизвестный трек',catalog,'Velar',[]).missingCount,1);
assert.equal(propose('Игристая Весна\nИгристая Весна',catalog,'Velar',[]).matchCount,1);
assert.equal(propose('Игристая Весна\n'.repeat(61),catalog,'Velar',[]).truncated,true);
assert.match(editor,/function albumAutoMatchEditor\(parent,album\)/);
assert.match(editor,/API\.normalize\(candidate\)/);
assert.match(editor,/albumAutoMatchEditor\(box,active\)/);
assert.match(studio,/album-auto-match\.js\?v=1/);
assert.match(home,/albums-public\.js\?v=4&tracklist=210/);
assert.match(sw,/\.\/studio\/album-auto-match\.js\?v=1/);
assert.match(sw,/\.\/albums-public\.js\?v=4&tracklist=210/);

// The album embed is inserted ONLY after deliberate user expansion.
function node(tag='div'){
 return {tagName:tag,children:[],className:'',attributes:{},textContent:'',
  appendChild(el){this.children.push(el);return el;},
  removeChild(el){const i=this.children.indexOf(el);if(i>=0)this.children.splice(i,1);return el;},
  get firstChild(){return this.children[0]||null;},
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];}};
}
const nodes={'public-albums-cards':node(),'albums-title':node(),'public-albums-intro':node()};
const document={getElementById:id=>nodes[id]||null,createElement:node};
vm.runInNewContext(albums,{window,document},{timeout:1000});
const official={
 id:'vesna',title:'Игристая Весна',artist:'Velar',kind:'official',
 mediaUrl:'https://open.spotify.com/album/ABCDEFGHIJKLMNOPQRSTUV',
 visible:true,tracks:[],description:''
};
window.VELAR_ALBUMS.render({entries:[official],view:'grid',trackView:'rows',heading:'Альбомы',intro:'Музыка'});
const card=nodes['public-albums-cards'].children[0];
const body=card.children[1],toggle=body.children.find(el=>el.tagName==='button');
assert.ok(toggle);
assert.equal(card.children[2].children.length,0,'No Spotify tracking before click');
toggle.onclick();
const frame=card.children[2].children.find(el=>el.tagName==='iframe');
assert.ok(frame,'Official Spotify album iframe should show its own tracklist');
assert.equal(frame.src,'https://open.spotify.com/embed/album/ABCDEFGHIJKLMNOPQRSTUV');
assert.equal(frame.loading,'lazy');
assert.match(body.children.find(el=>el.className==='cms-album-count').textContent,/Spotify/);
toggle.onclick();
assert.equal(card.children[2].children.length,0,'Closing unloads Spotify embed');
window.VELAR_ALBUMS.render({entries:[{...official,kind:'collection'}],view:'grid'});
const collection=nodes['public-albums-cards'].children[0];
collection.children[1].children.find(el=>el.tagName==='button').onclick();
assert.equal(collection.children[2].children.filter(el=>el.tagName==='iframe').length,0,
 'Unofficial collections must not show a Spotify album iframe');
console.log('PASS: Spotify album embed on click, private catalog matching, no duplicate guesses.');
