// First-person controller. Collides a stack of spheres against the ice density field
// (which also covers the snow surface outside the dig domain) and simple boxes.
import * as THREE from 'three';

const R = 0.25;
const HEIGHT = 1.78;
const EYE = 1.64;
const SPHERES = [R, 0.9, HEIGHT - R];
const GRAV = 22;
const _n = new THREE.Vector3();
const _v = new THREE.Vector3();

export class Controller {
  constructor(volume) {
    this.volume = volume;
    this.pos = new THREE.Vector3(0, 2, 6);    // feet
    this.prev = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = -0.15;
    this.onGround = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.colliders = [];                      // { min: Vector3, max: Vector3 }
    this.walkSpeed = 4.4;
    this.sprintMul = 1.65;
    this.jumpV = 7.4;
    this.noclip = false;
    this.distWalked = 0;
    this.landed = 0;
    this.footstep = 0;
    this.listeners = {};
    this.limitRadius = 420;
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, ...a) { for (const f of this.listeners[ev] || []) f(...a); }

  look(dx, dy, sens, invert) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens * (invert ? -1 : 1);
    this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch));
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  eye(alpha = 1, out = new THREE.Vector3()) {
    return out.copy(this.prev).lerp(this.pos, alpha).add(_v.set(0, EYE, 0));
  }

  step(dt, input) {
    this.prev.copy(this.pos);
    const fw = input.forward, st = input.strafe;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wish = new THREE.Vector3(-sin * fw + cos * st, 0, -cos * fw - sin * st);
    if (wish.lengthSq() > 1) wish.normalize();
    const speed = this.walkSpeed * (input.sprint ? this.sprintMul : 1);

    if (this.noclip) {
      const f = this.forward();
      const v = f.multiplyScalar(fw).add(new THREE.Vector3(cos * st, 0, -sin * st));
      this.pos.addScaledVector(v, speed * 3 * dt);
      if (input.jump) this.pos.y += speed * 2 * dt;
      this.vel.set(0, 0, 0);
      return;
    }

    const accel = this.onGround ? 14 : 3.2;
    const target = wish.multiplyScalar(speed);
    this.vel.x += (target.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (target.z - this.vel.z) * Math.min(1, accel * dt);
    if (this.onGround && input.jump) { this.vel.y = this.jumpV; this.onGround = false; this.emit('jump'); }
    this.vel.y -= GRAV * dt;
    if (this.vel.y < -40) this.vel.y = -40;

    const fallSpeed = this.vel.y;
    // substeps keep fast falls from tunnelling through thin floors
    const n = Math.max(1, Math.ceil(this.vel.length() * dt / 0.15));
    const wasGround = this.onGround;
    this.onGround = false;
    for (let i = 0; i < n; i++) {
      this.pos.addScaledVector(this.vel, dt / n);
      this.resolve();
    }
    if (this.onGround && !wasGround && fallSpeed < -6) this.emit('land', -fallSpeed);
    if (this.onGround) {
      const h = Math.hypot(this.vel.x, this.vel.z);
      this.distWalked += h * dt;
      this.footstep += h * dt;
      const stride = input.sprint ? 2.1 : 1.7;
      if (this.footstep > stride) { this.footstep = 0; this.emit('step', this.groundNormal.y, h); }
    }
    // soft limit on how far the claim extends
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > this.limitRadius) {
      const k = (r - this.limitRadius) * 0.5;
      this.pos.x -= (this.pos.x / r) * k;
      this.pos.z -= (this.pos.z / r) * k;
    }
  }

  resolve() {
    const vol = this.volume;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const h of SPHERES) {
        const cx = this.pos.x, cy = this.pos.y + h, cz = this.pos.z;
        const s = vol.sdf(cx, cy, cz);            // >0 inside ice
        const pen = R + s;
        if (pen > 0) {
          vol.normalAt(cx, cy, cz, _n);
          // Carved space is a union of crater spheres, whose field under-reports the distance at the
          // necks between them: only collide if the sphere's side facing the surface is really in ice.
          if (vol.sdf(cx - _n.x * R, cy - _n.y * R, cz - _n.z * R) < -0.04) continue;
          // feet: on real slopes prefer pushing up so they stay walkable, but not on the lip of a hole:
          // there the push follows the true normal and the player slides in instead of hovering over it
          if (h === R && _n.y > 0.45 && !this.overGap(_n)) _n.set(_n.x * 0.25, 1, _n.z * 0.25).normalize();
          this.pos.addScaledVector(_n, pen * 0.9);
          const vn = this.vel.dot(_n);
          if (vn < 0) this.vel.addScaledVector(_n, -vn);
          if (_n.y > 0.55 && h === R) { this.onGround = true; this.groundNormal.copy(_n); }
          if (_n.y < -0.5 && this.vel.y > 0) this.vel.y = 0;
          moved = true;
        }
      }
      for (const c of this.colliders) if (this.pushBox(c)) moved = true;
      if (!moved) break;
    }
    // ground probe for stable footing on gentle slopes
    if (!this.onGround && this.vel.y <= 0.5) {
      const s = vol.sdf(this.pos.x, this.pos.y + R - 0.08, this.pos.z);
      if (s > -R && !this.overGap(null)) { this.onGround = true; }
    }
  }

  // Is there open space straight under the feet (a dug hole), with support only from its rim?
  overGap(n) {
    if (n && n.y > 0.97) return false;
    const vol = this.volume, p = this.pos;
    return vol.sdf(p.x, p.y - 0.12, p.z) < -0.05 && vol.sdf(p.x, p.y - 0.45, p.z) < -0.05;
  }

  pushBox(c) {
    const p = this.pos;
    if (p.y > c.max.y || p.y + HEIGHT < c.min.y) return false;
    const qx = Math.max(c.min.x, Math.min(p.x, c.max.x)), qz = Math.max(c.min.z, Math.min(p.z, c.max.z));
    const dx = p.x - qx, dz = p.z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) return false;
    // standing on top?
    if (p.y > c.max.y - 0.35 && this.vel.y <= 0) { p.y = c.max.y; this.vel.y = 0; this.onGround = true; this.groundNormal.set(0, 1, 0); return true; }
    const d = Math.sqrt(d2) || 1e-4;
    if (d2 < 1e-8) { p.x += R; return true; }
    p.x += (dx / d) * (R - d);
    p.z += (dz / d) * (R - d);
    return true;
  }

  teleport(x, y, z) {
    this.pos.set(x, y, z);
    this.prev.copy(this.pos);
    this.vel.set(0, 0, 0);
  }
}

export const PLAYER = { R, HEIGHT, EYE };
