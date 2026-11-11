/* RUN-061. Shared, public-safe landing page schema. ES5 for older Safari.
   No private catalog, lyrics, audio or credentials can enter this structure. */
(function(){
  'use strict';
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
        cards:[]
      },
      genres:{
        heading:'От оперы до новых звуков',
        intro:'Ищите музыку по настроению, жанру, артисту или тематической подборке. Жанры и плейлисты будут дополнять друг друга, а не смешивать песни в один список.',
        tags:['Опера','Поп','Рок','Этно','Кроссовер','Юмор','Авторские подборки']
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
    var tags=typeof genres.tags==='undefined'?d.genres.tags:genres.tags;
    if(!Array.isArray(tags)||tags.length>20)throw new Error('Жанры: максимум 20 меток.');
    result.genres.tags=tags.map(function(tag,i){return plain(tag,'Жанр '+(i+1),35,true);});
    result.about.notice=plain(typeof about.notice==='string'?about.notice:d.about.notice,'О проекте — объявление',600,false);
    if(JSON.stringify(result).length>780000)throw new Error('Изображений слишком много: уменьшай фотографии или используй меньше карточек (ограничение размера страницы).');
    return result;
  }
  function blankCard(){return {title:'',subtitle:'',description:'',url:'',imageUrl:'',visible:false};}
  window.VMM_LANDING_SCHEMA={defaults:defaults,normalize:normalize,blankCard:blankCard,
    songUrl:songUrl,featuredTrack:featuredTrack,featuredTracks:featuredTracks};
}());
