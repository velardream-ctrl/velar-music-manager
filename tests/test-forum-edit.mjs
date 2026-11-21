import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const load = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const html = load('forum/index.html');
const js = load('forum/forum.js');
const css = load('forum/forum.css');
const rules = load('firestore.rules');

assert.doesNotMatch(html, /<a\s+href="\/contacts\/"[^>]*>Контакты<\/a>/,
  'The forum header must not include the Contacts link');
assert.match(html, /На главную сайта/, 'The home navigation stays available');
assert.match(html, /class="masthead forum-public-header"/, 'Public header has independent two-row layout');
assert.match(html, /class="forum-session-actions"/);
assert.match(html, /class="forum-primary-actions"/);
assert.match(html, /class="forum-home-link"/);
assert.match(css, /\.forum-public-header\s*\{[\s\S]*?display:grid;/);
assert.match(css, /\.forum-primary-actions\s*\{[\s\S]*?justify-content:space-between;/);
assert.doesNotMatch(css, /Landscape phones and compact tablets: brand on top/, 'Legacy landscape layout removed');
assert.match(html, /id="edit-dialog"/);
assert.match(html, /id="edit-topic"/);
assert.match(html, /id="edit-form"/);
assert.match(js, /function canEditPost\(post\)/);
assert.match(js, /post\.uid === user\.uid/, 'Edit controls must be author-only');
assert.match(js, /editForm\.onsubmit = event =>/);
assert.match(js, /collection\('replies'\)\.doc\(target\.id\)/);
assert.match(js, /editedAt:postStamp\(\)/, 'Write a server timestamp on edits');
assert.match(css, /\.post-actions/);
assert.match(rules, /resource\.data\.uid == request\.auth\.uid/);
assert.match(rules, /!exists\(\/databases\/\$\(database\)\/documents\/velar_forum_bans/);
assert.match(rules, /changes\.hasOnly\(isTopic \? \['body', 'title', 'editedAt'\] : \['body', 'editedAt'\]\)/);
assert.match(rules, /changes\.hasAny\(isTopic \? \['body', 'title'\] : \['body'\]\)/);
assert.match(rules, /request\.resource\.data\.editedAt == request\.time/);
assert.match(rules, /allow update: if forumModeration\(\) \|\| forumAuthorEdit\(3000, true\);/);
assert.match(rules, /allow update: if forumModeration\(\) \|\| forumAuthorEdit\(2000, false\);/);
assert.match(rules, /allow delete: if false;/, 'Original moderation protection must remain');
console.log('Forum header and secure author-edit checks passed.');
