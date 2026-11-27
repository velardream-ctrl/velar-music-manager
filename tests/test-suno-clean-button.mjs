import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../studio/lyrics-tools.js',import.meta.url),'utf8');
const nodes={};
function node(){return {value:'',className:'',style:{},textContent:'',events:{},readOnly:false,appendChild(){},addEventListener(k,f){this.events[k]=f;},dispatchEvent(e){if(this.events[e.type])this.events[e.type](e);},setAttribute(){}};}
const get=k=>nodes[k]||(nodes[k]=node());
get('vmm-paper-view').className='hidden';
const document={getElementById:get,createElement:node};
const window={addEventListener(){}};
class Event{constructor(type){this.type=type;}}
vm.runInNewContext(source,{window,document,navigator:{},Event,setTimeout,clearTimeout},{timeout:1000});
const api=window.VMM_LYRICS_TOOLS;
assert.equal(api.cleanAllSuno('[Verse 1]\nСлова [dark cinematic synth] песни\n[Unlisted cue\nslow strings]\n[Chorus]\nПрипев (эхо)').text,'**Куплет 1**\nСлова  песни\n\n**Припев**\nПрипев (эхо)');
assert.equal(api.cleanAllSuno('One[cue]two\n[FX [nested]]\nLast').text,'One two\n\nLast');
assert.equal(api.cleanAllSuno('A [unfinished').text,'A [unfinished');
assert.equal(api.cleanSuno('Lyrics [unknown cue]').text,'Lyrics [unknown cue]');
const body=get('lyric-body');
body.value='[experimental texture]\nСтрока [custom sound]\nФинал';
get('vmm-clean-suno').onclick();
assert.equal(body.value,'Строка\nФинал');
assert.equal(get('vmm-undo-clean').className,'');
get('vmm-undo-clean').onclick();
assert.equal(body.value,'[experimental texture]\nСтрока [custom sound]\nФинал');
body.value='[style]\nNew lyric';
body.readOnly=true;get('vmm-clean-suno').onclick();
assert.equal(body.value,'[style]\nNew lyric');
console.log('PASS: manual Suno cleanup, multiline, inline, nested, unmatched, cautious auto mode, undo and read-only protection');
