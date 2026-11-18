(function () {
  'use strict';

  const collection = 'velar_forum_sections';
  const defaults = [
    {id:'site', label:'Вопросы о сайте', icon:'✧', order:10, enabled:true},
    {id:'ideas', label:'Идеи для песен', icon:'♫', order:20, enabled:true},
    {id:'collaboration', label:'Сотрудничество', icon:'✦', order:30, enabled:true},
    {id:'releases', label:'Обсуждение релизов', icon:'◎', order:40, enabled:true}
  ];

  async function load(db) {
    const snapshot = await db.collection(collection).limit(100).get({source:'server'});
    const sections = new Map(defaults.map(section => [section.id, section]));
    snapshot.forEach(doc => sections.set(doc.id, {...doc.data(), id:doc.id}));
    return [...sections.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  window.VelarForumSections = {collection, defaults, load};
}());
