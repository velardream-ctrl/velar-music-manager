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

  const sections = window.VelarForumSections;
  const sectionPanel = document.getElementById('section-settings');
  const sectionStatus = document.getElementById('section-status');
  const sectionList = document.getElementById('section-list');
  const sectionAdd = document.getElementById('section-add');
  const sectionArchive = document.getElementById('section-archive');
  const archivedSections = document.getElementById('archived-sections');
  let sectionRows = [];

  function sectionDeleteAction(section) {
    const deleting = !section.deleted;
    const button = element('button', deleting ? 'Удалить раздел' : 'Восстановить раздел');
    button.type = 'button';
    button.onclick = async () => {
      if (!permitted || (deleting && !window.confirm('Удалить раздел «' + section.label +
        '»? Темы сохранятся, а раздел можно будет восстановить.'))) return;
      const revision = session;
      button.disabled = true;
      sectionStatus.textContent = '';
      try {
        const data = {label:section.label,icon:section.icon,order:section.order,enabled:!deleting,deleted:deleting};
        await db.collection(sections.collection).doc(section.id).set(data);
        if (revision !== session) return;
        if (await loadSections(revision)) {
          sectionStatus.textContent = deleting ? 'Раздел перенесён в удалённые.' : 'Раздел восстановлен.';
        }
      } catch (error) {
        if (revision === session) sectionStatus.textContent = error.code === 'permission-denied'
          ? 'Удаление и восстановление требуют обновлённых правил Firestore.'
          : 'Не удалось изменить раздел. Попробуйте ещё раз.';
      } finally {
        button.disabled = false;
      }
    };
    return button;
  }

  function sectionField(form, name, label, value, attributes = {}) {
    const field = Object.assign(element('input'), {name, value}, attributes);
    const wrapper = element('label', label);
    wrapper.append(field);
    form.append(wrapper);
    return field;
  }

  const iconPresets = [
    ['✧', 'Вопросы'], ['♫', 'Музыка и идеи'], ['✦', 'Сотрудничество'], ['◎', 'Релизы'],
    ['💬', 'Обсуждения'], ['🎤', 'Вокал'], ['🎸', 'Инструменты'], ['🎧', 'Прослушивание'],
    ['🎹', 'Клавиши'], ['🎛️', 'Студия и звук'], ['💿', 'Альбомы'], ['🎬', 'Видео'],
    ['📣', 'Новости'], ['📅', 'События'], ['💡', 'Предложения'], ['🛠️', 'Помощь'],
    ['🤝', 'Совместные проекты'], ['🌌', 'Созвездия'], ['⭐', 'Избранное']
  ];

  function sectionIconPicker(form, value) {
    const preset = element('select');
    const label = element('label', 'Иконка');
    for (const [icon, name] of iconPresets) {
      const option = element('option', icon + ' ' + name);
      option.value = icon;
      preset.append(option);
    }
    const customOption = element('option', 'Своя иконка…');
    customOption.value = '';
    preset.append(customOption);
    label.append(preset);
    form.append(label);

    const custom = sectionField(form, 'icon', 'Свой символ или эмодзи', '', {maxLength:12});
    preset.value = iconPresets.some(([icon]) => icon === value) ? value : '';
    if (!preset.value) custom.value = value;

    function sync() {
      custom.required = !preset.value;
      custom.parentElement.hidden = !custom.required;
    }
    preset.onchange = () => {
      sync();
      if (custom.required) custom.focus();
    };
    sync();
    return () => preset.value || custom.value.trim();
  }

  function renderSection(section) {
    const form = element('form', '', 'forum-section-editor');
    const heading = element('h3', section.label || 'Новый раздел');
    form.append(heading);
    const label = sectionField(form, 'label', 'Название', section.label, {required:true,minLength:2,maxLength:60});
    const selectedIcon = sectionIconPicker(form, section.icon);
    const order = sectionField(form, 'order', 'Порядок', section.order, {type:'number',min:'0',max:'9999',required:true});
    const enabled = sectionField(form, 'enabled', ' Показывать раздел', '', {type:'checkbox',checked:section.enabled});
    const save = element('button', 'Сохранить раздел');
    const controls = element('div', '', 'actions');
    controls.append(save);
    if (section.id) controls.append(sectionDeleteAction(section));
    if (!section.id) {
      const cancel = element('button', 'Отмена');
      cancel.type = 'button';
      cancel.onclick = () => { form.remove(); sectionAdd.disabled = false; };
      controls.append(cancel);
    }
    form.append(controls);
    form.onsubmit = async event => {
      event.preventDefault();
      if (!permitted) return;
      const revision = session;
      const data = {label:label.value.trim(),icon:selectedIcon(),order:order.valueAsNumber,enabled:enabled.checked};
      if (data.label.length < 2 || !data.icon) {
        sectionStatus.textContent = 'Заполните название и иконку.';
        return;
      }
      save.disabled = true;
      try {
        const collection = db.collection(sections.collection);
        const ref = section.id ? collection.doc(section.id) : collection.doc();
        await ref.set(data);
        if (revision !== session) return;
        await loadSections(revision);
        if (revision === session && !sectionAdd.disabled) sectionStatus.textContent = 'Раздел сохранён.';
      } catch (_) {
        if (revision === session) sectionStatus.textContent = 'Не удалось сохранить раздел.';
      } finally {
        save.disabled = false;
      }
    };
    return form;
  }

  async function loadSections(revision) {
    sectionAdd.disabled = true;
    sectionStatus.textContent = 'Загружаем разделы…';
    try {
      const rows = await withAccessTimeout(sections.load(db));
      if (revision !== session) return;
      sectionRows = rows;
      sectionList.replaceChildren(...rows.filter(section => !section.deleted).map(renderSection));
      const deleted = rows.filter(section => section.deleted);
      sectionArchive.hidden = !deleted.length;
      archivedSections.replaceChildren(...deleted.map(section => {
        const row = element('div', '', 'forum-section-editor');
        row.append(element('p', section.icon + ' ' + section.label), sectionDeleteAction(section));
        return row;
      }));
      sectionAdd.disabled = rows.length >= 100;
      sectionStatus.textContent = rows.length >= 100 ? 'Достигнут предел в 100 разделов.' : '';
      return true;
    } catch (error) {
      if (revision !== session) return;
      sectionStatus.textContent = error.code === 'permission-denied' ?
        'Чтобы управлять разделами, опубликуйте обновлённые правила Firestore.' : 'Не удалось загрузить разделы. Обновите страницу.';
    }
  }

  sectionAdd.onclick = () => {
    sectionAdd.disabled = true;
    const order = Math.min(9999, Math.max(0, ...sectionRows.map(section => section.order)) + 10);
    const form = renderSection({label:'',icon:'✦',order,enabled:true});
    sectionList.append(form);
    form.elements.namedItem('label').focus();
  };

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
      sectionPanel.hidden = true;
      sectionList.replaceChildren();
      sectionArchive.hidden = true;
      archivedSections.replaceChildren();
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
        sectionPanel.hidden = false;
        void loadSections(revision);
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
