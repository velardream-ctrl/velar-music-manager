(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const sections = window.VelarForumSections;
  let categories = Object.create(null);
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const authorNames = new Map();
  const passwordKey = 'velar-forum-password-set:';
  const passwordAccounts = new Set();
  const emailKey = 'velar-forum-email';
  const topicForm = $('topic-form');
  const replyForm = $('reply-form');
  const editForm = $('edit-form');
  let editTarget = null;
  const emailForm = $('email-form');
  const board = $('board');
  const thread = $('thread');
  const samples = [
    {id:'radio',category:'site',title:'Как включить радио?',author:'LumenS',body:'Где найти радио и можно ли слушать его в свёрнутом виде?'},
    {id:'aurora',category:'ideas',title:'Песня о северном сиянии',author:'AstraVell',body:'Предлагаю написать песню о зимней дороге и северном сиянии. Какой жанр подошёл бы этой истории?'},
    {id:'duet',category:'collaboration',title:'Ищу вокалиста для дуэта',author:'Velarion',body:'Есть мелодия и черновой текст. Кто хотел бы попробовать записать вторую партию?'},
    {id:'release',category:'releases',title:'Что вы слушаете этой осенью?',author:'EchoLina',body:'Давайте соберём любимые релизы для вечерней подборки.'}
  ];
  const sampleReplies = Object.create(null);
  let topics = [];
  let category = '';
  let active = '';
  let replyRequest = 0;
  let auth, db, user;
  let authReady = false;
  let usingStudio = false;
  let afterSignIn = null;
  const pageError = 'Форум пока недоступен. Попробуйте обновить страницу позже.';

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function timeLabel(value) {
    const date = value && (typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null);
    return date ? new Intl.DateTimeFormat('ru', {dateStyle:'medium'}).format(date) : '';
  }
  function editedLabel(post) {
    return post.editedAt ? ' · изменено ' + timeLabel(post.editedAt) : '';
  }
  function canEditPost(post) {
    return !!(post && post.visible !== false && !post.deleted &&
      (demo ? post.uid === 'demo' : user && user.emailVerified && post.uid === user.uid));
  }
  function matches(topic, term) {
    return [topic.title, topic.author, topic.body].join(' ').toLowerCase().includes(term.toLowerCase());
  }
  function topicPath(id) {
    return db.collection('velar_forum_topics').doc(id);
  }
  function postStamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }
  function cleaned(form, name) {
    return form.elements.namedItem(name).value.trim();
  }
  function presentModal(dialog) {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  function dismissModal(dialog) {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }
  async function submit(form, status, action) {
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    status.textContent = '';
    try { await action(); }
    catch (error) {
      status.textContent = error && error.userMessage || 'Действие не выполнено. Проверьте подключение и попробуйте снова.';
    } finally { button.disabled = false; }
  }
  function validation(text) { throw {userMessage:text}; }

  function renderSections(rows) {
    categories = Object.create(null);
    for (const section of rows) categories[section.id] = section;
    $('constellations').replaceChildren();
    const picker = topicForm.elements.namedItem('category');
    const selected = picker.value;
    picker.replaceChildren();
    for (const {id:key, label, icon:symbol, enabled} of rows) {
      if (!enabled) continue;
      const button = node('button', '', 'constellation');
      button.type = 'button';
      button.dataset.category = key;
      button.setAttribute('aria-pressed', 'false');
      const icon = node('span', symbol, 'star');
      icon.setAttribute('aria-hidden', 'true');
      button.append(icon, node('span', label));
      button.onclick = () => {
        category = category === key ? '' : key;
        location.hash = '';
        renderBoard();
        board.scrollIntoView({block:'nearest'});
      };
      $('constellations').appendChild(button);
      const option = node('option', label);
      option.value = key;
      picker.appendChild(option);
    }
    if (categories[selected]?.enabled) picker.value = selected;
  }

  renderSections(sections.defaults);

  function renderBoard() {
    board.hidden = false;
    thread.hidden = true;
    active = '';
    $('board-title').textContent = category ? categories[category].label : 'Свежие обсуждения';
    $('constellations').querySelectorAll('button').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.category === category));
    });
    const list = $('topics');
    list.textContent = '';
    const query = $('search').value.trim();
    const results = topics.filter(topic => (!category || topic.category === category) && matches(topic, query));
    if (!results.length) list.appendChild(node('p', query ? 'Ничего не найдено.' : 'Здесь пока нет обсуждений.', 'muted'));
    results.forEach(topic => {
      const row = node('article', '', 'topic');
      const title = node('a', topic.title);
      title.href = '#topic=' + encodeURIComponent(topic.id);
      const group = node('div');
      const section = categories[topic.category];
      group.append(title, node('p', [section ? section.label : '', topic.author, timeLabel(topic.createdAt)].filter(Boolean).join(' · '), 'muted'));
      row.append(group, node('span', '↗', 'muted'));
      list.appendChild(row);
    });
  }

  async function renderThread(id) {
    const revision = ++replyRequest;
    const topic = demo ? topics.find(item => item.id === id) :
      await topicPath(id).get().then(snapshot => snapshot.exists ? snapshot.data() : null);
    if (revision !== replyRequest) return;
    if (!topic) {
      $('status').textContent = 'Тема недоступна.';
      renderBoard();
      return;
    }
    $('status').textContent = '';
    active = id;
    board.hidden = true;
    thread.hidden = false;
    $('thread-title').textContent = topic.title;
    $('thread-meta').textContent = [topic.author, timeLabel(topic.createdAt)].filter(Boolean).join(' · ') + editedLabel(topic);
    $('thread-body').textContent = topic.body;
    const editableTopic = canEditPost(topic);
    $('thread-actions').hidden = !editableTopic;
    $('edit-topic').onclick = editableTopic ? () => openEdit('topic', id, topic) : null;
    $('replies').textContent = 'Загрузка…';
    const replies = demo ? sampleReplies[id] || [] : await topicPath(id).collection('replies')
      .where('visible', '==', true).orderBy('createdAt').limit(100).get()
      .then(snapshot => snapshot.docs.map(doc => Object.assign({id: doc.id}, doc.data())));
    if (active !== id || revision !== replyRequest) return;
    const list = $('replies');
    list.textContent = '';
    if (!replies.length) list.appendChild(node('p', 'Ответов пока нет.', 'muted'));
    replies.forEach(reply => {
      const item = node('article', '', 'reply');
      item.append(node('strong', reply.author));
      if (reply.editedAt) item.append(node('span', editedLabel(reply), 'muted'));
      item.append(node('p', reply.body, 'message'));
      if (canEditPost(reply)) {
        const actions = node('div', '', 'post-actions');
        const button = node('button', 'Изменить', 'outline');
        button.type = 'button';
        button.onclick = () => openEdit('reply', reply.id, reply);
        actions.appendChild(button);
        item.appendChild(actions);
      }
      list.appendChild(item);
    });
  }

  async function route() {
    const match = /^#topic=([A-Za-z0-9_-]{1,60})$/.exec(location.hash);
    if (!match) {
      replyRequest++;
      renderBoard();
      return;
    }
    try { await renderThread(match[1]); }
    catch (_) { $('status').textContent = 'Не удалось открыть тему.'; }
  }

  async function refresh() {
    topics = demo ? samples : await db.collection('velar_forum_topics')
      .where('visible', '==', true).orderBy('createdAt', 'desc').limit(100).get()
      .then(snapshot => snapshot.docs.map(doc => Object.assign({id:doc.id}, doc.data())));
    await route();
  }

  function showLogin(action) {
    if (demo || user && user.emailVerified) {
      if (action) action();
      return;
    }
    if (!authReady) { $('status').textContent = auth ? 'Проверяем, выполнен ли вход…' : pageError; return; }
    afterSignIn = action || null;
    setAuthMode(user ? 'verify' : completing ? 'link' : 'login');
    presentModal($('email-dialog'));
  }

  function forumAuthor(account) {
    const uid = demo ? 'demo' : account?.uid;
    if (!uid) return '';
    let saved = authorNames.get(uid);
    if (!saved && !demo) {
      try { saved = localStorage.getItem('velar-forum-author:' + uid); } catch (_) {}
    }
    return saved || topics.find(topic => topic.uid === uid)?.author || (usingStudio ? (account.displayName || '').slice(0, 32) : '');
  }

  function rememberAuthor(account, name) {
    const uid = demo ? 'demo' : account?.uid;
    if (!uid) return;
    authorNames.set(uid, name);
    if (!demo) {
      try { localStorage.setItem('velar-forum-author:' + uid, name); } catch (_) {}
      syncMember(account).catch(() => console.warn('Не удалось обновить имя участника.'));
    }
  }

  function openEdit(kind, id, post) {
    if (!id || !canEditPost(post) || (kind !== 'topic' && kind !== 'reply')) return;
    editTarget = {kind, id, topicId:active, post};
    const isTopic = kind === 'topic';
    const heading = editForm.elements.namedItem('title');
    const body = editForm.elements.namedItem('body');
    $('edit-title').textContent = isTopic ? 'Изменить тему' : 'Изменить ответ';
    $('edit-heading-field').hidden = !isTopic;
    heading.required = isTopic;
    heading.value = isTopic ? post.title : '';
    body.maxLength = isTopic ? 3000 : 2000;
    body.value = post.body;
    $('edit-status').textContent = '';
    presentModal($('edit-dialog'));
    body.focus();
  }

  function openTopic() {
    topicForm.elements.namedItem('author').value = forumAuthor(user);
    if (category) topicForm.elements.namedItem('category').value = category;
    presentModal($('topic-dialog'));
  }

  $('new-topic').onclick = () => showLogin(openTopic);
  $('sign-in').onclick = () => showLogin();
  $('verify-email').onclick = () => showLogin();
  $('sign-out').onclick = () => auth.signOut().catch(() => { $('status').textContent = pageError; });
  $('back').onclick = event => { event.preventDefault(); location.hash = ''; };
  $('search').oninput = renderBoard;
  document.querySelectorAll('[data-close]').forEach(button => {
    button.onclick = () => dismissModal(button.closest('dialog'));
  });

  topicForm.elements.namedItem('title').oninput = () => {
    const query = cleaned(topicForm, 'title');
    const related = query.length >= 4 ? topics.filter(topic => matches(topic, query)).slice(0,3) : [];
    $('similar').textContent = related.length ? 'Похожие темы — ' + related.map(topic => topic.title).join(' · ') : '';
  };

  topicForm.onsubmit = event => {
    event.preventDefault();
    if (!demo && !(user && user.emailVerified)) {
      dismissModal($('topic-dialog'));
      showLogin(openTopic);
      return;
    }
    submit(topicForm, $('topic-status'), async () => {
      const title = cleaned(topicForm, 'title');
      const body = cleaned(topicForm, 'body');
      const author = cleaned(topicForm, 'author');
      const section = cleaned(topicForm, 'category');
      if (author.length < 2 || title.length < 3 || body.length < 3 || !categories[section]?.enabled)
        validation('Проверьте имя, раздел, заголовок и сообщение.');
      const data = {category:section,title,body,author,visible:true};
      let id;
      const authorAccount = user;
      if (demo) {
        id = 'demo-' + Date.now();
        samples.unshift(Object.assign({id,uid:'demo'}, data));
      } else {
        const doc = await db.collection('velar_forum_topics').add(
          Object.assign(data, {uid:authorAccount.uid, createdAt:postStamp()}));
        id = doc.id;
      }
      rememberAuthor(authorAccount, author);
      dismissModal($('topic-dialog'));
      topicForm.reset();
      $('similar').textContent = '';
      location.hash = 'topic=' + id;
      await refresh();
    });
  };

  replyForm.onsubmit = event => {
    event.preventDefault();
    if (!demo && !(user && user.emailVerified)) {
      showLogin(() => replyForm.elements.namedItem('body').focus());
      return;
    }
    submit(replyForm, $('status'), async () => {
      const id = active;
      const body = cleaned(replyForm, 'body');
      if (!id || !body) validation('Введите ответ.');
      const author = forumAuthor(user) || 'Участник форума';
      if (demo) (sampleReplies[id] || (sampleReplies[id] = [])).push({
        id:'demo-reply-' + Date.now() + '-' + Math.random().toString(36).slice(2,7),
        uid:'demo',author,body,visible:true
      });
      else await topicPath(id).collection('replies').add({
        author,body,uid:user.uid,visible:true,createdAt:postStamp()
      });
      replyForm.reset();
      if (active === id) await renderThread(id);
    });
  };

  editForm.onsubmit = event => {
    event.preventDefault();
    const target = editTarget;
    if (!target) return;
    submit(editForm, $('edit-status'), async () => {
      if (!canEditPost(target.post)) validation('Редактировать сообщение может только его автор.');
      const body = cleaned(editForm, 'body');
      const isTopic = target.kind === 'topic';
      const title = isTopic ? cleaned(editForm, 'title') : '';
      if (!body || body.length > (isTopic ? 3000 : 2000) ||
          (isTopic && (title.length < 3 || title.length > 100)))
        validation('Проверьте длину заголовка и текста сообщения.');
      if (body === target.post.body && (!isTopic || title === target.post.title)) {
        editTarget = null;
        dismissModal($('edit-dialog'));
        return;
      }
      if (demo) {
        const record = isTopic ? samples.find(post => post.id === target.id) :
          (sampleReplies[target.topicId] || []).find(reply => reply.id === target.id);
        if (!record || record.uid !== 'demo') validation('Сообщение больше недоступно.');
        Object.assign(record, {body, editedAt:new Date()});
        if (isTopic) record.title = title;
      } else {
        const ref = isTopic ? topicPath(target.id) :
          topicPath(target.topicId).collection('replies').doc(target.id);
        const changes = {body, editedAt:postStamp()};
        if (isTopic) changes.title = title;
        try { await ref.update(changes); }
        catch (error) {
          if (error.code === 'permission-denied')
            validation('Сервер пока не разрешает редактирование. Обратитесь к администратору форума.');
          throw error;
        }
      }
      editTarget = null;
      dismissModal($('edit-dialog'));
      if (active === target.topicId) await refresh();
    });
  };
  $('edit-dialog').addEventListener('close', () => { editTarget = null; });

  const callback = location.origin + location.pathname;
  let completing = false;
  let authMode = 'login';
  const authModes = {
    login: ['Вход на форум', 'Войдите по email и паролю. Email не отображается в обсуждениях.', 'Войти'],
    register: ['Создать аккаунт', 'Придумайте пароль от 6 символов. Для публикаций потребуется подтвердить email.', 'Зарегистрироваться'],
    reset: ['Задать или восстановить пароль', 'Введите email аккаунта, чтобы получить письмо для установки пароля.', 'Отправить письмо'],
    verify: ['Подтвердите email', 'Откройте письмо с подтверждением. Затем вернитесь сюда и нажмите «Проверить подтверждение».', 'Проверить подтверждение'],
    sendLink: ['Получить ссылку для входа', 'Введите email своего аккаунта. После входа можно задать пароль.', 'Отправить ссылку'],
    password: ['Задать пароль', 'Придумайте пароль от 6 символов.', 'Сохранить пароль'],
    link: ['Завершить вход по ссылке', 'Введите email, на который пришла эта ссылка.', 'Войти']
  };

  const loginOptionsKey = 'velar-forum-login-options';

  function savedLoginOptions() {
    try {
      const options = JSON.parse(localStorage.getItem(loginOptionsKey));
      if (options && typeof options.remember === 'boolean' && typeof options.save === 'boolean') return options;
    } catch (_) {}
    return null;
  }

  function showLoginOptions(mode) {
    const options = savedLoginOptions();
    const usesPassword = ['login', 'register', 'password'].includes(mode);
    $('remember-session').checked = options?.remember ?? true;
    $('save-credential').checked = options?.save ?? false;
    $('remember-options').checked = !!options;
    $('remember-session-option').hidden = mode === 'password';
    $('login-options').hidden = !usesPassword || !!options;
    $('show-login-options').hidden = !usesPassword || !options;
  }

  $('show-login-options').onclick = () => {
    $('login-options').hidden = false;
    $('show-login-options').hidden = true;
    ($('remember-session-option').hidden ? $('save-credential') : $('remember-session')).focus();
  };

  function persistLoginOptions(options) {
    try {
      if (options.skipPrompt) {
        localStorage.setItem(loginOptionsKey, JSON.stringify({remember:options.remember,save:options.save}));
      } else localStorage.removeItem(loginOptionsKey);
    } catch (_) {}
  }

  function saveBrowserCredential(email, password) {
    if (!email || !window.PasswordCredential || !navigator.credentials?.store) return;
    try {
      const credential = new window.PasswordCredential({id:email,password});
      navigator.credentials.store(credential).catch(() => {});
    } catch (_) {}
  }

  async function setLoginPersistence(remember) {
    const persistence = firebase.auth.Auth.Persistence;
    try {
      await auth.setPersistence(remember ? persistence.LOCAL : persistence.SESSION);
    } catch (error) {
      if (!remember) {
        try {
          await auth.setPersistence(persistence.NONE);
          return;
        } catch (_) {
          validation('Браузер не позволяет настроить временный вход.');
        }
      }
      $('status').textContent = 'Браузер ограничивает сохранение входа.';
    }
  }

  function setAuthMode(mode) {
    authMode = mode;
    showLoginOptions(mode);
    const [title, help, button] = authModes[mode];
    $('email-title').textContent = title;
    $('email-help').textContent = help;
    $('email-submit').textContent = button;
    $('email-status').textContent = '';
    const email = emailForm.elements.namedItem('email');
    const password = emailForm.elements.namedItem('password');
    email.required = mode !== 'verify' && mode !== 'password';
    $('email-field').hidden = !email.required;
    password.required = mode === 'login' || mode === 'register' || mode === 'password';
    $('password-field').hidden = !password.required;
    password.value = '';
    password.minLength = mode === 'register' || mode === 'password' ? 6 : 0;
    password.autocomplete = mode === 'register' || mode === 'password' ? 'new-password' : 'current-password';
    $('auth-login').hidden = !['register', 'reset', 'sendLink'].includes(mode);
    $('auth-link').hidden = !['login', 'reset', 'link'].includes(mode);
    $('auth-register').hidden = mode !== 'login';
    $('auth-reset').hidden = mode !== 'login' && mode !== 'register';
    $('auth-resend').hidden = mode !== 'verify';
  }

  function hasPassword(account) {
    if (!account) return false;
    if (passwordAccounts.has(account.uid)) return true;
    try { return localStorage.getItem(passwordKey + account.uid) === '1'; }
    catch (_) { return false; }
  }

  function rememberPassword(account) {
    passwordAccounts.add(account.uid);
    try { localStorage.setItem(passwordKey + account.uid, '1'); } catch (_) {}
    if (user && user.uid === account.uid) $('set-password').hidden = true;
  }

  async function syncMember(account) {
    const token = await account.getIdTokenResult();
    if (token.signInProvider !== 'password') return;
    const ref = db.collection('velar_forum_members').doc(account.uid);
    const data = {name: forumAuthor(account).slice(0, 32), email: token.claims.email,
      verified: token.claims.email_verified === true};
    await db.runTransaction(async transaction => {
      const previous = await transaction.get(ref);
      if (!previous.exists) {
        transaction.set(ref, {...data, joinedAt: firebase.firestore.FieldValue.serverTimestamp()});
      } else {
        if (!data.name) data.name = previous.get('name') || '';
        if (Object.keys(data).some(key => previous.get(key) !== data[key])) transaction.update(ref, data);
      }
    });
  }

  function showAccount(account) {
    if (account && !demo && !usingStudio) syncMember(account).catch(() => console.warn('Не удалось обновить профиль форума.'));
    user = account;
    $('sign-in').hidden = !!account;
    $('sign-out').hidden = !account;
    $('sign-out').textContent = usingStudio ? 'Выйти из Studio и форума' : 'Выйти';
    $('set-password').hidden = usingStudio || !account || !account.emailVerified || hasPassword(account);
    $('verify-email').hidden = !account || account.emailVerified;
    if (account && account.emailVerified && afterSignIn) {
      const action = afterSignIn;
      afterSignIn = null;
      dismissModal($('email-dialog'));
      action();
    }
    if (active) route().catch(() => { $('status').textContent = 'Не удалось обновить тему.'; });
  }

  async function finish(email) {
    const continueAction = !!afterSignIn;
    if (savedLoginOptions()?.remember === false) await setLoginPersistence(false);
    const {user: account} = await auth.signInWithEmailLink(email, location.href);
    try { localStorage.removeItem(emailKey); } catch (_) {}
    history.replaceState(null, '', callback + location.hash);
    completing = false;
    if (!continueAction && !hasPassword(account)) {
      setAuthMode('password');
      presentModal($('email-dialog'));
    } else {
      dismissModal($('email-dialog'));
    }
  }

  function requestLink(status) {
    completing = false;
    history.replaceState(null, '', callback + location.hash);
    setAuthMode('sendLink');
    $('email-status').textContent = status || '';
  }

  $('set-password').onclick = () => {
    setAuthMode('password');
    presentModal($('email-dialog'));
  };
  $('auth-link').onclick = () => requestLink();
  $('auth-login').onclick = () => setAuthMode('login');
  $('auth-register').onclick = () => setAuthMode('register');
  $('auth-reset').onclick = () => setAuthMode('reset');
  $('auth-resend').onclick = () => submit(emailForm, $('email-status'), async () => {
    await auth.currentUser.sendEmailVerification({url:callback});
    $('email-status').textContent = 'Письмо с подтверждением отправлено.';
  });

  emailForm.onsubmit = event => {
    event.preventDefault();
    submit(emailForm, $('email-status'), async () => {
      const email = cleaned(emailForm, 'email');
      const password = emailForm.elements.namedItem('password').value;
      const options = {remember:$('remember-session').checked,save:$('save-credential').checked,
        skipPrompt:$('remember-options').checked};
      try {
        if (authMode === 'link') { await finish(email); return; }
        if (authMode === 'sendLink') {
          await auth.sendSignInLinkToEmail(email, {url:callback,handleCodeInApp:true});
          try { localStorage.setItem(emailKey, email); } catch (_) {}
          $('email-status').textContent = 'Ссылка отправлена. Откройте письмо в браузере, которым пользуетесь для форума.';
          return;
        }
        if (authMode === 'password') {
          if (!auth.currentUser?.emailVerified) {
            requestLink('Сначала подтвердите вход свежей ссылкой.');
            return;
          }
          const account = auth.currentUser;
          try {
            await account.updatePassword(password);
            rememberPassword(account);
            persistLoginOptions(options);
            if (options.save) saveBrowserCredential(account.email, password);
          } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
              emailForm.elements.namedItem('email').value = account.email || '';
              requestLink('Для установки пароля подтвердите вход свежей ссылкой.');
              return;
            }
            throw error;
          }
          emailForm.elements.namedItem('password').value = '';
          dismissModal($('email-dialog'));
          $('status').textContent = 'Пароль сохранён. Теперь можно входить по email и паролю.';
          return;
        }
        if (authMode === 'reset') {
          await auth.sendPasswordResetEmail(email, {url:callback});
          $('email-status').textContent = 'Если аккаунт существует, письмо для установки пароля отправлено.';
          return;
        }
        if (authMode === 'verify') {
          const account = auth.currentUser;
          if (!account) { setAuthMode('login'); return; }
          await account.reload();
          if (!account.emailVerified) validation('Email пока не подтверждён. Проверьте письмо.');
          await account.getIdToken(true);
          dismissModal($('email-dialog'));
          showAccount(account);
          return;
        }
        const registering = authMode === 'register';
        await setLoginPersistence(options.remember);
        const result = registering
          ? await auth.createUserWithEmailAndPassword(email, password)
          : await auth.signInWithEmailAndPassword(email, password);
        rememberPassword(result.user);
        persistLoginOptions(options);
        if (options.save) saveBrowserCredential(email, password);
        if (!result.user.emailVerified) {
          setAuthMode('verify');
          if (registering) {
            await result.user.sendEmailVerification({url:callback});
            $('email-status').textContent = 'Письмо с подтверждением отправлено.';
          }
        } else {
          dismissModal($('email-dialog'));
        }
      } catch (error) {
        if (authMode === 'link' && ['auth/expired-action-code', 'auth/invalid-action-code'].includes(error.code)) {
          requestLink('Эта ссылка больше не действует. Запросите новую.');
          return;
        }
        if (['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential', 'auth/invalid-login-credentials'].includes(error.code))
          validation('Проверьте email и пароль. Пароль можно задать или восстановить по письму.');
        if (error.code === 'auth/email-already-in-use')
          validation('Этот email уже зарегистрирован. Войдите или задайте пароль по письму.');
        if (error.code === 'auth/weak-password' || error.code === 'auth/password-does-not-meet-requirements')
          validation('Выберите более сложный пароль.');
        if (error.code === 'auth/operation-not-allowed')
          validation('Этот способ входа пока не включён в настройках форума.');
        throw error;
      }
    });
  };

  async function start() {
    if (demo) {
      $('demo-note').hidden = false;
      await refresh();
      return;
    }
    const studio = firebase.initializeApp(window.VELAR_FIREBASE_CONFIG);
    const forum = firebase.initializeApp(window.VELAR_FIREBASE_CONFIG, 'velar-forum');
    // An explicit email sign-in link belongs to the forum account that requested it.
    const emailLink = forum.auth().isSignInWithEmailLink(location.href);
    const studioUid = account => account && account.emailVerified &&
      account.providerData.some(provider => provider.providerId === 'google.com') ? account.uid : null;
    const firstUid = await new Promise((resolve, reject) => {
      let initialized = false;
      let initialUid;
      studio.auth().onAuthStateChanged(account => {
        const uid = studioUid(account);
        if (!initialized) {
          initialized = true;
          initialUid = uid;
          resolve(uid);
        } else if (!emailLink && initialUid !== uid) {
          location.reload();
        }
      }, reject);
    });
    usingStudio = Boolean(firstUid && !emailLink);
    const app = usingStudio ? studio : forum;
    auth = app.auth();
    const languages = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    const preferred = languages.map(tag => String(tag).toLowerCase().split('-')[0]).find(lang => lang === 'ru' || lang === 'en');
    auth.languageCode = preferred || 'en';
    db = app.firestore();
    db.collection('velar_forum_settings').doc('public').get().then(snapshot => {
      if (!snapshot.exists) return;
      const {title, subtitle} = snapshot.data();
      const name = title || 'Форум';
      $('forum-title').textContent = name;
      $('forum-subtitle').textContent = subtitle;
      $('forum-subtitle').hidden = !subtitle;
      document.title = name + ' — VELARDREAM';
    }).catch(() => {});
    sections.load(db).then(rows => {
      if (category && !rows.some(section => section.id === category && section.enabled)) category = '';
      renderSections(rows);
      if (!active) renderBoard();
    }).catch(() => {});
    auth.onAuthStateChanged(account => {
      authReady = true;
      showAccount(account);
    });
    if (auth.isSignInWithEmailLink(location.href)) {
      let email;
      try { email = localStorage.getItem(emailKey); } catch (_) {}
      if (email) {
        try { await finish(email); }
        catch (_) { completing = true; }
      } else completing = true;
      if (completing) {
        setAuthMode('link');
        presentModal($('email-dialog'));
      }
    }
    await refresh();
  }
  window.addEventListener('hashchange', route);
  start().catch(() => { $('status').textContent = pageError; });
}());
