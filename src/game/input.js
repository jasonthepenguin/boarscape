export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;
    this._keysDown = new Set();
    this._jumpPressed = false;

    // Pointer drag state
    this._dragging = false;
    this._pointerId = null;
    this._lastPointerX = 0;
    this._lastPointerY = 0;
    this._pointerDx = 0;
    this._pointerDy = 0;

    // Wheel accumulator
    this._wheelDelta = 0;

    // Bind handlers
    this._onKeyDown = (e) => {
      this._keysDown.add(e.code);
      if (e.code === "Space" && !e.repeat) {
        this._jumpPressed = true;
      }
    };

    this._onKeyUp = (e) => {
      this._keysDown.delete(e.code);
    };

    this._onPointerDown = (e) => {
      if (e.button !== 0) return;
      this._dragging = true;
      this._pointerId = e.pointerId;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;
      domElement.setPointerCapture?.(e.pointerId);
      domElement.classList.add("dragging");
    };

    this._onPointerMove = (e) => {
      if (!this._dragging) return;
      if (this._pointerId != null && e.pointerId !== this._pointerId) return;
      this._pointerDx += e.clientX - this._lastPointerX;
      this._pointerDy += e.clientY - this._lastPointerY;
      this._lastPointerX = e.clientX;
      this._lastPointerY = e.clientY;
    };

    this._onPointerUp = (e) => {
      if (this._pointerId != null && e.pointerId !== this._pointerId) return;
      this._dragging = false;
      this._pointerId = null;
      domElement.classList.remove("dragging");
    };

    this._onWheel = (e) => {
      e.preventDefault();
      this._wheelDelta += Math.sign(e.deltaY);
    };

    this._onContextMenu = (e) => e.preventDefault();

    // Register listeners
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    domElement.addEventListener("pointerdown", this._onPointerDown);
    domElement.addEventListener("pointermove", this._onPointerMove);
    domElement.addEventListener("pointerup", this._onPointerUp);
    domElement.addEventListener("pointercancel", this._onPointerUp);
    domElement.addEventListener("wheel", this._onWheel, { passive: false });
    domElement.addEventListener("contextmenu", this._onContextMenu);
  }

  isKeyDown(code) {
    return this._keysDown.has(code);
  }

  wasJumpPressed() {
    if (this._jumpPressed) {
      this._jumpPressed = false;
      return true;
    }
    return false;
  }

  consumePointerDelta() {
    const dx = this._pointerDx;
    const dy = this._pointerDy;
    this._pointerDx = 0;
    this._pointerDy = 0;
    return { dx, dy };
  }

  consumeWheelDelta() {
    const delta = this._wheelDelta;
    this._wheelDelta = 0;
    return delta;
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
}
