import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
} from "three";
import { createNametag } from "./player.js";
import { SELECTION_RING_RADIUS, SELECTION_RING_TUBE, NPC_DEATH_ANIM_DURATION, NPC_MAX_ADDICTION, NPC_MAX_HP } from "../config.js";

const TICK_RATE = 20;

// NPC variants — picked deterministically per-id so every client renders the
// same model for the same NPC. `hair` set => "girl" variant (hair on top + long
// hair down the back, paired with a pink torso).
const NPC_VARIANTS = [
  { shirt: "#3b6fb5", hair: null },          // blue
  { shirt: "#b5473b", hair: null },          // red
  { shirt: "#3bb56f", hair: null },          // green
  { shirt: "#8b5e3c", hair: null },          // brown
  { shirt: "#6b3bb5", hair: null },          // purple
  { shirt: "#b5953b", hair: null },          // gold
  { shirt: "#ff6fb5", hair: "#5a3a1c" },     // pink + brown hair — girl variant
];

// Pull the trailing integer out of "npc_7"-style ids so variant selection is
// stable regardless of map insertion order or respawn shuffling.
function variantIndexFromId(id) {
  const m = String(id).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function createHumanoidModel(variant) {
  const root = new Group();

  const skinMat = new MeshStandardMaterial({ color: "#e8b89d", roughness: 0.9 });
  const shirtMat = new MeshStandardMaterial({ color: variant.shirt, roughness: 0.85 });
  const pantsMat = new MeshStandardMaterial({ color: "#3a3a50", roughness: 0.9 });
  const shoeMat = new MeshStandardMaterial({ color: "#2a1a0a", roughness: 1 });

  // Body offset group — shifts model down so shoe bottoms rest on y=0
  const body = new Group();
  body.position.y = -0.33;
  root.add(body);

  // Head
  const head = new Mesh(new SphereGeometry(0.18, 8, 6), skinMat);
  head.position.y = 1.45;
  head.castShadow = true;
  body.add(head);

  // Hair (girl variant only) — boxy "cap" sitting on top of the head + a long
  // panel hanging down the back to mid-torso. The cap is shifted slightly back
  // so the face/forehead stays visible.
  if (variant.hair) {
    const hairMat = new MeshStandardMaterial({ color: variant.hair, roughness: 0.7 });
    const hairTop = new Mesh(new BoxGeometry(0.36, 0.12, 0.32), hairMat);
    hairTop.position.set(0, 1.56, -0.02);
    hairTop.castShadow = true;
    body.add(hairTop);
    const hairBack = new Mesh(new BoxGeometry(0.36, 0.55, 0.08), hairMat);
    hairBack.position.set(0, 1.20, -0.13);
    hairBack.castShadow = true;
    body.add(hairBack);
  }

  // Body/torso
  const torso = new Mesh(new BoxGeometry(0.4, 0.5, 0.22), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  body.add(torso);

  // Left arm
  const leftArm = new Mesh(new BoxGeometry(0.12, 0.45, 0.12), skinMat);
  leftArm.position.set(-0.26, 1.0, 0);
  leftArm.castShadow = true;
  body.add(leftArm);

  // Right arm
  const rightArm = new Mesh(new BoxGeometry(0.12, 0.45, 0.12), skinMat);
  rightArm.position.set(0.26, 1.0, 0);
  rightArm.castShadow = true;
  body.add(rightArm);

  // Left leg
  const leftLeg = new Group();
  const leftLegMesh = new Mesh(new BoxGeometry(0.14, 0.4, 0.14), pantsMat);
  leftLegMesh.position.y = -0.2;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);
  const leftShoe = new Mesh(new BoxGeometry(0.16, 0.1, 0.2), shoeMat);
  leftShoe.position.set(0, -0.42, 0.02);
  leftShoe.castShadow = true;
  leftLeg.add(leftShoe);
  leftLeg.position.set(-0.1, 0.8, 0);
  body.add(leftLeg);

  // Right leg
  const rightLeg = new Group();
  const rightLegMesh = new Mesh(new BoxGeometry(0.14, 0.4, 0.14), pantsMat);
  rightLegMesh.position.y = -0.2;
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);
  const rightShoe = new Mesh(new BoxGeometry(0.16, 0.1, 0.2), shoeMat);
  rightShoe.position.set(0, -0.42, 0.02);
  rightShoe.castShadow = true;
  rightLeg.add(rightShoe);
  rightLeg.position.set(0.1, 0.8, 0);
  body.add(rightLeg);

  return { root, leftLeg, rightLeg, leftArm, rightArm };
}

function createAddictionBar() {
  const w = 128;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new Sprite(material);
  const aspect = w / h;
  sprite.scale.set(0.6 * aspect, 0.6, 1);
  sprite.visible = false; // hidden until first hit

  return { sprite, canvas, texture };
}

function createHealthBar() {
  // Match the addiction bar's canvas size and sprite scale so they read at
  // the same visual scale above the NPC.
  const w = 128;
  const h = 32;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new Sprite(material);
  const aspect = w / h;
  sprite.scale.set(0.6 * aspect, 0.6, 1);
  sprite.visible = false; // hidden until first damage

  return { sprite, canvas, texture };
}

function drawHealthBar(canvas, texture, hp) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const radius = 4;
  // Center the bar vertically within the canvas (no label, just the bar)
  const barH = 16;
  const barY = (h - barH) / 2;

  ctx.clearRect(0, 0, w, h);

  // Bar background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.beginPath();
  ctx.roundRect(0, barY, w, barH, radius);
  ctx.fill();

  // Fill — green → yellow → red as HP drops
  const pct = Math.max(0, Math.min(1, hp / NPC_MAX_HP));
  const fillW = Math.max(0, (w - 4) * pct);
  if (fillW > 0) {
    const r = Math.min(255, Math.floor(255 * (1 - pct) * 2));
    const g = Math.min(255, Math.floor(255 * pct * 2));
    ctx.fillStyle = `rgb(${r}, ${g}, 40)`;
    ctx.beginPath();
    ctx.roundRect(2, barY + 2, fillW, barH - 4, Math.max(0, radius - 1));
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0, barY, w, barH, radius);
  ctx.stroke();

  texture.needsUpdate = true;
}

function drawAddictionBar(canvas, texture, addiction) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const radius = 4;
  const barY = 14;
  const barH = h - barY - 2;

  ctx.clearRect(0, 0, w, h);

  // Label text
  ctx.font = "bold 12px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillText("Addiction", w / 2, 0);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Bar background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.beginPath();
  ctx.roundRect(0, barY, w, barH, radius);
  ctx.fill();

  // Fill — green to orange to red as addiction rises
  const pct = addiction / NPC_MAX_ADDICTION;
  const fillW = Math.max(0, (w - 4) * pct);
  if (fillW > 0) {
    const r = Math.min(255, Math.floor(255 * pct * 2));
    const g = Math.min(255, Math.floor(255 * (1 - pct)));
    ctx.fillStyle = `rgb(${r}, ${g}, 0)`;
    ctx.beginPath();
    ctx.roundRect(2, barY + 2, fillW, barH - 4, Math.max(0, radius - 1));
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0, barY, w, barH, radius);
  ctx.stroke();

  texture.needsUpdate = true;
}

export class NpcManager {
  constructor(scene) {
    this.scene = scene;
    this.npcs = new Map();
    this.selectedNpcId = null;
    this._selectionRing = null;
  }

  _getSelectionRing() {
    if (!this._selectionRing) {
      const geo = new TorusGeometry(SELECTION_RING_RADIUS, SELECTION_RING_TUBE, 8, 32);
      const mat = new MeshBasicMaterial({ color: 0xffd700, side: DoubleSide, transparent: true, opacity: 0.8 });
      this._selectionRing = new Mesh(geo, mat);
      this._selectionRing.rotation.x = -Math.PI / 2; // lay flat on ground
    }
    return this._selectionRing;
  }

  selectNpc(id) {
    this.deselectNpc();

    const npc = this.npcs.get(id);
    if (!npc || npc.dead) return;

    this.selectedNpcId = id;
    const ring = this._getSelectionRing();
    ring.position.set(0, 0.05, 0);
    npc.root.add(ring);
  }

  deselectNpc() {
    if (this.selectedNpcId && this._selectionRing?.parent) {
      this._selectionRing.parent.remove(this._selectionRing);
    }
    this.selectedNpcId = null;
  }

  addNpc(id, name) {
    if (this.npcs.has(id)) return;

    const variant = NPC_VARIANTS[variantIndexFromId(id) % NPC_VARIANTS.length];
    const { root, leftLeg, rightLeg, leftArm, rightArm } = createHumanoidModel(variant);

    // Nametag
    const nametag = createNametag(name);
    nametag.position.y = 1.8;
    root.add(nametag);

    // Health bar (just above nametag)
    const { sprite: healthSprite, canvas: healthCanvas, texture: healthTexture } = createHealthBar();
    healthSprite.position.y = 2.05;
    root.add(healthSprite);

    // Addiction bar (above the health bar)
    const { sprite: addictionSprite, canvas: addictionCanvas, texture: addictionTexture } = createAddictionBar();
    addictionSprite.position.y = 2.55;
    root.add(addictionSprite);

    this.scene.add(root);

    this.npcs.set(id, {
      root,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      nametag,
      currentAnim: "idle",
      walkTime: 0,
      prevX: 0, prevY: 0, prevZ: 0, prevRy: 0,
      nextX: 0, nextY: 0, nextZ: 0, nextRy: 0,
      t: 1,
      addiction: 0,
      hp: NPC_MAX_HP,
      dead: false,
      deathTime: 0,
      deathMaterials: null,
      addictionSprite,
      addictionCanvas,
      addictionTexture,
      healthSprite,
      healthCanvas,
      healthTexture,
    });
  }

  removeNpc(id) {
    const npc = this.npcs.get(id);
    if (!npc) return;
    if (this.selectedNpcId === id) {
      this.deselectNpc();
    }
    this.scene.remove(npc.root);
    this.npcs.delete(id);
  }

  setAddiction(id, addiction) {
    const npc = this.npcs.get(id);
    if (!npc) return;
    npc.addiction = addiction;

    // Show and redraw the addiction bar
    if (addiction > 0 && npc.addictionSprite) {
      npc.addictionSprite.visible = true;
      drawAddictionBar(npc.addictionCanvas, npc.addictionTexture, addiction);
    }
  }

  setHp(id, hp) {
    const npc = this.npcs.get(id);
    if (!npc) return;
    npc.hp = hp;

    // Show and redraw the health bar when the NPC has taken any damage
    if (hp < NPC_MAX_HP && npc.healthSprite) {
      npc.healthSprite.visible = true;
      drawHealthBar(npc.healthCanvas, npc.healthTexture, hp);
    }
  }

  killNpc(id) {
    const npc = this.npcs.get(id);
    if (!npc) return;
    npc.dead = true;
    npc.deathTime = 0;

    if (this.selectedNpcId === id) {
      this.deselectNpc();
    }

    // Hide nametag and bars during death
    npc.nametag.visible = false;
    if (npc.addictionSprite) {
      npc.addictionSprite.visible = false;
    }
    if (npc.healthSprite) {
      npc.healthSprite.visible = false;
    }

    // Clone materials so death animation doesn't affect shared geometry
    npc.deathMaterials = [];
    npc.root.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = obj.material.clone();
        obj.material.transparent = true;
        npc.deathMaterials.push({ mat: obj.material, origColor: obj.material.color.clone() });
      }
    });
  }

  getNpcWorldPosition(id) {
    const npc = this.npcs.get(id);
    if (!npc) return null;
    return npc.root.position.clone();
  }

  updatePositions(states) {
    for (const s of states) {
      const npc = this.npcs.get(s.id);
      if (!npc) continue;

      npc.prevX = npc.nextX;
      npc.prevY = npc.nextY;
      npc.prevZ = npc.nextZ;
      npc.prevRy = npc.nextRy;
      npc.nextX = s.x;
      npc.nextY = s.y;
      npc.nextZ = s.z;
      npc.nextRy = s.ry;
      npc.t = 0;
      npc.currentAnim = s.anim;
    }
  }

  update(dt) {
    const burnColor = new Color();

    for (const [, npc] of this.npcs) {
      // Interpolate position (even during death, to keep in sync)
      npc.t = Math.min(1, npc.t + dt * TICK_RATE);
      const t = npc.t;

      npc.root.position.x = npc.prevX + (npc.nextX - npc.prevX) * t;
      npc.root.position.y = npc.prevY + (npc.nextY - npc.prevY) * t;
      npc.root.position.z = npc.prevZ + (npc.nextZ - npc.prevZ) * t;

      // Interpolate rotation via shortest path (wrap around ±π)
      let angleDiff = npc.nextRy - npc.prevRy;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      npc.root.rotation.y = npc.prevRy + angleDiff * t;

      // Death animation
      if (npc.dead) {
        npc.deathTime += dt;
        const progress = Math.min(1, npc.deathTime / NPC_DEATH_ANIM_DURATION);

        if (npc.deathMaterials) {
          for (const entry of npc.deathMaterials) {
            if (progress < 0.5) {
              // Phase 1: color shifts to fiery orange/red
              const t2 = progress * 2;
              burnColor.set(1.0, 0.3, 0.0);
              entry.mat.color.lerpColors(entry.origColor, burnColor, t2);
              entry.mat.emissive = entry.mat.emissive || new Color();
              entry.mat.emissive.copy(entry.mat.color).multiplyScalar(0.5);
              entry.mat.emissiveIntensity = t2;
            } else {
              // Phase 2: fade out
              const t2 = (progress - 0.5) * 2;
              entry.mat.color.set(0.8, 0.1, 0.0);
              entry.mat.opacity = 1 - t2;
            }
          }
        }

        // Scale down + rise during second half (evaporate)
        if (progress > 0.5) {
          const scaleProgress = (progress - 0.5) * 2;
          const s = 1 - scaleProgress * 0.8;
          npc.root.scale.set(s, s, s);
          npc.root.position.y += dt * 0.5;
        }

        // Freeze limbs
        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;
        npc.leftArm.rotation.x = 0;
        npc.rightArm.rotation.x = 0;
        continue;
      }

      // Leg/arm swing animation when walking
      if (npc.currentAnim === "walk") {
        npc.walkTime += dt * 8;
        const swing = Math.sin(npc.walkTime) * 0.5;
        npc.leftLeg.rotation.x = swing;
        npc.rightLeg.rotation.x = -swing;
        npc.leftArm.rotation.x = -swing * 0.6;
        npc.rightArm.rotation.x = swing * 0.6;
      } else {
        npc.walkTime = 0;
        npc.leftLeg.rotation.x = 0;
        npc.rightLeg.rotation.x = 0;
        npc.leftArm.rotation.x = 0;
        npc.rightArm.rotation.x = 0;
      }
    }
  }
}
