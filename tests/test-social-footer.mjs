import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const schemaCode=fs.readFileSync('landing-schema.js','utf8');
const window={};
vm.runInNewContext(schemaCode,{window,console});
const api=window.VMM_LANDING_SCHEMA;
assert.ok(api,'shared schema available');
const defaults=api.normalize(api.defaults());
assert.equal(defaults.hero.socialBar.enabled,false,'site panel remains invisible by default');
assert.equal(defaults.hero.socialBar.shareEnabled,false,'share control opt-in');
assert.equal(defaults.hero.socialBar.links.length,0);
const data=api.defaults();
data.hero.socialBar={
  enabled:true,shareEnabled:true,
  links:[{platform:'facebook',url:'https://www.facebook.com/velardream',visible:true},
    {platform:'linkedin',url:'https://www.linkedin.com/company/velardream',visible:false}]
};
const normalized=api.normalize(data);
assert.equal(normalized.hero.socialBar.links.length,2);
assert.equal(normalized.hero.socialBar.links[1].platform,'linkedin');
const restored=api.normalize(normalized);
assert.equal(JSON.stringify(restored.hero.socialBar),JSON.stringify(normalized.hero.socialBar));
assert.throws(()=>{
  const bad=api.defaults();bad.hero.socialBar={enabled:true,links:[{platform:'facebook',url:'javascript:alert(1)',visible:true}]};
  api.normalize(bad);
},/ссылк|https|адрес|URL|недопуст/i);
const publicCode=fs.readFileSync('landing-public.js','utf8');
assert.match(publicCode,/renderSocialFooter\(value\.hero\.socialBar\)/);
assert.match(publicCode,/navigator\.share/);
assert.match(publicCode,/navigator\.clipboard/);
const editor=fs.readFileSync('studio/landing-editor.js','utf8');
assert.match(editor,/siteSocialEditor\(panel\)/);
assert.match(editor,/linkedin','LinkedIn'/);
console.log('PASS social footer: default hidden, owner links, LinkedIn, safe URL, share fallbacks');
