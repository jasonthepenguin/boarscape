import {
  AnimationMixer,
  Box3,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
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
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { ThirdPersonController } from "./thirdPersonController.js";

/**
 * Creates a nametag sprite with the given name and optional subtitle
 */
function createNametag(name, subtitle = null) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const fontSize = 48;
  const subtitleFontSize = 36;
  const padding = 16;
  const lineSpacing = 8;

  // Measure text widths
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const nameWidth = ctx.measureText(name).width;

  let subtitleWidth = 0;
  if (subtitle) {
    ctx.font = `bold ${subtitleFontSize}px Arial, sans-serif`;
    subtitleWidth = ctx.measureText(subtitle).width;
  }

  const textWidth = Math.max(nameWidth, subtitleWidth);
  const totalHeight = subtitle
    ? fontSize + subtitleFontSize + lineSpacing + padding * 1.5
    : fontSize + padding * 1.5;

  canvas.width = textWidth + padding * 2;
  canvas.height = totalHeight;

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

  // Shadow settings
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.textAlign = "center";

  // Name text
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  const nameY = subtitle
    ? padding / 2 + fontSize / 2
    : canvas.height / 2;
  ctx.fillText(name, canvas.width / 2, nameY);

  // Subtitle text (e.g., "Vulnerability: 2")
  if (subtitle) {
    ctx.font = `bold ${subtitleFontSize}px Arial, sans-serif`;
    ctx.fillStyle = "#ff6666";
    const subtitleY = nameY + fontSize / 2 + lineSpacing + subtitleFontSize / 2;
    ctx.fillText(subtitle, canvas.width / 2, subtitleY);
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;

  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const sprite = new Sprite(material);
  const spriteHeight = subtitle ? 0.7 : 0.5;
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(spriteHeight * aspect, spriteHeight, 1);

  return sprite;
}

/**
 * Creates a simple procedural kid character model
 */
function createKidModel(height = 1.3) {
  const group = new Group();

  // Colors
  const skinColor = 0xffcc99;
  const shirtColor = 0x4488ff;
  const pantsColor = 0x3344aa;
  const shoeColor = 0x222222;
  const hairColor = 0x553311;

  // Proportions based on height
  const headRadius = height * 0.18;
  const bodyHeight = height * 0.3;
  const bodyWidth = height * 0.22;
  const legHeight = height * 0.25;
  const legWidth = height * 0.08;
  const armLength = height * 0.22;
  const armWidth = height * 0.06;

  // Head
  const headGeo = new SphereGeometry(headRadius, 16, 12);
  const headMat = new MeshBasicMaterial({ color: skinColor });
  const head = new Mesh(headGeo, headMat);
  head.position.y = legHeight + bodyHeight + headRadius * 0.9;
  head.castShadow = true;
  group.add(head);

  // Hair (slightly larger sphere on top)
  const hairGeo = new SphereGeometry(headRadius * 0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const hairMat = new MeshBasicMaterial({ color: hairColor });
  const hair = new Mesh(hairGeo, hairMat);
  hair.position.y = head.position.y + headRadius * 0.15;
  hair.castShadow = true;
  group.add(hair);

  // Body (torso)
  const bodyGeo = new BoxGeometry(bodyWidth, bodyHeight, bodyWidth * 0.7);
  const bodyMat = new MeshBasicMaterial({ color: shirtColor });
  const body = new Mesh(bodyGeo, bodyMat);
  body.position.y = legHeight + bodyHeight / 2;
  body.castShadow = true;
  group.add(body);

  // Left leg
  const legGeo = new BoxGeometry(legWidth, legHeight, legWidth);
  const legMat = new MeshBasicMaterial({ color: pantsColor });
  const leftLeg = new Mesh(legGeo, legMat);
  leftLeg.position.set(-bodyWidth * 0.25, legHeight / 2, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  // Right leg
  const rightLeg = new Mesh(legGeo, legMat);
  rightLeg.position.set(bodyWidth * 0.25, legHeight / 2, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Shoes
  const shoeGeo = new BoxGeometry(legWidth * 1.3, height * 0.05, legWidth * 1.5);
  const shoeMat = new MeshBasicMaterial({ color: shoeColor });
  const leftShoe = new Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-bodyWidth * 0.25, height * 0.025, legWidth * 0.2);
  leftShoe.castShadow = true;
  group.add(leftShoe);

  const rightShoe = new Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(bodyWidth * 0.25, height * 0.025, legWidth * 0.2);
  rightShoe.castShadow = true;
  group.add(rightShoe);

  // Left arm
  const armGeo = new BoxGeometry(armWidth, armLength, armWidth);
  const armMat = new MeshBasicMaterial({ color: skinColor });
  const leftArm = new Mesh(armGeo, armMat);
  leftArm.position.set(-bodyWidth / 2 - armWidth / 2, legHeight + bodyHeight - armLength / 2, 0);
  leftArm.castShadow = true;
  group.add(leftArm);

  // Right arm
  const rightArm = new Mesh(armGeo, armMat);
  rightArm.position.set(bodyWidth / 2 + armWidth / 2, legHeight + bodyHeight - armLength / 2, 0);
  rightArm.castShadow = true;
  group.add(rightArm);

  // Eyes
  const eyeGeo = new SphereGeometry(headRadius * 0.12, 8, 6);
  const eyeMat = new MeshBasicMaterial({ color: 0x000000 });
  const leftEye = new Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-headRadius * 0.35, head.position.y + headRadius * 0.1, headRadius * 0.85);
  group.add(leftEye);

  const rightEye = new Mesh(eyeGeo, eyeMat);
  rightEye.position.set(headRadius * 0.35, head.position.y + headRadius * 0.1, headRadius * 0.85);
  group.add(rightEye);

  return group;
}

/**
 * Spawns a static kid NPC (procedural model, no GLB)
 */
export function spawnKid(scene, options = {}) {
  const {
    name = "Kid",
    subtitle = null,
    height = 1.3,
    position = { x: 0, y: 0, z: 0 },
  } = options;

  const kidRoot = new Group();

  // Create kid model
  const kidModel = createKidModel(height);
  kidRoot.add(kidModel);

  // Add nametag
  const nametag = createNametag(name, subtitle);
  nametag.position.y = height + 0.5;
  kidRoot.add(nametag);

  // Position
  kidRoot.position.set(position.x, position.y, position.z);
  scene.add(kidRoot);

  // Oscillation for idle sway
  let oscillationTime = Math.random() * Math.PI * 2;
  const oscillationSpeed = 1.0 + Math.random() * 0.3;
  const oscillationAmount = 0.25;

  const update = (dt) => {
    oscillationTime += dt * oscillationSpeed;
    kidRoot.rotation.y = Math.sin(oscillationTime) * oscillationAmount;
  };

  return {
    root: kidRoot,
    model: kidModel,
    update,
  };
}

/**
 * Configures the player model's materials and shadows
 */
function setupPlayerMaterials(model) {
  model.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = false;
      if (obj.material) {
        obj.material = new MeshBasicMaterial({
          map: obj.material.map,
          color: obj.material.color,
        });
      }
    }
  });
}

/**
 * Loads an NPC boar with a nametag and looping animation (no controller)
 */
export function loadNPC(scene, options = {}) {
  const {
    modelUrl,
    name = "NPC",
    subtitle = null,
    desiredHeight = 2.1,
    position = { x: 0, y: 0, z: 0 },
    animation = null,
    tint = null,
    followTarget = null,
    formationOffset = { x: 0, z: -3 },
    followSpeed = 5,
  } = options;

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        const npcModel = gltf.scene;

        // Scale to desired height
        const box0 = new Box3().setFromObject(npcModel);
        const size0 = new Vector3();
        box0.getSize(size0);
        const height0 = Math.max(0.0001, size0.y);
        const scale = desiredHeight / height0;
        npcModel.scale.setScalar(scale);
        npcModel.updateMatrixWorld(true);

        // Create root group with model offset so feet sit at y=0
        const box = new Box3().setFromObject(npcModel);
        const minY = box.min.y;
        const npcRoot = new Group();
        npcRoot.add(npcModel);
        npcModel.position.y -= minY;
        npcRoot.updateMatrixWorld(true);

        // Setup materials (unlit for visibility) with optional tint
        const tintColor = tint ? new Color(tint) : null;
        npcModel.traverse((obj) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = false;
            if (obj.material) {
              const baseColor = obj.material.color
                ? obj.material.color.clone()
                : new Color(0xffffff);
              if (tintColor) {
                baseColor.multiply(tintColor);
              }
              obj.material = new MeshBasicMaterial({
                map: obj.material.map,
                color: baseColor,
              });
            }
          }
        });

        // Add nametag above NPC
        const nametag = createNametag(name, subtitle);
        const npcBounds = new Box3().setFromObject(npcModel);
        const npcHeight = npcBounds.max.y - npcBounds.min.y;
        nametag.position.y = npcHeight + 0.4;
        npcRoot.add(nametag);

        // Position NPC
        npcRoot.position.set(position.x, position.y, position.z);
        scene.add(npcRoot);

        // Oscillation state for looking movement
        let oscillationTime = Math.random() * Math.PI * 2; // Random starting phase
        const oscillationSpeed = 1.2 + Math.random() * 0.4; // Slightly varied speed
        const oscillationAmount = 0.35; // How far left/right to look

        // For tracking facing direction
        let currentRotation = 0;

        // Setup animation mixer
        let mixer = null;
        const actions = {};

        if (gltf.animations && gltf.animations.length) {
          mixer = new AnimationMixer(npcModel);

          for (const clip of gltf.animations) {
            const action = mixer.clipAction(clip);
            actions[clip.name] = action;
          }

          // Start looping animation if specified
          if (animation && actions[animation]) {
            const action = actions[animation];
            action.setLoop(LoopRepeat, Infinity);
            action.play();
          }
        }

        // Update function for following and oscillating look movement
        const update = (dt) => {
          oscillationTime += dt * oscillationSpeed;

          if (followTarget) {
            // Calculate target position in wedge formation behind player
            const playerRotation = followTarget.rotation.y;
            const cosR = Math.cos(playerRotation);
            const sinR = Math.sin(playerRotation);

            // Transform formation offset by player's rotation (offset is behind player)
            const targetX =
              followTarget.position.x +
              formationOffset.x * cosR -
              formationOffset.z * sinR;
            const targetZ =
              followTarget.position.z +
              formationOffset.x * sinR +
              formationOffset.z * cosR;

            // Smoothly move towards target
            const dx = targetX - npcRoot.position.x;
            const dz = targetZ - npcRoot.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.1) {
              const moveAmount = Math.min(followSpeed * dt, dist);
              npcRoot.position.x += (dx / dist) * moveAmount;
              npcRoot.position.z += (dz / dist) * moveAmount;

              // Face movement direction
              currentRotation = Math.atan2(dx, dz);
            }

            // Apply oscillation on top of current facing
            npcRoot.rotation.y =
              currentRotation + Math.sin(oscillationTime) * oscillationAmount;
          } else {
            // Static NPC with just oscillation
            npcRoot.rotation.y = Math.sin(oscillationTime) * oscillationAmount;
          }
        };

        resolve({
          root: npcRoot,
          model: npcModel,
          mixer,
          actions,
          update,
        });
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * Loads and sets up the player with model, nametag, and controller
 */
export function loadPlayer(scene, camera, domElement, environment, options = {}) {
  const {
    modelUrl,
    playerName = "Player",
    desiredHeight = 2.1,
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

        // Setup materials (unlit for visibility)
        setupPlayerMaterials(playerModel);

        // Add nametag above player
        const nametag = createNametag(playerName);
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
          domElement,
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
