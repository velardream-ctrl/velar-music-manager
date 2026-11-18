(function () {
  'use strict';
  const status = document.getElementById('admin-status');
  const moderation = document.getElementById('moderation');
  const list = document.getElementById('moderation-topics');
  const refresh = document.getElementById('refresh-topics');
  const denied = 'Войдите в VELARDREAM Studio под аккаунтом администратора.';
  let db, session = 0, permitted = false;

  function element(tag, text, className) {
    const result = document.createElement(tag);
    if (text) result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function renderPost(snapshot, reply) {
    const data = snapshot.data();
    const row = element('article', '', 'topic moderator-row');
    const copy = element('div');
    copy.append(element(reply ? 'strong' : 'h3', reply ? data.author : data.title),
      element('p', reply ? (data.visible ? 'Виден' : 'Скрыт') :
        data.author + ' · ' + (data.visible ? 'Видна' : 'Скрыта'), 'muted'),
      element('p', data.body, 'message'));
    const controls = element('div', '', 'actions');
    const toggle = element('button', data.visible ? 'Скрыть' : 'Вернуть');
    toggle.type = 'button';
    toggle.onclick = async () => {
      toggle.disabled = true;
      try {
        await snapshot.ref.update({visible: !data.visible});
        const replacement = renderPost(await snapshot.ref.get(), reply);
        row.replaceWith(replacement);
        status.textContent = 'Видимость обновлена.';
      } catch (_) { status.textContent = 'Не удалось изменить видимость.'; }
      finally { toggle.disabled = false; }
    };
    controls.appendChild(toggle);
    if (!reply) {
      const details = element('details');
      const summary = element('summary', 'Ответы');
      const replies = element('div');
      details.append(summary, replies);
      details.addEventListener('toggle', async () => {
        if (!details.open || !permitted) return;
        replies.textContent = 'Загрузка…';
        try {
          const rows = await snapshot.ref.collection('replies').orderBy('createdAt', 'desc').limit(100).get();
          if (!permitted || !details.isConnected) return;
          replies.textContent = '';
          if (rows.empty) replies.appendChild(element('p', 'Ответов пока нет.', 'muted'));
          rows.forEach(post => replies.appendChild(renderPost(post, true)));
        } catch (_) { replies.textContent = 'Не удалось загрузить ответы.'; }
      });
      copy.appendChild(details);
    }
    row.append(copy, controls);
    return row;
  }

  async function loadTopics() {
    if (!permitted) return;
    const revision = session;
    refresh.disabled = true;
    status.textContent = 'Загружаем темы…';
    try {
      const topics = await db.collection('velar_forum_topics').orderBy('createdAt', 'desc').limit(100).get();
      if (revision !== session) return;
      list.textContent = '';
      if (topics.empty) list.appendChild(element('p', 'Тем пока нет.', 'muted'));
      topics.forEach(topic => list.appendChild(renderPost(topic, false)));
      status.textContent = '';
    } catch (error) {
      if (revision === session) status.textContent = error.code === 'permission-denied' ?
        'В Firebase ещё не опубликованы правила управления форумом.' : 'Не удалось загрузить темы.';
    } finally { refresh.disabled = false; }
  }

  refresh.onclick = loadTopics;
  try {
    const app = firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
    db = app.firestore();
    app.auth().onAuthStateChanged(async user => {
      const revision = ++session;
      permitted = false;
      moderation.hidden = true;
      list.textContent = '';
      if (!user) { status.textContent = denied; return; }
      try {
        const token = await user.getIdTokenResult();
        if (!user.emailVerified || token.signInProvider !== 'google.com') {
          if (session === revision) status.textContent = denied;
          return;
        }
        const access = await db.collection('vmm_admins').doc(user.uid).get();
        if (session !== revision) return;
        if (!access.exists || access.data().enabled !== true) {
          status.textContent = denied;
          return;
        }
        permitted = true;
        moderation.hidden = false;
        await loadTopics();
      } catch (_) { if (session === revision) status.textContent = denied; }
    });
  } catch (_) { status.textContent = 'Не удалось подключить Firebase Studio.'; }
}());
