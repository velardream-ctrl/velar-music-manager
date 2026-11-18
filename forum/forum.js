(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const categories = {
    site: ['Вопросы о сайте', '✧'],
    ideas: ['Идеи для песен', '♫'],
    collaboration: ['Сотрудничество', '✦'],
    releases: ['Обсуждение релизов', '◎']
  };
  const demo = new URLSearchParams(location.search).get('demo') === '1';
  const emailKey = 'velar-forum-email';
  const topicForm = $('topic-form');
  const replyForm = $('reply-form');
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
  let afterSignIn = null;
  const pageError = 'Форум пока недоступен. Попробуйте обновить страницу позже.';

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function timeLabel(value) {
    return value && value.toDate ? new Intl.DateTimeFormat('ru', {dateStyle:'medium'}).format(value.toDate()) : '';
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

  Object.keys(categories).forEach(key => {
    const [label, symbol] = categories[key];
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
    topicForm.elements.namedItem('category').appendChild(option);
  });

  function renderBoard() {
    board.hidden = false;
    thread.hidden = true;
    active = '';
    $('board-title').textContent = category ? categories[category][0] : 'Свежие обсуждения';
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
      group.append(title, node('p', [section ? section[0] : '', topic.author, timeLabel(topic.createdAt)].filter(Boolean).join(' · '), 'muted'));
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
    $('thread-meta').textContent = [topic.author, timeLabel(topic.createdAt)].filter(Boolean).join(' · ');
    $('thread-body').textContent = topic.body;
    $('replies').textContent = 'Загрузка…';
    const replies = demo ? sampleReplies[id] || [] : await topicPath(id).collection('replies')
      .where('visible', '==', true).orderBy('createdAt').limit(100).get()
      .then(snapshot => snapshot.docs.map(doc => doc.data()));
    if (active !== id || revision !== replyRequest) return;
    const list = $('replies');
    list.textContent = '';
    if (!replies.length) list.appendChild(node('p', 'Ответов пока нет.', 'muted'));
    replies.forEach(reply => {
      const item = node('article', '', 'reply');
      item.append(node('strong', reply.author), node('p', reply.body, 'message'));
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

  function openTopic() {
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
      if (author.length < 2 || title.length < 3 || body.length < 3 || !categories[section])
        validation('Проверьте имя, раздел, заголовок и сообщение.');
      const data = {category:section,title,body,author,visible:true};
      let id;
      if (demo) {
        id = 'demo-' + Date.now();
        samples.unshift(Object.assign({id}, data));
      } else {
        const doc = await db.collection('velar_forum_topics').add(
          Object.assign(data, {uid:user.uid, createdAt:postStamp()}));
        id = doc.id;
      }
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
      const author = cleaned(topicForm, 'author') || 'Участник форума';
      if (demo) (sampleReplies[id] || (sampleReplies[id] = [])).push({author,body});
      else await topicPath(id).collection('replies').add({
        author,body,uid:user.uid,visible:true,createdAt:postStamp()
      });
      replyForm.reset();
      if (active === id) await renderThread(id);
    });
  };

  const callback = location.origin + location.pathname;
  let completing = false;
  let authMode = 'login';
  const authModes = {
    login: ['Вход на форум', 'Войдите по email и паролю. Email не отображается в обсуждениях.', 'Войти'],
    register: ['Создать аккаунт', 'Придумайте пароль от 6 символов. Для публикаций потребуется подтвердить email.', 'Зарегистрироваться'],
    reset: ['Задать или восстановить пароль', 'Введите email аккаунта, чтобы получить письмо для установки пароля.', 'Отправить письмо'],
    verify: ['Подтвердите email', 'Откройте письмо с подтверждением. Затем вернитесь сюда и нажмите «Проверить подтверждение».', 'Проверить подтверждение'],
    link: ['Завершить вход по ссылке', 'Введите email, на который пришла эта ссылка.', 'Войти']
  };

  function setAuthMode(mode) {
    authMode = mode;
    const [title, help, button] = authModes[mode];
    $('email-title').textContent = title;
    $('email-help').textContent = help;
    $('email-submit').textContent = button;
    $('email-status').textContent = '';
    const email = emailForm.elements.namedItem('email');
    const password = emailForm.elements.namedItem('password');
    email.required = mode !== 'verify';
    $('email-field').hidden = !email.required;
    password.required = mode === 'login' || mode === 'register';
    $('password-field').hidden = !password.required;
    password.value = '';
    password.minLength = mode === 'register' ? 6 : 0;
    password.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    $('auth-login').hidden = mode !== 'register' && mode !== 'reset';
    $('auth-register').hidden = mode !== 'login';
    $('auth-reset').hidden = mode !== 'login' && mode !== 'register';
    $('auth-resend').hidden = mode !== 'verify';
  }

  function showAccount(account) {
    user = account;
    $('sign-in').hidden = !!account;
    $('sign-out').hidden = !account;
    $('verify-email').hidden = !account || account.emailVerified;
    if (account && account.emailVerified && afterSignIn) {
      const action = afterSignIn;
      afterSignIn = null;
      dismissModal($('email-dialog'));
      action();
    }
  }

  async function finish(email) {
    await auth.signInWithEmailLink(email, location.href);
    try { localStorage.removeItem(emailKey); } catch (_) {}
    history.replaceState(null, '', callback + location.hash);
    dismissModal($('email-dialog'));
    completing = false;
  }

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
      try {
        if (authMode === 'link') { await finish(email); return; }
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
        const result = registering
          ? await auth.createUserWithEmailAndPassword(email, password)
          : await auth.signInWithEmailAndPassword(email, password);
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
    const app = firebase.initializeApp(window.VELAR_FIREBASE_CONFIG, 'velar-forum');
    auth = app.auth();
    auth.languageCode = 'ru';
    db = app.firestore();
    auth.onAuthStateChanged(account => {
      authReady = true;
      showAccount(account);
    });
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (_) {
      $('status').textContent = 'Браузер ограничивает сохранение входа. Используйте обычную вкладку для постоянного входа.';
    }
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
