'use strict';
// ---------- cyberpunk upgrade maps: the Bunker's upgrade screens become neon circuit trees ----------
// Nodes sit in branches (columns); glowing traces link each node to the next one in its branch.
const Cyber = {
  sel: '#metaList, #bunker2 .grid, #bunker2 .tree',
  node: '.meta, .pick, .tnode',
  lit(n) { return n.classList.contains('sel') || n.classList.contains('done') || n.classList.contains('open') || !!n.querySelector('.pips i.on'); },
  draw(box) {
    const nodes = [...box.querySelectorAll(':scope > ' + this.node.split(', ').join(', :scope > '))];
    if (nodes.length < 2) return;
    box.classList.add('cyberMap');
    let svg = box.querySelector(':scope > svg.cyberLinks');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'cyberLinks'); box.prepend(svg); }
    const B = box.getBoundingClientRect(); if (!B.width) return;
    svg.setAttribute('viewBox', `0 0 ${B.width} ${B.height}`); svg.style.width = B.width + 'px'; svg.style.height = B.height + 'px';
    const R = nodes.map((n) => { const r = n.getBoundingClientRect(); return { x: r.left - B.left, y: r.top - B.top, w: r.width, h: r.height, lit: this.lit(n) }; });
    const cols = Math.max(1, new Set(R.map((r) => Math.round(r.x))).size);
    let h = '';
    // the power bus along the top, feeding every branch
    const top = Math.max(2, R[0].y - 10);
    h += `<line x1="${R[0].x + R[0].w / 2}" y1="${top}" x2="${R[Math.min(cols, R.length) - 1].x + R[Math.min(cols, R.length) - 1].w / 2}" y2="${top}" class="trace on"/>`;
    for (let i = 0; i < Math.min(cols, R.length); i++) h += `<line x1="${R[i].x + R[i].w / 2}" y1="${top}" x2="${R[i].x + R[i].w / 2}" y2="${R[i].y}" class="trace on"/>`;
    // each node feeds the next node down its branch; the trace glows once the upper node is bought
    for (let i = 0; i + cols < R.length; i++) {
      const a = R[i], b = R[i + cols], x = a.x + a.w / 2, y1 = a.y + a.h, y2 = b.y, mid = (y1 + y2) / 2, bx = b.x + b.w / 2;
      h += `<polyline points="${x},${y1} ${x},${mid} ${bx},${mid} ${bx},${y2}" class="trace ${a.lit ? 'on' : ''}"/>`;
      h += `<circle cx="${x}" cy="${y1}" r="3" class="joint ${a.lit ? 'on' : ''}"/>`;
    }
    svg.innerHTML = h;
  },
  all() { if (!$('bunker') || !$('bunker').classList.contains('show')) return; for (const b of document.querySelectorAll(this.sel)) this.draw(b); },
  soon() { clearTimeout(this.t); this.t = setTimeout(() => this.all(), 30); },
};
addEventListener('DOMContentLoaded', () => {
  const bk = $('bunker'); if (!bk) return;
  bk.classList.add('cyber');
  new MutationObserver((ms) => { if (ms.some((m) => !(m.target.closest && m.target.closest('svg')))) Cyber.soon(); }).observe(bk, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  addEventListener('resize', () => Cyber.soon());
});
