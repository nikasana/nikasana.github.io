// Other players in co-op: soft glowing figures of light (no faces), smoothed between updates.
import * as THREE from 'three';

export class OthersFX {
  constructor(world) { this.world = world; this.meshes = new Map(); }
  make(color) {
    const g = new THREE.Group();
    const col = new THREE.Color().setHSL(color, 0.6, 0.72);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.2, 16), mat); body.position.y = 0.75; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), mat); head.position.y = 1.55; g.add(head);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 20, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    halo.position.y = 1.1; g.add(halo);
    this.world.scene.add(g); return g;
  }
  update(dt, net, floor) {
    const seen = new Set();
    if (net && net.others) for (const [id, o] of net.others) {
      if (performance.now() - o.at > 5000) continue;
      seen.add(id);
      let m = this.meshes.get(id); if (!m) { m = this.make(o.color || 0.5); this.meshes.set(id, m); m.position.set(o.x, 0, o.z); }
      m.visible = o.f === floor;
      const k = Math.min(1, dt * 10); m.position.x += (o.x - m.position.x) * k; m.position.z += (o.z - m.position.z) * k; m.rotation.y = o.yaw;
    }
    for (const [id, m] of this.meshes) if (!seen.has(id)) { this.world.scene.remove(m); this.meshes.delete(id); }
  }
}
