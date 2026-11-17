import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const w={};vm.runInNewContext(read('landing-schema.js'),{window:w,console},{timeout:1500});
const api=w.VMM_LANDING_SCHEMA;
const base=api.defaults();
assert.equal(api.normalize(base).about.progress.enabled,false);
assert.equal(api.normalize({...base,about:{notice:'Hi'}}).about.progress.enabled,false,'legacy document defaults must be safe');
const progress={enabled:true,title:'Музыкальная коллекция',intro:'Работа продолжается',
 metrics:[{label:'Всего песен',value:280,visible:true},{label:'Подготовка',value:15,visible:false}],
 showBar:true,barLabel:'Готовность ссылок',completed:682,total:840,
 note:'Альбомы ждут публикации',updatedAt:'2026-11-17'};
const val=api.normalize({...base,about:{...base.about,progress}});
assert.equal(val.about.progress.completed,682);
assert.equal(val.about.progress.total,840);
assert.equal(val.about.progress.metrics[1].visible,false);
assert.equal(api.normalize(val).about.progress.enabled,true);
assert.throws(()=>api.normalize({...base,about:{...base.about,progress:{...progress,completed:841}}}),/больше/);
assert.throws(()=>api.normalize({...base,about:{...base.about,progress:{...progress,metrics:[{label:'Запросы',value:-1,visible:true}]}}}),/целое число/);
assert.throws(()=>api.normalize({...base,about:{...base.about,progress:{...progress,metrics:[{label:'Секрет',value:'99',visible:true}]}}}),/целое число/);
const sanitized=api.normalize({...base,about:{...base.about,progress:{...progress,privateCatalog:[{token:'PRIVATE'}]}}});
assert.doesNotMatch(JSON.stringify(sanitized),/PRIVATE|privateCatalog/);
const publicSrc=read('landing-public.js'),studioSrc=read('studio/landing-editor.js');
assert.match(publicSrc,/renderCatalogProgress\(value\.about\.progress\)/);
assert.match(publicSrc,/role','progressbar'/);
assert.match(studioSrc,/publicProgressEditor\(panel\)/);
assert.match(studioSrc,/loadCatalogArtists\(true\)/);
assert.match(studioSrc,/function normalizeWithLinkCapacity\(raw\)/);
assert.match(studioSrc,/progress\.total=songs\*3/);
assert.match(studioSrc,/progress\.total!==songs/);
assert.match(studioSrc,/Рассчитать максимум по числу песен × 3/);
assert.match(studioSrc,/normalizeWithLinkCapacity\(value\.content\)/);
assert.match(studioSrc,/normalizeWithLinkCapacity\(payload\.content\)/);
assert.match(studioSrc,/normalizeWithLinkCapacity\(data\)/);

assert.match(read('index.html'),/id="public-catalog-progress"[^>]*hidden/);
assert.doesNotMatch(publicSrc,/collection\('vmm_catalog'\)/,'Public UI cannot query private catalog');
console.log('PASS public aggregate progress: hidden default, numbers, guards, editor, public-only');
