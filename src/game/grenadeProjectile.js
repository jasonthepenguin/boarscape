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
  Vector3,
} from "three";
import {
  GRENADE_ARC_HEIGHT,
  GRENADE_EXPLOSION_DURATION,
  GRENADE_EXPLOSION_RADIUS,
  GRENADE_FUSE,
} from "../config.js";

/**
 * Sample a point along the grenade's flight arc at parameter t in [0, 1].
 * Mirrors the actual flight math in GrenadeManager.update.
 */
function arcPoint(start, end, t, out) {
  out.x = start.x + (end.x - start.x) * t;
  out.z = start.z + (end.z - start.z) * t;
  const arcT = Math.min(1, t / 0.7);
  const baseY = start.y + (end.y - start.y) * arcT;
  const arc = GRENADE_ARC_HEIGHT * 4 * arcT * (1 - arcT);
  out.y = Math.max(0.1, baseY + arc);
  return out;
}

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

const TRAJECTORY_DOTS = 22;
const DOT_BASE_OPACITY = 0.18;
const DOT_PULSE_OPACITY = 0.62;
const DOT_FLOW_SPEED = 3.2;
const DOT_RADIUS = 0.09;

/**
 * Renders a previewed grenade trajectory: a chain of additive orange dots
 * along the arc + a pulsing target ring at the landing point. The dot opacities
 * flow toward the target so the eye reads the throw direction immediately.
 */
export class GrenadeAimer {
  constructor(scene) {
    this.scene = scene;
    this.group = new Group();
    this.group.visible = false;
    this._timer = 0;
    this._tmp = new Vector3();
    this._start = new Vector3();
    this._end = new Vector3();

    // Trajectory dots
    this.dots = [];
    const sharedGeo = new SphereGeometry(DOT_RADIUS, 8, 6);
    for (let i = 0; i < TRAJECTORY_DOTS; i++) {
      const mat = new MeshBasicMaterial({
        color: 0xff8c3a,
        transparent: true,
        opacity: DOT_BASE_OPACITY,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const dot = new Mesh(sharedGeo, mat);
      this.group.add(dot);
      this.dots.push(dot);
    }

    // Target ring on the ground
    const ringGeo = new RingGeometry(0.5, 0.65, 32);
    const ringMat = new MeshBasicMaterial({
      color: 0xff8c3a,
      transparent: true,
      opacity: 0.7,
      side: DoubleSide,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.targetRing = new Mesh(ringGeo, ringMat);
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.position.y = 0.05;
    this.group.add(this.targetRing);

    // Inner crosshair dot at landing point
    const centerGeo = new SphereGeometry(0.12, 10, 8);
    const centerMat = new MeshBasicMaterial({
      color: 0xffd6a8,
      transparent: true,
      opacity: 0.9,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    this.targetCenter = new Mesh(centerGeo, centerMat);
    this.targetCenter.position.y = 0.2;
    this.group.add(this.targetCenter);

    scene.add(this.group);
  }

  show() {
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  /**
   * Update trajectory geometry from a start point (player hand height) to a
   * target point on the ground. Caller is responsible for clamping target
   * to the throw range.
   */
  update(dt, startX, startY, startZ, targetX, targetZ) {
    if (!this.group.visible) return;
    this._timer += dt;
    this._start.set(startX, startY, startZ);
    this._end.set(targetX, 0, targetZ);

    const flightFraction = 0.7; // dots cover the in-flight portion only
    for (let i = 0; i < this.dots.length; i++) {
      const segT = (i + 1) / (this.dots.length + 1) * flightFraction;
      arcPoint(this._start, this._end, segT, this._tmp);
      this.dots[i].position.copy(this._tmp);

      // Flowing wave: dots brighten in sequence toward the target
      const phase = i / this.dots.length;
      const wave = (Math.sin(this._timer * DOT_FLOW_SPEED - phase * Math.PI * 2) + 1) * 0.5;
      this.dots[i].material.opacity = DOT_BASE_OPACITY + wave * DOT_PULSE_OPACITY;
    }

    // Target ring: gentle pulse + slow rotation
    this.targetRing.position.set(targetX, 0.05, targetZ);
    const ringPulse = 1.0 + 0.18 * Math.sin(this._timer * 4);
    this.targetRing.scale.setScalar(ringPulse);
    this.targetRing.rotation.z = this._timer * 0.6;

    this.targetCenter.position.set(targetX, 0.2, targetZ);
    const centerPulse = 0.85 + 0.15 * Math.sin(this._timer * 6);
    this.targetCenter.material.opacity = centerPulse;
  }

  dispose() {
    for (const d of this.dots) {
      d.material.dispose();
    }
    this.dots[0]?.geometry.dispose();
    this.targetRing.geometry.dispose();
    this.targetRing.material.dispose();
    this.targetCenter.geometry.dispose();
    this.targetCenter.material.dispose();
    this.scene.remove(this.group);
  }
}
