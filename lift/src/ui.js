// DOM helpers: HUD line, prompt, toasts, panel with tabs, overlay.
import { t } from './strings.js';

const $ = (id) => document.getElementById(id);
export const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
};

export function hud(text) { const h = $('hud'); if (h.textContent !== text) h.textContent = text; }
export function prompt(text) { const p = $('prompt'); if (text) { if (p.textContent !== text) p.textContent = text; p.classList.add('on'); } else p.classList.remove('on'); }
export function toast(text) {
  const box = $('toasts');
  while (box.children.length > 3) box.firstChild.remove();
  const d = el('div', { class: 'toast' }, text); box.append(d); setTimeout(() => d.remove(), 3300);
}
export function localizeButtons() { for (const b of document.querySelectorAll('[data-s]')) b.textContent = t(b.dataset.s); }

export class Panel {
  constructor() { this.root = $('panel'); this.tabs = []; this.cur = null; this.open = false; this.topFn = null; }
  setTabs(tabs, topFn) { this.tabs = tabs; this.topFn = topFn; }
  show(tabId) {
    this.open = true; this.root.classList.remove('hidden');
    const visible = this.tabs.filter((x) => !x.hidden || !x.hidden());
    if (tabId) this.cur = tabId; if (!visible.find((x) => x.id === this.cur)) this.cur = visible[0]?.id;
    this.render();
  }
  hide() { this.open = false; this.root.classList.add('hidden'); if (this.onClose) this.onClose(); }
  render() {
    if (!this.open) return;
    const body = this.root.querySelector('.body');
    const scroll = body ? body.scrollTop : 0;
    const visible = this.tabs.filter((x) => !x.hidden || !x.hidden());
    const header = el('header', {}, visible.map((tb) => el('button', { class: 'tab' + (tb.id === this.cur ? ' on' : ''), onclick: () => { this.cur = tb.id; this.render(); } }, tb.label())),
      el('button', { class: 'x', onclick: () => this.hide(), 'aria-label': t('close') }, '×'));
    const top = el('div', { class: 'top' }); if (this.topFn) this.topFn(top);
    const nb = el('div', { class: 'body' });
    const tab = visible.find((x) => x.id === this.cur);
    if (tab) tab.render(nb, () => this.render());
    this.root.replaceChildren(header, top, nb);
    nb.scrollTop = scroll;
  }
  // light refresh: re-render only when numbers changed
  refresh() { if (this.open) this.render(); }
}

export function overlay(content) {
  const o = $('overlay');
  if (!content) { o.classList.add('hidden'); o.replaceChildren(); return; }
  o.classList.remove('hidden'); o.replaceChildren(content);
}
