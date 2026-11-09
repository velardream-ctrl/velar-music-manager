/* VELARDREAM private VMM import. No personal content embedded in this PUBLIC source.
 * File bytes are read in the browser and sent only to the owner's authorized Firestore.
 * Data is not cached by the public service worker or stored in localStorage. */
(function () {
  'use strict';
  var collections = ['vmm_lyrics', 'vmm_catalog', 'vmm_links', 'vmm_audit'];
  var labels = {vmm_lyrics:'Тексты',vmm_catalog:'Каталог',vmm_links:'Предложения ссылок',vmm_audit:'Журнал'};
  var selectedPackage = null;
  var busy = false;
  var listing = {};
  function el(id) { return document.getElementById(id); }
  function status(s) { el('import-status').textContent = s; }
  function setText(node, s) { node.textContent = s || ''; }
  function field(o, key) { return String(o[key] == null ? '' : o[key]); }
  function ensureAdmin(callback) {
    if (!window.firebase || !firebase.apps || !firebase.apps.length) {
      callback(new Error('Библиотека Firebase ещё не загружена. Обнови страницу.')); return;
    }
    var u = firebase.auth().currentUser;
    if (!u || !u.emailVerified || !u.providerData.some(function (p) { return p.providerId === 'google.com'; })) {
      callback(new Error('Войди через подтверждённый Google-аккаунт.')); return;
    }
    var db = firebase.firestore();
    db.collection('vmm_admins').doc(u.uid).get({source:'server'}).then(function (doc) {
      if (!doc.exists || !doc.data() || doc.data().enabled !== true) throw new Error('Нет прав администратора.');
      callback(null, db, u);
    }).catch(function (err) { callback(err); });
  }
  function validate(input) {
    if (!input || input.format !== 'velardream-vmm-private-import-v1') throw new Error('Неверный формат файла VMM.');
    if (!input.collections || !input.counts) throw new Error('В файле отсутствуют сведения о коллекциях.');
    var result = [], total = 0, summary = [];
    collections.forEach(function (name) {
      var items = input.collections[name], declared = input.counts[name];
      if (!Array.isArray(items) || !Number.isInteger(declared) || items.length !== declared) throw new Error('Число записей не совпадает: ' + name);
      var seen = Object.create(null);
      items.forEach(function (item) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Неверная запись в ' + name);
        var id = item.id;
        if (typeof id !== 'string' || !/^[\w-]{1,130}$/.test(id) || seen[id]) throw new Error('Неверный или повторный ID в ' + name);
        seen[id] = true;
        if (JSON.stringify(item).length > 700000) throw new Error('Слишком большой документ: ' + id);
        if (name === 'vmm_lyrics' && (typeof item.text !== 'string' || typeof item.title !== 'string')) throw new Error('Неполный текст песни: ' + id);
        result.push({collection:name,id:id,content:item});
      });
      total += items.length;
      summary.push(labels[name] + ': ' + items.length);
    });
    if (total === 0) throw new Error('Файл не содержит записей.');
    return {items:result,summary:summary.join(' · '),total:total};
  }
  function inspect() {
    if (busy) return;
    var picker = el('import-file');
    var file = picker && picker.files && picker.files[0];
    selectedPackage = null;
    el('execute-import').disabled = true;
    if (!file) { status('Выбери файл VELARDREAM_PRIVATE_IMPORT_2026-11-09.json.'); return; }
    if (file.size > 8 * 1024 * 1024) { status('Файл слишком большой.'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var packageData = JSON.parse(reader.result);
        var checked = validate(packageData);
        selectedPackage = checked;
        status('Файл проверен: ' + checked.total + ' записей. ' + checked.summary + '. Данные ещё НЕ отправлены в базу.');
        el('execute-import').disabled = !el('import-confirm').checked;
      } catch (e) { status('Ошибка проверки: ' + e.message); }
    };
    reader.onerror = function () { status('Не удалось прочитать файл на устройстве.'); };
    reader.readAsText(file, 'UTF-8');
  }
  function runImport() {
    if (!selectedPackage || busy) return;
    if (!el('import-confirm').checked) { status('Сначала подтверди перенос данных.'); return; }
    if (!navigator.onLine) { status('Для первого переноса необходим интернет.'); return; }
    busy = true;
    el('execute-import').disabled = true;
    el('inspect-import').disabled = true;
    ensureAdmin(function (err, db, user) {
      if (err) return finish('Импорт не начат: ' + err.message);
      status('Проверяем базу на существующие документы…');
      var missing = [], already = 0, index = 0;
      function preflight() {
        if (index === collections.length) {
          var prompt = 'Новые записи: ' + missing.length + '. Уже существуют (будут пропущены): ' + already + '. Продолжить перенос в защищённую Firestore?';
          if (!window.confirm(prompt)) return finish('Импорт отменён. Данные не изменены.');
          return writeBatch(0);
        }
        var name = collections[index++];
        db.collection(name).get({source:'server'}).then(function (snapshot) {
          var existing = Object.create(null);
          snapshot.forEach(function (doc) { existing[doc.id] = true; });
          selectedPackage.items.forEach(function (row) {
            if (row.collection !== name) return;
            if (existing[row.id]) already++; else missing.push(row);
          });
          preflight();
        }).catch(function (error) { finish('Проверка прервана, запись не начата: ' + error.message); });
      }
      function writeBatch(start) {
        if (start >= missing.length) return verify();
        if (!navigator.onLine) return finish('Интернет пропал. Уже записанные документы сохранены. Повтори импорт позже: существующие будут пропущены.');
        var batch = db.batch();
        var end = Math.min(start + 175, missing.length);
        for (var i = start; i < end; i++) {
          var item = missing[i];
          var data = {};
          Object.keys(item.content).forEach(function (key) { data[key] = item.content[key]; });
          data.migratedAt = firebase.firestore.FieldValue.serverTimestamp();
          data.migrationSource = 'VELAR_VMM_SOURCE_BACKUP_2026-11-09_READ_ONLY_COPY';
          batch.set(db.collection(item.collection).doc(item.id), data);
        }
        batch.commit().then(function () {
          status('Перенесено новых записей: ' + end + '/' + missing.length + '. Уже существовали: ' + already + '.');
          writeBatch(end);
        }).catch(function (error) { finish('Ошибка на записи ' + (start+1) + ': ' + error.message + '. Уже созданные документы сохраняются; можно повторить импорт без дублей.'); });
      }
      function verify() {
        var k = 0, counts = {};
        function next() {
          if (k === collections.length) {
            var report = collections.map(function (name) { return labels[name] + ' ' + counts[name]; }).join(' · ');
            selectedPackage = null;
            return finish('Импорт завершён. Проверено в Firestore: ' + report + '. Нажми «Обновить кабинет», чтобы увидеть данные.');
          }
          var name = collections[k++];
          db.collection(name).get({source:'server'}).then(function (s) { counts[name] = s.size; next(); }).catch(function (error) {
            finish('Запись закончена, но проверка количества не удалась: ' + error.message + '. Не удаляй исходный файл.');
          });
        }
        next();
      }
      preflight();
    });
  }
  function finish(s) {
    busy = false;
    el('inspect-import').disabled = false;
    el('execute-import').disabled = !selectedPackage || !el('import-confirm').checked;
    status(s);
  }
  function renderRecords(kind) {
    var box = el('records-browser');
    var head = el('records-browser-title');
    var list = el('records-list');
    var detail = el('records-detail');
    var filter = el('records-filter');
    var dataset = listing[kind] || [];
    setText(head, labels[kind] || 'Список');
    setText(detail, '');
    list.textContent = '';
    var search = String(filter.value || '').toLowerCase();
    var shown = 0;
    dataset.forEach(function (rec) {
      var text = kind === 'vmm_catalog' ? [rec.title,rec.artist,rec.upc].join(' ') :
        kind === 'vmm_links' ? [rec.title,rec.platform,rec.url].join(' ') :
        [rec.time,rec.operation,rec.subject,rec.result].join(' ');
      if (text.toLowerCase().indexOf(search) < 0 || shown >= 90) return;
      shown++;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'record-row';
      var title = document.createElement('strong');
      title.textContent = kind === 'vmm_catalog' ? rec.title : kind === 'vmm_links' ? rec.title : rec.operation;
      b.appendChild(title);
      var sub = document.createElement('small');
      sub.textContent = kind === 'vmm_catalog' ? rec.artist + ' · ' + rec.upc : kind === 'vmm_links' ? rec.platform + ' · ' + rec.status : rec.time;
      b.appendChild(sub);
      b.onclick = function () {
        if (kind === 'vmm_catalog') {
          detail.textContent = 'Композиция: ' + field(rec, 'title') + '\nИсполнитель: ' + field(rec, 'artist') + '\nАльбом: ' + field(rec, 'album') + '\nUPC: ' + field(rec, 'upc') + '\nISRC: ' + field(rec, 'isrc') + '\nСтатус: ' + field(rec, 'releaseStatus') + '\nSpotify: ' + field(rec.links || {}, 'spotify') + '\nApple Music: ' + field(rec.links || {}, 'appleMusic') + '\nYouTube: ' + field(rec.links || {}, 'youtube') + '\nЯндекс: ' + field(rec.links || {}, 'yandex') + '\nЗвук: ' + field(rec.links || {}, 'zvuk');
        } else if (kind === 'vmm_links') {
          detail.textContent = 'Название: ' + field(rec, 'title') + '\nПлатформа: ' + field(rec, 'platform') + '\nURL: ' + field(rec, 'url') + '\nСтатус: ' + field(rec, 'status') + '\nИсточник: ' + field(rec, 'source');
        } else {
          detail.textContent = 'Время: ' + field(rec, 'time') + '\nОперация: ' + field(rec, 'operation') + '\nОбъект: ' + field(rec, 'subject') + '\nРезультат: ' + field(rec, 'result');
        }
      };
      list.appendChild(b);
    });
    if (!shown) setText(list, dataset.length ? 'Ничего не найдено.' : 'Здесь пока нет записей.');
    setText(el('records-count'), 'Всего: ' + dataset.length + '. Показано: ' + shown + (shown >= 90 ? ' (уточни поиск)' : ''));
    box.className = 'records-browser';
  }
  function openKind(panel) {
    var names = {catalog:'vmm_catalog',platforms:'vmm_links',audit:'vmm_audit'};
    var kind = names[panel];
    var box = el('records-browser');
    if (!kind) { box.className = 'records-browser hidden'; return; }
    el('future-message').textContent = 'Данные читаются из закрытой Firestore после подтверждения прав.';
    el('records-filter').value = '';
    box.className = 'records-browser';
    setText(el('records-count'), 'Загружаем записи…');
    if (listing[kind]) return renderRecords(kind);
    ensureAdmin(function (err, db) {
      if (err) { setText(el('records-count'), 'Доступ запрещён: ' + err.message); return; }
      db.collection(kind).limit(1000).get().then(function (snapshot) {
        var items = [];
        snapshot.forEach(function (doc) { var d = doc.data(); d.id = doc.id; items.push(d); });
        listing[kind] = items;
        renderRecords(kind);
      }).catch(function (error) { setText(el('records-count'), 'Не удалось прочитать записи: ' + error.message); });
    });
  }
  el('inspect-import').onclick = inspect;
  el('execute-import').onclick = runImport;
  el('import-confirm').onchange = function () { el('execute-import').disabled = !selectedPackage || !this.checked || busy; };
  el('import-file').onchange = function () { selectedPackage=null;el('execute-import').disabled=true;status('Нажми «Проверить файл», чтобы просмотреть количество записей.'); };
  el('refresh-studio').onclick = function () { window.location.reload(); };
  var nav = document.querySelectorAll('[data-panel]');
  for (var i = 0; i < nav.length; i++) {
    nav[i].addEventListener('click', function () { openKind(this.getAttribute('data-panel')); });
  }
  el('records-filter').oninput = function () {
    var active = document.querySelector('.sidebar .nav-active');
    if (active) {
      var panel = active.getAttribute('data-panel');
      var kind = {catalog:'vmm_catalog',platforms:'vmm_links',audit:'vmm_audit'}[panel];
      if (kind && listing[kind]) renderRecords(kind);
    }
  };
  status('Выбери личный JSON-файл экспорта, затем проверь содержимое перед загрузкой.');
}());
