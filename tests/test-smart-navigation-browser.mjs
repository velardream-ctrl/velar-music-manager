import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const useWebKit=process.argv.includes('--webkit');
const browser=useWebKit?await webkit.launch():await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:980,height:800},serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const live=process.argv.includes('--published');
  const origin='https://velardream.com/';
  if(live){
    const resources=['index.html','smart-navigation.js','public-song-ui.js','landing-public.js','velar-assistant.js'];
    const deadline=Date.now()+8*60*1000;
    for(const file of resources){
      const expected=await readFile(file,'utf8');
      for(;;){
        const response=await fetch(origin+file+'?verify='+Date.now());
        if(response.ok&&await response.text()===expected)break;
        if(Date.now()>deadline)throw Error('Pages did not serve release file '+file);
        await new Promise(resolve=>setTimeout(resolve,6000));
      }
    }
  }
  await page.route(/^https?:/,route=>live&&route.request().url().startsWith(origin)&&route.request().method()==='GET'?route.continue():route.abort());
  await page.goto(live?origin+'?verify='+Date.now():pathToFileURL(process.cwd()+'/index.html').href);
  if(live){
    const response=await fetch('https://firestore.googleapis.com/v1/projects/velardream-records-studio/databases/(default)/documents/vmm_public_pages/landing');
    assert.equal(response.status,200);
    function decode(v){
      if(v.mapValue)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,value])=>[k,decode(value)]));
      if(v.arrayValue)return (v.arrayValue.values||[]).map(decode);
      if(v.integerValue)return Number(v.integerValue);
      return Object.values(v)[0];
    }
    const document=decode({mapValue:await response.json()});
    assert.equal(document.status,'published');
    const title=await page.evaluate(content=>{
      if(!VMM_PUBLIC_LANDING.render(content))throw Error('Published content rejected');
      const normalized=VMM_LANDING_SCHEMA.normalize(content);
      const clips=normalized.releases.cards.filter(item=>item.visible&&item.kind==='video');
      if(clips.length&&normalized.releases.videoView==='auto'){
        const rail=document.querySelector('.video-carousel .public-song-carousel-track');
        if(!rail||rail.children.length!==clips.length)throw Error('Published video carousel incomplete');
        console.log('Published video carousel',clips.length);
      }
      const artist=normalized.artists.cards.find(a=>a.visible&&a.featuredTracks.length);
      const song=artist.featuredTracks[0];
      const result=VELAR_NAVIGATION.command('Найди песню '+song.title,normalized);
      const choice=result.selection||(result.actions||[]).find(c=>c.url===song.url);
      if(!choice||!VELAR_NAVIGATION.navigate(choice))throw Error('Published song unreachable');
      return song.title;
    },document.content);
    await page.waitForFunction(()=>document.querySelector('.song-found iframe'));
    console.log('Published catalog and player verified:',title);
    const match=await page.evaluate(content=>{
      const result=VELAR_NAVIGATION.command('Покажи Любовь',VMM_LANDING_SCHEMA.normalize(content));
      return result&&result.selection&&VELAR_NAVIGATION.navigate(result.selection);
    },document.content);
    if(match){
      const card=page.locator('.public-song-entry.is-playing').filter({has:page.getByText('Любовь',{exact:true})});
      await card.waitFor();
      for(const width of [390,896]){
        await page.setViewportSize({width,height:780});
        await page.waitForTimeout(350);
        assert.ok(await card.evaluate(el=>{
          const caption=el.querySelector('.public-song-copy strong').getBoundingClientRect();
          const player=el.querySelector('iframe').getBoundingClientRect();
          return caption.height>0&&player.height>0&&(player.bottom<=caption.top+1||caption.bottom<=player.top+1);
        }),'Published Любовь caption at '+width);
      }
      console.log('Published Любовь title visible at 390 and 896 px');
    }
  }
  await page.evaluate(()=>{
    const d=window.fixture=VMM_LANDING_SCHEMA.defaults();
    const group=d.genres.topics.entries[0];
    group.visible=true;
    group.tracks=Array.from({length:250},(_,i)=>({
      title:i===248?'Люба':'Трек '+String(i).padStart(3,'0'),artist:'Velar',
      provider:'youtube',url:'https://www.youtube.com/watch?v='+String(i).padStart(11,'0')
    }));
    Object.assign(group.tracks[248],{alternateProvider:'spotify',alternateUrl:'https://open.spotify.com/track/0123456789ABCDEFGHIJKL',thirdProvider:'appleMusic',thirdUrl:'https://music.apple.com/fi/album/white-birch/1234567890?i=1234567891'});
    d.genres.displayModes={topics:'auto',languages:'rows',genres:'rows',albums:'rows'};
    d.genres.assistant.enabled=true;
    VMM_LANDING_SCHEMA.normalize(d);
  });
  for(const videoView of ['grid','carousel','auto']){
    assert.ok(await page.evaluate(view=>{
      fixture.releases.videoView=view;
      fixture.releases.cards=Array.from({length:4},(_,i)=>({title:'Видео '+i,
        visible:true,kind:'video',spotlight:i===0?'video':'none',mediaProvider:'youtube',
        mediaUrl:'https://www.youtube.com/watch?v='+String(i).padStart(11,'0')}));
      return VMM_PUBLIC_LANDING.render(fixture);
    },videoView));
    const gallery=page.locator('#public-releases-cards');
    assert.equal(await gallery.locator('.cms-release-card').count(),4);
    if(videoView==='grid')continue;
    const rail=gallery.locator('.public-song-carousel-track');
    await rail.scrollIntoViewIfNeeded();
    await page.mouse.move(0,0);
    if(videoView==='auto')await page.waitForFunction(()=>document.querySelector('.video-carousel .public-song-carousel-track').scrollLeft>4);
    const rect=await rail.boundingBox();
    await page.mouse.move(rect.x+rect.width/2,Math.min(790,rect.y+rect.height/2));
    await rail.locator('.cms-release-listen').first().focus();
    await page.keyboard.press('Enter');
    await rail.locator('iframe').waitFor();
    await page.mouse.move(0,0);
    await page.waitForTimeout(250);
    const stopped=await rail.evaluate(el=>el.scrollLeft);
    await page.waitForTimeout(250);
    assert.equal(await rail.evaluate(el=>el.scrollLeft),stopped);
    await rail.locator('.cms-release-close').first().click();
    await gallery.getByRole('button',{name:'Синглы',exact:true}).click();
    assert.equal(await rail.count(),0);
    await gallery.getByRole('button',{name:'Видеоклипы',exact:true}).click();
    assert.equal(await rail.locator('.cms-release-card').count(),4);
  }
  await page.evaluate(()=>{fixture.releases.cards=[];fixture.releases.videoView='grid';});
  for(const mode of ['rows','carousel','auto','compact','tiles','covers']){
    assert.ok(await page.evaluate(mode=>{
      fixture.genres.displayModes.topics=mode;
      return VMM_PUBLIC_LANDING.render(fixture);
    },mode));
    const command=text=>page.evaluate(text=>{
      const result=VELAR_NAVIGATION.command(text,fixture);
      return VELAR_NAVIGATION.navigate(result.selection);
    },text);
    assert.ok(await command('Найди песню Трек 220'));
    assert.ok(await command('Включи Любу'));
    const selected=page.locator('#public-topic-detail .is-playing');
    await selected.filter({hasText:'Люба'}).waitFor();
    assert.equal(await page.locator('#public-topic-detail iframe').count(),1);
    assert.match(await selected.locator('iframe').getAttribute('src'),/autoplay=1/);
    async function checkCaption(){
      assert.ok(await selected.evaluate(card=>{
        const box=el=>el.getBoundingClientRect();
        const caption=box(card.querySelector('.public-song-copy strong')),media=box(card.querySelector('iframe'));
        return caption.height>0&&caption.width>0&&(caption.top>=media.bottom-1||caption.bottom<=media.top+1);
      }),'Visible song title outside the player in '+mode);
    }
    await checkCaption();
    for(const provider of ['spotify','appleMusic']){
      await selected.locator('[data-provider="'+provider+'"]').click();
      await checkCaption();
    }
    if(mode==='auto'||mode==='carousel'){
      for(const width of [980,390,844]){
        await page.setViewportSize({width,height:800});
        await page.waitForTimeout(300);
        await checkCaption();
        const offset=await selected.evaluate(el=>{
          const rail=el.parentNode,r=rail.getBoundingClientRect(),c=el.getBoundingClientRect();
          return Math.abs(c.left+c.width/2-r.left-rail.clientWidth/2);
        });
        assert.ok(offset<=3,'Center with '+width+'px viewport: '+offset);
      }
      if(mode==='auto'){
        const rail=page.locator('#public-topic-detail .public-song-carousel-track');
        const pause=page.locator('#public-topic-detail button').filter({hasText:'Пауза'});
        await pause.click();
        await selected.locator('[data-provider="appleMusic"]').click();
        await page.mouse.move(0,0);
        const stopped=await rail.evaluate(el=>el.scrollLeft);
        await page.waitForTimeout(450);
        assert.equal(await rail.evaluate(el=>el.scrollLeft),stopped);
        await page.getByRole('button',{name:'Продолжить',exact:true}).click();
        await page.mouse.move(0,0);
        await page.waitForFunction(pos=>document.querySelector('#public-topic-detail .public-song-carousel-track').scrollLeft!==pos,stopped);
      }
    }
  }
  assert.deepEqual(await page.evaluate(()=>{
    const get=q=>VELAR_NAVIGATION.command(q,fixture);
    return [get('Найди Луба').actions.length,get('Найди песню Трек 20').actions.length,!!get('Найди песню Неизвестная').selection];
  }),[1,10,false]);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{
    fixture.genres.displayModes.topics='auto';
    VMM_PUBLIC_LANDING.render(fixture);
    document.querySelector('.velar-assistant-launch').click();
    const input=document.querySelector('.velar-assistant-input');
    input.value='Найди песню Люба';
    input.form.dispatchEvent(new Event('submit',{cancelable:true}));
  });
  await page.locator('#public-topic-detail .song-found').filter({hasText:'Люба'}).waitFor();
  const artistDocument=await page.evaluate(()=>{
    const data=structuredClone(fixture),artist={};data.artists.cards=[artist];
    artist.visible=true;artist.title='Test Artist';artist.artistId='test-artist';
    artist.featuredTracks=data.genres.topics.entries[0].tracks.slice(0,5);
    artist.profileDisplay='auto';artist.homeDisplay='rows';
    artist.profileDisplayMotion={direction:'left',end:'swing',speed:87};
    const normalized=VMM_LANDING_SCHEMA.normalize(data);
    if(JSON.stringify(normalized)!==JSON.stringify(VMM_LANDING_SCHEMA.normalize(normalized)))throw Error('Settings do not round-trip');
    if(normalized.artists.cards[0].homeDisplay!=='rows'||normalized.genres.displayModes.topics!=='auto')throw Error('Layouts crossed sections');
    return data;
  });
  const artistUrl=live?origin+'artist.html':pathToFileURL(process.cwd()+'/artist.html').href;
  await page.goto(artistUrl+'?id=test-artist');
  assert.ok(await page.evaluate(d=>VMM_ARTIST_DETAIL.render(d),artistDocument));
  const profile=page.locator('#artist-song-search');
  await profile.locator('input').fill('Трек 003');
  await profile.getByRole('button',{name:'Найти',exact:true}).click();
  await page.locator('#artist-tracks .song-found iframe').waitFor();
  assert.deepEqual(errors,[]);
  console.log('Browser passed: list, compact, carousel, auto, repeated navigation, centering, pause, restore, fuzzy and ambiguous queries.');
} finally { await browser.close(); }
