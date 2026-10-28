// Tools: four families, each a tree of tiers. Handles use, effects on the ice, and the held models.
// The camera never shakes: all motion lives in the held tool.
import * as THREE from 'three';
import { FREEZE_TIERS } from '../econ/data/freeze.js';
import { GRAD, VOXEL, richness } from '../world/field.js';
import { digVolumeRate, meltVolumeRate } from '../econ/model.js';
import { MAX_HEAT, MAX_CRACK } from '../world/iceMaterial.js';
import { LAYERS } from '../render/graphics.js';

export const FAMILIES = [
  { id: 'dig', name: 'Dig', key: 'tool1', tiers: ['Pick', 'Drill', 'Sonic hammer'], stat: 'digTier' },
  { id: 'melt', name: 'Melt', key: 'tool2', tiers: ['Torch', 'Steam lance', 'Orbital laser'], stat: 'meltTier' },
  { id: 'planet', name: 'Planet', key: 'tool3', tiers: ['Satellite mirrors', 'Heat pipe'], stat: 'planetTier' },
  { id: 'vision', name: 'Vision', key: 'tool4', tiers: ['Lamp', 'X-ray', 'Satellite radar'], stat: 'visionTier' },
];

// what a family is called right now: in Reverse Mode the melt tools freeze
export function familyView(F, reverse) {
  return reverse && F.id === 'melt' ? { ...F, name: 'Freeze', tiers: FREEZE_TIERS } : F;
}

const ease = (t) => t * t * (3 - 2 * t);
const HAND = new THREE.Vector3(0.28, -0.45, -0.2);   // where the grip sits, in camera space
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _v = new THREE.Vector3();
const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _eu = new THREE.Euler();
const _restQ = new THREE.Quaternion(), _upQ = new THREE.Quaternion(), _hitQ = new THREE.Quaternion();
const _restP = new THREE.Vector3(), _upP = new THREE.Vector3(), _hitP = new THREE.Vector3();

// ---------- held models ----------

function viewMats() {
  return {
    steel: new THREE.MeshStandardMaterial({ color: 0x9aa3a8, metalness: 0.92, roughness: 0.28 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1d2226, metalness: 0.6, roughness: 0.45 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x2b2b2e, metalness: 0.0, roughness: 0.85 }),
    paint: new THREE.MeshStandardMaterial({ color: 0xc8692c, metalness: 0.3, roughness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.3 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x6fdcff, emissiveIntensity: 2.5 }),
    lens: new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 0 }),
    hot: new THREE.MeshStandardMaterial({ color: 0x331400, emissive: 0xff5a1a, emissiveIntensity: 0 }),
  };
}

function buildPick(M) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.62, 10), M.grip);
  handle.position.y = -0.1;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 10), M.paint);
  wrap.position.y = -0.33;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.2, 0.17, 0), new THREE.Vector3(-0.07, 0.235, 0), new THREE.Vector3(0.08, 0.235, 0), new THREE.Vector3(0.24, 0.15, 0)]);
  const head = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.022, 8), M.steel);
  // taper the pick end
  const pos = head.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const k = x > 0.05 ? 1 - (x - 0.05) / 0.22 * 0.85 : x < -0.1 ? 1 - (-0.1 - x) / 0.12 * 0.4 : 1;
    const cy = curve.getPointAt(Math.min(1, Math.max(0, (x + 0.2) / 0.44))).y;
    pos.setY(i, cy + (pos.getY(i) - cy) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  head.geometry.computeVertexNormals();
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.05), M.dark);
  collar.position.y = 0.22;
  g.add(handle, wrap, head, collar);
  g.userData.tip = new THREE.Vector3(0.24, 0.15, 0);
  g.userData.tipDir = new THREE.Vector3(0.88, -0.47, 0).normalize();   // the point's own direction
  return g;
}

// Sonic hammer: a heavy two-handed head with a glowing resonator.
function buildHammer(M) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.7, 10), M.grip);
  handle.position.y = -0.12;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.14), M.dark);
  head.position.y = 0.24;
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16), M.steel);
  face.rotation.z = Math.PI / 2; face.position.set(0.19, 0.24, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 8, 20), M.glow);
  ring.rotation.y = Math.PI / 2; ring.position.set(0.05, 0.24, 0);
  g.add(handle, head, face, ring);
  g.userData.tip = new THREE.Vector3(0.22, 0.24, 0);
  g.userData.tipDir = new THREE.Vector3(1, 0, 0);
  return g;
}

function buildDrill(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 6, 14), M.paint);
  body.rotation.x = Math.PI / 2;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.06), M.grip);
  grip.position.set(0, -0.11, 0.06);
  grip.rotation.x = 0.25;
  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.07, 14), M.dark);
  chuck.rotation.x = Math.PI / 2;
  chuck.position.z = -0.17;
  const bitGeo = new THREE.ConeGeometry(0.03, 0.28, 12, 24);
  const bp = bitGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const y = bp.getY(i);
    const a = (y + 0.14) * 40;
    const x = bp.getX(i), z = bp.getZ(i);
    const r = Math.hypot(x, z) * (1 + 0.35 * Math.sin(Math.atan2(z, x) * 2 + a));
    const ang = Math.atan2(z, x);
    bp.setX(i, Math.cos(ang) * r); bp.setZ(i, Math.sin(ang) * r);
  }
  bitGeo.computeVertexNormals();
  const bit = new THREE.Mesh(bitGeo, M.steel);
  bit.rotation.x = -Math.PI / 2;
  bit.position.z = -0.34;
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.06), M.glow);
  led.position.set(0, 0.062, 0.02);
  g.add(body, grip, chuck, bit, led);
  g.userData.bit = bit;
  g.userData.tip = new THREE.Vector3(0, 0, -0.48);
  return g;
}

function buildTorch(M, lance) {
  const g = new THREE.Group();
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 16), lance ? M.dark : M.paint);
  tank.position.set(0, -0.06, 0.06);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, lance ? 0.026 : 0.022, lance ? 0.52 : 0.3, 12), M.steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = lance ? -0.22 : -0.12;
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.016, 0.05, 12), M.brass);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = lance ? -0.5 : -0.29;
  const tipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), M.hot);
  tipGlow.position.z = lance ? -0.53 : -0.32;
  g.add(tank, barrel, nozzle, tipGlow);
  if (lance) {
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.007, 6, 16), M.brass);
      c.position.z = -0.08 - i * 0.07;
      g.add(c);
    }
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 16), M.glow);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(0, 0.04, 0.0);
    g.add(gauge);
  }
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.05), M.grip);
  grip.position.set(0, -0.09, -0.02);
  g.add(grip);
  g.userData.tip = new THREE.Vector3(0, 0, lance ? -0.54 : -0.33);
  g.userData.glow = M.hot;
  return g;
}

function buildLamp(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, 0.22, 16), M.dark);
  body.rotation.x = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.044, 0.07, 20), M.paint);
  head.rotation.x = Math.PI / 2;
  head.position.z = -0.13;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), M.lens);
  lens.position.z = -0.166;
  lens.rotation.y = Math.PI;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.006, 6, 24), M.brass);
  ring.position.z = -0.165;
  g.add(body, head, lens, ring);
  g.userData.lens = M.lens;
  return g;
}

function buildMirrorRemote(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.03), M.dark);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.06), M.glow);
  screen.position.set(0, 0.025, 0.016);
  g.add(body, screen);
  return g;
}

// ---------- system ----------

export class Tools {
  constructor(game) {
    this.game = game;
    this.family = 0;
    this.swing = 0;          // 0..1 pick swing progress
    this.swinging = false;
    this.impactDone = false;
    this.cooldown = 0;
    this.charge = 0;
    this.using = false;
    this.hit = null;
    this.heat = [];          // { p, r, i, t }
    this.cracks = [];        // { p, r, t }
    this.lampOn = true;
    this.lastMeltAt = [];    // recent melt points for pre-softened synergy: { p, t }
    this.time = 0;
    this.bob = 0;
    this.drillSpin = 0;
    this.listeners = {};
    this.M = viewMats();
    this.view = new THREE.Group();
    game.gfx.viewCam.add(this.view);
    this.models = {
      pick: buildPick(this.M), drill: buildDrill(this.M), hammer: buildHammer(this.M), torch: buildTorch(this.M, false), lance: buildTorch(this.M, true),
      lamp: buildLamp(this.M), remote: buildMirrorRemote(this.M),
    };
    for (const m of Object.values(this.models)) { m.visible = false; this.view.add(m); }
    this.models.pick.scale.setScalar(0.62);
    this.models.hammer.scale.setScalar(0.66);
    for (const k of ['drill', 'torch', 'lance', 'lamp', 'remote']) this.models[k].scale.setScalar(0.55);
    // lights for the held tool
    const vs = game.gfx.viewScene;
    this.viewSun = new THREE.DirectionalLight(0xffffff, 1.6);
    vs.add(this.viewSun, this.viewSun.target);
    vs.add(new THREE.HemisphereLight(0xcfe6ff, 0x203040, 0.5));
    this.viewFlame = new THREE.PointLight(0xff7a30, 0, 2.5, 2);
    this.viewFlame.position.set(0.25, -0.2, -0.8);
    vs.add(this.viewFlame);
    // lamp in the world (and flame light)
    this.spot = new THREE.SpotLight(0xf2f8ff, 0, 36, 0.52, 0.55, 1.6);
    this.spot.castShadow = false;
    game.gfx.scene.add(this.spot, this.spot.target);
    this.flameLight = new THREE.PointLight(0xff8a40, 0, 7, 2);
    game.gfx.scene.add(this.flameLight);
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  tierOf(st, fam = this.family) {
    const F = FAMILIES[fam];
    return Math.round(st[F.stat] || 0);
  }

  available(st, fam) { return FAMILIES[fam].id === 'dig' || this.tierOf(st, fam) >= 1; }

  select(fam, st) {
    if (fam === this.family) return;
    this.family = fam;
    this.swing = 0; this.swinging = false; this.charge = 0;
    this.emit('select', fam, this.available(st, fam));
  }

  cycle(dir, st) {
    for (let k = 1; k <= 4; k++) {
      const f = (this.family + dir * k + 8) % 4;
      if (this.available(st, f)) { this.select(f, st); return; }
    }
  }

  // Reverse Mode: the torch glows ice-blue and sprays frost
  setReverse(on) {
    this.reverse = on;
    this.M.hot.emissive.set(on ? 0x6fdcff : 0xff5a1a);
    this.game.particles.frost = on;
  }

  modelName(st) {
    const F = FAMILIES[this.family];
    const t = this.tierOf(st);
    if (F.id === 'dig') return t >= 3 ? 'hammer' : t >= 2 ? 'drill' : 'pick';
    if (F.id === 'melt') return t >= 2 ? 'lance' : 'torch';
    if (F.id === 'vision') return 'lamp';
    return 'remote';   // planet tools and the orbital laser's designator
  }

  // ctx: { eye, dir, st, hardness(depth), depthAt(y), time, move }
  update(dt, input, ctx) {
    const g = this.game;
    this.time += dt;
    const st = ctx.st;
    const F = FAMILIES[this.family];
    const tier = this.tierOf(st);
    const ok = this.available(st, this.family);
    // looking down you can bend and reach the floor of the hole you are standing in
    const reach = (F.id === 'melt' ? st.reach * 1.45 : st.reach) + Math.max(0, -ctx.dir.y) * 1.5;
    const hit = g.volume.raycast(ctx.eye, ctx.dir, reach + 0.2);
    this.hit = hit.hit && hit.dist <= reach ? hit : null;
    // Auto Swing (Automation): the game holds the button for you while you stand still aiming at ice
    const lmb = (input.is('use') || (this.autoUse && (F.id === 'dig' || F.id === 'melt'))) && ok;
    const rmb = input.is('alt') && ok;
    this.using = false;
    this.cooldown = Math.max(0, this.cooldown - dt);

    if (F.id === 'dig') {
      if (tier === 2) this.updateDrill(dt, lmb, rmb, st, ctx);
      else this.updatePick(dt, lmb, rmb, st, ctx);
    } else if (F.id === 'melt') {
      this.updateMelt(dt, lmb, rmb, st, ctx, tier);
    } else if (F.id === 'planet') {
      this.updateMirror(dt, lmb, rmb, st, ctx);
    } else if (F.id === 'vision') {
      if (input.was('alt') || input.was('lamp')) this.lampOn = !this.lampOn;
      this.using = lmb;
    }
    if (F.id !== 'vision' && input.was('lamp')) this.lampOn = !this.lampOn;

    // decay heat and cracks
    for (const h of this.heat) { h.i = Math.max(0, h.i - dt * 1.4); h.t += dt; }
    this.heat = this.heat.filter((h) => h.t < 22);
    for (const c of this.cracks) c.t += dt;
    this.cracks = this.cracks.filter((c) => c.t < 18);
    this.lastMeltAt = this.lastMeltAt.filter((m) => this.time - m.t < 8 * (st.heatLinger || 1));
    this.pushUniforms(st);
    if (this.beam && (this.beamT -= dt) <= 0) this.beam.visible = false;
    this.updateLights(dt, st, ctx);
    this.animate(dt, st, ctx);
  }

  updatePick(dt, lmb, rmb, st, ctx) {
    const period = 1 / Math.max(0.2, st.digRate);
    // heavy strike: hold RMB to charge, release to strike
    if (rmb && !this.swinging) { this.charge = Math.min(1, this.charge + dt / 0.8); this.using = true; }
    const releaseHeavy = !rmb && this.charge > 0.25 && !this.swinging;
    if ((lmb || releaseHeavy) && !this.swinging && this.cooldown <= 0) {
      this.swinging = true;
      this.swing = 0;
      this.impactDone = false;
      this.heavy = releaseHeavy ? this.charge : 0;
      this.charge = 0;
    }
    if (!rmb && !this.swinging) this.charge = 0;
    if (this.swinging) {
      this.using = true;
      this.swing += dt / (period * (this.heavy ? 1.8 : 1));
      if (!this.impactDone && this.swing >= 0.5) {
        this.impactDone = true;
        if (this.hit) this.strike(st, ctx, 1 + this.heavy * (st.heavyMult - 1), this.heavy > 0);
        else this.emit('whiff');
      }
      if (this.swing >= 1) { this.swinging = false; this.swing = 0; if (this.heavy) this.cooldown = period * 0.8; this.heavy = 0; }
    }
  }

  updateDrill(dt, lmb, rmb, st, ctx) {
    this.drillOn = (lmb || rmb) && !!this.hit;
    if (!(lmb || rmb)) { this.swing = 0; return; }
    this.using = true;
    this.swing += dt * st.digRate * (rmb ? 0.5 : 1);
    this.drillSpin += dt * 60;
    if (this.hit) {
      this.game.particles.drillSpray(this.hit.point, this.hit.normal);
      if (this.swing >= 1) { this.swing -= 1; this.strike(st, ctx, rmb ? 1.35 : 1, rmb, true); }
    }
  }

  strike(st, ctx, scale, heavy, drill = false) {
    const g = this.game;
    const h = this.hit;
    const depth = ctx.depthAt(h.point.y);
    const hard = ctx.hardness(depth);
    const rich = richness(h.point.x, h.point.y, h.point.z);
    const crit = Math.random() < Math.min(0.9, st.crit + st.richCrit * rich);
    // one strike removes a sphere of digVolume/digRate, scaled by hardness
    const perHit = digVolumeRate({ ...st, crit: 0, richCrit: 0, heavyMult: 1.55 }) / Math.max(0.2, st.digRate);
    let r = Math.cbrt((perHit / hard) / ((4 / 3) * Math.PI * 0.5));
    r *= Math.cbrt(scale * scale * scale) * (crit ? Math.cbrt(st.critMult) : 1);
    // thermal shock: ice warmed by the torch a moment ago blows out a bigger crater
    const pre = this.lastMeltAt.some((m) => m.p.distanceTo(h.point) < r + 1.2);
    if (pre) r *= Math.cbrt(1 + st.shock);
    const mut = g.mutantAt ? g.mutantAt(h.point, 0.3) : null;
    if (mut && mut.type === 'tarfrost') r *= 0.75;      // thick, slow to cut
    if (mut && mut.type === 'obsidice') r *= 0.6;       // volcanic glass
    r = Math.max(0.36, r);  // never narrower than the player can follow down
    const c = h.point.clone().addScaledVector(h.normal, -r * 0.35);
    const op = { kind: 'dig', x: c.x, y: c.y, z: c.z, r, seed: (Math.random() * 1000) | 0 };
    const res = g.applyOp(op, 'local');
    // steam burst: a heavy blow on warm ice flashes it to steam and blasts a wide crater
    let burst = false;
    if (pre && heavy && st.steamBurst >= 1) {
      burst = true;
      const b = g.applyOp({ kind: 'dig', x: c.x, y: c.y, z: c.z, r: r * 1.7, seed: (Math.random() * 1000) | 0 }, 'local');
      res.removed += b.removed;
      for (let i = 0; i < 4; i++) g.particles.steam(h.point, h.normal, 3);
    }
    // Sonic hammer: the blow's shockwave breaks a ring of ice around the crater
    if (st.digTier >= 3 && !drill) {
      const up = Math.abs(h.normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const u = new THREE.Vector3().crossVectors(h.normal, up).normalize(), v = new THREE.Vector3().crossVectors(h.normal, u);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2, o = c.clone().addScaledVector(u, Math.cos(a) * r * 1.25).addScaledVector(v, Math.sin(a) * r * 1.25);
        res.removed += g.applyOp({ kind: 'dig', x: o.x, y: o.y, z: o.z, r: r * 0.5, seed: (Math.random() * 1000) | 0 }, 'local').removed;
      }
      g.particles.sparks && g.particles.sparks(h.point, h.normal, 1.5);
    }
    // More Hands (DNA): a second strike lands beside the first
    if (st.hands >= 1) {
      const side = new THREE.Vector3().crossVectors(h.normal, new THREE.Vector3(0, 1, 0.3)).normalize().multiplyScalar(r * 0.7);
      const b = g.applyOp({ kind: 'dig', x: c.x + side.x, y: c.y + side.y, z: c.z + side.z, r: r * 0.8, seed: (Math.random() * 1000) | 0 }, 'local');
      res.removed += b.removed;
    }
    this.cracks.unshift({ p: h.point.clone(), r: r * 1.3, t: 0 });
    if (this.cracks.length > MAX_CRACK) this.cracks.length = MAX_CRACK;
    g.particles.chips(h.point, h.normal, (drill ? 0.35 : 1) * (heavy ? 1.8 : 1) * (crit ? 1.5 : 1) * (pre ? 1.3 : 1));
    if (crit) g.particles.glint(h.point, [0.8, 0.95, 1], 0.5);
    if (pre) g.particles.steam(h.point, h.normal, 1.2);
    this.emit('strike', { point: h.point, normal: h.normal, removed: res.removed, crit, heavy, drill, pre, burst, rich, depth, hard });
  }

  updateMelt(dt, lmb, rmb, st, ctx, tier) {
    const g = this.game;
    this.melting = (lmb || rmb);
    if (!this.melting) return;
    this.using = true;
    const nozzle = this.nozzleWorld(ctx);
    g.particles.flame(nozzle, ctx.dir, tier >= 2 ? 1.6 : 1);
    if (!this.hit) return;
    const h = this.hit;
    const depth = ctx.depthAt(h.point.y);
    const hard = ctx.hardness(depth);
    const wide = rmb && !lmb;
    const r = Math.max(0.45, st.meltRadius * (wide ? 1.6 : 1));
    const vt = (meltVolumeRate(st) / hard) * (wide ? 0.7 : 1) * dt;
    // crack seep: heat pours into fresh pick cracks
    const cracked = this.cracks.some((q) => q.t < 12 && q.p.distanceTo(h.point) < q.r + r * 0.5);
    const amount = (3 * GRAD * vt * (cracked ? 1 + st.seep : 1) * (this.meltFactor ?? 1)) / (Math.PI * r * r * r);
    const c = h.point.clone().addScaledVector(h.normal, -r * 0.25);
    const res = g.applyOp({ kind: 'melt', x: c.x, y: c.y, z: c.z, r, amount, seed: 0 }, 'local');
    if (tier >= 3) this.skyBeam(h.point, 0.35 + r * 0.25, this.reverse ? [0.62, 0.88, 1.0] : [1.0, 0.75, 0.55]);   // orbital laser
    // heat point for the shader
    let hp = this.heat.find((q) => q.p.distanceTo(h.point) < r * 0.7);
    if (!hp) { hp = { p: h.point.clone(), r, i: 0, t: 0 }; this.heat.unshift(hp); if (this.heat.length > MAX_HEAT) this.heat.length = MAX_HEAT; }
    hp.p.lerp(h.point, 0.3); hp.r = r; hp.i = Math.min(1, hp.i + dt * 4); hp.t = 0;
    this.lastMeltAt.push({ p: h.point.clone(), t: this.time });
    if (this.lastMeltAt.length > 40) this.lastMeltAt.shift();
    if (Math.random() < dt * 14) g.particles.steam(h.point, h.normal, tier >= 2 ? 1.8 : 1);
    if (Math.random() < dt * 6) g.particles.drip(h.point.clone().add(new THREE.Vector3(0, -r * 0.6, 0)));
    this.emit('melt', { point: h.point, normal: h.normal, removed: res.removed, depth, dt, wide });
  }

  // Satellite mirrors: a sunbeam from orbit, wide and gentle, wherever you point.
  updateMirror(dt, lmb, rmb, st, ctx) {
    const g = this.game;
    this.mirroring = (lmb || rmb) && !!this.hit;
    if (!this.mirroring) return;
    // Heat pipe (tier 2): right mouse melts a narrow column straight down from where you point
    if (rmb && st.planetTier >= 2) {
      this.using = true;
      const h = this.hit;
      const hard = ctx.hardness(ctx.depthAt(h.point.y));
      let removed = 0;
      for (let k = 0; k < 4; k++) {
        const vt = ((st.mirrorPower || 0) * 1.5 + 0.6) / hard * dt;
        const r = 0.9, amount = (3 * GRAD * vt) / (Math.PI * r * r * r) * 3;
        removed += g.applyOp({ kind: 'melt', x: h.point.x, y: h.point.y - 0.3 - k * 0.8, z: h.point.z, r, amount, seed: 0 }, 'local').removed;
      }
      this.skyBeam(h.point.clone().add(new THREE.Vector3(0, -4, 0)), 0.5, this.reverse ? [0.62, 0.88, 1.0] : [1.0, 0.45, 0.15]);
      if (Math.random() < dt * 12) g.particles.steam(h.point, h.normal, 1.2);
      this.emit('melt', { point: h.point, normal: h.normal, removed, depth: ctx.depthAt(h.point.y), dt, wide: false });
      return;
    }
    this.using = true;
    const h = this.hit;
    const depth = ctx.depthAt(h.point.y);
    const hard = ctx.hardness(depth);
    const r = 3.2;
    const vt = ((st.mirrorPower || 0) * 0.8 * st.meltEff / hard) * dt;
    const amount = (3 * GRAD * vt) / (Math.PI * r * r * r) * 3;
    const res = g.applyOp({ kind: 'melt', x: h.point.x, y: h.point.y - 0.4, z: h.point.z, r, amount, seed: 0 }, 'local');
    this.skyBeam(h.point, 1.6, this.reverse ? [0.62, 0.88, 1.0] : [1.0, 0.92, 0.7]);
    if (Math.random() < dt * 10) g.particles.steam(h.point, h.normal, 1.4);
    this.emit('melt', { point: h.point, normal: h.normal, removed: res.removed, depth, dt, wide: true });
  }

  // a column of light from the sky down to a point (mirror sunbeam, orbital laser)
  skyBeam(p, width, rgb) {
    if (!this.beam) {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true).translate(0, 0.5, 0);
      this.beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
      this.beam.layers.set(LAYERS.FX);
      this.beam.frustumCulled = false;
      this.game.gfx.scene.add(this.beam);
    }
    this.beam.visible = true;
    this.beamT = 0.12;
    this.beam.position.copy(p);
    this.beam.scale.set(width * (0.9 + Math.random() * 0.2), 160, width * (0.9 + Math.random() * 0.2));
    this.beam.material.color.setRGB(...rgb);
  }

  nozzleWorld(ctx) {
    const m = this.models[this.modelName(ctx.st)];
    const tip = (m.userData.tip || new THREE.Vector3()).clone();
    m.localToWorld(tip);
    // the held tool lives in view space: map it into the world through the main camera
    const cam = this.game.gfx.camera;
    const vc = this.game.gfx.viewCam;
    vc.updateMatrixWorld();
    tip.applyMatrix4(vc.matrixWorldInverse).applyMatrix4(cam.matrixWorld);
    return tip;
  }

  pushUniforms() {
    const u = this.game.iceMat.userData.uniforms;
    for (let i = 0; i < MAX_HEAT; i++) {
      const h = this.heat[i];
      if (h) { u.uHeat.value[i].set(h.p.x, h.p.y, h.p.z, h.r); u.uHeatI.value[i] = h.i; }
      else { u.uHeat.value[i].set(0, -1e5, 0, 0); u.uHeatI.value[i] = 0; }
    }
    for (let i = 0; i < MAX_CRACK; i++) {
      const c = this.cracks[i];
      if (c) { u.uCrack.value[i].set(c.p.x, c.p.y, c.p.z, c.r); u.uCrackA.value[i] = Math.max(0, 1 - c.t / 18); }
      else { u.uCrack.value[i].set(0, -1e5, 0, 0); u.uCrackA.value[i] = 0; }
    }
  }

  updateLights(dt, st, ctx) {
    const g = this.game;
    const vision = FAMILIES[this.family].id === 'vision';
    const lampTier = st.visionTier || 0;
    const base = this.lampOn ? (lampTier >= 1 ? 26 : 9) : 0;
    const focus = vision && this.using ? 2.2 : 1;
    const deep = Math.min(1, Math.max(0, ctx.depthAt(ctx.eye.y) / 8));
    this.spot.intensity = base * focus * (0.25 + 0.75 * deep) * (1 + (st.nightVision || 0));
    this.spot.angle = vision && this.using ? 0.3 : 0.55;
    this.spot.distance = (lampTier >= 1 ? 40 : 22) * (1 + (st.nightVision || 0) * 0.5);
    this.spot.position.copy(ctx.eye).addScaledVector(ctx.dir, 0.2).add(new THREE.Vector3(0, -0.15, 0));
    this.spot.target.position.copy(ctx.eye).addScaledVector(ctx.dir, 10);
    const u = g.iceMat.userData.uniforms;
    u.uLamp.value.set(this.spot.position.x, this.spot.position.y, this.spot.position.z, this.spot.intensity * 0.012 * (lampTier >= 1 ? 1 : 0.4));
    u.uLampDir.value.copy(ctx.dir);
    this.models.lamp.userData.lens.emissiveIntensity = this.lampOn ? 3 * focus : 0.1;
    // flame light
    const melting = FAMILIES[this.family].id === 'melt' && this.melting;
    const flick = 0.75 + Math.random() * 0.5;
    this.flameLight.intensity = melting ? 9 * flick : 0;
    if (this.hit && melting) this.flameLight.position.copy(this.hit.point).addScaledVector(this.hit.normal, 0.4);
    this.viewFlame.intensity = melting ? 1.6 * flick : 0;
    this.M.hot.emissiveIntensity = melting ? 4 : Math.max(0, this.M.hot.emissiveIntensity - dt * 3);
    // the held tool is lit like the world around it
    this.viewSun.position.copy(g.atmo.sunDir).applyQuaternion(g.gfx.camera.quaternion.clone().invert()).multiplyScalar(5);
    this.viewSun.intensity = 1.8 * g.atmo.depthDim;
  }

  // Where the tool should touch, in camera space: the hit point, pulled in along its own view ray to
  // arm's length. Seen from the eye it lands exactly on the struck spot, and the chips fly from there.
  contactTarget(maxD) {
    const cam = this.game.gfx.camera;
    const out = this._target || (this._target = { p: new THREE.Vector3(), n: new THREE.Vector3(), ray: new THREE.Vector3(), has: false });
    if (this.hit) {
      out.p.copy(this.hit.point).applyMatrix4(cam.matrixWorldInverse);
      out.n.copy(this.hit.normal).transformDirection(cam.matrixWorldInverse);
      out.has = true;
    } else {
      out.p.set(0.08, -0.12, -1);
      out.n.set(0, 0.3, 1).normalize();
      out.has = false;
    }
    out.ray.copy(out.p).normalize();
    const d = out.p.length();
    if (d > maxD) out.p.multiplyScalar(maxD / d);
    return out;
  }

  // Pick orientation at the moment of impact: the point drives into the surface, the handle runs back to the hand.
  impactPose(m, T, quat, pos) {
    const sc = m.scale.x;
    const tipL = m.userData.tip, tipDirL = m.userData.tipDir;
    const d = _a.copy(T.n).multiplyScalar(-0.65).addScaledVector(T.ray, 0.35).normalize();
    const yW = _b.copy(T.p).sub(HAND).normalize();
    // orthonormal frames: local (tipDir, handle-up, cross) -> world (d, handle toward target, cross)
    const a = tipDirL, bl = _c.set(0, 1, 0).addScaledVector(a, -a.y).normalize(), cl = _d.crossVectors(a, bl);
    const B = yW.addScaledVector(d, -yW.dot(d)).normalize(), C = _e.crossVectors(d, B);
    _m1.makeBasis(a, bl, cl).transpose();
    _m2.makeBasis(d, B, C).multiply(_m1);
    quat.setFromRotationMatrix(_m2);
    pos.copy(tipL).multiplyScalar(sc).applyQuaternion(quat).negate().add(T.p);
  }

  animate(dt, st, ctx) {
    const name = this.modelName(st);
    for (const [k, m] of Object.entries(this.models)) m.visible = k === name;
    const m = this.models[name];
    const moving = ctx.move;
    this.bob += dt * (moving ? 9 : 2);
    const by = Math.sin(this.bob) * (moving ? 0.012 : 0.004), bx = Math.cos(this.bob * 0.5) * (moving ? 0.01 : 0.003);
    m.position.set(0.24 + bx, -0.2 + by, -0.5);
    m.rotation.set(0, 0, 0);
    if (name === 'pick' || name === 'hammer') {
      // rest, raised (wind-up) and impact poses; the swing blends between them
      _restQ.setFromEuler(_eu.set(0.12, -0.5, 0.18));
      _restP.set(0.36 + bx, -0.3 + by, -0.66);
      const lift = 1.05 + (this.heavy || this.charge) * 0.35;
      _upQ.setFromEuler(_eu.set(0.12 - lift, -0.42, 0.3));
      _upP.copy(_restP).add(_v.set(0.03, 0.14 + lift * 0.04, 0.12));
      const s = this.swing;
      if (this.swinging) {
        const T = this.contactTarget(0.9);
        this.impactPose(m, T, _hitQ, _hitP);
        if (s < 0.32) { const t = ease(s / 0.32); m.quaternion.slerpQuaternions(_restQ, _upQ, t); m.position.lerpVectors(_restP, _upP, t); }
        else if (s < 0.5) { const t = Math.pow((s - 0.32) / 0.18, 2); m.quaternion.slerpQuaternions(_upQ, _hitQ, t); m.position.lerpVectors(_upP, _hitP, t); }
        else if (s < 0.6) {
          // bite: the point sits in the ice, then kicks back a touch
          const t = (s - 0.5) / 0.1;
          m.quaternion.copy(_hitQ);
          m.position.copy(_hitP).addScaledVector(T.ray, -0.025 * Math.sin(t * Math.PI));
        } else { const t = ease((s - 0.6) / 0.4); m.quaternion.slerpQuaternions(_hitQ, _restQ, t); m.position.lerpVectors(_hitP, _restP, t); }
      } else if (this.charge > 0) {
        const t = ease(Math.min(1, this.charge));
        m.quaternion.slerpQuaternions(_restQ, _upQ, t); m.position.lerpVectors(_restP, _upP, t);
      } else { m.quaternion.copy(_restQ); m.position.copy(_restP); }
    } else if (name === 'drill') {
      m.userData.bit.rotation.y = this.drillSpin;
      // pushed forward until the bit is in the surface while it bores
      this.drillReach = THREE.MathUtils.lerp(this.drillReach || 0, this.drillOn ? 1 : 0, Math.min(1, dt * 10));
      _restQ.setFromEuler(_eu.set(0.04, -0.1, 0));
      _restP.copy(m.position);
      if (this.drillReach > 0.001) {
        const T = this.contactTarget(0.85);
        _hitQ.setFromUnitVectors(_v.set(0, 0, -1), T.ray);
        _hitP.copy(m.userData.tip).multiplyScalar(m.scale.x).applyQuaternion(_hitQ).negate().add(T.p);
        m.quaternion.slerpQuaternions(_restQ, _hitQ, this.drillReach);
        m.position.lerpVectors(_restP, _hitP, this.drillReach);
      } else m.quaternion.copy(_restQ);
      if (this.drillOn) { m.position.x += (Math.random() - 0.5) * 0.004; m.position.y += (Math.random() - 0.5) * 0.004; }
    } else if (name === 'torch' || name === 'lance') {
      m.rotation.set(0.05, -0.12, 0);
      if (this.melting) m.position.z += 0.01 * Math.sin(this.time * 40);
    } else if (name === 'lamp') {
      m.position.set(0.22 + bx, -0.19 + by, -0.46);
      m.rotation.set(0.02, -0.08, 0);
    }
  }

  // shared with avatars and co-op
  state(st) { return { family: this.family, tier: this.tierOf(st), using: this.using, model: this.modelName(st) }; }
}
