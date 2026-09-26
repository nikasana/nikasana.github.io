'use strict';
// ---------- safety net: a bug in one system skips that system for a frame instead of freezing the whole game ----------
const GUARD = { seen: new Map(), toastT: 0 };
function guardReport(name, e) {
  const k = name + ': ' + (e && e.message);
  const n = (GUARD.seen.get(k) || 0) + 1; GUARD.seen.set(k, n);
  if (n === 1) console.error('[ZONEBONK] caught in ' + name, e);
  if (n === 1) GUARD.stacks = (GUARD.stacks || []).concat([k + ' @ ' + String(e && e.stack).split('\n').slice(1, 5).join(' / ')]);
  if (n === 1 && typeof NOW !== 'undefined' && NOW - GUARD.toastT > 10) {
    GUARD.toastT = NOW;
    let el = document.getElementById('glitch'); if (!el) { el = document.createElement('div'); el.id = 'glitch'; document.body.appendChild(el); }
    el.textContent = '⚠️ A glitch was caught and skipped (' + name + '). The game keeps running.';
    el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 4000);
  }
}
function guard(name, fn, onErr) {
  if (typeof fn !== 'function' || fn._guarded) return fn;
  const g = function () { try { return fn.apply(this, arguments); } catch (e) { guardReport(name, e); if (onErr) try { onErr(e); } catch (e2) { /* ignore */ } } };
  g._guarded = true; return g;
}
// systems (global functions)
for (const n of ['director', 'updateEmission', 'updateEnemies', 'updateAnomalies', 'updateWeapons', 'updateBullets', 'updatePickups', 'updateOwned', 'updateFx', 'updatePlayer',
  'drawOwned', 'drawEventWorld', 'drawHazardsGround', 'drawHazardsTop', 'drawW2Base', 'drawW2Top', 'drawW2Screen', 'drawStory', 'drawPartner', 'drawVehPrompt', 'drawFx', 'drawPlayerFx']) {
  try { const f = (0, eval)(n); if (typeof f === 'function') (0, eval)(n + ' = guard("' + n + '", ' + n + ')'); } catch (e) { /* not defined in this build */ }
}
// systems (objects)
Events.update = guard('Events', Events.update.bind(Events), () => { Events.cur = null; });
for (const [o, n] of [[Hz, 'Hz'], [W2, 'W2'], [Story, 'Story'], [Coop, 'Coop'], [Quests, 'Quests'], [Radio, 'Radio'], [Hints, 'Hints'], [Amb, 'Amb'], [Env, 'Env'], [RunSave, 'RunSave']]) {
  const k = n === 'RunSave' ? 'tick' : 'update'; if (o[k]) o[k] = guard(n, o[k].bind(o));
}
Env.render = guard('Env.render', Env.render.bind(Env));
// events that cannot run right now are skipped instead of half-starting
const _gStart = Events.start.bind(Events);
Events.start = function (id) {
  const E = EVENTS[id]; if (!E) return;
  if (E.can) { let ok = false; try { ok = E.can(); } catch (e) { ok = false; } if (!ok) return; }
  try { _gStart(id); } catch (e) { guardReport('event ' + id, e); this.cur = null; }
};
