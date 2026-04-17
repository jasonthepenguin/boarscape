import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
} from "three";
import { SWOOP_DURATION, SWOOP_LIFT_HEIGHT } from "../config.js";

const RING_RADIUS = 0.4;
const RING_TUBE = 0.03;
const POLE_LENGTH = 1.4;
const POLE_RADIUS = 0.035;
const POLE_COLOR = 0x8b5a2b;
const RING_COLOR = 0xc49a3a;
const MESH_COLOR = 0xf5e6a8;

/**
 * Builds a butterfly-net: stick with a gold ring and webbing at the tip.
 * The origin sits at the handle (grip end); +Z points toward the ring.
 */
function createNetModel() {
  const group = new Group();

  // Pole — cylinder oriented along Z
  const poleGeo = new CylinderGeometry(POLE_RADIUS, POLE_RADIUS, POLE_LENGTH, 8);
  poleGeo.rotateX(Math.PI / 2);
  poleGeo.translate(0, 0, POLE_LENGTH / 2);
  const poleMat = new MeshBasicMaterial({ color: POLE_COLOR });
  const pole = new Mesh(poleGeo, poleMat);
  group.add(pole);

  // Ring at the tip, facing forward (normal = +Z)
  const ringGeo = new TorusGeometry(RING_RADIUS, RING_TUBE, 8, 20);
  const ringMat = new MeshBasicMaterial({ color: RING_COLOR, side: DoubleSide });
  const ring = new Mesh(ringGeo, ringMat);
  ring.position.z = POLE_LENGTH;
  group.add(ring);

  // Webbing inside the ring — radial spokes + a few concentric rings, in the XY plane at Z=tip
  const positions = [];
  const segments = 10;
  const rings = 2;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(0, 0, 0);
    positions.push(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0);
  }
  for (let r = 1; r <= rings; r++) {
    const rad = (r / (rings + 1)) * RING_RADIUS;
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2;
      const a2 = ((i + 1) / segments) * Math.PI * 2;
      positions.push(Math.cos(a1) * rad, Math.sin(a1) * rad, 0);
      positions.push(Math.cos(a2) * rad, Math.sin(a2) * rad, 0);
    }
  }
  const webGeo = new BufferGeometry();
  webGeo.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const webMat = new LineBasicMaterial({ color: MESH_COLOR, transparent: true, opacity: 0.9 });
  const web = new LineSegments(webGeo, webMat);
  web.position.z = POLE_LENGTH;
  group.add(web);

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

function setMaterialOpacity(group, opacity) {
  group.traverse((o) => {
    if (o.material) {
      o.material.transparent = true;
      o.material.opacity = opacity;
    }
  });
}

// Offset on the player's back where the net is "held" — tweaked for quadrupedal boar.
const HELD_POSITION = new Vector3(0.35, 1.3, 0.1);
// Tilt the pole up/outward so it reads as being carried.
const HELD_EULER_X = -0.4;
const HELD_EULER_Y = 0.25;

export class NetManager {
  constructor(scene) {
    this.scene = scene;
    this.heldNets = new Map(); // playerRoot -> mesh
    this.animations = []; // active swoop animations
  }

  isEquipped(playerRoot) {
    return this.heldNets.has(playerRoot);
  }

  equip(playerRoot) {
    if (!playerRoot || this.heldNets.has(playerRoot)) return;
    const mesh = createNetModel();
    mesh.position.copy(HELD_POSITION);
    mesh.rotation.set(HELD_EULER_X, HELD_EULER_Y, 0);
    playerRoot.add(mesh);
    this.heldNets.set(playerRoot, mesh);
  }

  unequip(playerRoot) {
    const mesh = this.heldNets.get(playerRoot);
    if (!mesh) return;
    playerRoot.remove(mesh);
    disposeObject(mesh);
    this.heldNets.delete(playerRoot);
  }

  /**
   * Kick off the swoop animation. Detaches the net from the attacker,
   * animates it from the hand position to arc over and capture the NPC,
   * then lifts and fades out. Does NOT kill the NPC — server does that.
   */
  swoop(attackerRoot, npcRoot) {
    if (!attackerRoot || !npcRoot) return;

    // If the attacker has a held net, reparent it to the scene preserving world transform.
    // If not (e.g. we missed the equip event), just create a fresh mesh at attacker's position.
    let mesh = this.heldNets.get(attackerRoot);
    const worldPos = new Vector3();
    const worldQuat = new Quaternion();

    if (mesh) {
      mesh.getWorldPosition(worldPos);
      mesh.getWorldQuaternion(worldQuat);
      attackerRoot.remove(mesh);
      this.scene.add(mesh);
      mesh.position.copy(worldPos);
      mesh.quaternion.copy(worldQuat);
      this.heldNets.delete(attackerRoot);
    } else {
      mesh = createNetModel();
      attackerRoot.getWorldPosition(worldPos);
      worldPos.y += HELD_POSITION.y;
      this.scene.add(mesh);
      mesh.position.copy(worldPos);
    }

    this.animations.push({
      mesh,
      npcRoot,
      startPos: worldPos.clone(),
      elapsed: 0,
    });
  }

  update(dt) {
    const npcPos = new Vector3();

    for (let i = this.animations.length - 1; i >= 0; i--) {
      const a = this.animations[i];
      a.elapsed += dt;
      const t = Math.min(1, a.elapsed / SWOOP_DURATION);

      // NPC may despawn mid-animation — bail cleanly
      if (!a.npcRoot.parent) {
        this.scene.remove(a.mesh);
        disposeObject(a.mesh);
        this.animations.splice(i, 1);
        continue;
      }

      a.npcRoot.getWorldPosition(npcPos);

      // Three phases:
      //   0.0–0.4: arc up above the NPC (wind-up + reach)
      //   0.4–0.7: descend onto the NPC (capture)
      //   0.7–1.0: lift up past the NPC and fade out
      const overX = npcPos.x;
      const overZ = npcPos.z;
      const apexY = npcPos.y + SWOOP_LIFT_HEIGHT + 1.0;
      const captureY = npcPos.y + 1.0;

      if (t < 0.4) {
        const pt = t / 0.4;
        const e = pt * pt * (3 - 2 * pt); // smoothstep
        a.mesh.position.x = a.startPos.x + (overX - a.startPos.x) * e;
        a.mesh.position.z = a.startPos.z + (overZ - a.startPos.z) * e;
        a.mesh.position.y = a.startPos.y + (apexY - a.startPos.y) * e;
        // Rotate the pole so it points downward as it arrives
        a.mesh.rotation.x = -0.4 + (Math.PI / 2) * e;
      } else if (t < 0.7) {
        const pt = (t - 0.4) / 0.3;
        a.mesh.position.x = overX;
        a.mesh.position.z = overZ;
        a.mesh.position.y = apexY + (captureY - apexY) * pt;
        a.mesh.rotation.x = Math.PI / 2 - 0.4; // pole tilted, ring scooping down
      } else {
        const pt = (t - 0.7) / 0.3;
        a.mesh.position.x = overX;
        a.mesh.position.z = overZ;
        a.mesh.position.y = captureY + SWOOP_LIFT_HEIGHT * pt;
        a.mesh.rotation.x = Math.PI / 2 - 0.4;
        setMaterialOpacity(a.mesh, 1 - pt);
      }

      if (t >= 1) {
        this.scene.remove(a.mesh);
        disposeObject(a.mesh);
        this.animations.splice(i, 1);
      }
    }
  }

  /** Remove everything — call on scene teardown. */
  dispose() {
    for (const mesh of this.heldNets.values()) {
      mesh.parent?.remove(mesh);
      disposeObject(mesh);
    }
    this.heldNets.clear();
    for (const a of this.animations) {
      this.scene.remove(a.mesh);
      disposeObject(a.mesh);
    }
    this.animations.length = 0;
  }
}
