import { MathUtils, Quaternion, Vector3 } from "three";
import {
  WALK_SPEED,
  RUN_SPEED,
  JUMP_SPEED,
  GRAVITY,
  ROTATION_SPEED,
  CAMERA_DISTANCE,
  CAMERA_MIN_DISTANCE,
  CAMERA_MAX_DISTANCE,
  CAMERA_DEFAULT_PHI,
  CAMERA_MIN_PHI,
  CAMERA_MAX_PHI,
  CAMERA_SMOOTH,
  CAMERA_ROTATE_SPEED,
} from "../config.js";

function damp(current, target, lambda, dt) {
  return MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class ThirdPersonController {
  constructor({
    camera,
    target,
    input,
    environment,
    targetHeight = 1.25,
    playerRadius = 0.55,
    onJump = null,
    onMovementChange = null,
  }) {
    this.camera = camera;
    this.target = target;
    this.input = input;
    this.environment = environment;
    this.onJump = onJump;
    this.onMovementChange = onMovementChange;
    this._isMoving = false;

    // Player params
    this.targetHeight = targetHeight;
    this.playerRadius = playerRadius;
    this.walkSpeed = WALK_SPEED;
    this.runSpeed = RUN_SPEED;
    this.jumpSpeed = JUMP_SPEED;
    this.gravity = GRAVITY;
    this.rotationSpeed = ROTATION_SPEED;

    // Camera params
    this.distance = CAMERA_DISTANCE;
    this.minDistance = CAMERA_MIN_DISTANCE;
    this.maxDistance = CAMERA_MAX_DISTANCE;
    this.yaw = 0;
    this.phi = CAMERA_DEFAULT_PHI;
    this.minPhi = CAMERA_MIN_PHI;
    this.maxPhi = CAMERA_MAX_PHI;
    this.cameraSmooth = CAMERA_SMOOTH;

    // State
    this.velocity = new Vector3(0, 0, 0);
    this.onGround = true;

    // Temps
    this._up = new Vector3(0, 1, 0);
    this._camForward = new Vector3();
    this._camRight = new Vector3();
    this._moveDir = new Vector3();
    this._desiredVel = new Vector3();
    this._targetPos = new Vector3();
    this._desiredCameraPos = new Vector3();
    this._cameraOffset = new Vector3();
    this._desiredFacing = new Quaternion();
  }

  update(dt) {
    if (!this.target) return;

    // Consume input deltas
    const { dx, dy } = this.input.consumePointerDelta();
    if (dx !== 0 || dy !== 0) {
      this.yaw -= dx * CAMERA_ROTATE_SPEED;
      this.phi = clamp(this.phi + dy * CAMERA_ROTATE_SPEED, this.minPhi, this.maxPhi);
    }

    const wheelDelta = this.input.consumeWheelDelta();
    if (wheelDelta !== 0) {
      this.distance = clamp(this.distance + wheelDelta * 0.85, this.minDistance, this.maxDistance);
    }

    // Target point for camera
    this._targetPos.copy(this.target.position);
    this._targetPos.y += this.targetHeight;

    // Desired camera position from spherical coords
    const sinPhi = Math.sin(this.phi);
    const cosPhi = Math.cos(this.phi);
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    this._cameraOffset.set(
      sinPhi * sinYaw * this.distance,
      cosPhi * this.distance,
      sinPhi * cosYaw * this.distance,
    );
    this._desiredCameraPos.copy(this._targetPos).add(this._cameraOffset);

    // Smooth camera
    const t = 1 - Math.exp(-this.cameraSmooth * dt);
    this.camera.position.lerp(this._desiredCameraPos, t);
    this.camera.lookAt(this._targetPos);

    // Movement input in camera space (horizontal only)
    this.camera.getWorldDirection(this._camForward);
    this._camForward.y = 0;
    if (this._camForward.lengthSq() < 1e-6) {
      this._camForward.set(0, 0, -1);
    } else {
      this._camForward.normalize();
    }
    this._camRight.crossVectors(this._camForward, this._up).normalize();

    const xInput =
      (this.input.isKeyDown("KeyD") ? 1 : 0) +
      (this.input.isKeyDown("KeyA") ? -1 : 0);
    const zInput =
      (this.input.isKeyDown("KeyW") ? 1 : 0) +
      (this.input.isKeyDown("KeyS") ? -1 : 0);

    this._moveDir.set(0, 0, 0);
    if (xInput !== 0) this._moveDir.addScaledVector(this._camRight, xInput);
    if (zInput !== 0) this._moveDir.addScaledVector(this._camForward, zInput);

    const hasMove = this._moveDir.lengthSq() > 1e-6;
    if (hasMove) this._moveDir.normalize();

    // Notify when movement state changes
    if (hasMove !== this._isMoving) {
      this._isMoving = hasMove;
      if (this.onMovementChange) this.onMovementChange(hasMove);
    }

    const isRunning =
      this.input.isKeyDown("ShiftLeft") || this.input.isKeyDown("ShiftRight");
    const maxSpeed = isRunning ? this.runSpeed : this.walkSpeed;
    this._desiredVel.copy(this._moveDir).multiplyScalar(hasMove ? maxSpeed : 0);

    const accel = hasMove ? 18 : 14;
    this.velocity.x = damp(this.velocity.x, this._desiredVel.x, accel, dt);
    this.velocity.z = damp(this.velocity.z, this._desiredVel.z, accel, dt);

    // Jump/gravity
    if (this.onGround && this.input.wasJumpPressed()) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
      if (this.onJump) this.onJump();
    }

    if (!this.onGround) {
      this.velocity.y -= this.gravity * dt;
    }

    // Integrate
    this.target.position.x += this.velocity.x * dt;
    this.target.position.y += this.velocity.y * dt;
    this.target.position.z += this.velocity.z * dt;

    // Ground collision
    const groundY = this.environment?.groundY ?? 0;
    if (this.target.position.y <= groundY) {
      this.target.position.y = groundY;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // World bounds
    const half = this.environment?.boundsHalfSize ?? 260;
    const margin = 2.0;
    this.target.position.x = clamp(this.target.position.x, -half + margin, half - margin);
    this.target.position.z = clamp(this.target.position.z, -half + margin, half - margin);

    // Tree collisions (2D circles)
    const colliders = this.environment?.treeColliders ?? [];
    if (colliders.length) {
      for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        const cdx = this.target.position.x - c.position.x;
        const cdz = this.target.position.z - c.position.z;
        const r = this.playerRadius + c.radius;
        const d2 = cdx * cdx + cdz * cdz;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.0001;
          const nx = cdx / d;
          const nz = cdz / d;
          const push = r - d;
          this.target.position.x += nx * push;
          this.target.position.z += nz * push;

          // Cancel velocity into the collider normal
          const vn = this.velocity.x * nx + this.velocity.z * nz;
          if (vn < 0) {
            this.velocity.x -= vn * nx;
            this.velocity.z -= vn * nz;
          }
        }
      }
    }

    // Face movement direction
    if (hasMove) {
      const facingYaw = Math.atan2(this._moveDir.x, this._moveDir.z);
      this._desiredFacing.setFromAxisAngle(this._up, facingYaw);
      const rt = 1 - Math.exp(-this.rotationSpeed * dt);
      this.target.quaternion.slerp(this._desiredFacing, rt);
    }
  }
}
