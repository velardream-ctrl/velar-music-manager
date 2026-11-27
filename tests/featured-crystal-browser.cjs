const {chromium,webkit,devices}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const origin='http://127.0.0.1:8705';
const vm=require('node:vm');
const schemaContext={window:{}};
vm.runInNewContext(fs.readFileSync('landing-schema.js','utf8'),schemaContext);
const previous={
 schemaVersion:1,status:'published',revision:1,
 content:schemaContext.window.VMM_LANDING_SCHEMA.defaults()
};
delete previous.content.hero.featuredPlaylist;
delete previous.content.hero.crystalJourney;

(async()=>{
 const engine=process.env.RUN205_ENGINE==='webkit'?webkit:chromium;
 const browser=await engine.launch();
 try {
 let unexpected=[];
 async function setup(options,admin=false){
  const context=await browser.newContext({...options,serviceWorkers:'block'});
  await context.route('**/*',route=>{
   const url=route.request().url();
   if(url.startsWith(origin))return route.continue();
   if(url.includes('open.spotify.com/embed'))return route.fulfill({body:'<p>Spotify fixture</p>',contentType:'text/html'});
   if(url.includes('gstatic.com/firebasejs')||url.includes('googleapis.com')||url.includes('fonts.gstatic.com')||url.includes('youtube'))return route.fulfill({body:'',contentType:route.request().resourceType()==='script'?'application/javascript':'text/plain'});
   return route.fulfill({status:204});
  });
  await context.addInitScript(({admin,previous,origin})=>{
   if(location.origin!==origin)return;
   if(!localStorage.getItem('vmm_public_pages/landing'))localStorage.setItem('vmm_public_pages/landing',JSON.stringify(previous));
   const read=key=>({exists:localStorage.getItem(key)!==null,data:()=>JSON.parse(localStorage.getItem(key))});
   const user=admin?{uid:'fixture-owner',emailVerified:true,providerData:[{providerId:'google.com'}]}:null;
   const db={
    collection(name){return {
     limit(){return {get:async()=>({forEach(){}})};},
     doc(id){const key=name+'/'+id;return {key,get:async()=>name==='vmm_admins'?{exists:true,data:()=>({enabled:admin})}:read(key),
      onSnapshot(fn){queueMicrotask(()=>fn(read(key)));window.addEventListener('storage',e=>{if(e.key===key)fn(read(key));});return ()=>{};} };}
    };},
    async runTransaction(fn){
     const changes=[];
     const result=await fn({get:async ref=>read(ref.key),set:(ref,value)=>changes.push([ref.key,value])});
     changes.forEach(([key,value])=>localStorage.setItem(key,JSON.stringify(value)));return result;
    }
   };
   const firestore=()=>db;firestore.FieldValue={serverTimestamp:()=>new Date().toISOString()};
   window.fixtureFirebase={firestore,apps:[{}],auth:()=>({currentUser:user}),initializeApp(){}};
   Object.defineProperty(window,'firebase',{get:()=>window.fixtureFirebase});
  },{admin,previous,origin});
  return context;
 }
 function observe(page){page.on('pageerror',e=>unexpected.push(String(e)));page.on('console',m=>{if(m.type()==='error')unexpected.push(m.text());});}
 const admin=await setup({},true);
 await admin.route('**/studio/studio.js?*',route=>route.fulfill({body:'',contentType:'application/javascript'}));
 const studio=await admin.newPage(); observe(studio);studio.on('dialog',d=>d.accept());
 const open=async()=>{
  await studio.goto(origin+'/studio/');
  await studio.waitForFunction(()=>window.VMM_LANDING);
  await studio.evaluate(()=>{document.querySelector('#workspace').classList.remove('hidden');window.VMM_LANDING.open();});
  await studio.waitForFunction(()=>/Загружена|Черновик загружен/.test(document.querySelector('#landing-status').textContent));
 };
 await open();
 const tab=key=>studio.locator('[data-landing-tab='+key+']').click();
 const save=async()=>{await studio.locator('#landing-save').click();await studio.waitForFunction(()=>document.querySelector('#landing-status').textContent.includes('Черновик сохранён'));};
 const publish=async()=>{await studio.locator('#landing-publish').click();await studio.waitForFunction(()=>JSON.parse(localStorage.getItem('vmm_public_pages/landing')).revision>1);};
 await tab('crystal');
 const heading=studio.getByLabel('Заголовок',{exact:true});
 const initial=await heading.inputValue();
 await heading.fill('RUN-205 TEST');
 await studio.getByLabel('Текст кнопки',{exact:true}).fill('RUN-205 BUTTON');
 await studio.getByRole('button',{name:'+ Добавить этап',exact:true}).click();
 await studio.getByLabel('Этап 4',{exact:true}).fill('RUN-205 STAGE');
 await studio.locator('#landing-fields .landing-card').last().getByRole('button',{name:'↑ Выше'}).click();
 assert.equal(await studio.getByLabel('Этап 3',{exact:true}).inputValue(),'RUN-205 STAGE');
 await tab('playlists');
 const playlist=studio.getByLabel('Название главного плейлиста',{exact:true});
 const initialPlaylist=await playlist.inputValue();
 await playlist.fill('RUN-205 SPOTIFY');
 await studio.getByLabel('Описание главного плейлиста',{exact:true}).fill('RUN-205 DESCRIPTION');
 await save();
 assert.equal(await studio.evaluate(()=>JSON.parse(localStorage.getItem('vmm_public_pages/landing')).content.hero.crystalJourney),undefined);
 await open();await tab('crystal');
 assert.equal(await heading.inputValue(),'RUN-205 TEST');
 assert.equal(await studio.getByLabel('Этап 3',{exact:true}).inputValue(),'RUN-205 STAGE');
 await studio.locator('#landing-restore').click();await tab('crystal');
 assert.equal(await heading.inputValue(),initial);
 await studio.locator('#landing-reload').click();
 await studio.waitForFunction(()=>document.querySelector('#landing-status').textContent.includes('Черновик загружен'));
 await tab('crystal');assert.equal(await heading.inputValue(),'RUN-205 TEST');
 await publish();
 const published=await admin.newPage();observe(published);await published.goto(origin);
 await published.waitForFunction(()=>document.querySelector('#crystal-journey-title').textContent==='RUN-205 TEST');
 assert.equal(await published.locator('#vd-feature-title').textContent(),'RUN-205 SPOTIFY');
 assert.match(await published.locator('.crystal-journey-link').textContent(),/RUN-205 BUTTON/);
 // Restore pre-test content through the same editor and publish it as a new revision.
 await heading.fill(initial);
 await studio.getByLabel('Текст кнопки',{exact:true}).fill('Открыть музыкальные миры');
 await studio.locator('#landing-fields .landing-card').nth(2).getByRole('button',{name:'Удалить этап'}).click();
 await tab('playlists');await playlist.fill(initialPlaylist);
 await studio.getByLabel('Описание главного плейлиста',{exact:true}).fill('Избранные композиции наших артистов');
 await save();await studio.locator('#landing-publish').click();
 await published.waitForFunction(value=>document.querySelector('#crystal-journey-title').textContent===value,initial);
 assert.equal(await published.locator('#vd-feature-title').textContent(),initialPlaylist);
 console.log('PASS Studio browser draft saved/reloaded, restore from published, publication and restoration via second publication. Legacy published schema used as fixture.');
 await studio.getByRole('button',{name:'+ Добавить плейлист',exact:true}).click();
 const newCard=studio.locator('#landing-fields .landing-card').filter({hasText:'Плейлист 2'});
 await newCard.getByLabel('Название',{exact:true}).fill('Классический плейлист');
 const chosenUrl='https://open.spotify.com/playlist/0123456789ABCDEFGHIJKL';
 await newCard.getByLabel('Официальная ссылка на плейлист',{exact:true}).fill(chosenUrl);
 await tab('hero');
 const selectWithCaption=caption=>studio.locator('label.landing-field').filter({
  has:studio.getByText(caption,{exact:true})
 }).locator('select');
 const skin=selectWithCaption('Вид главной страницы');
 const classicSelector=selectWithCaption('Плейлист на классической главной');
 const songSelector=selectWithCaption('Главная песня компактного вида');
 await skin.selectOption('classic');
 assert.equal(await classicSelector.isVisible(),true);
 assert.equal(await songSelector.isVisible(),false);
 await classicSelector.selectOption({label:'Классический плейлист'});
 await skin.selectOption('compact');
 assert.equal(await classicSelector.isVisible(),false);
 assert.equal(await songSelector.isVisible(),true);
 await songSelector.selectOption('rotate');
 await skin.selectOption('classic');
 assert.equal(await classicSelector.locator('option:checked').textContent(),'Классический плейлист');
 await save();
 await open();
 await classicSelector.waitFor({state:'visible'});
 assert.equal(await classicSelector.locator('option:checked').textContent(),'Классический плейлист');
 await studio.locator('#landing-publish').click();
 await published.waitForFunction(()=>document.querySelector('#vd-feature-title').textContent==='Классический плейлист');
 assert.match(await published.locator('#vd-feature-iframe').getAttribute('src'),/0123456789ABCDEFGHIJKL/);
 await skin.selectOption('compact');
 assert.equal(await songSelector.inputValue(),'rotate');
 await save();
 await studio.locator('#landing-publish').click();
 await published.waitForFunction(value=>document.querySelector('#vd-feature-title').textContent===value,initialPlaylist);
 console.log('PASS mode-specific editor, catalog playlist selection, draft reload and independent public modes.');
 await admin.close();
 const profiles=[
  ['Desktop '+engine.name(), {viewport:{width:1440,height:900}}],
  ['iPhone 11 UA / viewport',devices['iPhone 11']],
  ['Modern iPad UA / viewport',devices['iPad Pro 11']],
  ['Legacy iPad Safari 12 UA / viewport',{...devices['iPad (gen 7)'],viewport:{width:768,height:1024},userAgent:'Mozilla/5.0 (iPad; CPU OS 12_5_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1'}]
 ];
 for(const [name,opts] of profiles){
  const c=await setup(opts);const p=await c.newPage();observe(p);await p.goto(origin);
  await p.waitForFunction(()=>window.VMM_PUBLIC_LANDING&&window.VELAR_LIVING_ART);
  const result=await p.evaluate(async name=>{
   const assert=(v,m)=>{if(!v)throw Error(name+': '+m);};
   document.documentElement.style.scrollBehavior='auto';
   const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const landing=window.VMM_LANDING_SCHEMA.defaults();
   landing.hero.imageLoadingLevel=0;
   const chapter=document.querySelector('#crystal-journey');
   const stage=chapter.querySelector('.crystal-journey-stage');
   const render=()=>assert(window.VMM_PUBLIC_LANDING.render(landing),'render');
   const playlist=document.querySelector('#featured-spotify-playlist');
   const frame=playlist.querySelector('iframe');
   const counts=[];
   for(const skin of ['classic','compact']){
    landing.hero.skin=skin;render();await settle();
    assert(!playlist.hidden&&frame.src.includes('/embed/playlist/'),'missing player');
    assert(document.body.classList.contains('skin-compact')===(skin==='compact'),'skin mismatch');
    assert(document.querySelectorAll('#public-playlists-cards a[href="'+landing.hero.featuredPlaylist.url+'"]').length===1,'playlist must remain in gallery when featured in header');
    assert(document.querySelectorAll('.cms-playlists-shared-art .cms-playlist-art').length===1,'shared playlist crystal is present');
    assert(document.querySelectorAll('#public-playlists-cards .cms-playlist-art').length===1,'one crystal per gallery card');
    const sharedArt=document.querySelector('.cms-playlists-shared-art');
    const cardArt=document.querySelector('#public-playlists-cards .cms-playlist-art');
    const wide=innerWidth>=640;
    assert(getComputedStyle(sharedArt).display===(wide?'none':'block'),'shared art visibility at '+innerWidth);
    assert(getComputedStyle(cardArt).display===(wide?'block':'none'),'per-card art visibility at '+innerWidth);
    assert(getComputedStyle(document.querySelector('#public-playlists-cards')).flexDirection==='column','playlist cards must stack vertically');
    assert(playlist.getBoundingClientRect().right<=innerWidth+1,'playlist width');
    assert(playlist.scrollWidth<=playlist.clientWidth+1,'playlist horizontal overflow');
   }
   for(const count of [1,3,12]){
    landing.hero.crystalJourney.stages=Array.from({length:count},(_,i)=>'CMS '+(i+1));render();await settle();
    counts.push(chapter.offsetHeight);
    const top=scrollY+chapter.getBoundingClientRect().top;
    const distance=chapter.offsetHeight-innerHeight;
    for(let i=0;i<count;i++){
     scrollTo(0,top+distance*(i+.5)/count);
     await settle();
     assert(chapter.querySelector('.is-current')?.textContent==='CMS '+(i+1),'stage '+(i+1)+'/'+count+' / '+chapter.dataset.journeyPhase);
     assert(Math.abs(stage.getBoundingClientRect().top)<=2,'stage not pinned / '+stage.getBoundingClientRect().top+' ('+getComputedStyle(stage).position+')');
    }
    assert(Math.abs(stage.getBoundingClientRect().height-innerHeight)<=2,'stage height '+stage.getBoundingClientRect().height+' / '+innerHeight+' ('+chapter.getAttribute('data-motion-status')+')');
   }
   assert(counts[0]<counts[1]&&counts[1]<counts[2],'scroll distance '+counts);
   landing.hero.featuredPlaylist.enabled=false;landing.hero.crystalJourney.enabled=false;render();await settle();
   assert(playlist.hidden&&!frame.hasAttribute('src')&&chapter.hidden,'disabled state');
   assert(document.querySelector('#public-playlists-cards a[href="'+landing.hero.featuredPlaylist.url+'"]'),'gallery playlist removed when hero disabled');
   landing.hero.featuredPlaylist.enabled=true;
   landing.hero.featuredPlaylist.url='https://open.spotify.com/playlist/0123456789ABCDEFGHIJKL';
   landing.hero.crystalJourney.enabled=true;render();await settle();
   assert(!chapter.hidden&&frame.src.includes('0123456789ABCDEFGHIJKL'),'re-enable / URL change');
   return counts;
  },name);
  if(name.indexOf('iPhone 11')===0){
    // RUN-207: rotation changes CSS without rebuilding cards or affecting controls.
    await p.setViewportSize({width:896,height:414});
    const landscape=await p.evaluate(()=>{
      const grid=document.querySelector('#public-playlists-cards');
      const card=grid.querySelector('.cms-playlist-card');
      const shared=document.querySelector('.cms-playlists-shared-art');
      const art=card.querySelector('.cms-playlist-art');
      const details=card.querySelector('.cms-playlist-copy');
      return {
        shared:getComputedStyle(shared).display,art:getComputedStyle(art).display,
        layout:getComputedStyle(card).display,
        left:art.getBoundingClientRect().left,right:details.getBoundingClientRect().left,
        overflow:card.scrollWidth>card.clientWidth+1
      };
    });
    assert.equal(landscape.shared,'none','Landscape phone hides shared artwork');
    assert.equal(landscape.art,'block','Landscape phone shows art for each card');
    assert.equal(landscape.layout,'grid','Landscape phone uses side-by-side card layout');
    assert.ok(landscape.left<landscape.right&&!landscape.overflow,'Landscape card fits');
    await p.setViewportSize({width:414,height:896});
    const portrait=await p.evaluate(()=>{
      const card=document.querySelector('#public-playlists-cards .cms-playlist-card');
      return {
        shared:getComputedStyle(document.querySelector('.cms-playlists-shared-art')).display,
        art:getComputedStyle(card.querySelector('.cms-playlist-art')).display,
        card:getComputedStyle(card).display
      };
    });
    assert.equal(portrait.shared,'block','Portrait phone shows single shared artwork');
    assert.equal(portrait.art,'none','Portrait phone hides card artwork');
    assert.equal(portrait.card,'block','Portrait phone keeps compact cards');
  }
  // Real DOM: clicking About must land on its heading after lazy content and reordering.
  await p.evaluate(()=>{
    const d=VMM_LANDING_SCHEMA.defaults();
    d.hero.skin='classic';d.hero.imageLoadingLevel=3;
    VMM_PUBLIC_LANDING.render(d);
    scrollTo(0,0);
  });
  await p.locator('.site-nav a[href="#about"]').click();
  await p.waitForFunction(()=>{const r=document.querySelector('#about-section-heading').getBoundingClientRect();return location.hash==='#about'&&r.top>=0&&r.bottom<=innerHeight;});
  await p.evaluate(()=>{
    const d=VMM_LANDING_SCHEMA.defaults();d.hero.imageLoadingLevel=3;
    d.hero.sectionOrder=['topics','playlists','artists','albums','releases','languages','universe','song-stories','genres','about'];
    d.hero.crystalJourney.stages=Array.from({length:12},(_,i)=>'CMS delayed '+i);
    VMM_PUBLIC_LANDING.render(d);
  });
  await p.waitForFunction(()=>{const r=document.querySelector('#about-section-heading').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
  await p.evaluate(()=>{document.querySelector('#topics').style.paddingBottom='700px';});
  await p.waitForFunction(()=>{const r=document.querySelector('#about-section-heading').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
  await p.evaluate(()=>{window.dispatchEvent(new Event('wheel'));scrollTo(0,0);});
  await p.waitForFunction(()=>scrollY<5);
  await p.waitForTimeout(100);
  assert.ok(await p.evaluate(()=>scrollY<5),'User scroll must cancel anchor stabilization');
  console.log('PASS '+name+' about navigation after lazy rendering and layout changes');
  console.log('PASS '+name+' 1/3/12 stages, viewport pin, two skins, dedup, visibility and URL. Scene heights: '+result.join(', '));
  await c.close();
 }
 console.log('Console errors: '+JSON.stringify(unexpected));
 assert.deepEqual(unexpected,[]);
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
