'use strict';
// ---------- ZoneBonk 3D: the gun in your hands ----------
// A real weapon of the run: it shoots exactly where the crosshair points (a hit-scan ray from the eye), takes its
// upgrades from level-up cards like every other weapon (so auto-pick upgrades it too), and is drawn as a 3D model
// whose attachments change with its level. Hold the left mouse button (or the FIRE button on a touch screen); with
// auto-fire on, it fires by itself whenever a mutant is under the crosshair.
const GUN = { trig: false, tracers: [], kick: 0, flashT: 0, shots: 0 };
const z3GunAuto = () => { const s = z3Set(); return s.gunAuto === undefined ? Z3_PHONE : !!s.gunAuto; };

WEAPONS.z3gun = {
  name: 'Stalker Rifle', icon: '🎯', max: 8, tag: null,
  desc: 'The rifle in your hands: it shoots exactly where the crosshair points. Hold the left mouse button or FIRE.',
  ups: ['', '+Damage', '+Fire rate', 'Piercing rounds', 'Red-dot sight: +damage at range', 'Double tap', 'Heavy rounds', 'Drum magazine: +fire rate'],
  stats: (l) => ({ dmg: 16 + l * 6 + (l >= 6 ? 10 : 0), cd: Math.max(0.07, 0.17 - (l >= 2 ? 0.025 : 0) - (l >= 8 ? 0.035 : 0) - l * 0.004), pierce: l >= 7 ? 2 : l >= 3 ? 1 : 0, far: l >= 4 ? 1.35 : 1, count: l >= 5 ? 2 : 1, range: 1100, spread: l >= 4 ? 0.006 : 0.014 }),
};

// every run in 3D starts with the rifle in hand
{
  const _ng = newGame;
  newGame = function () {
    const r = _ng.apply(this, arguments);
    try { if (Z3.ok && P && P.weapons && !P.weapons.some((w) => w.id === 'z3gun')) P.weapons.unshift({ id: 'z3gun', lv: 1, cd: 0, bonus: 0 }); } catch (e) { /* keep the run */ }
    return r;
  };
}

// one shot: the first mutant the ray meets (pierces more with upgrades); walls stop it
function z3Shot(w, s, tgt) {
  const c0 = Math.cos(Z3.yaw), s0 = Math.sin(Z3.yaw), eye = Z3.cam.position.y;
  let a = Z3.yaw + (Math.random() - 0.5) * s.spread * 2, pt = Math.tan(Z3.pitch + (Math.random() - 0.5) * s.spread * 2);
  if (tgt) { // auto-fire: the shot goes to the body of the mutant under the crosshair
    const d = Math.max(20, Math.hypot(tgt.x - P.x, tgt.y - P.y)), vs = (tgt.sc || 1) * (tgt.d && tgt.d.vsc || 1);
    a = Math.atan2(tgt.y - P.y, tgt.x - P.x) + (Math.random() - 0.5) * s.spread; pt = ((tgt.z || 0) + (tgt.r || 12) * 1.1 * vs - eye) / d;
  }
  const hx = Math.cos(a), hy = Math.sin(a), R = s.range;
  // how far until a wall, or the ground when you aim down
  let wall = R;
  for (let t = 16; t < R; t += 14) { const ob = World.solidAt(P.x + hx * t, P.y + hy * t); if (ob && (ob.t || ob.r > 14)) { wall = t; break; } }
  if (pt < -0.001) wall = Math.min(wall, eye / -pt);
  const hits = [];
  for (const e of G.enemies) {
    if (e.dead || e.hidden) continue;
    const dx = e.x - P.x, dy = e.y - P.y, t = dx * hx + dy * hy; if (t < 6 || t > wall) continue;
    const vs = (e.sc || 1) * (e.d && e.d.vsc || 1), rr = Math.max(9, (e.r || 12) * vs * 0.95);
    const side = Math.abs(-dx * hy + dy * hx); if (side > rr) continue;
    // generous up/down: the world is played on the flat, so a shot that lines up from the side counts unless you
    // are clearly aiming at the sky or into the ground in front of it
    const h = eye + pt * t, z0 = (e.z || 0) - 30, z1 = (e.z || 0) + Math.max(30, (e.r || 12) * 2.8 * vs) + 40;
    if (h < z0 || h > z1) continue;
    hits.push([t, e]);
  }
  hits.sort((p, q) => p[0] - q[0]);
  const n = Math.min(hits.length, 1 + s.pierce);
  let end = Math.min(wall, R);
  for (let i = 0; i < n; i++) {
    const [t, e] = hits[i], dm = s.dmg * wmul(w) * (t > 450 ? s.far : 1);
    hurtEnemy(e, dm, hx * 140, hy * 140);
    if (i === n - 1) end = t;
    if (typeof part === 'function') for (let k = 0; k < 4; k++) part(e.x - hx * 6, e.y - hy * 6, { z: clamp(eye + pt * t - (e.z || 0), 4, 80), vz: rand(20, 90), c: '255,90,70', s: 3, life: 0.35 });
  }
  if (!n && typeof part === 'function') { // dust where it hit a wall or the ground
    const x = P.x + hx * end, y = P.y + hy * end, z = Math.max(2, eye + pt * end);
    for (let k = 0; k < 5; k++) part(x - hx * 4, y - hy * 4, { z, vz: rand(20, 80), c: '200,190,160', s: 3, life: 0.4 });
  }
  GUN.tracers.push({ x1: P.x + hx * end, y1: P.y + hy * end, h1: eye + pt * end, t: NOW });
  if (GUN.tracers.length > 12) GUN.tracers.shift();
}
function z3GunFire(w, s) {
  if (!Z3_MODE || G.state !== 'play' || P.veh) return false;
  let want = GUN.trig, tgt = null;
  if (!want && z3GunAuto()) { const t = z3Target(s.range * 0.9); if (t) { const rel = Math.abs(z3Rel(t.x, t.y)), d = Math.hypot(t.x - P.x, t.y - P.y); if (rel < Math.max(0.07, Math.atan2((t.r || 12) * 1.3, d))) { want = true; tgt = t; } } }
  if (!want) return false;
  for (let i = 0; i < s.count; i++) z3Shot(w, s, tgt);
  P.muzzle = 0.06; GUN.kick = 1; GUN.flashT = 0.05; GUN.shots++;
  Sfx.play(w.lv >= 5 ? 'ak' : 'pistol');
  return true;
}
{
  const _fw = fireWeapon;
  fireWeapon = function (w, s) { if (w.id === 'z3gun') { const f = z3GunFire(w, s); w._nf = !f; return f; } return _fw.apply(this, arguments); };
  const _uw = updateWeapons;
  updateWeapons = function () { const r = _uw.apply(this, arguments); for (const w of P.weapons) if (w.id === 'z3gun' && w._nf) { w.cd = 0; w._nf = false; } return r; };
}

// input: left mouse button while the mouse is captured; the FIRE button on touch screens
addEventListener('mousedown', (e) => { if (e.button === 0 && Z3_MODE && document.pointerLockElement === cv) GUN.trig = true; }, true);
addEventListener('mouseup', (e) => { if (e.button === 0) GUN.trig = false; });
addEventListener('blur', () => { GUN.trig = false; });
addEventListener('DOMContentLoaded', () => {
  const tu = $('touchUi') || document.body;
  const b = document.createElement('button'); b.id = 'z3Fire'; b.className = 'tbtn'; b.textContent = '🔥';
  b.style.cssText = 'position:fixed;right:118px;bottom:150px;width:78px;height:78px;border-radius:50%;font-size:30px;z-index:20;display:none;background:rgba(160,40,30,0.55);border:2px solid rgba(255,140,110,0.8);color:#fff;touch-action:none';
  const on = (e) => { e.preventDefault(); e.stopPropagation(); GUN.trig = true; }, off = (e) => { e.stopPropagation(); GUN.trig = false; };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  tu.appendChild(b); GUN.btn = b;
});
function z3GunUi() {
  const show = Z3_MODE && G && G.state === 'play' && !P.veh && matchMedia('(pointer: coarse)').matches && P.weapons.some((w) => w.id === 'z3gun');
  if (GUN.btn && (GUN.btn.style.display === 'none') === show) GUN.btn.style.display = show ? 'block' : 'none';
}

// ---------- the 3D gun model ----------
// its own little scene drawn over the world (so it never sinks into walls), lit by the same day/night as the world
const VM = {};
(function vmInit() {
  if (!Z3.ok) return;
  VM.scene = new THREE.Scene();
  VM.cam = new THREE.PerspectiveCamera(55, 1, 0.05, 20);
  VM.hemi = new THREE.HemisphereLight(0xdfe6ff, 0x3a3428, 1.1); VM.scene.add(VM.hemi);
  VM.sun = new THREE.DirectionalLight(0xfff1d8, 1.4); VM.sun.position.set(-1, 2, 1.5); VM.scene.add(VM.sun);
  VM.flashL = new THREE.PointLight(0xffb060, 0, 3); VM.scene.add(VM.flashL);
  const M = (c, r = 0.7, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const metal = M(0x55585c, 0.5, 0.25), dark = M(0x34363a, 0.55, 0.2), wood = M(0x7a4e2c, 0.75, 0.02), olive = M(0x5d6744, 0.85, 0.02), red = new THREE.MeshBasicMaterial({ color: 0xff3020 });
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const cyl = (r, l, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };
  const g = new THREE.Group();
  // an AK-style rifle along -z (forward)
  g.add(box(0.09, 0.12, 0.62, metal, 0, 0, -0.1));            // receiver
  g.add(cyl(0.022, 0.62, dark, 0, 0.03, -0.7));               // barrel
  g.add(box(0.08, 0.07, 0.3, wood, 0, -0.01, -0.5));          // handguard
  g.add(box(0.07, 0.24, 0.1, wood, 0, -0.17, 0.08).rotateX(0.35)); // grip
  g.add(box(0.075, 0.1, 0.36, wood, 0, -0.04, 0.38));         // stock
  const mag = box(0.06, 0.26, 0.11, dark, 0, -0.2, -0.22); mag.rotation.x = -0.35; g.add(mag); VM.mag = mag;
  const drum = cyl(0.11, 0.07, dark, 0, -0.2, -0.22); drum.rotation.set(0, Math.PI / 2, 0); drum.visible = false; g.add(drum); VM.drum = drum;
  const sight = new THREE.Group(); sight.add(box(0.05, 0.05, 0.12, dark, 0, 0.1, -0.1)); const dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), red); dot.position.set(0, 0.1, -0.165); sight.add(dot); sight.visible = false; g.add(sight); VM.sight = sight;
  const brake = cyl(0.032, 0.09, metal, 0, 0.03, -1.03); brake.visible = false; g.add(brake); VM.brake = brake;
  const heavy = box(0.1, 0.03, 0.5, metal, 0, 0.075, -0.3); heavy.visible = false; g.add(heavy); VM.heavy = heavy; // top rail
  // hands and sleeves
  const hand = (x, y, z) => { const h = new THREE.Group(); h.add(box(0.1, 0.09, 0.12, M(0x8f6f58, 0.9, 0)).translateY(0)); const sl = box(0.13, 0.13, 0.45, olive, 0, -0.02, 0.28); h.add(sl); h.position.set(x, y, z); return h; };
  g.add(hand(0, -0.09, -0.5)); g.add(hand(0.02, -0.15, 0.1));
  // muzzle flash: two crossed glowing quads
  const fm = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fl = new THREE.Group(); for (let i = 0; i < 3; i++) { const q = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), fm); q.rotation.z = i * 1.05; fl.add(q); }
  const fl2 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), fm); fl2.rotation.y = Math.PI / 2; fl.add(fl2);
  fl.position.set(0, 0.03, -1.08); g.add(fl); VM.flash = fl; VM.flashMat = fm;
  VM.gun = g; VM.scene.add(g);
})();
function z3GunDraw() {
  if (!VM.gun) return;
  const w = P.weapons.find((x) => x.id === 'z3gun');
  const show = !!w && !P.veh && G.state !== 'over';
  VM.gun.visible = show;
  if (!show) { if (typeof z3GunDraw2 === 'function' && !P.veh && G.state !== 'over') { z3GunDraw2(1 / 60); Z3.R.autoClear = false; Z3.R.clearDepth(); Z3.R.render(VM.scene, VM.cam); Z3.R.autoClear = true; } return; }
  const lv = w.lv;
  VM.sight.visible = lv >= 4; VM.drum.visible = lv >= 8; VM.mag.visible = lv < 8; VM.brake.visible = lv >= 6; VM.heavy.visible = lv >= 7;
  const W = innerWidth, H = innerHeight; VM.cam.aspect = W / H; VM.cam.updateProjectionMatrix();
  GUN.kick *= 0.82; GUN.flashT -= 1 / 60;
  const mv = P.moving ? 1 : 0, ph = (P.anim || 0) * 0.5;
  const sway = mv ? Math.sin(ph) * 0.018 : Math.sin(NOW * 1.6) * 0.004, bob = mv ? Math.abs(Math.cos(ph)) * 0.014 : 0;
  const right = W < H ? 0.17 : 0.24;
  VM.gun.position.set(right + sway, -0.25 - bob + GUN.kick * 0.012, -0.72 + GUN.kick * 0.07); VM.gun.scale.setScalar(0.85);
  VM.gun.rotation.set(GUN.kick * 0.06, -0.04, sway * 0.6);
  const f = GUN.flashT > 0 || P.muzzle > 0.03;
  VM.flashMat.opacity = f ? 0.95 : 0; VM.flash.rotation.z = Math.random() * 3; VM.flash.scale.setScalar(f ? 0.8 + Math.random() * 0.5 : 1);
  VM.flashL.intensity = f ? 4 : 0; VM.flashL.position.set(VM.gun.position.x, VM.gun.position.y + 0.05, VM.gun.position.z - 1);
  const b = Z3.bright; VM.hemi.intensity = 0.35 + b * 0.9; VM.sun.intensity = 0.2 + b * 1.3;
  if (typeof z3GunDraw2 === 'function') z3GunDraw2(1 / 60);
  Z3.R.autoClear = false; Z3.R.clearDepth(); Z3.R.render(VM.scene, VM.cam); Z3.R.autoClear = true;
}
// tracers of your shots: a fast fading line of light from the muzzle
function z3GunTracers(A) {
  const gx = P.x + Math.cos(Z3.yaw) * 30 + Z3.rx * 10, gy = P.y + Math.sin(Z3.yaw) * 30 + Z3.rz * 10, gh = Z3.cam.position.y - 10;
  for (const t of GUN.tracers) {
    const age = NOW - t.t; if (age > 0.09) continue;
    const k = 1 - age / 0.09, L = Math.hypot(t.x1 - gx, t.y1 - gy), n = Math.min(60, Math.max(3, Math.ceil(L / 14)));
    for (let i = 0; i <= n; i++) { const u = i / n; A.push(lerp(gx, t.x1, u), lerp(gh, t.h1, u), lerp(gy, t.y1, u), 5, 1, 0.85, 0.5, k * (0.4 + u * 0.6)); }
  }
}

// ---------- the second weapon in your left hand, shell casings, and the muzzle lighting the world ----------
(function vm2Init() {
  if (!VM.scene) return;
  const M = (c, r = 0.7, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const cyl = (r, l, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 12), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };
  const metal = M(0x55585c, 0.5, 0.3), dark = M(0x2e3034, 0.6, 0.2), wood = M(0x7a4e2c, 0.8, 0), olive = M(0x4e5836, 0.85, 0), skin = M(0x8f6f58, 0.9, 0);
  const glowM = new THREE.MeshBasicMaterial({ color: 0x6cc4ff });
  const mk = {
    pistol: () => { const g = new THREE.Group(); g.add(box(0.06, 0.08, 0.26, dark, 0, 0, -0.1)); g.add(box(0.05, 0.16, 0.07, wood, 0, -0.1, 0.02).rotateX(0.2)); return g; },
    shotgun: () => { const g = new THREE.Group(); g.add(cyl(0.025, 0.7, dark, -0.02, 0.02, -0.4)); g.add(cyl(0.025, 0.7, dark, 0.03, 0.02, -0.4)); g.add(box(0.08, 0.09, 0.4, wood, 0, -0.04, 0.05)); return g; },
    tube: () => { const g = new THREE.Group(); g.add(cyl(0.07, 0.75, olive, 0, 0.02, -0.3)); g.add(box(0.05, 0.14, 0.06, dark, 0, -0.1, -0.15)); return g; },
    energy: () => { const g = new THREE.Group(); g.add(box(0.08, 0.1, 0.5, M(0x2b2f36, 0.4, 0.5), 0, 0, -0.2)); for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), glowM); r.position.set(0, 0, -0.1 - i * 0.1); g.add(r); } g.userData.glow = true; return g; },
    rifle: () => { const g = new THREE.Group(); g.add(box(0.07, 0.09, 0.5, dark, 0, 0, -0.15)); g.add(cyl(0.018, 0.4, metal, 0, 0.02, -0.55)); g.add(box(0.06, 0.08, 0.28, wood, 0, -0.03, 0.2)); return g; },
  };
  VM.left = {}; VM.leftRoot = new THREE.Group(); VM.scene.add(VM.leftRoot);
  for (const k in mk) { const g = mk[k](); const hand = new THREE.Group(); hand.add(box(0.09, 0.08, 0.11, skin, 0, -0.06, 0.02)); hand.add(box(0.12, 0.12, 0.42, olive, 0, -0.08, 0.28)); g.add(hand); g.visible = false; VM.leftRoot.add(g); VM.left[k] = g; }
  const fm = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), fm); VM.leftRoot.add(fl); VM.lflash = fl; VM.lflashM = fm;
  VM.glowM = glowM;
  // shell casings flying out to the right
  VM.cases = []; const cg = new THREE.CylinderGeometry(0.009, 0.009, 0.035, 6), cm = M(0xc8a040, 0.4, 0.8);
  for (let i = 0; i < 14; i++) { const c = new THREE.Mesh(cg, cm); c.visible = false; VM.scene.add(c); VM.cases.push({ m: c, t: 9, v: new THREE.Vector3() }); }
  // the world lights up around you when you fire
  VM.worldFlash = new THREE.PointLight(0xffb060, 0, 360, 2); Z3.scene.add(VM.worldFlash);
})();
const VM2 = { last: new Map(), shotsSeen: 0, lflashT: 0, ci: 0 };
function z3GunKindOf(id) {
  const nm = ((WEAPONS[id] && WEAPONS[id].name) || '').toLowerCase() + ' ' + id;
  if (/pistol|dual|revolver/.test(nm)) return 'pistol';
  if (/shotgun|sawn/.test(nm)) return 'shotgun';
  if (/launcher|rocket|rpg|acid|flame|c4|grenade|saw|stasis|mine|swarm/.test(nm)) return 'tube';
  if (/tesla|laser|grav|psi|weld|beam|electr|fence|coil|gauss|bell/.test(nm)) return 'energy';
  return 'rifle';
}
function z3GunDraw2(dt) {
  if (!VM.leftRoot) return;
  const second = P.weapons.find((w) => w.id !== 'z3gun');
  const kind = second ? z3GunKindOf(second.id) : null;
  for (const k in VM.left) VM.left[k].visible = !P.veh && k === kind && G.state !== 'over';
  if (kind && !P.veh) {
    // did it fire? its cooldown jumped back up
    const prev = VM2.last.get(second); VM2.last.set(second, second.cd);
    if (prev !== undefined && second.cd > prev + 0.04) VM2.lflashT = 0.06;
    VM2.lflashT -= dt;
    const W = innerWidth, H = innerHeight, left = W < H ? -0.17 : -0.25, mv = P.moving ? 1 : 0, ph = (P.anim || 0) * 0.5;
    const kick = VM2.lflashT > 0 ? 1 : 0;
    VM.leftRoot.position.set(left - (mv ? Math.sin(ph) * 0.015 : 0), -0.27 - (mv ? Math.abs(Math.cos(ph)) * 0.012 : 0), -0.62 + kick * 0.04);
    VM.leftRoot.rotation.set(kick * 0.05, 0.05, 0);
    VM.lflash.position.set(0, 0.02, kind === 'shotgun' ? -0.78 : kind === 'tube' ? -0.7 : kind === 'pistol' ? -0.25 : -0.5);
    VM.lflashM.opacity = kick ? 0.9 : 0; VM.lflashM.color.set(kind === 'energy' ? 0x80c8ff : 0xffc070); VM.lflash.rotation.z = Math.random() * 3;
    if (kind === 'energy') { const lv = second.lv || 1; VM.glowM.color.setRGB(0.3 + lv * 0.08, 0.6 + lv * 0.05, 1).multiplyScalar(0.7 + Math.sin(NOW * 9) * 0.3); }
  }
  // casings from the rifle
  if (GUN.shots !== VM2.shotsSeen) {
    VM2.shotsSeen = GUN.shots; const c = VM.cases[VM2.ci++ % VM.cases.length];
    c.t = 0; c.m.visible = true; c.m.position.set(VM.gun.position.x + 0.03, VM.gun.position.y + 0.06, VM.gun.position.z - 0.12); c.v.set(0.9 + Math.random() * 0.4, 1.1 + Math.random() * 0.4, 0.2);
  }
  for (const c of VM.cases) { if (c.t > 0.7) { c.m.visible = false; continue; } c.t += dt; c.v.y -= 4.5 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += dt * 14; c.m.rotation.z += dt * 9; }
  // flash of light in the world at the muzzle
  const f = GUN.flashT > 0 || VM2.lflashT > 0;
  VM.worldFlash.intensity = f ? 2200 : 0;
  if (f) VM.worldFlash.position.set(P.x + Math.cos(Z3.yaw) * 40, Z3.cam.position.y - 6, P.y + Math.sin(Z3.yaw) * 40);
}
