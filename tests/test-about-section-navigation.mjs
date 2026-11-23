// RUN-216: "О проекте" navigation must land at a section with an explicit matching heading.
// Keep Studio's editable about.heading binding intact; do not change site layout.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html=readFileSync('index.html','utf8');
const css=readFileSync('style.css','utf8');
const publicJs=readFileSync('landing-public.js','utf8');
const sw=readFileSync('sw.js','utf8');
assert.match(html, /<a href="#about">О проекте<\/a>/);
assert.match(html, /<section id="about"[^>]*aria-labelledby="about-section-heading"/);
assert.match(html, /<h2 id="about-section-heading">О проекте<\/h2>/);
assert.match(html, /<h3 id="about-title" class="about-brand-heading">VELARDREAM RECORDS<\/h3>/);
assert.match(html, /id="public-about-intro"/);
assert.match(html, /id="public-about-notice"/);
assert.match(publicJs, /assign\('about-title',value\.about\.heading\)/);
assert.match(css, /\.about-section \.section-heading \.about-brand-heading/);
assert.match(html, /style\.css\?v=86&consent=190&clips=1&cms=205&about=216/);
assert.match(sw, /style\.css\?v=86&consent=190&clips=1&cms=205&about=216/);
console.log('RUN-216: About anchor, visible heading, CMS binding and cache version — PASS');
