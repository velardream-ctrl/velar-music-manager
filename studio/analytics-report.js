(function () {
  'use strict';

  var form = document.getElementById('analytics-report-form');
  var status = document.getElementById('analytics-report-status');
  var output = document.getElementById('analytics-report-results');
  var property = form.elements.namedItem('property');
  var period = form.elements.namedItem('period');
  var submit = form.querySelector('button[type="submit"]');
  var propertyKey = 'velar-ga4-property';
  var scope = 'https://www.googleapis.com/auth/analytics.readonly';
  var token = '', owner = '', revision = 0;
  var events = {
    velar_youtube_start:'Запуски YouTube',
    velar_player_open:'Открытия плеера',
    velar_radio_open:'Открытия радио',
    velar_radio_next:'Переключения радио'
  };

  try { property.value = localStorage.getItem(propertyKey) || ''; } catch (_) {}

  function request(id, days, dimensions, metrics, extra, accessToken) {
    var body = {
      dateRanges:[{startDate:days + 'daysAgo',endDate:'today'}],
      dimensions:dimensions.map(function (name) { return {name:name}; }),
      metrics:metrics.map(function (name) { return {name:name}; }),
      limit:100
    };
    Object.keys(extra).forEach(function (key) { body[key] = extra[key]; });
    return window.fetch('https://analyticsdata.googleapis.com/v1beta/properties/' + id + ':runReport', {
      method:'POST', cache:'no-store',
      headers:{Authorization:'Bearer ' + accessToken,'Content-Type':'application/json'},
      body:JSON.stringify(body)
    }).then(function (response) {
      if (response.ok) return response.json();
      return response.json().catch(function () { return {}; }).then(function (data) {
        var error = new Error('GA4 HTTP ' + response.status);
        error.status = response.status;
        error.reason = ((data.error || {}).details || []).map(function (item) { return item.reason; });
        throw error;
      });
    });
  }

  function text(parent, tag, value) {
    var node = document.createElement(tag);
    node.textContent = value;
    parent.appendChild(node);
    return node;
  }

  function table(title, columns, rows) {
    var heading = text(output,'h3',title);
    if (!rows.length) { text(output,'p','За выбранный период данных нет.'); return; }
    var scroll = text(output,'div','');
    scroll.className = 'vmm-table-wrap';
    var t = text(scroll,'table','');
    t.setAttribute('aria-label',heading.textContent);
    var head = text(text(t,'thead',''),'tr','');
    columns.forEach(function (column) { text(head,'th',column).scope='col'; });
    var body = text(t,'tbody','');
    rows.forEach(function (values) {
      var row = text(body,'tr','');
      values.forEach(function (value) { text(row,'td',value); });
    });
  }

  function reportRows(report, map) {
    return (report.rows || []).map(function (row) {
      return map((row.dimensionValues || []).map(function (item) { return item.value; }),
        row.metricValues.map(function (item) { return item.value; }));
    });
  }

  function count(value) { return Number(value).toLocaleString('ru-RU'); }
  function date(value) { return value.slice(6,8)+'.'+value.slice(4,6)+'.'+value.slice(0,4); }

  function show(reports) {
    output.textContent = '';
    table('Итоги', ['Посетители','Сеансы','Просмотры'], reportRows(reports[0],function (_, metrics) { return metrics.map(count); }));
    table('По дням', ['Дата','Сеансы','Просмотры'], reportRows(reports[1],function (d,m) { return [date(d[0]),count(m[0]),count(m[1])]; }));
    table('Страницы', ['Путь','Просмотры'], reportRows(reports[2],function (d,m) { return [d[0],count(m[0])]; }));
    table('Музыкальные события', ['Событие','Количество'], reportRows(reports[3],function (d,m) { return [events[d[0]] || d[0],count(m[0])]; }));
  }

  function load(id, days, accessToken) {
    return Promise.all([
      request(id,days,[],['activeUsers','sessions','screenPageViews'],{},accessToken),
      request(id,days,['date'],['sessions','screenPageViews'],{orderBys:[{dimension:{dimensionName:'date'},desc:true}]},accessToken),
      request(id,days,['pagePath'],['screenPageViews'],{orderBys:[{metric:{metricName:'screenPageViews'},desc:true}]},accessToken),
      request(id,days,['eventName'],['eventCount'],{
        dimensionFilter:{filter:{fieldName:'eventName',inListFilter:{values:Object.keys(events)}}},
        orderBys:[{metric:{metricName:'eventCount'},desc:true}]
      },accessToken)
    ]);
  }

  function authorize(user) {
    if (token && owner === user.uid) return Promise.resolve(token);
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope(scope);
    return user.reauthenticateWithPopup(provider).then(function (result) {
      var credential = result.credential;
      if (!credential || !credential.accessToken) throw new Error('missing-token');
      return credential.accessToken;
    });
  }

  form.onsubmit = function (event) {
    event.preventDefault();
    var user = window.firebase && firebase.auth().currentUser;
    var id = property.value.trim();
    if (!user || !/^[0-9]{1,20}$/.test(id)) {
      status.textContent='Введи числовой ID ресурса GA4 и войди в Studio.';
      return;
    }
    var days = Number(period.value);
    var run = ++revision;
    submit.disabled = true;
    output.textContent = '';
    status.textContent = 'Запрашиваем отчёты Google Analytics…';
    // Call the popup in the click/submit event to retain Safari user activation.
    var access;
    try { access = authorize(user); } catch (error) { access = Promise.reject(error); }
    access.then(function (accessToken) {
      if (run !== revision || firebase.auth().currentUser !== user) return;
      token = accessToken;
      owner = user.uid;
      return load(id,days - 1,accessToken).then(function (reports) {
        if (run !== revision || firebase.auth().currentUser !== user) return;
        try { localStorage.setItem(propertyKey,id); } catch (_) {}
        show(reports);
        status.textContent = 'Отчёт за ' + days + ' дней загружен.';
      });
    }).catch(function (error) {
      if (run !== revision) return;
      if (error.status === 401) { token = ''; status.textContent = 'Доступ Google истёк. Нажми кнопку ещё раз.'; }
      else if (error.reason && (error.reason.indexOf('SERVICE_DISABLED') >= 0 || error.reason.indexOf('accessNotConfigured') >= 0))
        status.textContent = 'В проекте Studio нужно включить Google Analytics Data API.';
      else if (error.status === 403) { token = ''; status.textContent = 'Проверь доступ этого аккаунта к ресурсу GA4 и разрешение на чтение отчётов.'; }
      else if (error.status === 400 || error.status === 404) status.textContent = 'Проверь числовой ID ресурса GA4 и повтори запрос.';
      else if (error.code === 'auth/popup-blocked') status.textContent = 'Браузер заблокировал окно Google. Разреши всплывающие окна для сайта.';
      else status.textContent = 'Не удалось загрузить отчёт. Проверь вход Google и подключение.';
    }).then(function () { if (run === revision) submit.disabled = false; });
  };

  window.VMM_ANALYTICS_REPORT = {reset:function () {
    revision++;
    token = '';
    owner = '';
    submit.disabled = false;
    status.textContent = '';
    output.textContent = '';
  }};
}());
