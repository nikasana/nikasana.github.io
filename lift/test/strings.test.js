import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { STRINGS } from '../src/strings.js';

const src = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src');
function files(d) { return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : [])); }

test('every literal string key used with t() exists in the English table', () => {
  const missing = new Set();
  for (const f of files(src)) {
    const code = fs.readFileSync(f, 'utf8');
    for (const m of code.matchAll(/\bt\('([a-zA-Z0-9_]+)'\s*[,)]/g)) if (!(m[1] in STRINGS.en)) missing.add(`${m[1]} (${path.basename(f)})`);
  }
  assert.deepEqual([...missing], []);
});
