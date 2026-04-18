import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import {
  PLANE_MAX_SPEED,
  PLANE_THROTTLE_ACCEL,
  PLANE_THROTTLE_DECEL,
  PLANE_THROTTLE_DRAG,
  PLANE_MOUSE_PITCH_SENS,
  PLANE_MOUSE_YAW_SENS,
  PLANE_MIN_Y,
  PLANE_MAX_Y,
  PLANE_BOUNDS_MARGIN,
  PLANE_CAMERA_OFFSET_Y,
  PLANE_CAMERA_OFFSET_Z,
  PLANE_AIM_OFFSET_Y,
  PLANE_AIM_DISTANCE,
  FIELD_SIZE,
} from "../config.js";

const FUSELAGE_LENGTH = 3.2;
const FUSELAGE_WIDTH = 0.6;
const WING_SPAN = 5.4;
const WING_CHORD = 0.95;
const TICK_RATE = 20;

function createPlaneMesh() {
  const root = new Group();

  const bodyMat = new MeshStandardMaterial({ color: "#0c0c0c", roughness: 0.45, metalness: 0.55 });
  const darkMat = new MeshStandardMaterial({ color: "#222222", roughness: 0.7, metalness: 0.4 });
  const glassMat = new MeshStandardMaterial({
    color: "#88ccff",
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.55,
  });
  const wheelMat = new MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.9 });
  // Bright white logo material — unaffected by lighting so it pops against the black body
  const logoMat = new MeshBasicMaterial({ color: "#ffffff" });

  // Fuselage — nose points to -Z
  const fuselage = new Mesh(
    new BoxGeometry(FUSELAGE_WIDTH, FUSELAGE_WIDTH * 0.92, FUSELAGE_LENGTH),
    bodyMat,
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
  const wings = new Mesh(new BoxGeometry(WING_SPAN, 0.12, WING_CHORD), bodyMat);
  wings.position.set(0, FUSELAGE_WIDTH * 0.55, -FUSELAGE_LENGTH * 0.1);
  wings.castShadow = true;
  root.add(wings);

  // White X logos — one per wing-half, sitting flush on the wing's top surface.
  // Each X is two thin bars rotated +/-45° around Y so they cross flat on the wing.
  const wingTopY = FUSELAGE_WIDTH * 0.55 + 0.06; // wing center + half thickness
  const wingZ = -FUSELAGE_LENGTH * 0.1;
  const barGeo = new BoxGeometry(0.75, 0.03, 0.13);
  for (const sx of [-1, 1]) {
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new Mesh(barGeo, logoMat);
      bar.position.set(sx * 1.5, wingTopY + 0.005, wingZ);
      bar.rotation.y = rot;
      root.add(bar);
    }
  }

  // Wing struts (small black supports under each wing)
  for (const sx of [-1, 1]) {
    const strut = new Mesh(new BoxGeometry(0.05, 0.55, 0.05), darkMat);
    strut.position.set(sx * WING_SPAN * 0.3, FUSELAGE_WIDTH * 0.25, -FUSELAGE_LENGTH * 0.1);
    strut.rotation.z = sx * 0.18;
    root.add(strut);
  }

  // Tail vertical fin
  const tailFin = new Mesh(new BoxGeometry(0.08, 0.7, 0.55), bodyMat);
  tailFin.position.set(0, FUSELAGE_WIDTH * 0.6, FUSELAGE_LENGTH * 0.45);
  tailFin.castShadow = true;
  root.add(tailFin);

  // Tail horizontal stabilizer
  const tailStab = new Mesh(new BoxGeometry(1.7, 0.08, 0.45), bodyMat);
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
    this.speed = 0; // current throttle speed for the local pilot
    this._propSpin = 0;
    this.rider = null; // boar root currently seated in the cockpit

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
    if (!pilotId) {
      // Reset throttle whenever the cockpit empties so the next pilot
      // doesn't inherit a moving plane.
      this.speed = 0;
    }
  }

  /**
   * Reparent a boar root into the plane's cockpit so the model is visible
   * while flying. Call detachRider() before exit.
   */
  attachRider(boarRoot) {
    if (!boarRoot || this.rider === boarRoot) return;
    if (this.rider) this.detachRider();
    this.root.add(boarRoot);
    boarRoot.position.set(0, 0.15, -0.05);
    boarRoot.rotation.set(0, Math.PI, 0);
    boarRoot.scale.setScalar(0.5);
    boarRoot.visible = true;
    this.rider = boarRoot;
  }

  detachRider() {
    if (!this.rider) return null;
    const r = this.rider;
    this.rider = null;
    return r;
  }

  /** Flight physics under the local pilot. Returns the new state. */
  flyLocal(input, dt) {
    // Throttle (W/S)
    if (input.isKeyDown("KeyW")) {
      this.speed = Math.min(PLANE_MAX_SPEED, this.speed + PLANE_THROTTLE_ACCEL * dt);
    } else if (input.isKeyDown("KeyS")) {
      this.speed = Math.max(0, this.speed - PLANE_THROTTLE_DECEL * dt);
    } else {
      this.speed = Math.max(0, this.speed - PLANE_THROTTLE_DRAG * dt);
    }

    // Pitch + yaw from mouse look (pointer-locked while flying)
    const look = input.consumeLookDelta();
    // Mouse up (negative dy) → nose up; mouse right (positive dx) → yaw right
    const pitchDelta = -look.dy * PLANE_MOUSE_PITCH_SENS;
    const yawDelta = -look.dx * PLANE_MOUSE_YAW_SENS;
    if (pitchDelta !== 0) this.root.rotateX(pitchDelta);
    if (yawDelta !== 0) this.root.rotateY(yawDelta);

    // Forward velocity in local -Z direction (nose)
    const forward = new Vector3(0, 0, -1).applyQuaternion(this.root.quaternion);
    this.velocity.copy(forward).multiplyScalar(this.speed);
    this.root.position.addScaledVector(this.velocity, dt);

    // Clamp to world bounds + altitude limits
    const limit = FIELD_SIZE / 2 - PLANE_BOUNDS_MARGIN;
    const before = { x: this.root.position.x, z: this.root.position.z };
    this.root.position.x = Math.max(-limit, Math.min(limit, this.root.position.x));
    this.root.position.z = Math.max(-limit, Math.min(limit, this.root.position.z));
    this.root.position.y = Math.max(PLANE_MIN_Y, Math.min(PLANE_MAX_Y, this.root.position.y));
    // If we hit a wall this frame, kill forward speed so we don't grind into it
    if (this.root.position.x !== before.x || this.root.position.z !== before.z) {
      this.speed = 0;
      this.velocity.set(0, 0, 0);
    }

    // Propeller spins faster as throttle climbs
    const spinRate = 6 + (this.speed / PLANE_MAX_SPEED) * 30;
    this._propSpin -= dt * spinRate;
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
    // Look at a point ahead of and above the plane so the centered crosshair
    // sits above the model rather than on it.
    const lookOffset = new Vector3(0, PLANE_AIM_OFFSET_Y, -PLANE_AIM_DISTANCE).applyQuaternion(this.root.quaternion);
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
