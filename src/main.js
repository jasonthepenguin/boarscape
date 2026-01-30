import "./style.css";

import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  AmbientLight,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { createEnvironment } from "./game/environment.js";
import { ThirdPersonController } from "./game/thirdPersonController.js";

const canvas = document.querySelector("#game");
const loadingEl = document.querySelector("#loading");

function showLoading(text) {
  if (!loadingEl) return;
  loadingEl.textContent = text;
  loadingEl.style.display = "block";
}

function hideLoading() {
  if (!loadingEl) return;
  loadingEl.style.display = "none";
}

showLoading("Loading world…");

const scene = new Scene();
scene.background = new Color("#87cfff");
scene.fog = new Fog("#87cfff", 80, 520);

const camera = new PerspectiveCamera(60, 1, 0.1, 2000);
camera.position.set(0, 6, 10);

const renderer = new WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;

// Lights
const hemi = new HemisphereLight(0xbfe3ff, 0x264a1a, 1.15);
scene.add(hemi);

// Soft fill to lift shadows on the player
const ambient = new AmbientLight(0xffffff, 0.28);
scene.add(ambient);

const sun = new DirectionalLight(0xffffff, 1.35);
sun.position.set(40, 65, 35);
sun.castShadow = true;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.015;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 220;
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
scene.add(sun);

// Gentle back-fill so the model isn't overly shadowy when facing away from the sun
const fill = new DirectionalLight(0xffffff, 0.25);
fill.position.set(-55, 28, -65);
fill.castShadow = false;
scene.add(fill);

// Environment
const env = createEnvironment(scene, { fieldSize: 560, treeCount: 320 });
hideLoading();

// Load player
showLoading("Loading player…");

const loader = new GLTFLoader();
const modelUrl = new URL("../mesh-1769779998.glb", import.meta.url);

let controller = null;
let mixer = null;
let playerRoot = null;
let playerModel = null;

loader.load(
  modelUrl.href,
  (gltf) => {
    playerModel = gltf.scene;

    // Make it a reasonable size
    const box0 = new Box3().setFromObject(playerModel);
    const size0 = new Vector3();
    box0.getSize(size0);
    const height0 = Math.max(0.0001, size0.y);
    const desiredHeight = 2.1;
    const scale = desiredHeight / height0;
    playerModel.scale.setScalar(scale);
    playerModel.updateMatrixWorld(true);

    // Create a root object we move/land with, and offset the model inside it so feet sit at y=0.
    // This prevents the mesh from sinking when we clamp the root to ground.
    const box = new Box3().setFromObject(playerModel);
    const minY = box.min.y;
    playerRoot = new Group();
    playerRoot.add(playerModel);
    playerModel.position.y -= minY;
    playerRoot.updateMatrixWorld(true);

    // Shadows + ensure materials are lit
    playerModel.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          obj.material.needsUpdate = true;
        }
      }
    });

    // Add to scene at spawn
    playerRoot.position.x = 0;
    playerRoot.position.y = env.groundY ?? 0;
    playerRoot.position.z = 0;
    scene.add(playerRoot);

    // Animation (if present)
    if (gltf.animations && gltf.animations.length) {
      mixer = new AnimationMixer(playerModel);
      const action = mixer.clipAction(gltf.animations[0]);
      action.play();
    }

    // Player collision radius + camera target height from bounds
    const sized = new Vector3();
    new Box3().setFromObject(playerRoot).getSize(sized);
    const playerRadius = Math.max(sized.x, sized.z) * 0.28;
    const targetHeight = Math.max(0.8, Math.min(1.6, sized.y * 0.55));

    controller = new ThirdPersonController({
      camera,
      target: playerRoot,
      domElement: canvas,
      environment: env,
      targetHeight,
      playerRadius,
    });

    hideLoading();
  },
  (ev) => {
    if (!ev.total) return;
    const pct = Math.round((ev.loaded / ev.total) * 100);
    showLoading(`Loading player… ${pct}%`);
  },
  (err) => {
    console.error(err);
    showLoading("Failed to load player model. Check console.");
  },
);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const clock = new Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());

  env.update(dt);
  if (controller) controller.update(dt);
  if (mixer) mixer.update(dt);

  renderer.render(scene, camera);
}
tick();

