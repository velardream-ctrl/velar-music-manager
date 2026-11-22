/* Album-to-catalog matching, client-side and owner-only. ES5 for older iPads.
   Does not access Spotify APIs or save private catalog metadata to public pages. */
(function(root){
  'use strict';
  function clean(value){
    var v=String(value||'').trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
    if(v.normalize)v=v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
    return v.replace(/[“”"‘’'.,!?()[\]{}:;·•]/g,' ')
      .replace(/[\u2010-\u2015_-]/g,' ').replace(/\s+/g,' ').trim();
  }
  function spotifyTrack(value){
    var m=/^(?:https:\/\/open\.spotify\.com\/track\/|spotify:track:)([A-Za-z0-9]{22})(?:[?\/#][^\s]*)?$/i.exec(String(value||'').trim());
    return m?'https://open.spotify.com/track/'+m[1]:'';
  }
  function parse(value){
    return String(value||'').split(/\r?\n/).map(function(raw){
      var input=raw.trim().replace(/^\d{1,2}\s*[.):]\s*/, '');
      if(!input)return null;
      if(spotifyTrack(input))return {original:input,url:spotifyTrack(input),title:'',artist:''};
      var parts=input.split(/\s+[\u2013\u2014-]\s+/);
      return {original:input,title:(parts[0]||'').trim(),artist:parts.length>1?parts.slice(1).join(' — ').trim():'',url:''};
    }).filter(function(t){return !!t;}).slice(0,60);
  }
  function propose(value,catalog,albumArtist,assigned){
    var albumKey=clean(albumArtist),used={},existing=assigned||[];
    var options=(catalog||[]).filter(function(song){return !!song&&(song.spotify||song.youtube||song.appleMusic);});
    var lines=parse(value);
    var result=lines.map(function(line){
      var possible=options.filter(function(song){
        if(line.url)return spotifyTrack(song.spotify)===line.url;
        if(clean(song.title)!==clean(line.title))return false;
        if(line.artist)return clean(song.artist)===clean(line.artist);
        return !albumKey||clean(song.artist)===albumKey;
      });
      // A title-only input can match globally if the album artist differs in a collaboration,
      // but only when the exact title uniquely identifies a single catalog song.
      if(!possible.length&&!line.artist&&!line.url){
        possible=options.filter(function(song){return clean(song.title)===clean(line.title);});
      }
      var selected=possible.length===1?possible[0]:null;
      var signature=selected ? clean(selected.title)+'|'+clean(selected.artist) : '';
      var found=selected&&existing.some(function(t){
        return (clean(t.title)===clean(selected.title)&&clean(t.artist)===clean(selected.artist)) ||
          (spotifyTrack(t.url) && spotifyTrack(t.url)===spotifyTrack(selected.spotify)) ||
          (spotifyTrack(t.alternateUrl)&&spotifyTrack(t.alternateUrl)===spotifyTrack(selected.spotify)) ||
          (spotifyTrack(t.thirdUrl)&&spotifyTrack(t.thirdUrl)===spotifyTrack(selected.spotify));
      });
      var state=possible.length===0?'missing':possible.length>1?'ambiguous':
        found||used[signature]?'already':'match';
      if(selected)used[signature]=true;
      return {input:line.original,state:state,song:selected,
        candidates:possible.length};
    });
    var count=function(state){return result.filter(function(row){return row.state===state;}).length;};
    return {rows:result,matchCount:count('match'),existingCount:count('already'),
      ambiguousCount:count('ambiguous'),missingCount:count('missing'),
      truncated:String(value||'').split(/\r?\n/).filter(function(x){return !!x.trim();}).length>60};
  }
  // RUN-211: the owner provided the original 15-track Spotify sequence.
  // Pre-fill an editor *proposal* for this album only; nothing is written
  // to Firestore until the owner reviews, saves and publishes it.
  var springOrder=[
    'Игристая весна','Ты как весна','Ветром по крышам',
    'Весна придумала нас','Весна внутри','Кто ты','Вишенка в вине',
    'Белые розы в апреле','Сирень за окном','С тобой цветёт весна',
    'Весна зовёт','Пьяная весна','Сама себе верна',
    'Весна на репит','Океан любви'
  ];
  function presetForAlbum(album){
    if(!album||clean(album.artist)!=='velar')return '';
    var name=clean(album.title),code=String(album.id||'').toLowerCase();
    return name==='игристая весна'||code==='igristaja-vesna'?
      springOrder.join('\n'):'';
  }
  // Reorder only EXACTLY identifiable songs; preserve unmatched/ambiguous
  // records in their original order. Never replace URLs, add or delete songs.
  function orderTracks(tracks,text,albumArtist){
    var original=(tracks||[]).slice(),unused=original.slice(),ordered=[];
    var rows=parse(text),albumKey=clean(albumArtist);
    rows.forEach(function(line){
      var options=unused.filter(function(t){
        if(line.url)return [t.url,t.alternateUrl,t.thirdUrl].some(function(src){
          return spotifyTrack(src)===line.url;
        });
        if(clean(t.title)!==clean(line.title))return false;
        if(line.artist)return clean(t.artist)===clean(line.artist);
        return !albumKey||clean(t.artist)===albumKey;
      });
      if(!options.length&&!line.url&&!line.artist){
        options=unused.filter(function(t){return clean(t.title)===clean(line.title);});
      }
      if(options.length!==1)return;
      var chosen=options[0];ordered.push(chosen);
      unused.splice(unused.indexOf(chosen),1);
    });
    var all=ordered.concat(unused);
    return {tracks:all,changed:all.some(function(t,i){return t!==original[i];}),
      ordered:ordered.length,remaining:unused.length};
  }
  root.VMM_ALBUM_MATCH={parse:parse,propose:propose,clean:clean,spotifyTrack:spotifyTrack,
    orderTracks:orderTracks,presetForAlbum:presetForAlbum};

}(window));
