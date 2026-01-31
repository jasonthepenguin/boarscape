import { MathUtils, Quaternion, Vector3 } from "three";

function damp(current, target, lambda, dt) {
  // Exponential damping (frame-rate independent)
  return MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class ThirdPersonController {
  constructor({
    camera,
    target,
    domElement,
    environment,
    targetHeight = 1.25,
    playerRadius = 0.55,
    onJump = null,
  }) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;
    this.environment = environment;
    this.onJump = onJump;

    // Player params
    this.targetHeight = targetHeight;
    this.playerRadius = playerRadius;
    this.walkSpeed = 4.6;
    this.runSpeed = 7.4;
    this.jumpSpeed = 7.2;
    this.gravity = 18.5;
    this.rotationSpeed = 14;

    // Camera params
    this.distance = 8.5;
    this.minDistance = 3.6;
    this.maxDistance = 18.0;
    this.yaw = 0; // around Y axis
    this.phi = 1.12; // polar angle from +Y (0..PI)
    this.minPhi = 0.55;
    this.maxPhi = 1.45;
    this.cameraSmooth = 14;

    // State
    this.velocity = new Vector3(0, 0, 0);
    this.onGround = true;
    this._keysDown = new Set();
    this._jumpRequested = false;
    this._dragging = false;
    this._pointerId = null;
    this._lastPointerX = 0;
    this._lastPointerY = 0;

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

    // Bind handlers
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);

    domElement.addEventListener("pointerdown", this._onPointerDown);
    domElement.addEventListener("pointermove", this._onPointerMove);
    domElement.addEventListener("pointerup", this._onPointerUp);
    domElement.addEventListener("pointercancel", this._onPointerUp);
    domElement.addEventListener("wheel", this._onWheel, { passive: false });
    domElement.addEventListener("contextmenu", this._onContextMenu);
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);

    this.domElement.removeEventListener("pointerdown", this._onPointerDown);
    this.domElement.removeEventListener("pointermove", this._onPointerMove);
    this.domElement.removeEventListener("pointerup", this._onPointerUp);
    this.domElement.removeEventListener("pointercancel", this._onPointerUp);
    this.domElement.removeEventListener("wheel", this._onWheel);
    this.domElement.removeEventListener("contextmenu", this._onContextMenu);
  }

  _onKeyDown(e) {
    this._keysDown.add(e.code);
    if (e.code === "Space" && !e.repeat) {
      this._jumpRequested = true;
    }
  }

  _onKeyUp(e) {
    this._keysDown.delete(e.code);
  }

  _onPointerDown(e) {
    if (e.button !== 0) return;
    this._dragging = true;
    this._pointerId = e.pointerId;
    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;
    this.domElement.setPointerCapture?.(e.pointerId);
    this.domElement.classList.add("dragging");
  }

  _onPointerMove(e) {
    if (!this._dragging) return;
    if (this._pointerId != null && e.pointerId !== this._pointerId) return;
    const dx = e.clientX - this._lastPointerX;
    const dy = e.clientY - this._lastPointerY;
    this._lastPointerX = e.clientX;
    this._lastPointerY = e.clientY;

    const rotateSpeed = 0.0042;
    this.yaw -= dx * rotateSpeed;
    this.phi = clamp(this.phi + dy * rotateSpeed, this.minPhi, this.maxPhi);
  }

  _onPointerUp(e) {
    if (this._pointerId != null && e.pointerId !== this._pointerId) return;
    this._dragging = false;
    this._pointerId = null;
    this.domElement.classList.remove("dragging");
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    this.distance = clamp(this.distance + delta * 0.85, this.minDistance, this.maxDistance);
  }

  update(dt) {
    if (!this.target) return;

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

    const xInput = (this._keysDown.has("KeyD") ? 1 : 0) + (this._keysDown.has("KeyA") ? -1 : 0);
    const zInput = (this._keysDown.has("KeyW") ? 1 : 0) + (this._keysDown.has("KeyS") ? -1 : 0);

    this._moveDir.set(0, 0, 0);
    if (xInput !== 0) this._moveDir.addScaledVector(this._camRight, xInput);
    if (zInput !== 0) this._moveDir.addScaledVector(this._camForward, zInput);

    const hasMove = this._moveDir.lengthSq() > 1e-6;
    if (hasMove) this._moveDir.normalize();

    const isRunning = this._keysDown.has("ShiftLeft") || this._keysDown.has("ShiftRight");
    const maxSpeed = isRunning ? this.runSpeed : this.walkSpeed;
    this._desiredVel.copy(this._moveDir).multiplyScalar(hasMove ? maxSpeed : 0);

    const accel = hasMove ? 18 : 14;
    this.velocity.x = damp(this.velocity.x, this._desiredVel.x, accel, dt);
    this.velocity.z = damp(this.velocity.z, this._desiredVel.z, accel, dt);

    // Jump/gravity
    if (this.onGround && this._jumpRequested) {
      this.velocity.y = this.jumpSpeed;
      this.onGround = false;
      if (this.onJump) this.onJump();
    }
    this._jumpRequested = false;

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
        const dx = this.target.position.x - c.position.x;
        const dz = this.target.position.z - c.position.z;
        const r = this.playerRadius + c.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.0001;
          const nx = dx / d;
          const nz = dz / d;
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

