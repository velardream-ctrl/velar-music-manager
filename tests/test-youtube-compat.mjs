import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('youtube-compat.js','utf8');
for(const [ua,legacy] of [
 ['Mozilla/5.0 (iPad; CPU OS 12_5_8 like Mac OS X) AppleWebKit/605.1.15 CriOS/92.0 Mobile/15E148 Safari/604.1',true],
 ['Mozilla/5.0 (iPad; CPU OS 12_5_8 like Mac OS X) Version/12.1 Safari/604.1',true],
 ['Mozilla/5.0 (iPhone; CPU iPhone OS 12_4 like Mac OS X)',true],
 ['Mozilla/5.0 (iPod touch; CPU iPhone OS 10_3 like Mac OS X)',true],
 ['Mozilla/5.0 (iPad; CPU OS 13_7 like Mac OS X)',false],
 ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)',false],
 ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1',false],
 ['Mozilla/5.0 Android Chrome/120',false],['',false]
]){
 const navigations=[],window={location:{assign(url){navigations.push(url);}}};
 vm.runInNewContext(source,{window,navigator:{userAgent:ua}});
 const api=window.VMM_YOUTUBE_COMPAT;
 assert.equal(api.required(),legacy,ua);
 assert.equal(typeof api.open,'undefined','Compatibility helper cannot navigate');
 assert.equal(navigations.length,0);
}
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('youtube-compat.js?v=2')<html.indexOf('landing-public.js?v='));
assert.ok(html.indexOf('youtube-compat.js?v=2')<html.indexOf('public-song-ui.js?v='));
console.log('PASS: iOS12 Safari/Chrome/iPhone/iPod legacy detection only; no external navigation');
