import "./style.css";

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

import { createEnvironment } from "./game/environment.js";
import { loadPlayer, loadNPC } from "./game/player.js";

// =============================================================================
// DOM Elements
// =============================================================================

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

// =============================================================================
// Scene Setup
// =============================================================================

const scene = new Scene();
scene.background = new Color("#87cfff");
scene.fog = new Fog("#87cfff", 40, 180);

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

// =============================================================================
// Lighting
// =============================================================================

// Sky/ground ambient
const hemi = new HemisphereLight(0xbfe3ff, 0x264a1a, 1.15);
scene.add(hemi);

// Soft fill to lift shadows
const ambient = new AmbientLight(0xffffff, 0.75);
scene.add(ambient);

// Main sun light with shadows
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

// Gentle back-fill for when facing away from sun
const fill = new DirectionalLight(0xffffff, 0.25);
fill.position.set(-55, 28, -65);
fill.castShadow = false;
scene.add(fill);

// =============================================================================
// Environment
// =============================================================================

showLoading("Loading world...");
const env = createEnvironment(scene);
hideLoading();

// =============================================================================
// Player
// =============================================================================

let player = null;

showLoading("Loading player...");

const modelUrl = new URL("../boar3.glb", import.meta.url);

loadPlayer(scene, camera, canvas, env, {
  modelUrl: modelUrl.href,
  playerName: "Childpredator32",
  onProgress: (pct) => showLoading(`Loading player... ${pct}%`),
})
  .then((result) => {
    player = result;
    hideLoading();
  })
  .catch((err) => {
    console.error(err);
    showLoading("Failed to load player model. Check console.");
  });

// =============================================================================
// NPCs
// =============================================================================

const npcs = [];

const npcConfigs = [
  { name: "BoarMaxxing", position: { x: 5, y: 0, z: -3 }, rotation: -0.5, tint: "#ffccaa" },
  { name: "NikitaBoaring", position: { x: -4, y: 0, z: -5 }, rotation: 0.8, tint: "#aaddff" },
  { name: "Grok4", position: { x: 3, y: 0, z: 6 }, rotation: Math.PI, tint: "#ddffaa" },
];

for (const config of npcConfigs) {
  loadNPC(scene, {
    modelUrl: modelUrl.href,
    name: config.name,
    position: config.position,
    rotation: config.rotation,
    animation: "jump",
    tint: config.tint,
  }).then((npc) => {
    npcs.push(npc);
  });
}

// =============================================================================
// Resize Handler
// =============================================================================

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// =============================================================================
// Game Loop
// =============================================================================

const clock = new Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, clock.getDelta());

  env.update(dt);
  if (player?.controller) player.controller.update(dt);
  if (player?.mixer) player.mixer.update(dt);

  // Update NPCs (animations + looking movement)
  for (const npc of npcs) {
    if (npc.mixer) npc.mixer.update(dt);
    if (npc.update) npc.update(dt);
  }

  renderer.render(scene, camera);
}

tick();
