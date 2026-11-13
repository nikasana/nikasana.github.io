// Signs (abstract symbols with an arrow, painted on polished floors), Anchors, sprouts, soap strips, pings.
import * as THREE from 'three';
import { CFG, roomSide, doorWidth } from '../config.js';
import * as Game from '../game.js';
import * as Signs from '../signs.js';

const texCache = {};
// Abstract symbols only: no eyes, faces, people, cameras, digits or letters.
function signTexture(symbol) {
  if (texCache[symbol]) return texCache[symbol];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 6; x.lineCap = 'round';
  const cx = 52, cy = 64;
  switch (symbol) {
    case 'rings': for (const r of [10, 22, 34]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); } break;
    case 'triangle': x.beginPath(); x.moveTo(cx, cy - 32); x.lineTo(cx + 30, cy + 22); x.lineTo(cx - 30, cy + 22); x.closePath(); x.stroke(); break;
    case 'diamond': x.beginPath(); x.moveTo(cx, cy - 34); x.lineTo(cx + 26, cy); x.lineTo(cx, cy + 34); x.lineTo(cx - 26, cy); x.closePath(); x.stroke(); x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill(); break;
    case 'wave': x.beginPath(); for (let i = 0; i <= 60; i++) { const px = cx - 32 + i * 64 / 60; x.lineTo(px, cy + Math.sin(i / 60 * Math.PI * 3) * 14); } x.stroke(); break;
    case 'spiral': x.beginPath(); for (let i = 0; i < 120; i++) { const a = i * 0.16, r = 2 + i * 0.28; x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.stroke(); break;
    case 'cross': x.beginPath(); x.moveTo(cx - 26, cy); x.lineTo(cx + 26, cy); x.moveTo(cx, cy - 26); x.lineTo(cx, cy + 26); x.stroke(); x.beginPath(); x.arc(cx, cy, 34, 0, 7); x.stroke(); break;
    case 'dots': for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(cx + Math.cos(i * 1.047) * 24, cy + Math.sin(i * 1.047) * 24, 6, 0, 7); x.fill(); } break;
    default: x.beginPath(); x.arc(cx, cy + 14, 30, Math.PI, 0); x.stroke(); x.beginPath(); x.arc(cx, cy + 14, 14, Math.PI, 0); x.stroke();
  }
  // the arrow, pointing along +x
  x.beginPath(); x.moveTo(92, 64); x.lineTo(124, 64); x.stroke();
  x.beginPath(); x.moveTo(126, 64); x.lineTo(110, 52); x.lineTo(110, 76); x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); texCache[symbol] = t; return t;
}

const ANCHOR_COLORS = { clock: 0xffd27a, notebook: 0xa8d8ff, coin: 0xffe08a, phone: 0xc8b0ff, mirror: 0xd8f0ff, window: 0xfff0c0 };
function anchorMesh(kind) {
  const g = new THREE.Group(), glow = (c) => new THREE.MeshBasicMaterial({ color: c });
  const col = ANCHOR_COLORS[kind];
  switch (kind) {
    case 'clock': { const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 24), glow(col)); g.add(r); const h = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.02), glow(0xffffff)); h.position.y = 0.06; g.add(h); break; }
    case 'notebook': g.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.06), glow(col))); break;
    case 'coin': { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 24), glow(col)); c.rotation.x = Math.PI / 2; g.add(c); break; }
    case 'phone': g.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.04), glow(col))); break;
    case 'mirror': g.add(new THREE.Mesh(new THREE.CircleGeometry(0.22, 28), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }))); break;
    default: { const f = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 4, 4), glow(col)); f.rotation.z = Math.PI / 4; g.add(f); const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), glow(col)); g.add(b); const b2 = b.clone(); b2.rotation.z = Math.PI / 2; g.add(b2); }
  }
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  pillar.position.y = 2.2; g.add(pillar);
  return g;
}

export class SignFX {
  constructor(world) { this.world = world; this.t = 0; this.pings = []; }
  // (Re)build the sign/anchor/sprout decorations of a room view.
  refresh(view, s, opts) {
    const info = view.info, f = info.floor, S = info.side, G = CFG.grid, cell = S / G;
    const sg = Signs.visibleSign(s, f, info.x, info.z, opts);
    const want = sg ? `${sg.symbol}:${sg.state}` : null;
    if (view.signKey !== want) {
      if (view.signMesh) { view.group.remove(view.signMesh); view.signMesh.material.dispose(); view.signMesh = null; }
      view.signKey = want; view.sign = sg;
      if (sg) {
        const sz = Math.min(1.6, 1.15 * Math.sqrt(S / 8));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: signTexture(sg.symbol), transparent: true, depthWrite: false,
          color: sg.state === 'true' ? 0xff9a2a : 0x5a4fb8, opacity: 0.92 }));
        m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, -sg.angle, 0);
        const i = sg.cell % G, j = (sg.cell / G) | 0;
        m.position.set(-S / 2 + (i + 0.5) * cell, 0.025, -S / 2 + (j + 0.5) * cell);
        m.renderOrder = 3; view.group.add(m); view.signMesh = m;
      }
    }
    const a = Signs.anchorHere(s, f, info.x, info.z);
    const aw = a && !a.buried ? a.kind : null;
    if (view.anchorKey !== aw) {
      if (view.anchorMesh) { view.group.remove(view.anchorMesh); view.anchorMesh = null; }
      view.anchorKey = aw;
      if (aw) { const m = anchorMesh(aw); const i = a.cell % G, j = (a.cell / G) | 0; m.position.set(-S / 2 + (i + 0.5) * cell, 0.9, -S / 2 + (j + 0.5) * cell); view.group.add(m); view.anchorMesh = m; view.anchor = a; }
    }
    const r = view.room;
    if (!!r.flags.sprout !== !!view.sproutMesh) {
      if (view.sproutMesh) { view.group.remove(view.sproutMesh); view.sproutMesh = null; }
      else {
        const g = new THREE.Group(); const leaf = new THREE.MeshBasicMaterial({ color: 0x8fd070 });
        for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), leaf); l.position.set(Math.cos(k * 1.3) * 0.1, 0.12 + k * 0.05, Math.sin(k * 1.3) * 0.1); g.add(l); }
        g.position.set(S / 2 - 0.8, 0, S / 2 - 0.8); view.group.add(g); view.sproutMesh = g;
      }
    }
    view.tempLight = r.flags.glowT > 0;
  }
  // Soap strips lie in their doorways; pings are pillars of light.
  update(dt, s) {
    this.t += dt;
    for (const v of this.world.views.values()) {
      if (v.anchorMesh) { v.anchorMesh.children[0].rotation.y = this.t; v.anchorMesh.position.y = 0.9 + Math.sin(this.t * 1.5) * 0.08; }
      if (v.signMesh && v.sign && v.sign.state === 'true') v.signMesh.material.color.setRGB(1, 0.55 + 0.15 * Math.sin(this.t * 2), 0.15);
      if (v.tempLight && !v.glowMesh) { v.glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xa0ffb0 })); v.glowMesh.position.set(0.4, 0.1, 0.3); v.group.add(v.glowMesh); }
      if (!v.tempLight && v.glowMesh) { v.group.remove(v.glowMesh); v.glowMesh = null; }
    }
    const S = roomSide(this.world.floor);
    this.soap ||= [];
    const want = s.soap ? [...s.soap] : [];
    while (this.soap.length < want.length) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.5), new THREE.MeshBasicMaterial({ color: 0xf0fbff, transparent: true, opacity: 0.8 })); this.world.scene.add(m); this.soap.push(m); }
    this.soap.forEach((m, i) => {
      const k = want[i]; m.visible = !!k; if (!k) return;
      const [f, x, z, side] = k.split(':').map(Number); if (f !== this.world.floor) { m.visible = false; return; }
      const dw = doorWidth(S);
      if (side === 1) { m.position.set(x * S + S / 2, 0.02, z * S); m.scale.set(0.5, 1, dw * 2); } else { m.position.set(x * S, 0.02, z * S + S / 2); m.scale.set(dw, 1, 1); }
    });
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const p = this.pings[i]; p.t += dt;
      p.mesh.material.opacity = 0.5 * Math.max(0, 1 - p.t / 8) * (0.8 + 0.2 * Math.sin(this.t * 6));
      if (p.t > 8) { this.world.scene.remove(p.mesh); this.pings.splice(i, 1); }
    }
  }
  ping(x, z, color = 0xfff0c0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, 6, z); this.world.scene.add(m); this.pings.push({ mesh: m, t: 0, x, z });
  }
}
