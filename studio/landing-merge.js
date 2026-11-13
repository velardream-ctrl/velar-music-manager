/* RUN-108 — conservative, pure three-way merge for one published landing
   draft. Nothing is written by this module; the owner explicitly confirms a
   separate Firestore transaction. Safari 12 / ES5 compatible. */
(function(){
 'use strict';
 function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
 function plain(x){return !!x&&typeof x==='object'&&!Array.isArray(x);}
 function copy(x){return typeof x==='undefined'?undefined:JSON.parse(JSON.stringify(x));}
 function keyFor(path){
   var keys={
     'genres.topics.entries':'slug',
     'genres.languages.entries':'code',
     'albums.entries':'id',
     'artists.cards':'artistId'
   };
   return keys[path]||'';
 }
 function indexed(rows,key){
   var map={},ids=[];
   for(var i=0;i<rows.length;i++){
     var item=rows[i],ident=item&&item[key];
     if(typeof ident!=='string'||!ident||Object.prototype.hasOwnProperty.call(map,ident))return null;
     map[ident]=item;ids.push(ident);
   }
   return {items:map,ids:ids};
 }
 function merge(base,local,remote){
   var conflicts=[],changed=0;
   function reconcile(b,l,r,path,depth){
     if(same(l,b))return copy(r);
     if(same(r,b)){changed++;return copy(l);}
     if(same(l,r))return copy(r);
     if(depth>20){conflicts.push(path);return copy(r);}
     if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)){
       var key=keyFor(path),bm=key&&indexed(b,key),lm=key&&indexed(l,key),rm=key&&indexed(r,key);
       if(bm&&lm&&rm){
         var union={},out=[],ids=rm.ids.slice();
         lm.ids.forEach(function(id){if(ids.indexOf(id)<0)ids.push(id);});
         ids.forEach(function(id){
           if(union[id])return;
           union[id]=true;
           var merged=reconcile(bm.items[id],lm.items[id],rm.items[id],
             path+'['+id+']',depth+1);
           if(typeof merged!=='undefined')out.push(merged);
         });
         return out;
       }
       conflicts.push(path);return copy(r);
     }
     if(plain(b)&&plain(l)&&plain(r)){
       var out={},keys={};
       Object.keys(b).concat(Object.keys(l),Object.keys(r)).forEach(function(k){keys[k]=true;});
       Object.keys(keys).forEach(function(k){
         var merged=reconcile(b[k],l[k],r[k],path?path+'.'+k:k,depth+1);
         if(typeof merged!=='undefined')out[k]=merged;
       });
       return out;
     }
     conflicts.push(path||'landing');return copy(r);
   }
   return {value:reconcile(base,local,remote,'',0),conflicts:conflicts,changes:changed};
 }
 window.VMM_LANDING_MERGE={threeWay:merge};
}());