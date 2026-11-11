/* RUN-061 — public read-only renderer. Only vmm_public_pages/landing.
   Existing static content is the fallback when not yet published/offline/denied. */
(function(){
 'use strict';
 function byId(id){return document.getElementById(id);}
 function assign(id,value){var target=byId(id);if(target)target.textContent=value;}
 function empty(node){while(node.firstChild)node.removeChild(node.firstChild);}
 function create(tag,cls,words){
   var n=document.createElement(tag);
   if(cls)n.className=cls;
   if(typeof words==='string')n.textContent=words;
   return n;
 }
 function cards(id,rows,type){
   var target=byId(id);
   if(!target)return;
   var shown=rows.filter(function(x){return x.visible===true;});
   // Do not remove the hand-designed "Скоро" placeholder until real public
   // cards exist. A new editor is therefore harmless before first launch.
   if(!shown.length)return;
   empty(target);target.className='cms-card-grid';
   shown.forEach(function(item){
     var card=create('article','cms-card');
     if(item.imageUrl){
       var img=document.createElement('img');
       img.src=item.imageUrl;img.alt=item.title;img.loading='lazy';img.decoding='async';
       img.referrerPolicy='no-referrer';img.className='cms-card-art';
       card.appendChild(img);
     }
     var copy=create('div','cms-card-copy');
     copy.appendChild(create('h3','',item.title));
     if(item.subtitle)copy.appendChild(create('p','cms-card-subtitle',item.subtitle));
     if(item.description)copy.appendChild(create('p','',item.description));
     if(item.url){
       var link=create('a','cms-card-link',type==='artists'?'Профиль артиста ↗':'Открыть релиз ↗');
       link.href=item.url;link.rel='noopener noreferrer';link.target='_blank';
       copy.appendChild(link);
     }
     card.appendChild(copy);target.appendChild(card);
   });
 }
 function render(content){
   if(!window.VMM_LANDING_SCHEMA)return false;
   var value;
   try{value=window.VMM_LANDING_SCHEMA.normalize(content);}catch(e){return false;}
   assign('public-hero-subtitle',value.hero.subtitle);
   assign('public-hero-intro',value.hero.intro);
   assign('artists-title',value.artists.heading);
   assign('public-artists-intro',value.artists.intro);
   assign('releases-title',value.releases.heading);
   assign('public-releases-intro',value.releases.intro);
   assign('genres-title',value.genres.heading);
   assign('public-genres-intro',value.genres.intro);
   assign('about-title',value.about.heading);
   assign('public-about-intro',value.about.intro);
   assign('public-about-notice',value.about.notice);
   var tags=byId('public-genres-tags');if(tags){empty(tags);
     value.genres.tags.forEach(function(tag){tags.appendChild(create('span','',tag));});
   }
   cards('public-artists-cards',value.artists.cards,'artists');
   cards('public-releases-cards',value.releases.cards,'releases');
   return true;
 }
 function start(){
   if(!window.firebase||!window.VELAR_FIREBASE_CONFIG||!window.VMM_LANDING_SCHEMA)return;
   try{
     if(!firebase.apps.length)firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
     // Anonymous document listening, no login and no access to the private catalog.
     firebase.firestore().collection('vmm_public_pages').doc('landing').onSnapshot(function(snapshot){
       if(!snapshot.exists)return; // existing static homepage remains in place
       var d=snapshot.data()||{};
       if(d.status!=='published'||d.schemaVersion!==1)return;
       render(d.content);
     },function(){
       // Missing staged rules or temporary network error: preserve static page.
     });
   }catch(ignore){/* Never block public landing if SDK or network fails. */}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
 else start();
 window.VMM_PUBLIC_LANDING={render:render}; // pure UI hook, never writes
}());
