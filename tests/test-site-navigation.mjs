/* RUN-212: DJ Velar can navigate only real, public, known routes.
   Browser and Firestore are simulated, no network or private data is used. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const catalog=read('site-navigation-catalog.js');
const assistant=read('velar-assistant.js');
const schema=read('landing-schema.js');
const home=read('index.html');
const sw=read('sw.js');
const forum=read('forum/forum.js');
const forumHtml=read('forum/index.html');
new vm.Script(catalog);new vm.Script(assistant);
assert.match(home,/site-navigation-catalog\.js\?v=1/);
assert.ok(home.indexOf('site-navigation-catalog.js?v=1')<home.indexOf('velar-assistant.js?v=16'));
assert.match(sw,/'\.\/site-navigation-catalog\.js\?v=1'/);
assert.match(forum,/new URLSearchParams\(location\.search\)\.get\('section'\)/);
assert.match(forum,/section\.id === initialSection && section\.enabled && !section\.deleted/);
assert.match(forumHtml,/forum\.js\?v=15/);

function anchor(text,href){
  return {textContent:text,hidden:false,parentNode:null,
    getAttribute:key=>key==='href'?href:null};
}
function section(id,label,hidden=false){
  return {id,hidden,parentNode:null,getAttribute:()=>null,
    querySelector:selector=>selector?'x'&&{textContent:label}:null};
}
const publicLinks=[
 anchor('Артисты','#artists'),
 anchor('Форум','/forum/'),
 anchor('Контакты','/contacts/'),
 anchor('Studio','/studio/'),
 anchor('Внешняя страница','https://evil.example/'),
 anchor('Админ','/admin/users')
];
const sections=[section('artists','Артисты'),section('guestbook','Гостевая книга'),
 section('owner-lab','Секретный раздел',true)];
const document={
 readyState:'loading',
 querySelector:q=>q==='.site-nav'?{querySelectorAll:q=>q==='a[href]'?publicLinks:[]}:null,
 querySelectorAll:q=>q==='main section[id]'?sections:[],
 getElementById:id=>sections.find(s=>s.id===id)||null,
 addEventListener(){}
};
const requested=[];
const w={location:{origin:'https://velardream.com',href:'https://velardream.com/',hash:''},
 fetch(url,opts){
   requested.push({url,opts});
   return Promise.resolve({ok:true,json:()=>Promise.resolve({documents:[
     {name:'projects/p/databases/(default)/documents/velar_forum_sections/collaboration',
      fields:{label:{stringValue:'Сотрудничество'},enabled:{booleanValue:true}}},
     {name:'projects/p/databases/(default)/documents/velar_forum_sections/poems',
      fields:{label:{stringValue:'Стихи и тексты'},enabled:{booleanValue:true}}},
     {name:'projects/p/databases/(default)/documents/velar_forum_sections/secrets',
      fields:{label:{stringValue:'Скрытые темы'},enabled:{booleanValue:false}}},
     {name:'projects/p/databases/(default)/documents/velar_forum_sections/deleted',
      fields:{label:{stringValue:'Удалённые темы'},enabled:{booleanValue:true},
        deleted:{booleanValue:true}}}
   ]})});
 }
};
const context={window:w,document,URL,Array,String,Object,Promise,Error,Math,JSON,Number};
vm.runInNewContext(schema,context,{timeout:1000});
vm.runInNewContext(catalog,context,{timeout:1000});
const nav=w.VELAR_SITE_NAV;
assert.ok(nav);
assert.equal(nav.answer('хочу отправить личное сообщение').actions[0].target,'/contacts/');
assert.equal(nav.answer('как заказать песню').actions[0].target,'/contacts/');
assert.equal(nav.answer('сообщить об ошибке на сайте').actions[0].target,'/contacts/');
assert.equal(nav.answer('сотрудничество').actions[0].target,'/forum/',
 'Before the public sections load, link only to the verified forum homepage');
assert.equal(nav.answer('сотрудничество').actions[1].target,'/contacts/');
assert.equal(nav.answer('где раздел Гостевая книга').actions[0].target,'#guestbook');
assert.equal(nav.answer('где раздел Секретный раздел'),null);
assert.equal(nav.answer('где админ панель'),null);
assert.equal(nav.answer('песня на финском'),null,'Do not intercept ordinary music discovery');
assert.equal(nav.isKnown('/studio/'),false);
assert.equal(nav.isKnown('//evil.example'),false);
assert.equal(nav.open('javascript:alert(1)'),false);
assert.equal(nav.open('/admin/users'),false);
assert.equal(requested.length,0,'No automatic request until DOM loaded');
await nav.refreshForum();
assert.equal(requested.length,1,'Only one public read');
assert.match(requested[0].url,/velar_forum_sections\?pageSize=100$/);
assert.equal(requested[0].opts.credentials,'omit');
assert.equal(nav.answer('сотрудничество').actions[0].target,'/forum/?section=collaboration');
assert.equal(nav.answer('открой раздел Стихи и тексты').actions[0].target,'/forum/?section=poems');
assert.equal(nav.isKnown('/forum/?section=secrets'),false,'Disabled forum section is inaccessible');
assert.equal(nav.isKnown('/forum/?section=deleted'),false,'Deleted forum section is inaccessible');
assert.equal(nav.isKnown('/forum/?section=missing'),false);
assert.equal(nav.isKnown('https://evil.example'),false);
assert.equal(nav.open('/forum/?section=collaboration'),true);
assert.equal(w.location.href,'/forum/?section=collaboration');
assert.equal(nav.open('/contacts/'),true);
assert.equal(w.location.href,'/contacts/');
assert.equal(nav.open('#guestbook'),true);
assert.equal(w.location.hash,'guestbook');
await nav.refreshForum();
assert.equal(requested.length,1,'Public forum categories are fetched once per page');
publicLinks.push(anchor('Новости','/news/'));
assert.equal(nav.answer('где раздел Новости').actions[0].target,'/news/',
 'A newly published public page in the site menu appears without changing the assistant');
assert.equal(nav.isKnown('/news/'),true);

vm.runInNewContext(assistant,context,{timeout:1000});
const assistantAnswer=(q,config)=>w.VELAR_ASSISTANT.answer(q,w.VMM_LANDING_SCHEMA.defaults(),
 config||w.VMM_LANDING_SCHEMA.defaults().genres.assistant);
assert.equal(assistantAnswer('сотрудничество').actions[0].target,'/forum/?section=collaboration');
assert.equal(assistantAnswer('напиши личное сообщение').actions[0].target,'/contacts/');
assert.equal(assistantAnswer('где раздел Новости').actions[0].target,'/news/');
assert.equal(assistantAnswer('сотрудничество',{...w.VMM_LANDING_SCHEMA.defaults().genres.assistant,
  rules:[{keywords:'сотрудничество',answer:'Ответ, заданный владельцем'}]}).text,
  'Ответ, заданный владельцем','Explicit owner rule must override navigation');
assert.equal(assistantAnswer('песня на финском').target,'#languages',
 'Language/music assistant remains unchanged');
console.log('PASS: public navigation, contact, forum categories, dynamic site pages, privacy and owner priority.');
