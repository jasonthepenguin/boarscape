import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { PHONE_WIDTH, PHONE_HEIGHT, PHONE_DEPTH, PHONE_FLIGHT_TIME, PHONE_ARC_HEIGHT } from "../config.js";

function createPhoneModel() {
  const group = new Group();

  // Phone body — dark metallic rectangle
  const bodyGeo = new BoxGeometry(PHONE_WIDTH, PHONE_HEIGHT, PHONE_DEPTH);
  const bodyMat = new MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.3, metalness: 0.8 });
  const body = new Mesh(bodyGeo, bodyMat);
  body.castShadow = true;
  group.add(body);

  // Screen — glowing blue, slightly inset on front
  const screenGeo = new BoxGeometry(PHONE_WIDTH * 0.85, PHONE_HEIGHT * 0.88, PHONE_DEPTH * 0.1);
  const screenMat = new MeshStandardMaterial({
    color: "#4488ff",
    emissive: "#2244aa",
    emissiveIntensity: 0.5,
    roughness: 0.1,
  });
  const screen = new Mesh(screenGeo, screenMat);
  screen.position.z = PHONE_DEPTH * 0.55;
  group.add(screen);

  // Camera bump on back
  const cameraGeo = new BoxGeometry(PHONE_WIDTH * 0.25, PHONE_WIDTH * 0.25, PHONE_DEPTH * 0.3);
  const cameraMat = new MeshStandardMaterial({ color: "#333333", roughness: 0.2, metalness: 0.9 });
  const cameraBump = new Mesh(cameraGeo, cameraMat);
  cameraBump.position.set(-PHONE_WIDTH * 0.25, PHONE_HEIGHT * 0.3, -PHONE_DEPTH * 0.65);
  group.add(cameraBump);

  // Scale up for visibility in the game world
  group.scale.setScalar(3);
  return group;
}

export class PhoneProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
  }

  /**
   * Spawn a phone that arcs from startPos to endPos.
   * @param {Vector3} startPos
   * @param {Vector3} endPos
   * @param {Function|null} onArrive — called when phone reaches target
   */
  spawn(startPos, endPos, onArrive) {
    const phone = createPhoneModel();
    phone.position.copy(startPos);
    this.scene.add(phone);

    this.projectiles.push({
      mesh: phone,
      startPos: startPos.clone(),
      endPos: endPos.clone(),
      elapsed: 0,
      duration: PHONE_FLIGHT_TIME,
      onArrive,
    });
  }

  update(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.elapsed += dt;
      const t = Math.min(1, p.elapsed / p.duration);

      // Linear XZ interpolation
      p.mesh.position.x = p.startPos.x + (p.endPos.x - p.startPos.x) * t;
      p.mesh.position.z = p.startPos.z + (p.endPos.z - p.startPos.z) * t;

      // Parabolic Y arc: peaks at t=0.5
      const baseY = p.startPos.y + (p.endPos.y - p.startPos.y) * t;
      const arc = PHONE_ARC_HEIGHT * 4 * t * (1 - t);
      p.mesh.position.y = baseY + arc;

      // Spin while flying
      p.mesh.rotation.x += dt * 12;
      p.mesh.rotation.z += dt * 8;

      // Arrived
      if (t >= 1) {
        this.scene.remove(p.mesh);
        p.onArrive?.();
        this.projectiles.splice(i, 1);
      }
    }
  }
}
