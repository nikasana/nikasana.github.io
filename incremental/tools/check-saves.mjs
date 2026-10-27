#!/usr/bin/env node
// Save compatibility: every save kept in tools/saves/ must load with the current build.
// Loads each fixture through the game's own save module (migrations included) and checks the
// economy rebuilds and its stats compute without errors or lost progress.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importCode, migrate, econFromJSON, SAVE_VERSION } from '../src/save/save.js';
import * as M from '../src/econ/model.js';
import { NODE_BY_ID } from '../src/econ/data/nodes.js';

const dir = join(dirname(fileURLToPath(import.meta.url)), 'saves');
let fails = 0;
const files = readdirSync(dir).filter((f) => f.endsWith('.json') || f.endsWith('.code.txt')).sort();
for (const f of files) {
  try {
    const raw = readFileSync(join(dir, f), 'utf8');
    const data = f.endsWith('.json') ? migrate(JSON.parse(raw)) : await importCode(raw);
    const e = econFromJSON(data.econ);
    const fresh = M.createEcon(e.planet, e.pole);
    for (const k of Object.keys(fresh)) if (e[k] === undefined) e[k] = fresh[k];
    const st = M.computeStats(e);
    const r = M.rates(e, st);
    for (const id of Object.keys(e.levels)) if (!NODE_BY_ID[id]) throw new Error(`unknown node ${id}`);
    if (!Number.isFinite(r.income)) throw new Error('income is not finite');
    if (!data.world || typeof data.world.hm !== 'string') throw new Error('missing crater heightmap');
    console.log(`PASS  ${f}  v${data.v}→${SAVE_VERSION}  planet ${e.planet} ${e.pole}  coins ${e.coins.toString()}  purchases ${e.purchases}  depth ${e.depth.toFixed(1)} m`);
  } catch (err) {
    fails++;
    console.log(`FAIL  ${f}  ${err.message}`);
  }
}
if (!files.length) { console.log('No saves found.'); fails++; }
process.exitCode = fails ? 1 : 0;
