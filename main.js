(function () {
  'use strict';
  var status = document.getElementById('connectionStatus');
  var year = document.getElementById('currentYear');
  if (year) year.textContent = String(new Date().getFullYear());
  function updateConnection() {
    if (!status) return;
    var offline = navigator.onLine === false;
    status.className = 'connection' + (offline ? ' offline' : '');
    status.textContent = offline ? 'Офлайн · сохранённая страница доступна' : 'Соединение доступно';
  }
  updateConnection();
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  // Only public shell assets are cached. Private data will require a separate authenticated store.
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        // The landing page still works online when service workers are unavailable.
      });
    });
  }
}());
