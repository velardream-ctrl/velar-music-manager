(function () {
  'use strict';
  var host = document.getElementById('compact-home');
  if (!host) return;
  var content = null;
  function element(tag, cls, text) {
    var node = document.createElement(tag);
    node.className = cls || '';
    if (text) node.textContent = text;
    return node;
  }
  function link(text, href, external) {
    var a = element('a', '', text);
    a.href = href;
    if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }
  var activeUrl='', mode='', timer=null, songs=[];
  function lastSong(){
    try {return sessionStorage.getItem('velar-feature-last')||'';} catch(error){return '';}
  }
  function randomSong(previous){
    var options=songs.filter(function(song){return song.url!==previous;});
    if(!options.length)return songs[0];
    return options[Math.floor(Math.random()*options.length)];
  }
  function paintSong(data,song){
    var hero = element('div','skin-feature'), brand = element('div','skin-brand');
    var crystal = document.querySelector('.hero-mark').cloneNode(false);
    crystal.removeAttribute('class');
    brand.appendChild(crystal);
    brand.appendChild(element('strong','','VELARDREAM'));
    brand.appendChild(element('small','','RECORDS'));
    brand.appendChild(element('i','',data.hero.subtitle));
    hero.appendChild(brand);

    if (song) {
      var cover = element('img','skin-cover');
      cover.alt = 'Обложка: ' + song.title;
      cover.hidden = true;
      hero.appendChild(cover);
      window.VELAR_PUBLIC_SONGS.requestArtwork(song,function (url) {
        cover.onload = function () { cover.hidden = false; };
        cover.onerror = function () { cover.hidden = true; };
        cover.src = url;
      });
      var copy = element('div','skin-song');
      copy.appendChild(element('h1','',song.title));
      copy.appendChild(element('i','',song.artist));
      [[song.provider,song.url],[song.alternateProvider,song.alternateUrl],[song.thirdProvider,song.thirdUrl]].forEach(function (pair) {
        if (!pair[1]) return;
        var titles = {spotify:'Слушать в Spotify',youtube:'Смотреть на YouTube',appleMusic:'Слушать в Apple Music'};
        var a = link(titles[pair[0]] || 'Открыть песню',pair[1],true);
        a.className = 'skin-platform ' + pair[0]; copy.appendChild(a);
      });
      hero.appendChild(copy);
    }
    if(host.firstChild)host.replaceChild(hero,host.firstChild);
    else host.appendChild(hero);
    activeUrl=song?song.url:'';
    if(song&&mode!=='fixed'){
      try {sessionStorage.setItem('velar-feature-last',activeUrl);} catch(error){}
    }
  }
  function appendNavigation(){
    var details = element('details','skin-sections');
    details.appendChild(element('summary','','Подобрать музыку · Все разделы'));
    var nav = element('nav');
    [['artists','Песни артистов'],['releases','Релизы и клипы'],['albums','Альбомы'],['playlists','Плейлисты'],['universe','Музыкальная вселенная'],['languages','Языки'],['topics','Темы'],['genres','Жанры'],['about','О проекте']].forEach(function (pair) { nav.appendChild(link(pair[1],'#'+pair[0])); });
    details.appendChild(nav); host.appendChild(details);
  }
  function apply() {
    var compact = !!content && content.hero.skin === 'compact';
    window.clearInterval(timer);
    host.hidden = !compact;
    document.body.classList.toggle('skin-compact',compact);
    if(!compact)return;
    songs=content.hero.featureMode==='list'?window.VMM_LANDING_SCHEMA.featuredSourceSongs(content):window.VMM_LANDING_SCHEMA.homepageSongs(content);
    var nextMode=content.hero.featureMode||'random';
    var wanted=nextMode==='fixed'?content.hero.featureUrl:(nextMode==='list'?'':(mode===nextMode?activeUrl:''));
    mode=nextMode;
    var chosen=songs.filter(function(song){return wanted&&[song.url,song.alternateUrl,song.thirdUrl].indexOf(wanted)>=0;})[0];
    var daily=null;
    if((mode==='random'||mode==='list')&&content.hero.featureDaily&&songs.length){
      var seed=new Date().toISOString().slice(0,10)+'|'+(content.hero.featureSource||'all')+'|'+(content.hero.featureGroup||''),hash=2166136261;
      for(var i=0;i<seed.length;i++){hash^=seed.charCodeAt(i);hash=Math.imul(hash,16777619);}
      var sorted=songs.slice().sort(function(a,b){return a.url<b.url?-1:a.url>b.url?1:0;});
      daily=sorted[(hash>>>0)%sorted.length];
    }
    paintSong(content,daily||chosen||(mode==='fixed'?songs[0]:randomSong(lastSong())));
    // Compact header already has navigation; do not duplicate it beneath the song.
    if(mode==='rotate'&&songs.length>1){
      timer=window.setInterval(function(){
        if(document.hidden||host.firstChild.contains(document.activeElement))return;
        paintSong(content,randomSong(activeUrl));
      },(content.hero.featureMinutes||5)*60000);
    }
  }
  window.VelarHomeSkin = {render:function (data) { content = data; apply(); }};
}());
