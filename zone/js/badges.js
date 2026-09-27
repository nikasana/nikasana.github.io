'use strict';
// ---------- badges: a filled circle with the number of things you can do right now on every Bunker tab ----------
const Badges = {
  counts() {
    const S = Save.data, R = S.rubles, n = {};
    n.up = META.filter((m) => { const lv = Save.meta(m.id); return R >= (lv < m.max ? metaCost(m, lv) : typeof metaTierCost === 'function' ? metaTierCost(m, lv) : 1e18); }).length;
    n.fac = SUITS.filter((s) => !S.suits.includes(s.id) && (!s.fac || repTier(s.fac) >= s.tier) && R >= s.cost).length;
    n.res = RESEARCH.filter((r) => !S.research.includes(r.id) && (!r.needs || S.research.includes(r.needs)) && R >= r.cost).length + MUTATIONS2.filter((m) => !S.mutations.includes(m.id) && R >= m.cost).length;
    n.sk = SKILLS.some((s) => (S.skills[s.id] || 0) < 5) ? S.sp || 0 : 0;
    if (typeof CZ !== 'undefined') { const c = CZ.st(); n.rou = (CZ.freeCount ? CZ.freeCount() : 0) + (CZ.chestLeft && !CZ.chestLeft() ? 1 : 0) + (c.cb && c.cb.day === Meta.dayKey() && c.cb.net >= 20 ? 1 : 0); }
    if (typeof Cyberware !== 'undefined') { const d = Cyberware.d(); let k = 0; for (const [a] of CW_ATTRS) { const lv = d.lv[a] || 0; if (lv < CW_MAXLV && R >= Cyberware.lvCost(lv)) k++; for (const nd of CW[a]) { const r = d.r[nd.id] || 0; if (r < nd.max && Cyberware.open(nd) && R >= Cyberware.cost(nd, r)) k++; } } n.cw = k; }
    if (typeof SUPPLIES !== 'undefined') { S.supplies = S.supplies || {}; n.mkt = SUPPLIES.filter((x) => (S.supplies[x[0]] || 0) < 5 && R >= x[4]).length; }
    if (typeof Mastery !== 'undefined') { const m = Mastery.d(); n.mast = MASTERY.filter(([id]) => m.pts >= Mastery.cost(m.ranks[id] || 0)).length; }
    if (typeof Missions !== 'undefined') n.ms = Missions.ready();
    return n;
  },
  paint() {
    const n = this.counts(); let tot = 0;
    for (const [k, v] of Object.entries(n)) {
      tot += v; const tab = document.querySelector(`#bTabs [data-bt="${k}"], #bTabs [data-bt2="${k}"]`); if (!tab) continue;
      let i = tab.querySelector('.tabBadge'); if (!i) { i = document.createElement('i'); i.className = 'tabBadge'; tab.appendChild(i); }
      i.textContent = v > 99 ? '99+' : v; i.style.display = v ? '' : 'none';
    }
    const bb = $('bunkerBtn'); if (bb) { let i = bb.querySelector('.tabBadge'); if (!i) { i = document.createElement('i'); i.className = 'tabBadge'; bb.appendChild(i); } i.textContent = tot > 99 ? '99+' : tot; i.style.display = tot ? '' : 'none'; }
  },
};
addEventListener('DOMContentLoaded', () => {
  const _bb = buildBunker; buildBunker = function (...a) { const r = _bb(...a); Badges.paint(); return r; };
  const _tm = toMenu; toMenu = function (...a) { const r = _tm(...a); setTimeout(() => Badges.paint(), 0); return r; };
  // keep counts live (rubles change from buys, casino, claims)
  setInterval(() => { if (($('bunker') && $('bunker').classList.contains('show')) || ($('title') && $('title').classList.contains('show'))) Badges.paint(); }, 1500);
  Badges.paint();
});
