# RUN-205 · Управление главной страницей

Дата начала · 20.11.2026  
PR · [#196](https://github.com/velardream-ctrl/velar-music-manager/pull/196)  
Рабочая ветка · `feature/playlist-crystal-cms-20261120`  
Исходная версия PR · [d1386db](https://github.com/velardream-ctrl/velar-music-manager/commit/d1386db91958984a37d7c59151106663196716b4)  
Основа выпуска и отката · [679a556](https://github.com/velardream-ctrl/velar-music-manager/commit/679a55642dca3e8e312b2c8a5b4157c50ccea648)

## Изменения

- В Studio → Главная страница вкладка «Плейлисты и подписки» содержит настройки главного Spotify-плейлиста. Отдельная вкладка «Анимация кристалла» содержит подпись, заголовок, описание, кнопку, переключатель и 1–12 переставляемых этапов.
- Главная показывает один экземпляр выбранного Spotify-плейлиста в классическом и компактном режимах. Если главный блок выключен, ранее опубликованная карточка плейлиста сохраняется в общей подборке.
- Прокрутка сцены масштабируется при добавлении и удалении этапов. Сохранены границы переключения для трёх этапов и отдельный путь закрепления сцены на старом iPad. Указатели этапов обновляются сразу после получения новой публикации.
- Для браузера и service worker согласованы версии новых ресурсов. Проверка исходных настроек компактного режима также выявила зависимость от перестановки DOM-узла. Порядок элементов сохранён обычным добавлением узла после селектора.

## Проверки и ограничения

- `npm test` пройден, включая `tests/featured-crystal-schema.test.js`. Отдельный браузерный сценарий использует настоящие страницы Studio и главной с локальной заменой Firestore. В качестве первой публикации используется прежняя схема без двух новых полей.
- Браузерный сценарий проверяет черновик после перезагрузки, возврат к опубликованной версии, публикацию, её публичное отображение и возврат прежних значений второй публикацией. Сценарий запускается в Chromium и WebKit через GitHub Actions. Результаты см. в проверках PR.
- Профили iPhone 11, современного iPad и старого iPad используются для проверки размеров и соответствующих ветвей кода. Физические устройства и движок Safari 12/13 требуют отдельной проверки.
- Spotify в браузерной автоматизации заменён локальным ответом. Проверка охватывает официальный URL, iframe, переключение режима и отсутствие двойной карточки.
- Тестовые записи изолированы от рабочей Firestore. Google-вход и рабочие правила Firestore этим сценарием не проверяются.

## Резерв и откат

- Из `679a55642dca3e8e312b2c8a5b4157c50ccea648` создан ZIP исходников. `unzip -tq` завершился успешно. SHA-256 архива `75276383fbdccdba8436c1f6593f267957426c2a1b806134b1ae8df845f8d9f3`. Тот же снимок можно создать через `git archive --format=zip -o velar-before-run205.zip 679a55642dca3e8e312b2c8a5b4157c50ccea648`.
- Рабочий публичный документ `vmm_public_pages/landing` прочитан без записи. Для выпуска приложения изменение данных и правил Firestore не требуется.
- Если понадобится откат после слияния, открыть PR с обратным коммитом к выпуску RUN-205. Для merge-коммита использовать `git revert -m 1 <merge-sha>`, для squash-коммита — `git revert <squash-sha>`. Проверить развёртывание Pages и загрузку предыдущих ресурсов. Если владелец уже изменил контент, вернуть прежние значения в Studio и отдельно сохранить и опубликовать. Для отмены неопубликованных правок использовать «Вернуть опубликованную версию».
- Статус на момент записи · проверка до выпуска. Для слияния и публикации нужно подтверждение владельца.

## Файлы PR

```text
.github/workflows/verify.yml
docs/RUN205_HOMEPAGE_CMS_RU.md
home-skin.css
index.html
landing-public.js
landing-schema.js
living-art.js
package.json
studio/index.html
studio/landing-editor.js
style.css
sw.js
tests/featured-crystal-browser.cjs
tests/featured-crystal-schema.test.js
tests/test-analytics-tab.mjs
tests/test-artist-photo.mjs
tests/test-consent-followup-and-reports.mjs
tests/test-cross-browser-ui.mjs
tests/test-eager-images.mjs
tests/test-featured-music.mjs
tests/test-image-loading.mjs
tests/test-ipad-compat.mjs
tests/test-landing-schema.mjs
tests/test-living-art.mjs
tests/test-release-radio.mjs
tests/test-rule-audit-jokes.mjs
tests/test-song-catalog-pagination.mjs
tests/test-static.mjs
```
