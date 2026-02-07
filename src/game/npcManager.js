import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import { createNametag } from "./player.js";

const TICK_RATE = 20;

// Shirt colors for variety
const SHIRT_COLORS = ["#3b6fb5", "#b5473b", "#3bb56f", "#8b5e3c", "#6b3bb5", "#b5953b"];

function createHumanoidModel(shirtColorHex) {
  const root = new Group();

  const skinMat = new MeshStandardMaterial({ color: "#e8b89d", roughness: 0.9 });
  const shirtMat = new MeshStandardMaterial({ color: shirtColorHex, roughness: 0.85 });
  const pantsMat = new MeshStandardMaterial({ color: "#3a3a50", roughness: 0.9 });
  const shoeMat = new MeshStandardMaterial({ color: "#2a1a0a", roughness: 1 });

  // Head
  const head = new Mesh(new SphereGeometry(0.18, 8, 6), skinMat);
  head.position.y = 1.45;
  head.castShadow = true;
  root.add(head);

  // Body/torso
  const torso = new Mesh(new BoxGeometry(0.4, 0.5, 0.22), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  root.add(torso);

  // Left arm
  const leftArm = new Mesh(new BoxGeometry(0.12, 0.45, 0.12), skinMat);
  leftArm.position.set(-0.26, 1.0, 0);
  leftArm.castShadow = true;
  root.add(leftArm);

  // Right arm
  const rightArm = new Mesh(new BoxGeometry(0.12, 0.45, 0.12), skinMat);
  rightArm.position.set(0.26, 1.0, 0);
  rightArm.castShadow = true;
  root.add(rightArm);

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
  root.add(leftLeg);

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
  root.add(rightLeg);

  return { root, leftLeg, rightLeg, leftArm, rightArm };
}

export class NpcManager {
  constructor(scene) {
    this.scene = scene;
    this.npcs = new Map();
  }

  addNpc(id, name) {
    if (this.npcs.has(id)) return;

    const shirtColor = SHIRT_COLORS[this.npcs.size % SHIRT_COLORS.length];
    const { root, leftLeg, rightLeg, leftArm, rightArm } = createHumanoidModel(shirtColor);

    // Nametag
    const nametag = createNametag(name);
    nametag.position.y = 1.8;
    root.add(nametag);

    this.scene.add(root);

    this.npcs.set(id, {
      root,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      currentAnim: "idle",
      walkTime: 0,
      prevX: 0, prevY: 0, prevZ: 0, prevRy: 0,
      nextX: 0, nextY: 0, nextZ: 0, nextRy: 0,
      t: 1,
    });
  }

  removeNpc(id) {
    const npc = this.npcs.get(id);
    if (!npc) return;
    this.scene.remove(npc.root);
    this.npcs.delete(id);
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
    for (const [, npc] of this.npcs) {
      // Interpolate position
      npc.t = Math.min(1, npc.t + dt * TICK_RATE);
      const t = npc.t;

      npc.root.position.x = npc.prevX + (npc.nextX - npc.prevX) * t;
      npc.root.position.y = npc.prevY + (npc.nextY - npc.prevY) * t;
      npc.root.position.z = npc.prevZ + (npc.nextZ - npc.prevZ) * t;
      npc.root.rotation.y = npc.prevRy + (npc.nextRy - npc.prevRy) * t;

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
