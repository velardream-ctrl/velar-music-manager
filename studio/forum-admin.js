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
    ['📝', 'Песни на заказ'], ['🎹', 'Клавиши'], ['🎛️', 'Студия и звук'], ['💿', 'Альбомы'], ['🎬', 'Видео'],
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
    const save = element('button', 'Сохранить изменения', 'gold');
    save.type = 'submit';
    const cancel = element('button', 'Отменить изменения');
    cancel.type = 'button';
    const controls = element('div', '', 'actions');
    const draftActions = element('div', '', 'actions');
    draftActions.append(save, cancel);
    controls.append(draftActions);
    const remove = section.id ? sectionDeleteAction(section) : null;
    if (remove) controls.append(remove);
    form.append(controls);
    form.dataset.sectionId = section.id || '';

    function readDraft() {
      return {label:label.value.trim(),icon:selectedIcon(),order:order.valueAsNumber,enabled:enabled.checked};
    }

    function updateDraft() {
      const data = readDraft();
      const changed = !section.id || data.label !== section.label || data.icon !== section.icon ||
        data.order !== section.order || data.enabled !== section.enabled;
      draftActions.hidden = !changed;
      if (remove) remove.hidden = changed;
      form.dataset.dirty = String(changed);
      return changed;
    }

    cancel.onclick = () => {
      if (section.id) {
        const restored = renderSection(section);
        form.replaceWith(restored);
        restored.elements.namedItem('label').focus();
      } else {
        form.remove();
        sectionAdd.disabled = sectionRows.length >= 100;
        if (!sectionAdd.disabled) sectionAdd.focus();
      }
      sectionStatus.textContent = 'Изменения отменены.';
    };
    form.oninput = form.onchange = updateDraft;
    updateDraft();

    form.onsubmit = async event => {
      event.preventDefault();
      if (!permitted || save.disabled || !updateDraft()) return;
      const revision = session;
      const data = readDraft();
      if (data.label.length < 2 || !data.icon) {
        sectionStatus.textContent = 'Заполните название и иконку.';
        return;
      }
      const fields = [...form.querySelectorAll('input, select, button')];
      fields.forEach(field => { field.disabled = true; });
      try {
        const collection = db.collection(sections.collection);
        const ref = section.id ? collection.doc(section.id) : collection.doc();
        await ref.set(data);
        if (revision !== session) return;
        form.replaceWith(renderSection({id:ref.id, ...data}));
        if (await loadSections(revision)) sectionStatus.textContent = 'Раздел сохранён.';
      } catch (_) {
        if (revision === session) sectionStatus.textContent = 'Не удалось сохранить раздел.';
      } finally {
        fields.forEach(field => { field.disabled = false; });
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
      const drafts = new Map([...sectionList.querySelectorAll('form[data-dirty="true"]')]
        .map(form => [form.dataset.sectionId, form]));
      const activeForms = rows.filter(section => !section.deleted)
        .map(section => drafts.get(section.id) || renderSection(section));
      if (drafts.has('')) activeForms.push(drafts.get(''));
      sectionList.replaceChildren(...activeForms);
      const deleted = rows.filter(section => section.deleted);
      sectionArchive.hidden = !deleted.length;
      archivedSections.replaceChildren(...deleted.map(section => {
        const row = element('div', '', 'forum-section-editor');
        row.append(element('p', section.icon + ' ' + section.label), sectionDeleteAction(section));
        return row;
      }));
      sectionAdd.disabled = rows.length >= 100 || drafts.has('');
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

  const identity = document.getElementById('forum-identity');
  const identityStatus = document.getElementById('identity-status');
  const identityActions = document.getElementById('identity-actions');
  const titleField = identity.elements.namedItem('title');
  const subtitleField = identity.elements.namedItem('subtitle');
  let savedIdentity;

  function identityRef() {
    return db.collection('velar_forum_settings').doc('public');
  }

  function restoreIdentity() {
    titleField.value = savedIdentity.title;
    subtitleField.value = savedIdentity.subtitle;
    identityActions.hidden = true;
  }

  async function loadIdentity(revision) {
    identityStatus.textContent = 'Загружаем название форума…';
    try {
      const snapshot = await withAccessTimeout(identityRef().get({source:'server'}));
      if (revision !== session) return;
      savedIdentity = snapshot.exists ? snapshot.data() : {title:'Созвездия',subtitle:'Музыкальное сообщество'};
      restoreIdentity();
      identity.hidden = false;
      identityStatus.textContent = '';
    } catch (error) {
      if (revision !== session) return;
      identityStatus.textContent = error.code === 'permission-denied' ?
        'Для изменения названия форума нужно опубликовать обновлённые правила Firestore.' :
        'Не удалось загрузить название форума.';
    }
  }

  identity.oninput = () => {
    identityActions.hidden = titleField.value === savedIdentity.title && subtitleField.value === savedIdentity.subtitle;
  };
  document.getElementById('identity-cancel').onclick = restoreIdentity;
  identity.onsubmit = async event => {
    event.preventDefault();
    if (!permitted || identityActions.hidden) return;
    const revision = session;
    const data = {title:titleField.value.trim(),subtitle:subtitleField.value.trim()};
    const controls = [...identity.elements];
    controls.forEach(control => { control.disabled = true; });
    try {
      await identityRef().set(data);
      if (revision !== session) return;
      savedIdentity = data;
      restoreIdentity();
      identityStatus.textContent = 'Название форума сохранено.';
    } catch (_) {
      if (revision === session) identityStatus.textContent = 'Не удалось сохранить название форума.';
    } finally {
      controls.forEach(control => { control.disabled = false; });
    }
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

  const memberPanel = document.getElementById('member-panel');
  const memberList = document.getElementById('member-list');
  const memberSearch = document.getElementById('member-search');
  let members = [];
  let memberRequest = 0;

  function renderMembers() {
    const query = memberSearch.value.trim().toLowerCase();
    memberList.replaceChildren();
    members.filter(member => (member.name + ' ' + member.email).toLowerCase().includes(query)).forEach(member => {
      const row = element('article', '', 'topic moderator-row');
      const joined = member.joinedAt.toDate().toLocaleDateString('ru');
      row.append(element('strong', member.name || 'Участник'), element('p', member.email),
        element('p', (member.verified ? 'Почта подтверждена' : 'Ожидает подтверждения') + ' · В списке с ' + joined));
      if (member.uid !== adminUid) row.append(action('Запретить публикации', async () => {
        await db.collection('velar_forum_bans').doc(member.uid).set({
          author: member.name || 'Участник', createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await loadBans(session);
      }, 'Запретить участнику публиковать темы и ответы?'));
      memberList.append(row);
    });
    if (!memberList.children.length) memberList.textContent = query ? 'Совпадений нет.' : 'Участников пока нет.';
  }

  memberSearch.oninput = renderMembers;
  memberPanel.ontoggle = async () => {
    const request = ++memberRequest;
    if (!permitted || !memberPanel.open) return;
    const revision = session;
    memberList.textContent = 'Загрузка участников…';
    const loaded = [];
    const query = db.collection('velar_forum_members').orderBy('joinedAt').limit(100);
    let page = query;
    try {
      while (true) {
        const snapshot = await page.get();
        if (revision !== session || request !== memberRequest) return;
        snapshot.forEach(doc => loaded.push({...doc.data(), uid: doc.id}));
        if (snapshot.size < 100) break;
        page = query.startAfter(snapshot.docs[snapshot.size - 1]);
      }
      members = loaded;
      renderMembers();
    } catch (_) {
      if (revision === session && request === memberRequest) memberList.textContent = 'Не удалось загрузить участников.';
    }
  };

  refresh.onclick = loadTopics;
  try {
    const app = firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
    db = app.firestore();
    if (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) {
      db.settings({experimentalForceLongPolling:true});
    }
    app.auth().onAuthStateChanged(async user => {
      clearTimeout(window.forumAdminStartup);
      recovery.hidden = true;
      status.textContent = 'Проверяем доступ к Studio…';
      const revision = ++session;
      permitted = false;
      moderation.hidden = true;
      sectionPanel.hidden = true;
      identity.hidden = true;
      identityStatus.textContent = '';
      sectionList.replaceChildren();
      sectionArchive.hidden = true;
      archivedSections.replaceChildren();
      members = [];
      memberPanel.open = false;
      memberList.replaceChildren();
      memberSearch.value = '';
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
        void loadIdentity(revision);
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
