(function () {
  'use strict';
  const status = document.getElementById('admin-status');
  const recovery = document.getElementById('admin-recovery');
  const moderation = document.getElementById('moderation');
  const list = document.getElementById('moderation-topics');
  const bans = document.getElementById('moderation-bans');
  const refresh = document.getElementById('refresh-topics');
  const denied = 'Войдите в VELARDREAM Studio под аккаунтом администратора.';
  let db, session = 0, permitted = false, adminUid;

  function showAccessError(message) {
    status.textContent = message;
    recovery.hidden = false;
  }

  function withAccessTimeout(check) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('access-timeout')), 10000);
    });
    return Promise.race([check, timeout]).finally(() => clearTimeout(timer));
  }

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
    const state = data.deleted ? 'Удалено' : data.visible ? 'Опубликовано' : 'Скрыто';
    copy.append(element(reply ? 'strong' : 'h3', reply ? data.author : data.title),
      element('p', reply ? state : data.author + ' · ' + state, 'muted'),
      element('p', data.body, 'message'));
    const controls = element('div', '', 'actions');
    function change(patch) {
      return async () => {
        await snapshot.ref.update(patch);
        const current = await snapshot.ref.get();
        row.replaceWith(renderPost(current, reply));
      };
    }
    if (data.deleted) {
      controls.append(action('Восстановить', change({deleted: false, visible: true})));
    } else {
      controls.append(action(data.visible ? 'Скрыть' : 'Опубликовать', change({visible: !data.visible})));
      controls.append(action('Удалить', change({deleted: true, visible: false}),
        'Убрать запись с форума? Её можно будет восстановить в Studio.'));
    }
    if (data.uid && data.uid !== adminUid) {
      controls.append(action('Забанить автора', async () => {
        await db.collection('velar_forum_bans').doc(data.uid).set({
          author: data.author,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await loadBans(session);
      }, 'Запретить автору новые публикации на форуме?'));
    }
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

  function action(label, run, confirmation) {
    const button = element('button', label);
    button.type = 'button';
    button.onclick = async () => {
      if (!permitted || (confirmation && !window.confirm(confirmation))) return;
      const revision = session;
      button.disabled = true;
      try {
        await run();
        if (revision === session) status.textContent = 'Изменение сохранено.';
      } catch (_) {
        if (revision === session) status.textContent = 'Действие недоступно. Проверьте опубликованные правила форума в Firebase.';
      } finally {
        button.disabled = false;
      }
    };
    return button;
  }

  async function loadBans(revision) {
    const rows = await db.collection('velar_forum_bans').orderBy('createdAt', 'desc').limit(100).get();
    if (revision !== session) return;
    bans.textContent = '';
    if (rows.empty) bans.append(element('p', 'Заблокированных участников пока нет.', 'muted'));
    rows.forEach(snapshot => {
      const row = element('article', '', 'topic moderator-row');
      row.append(element('div', snapshot.data().author + ' · ' + snapshot.id),
        action('Снять бан', async () => {
          await snapshot.ref.delete();
          row.remove();
          if (!bans.children.length) bans.append(element('p', 'Заблокированных участников пока нет.', 'muted'));
        }));
      bans.append(row);
    });
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
      await loadBans(revision);
      if (revision === session) status.textContent = '';
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
      clearTimeout(window.forumAdminStartup);
      recovery.hidden = true;
      status.textContent = 'Проверяем доступ к Studio…';
      const revision = ++session;
      permitted = false;
      moderation.hidden = true;
      list.textContent = '';
      bans.textContent = '';
      if (!user) { showAccessError(denied); return; }
      try {
        const token = await withAccessTimeout(user.getIdTokenResult());
        if (!user.emailVerified || token.signInProvider !== 'google.com') {
          if (session === revision) showAccessError(denied);
          return;
        }
        const access = await withAccessTimeout(db.collection('vmm_admins').doc(user.uid).get({source:'server'}));
        if (session !== revision) return;
        if (!access.exists || access.data().enabled !== true) {
          showAccessError(denied);
          return;
        }
        adminUid = user.uid;
        permitted = true;
        moderation.hidden = false;
        await loadTopics();
      } catch (error) {
        if (session === revision) showAccessError(error.code === 'permission-denied' ? denied :
          'Не удалось проверить права администратора. Попробуйте открыть панель ещё раз.');
      }
    }, () => {
      clearTimeout(window.forumAdminStartup);
      showAccessError('Не удалось восстановить вход в Studio.');
    });
  } catch (_) {
    clearTimeout(window.forumAdminStartup);
    showAccessError('Не удалось подключить Firebase Studio.');
  }
}());
