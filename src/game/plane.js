import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from "three";
import {
  PLANE_FORWARD_SPEED,
  PLANE_PITCH_SPEED,
  PLANE_YAW_SPEED,
  PLANE_CAMERA_OFFSET_Y,
  PLANE_CAMERA_OFFSET_Z,
} from "../config.js";

const FUSELAGE_LENGTH = 3.2;
const FUSELAGE_WIDTH = 0.6;
const WING_SPAN = 5.4;
const WING_CHORD = 0.95;
const TICK_RATE = 20;

function createPlaneMesh() {
  const root = new Group();

  const redMat = new MeshStandardMaterial({ color: "#cc2828", roughness: 0.55, metalness: 0.25 });
  const darkMat = new MeshStandardMaterial({ color: "#222222", roughness: 0.7, metalness: 0.4 });
  const glassMat = new MeshStandardMaterial({
    color: "#88ccff",
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
  });
  const wheelMat = new MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.9 });

  // Fuselage — nose points to -Z
  const fuselage = new Mesh(
    new BoxGeometry(FUSELAGE_WIDTH, FUSELAGE_WIDTH * 0.92, FUSELAGE_LENGTH),
    redMat,
  );
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  root.add(fuselage);

  // Cockpit windscreen
  const cockpit = new Mesh(
    new BoxGeometry(FUSELAGE_WIDTH * 0.85, FUSELAGE_WIDTH * 0.55, FUSELAGE_LENGTH * 0.4),
    glassMat,
  );
  cockpit.position.set(0, FUSELAGE_WIDTH * 0.55, -FUSELAGE_LENGTH * 0.05);
  root.add(cockpit);

  // Top wing (high-wing Cessna style) — slight forward of center
  const wings = new Mesh(new BoxGeometry(WING_SPAN, 0.12, WING_CHORD), redMat);
  wings.position.set(0, FUSELAGE_WIDTH * 0.55, -FUSELAGE_LENGTH * 0.1);
  wings.castShadow = true;
  root.add(wings);

  // Wing struts (small black supports under each wing)
  for (const sx of [-1, 1]) {
    const strut = new Mesh(new BoxGeometry(0.05, 0.55, 0.05), darkMat);
    strut.position.set(sx * WING_SPAN * 0.3, FUSELAGE_WIDTH * 0.25, -FUSELAGE_LENGTH * 0.1);
    strut.rotation.z = sx * 0.18;
    root.add(strut);
  }

  // Tail vertical fin
  const tailFin = new Mesh(new BoxGeometry(0.08, 0.7, 0.55), redMat);
  tailFin.position.set(0, FUSELAGE_WIDTH * 0.6, FUSELAGE_LENGTH * 0.45);
  tailFin.castShadow = true;
  root.add(tailFin);

  // Tail horizontal stabilizer
  const tailStab = new Mesh(new BoxGeometry(1.7, 0.08, 0.45), redMat);
  tailStab.position.set(0, FUSELAGE_WIDTH * 0.45, FUSELAGE_LENGTH * 0.45);
  tailStab.castShadow = true;
  root.add(tailStab);

  // Propeller hub + blades — spins on local Z
  const propeller = new Group();
  const hub = new Mesh(new CylinderGeometry(0.09, 0.09, 0.12, 8), darkMat);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  const blade = new Mesh(new BoxGeometry(1.4, 0.08, 0.06), darkMat);
  propeller.add(blade);
  propeller.position.set(0, 0, -FUSELAGE_LENGTH * 0.55);
  root.add(propeller);

  // Landing wheels (cosmetic)
  for (const sx of [-1, 1]) {
    const wheel = new Mesh(new CylinderGeometry(0.18, 0.18, 0.1, 12), wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.55, -FUSELAGE_WIDTH * 0.55, 0);
    wheel.castShadow = true;
    root.add(wheel);
  }
  // Tail wheel
  const tailWheel = new Mesh(new CylinderGeometry(0.08, 0.08, 0.06, 10), wheelMat);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -FUSELAGE_WIDTH * 0.4, FUSELAGE_LENGTH * 0.5);
  root.add(tailWheel);

  return { root, propeller };
}

/**
 * The flyable plane. Server is authoritative for position/rotation when nobody
 * is piloting; the local pilot drives state forward and sends updates to the
 * server at 20Hz.
 */
export class Plane {
  constructor(scene) {
    this.scene = scene;
    const { root, propeller } = createPlaneMesh();
    this.root = root;
    this.propeller = propeller;
    scene.add(root);

    this.pilotId = null;
    this.isLocalPilot = false;

    // Velocity is only used by the local pilot (sent on exit so the server
    // can autopilot). Stored as a Vector3 for convenience.
    this.velocity = new Vector3();
    this._propSpin = 0;

    // Interpolation state (when not piloting locally we tween to server state)
    this._prev = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    this._next = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 };
    this._t = 1;
  }

  /** Snap immediately (used on join + respawn). */
  snapTo(x, y, z, rx, ry, rz) {
    this.root.position.set(x, y, z);
    this.root.rotation.set(rx, ry, rz);
    this._prev.x = x; this._prev.y = y; this._prev.z = z;
    this._prev.rx = rx; this._prev.ry = ry; this._prev.rz = rz;
    this._next.x = x; this._next.y = y; this._next.z = z;
    this._next.rx = rx; this._next.ry = ry; this._next.rz = rz;
    this._t = 1;
  }

  /** Receive server state and queue interpolation toward it. */
  receiveState(x, y, z, rx, ry, rz) {
    if (this.isLocalPilot) return; // local pilot is the source of truth
    this._prev.x = this._next.x; this._prev.y = this._next.y; this._prev.z = this._next.z;
    this._prev.rx = this._next.rx; this._prev.ry = this._next.ry; this._prev.rz = this._next.rz;
    this._next.x = x; this._next.y = y; this._next.z = z;
    this._next.rx = rx; this._next.ry = ry; this._next.rz = rz;
    this._t = 0;
  }

  setPilot(pilotId, localPlayerId) {
    this.pilotId = pilotId;
    this.isLocalPilot = pilotId !== null && pilotId === localPlayerId;
  }

  /** Flight physics under the local pilot. Returns the new state. */
  flyLocal(input, dt) {
    const pitch = (input.isKeyDown("KeyS") ? 1 : 0) - (input.isKeyDown("KeyW") ? 1 : 0);
    const yaw = (input.isKeyDown("KeyA") ? 1 : 0) - (input.isKeyDown("KeyD") ? 1 : 0);

    // Apply pitch around local X (wing axis), yaw around local Y (vertical)
    if (pitch !== 0) this.root.rotateX(pitch * PLANE_PITCH_SPEED * dt);
    if (yaw !== 0) this.root.rotateY(yaw * PLANE_YAW_SPEED * dt);

    // Forward velocity in local -Z direction (nose)
    const forward = new Vector3(0, 0, -1).applyQuaternion(this.root.quaternion);
    this.velocity.copy(forward).multiplyScalar(PLANE_FORWARD_SPEED);
    this.root.position.addScaledVector(this.velocity, dt);

    this._propSpin -= dt * 30;
    this.propeller.rotation.z = this._propSpin;

    return {
      x: this.root.position.x,
      y: this.root.position.y,
      z: this.root.position.z,
      rx: this.root.rotation.x,
      ry: this.root.rotation.y,
      rz: this.root.rotation.z,
      vx: this.velocity.x,
      vy: this.velocity.y,
      vz: this.velocity.z,
    };
  }

  update(dt) {
    if (this.isLocalPilot) return; // local pilot already moved it this frame

    // Interpolate toward last server state
    this._t = Math.min(1, this._t + dt * TICK_RATE);
    const t = this._t;
    this.root.position.x = this._prev.x + (this._next.x - this._prev.x) * t;
    this.root.position.y = this._prev.y + (this._next.y - this._prev.y) * t;
    this.root.position.z = this._prev.z + (this._next.z - this._prev.z) * t;

    // Naive Euler interpolation — fine for slow-moving planes; for high-twist
    // flips it would tear, but we cap angular rates so this is acceptable.
    this.root.rotation.x = this._prev.rx + (this._next.rx - this._prev.rx) * t;
    this.root.rotation.y = this._prev.ry + (this._next.ry - this._prev.ry) * t;
    this.root.rotation.z = this._prev.rz + (this._next.rz - this._prev.rz) * t;

    // Spin propeller faster when piloted, slower when idle
    const spinRate = this.pilotId ? 30 : 5;
    this._propSpin -= dt * spinRate;
    this.propeller.rotation.z = this._propSpin;
  }

  /** Position the camera as a chase cam behind the plane. */
  applyCameraChase(camera) {
    const offset = new Vector3(0, PLANE_CAMERA_OFFSET_Y, PLANE_CAMERA_OFFSET_Z).applyQuaternion(this.root.quaternion);
    camera.position.copy(this.root.position).add(offset);
    camera.up.set(0, 1, 0);
    // Look slightly ahead of the plane along its forward axis
    const lookOffset = new Vector3(0, 0, -3).applyQuaternion(this.root.quaternion);
    camera.lookAt(this.root.position.clone().add(lookOffset));
  }

  distanceTo(point) {
    return this.root.position.distanceTo(point);
  }

  getCurrentVelocity() {
    return { vx: this.velocity.x, vy: this.velocity.y, vz: this.velocity.z };
  }

  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      o.geometry?.dispose?.();
      if (Array.isArray(o.material)) {
        for (const m of o.material) m?.dispose?.();
      } else {
        o.material?.dispose?.();
      }
    });
  }
}
