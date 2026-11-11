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
  function imageUrl(value,label){
    var s=plain(value,label,400,false);
    if(!s)return '';
    // Only the dedicated PUBLIC portrait path in this exact Firebase bucket.
    // Never allow private Google Drive links or arbitrary Cloud Storage URLs.
    if(/^https:\/\/firebasestorage\.googleapis\.com\//i.test(s)){
      if(!/^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/velardream-records-studio\.firebasestorage\.app\/o\/public%2fartist-avatars%2f[a-z0-9-]{1,80}%2f[0-9]{13}-[a-f0-9]{16}\.(?:webp|jpg)\?alt=media&token=[a-z0-9_-]+$/i.test(s))
        throw new Error(label+': разрешён только опубликованный портрет VELARDREAM.');
      return s;
    }
    return url(s,label);
  }
  function card(x,type,index){
    if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Карточка '+index+': неверный формат.');
    var title=plain(x.title,'Название карточки '+index,110,!!x.visible);
    var result={
      title:title,
      subtitle:plain(x.subtitle||'','Подзаголовок '+index,110,false),
      description:plain(x.description||'','Описание '+index,360,false),
      url:url(x.url||'','Ссылка '+index),
      imageUrl:imageUrl(x.imageUrl||'','Изображение '+index),
      visible:x.visible===true
    };
    // A stable identifier is safe for the public page and permits future
    // links to approved releases. Private song documents are not included.
    if(type==='Артисты'){
      var artistId=plain(x.artistId||'','Ключ артиста '+index,80,false);
      if(artistId&&!/^[a-z0-9-]+$/.test(artistId))
        throw new Error('Ключ артиста: недопустимый формат.');
      result.artistId=artistId;
      result.imageShape=x.imageShape==='circle'?'circle':'square';
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
    if(JSON.stringify(result).length>60000)throw new Error('Публикация слишком велика.');
    return result;
  }
  function blankCard(){return {title:'',subtitle:'',description:'',url:'',imageUrl:'',visible:false};}
  window.VMM_LANDING_SCHEMA={defaults:defaults,normalize:normalize,blankCard:blankCard};
}());
