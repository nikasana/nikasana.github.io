import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STRINGS, t, setLang, detectLang } from '../src/strings.js';
import { AUTHOR_NOTES } from '../src/longgame.js';

const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('Russian covers every English string, with the same placeholders', () => {
  const en = STRINGS.en, ru = STRINGS.ru;
  const missing = Object.keys(en).filter((k) => !(k in ru));
  assert.deepEqual(missing, [], 'untranslated keys');
  const extra = Object.keys(ru).filter((k) => !(k in en));
  assert.deepEqual(extra, [], 'keys only in Russian');
  for (const k of Object.keys(en)) assert.equal(ph(ru[k]), ph(en[k]), `placeholders differ in ${k}`);
  for (const k of Object.keys(en)) if (en[k].trim() && !/^[{}\s✦+×·/%\d\w-]*$/.test(en[k]) && !['title'].includes(k) && !k.startsWith('lang_')) assert.notEqual(ru[k], en[k], `${k} looks untranslated`);
});

test('English is still complete; the language switch works with a fallback', () => {
  for (const [k, v] of Object.entries(STRINGS.en)) assert.ok(typeof v === 'string' && v.length, k);
  setLang('ru'); assert.equal(t('tabDiary'), 'Дневник');
  setLang('de'); assert.equal(t('tabDiary'), 'Diary', 'unknown language falls back to English');
  setLang('en');
  assert.equal(detectLang(['ru-RU', 'en']), 'ru'); assert.equal(detectLang(['fr-FR']), 'en'); assert.equal(detectLang([]), 'en');
});

test('author’s notes exist in both languages for every biome', () => {
  for (const lang of ['en', 'ru']) for (const b of Object.keys(AUTHOR_NOTES.en)) assert.ok(AUTHOR_NOTES[lang][b], `${lang} ${b}`);
});

test('no user-facing text is hard-coded outside the strings tables', () => {
  const src = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src');
  const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
  const bad = [];
  for (const f of files(src)) {
    if (/strings(_ru)?\.js$/.test(f)) continue;
    const code = fs.readFileSync(f, 'utf8');
    // toasts, prompts, HUD and button labels must go through t()
    for (const m of code.matchAll(/(?:toast|prompt|hud)\(\s*'([^']*[A-Za-z]{3}[^']*)'/g)) bad.push(`${path.basename(f)}: ${m[1]}`);
    for (const m of code.matchAll(/el\('(?:button|h3|p|div|span|label)',\s*\{[^}]*\},\s*'([A-Za-z][^']{2,})'/g)) bad.push(`${path.basename(f)}: ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
