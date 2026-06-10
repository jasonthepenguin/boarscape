import {
  AdditiveBlending,
  AnimationMixer,
  Box3,
  CanvasTexture,
  Color,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { LEVEL_UP_GLOW_DURATION } from "../config.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { ThirdPersonController } from "./thirdPersonController.js";
import { PLAYER_DESIRED_HEIGHT } from "../config.js";

const NAMETAG_SPRITE_HEIGHT = 0.5;

/**
 * Renders "[Lv N] Name" into a canvas — level in gold, name in white.
 */
function renderNametagCanvas(name, level) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const fontSize = 48;
  const padding = 16;
  const gap = 14;
  const levelText = `Lv ${level}`;

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const levelWidth = ctx.measureText(levelText).width;
  const nameWidth = ctx.measureText(name).width;

  canvas.width = levelWidth + gap + nameWidth + padding * 2;
  canvas.height = fontSize + padding * 1.5;

  // Semi-transparent black background with rounded corners
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  const radius = 8;
  const w = canvas.width;
  const h = canvas.height;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(w - radius, 0);
  ctx.quadraticCurveTo(w, 0, w, radius);
  ctx.lineTo(w, h - radius);
  ctx.quadraticCurveTo(w, h, w - radius, h);
  ctx.lineTo(radius, h);
  ctx.quadraticCurveTo(0, h, 0, h - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  // Gold level text with warm glow (matches HUD --rs-gold theme)
  ctx.fillStyle = "#ffd86b";
  ctx.shadowColor = "rgba(255, 179, 0, 0.9)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillText(levelText, padding, canvas.height / 2);

  // White name text with soft dark shadow
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.fillText(name, padding + levelWidth + gap, canvas.height / 2);

  return canvas;
}

function applyCanvasToSprite(sprite, canvas) {
  sprite.material.map?.dispose();
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  sprite.material.map = texture;
  sprite.material.needsUpdate = true;
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(NAMETAG_SPRITE_HEIGHT * aspect, NAMETAG_SPRITE_HEIGHT, 1);
}

/**
 * Creates a nametag sprite with the given name and level.
 */
export function createNametag(name, level = 1) {
  const canvas = renderNametagCanvas(name, level);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new Sprite(material);
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(NAMETAG_SPRITE_HEIGHT * aspect, NAMETAG_SPRITE_HEIGHT, 1);

  return sprite;
}

/**
 * Updates an existing nametag sprite with a new name/level, re-rendering the texture.
 */
export function updateNametag(sprite, name, level) {
  const canvas = renderNametagCanvas(name, level);
  applyCanvasToSprite(sprite, canvas);
}

/**
 * Configures the player model's materials and shadows
 */
function setupPlayerMaterials(model, colorHex) {
  const tint = colorHex ? new Color(colorHex) : null;
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = false;
      if (obj.material) {
        obj.material = new MeshBasicMaterial({
          map: obj.material.map,
          color: tint || obj.material.color,
        });
      }
    }
  });
}

/**
 * Loads and sets up the player with model, nametag, and controller
 */
export function loadPlayer(scene, camera, input, environment, options = {}) {
  const {
    modelUrl,
    playerName = "Player",
    desiredHeight = PLAYER_DESIRED_HEIGHT,
    color = null,
    onProgress = () => {},
  } = options;

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        const playerModel = gltf.scene;

        // Scale to desired height
        const box0 = new Box3().setFromObject(playerModel);
        const size0 = new Vector3();
        box0.getSize(size0);
        const height0 = Math.max(0.0001, size0.y);
        const scale = desiredHeight / height0;
        playerModel.scale.setScalar(scale);
        playerModel.updateMatrixWorld(true);

        // Create root group with model offset so feet sit at y=0
        const box = new Box3().setFromObject(playerModel);
        const minY = box.min.y;
        const playerRoot = new Group();
        playerRoot.add(playerModel);
        playerModel.position.y -= minY;
        playerRoot.updateMatrixWorld(true);

        // Setup materials (unlit for visibility, with optional color tint)
        setupPlayerMaterials(playerModel, color);

        // Add nametag above player
        const nametag = createNametag(playerName, 1);
        const playerBounds = new Box3().setFromObject(playerModel);
        const playerHeight = playerBounds.max.y - playerBounds.min.y;
        nametag.position.y = playerHeight + 0.4;
        playerRoot.add(nametag);

        // Position at spawn
        playerRoot.position.set(0, environment.groundY ?? 0, 0);
        scene.add(playerRoot);

        // Setup animation mixer and store actions by name
        let mixer = null;
        const actions = {};

        if (gltf.animations && gltf.animations.length) {
          mixer = new AnimationMixer(playerModel);

          // Create actions for each animation clip
          for (const clip of gltf.animations) {
            const action = mixer.clipAction(clip);
            actions[clip.name] = action;
            console.log(`Found animation: "${clip.name}"`);
          }
        }

        // Animation helper to play animations
        const playAnimation = (name, { loop = false, onFinish = null } = {}) => {
          const action = actions[name];
          if (!action) {
            console.warn(`Animation "${name}" not found`);
            return;
          }

          action.reset();
          if (loop) {
            action.setLoop(LoopRepeat, Infinity);
          } else {
            action.setLoop(LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          action.play();

          if (onFinish && !loop) {
            const onComplete = (e) => {
              if (e.action === action) {
                mixer.removeEventListener("finished", onComplete);
                onFinish();
              }
            };
            mixer.addEventListener("finished", onComplete);
          }
        };

        // Stop a playing animation
        const stopAnimation = (name) => {
          const action = actions[name];
          if (action) {
            action.fadeOut(0.2);
          }
        };

        // Calculate collision radius and camera target height
        const sized = new Vector3();
        new Box3().setFromObject(playerRoot).getSize(sized);
        const playerRadius = Math.max(sized.x, sized.z) * 0.28;
        const targetHeight = Math.max(0.8, Math.min(1.6, sized.y * 0.55));

        // Create controller with animation callbacks
        const controller = new ThirdPersonController({
          camera,
          target: playerRoot,
          input,
          environment,
          targetHeight,
          playerRadius,
          onJump: () => playAnimation("jump"),
          onMovementChange: (isMoving) => {
            if (isMoving) {
              playAnimation("walk", { loop: true });
            } else {
              stopAnimation("walk");
            }
          },
        });

        resolve({
          root: playerRoot,
          model: playerModel,
          mixer,
          controller,
          actions,
          playAnimation,
          stopAnimation,
          nametag,
          name: playerName,
        });
      },
      (ev) => {
        if (ev.total) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          onProgress(pct);
        }
      },
      (err) => {
        reject(err);
      }
    );
  });
}

/**
 * Creates a temporary golden glow aura around the player on level up.
 * Returns { mesh, update(dt) } — call update each frame. Auto-removes when done.
 */
export function createLevelUpAura(playerRoot) {
  const geo = new SphereGeometry(1.5, 24, 16);
  const mat = new MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.y = 1.0;
  playerRoot.add(mesh);

  let elapsed = 0;
  let done = false;

  function finish() {
    if (done) return;
    playerRoot.remove(mesh);
    geo.dispose();
    mat.dispose();
    done = true;
  }

  return {
    mesh,
    get done() { return done; },
    cancel: finish,
    update(dt) {
      if (done) return;
      elapsed += dt;

      const progress = elapsed / LEVEL_UP_GLOW_DURATION;
      if (progress >= 1) {
        finish();
        return;
      }

      // Scale pulse
      const pulse = 1.0 + 0.2 * Math.sin(elapsed * 4);
      mesh.scale.setScalar(pulse);

      // Fade out
      mat.opacity = 0.35 * (1 - progress);
    },
  };
}
