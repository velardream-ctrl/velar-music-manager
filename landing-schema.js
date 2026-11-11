/* RUN-061. Shared, public-safe landing page schema. ES5 for older Safari.
   No private catalog, lyrics, audio or credentials can enter this structure. */
(function(){
  'use strict';
  // RUN-072 — Navigation and language entries live inside genres to preserve
  // Firestore rules/schemaVersion and avoid extra public database requests.
  function defaultUniverseNodes(){
    return [
      {id:'artists',label:'Артисты',description:'Голоса и истории исполнителей',target:'artists',visible:true},
      {id:'releases',label:'Релизы',description:'Синглы и альбомы музыкальной вселенной',target:'releases',visible:true},
      {id:'videos',label:'Клипы',description:'Видеопремьеры и музыкальные истории',target:'releases',visible:true},
      {id:'playlists',label:'Плейлисты',description:'Авторские музыкальные подборки',target:'playlists',visible:true},
      {id:'genres',label:'Жанры',description:'От оперы и этно до современного звука',target:'genres',visible:true},
      {id:'radio',label:'VELAR RADIO',description:'Официальный плейлист по выбору слушателя',target:'playlists',visible:true},
      {id:'languages',label:'Миры языков',description:'Реальные и вымышленные языки моих песен',target:'languages',visible:true},
      {id:'topics',label:'Миры чувств',description:'Любовь, свадьба, космос и другие темы песен',target:'topics',visible:true}
    ];
  }
  function defaultLanguages(){
    // Confirmed language *families*, not guessed track-language assignments.
    // Songs remain empty until the owner links official published recordings.
    return [
      ['ru','Русский',false],['en','Английский',false],
      ['it','Итальянский',false],['fr','Французский',false],
      ['de','Немецкий',false],['fi','Финский',false],
      ['es','Испанский',false],['hu','Венгерский',false],
      ['nl','Нидерландский',false],['tr','Турецкий',false],
      ['ur','Урду',false],['beaver','Бобриный язык',true],
      ['alien','Инопланетный язык',true]
    ].map(function(item){return {code:item[0],label:item[1],fictional:item[2],visible:true,tracks:[]};});
  }
  function defaultTopics(){
    // These are editorial themes, NOT claims that a specific song is about
    // any of them. Owner approval is required for every track association.
    return [
      ['love','Любовь','Песни о любви и близости'],
      ['wedding','Свадьба','Свадебные песни и музыка для торжества'],
      ['loyalty','Верность','Верность, доверие и преданность'],
      ['jealousy','Ревность','Ревность, сомнения и сложные чувства'],
      ['faith','Вера и религия','Духовные мотивы, вера и размышления'],
      ['space','Космос','Звёзды, вселенная и далёкие миры'],
      ['sadness','Грусть','Грустные песни, размышления и воспоминания'],
      ['humor','Юмор','Смешные и ироничные песни'],
      ['happiness','Счастье','Радость жизни и счастливые мгновения'],
      ['friendship','Дружба','Дружба и человеческие отношения'],
      ['family','Семья','Семейные чувства и тепло дома'],
      ['children','Дети','Песни о детях и детстве'],
      ['mother','Мама','Песни о матери и материнской любви'],
      ['homeland','Родина','Малая родина, родные места и память'],
      ['nature','Природа','Леса, озёра, животные и времена года'],
      ['dreams','Мечты','Мечты, фантазия и вдохновение'],
      ['hope','Надежда','Надежда и светлое будущее'],
      ['separation','Расставание','Прощание, потеря и разлука'],
      ['nostalgia','Ностальгия','Воспоминания о прошлом'],
      ['celebration','Праздник','Музыка для праздников'],
      ['dance','Танцы','Танцевальные песни и ритмы'],
      ['journey','Путешествия','Дороги, путешествия и открытия']
    ].map(function(row){
      return {slug:row[0],label:row[1],description:row[2],visible:true,tracks:[]};
    });
  }
  function defaults(){
    return {
      hero:{
        subtitle:'Разные голоса. Разные жанры. Одна вселенная музыки.',
        intro:'Здесь рождается пространство для артистов, авторских релизов и музыкальных историй — от оперы и этно до рока, поп-музыки и кроссоверов.'
      },
      artists:{
        heading:'У каждого голоса — своя история',
        intro:'Отдельные профили артистов с собственным оформлением, записями, клипами и ссылками на музыкальные площадки.',
        cards:[]
      },
      releases:{
        heading:'Музыка, которую можно открыть заново',
        intro:'Синглы, альбомы, клипы и внешние плееры — без загрузки тяжёлых музыкальных файлов на собственный сервер.',
        cards:[],
        radio:{enabled:false,controlVersion:2,title:'VELAR RADIO',provider:'spotify',url:'https://open.spotify.com/playlist/11Vdx5lXmtfMiXh63YhIwh'},
        playlists:[{title:'Мой лучший плейлист',description:'Музыкальная подборка VELAR',provider:'spotify',
          url:'https://open.spotify.com/playlist/11Vdx5lXmtfMiXh63YhIwh',visible:true}],
        subscriptions:[{title:'DJ Velar в Spotify',provider:'spotify',
          url:'https://open.spotify.com/artist/1PNzGsDcFVuOMBN7Gw12tw',visible:true}]
      },
      genres:{
        heading:'От оперы до новых звуков',
        intro:'Ищите музыку по настроению, жанру, артисту или тематической подборке. Жанры и плейлисты будут дополнять друг друга, а не смешивать песни в один список.',
        tags:['Опера','Поп','Рок','Этно','Кроссовер','Юмор','Авторские подборки'],
        universe:{heading:'Вселенная, которую можно услышать',
          intro:'Исследуйте созвездия артистов, клипов и релизов. Каждое движение открывает новый маршрут к музыке.',
          nodes:defaultUniverseNodes()},
        languages:{heading:'Музыка на языках Вселенной',
          intro:'От знакомых голосов мира до придуманных языков. Выберите язык, чтобы увидеть подтверждённые песни на нём.',
          entries:defaultLanguages()},
        topics:{heading:'Созвездия чувств и историй',
          intro:'Откройте музыку по теме: от свадебных песен и любви до космоса, юмора и светлой грусти.',
          entries:defaultTopics()},
        assistant:{enabled:true,greetingEnabled:true,title:'VELAR · помощник',
          welcome:'Добро пожаловать во вселенную VELARDREAM! Какое настроение у вас сегодня?',
          contactEmail:'',rules:[],
          typing:{enabled:true,speedMs:35}, // RUN-082: owner-controlled local typing effect
          labels:{
            launcher:'Помощник VELAR',
            headerNote:'Локальный бот · без платного ИИ',
            greetingBubble:'Добро пожаловать во вселенную VELARDREAM! Какое настроение у вас сегодня?',
            greetingCloseText:'×',greetingCloseAria:'Скрыть приветствие',
            closeText:'×',closeAria:'Закрыть помощника',
            dialogAria:'VELAR — музыкальный помощник',
            inputAria:'Напиши вопрос помощнику',
            inputPlaceholder:'Например: нужна грустная песня…',
            submit:'Спросить',
            privacy:'Не сохраняем и не отправляем автору'
          },
          quickTopics:[
            {label:'Мне грустно',query:'грустно'},
            {label:'Свадебная музыка',query:'свадьба'},
            {label:'Космос',query:'космос'},
            {label:'Сотрудничество',query:'сотрудничество'}
          ],
          // RUN-080: all ten already-deployed portraits are reusable.
          // Two optional small custom slots have strict size and MIME limits.
          avatars:{
            launcher:'neutral',header:'neutral',greeting:'auto',
            reactions:{neutral:'neutral',wave:'wave',morning:'morning',night:'night',
              thanks:'thanks',heart:'heart',okay:'okay',peace:'peace',off:'off',celebrate:'celebrate'},
            keywordRules:[],
            customImages:[{name:'Мой портрет 1',dataUrl:''},{name:'Мой портрет 2',dataUrl:''}]
          },
          replies:{
            emptyInput:'Расскажи, что тебе интересно: музыка, настроение, артисты или сотрудничество.',
            contactEnabled:'Я цифровой помощник, не живой оператор. Могу помочь составить письмо о сотрудничестве. Отправка состоится только из твоей почтовой программы после подтверждения.',
            contactDisabled:'Я цифровой помощник, не живой оператор. Автоматическая отправка сообщений пока отключена. Контактная почта ещё не настроена; можно найти официальные страницы артистов в разделе подписок.',
            contactEnabledButton:'Написать автору',
            contactDisabledButton:'Перейти к официальным страницам',
            moodWithTracks:'Для настроения «{topic}» найдены песни: {count}. Открой подборку и выбери композицию — воспроизведение начнётся только после твоего нажатия.',
            moodWithoutTracks:'Тема «{topic}» уже есть во вселенной VELARDREAM, но её песни пока готовятся к публикации. Можешь посмотреть и другие тематические миры.',
            moodButton:'Открыть «{topic}»',
            hello:'Привет! Рад встрече во вселенной VELARDREAM. Какую музыку хочется услышать: грустную, свадебную, романтическую или весёлую?',
            radio:'VELAR RADIO — официальный музыкальный плейлист. Он запускается только по твоему выбору. Можно также открыть другие плейлисты.',
            radioButton:'Посмотреть плейлисты',
            languages:'В нашей вселенной есть миры настоящих и придуманных языков. Выбери язык и открой его подборку.',
            languagesButton:'Выбрать язык',
            releases:'В разделе релизов представлены синглы, альбомы и видеоклипы. Можно отфильтровать нужный формат.',
            releasesButton:'Открыть релизы',
            artists:'Здесь есть отдельные миры артистов. Выбери исполнителя, чтобы узнать больше и услышать его музыку.',
            artistsButton:'Открыть артистов',
            fallbackEnabled:'Я пока не умею уверенно отвечать на этот вопрос. Могу открыть музыкальную вселенную или помочь написать автору.',
            fallbackDisabled:'Я ещё учусь отвечать на вопросы. Попробуй написать «свадьба», «грустно», «радио», «артисты» или «сотрудничество».',
            fallbackButton:'Исследовать темы'
          }
        }
      },
      about:{
        heading:'VELARDREAM RECORDS',
        intro:'Музыкальный проект, объединяющий разных исполнителей, жанры и творческие идеи. Сейчас мы создаём его официальный дом в интернете.',
        notice:'Сайт находится в разработке. Публичные страницы артистов, релизы и плейлисты будут появляться постепенно.'
      }
    };
  }
  function plain(value,label,max,mandatory){
    if(typeof value!=='string')throw new Error(label+': требуется строка.');
    var s=value.trim();
    if(s.length>max)throw new Error(label+': максимум '+max+' символов.');
    if(mandatory&&!s)throw new Error(label+': поле обязательно.');
    if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))
      throw new Error(label+': недопустимые управляющие символы.');
    return s;
  }
  function url(value,label){
    var s=plain(value,label,400,false);
    if(!s)return '';
    if(!/^https:\/\/[a-z0-9][^\s]*$/i.test(s)||/[<>"'\\]/.test(s))
      throw new Error(label+': допускается только HTTPS-ссылка.');
    // Explicitly block common private file/storage endpoints in publication.
    if(/^https:\/\/(?:drive\.google\.com|docs\.google\.com|firebasestorage\.googleapis\.com|storage\.googleapis\.com)(?:[:\/?#]|$)/i.test(s))
      throw new Error(label+': приватные ссылки Google Drive и Storage публиковать нельзя.');
    return s;
  }
  // RUN-067. Only verified direct song URLs, never artist/album/playlist,
  // Drive, private audio, or arbitrary iframe code. Public whitelist is strict.
  function songUrl(raw,provider){
    if(typeof raw!=='string')return '';
    var s=raw.trim(),m;
    if(provider==='spotify'){
      m=/^https:\/\/open\.spotify\.com\/track\/([A-Za-z0-9]{22})(?:\?[^#\s]*)?$/i.exec(s);
      return m?'https://open.spotify.com/track/'+m[1]:'';
    }
    if(provider==='youtube'){
      m=/^https:\/\/(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})(?:[?#][^\s]*)?$/i.exec(s);
      if(!m&&/^https:\/\/(?:(?:www|music)\.)?youtube\.com\/watch\?[^#\s]+$/i.test(s))
        m=/(?:[?&])v=([A-Za-z0-9_-]{11})(?:&|#|$)/.exec(s);
      return m?'https://www.youtube.com/watch?v='+m[1]:'';
    }
    return '';
  }
  function featuredTrack(x,index){
    if(!x||typeof x!=='object'||Array.isArray(x))
      throw new Error('Лучшая песня '+index+': неверная запись.');
    var provider=plain(x.provider||'','Площадка песни '+index,20,true);
    if(provider!=='spotify'&&provider!=='youtube')
      throw new Error('Лучшая песня '+index+': можно использовать только Spotify или YouTube.');
    var track={title:plain(x.title||'','Название песни '+index,110,true),
      provider:provider,url:songUrl(x.url,provider)};
    if(!track.url)throw new Error('Для песни '+index+' нужна прямая ссылка на трек '+provider+'.');
    return track;
  }
  function featuredTracks(value){
    var rows=typeof value==='undefined'?[]:value;
    if(!Array.isArray(rows)||rows.length>3)
      throw new Error('Для артиста можно выбрать не более трёх лучших песен.');
    var seen={};
    return rows.map(function(row,i){
      var selected=featuredTrack(row,i+1);
      if(seen[selected.url])throw new Error('В подборке не должно быть повторов одной ссылки.');
      seen[selected.url]=true;
      return selected;
    });
  }

  // RUN-069 — strictly recognized public platform URLs; never accept
  // raw HTML, arbitrary iframe src, private audio or tracking parameters.
  function releaseMediaUrl(raw,provider){
    if(typeof raw!=='string'||!raw.trim())return '';
    var normalized=songUrl(raw,provider),m;
    if(normalized)return normalized;
    if(provider==='spotify'){
      m=/^https:\/\/open\.spotify\.com\/album\/([A-Za-z0-9]{22})(?:\?[^#\s]*)?$/i.exec(raw.trim());
      return m?'https://open.spotify.com/album/'+m[1]:'';
    }
    return '';
  }
  function playlistUrl(raw,provider){
    if(typeof raw!=='string'||!raw.trim())return '';
    var value=raw.trim(),m;
    if(provider==='spotify'){
      m=/^https:\/\/open\.spotify\.com\/playlist\/([A-Za-z0-9]{22})(?:\?[^#\s]*)?$/i.exec(value);
      return m?'https://open.spotify.com/playlist/'+m[1]:'';
    }
    if(provider==='youtube'){
      m=/^https:\/\/(?:(?:www|music)\.)?youtube\.com\/playlist\?list=([A-Za-z0-9_-]{12,80})(?:&[^#\s]*)?$/i.exec(value);
      return m?'https://www.youtube.com/playlist?list='+m[1]:'';
    }
    return '';
  }
  function radioConfig(raw){
    var x=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    // RUN-078: old published documents can have enabled:true, but were never
    // opted into the new Studio-wide radio switch. Keep them OFF until the
    // owner explicitly republishes settings using this control version.
    var enabled=x.enabled===true&&x.controlVersion===2;
    var provider=x.provider==='youtube'?'youtube':'spotify';
    if(typeof x.provider!=='undefined'&&x.provider!=='youtube'&&x.provider!=='spotify')
      throw new Error('VELAR RADIO: выбери Spotify или YouTube.');
    var link=playlistUrl(x.url||'',provider);
    if(x.url&&!link)throw new Error('VELAR RADIO: укажи официальную ссылку на публичный плейлист '+provider+'.');
    if(enabled&&!link)throw new Error('VELAR RADIO: сначала укажи ссылку на плейлист.');
    return {enabled:enabled,controlVersion:2,title:plain(typeof x.title==='string'?x.title:'VELAR RADIO','Название радио',70,true),
      provider:provider,url:link};
  }

  function playlistCard(x,i){
    if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Плейлист '+i+': неправильная запись.');
    var provider=x.provider==='youtube'?'youtube':'spotify';
    if(x.provider&&x.provider!==provider)throw new Error('Плейлист '+i+': только Spotify или YouTube.');
    var link=playlistUrl(x.url||'',provider);
    if(x.visible===true&&!link)throw new Error('Плейлист '+i+': нужна публичная ссылка на плейлист.');
    if(x.url&&!link)throw new Error('Плейлист '+i+': неверная ссылка.');
    return {title:plain(x.title||'','Название плейлиста '+i,100,x.visible===true),
      description:plain(x.description||'','Описание плейлиста '+i,240,false),
      provider:provider,url:link,visible:x.visible===true};
  }
  function subscriptionUrl(raw,provider){
    if(typeof raw!=='string')return '';
    var s=raw.trim();
    if(provider==='spotify'){
      var m=/^https:\/\/open\.spotify\.com\/artist\/([A-Za-z0-9]{22})(?:\?[^#\s]*)?$/i.exec(s);
      return m?'https://open.spotify.com/artist/'+m[1]:'';
    }
    if(provider==='youtube'){
      var y=/^https:\/\/(?:www\.)?youtube\.com\/(channel\/[A-Za-z0-9_-]{15,}|@[A-Za-z0-9_.-]{3,})(?:\/)?(?:\?[^#\s]*)?$/i.exec(s);
      return y?'https://www.youtube.com/'+y[1]:'';
    }
    if(provider==='telegram'){
      var t=/^https:\/\/t\.me\/([A-Za-z0-9_]{5,32})(?:\/)?(?:\?[^#\s]*)?$/i.exec(s);
      return t?'https://t.me/'+t[1]:'';
    }
    return '';
  }
  function subscriptionCard(x,i){
    if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Подписка '+i+': неправильная запись.');
    var provider=x.provider||'spotify';
    if(['spotify','youtube','telegram'].indexOf(provider)<0)
      throw new Error('Подписка '+i+': допустимы Spotify, YouTube, Telegram.');
    var link=subscriptionUrl(x.url||'',provider);
    if(x.url&&!link)throw new Error('Подписка '+i+': неверная ссылка на профиль.');
    if(x.visible===true&&!link)throw new Error('Подписка '+i+': нужна публичная ссылка.');
    return {title:plain(x.title||'','Подписка '+i,90,x.visible===true),provider:provider,
      url:link,visible:x.visible===true};
  }
  function safeList(raw,max,label,mapper,defaultRows){
    var list=typeof raw==='undefined'?defaultRows:raw;
    if(!Array.isArray(list)||list.length>max)throw new Error(label+': не более '+max+' записей.');
    return list.map(mapper);
  }

  function universeConfig(raw,def){
    var item=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    var nodes=typeof item.nodes==='undefined'?def.nodes:item.nodes;
    if(!Array.isArray(nodes)||nodes.length>12)throw new Error('Созвездия: максимум 12 меню.');
    var used={},allowed={artists:true,releases:true,playlists:true,genres:true,
      languages:true,topics:true,about:true,radio:true};
    var cleaned=nodes.map(function(n,i){
      if(!n||typeof n!=='object'||Array.isArray(n))throw new Error('Созвездие '+(i+1)+': неверный объект.');
      var ident=plain(n.id||'','Код созвездия '+(i+1),30,true).toLowerCase();
      if(!/^[a-z0-9-]{2,30}$/.test(ident)||used[ident])
        throw new Error('Созвездие: код должен быть уникальным (латинские буквы, цифры, дефис).');
      used[ident]=true;
      var target=plain(n.target||'','Цель созвездия '+(i+1),25,true);
      if(!allowed[target])throw new Error('Созвездие: можно ссылаться только на раздел сайта.');
      return {id:ident,label:plain(n.label||'','Название созвездия '+(i+1),65,n.visible===true),
        description:plain(n.description||'','Описание созвездия '+(i+1),170,false),
        target:target,visible:n.visible===true};
    });
    return {heading:plain(typeof item.heading==='string'?item.heading:def.heading,
      'Название вселенной',160,true),
      intro:plain(typeof item.intro==='string'?item.intro:def.intro,
      'Описание вселенной',450,true),
      nodes:cleaned};
  }
  function languageTrack(raw,i){
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Песня языка '+i+': неверная запись.');
    var provider=plain(raw.provider||'','Площадка языковой песни '+i,20,true);
    if(provider!=='spotify'&&provider!=='youtube')
      throw new Error('Языковая песня: только Spotify и YouTube.');
    var link=songUrl(raw.url,provider);
    if(!link)throw new Error('Языковая песня: требуется прямая ссылка Spotify/YouTube на трек.');
    return {title:plain(raw.title||'','Название песни '+i,110,true),
      artist:plain(raw.artist||'','Исполнитель '+i,100,false),
      provider:provider,url:link};
  }
  function languagesConfig(raw,def){
    var item=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    var entries=typeof item.entries==='undefined'?def.entries:item.entries;
    if(!Array.isArray(entries)||entries.length>20)throw new Error('Языковые миры: максимум 20 языков.');
    var codes={};
    var results=entries.map(function(lang,i){
      if(!lang||typeof lang!=='object'||Array.isArray(lang))throw new Error('Язык '+(i+1)+': неверный объект.');
      var code=plain(lang.code||'','Код языка '+(i+1),28,true).toLowerCase();
      if(!/^[a-z0-9-]{2,28}$/.test(code)||codes[code])
        throw new Error('Языковые миры: коды должны быть уникальными (латиница, цифры, дефис).');
      codes[code]=true;
      var tracks=typeof lang.tracks==='undefined'?[]:lang.tracks;
      if(!Array.isArray(tracks)||tracks.length>300)throw new Error('Язык '+code+': не более 300 публичных песен.');
      var seen={};
      var cleaned=tracks.map(function(track,j){
        var t=languageTrack(track,j+1);
        if(seen[t.url])throw new Error('Язык '+code+': повтор одной песни.');
        seen[t.url]=true;return t;
      });
      return {code:code,label:plain(lang.label||'','Название языка '+(i+1),64,lang.visible===true),
        fictional:lang.fictional===true,visible:lang.visible===true,tracks:cleaned};
    });
    return {heading:plain(typeof item.heading==='string'?item.heading:def.heading,
      'Языковые миры — заголовок',160,true),
      intro:plain(typeof item.intro==='string'?item.intro:def.intro,
      'Языковые миры — описание',450,true),entries:results};
  }
  function topicsConfig(raw,def){
    var x=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    var topics=typeof x.entries==='undefined'?def.entries:x.entries;
    if(!Array.isArray(topics)||topics.length>60)
      throw new Error('Темы песен: максимум 60 тематических миров.');
    var seen={};
    var result=topics.map(function(topic,i){
      if(!topic||typeof topic!=='object'||Array.isArray(topic))
        throw new Error('Тема '+(i+1)+': требуется объект.');
      var slug=plain(topic.slug||'','Код темы '+(i+1),35,true).toLowerCase();
      if(!/^[a-z0-9-]{2,35}$/.test(slug)||seen[slug])
        throw new Error('Тема: уникальный код латиницей, цифрами или дефисом.');
      seen[slug]=true;
      var label=plain(topic.label||'','Название темы '+(i+1),70,topic.visible===true);
      var description=plain(topic.description||'','Описание темы '+(i+1),350,false);
      var tracks=typeof topic.tracks==='undefined'?[]:topic.tracks;
      if(!Array.isArray(tracks)||tracks.length>300)
        throw new Error('Тема '+slug+': максимум 300 песен.');
      var used={};
      var chosen=tracks.map(function(t,j){
        var mapped=languageTrack(t,j+1); // same strict official whitelist
        if(used[mapped.url])throw new Error('Тема '+slug+': дублирование песни.');
        used[mapped.url]=true;return mapped;
      });
      return {slug:slug,label:label,description:description,
        visible:topic.visible===true,tracks:chosen};
    });
    return {heading:plain(typeof x.heading==='string'?x.heading:def.heading,
      'Заголовок тематических миров',160,true),
      intro:plain(typeof x.intro==='string'?x.intro:def.intro,
      'Описание тематических миров',450,true),entries:result};
  }
  // RUN-074 — only safe public chat configuration, not visitor messages or
  // keys. No server-side LLM, email API or per-message Firestore writes.
  function assistantConfig(raw,def){
    var item=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    var mail=plain(item.contactEmail||'','Публичная почта автора',160,false);
    if(mail&&!/^[^\s@<>]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(mail))
      throw new Error('Почта помощника: укажите корректный публичный email.');
    var rules=typeof item.rules==='undefined'?def.rules:item.rules;
    if(!Array.isArray(rules)||rules.length>25)
      throw new Error('Помощник: максимум 25 правил ответов.');
    var cleaned=rules.map(function(rule,i){
      if(!rule||typeof rule!=='object'||Array.isArray(rule))
        throw new Error('Помощник: правило '+(i+1)+' имеет неверный формат.');
      var words=plain(rule.keywords||'','Слова правила '+(i+1),140,true);
      if(!/^[^\u0000-\u001f<>\\]*$/.test(words)||!words.split(',').some(function(x){return x.trim().length>=2;}))
        throw new Error('Ключевые слова правила: разделите слова запятыми.');
      return {keywords:words,answer:plain(rule.answer||'','Ответ правила '+(i+1),500,true)};
    });
    // RUN-082. Safe per-character reveal, with instant reduced-motion fallback.
    var rawTyping=item.typing&&typeof item.typing==='object'&&!Array.isArray(item.typing)?
      item.typing:{};
    var speedMs=typeof rawTyping.speedMs==='undefined'?def.typing.speedMs:rawTyping.speedMs;
    if(typeof speedMs!=='number'||!isFinite(speedMs)||Math.floor(speedMs)!==speedMs||
       speedMs<15||speedMs>90)
      throw new Error('Скорость печати: выбери от 15 до 90 мс на символ.');
    var typing={enabled:rawTyping.enabled!==false,speedMs:speedMs};
    // RUN-080. Preserve all older published documents: missing keys use safe
    // defaults. No arbitrary HTML, links or executable scripts are accepted.
    var labelData=item.labels&&typeof item.labels==='object'&&!Array.isArray(item.labels)?item.labels:{};
    var limits={launcher:60,headerNote:100,greetingBubble:250,greetingCloseText:12,
      greetingCloseAria:100,closeText:12,closeAria:100,dialogAria:100,inputAria:100,
      inputPlaceholder:150,submit:40,privacy:180};
    var optionalLabels={headerNote:true,privacy:true};
    var labels={};
    Object.keys(def.labels).forEach(function(key){
      var original=key==='greetingBubble'&&typeof item.welcome==='string'?
        item.welcome:def.labels[key];
      var rawValue=typeof labelData[key]==='undefined'?original:labelData[key];
      labels[key]=plain(rawValue,'Надпись помощника: '+key,limits[key],!optionalLabels[key]);
    });
    var quick=typeof item.quickTopics==='undefined'?def.quickTopics:item.quickTopics;
    if(!Array.isArray(quick)||quick.length>12)
      throw new Error('Помощник: максимум 12 быстрых тем.');
    var quickTopics=quick.map(function(topic,i){
      if(!topic||typeof topic!=='object'||Array.isArray(topic))
        throw new Error('Быстрая тема '+(i+1)+': неверный формат.');
      return {label:plain(topic.label,'Кнопка темы '+(i+1),55,true),
        query:plain(topic.query,'Запрос темы '+(i+1),160,true)};
    });
    // Available portraits: local JPEG sprite + strictly bounded custom JPEGs.
    var available=['neutral','wave','morning','night','thanks','heart','okay','peace','off','celebrate','custom1','custom2'];
    var avatarRaw=item.avatars&&typeof item.avatars==='object'&&!Array.isArray(item.avatars)?
      item.avatars:{};
    function pictureChoice(value,label,defValue,allowAuto){
      var chosen=typeof value==='undefined'?defValue:value;
      if(typeof chosen!=='string'||(available.indexOf(chosen)===-1&&
         !(allowAuto&&chosen==='auto')))
        throw new Error('Аватар '+label+': выбери вариант из списка.');
      return chosen;
    }
    var imagesInput=typeof avatarRaw.customImages==='undefined'?def.avatars.customImages:avatarRaw.customImages;
    if(!Array.isArray(imagesInput)||imagesInput.length!==2)
      throw new Error('Помощник: доступны два дополнительных портрета.');
    var customImages=imagesInput.map(function(img,i){
      if(!img||typeof img!=='object'||Array.isArray(img))
        throw new Error('Дополнительный портрет '+(i+1)+': неверный формат.');
      var name=plain(img.name||'','Название портрета '+(i+1),45,true);
      var uri=img.dataUrl||'';
      if(typeof uri!=='string'||uri.length>24000||
        (uri&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(uri)))
        throw new Error('Дополнительный портрет '+(i+1)+': нужен JPEG до 18 КБ.');
      return {name:name,dataUrl:uri};
    });
    var reactionsInput=avatarRaw.reactions&&typeof avatarRaw.reactions==='object'&&
      !Array.isArray(avatarRaw.reactions)?avatarRaw.reactions:{};
    var reactions={};
    Object.keys(def.avatars.reactions).forEach(function(key){
      reactions[key]=pictureChoice(reactionsInput[key],'для '+key,
        def.avatars.reactions[key],false);
    });
    var rawKeywordRules=typeof avatarRaw.keywordRules==='undefined'?[]:avatarRaw.keywordRules;
    if(!Array.isArray(rawKeywordRules)||rawKeywordRules.length>20)
      throw new Error('Аватары: максимум 20 правил по ключевым словам.');
    var keywordRules=rawKeywordRules.map(function(rule,i){
      if(!rule||typeof rule!=='object'||Array.isArray(rule))
        throw new Error('Правило аватара '+(i+1)+': неверный формат.');
      var words=plain(rule.keywords||'','Слова аватара '+(i+1),140,true);
      if(!words.split(',').some(function(w){return w.trim().length>=2;}))
        throw new Error('Аватар: укажи ключевые слова через запятую.');
      var source=typeof rule.source==='undefined'?'question':rule.source;
      if(['question','answer','both'].indexOf(source)===-1)
        throw new Error('Аватар: выбери, где искать ключевые слова.');
      return {keywords:words,source:source,
        expression:pictureChoice(rule.expression,'правила '+(i+1),'neutral',false)};
    });
    var avatars={
      launcher:pictureChoice(avatarRaw.launcher,'кнопки',def.avatars.launcher,false),
      header:pictureChoice(avatarRaw.header,'шапки',def.avatars.header,false),
      greeting:pictureChoice(avatarRaw.greeting,'приветствия',def.avatars.greeting,true),
      reactions:reactions,keywordRules:keywordRules,customImages:customImages};
    var replyData=item.replies&&typeof item.replies==='object'&&!Array.isArray(item.replies)?item.replies:{};
    var replies={};
    Object.keys(def.replies).forEach(function(key){
      var val=typeof replyData[key]==='undefined'?def.replies[key]:replyData[key];
      replies[key]=plain(val,'Ответ помощника: '+key,
        key.indexOf('Button')!==-1?90:500,key.indexOf('Button')===-1);
    });
    return {enabled:item.enabled!==false,greetingEnabled:item.greetingEnabled!==false,
      title:plain(typeof item.title==='string'?item.title:def.title,'Название помощника',55,true),
      welcome:plain(typeof item.welcome==='string'?item.welcome:def.welcome,
        'Приветствие помощника',250,true),
      contactEmail:mail,rules:cleaned,typing:typing,labels:labels,quickTopics:quickTopics,replies:replies,avatars:avatars};
  }
  function card(x,type,index){
    if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Карточка '+index+': неверный формат.');
    var title=plain(x.title,'Название карточки '+index,110,!!x.visible);
    var result={
      title:title,
      subtitle:plain(x.subtitle||'','Подзаголовок '+index,110,false),
      description:plain(x.description||'','Описание '+index,360,false),
      url:url(x.url||'','Ссылка '+index),
      imageUrl:url(x.imageUrl||'','Изображение '+index),
      visible:x.visible===true
    };
    // A stable identifier is safe for the public page and permits future
    // links to approved releases. Private song documents are not included.
    if(type==='Артисты'){
      var artistId=plain(x.artistId||'','Ключ артиста '+index,80,false);
      if(artistId&&!/^[a-z0-9-]+$/.test(artistId))
        throw new Error('Ключ артиста: недопустимый формат.');
      result.artistId=artistId;
      var shape=x.imageShape||'square';
      if(shape!=='square'&&shape!=='circle')throw new Error('Форма фотографии: квадрат или круг.');
      result.imageShape=shape;
      var picture=x.imageData||'';
      if(typeof picture!=='string'||picture.length>126000||
        (picture&&!/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(picture)))
        throw new Error('Недопустимая фотография. Нужно сжатое WebP/JPEG до 90 КБ.');
      result.imageData=picture;
      result.featuredTracks=featuredTracks(x.featuredTracks);
    }else if(type==='Релизы'){
      var kinds={single:true,album:true,video:true};
      var kind=x.kind||'single';
      if(!kinds[kind])throw new Error('Тип релиза: сингл, альбом или видеоклип.');
      var spotlight=x.spotlight||'none';
      if(spotlight!=='none'&&spotlight!=='music'&&spotlight!=='video')
        throw new Error('Главная витрина: выбери музыка, видео или без выделения.');
      var provider=x.mediaProvider||'';
      if(provider!==''&&provider!=='spotify'&&provider!=='youtube')
        throw new Error('Плеер релиза: только Spotify или YouTube.');
      var media=releaseMediaUrl(x.mediaUrl||'',provider);
      if(x.mediaUrl&&!media)throw new Error('Релиз: требуется прямая ссылка Spotify на трек/альбом или YouTube на видео.');
      if(kind==='video'&&provider==='spotify'&&media)
        throw new Error('Видеоклип должен использовать YouTube.');
      var image=x.imageData||'';
      if(typeof image!=='string'||image.length>126000||
        (image&&!/^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)))
        throw new Error('Обложка релиза: сжатое WebP/JPEG до 90 КБ.');
      result.kind=kind;result.spotlight=spotlight;result.mediaProvider=provider;
      result.mediaUrl=media;result.imageData=image;
    }
    return result;
  }
  function section(value,key,def){
    var x=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    return {
      heading:plain(typeof x.heading==='string'?x.heading:def.heading,key+' — заголовок',160,true),
      intro:plain(typeof x.intro==='string'?x.intro:def.intro,key+' — описание',900,true)
    };
  }
  function cards(x,type){
    var rows=x&&x.cards||[];
    if(!Array.isArray(rows)||rows.length>12)throw new Error(type+': максимум 12 карточек.');
    return rows.map(function(row,i){return card(row,type,i+1);});
  }
  function normalize(value){
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Нет данных главной страницы.');
    var d=defaults(),hero=value.hero||{},artists=value.artists||{},releases=value.releases||{},genres=value.genres||{},about=value.about||{};
    var result={
      hero:{
        subtitle:plain(typeof hero.subtitle==='string'?hero.subtitle:d.hero.subtitle,'Первый экран — подзаголовок',160,true),
        intro:plain(typeof hero.intro==='string'?hero.intro:d.hero.intro,'Первый экран — описание',600,true)
      },
      artists:section(artists,'Артисты',d.artists),
      releases:section(releases,'Релизы',d.releases),
      genres:section(genres,'Жанры',d.genres),
      about:section(about,'О проекте',d.about)
    };
    result.artists.cards=cards(artists,'Артисты');
    result.releases.cards=cards(releases,'Релизы');
    result.releases.radio=radioConfig(typeof releases.radio==='undefined'?d.releases.radio:releases.radio);
    result.releases.playlists=safeList(releases.playlists,8,'Плейлисты',playlistCard,d.releases.playlists);
    result.releases.subscriptions=safeList(releases.subscriptions,6,'Подписки',subscriptionCard,d.releases.subscriptions);
    var tags=typeof genres.tags==='undefined'?d.genres.tags:genres.tags;
    if(!Array.isArray(tags)||tags.length>20)throw new Error('Жанры: максимум 20 меток.');
    result.genres.tags=tags.map(function(tag,i){return plain(tag,'Жанр '+(i+1),35,true);});
    result.genres.universe=universeConfig(genres.universe,d.genres.universe);
    result.genres.languages=languagesConfig(genres.languages,d.genres.languages);
    result.genres.topics=topicsConfig(genres.topics,d.genres.topics);
    result.genres.assistant=assistantConfig(genres.assistant,d.genres.assistant);
    result.about.notice=plain(typeof about.notice==='string'?about.notice:d.about.notice,'О проекте — объявление',600,false);
    if(JSON.stringify(result).length>780000)throw new Error('Изображений слишком много: уменьшай фотографии или используй меньше карточек (ограничение размера страницы).');
    return result;
  }
  function blankCard(){return {title:'',subtitle:'',description:'',url:'',imageUrl:'',visible:false};}
  window.VMM_LANDING_SCHEMA={defaults:defaults,normalize:normalize,blankCard:blankCard,
    songUrl:songUrl,featuredTrack:featuredTrack,featuredTracks:featuredTracks,
    releaseMediaUrl:releaseMediaUrl,playlistUrl:playlistUrl,radioConfig:radioConfig,
    subscriptionUrl:subscriptionUrl,playlistCard:playlistCard,subscriptionCard:subscriptionCard,
    universeConfig:universeConfig,languagesConfig:languagesConfig,
    defaultUniverseNodes:defaultUniverseNodes,defaultLanguages:defaultLanguages,
    defaultTopics:defaultTopics,topicsConfig:topicsConfig,
    assistantConfig:assistantConfig};
}());
