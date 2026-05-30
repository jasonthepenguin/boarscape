import {
  AnimationMixer,
  Box3,
  Color,
  Group,
  LoopRepeat,
  MeshBasicMaterial,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneModel } from "three/examples/jsm/utils/SkeletonUtils.js";
import { createNametag, updateNametag } from "./player.js";
import { PLAYER_DESIRED_HEIGHT } from "../config.js";

const TICK_RATE = 20;

export class RemotePlayerManager {
  constructor(scene, modelUrl) {
    this.scene = scene;
    this.players = new Map();
    this.template = null;
    this.templateAnimations = null;
    this._ready = this._loadTemplate(modelUrl);
  }

  _loadTemplate(url) {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          // Scale to desired height
          const box = new Box3().setFromObject(model);
          const size = new Vector3();
          box.getSize(size);
          const scale = PLAYER_DESIRED_HEIGHT / Math.max(0.0001, size.y);
          model.scale.setScalar(scale);
          model.updateMatrixWorld(true);

          this.template = model;
          this.templateAnimations = gltf.animations;
          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  async addPlayer(id, name, color, level = 1) {
    await this._ready;
    if (this.players.has(id)) return;

    const model = cloneModel(this.template);

    // Offset so feet sit at y=0
    const box = new Box3().setFromObject(model);
    const root = new Group();
    root.add(model);
    model.position.y -= box.min.y;
    root.updateMatrixWorld(true);

    // Apply color tint
    const tint = color ? new Color(color) : null;
    model.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = new MeshBasicMaterial({
          map: obj.material.map,
          color: tint || obj.material.color,
        });
        obj.castShadow = true;
      }
    });

    // Nametag
    const nametag = createNametag(name, level);
    const bounds = new Box3().setFromObject(model);
    nametag.position.y = bounds.max.y - bounds.min.y + 0.4;
    root.add(nametag);

    // Animation mixer
    let mixer = null;
    const actions = {};
    if (this.templateAnimations?.length) {
      mixer = new AnimationMixer(model);
      for (const clip of this.templateAnimations) {
        actions[clip.name] = mixer.clipAction(clip);
      }
    }

    this.scene.add(root);

    this.players.set(id, {
      root,
      mixer,
      actions,
      nametag,
      name,
      level,
      currentAnim: null,
      prevX: 0, prevY: 0, prevZ: 0, prevRy: 0,
      nextX: 0, nextY: 0, nextZ: 0, nextRy: 0,
      t: 1,
    });
  }

  setLevel(id, level) {
    const player = this.players.get(id);
    if (!player || player.level === level) return;
    player.level = level;
    updateNametag(player.nametag, player.name, level);
  }

  getRoot(id) {
    return this.players.get(id)?.root ?? null;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    player.root.parent?.remove(player.root);
    player.mixer?.stopAllAction();
    this.players.delete(id);
  }

  updatePositions(states) {
    for (const s of states) {
      const player = this.players.get(s.id);
      if (!player) continue;

      // Shift next → prev, store new target
      player.prevX = player.nextX;
      player.prevY = player.nextY;
      player.prevZ = player.nextZ;
      player.prevRy = player.nextRy;
      player.nextX = s.x;
      player.nextY = s.y;
      player.nextZ = s.z;
      player.nextRy = s.ry;
      player.t = 0;

      // Update animation if changed
      if (s.anim !== player.currentAnim) {
        if (player.currentAnim && player.actions[player.currentAnim]) {
          player.actions[player.currentAnim].fadeOut(0.2);
        }
        if (s.anim && player.actions[s.anim]) {
          player.actions[s.anim]
            .reset()
            .setLoop(LoopRepeat, Infinity)
            .fadeIn(0.2)
            .play();
        }
        player.currentAnim = s.anim;
      }
    }
  }

  update(dt) {
    for (const [, player] of this.players) {
      // Interpolate between prev and next server positions
      player.t = Math.min(1, player.t + dt * TICK_RATE);
      const t = player.t;

      player.root.position.x = player.prevX + (player.nextX - player.prevX) * t;
      player.root.position.y = player.prevY + (player.nextY - player.prevY) * t;
      player.root.position.z = player.prevZ + (player.nextZ - player.prevZ) * t;

      // Interpolate rotation via shortest path (wrap around ±π)
      let angleDiff = player.nextRy - player.prevRy;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      player.root.rotation.y = player.prevRy + angleDiff * t;

      if (player.mixer) player.mixer.update(dt);
    }
  }
}
