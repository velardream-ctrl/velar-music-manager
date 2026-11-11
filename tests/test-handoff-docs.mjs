import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const files=[
 'docs/WORK_ACTIVITY_LOG_RU.md',
 'docs/PROJECT_HANDOFF_RU.md',
 'docs/REUSABLE_SITE_TEMPLATE_RU.md',
 'docs/RUN_TEMPLATE_RU.md',
 '.github/PULL_REQUEST_TEMPLATE.md'
];
for(const p of files){
  const content=read(p);
  assert.ok(content.length>=500,p+' is empty or incomplete');
  assert.ok(!/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[a-zA-Z0-9]{30,}|ya29\.[A-Za-z0-9_-]{30,}/.test(content),'Secret-looking material in '+p);
}
const log=read(files[0]),handoff=read(files[1]),template=read(files[2]);
assert.match(log,/RUN-046/);
assert.match(log,/RUN-047\/048/);
assert.match(log,/RUN-049/);
assert.match(log,/RUN-050/);
assert.match(log,/RUN-051/);
assert.match(log,/RUN-052/);
assert.match(log,/НАЧАЛ/);
assert.match(log,/ЗАВЕРШИЛ/);
assert.match(handoff,/PROJECT_HANDOFF/);
assert.match(handoff,/github\.com\/velardream-ctrl\/velar-music-manager/);
assert.match(template,/GitHub Template/);
assert.match(template,/без утечки данных/);
for(const readme of ['README.md','README_RU.md']){
 const text=read(readme);
 for(const f of files.slice(0,3)){
   assert.ok(text.includes(f),readme+' must link to '+f);
 }
}
const pkg=JSON.parse(read('package.json'));
assert.ok(pkg.scripts.test.includes('test-handoff-docs.mjs'));
console.log('PASS: durable work journal, new-chat handoff, clean-copy template roadmap, PR checklist and README entrypoints');
