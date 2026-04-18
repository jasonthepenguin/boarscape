import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
} from "three";
import {
  GRENADE_ARC_HEIGHT,
  GRENADE_EXPLOSION_DURATION,
  GRENADE_EXPLOSION_RADIUS,
  GRENADE_FUSE,
} from "../config.js";

function createGrenadeModel() {
  const group = new Group();

  // Main body — dark olive-green metallic sphere
  const bodyGeo = new SphereGeometry(0.14, 12, 10);
  const bodyMat = new MeshStandardMaterial({
    color: "#3d4a2a",
    roughness: 0.55,
    metalness: 0.6,
  });
  const body = new Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Top cap with fuse — small cylinder
  const capGeo = new CylinderGeometry(0.05, 0.06, 0.08, 10);
  const capMat = new MeshStandardMaterial({
    color: "#8a6a2a",
    roughness: 0.3,
    metalness: 0.8,
  });
  const cap = new Mesh(capGeo, capMat);
  cap.position.y = 0.15;
  group.add(cap);

  return group;
}

function disposeObject(obj) {
  obj.traverse?.((o) => {
    o.geometry?.dispose?.();
    if (Array.isArray(o.material)) {
      for (const m of o.material) m?.dispose?.();
    } else {
      o.material?.dispose?.();
    }
  });
}

export class GrenadeManager {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = []; // { mesh, startPos, targetPos, elapsed }
    this.explosions = []; // { group, elapsed, fireball, shockwave, innerSphere }
  }

  throwAt(startPos, targetPos) {
    const mesh = createGrenadeModel();
    mesh.position.copy(startPos);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      startPos: startPos.clone(),
      targetPos: targetPos.clone(),
      elapsed: 0,
    });
  }

  _spawnExplosion(x, z) {
    const group = new Group();
    group.position.set(x, 0, z);

    // Bright inner fireball — additive, hot yellow/white
    const innerGeo = new SphereGeometry(0.6, 20, 16);
    const innerMat = new MeshBasicMaterial({
      color: 0xffe08a,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const innerSphere = new Mesh(innerGeo, innerMat);
    innerSphere.position.y = 0.8;
    group.add(innerSphere);

    // Outer fireball — orange-red, larger, slower
    const fireGeo = new SphereGeometry(1.0, 24, 16);
    const fireMat = new MeshBasicMaterial({
      color: 0xff6a22,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const fireball = new Mesh(fireGeo, fireMat);
    fireball.position.y = 0.8;
    group.add(fireball);

    // Ground shockwave — flat ring expanding outward
    const ringGeo = new RingGeometry(0.4, 0.6, 32);
    const ringMat = new MeshBasicMaterial({
      color: 0xffa54a,
      transparent: true,
      opacity: 0.9,
      side: DoubleSide,
      depthWrite: false,
    });
    const shockwave = new Mesh(ringGeo, ringMat);
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.y = 0.05;
    group.add(shockwave);

    this.scene.add(group);
    this.explosions.push({ group, elapsed: 0, fireball, shockwave, innerSphere });
  }

  update(dt) {
    // Update grenade projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.elapsed += dt;
      const t = Math.min(1, p.elapsed / GRENADE_FUSE);

      // XZ interpolation
      p.mesh.position.x = p.startPos.x + (p.targetPos.x - p.startPos.x) * t;
      p.mesh.position.z = p.startPos.z + (p.targetPos.z - p.startPos.z) * t;

      // Two-phase Y — arc up-and-over to the target spot in the first ~70% of the
      // fuse, then sit on the ground "ticking" until detonation
      const arcT = Math.min(1, t / 0.7);
      const baseY = p.startPos.y + (p.targetPos.y - p.startPos.y) * arcT;
      const arc = GRENADE_ARC_HEIGHT * 4 * arcT * (1 - arcT);
      p.mesh.position.y = Math.max(0.1, baseY + arc);

      // Tumble while flying, then just slight jitter on ground
      if (t < 0.7) {
        p.mesh.rotation.x += dt * 9;
        p.mesh.rotation.z += dt * 6;
      } else {
        p.mesh.rotation.y += dt * 2;
      }

      if (t >= 1) {
        this.scene.remove(p.mesh);
        disposeObject(p.mesh);
        this.projectiles.splice(i, 1);
        this._spawnExplosion(p.targetPos.x, p.targetPos.z);
      }
    }

    // Update explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const e = this.explosions[i];
      e.elapsed += dt;
      const t = Math.min(1, e.elapsed / GRENADE_EXPLOSION_DURATION);

      // Inner fireball: quick pop, fade fast
      const innerScale = 0.5 + t * 2.5;
      e.innerSphere.scale.setScalar(innerScale);
      e.innerSphere.material.opacity = Math.max(0, 1 - t * 1.8);

      // Outer fireball: grows to explosion radius, fades slower
      const fireScale = 0.5 + t * GRENADE_EXPLOSION_RADIUS * 0.9;
      e.fireball.scale.setScalar(fireScale);
      e.fireball.material.opacity = 0.9 * (1 - t);

      // Shockwave: ground ring expanding to full radius
      const ringScale = 0.5 + t * GRENADE_EXPLOSION_RADIUS * 1.8;
      e.shockwave.scale.setScalar(ringScale);
      e.shockwave.material.opacity = 0.9 * (1 - t);

      if (t >= 1) {
        this.scene.remove(e.group);
        disposeObject(e.group);
        this.explosions.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      disposeObject(p.mesh);
    }
    for (const e of this.explosions) {
      this.scene.remove(e.group);
      disposeObject(e.group);
    }
    this.projectiles.length = 0;
    this.explosions.length = 0;
  }
}
