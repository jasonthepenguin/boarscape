import {
  AdditiveBlending,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { BULLET_HIT_RADIUS, BULLET_LIFETIME, BULLET_SPEED } from "../config.js";

const BULLET_LENGTH = 0.7;
const BULLET_WIDTH = 0.09;
const HIT_FLASH_DURATION = 0.25;

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

function createBulletMesh() {
  const group = new Group();

  // Inner core — bright yellow-white tracer
  const coreGeo = new BoxGeometry(BULLET_WIDTH, BULLET_WIDTH, BULLET_LENGTH);
  const coreMat = new MeshBasicMaterial({
    color: 0xffeec0,
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  group.add(new Mesh(coreGeo, coreMat));

  // Outer halo — wider orange glow for the flashy look
  const haloGeo = new BoxGeometry(BULLET_WIDTH * 3, BULLET_WIDTH * 3, BULLET_LENGTH * 1.4);
  const haloMat = new MeshBasicMaterial({
    color: 0xff7a22,
    transparent: true,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  group.add(new Mesh(haloGeo, haloMat));

  return group;
}

function createHitFlash() {
  const geo = new SphereGeometry(0.4, 12, 8);
  const mat = new MeshBasicMaterial({
    color: 0xffe7a8,
    transparent: true,
    opacity: 1,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  return new Mesh(geo, mat);
}

/**
 * Bullet manager — spawns flashy tracer projectiles, animates them,
 * checks collisions against NPCs, and pops a small flash on impact.
 *
 * `getNpcs` returns the NpcManager's `npcs` map (id → entry with `root`,
 * `dead`). `onHit(npcId)` is called when a bullet finds an NPC.
 */
export class BulletManager {
  constructor(scene, getNpcs, onHit) {
    this.scene = scene;
    this.getNpcs = getNpcs;
    this.onHit = onHit;
    this.bullets = [];
    this.flashes = [];
    this._tmp = new Vector3();
  }

  spawn(startPos, direction) {
    const mesh = createBulletMesh();
    mesh.position.copy(startPos);
    // Orient so length aligns with travel direction (object's -Z faces target)
    mesh.lookAt(startPos.clone().add(direction));
    this.scene.add(mesh);
    this.bullets.push({
      mesh,
      direction: direction.clone().normalize(),
      elapsed: 0,
    });
  }

  _spawnFlash(pos) {
    const mesh = createHitFlash();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.flashes.push({ mesh, elapsed: 0 });
  }

  update(dt) {
    const npcs = this.getNpcs?.();
    const radiusSq = BULLET_HIT_RADIUS * BULLET_HIT_RADIUS;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.elapsed += dt;
      b.mesh.position.addScaledVector(b.direction, BULLET_SPEED * dt);

      // Hit-check against NPCs (centered on the NPC torso, ~0.9m up)
      let hitId = null;
      if (npcs) {
        for (const [id, npc] of npcs) {
          if (npc.dead || !npc.root) continue;
          const np = npc.root.position;
          const dx = b.mesh.position.x - np.x;
          const dy = b.mesh.position.y - (np.y + 0.9);
          const dz = b.mesh.position.z - np.z;
          if (dx * dx + dy * dy + dz * dz < radiusSq) {
            hitId = id;
            break;
          }
        }
      }

      if (hitId !== null) {
        this._spawnFlash(b.mesh.position);
        this.onHit?.(hitId);
        this.scene.remove(b.mesh);
        disposeObject(b.mesh);
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.elapsed >= BULLET_LIFETIME) {
        this.scene.remove(b.mesh);
        disposeObject(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    // Animate hit flashes — quick expansion + fade
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.elapsed += dt;
      const t = Math.min(1, f.elapsed / HIT_FLASH_DURATION);
      const scale = 0.6 + t * 1.8;
      f.mesh.scale.setScalar(scale);
      f.mesh.material.opacity = 1 - t;
      if (t >= 1) {
        this.scene.remove(f.mesh);
        disposeObject(f.mesh);
        this.flashes.splice(i, 1);
      }
    }
  }

  dispose() {
    for (const b of this.bullets) {
      this.scene.remove(b.mesh);
      disposeObject(b.mesh);
    }
    for (const f of this.flashes) {
      this.scene.remove(f.mesh);
      disposeObject(f.mesh);
    }
    this.bullets.length = 0;
    this.flashes.length = 0;
  }
}
