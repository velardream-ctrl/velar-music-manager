(function () {
  'use strict';
  var host = document.getElementById('compact-home');
  if (!host) return;
  var choice = document.getElementById('skin-choice');
  var query = new URLSearchParams(location.search);
  var preview = window.VelarLocalComparison || query.get('skinPreview');
  var override = null;
  var content = null;
  if (preview === 'classic' || preview === 'compact') {
    override = preview;
    document.getElementById('skin-preview-tools').hidden = false;
    choice.value = override;
    choice.onchange = function () {
      override = choice.value;
      if (!window.VelarLocalComparison) {
        query.set('skinPreview', override);
        history.replaceState(null, '', '?' + query.toString());
      } else {
        try { localStorage.setItem('velar-comparison-skin', override); } catch (ignore) {}
      }
      apply();
      window.scrollTo(0, 0);
    };
  }
  if (!override) {
    var personal = document.getElementById('visitor-skin');
    if (personal) {
      try { override = localStorage.getItem('velar-home-view'); } catch (ignore) {}
      if (override !== 'compact' && override !== 'classic') override = null;
      personal.value = override || '';
      personal.onchange = function () {
        override = personal.value || null;
        try { localStorage.setItem('velar-home-view',override || ''); } catch (ignore) {}
        apply();window.scrollTo(0,0);
      };
    }
  }
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
  function feature(data) {
    var tracks = [];
    data.artists.cards.filter(visible).forEach(function (a) { tracks = tracks.concat(a.featuredTracks || []); });
    [data.genres.entries, data.genres.topics.entries, data.genres.languages.entries].forEach(function (entries) {
      entries.filter(visible).forEach(function (g) { tracks = tracks.concat(g.tracks || []); });
    });
    return tracks.filter(function (t) { return t.title === 'Любовь' && /^(DJ )?Velar$/i.test(t.artist) && t.alternateUrl; })[0] || tracks[0];
  }
  function visible(item) { return item.visible !== false; }
  function paint(data) {
    host.textContent = '';
    var hero = element('div','skin-feature'), brand = element('div','skin-brand');
    var crystal = document.querySelector('.hero-mark').cloneNode(false);
    crystal.removeAttribute('class');
    brand.appendChild(crystal);
    brand.appendChild(element('strong','','VELARDREAM'));
    brand.appendChild(element('small','','RECORDS'));
    brand.appendChild(element('i','',data.hero.subtitle));
    hero.appendChild(brand);
    var song = feature(data);
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
    host.appendChild(hero);
    var details = element('details','skin-sections');
    details.appendChild(element('summary','','Подобрать музыку · Все разделы'));
    var nav = element('nav');
    [['artists','Песни артистов'],['releases','Релизы и клипы'],['albums','Альбомы'],['playlists','Плейлисты'],['universe','Музыкальная вселенная'],['languages','Языки'],['topics','Темы'],['genres','Жанры'],['about','О проекте']].forEach(function (pair) { nav.appendChild(link(pair[1],'#'+pair[0])); });
    details.appendChild(nav); host.appendChild(details);
  }
  function apply() {
    var compact = !!content && (override || content.hero.skin) === 'compact';
    if (compact) paint(content);
    host.hidden = !compact;
    document.body.classList.toggle('skin-compact',compact);
  }
  window.VelarHomeSkin = {render:function (data) { content = data; apply(); }};
}());
