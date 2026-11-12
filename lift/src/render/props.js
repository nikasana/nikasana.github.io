// Primitive-built set pieces and the lift cabin.
import * as THREE from '../../vendor/three.module.min.js';

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const glow = (c) => new THREE.MeshBasicMaterial({ color: c });
function add(view, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); view.group.add(m); return m; }

export function buildCabin(view, game) {
  const S = view.info.side;
  // brass trim along the walls
  const brass = lam(0xc9a25a);
  for (const [w, d, x, z] of [[S, 0.06, 0, -S / 2 + 0.2], [S, 0.06, 0, S / 2 - 0.2], [0.06, S, -S / 2 + 0.2, 0], [0.06, S, S / 2 - 0.2, 0]]) add(view, new THREE.BoxGeometry(w, 0.06, d), brass, x, 1.0, z);
  // console with the panel
  const consoleBase = add(view, new THREE.BoxGeometry(1.1, 1.05, 0.6), lam(0x6b4a33), 0, 0.525, -0.6);
  const screen = add(view, new THREE.BoxGeometry(0.9, 0.5, 0.05), glow(0xffd9a0), 0, 1.25, -0.82);
  screen.rotation.x = -0.25;
  view.console = { x: 0, z: -0.6, screen };
  // bell
  const bell = add(view, new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), lam(0xe0b860), 0.75, 1.3, -0.6);
  view.bell = bell;
  // floor indicator arc above the north doorway
  const ind = add(view, new THREE.TorusGeometry(0.45, 0.04, 6, 24, Math.PI), brass, 0, 2.9, -S / 2 + 0.25);
  // cosmetic slots, shown at milestones
  view.cosmetics = {
    mug: add(view, new THREE.CylinderGeometry(0.06, 0.05, 0.12, 12), lam(0xf2efe6), -0.35, 1.11, -0.45),
    plant: (() => { const g = new THREE.Group(); const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.3, 12), lam(0xa0583a)); pot.position.y = 0.15; g.add(pot);
      for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lam(0x5f9a4a)); l.position.set(Math.cos(i) * 0.12, 0.42 + (i % 3) * 0.08, Math.sin(i) * 0.12); g.add(l); }
      g.position.set(S / 2 - 0.7, 0, -S / 2 + 0.7); view.group.add(g); return g; })(),
    blanket: (() => { const g = new THREE.Group(); const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 0.6), lam(0x7a5a40)); bench.position.y = 0.225; g.add(bench);
      const bl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.62), lam(0xc0504a)); bl.position.y = 0.49; g.add(bl);
      g.position.set(-S / 2 + 0.6, 0, S / 2 - 1.5); g.rotation.y = Math.PI / 2; view.group.add(g); return g; })(),
    drawing: (() => { const g = new THREE.Group(); const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.03), lam(0x4a3a2a)); g.add(frame);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.4), lam(0xf4efe2)); paper.position.z = 0.02; g.add(paper);
      const sun = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), glow(0xf0a040)); sun.position.set(0.15, 0.08, 0.025); g.add(sun);
      const hill = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16, 0, Math.PI), lam(0x7ab060)); hill.position.set(-0.1, -0.2, 0.025); g.add(hill);
      g.position.set(S / 2 - 0.2, 1.6, 0); g.rotation.y = -Math.PI / 2; view.group.add(g); return g; })(),
  };
  for (const c of Object.values(view.cosmetics)) c.visible = false;
}

export function buildSetPiece(view, info) {
  const S = info.side, H = info.ceil;
  switch (info.setPiece) {
    case 'tree': {
      add(view, new THREE.CylinderGeometry(0.18, 0.28, 2.4, 10), lam(0x7a5838), 0, 1.2, 0);
      for (let i = 0; i < 7; i++) add(view, new THREE.IcosahedronGeometry(0.7 + (i % 3) * 0.2, 1), lam(0x6aa052), Math.cos(i * 0.9) * 0.6, 2.5 + (i % 3) * 0.35, Math.sin(i * 0.9) * 0.6);
      const sky = add(view, new THREE.PlaneGeometry(2.4, 2.4), glow(0xcfe4ff), 0, H - 0.02, 0); sky.rotation.x = Math.PI / 2;
      break;
    }
    case 'chair': {
      const wood = lam(0x8a6a4a);
      add(view, new THREE.BoxGeometry(0.5, 0.06, 0.5), wood, 0, 0.45, 0);
      add(view, new THREE.BoxGeometry(0.5, 0.6, 0.06), wood, 0, 0.75, -0.22);
      for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) add(view, new THREE.BoxGeometry(0.05, 0.45, 0.05), wood, x, 0.225, z);
      add(view, new THREE.CylinderGeometry(0.01, 0.01, H - 2.1, 4), lam(0x333333), 0, 2.1 + (H - 2.1) / 2, 0);
      add(view, new THREE.ConeGeometry(0.3, 0.3, 16, 1, true), glow(0xffe0a8), 0, 2.0, 0);
      break;
    }
    case 'stairs': {
      for (let i = 0; i < 8; i++) add(view, new THREE.BoxGeometry(1.4, 0.25, 0.4), lam(0xd8d0c4), 0, 0.125 + i * 0.25, S / 2 - 1.4 - i * 0.4 + 0.2 - S * 0.1);
      add(view, new THREE.PlaneGeometry(1.0, 1.3), glow(0xffe6b0), 0, 2.8, S / 2 - 1.4 - 3.2 - S * 0.1 + 0.25);
      break;
    }
    case 'aquarium': {
      add(view, new THREE.BoxGeometry(2.2, 1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0x6fc8e0, transparent: true, opacity: 0.6 }), 0, 1.0, 0);
      add(view, new THREE.BoxGeometry(2.3, 0.4, 0.9), lam(0x4a4a50), 0, 0.2, 0);
      for (let i = 0; i < 4; i++) add(view, new THREE.ConeGeometry(0.06, 0.18, 6), glow(0xffa050), -0.7 + i * 0.45, 0.9 + (i % 2) * 0.3, 0).rotation.z = Math.PI / 2;
      break;
    }
    case 'door': {
      const wood = lam(0x8a6a50);
      add(view, new THREE.BoxGeometry(1.2, 0.1, 0.15), wood, 0, 2.2, 0);
      add(view, new THREE.BoxGeometry(0.1, 2.2, 0.15), wood, -0.55, 1.1, 0);
      add(view, new THREE.BoxGeometry(0.1, 2.2, 0.15), wood, 0.55, 1.1, 0);
      add(view, new THREE.PlaneGeometry(1.0, 2.1), glow(0xfff0d0), 0, 1.07, 0);
      break;
    }
    case 'moon': {
      add(view, new THREE.SphereGeometry(1.0, 24, 16), glow(0xf2ecd8), 0, Math.min(H - 1.2, 2.6), 0);
      break;
    }
  }
}
