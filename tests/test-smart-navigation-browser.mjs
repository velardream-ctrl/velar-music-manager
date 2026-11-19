import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { chromium, webkit } from 'playwright';

const useWebKit=process.argv.includes('--webkit');
const browser=useWebKit?await webkit.launch():await chromium.launch({channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:980,height:800},serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route(/^https?:/,route=>route.abort());
  await page.goto(pathToFileURL(process.cwd()+'/index.html').href);
  await page.evaluate(()=>{
    const d=window.fixture=VMM_LANDING_SCHEMA.defaults();
    const group=d.genres.topics.entries[0];
    group.visible=true;
    group.tracks=Array.from({length:250},(_,i)=>({
      title:i===248?'Люба':'Трек '+String(i).padStart(3,'0'),artist:'Velar',
      provider:'youtube',url:'https://www.youtube.com/watch?v='+String(i).padStart(11,'0')
    }));
    d.genres.displayModes={topics:'auto',languages:'rows',genres:'rows',albums:'rows'};
    d.genres.assistant.enabled=true;
    VMM_LANDING_SCHEMA.normalize(d);
  });
  for(const mode of ['rows','carousel','auto','compact']){
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
    if(mode==='auto'||mode==='carousel'){
      for(const width of [980,390,844]){
        await page.setViewportSize({width,height:800});
        await page.waitForTimeout(300);
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
        await selected.locator('.public-song-source').click();
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
    return [get('Найди Луба').actions.length,get('Найди Трек 20').actions.length,!!get('Найди песню Неизвестная').selection];
  }),[1,10,false]);
  assert.deepEqual(errors,[]);
  console.log('Browser passed: list, compact, carousel, auto, repeated navigation, centering, pause, restore, fuzzy and ambiguous queries.');
} finally { await browser.close(); }
