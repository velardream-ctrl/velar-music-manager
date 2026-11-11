/* RUN-064 — read-only artist choices built from the private VMM catalog.
   No writes to vmm_catalog and no automatic re-attribution of Crazy Bobr tracks.
   ES5 compatible (older iPads / Safari 12). */
(function(){
 'use strict';
 var PRESETS=[
   {id:'velar',label:'DJ Velar',aliases:['Velar','DJ Velar']},
   {id:'ilya-dmitriev',label:'Илья Дмитриев',aliases:[
     'Илья Дмитриев','Ilya Dmitriev','Ilia Dmitriev','Ilja Dmitriev',
     'Ilya Dmitryev','Ilya Dmitriyev'
   ]},
   {id:'crazy-bobr',label:'Crazy Bobr',aliases:['Crazy Bobr','Crazy Бобр']}
 ];
 function clean(s){return String(s==null?'':s).trim().replace(/\s+/g,' ');}
 function key(s){return clean(s).toLocaleLowerCase('ru').replace(/ё/g,'е');}
 function sourceId(s){
   var str=key(s),h=2166136261;
   for(var i=0;i<str.length;i++){
     h^=str.charCodeAt(i);
     h=Math.imul?h=Math.imul(h,16777619):((h*16777619)>>>0);
   }
   return 'catalog-'+(h>>>0).toString(36);
 }
 function choices(catalog){
   var rows=Array.isArray(catalog)?catalog:[],found=[],presets=PRESETS.map(function(p){
     return {id:p.id,label:p.label,count:0,preset:true,sourceNames:[]};
   });
   var extras={};
   rows.forEach(function(item){
     var name=clean(item&&item.artist);
     if(!name)return;
     var normalized=key(name),matched=false;
     PRESETS.forEach(function(p,i){
       if(matched)return;
       if(p.aliases.some(function(alias){return key(alias)===normalized;})){
         presets[i].count++;
         if(presets[i].sourceNames.indexOf(name)<0)presets[i].sourceNames.push(name);
         matched=true;
       }
     });
     if(!matched){
       if(!extras[normalized])extras[normalized]={id:sourceId(name),label:name,count:0,preset:false,sourceNames:[name]};
       extras[normalized].count++;
       if(extras[normalized].sourceNames.indexOf(name)<0)extras[normalized].sourceNames.push(name);
     }
   });
   Object.keys(extras).forEach(function(x){found.push(extras[x]);});
   found.sort(function(a,b){return a.label.localeCompare(b.label,'ru');});
   return presets.concat(found);
 }
 function inferredId(name){
   var normalized=key(name);
   if(!normalized)return '';
   for(var i=0;i<PRESETS.length;i++){
     var p=PRESETS[i];
     if(p.aliases.some(function(alias){return key(alias)===normalized;}))return p.id;
   }
   return sourceId(name);
 }
 function byId(rows,id){
   for(var i=0;i<rows.length;i++)if(rows[i].id===id)return rows[i];
   return null;
 }
 function newCard(candidate){
   if(!candidate||!candidate.id)throw new Error('Выбери артиста из списка.');
   return {title:candidate.label,subtitle:'',description:'',url:'',imageUrl:'',visible:false,artistId:candidate.id};
 }
 window.VMM_ARTIST_CHOICES={choices:choices,byId:byId,newCard:newCard,inferredId:inferredId};
}());
