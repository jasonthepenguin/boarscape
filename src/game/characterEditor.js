import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BOAR_COLOR_PRESETS, PLAYER_DESIRED_HEIGHT } from "../config.js";

export function showCharacterEditor(modelUrl) {
  const editorEl = document.querySelector("#character-editor");
  const previewCanvas = document.querySelector("#preview-canvas");
  const swatchContainer = document.querySelector("#color-swatches");
  const playBtn = document.querySelector("#editor-play-btn");

  editorEl.style.display = "flex";

  // Preview scene
  const scene = new Scene();
  scene.background = new Color("#000000");

  const camera = new PerspectiveCamera(40, previewCanvas.width / previewCanvas.height, 0.1, 50);
  camera.position.set(0, 1.2, 4.5);

  const renderer = new WebGLRenderer({ canvas: previewCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;

  function resizePreview() {
    const rect = previewCanvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  resizePreview();

  // Lighting
  scene.add(new AmbientLight(0xffffff, 0.8));
  const light = new DirectionalLight(0xffffff, 1.2);
  light.position.set(3, 5, 4);
  scene.add(light);

  // State
  let selectedColor = BOAR_COLOR_PRESETS[0].hex;
  let modelMeshes = [];
  let modelRoot = null;
  let autoRotateSpeed = 0.8;
  let rotationY = 0;

  // Drag to spin
  let dragging = false;
  let lastX = 0;

  previewCanvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    previewCanvas.setPointerCapture?.(e.pointerId);
  });

  previewCanvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rotationY += dx * 0.01;
  });

  previewCanvas.addEventListener("pointerup", () => { dragging = false; });
  previewCanvas.addEventListener("pointercancel", () => { dragging = false; });

  // Apply color tint to all meshes
  function applyColor(hex) {
    const color = new Color(hex);
    for (const mesh of modelMeshes) {
      if (mesh.material) mesh.material.color.copy(color);
    }
  }

  // Build swatch buttons
  swatchContainer.innerHTML = "";
  BOAR_COLOR_PRESETS.forEach((preset, i) => {
    const btn = document.createElement("button");
    btn.className = "swatch" + (i === 0 ? " selected" : "");
    btn.style.backgroundColor = preset.hex;
    btn.title = preset.name;
    btn.addEventListener("click", () => {
      swatchContainer.querySelectorAll(".swatch").forEach((s) => s.classList.remove("selected"));
      btn.classList.add("selected");
      selectedColor = preset.hex;
      applyColor(selectedColor);
    });
    swatchContainer.appendChild(btn);
  });

  // Load model
  const loader = new GLTFLoader();
  loader.load(modelUrl, (gltf) => {
    const model = gltf.scene;

    // Scale to desired height
    const box0 = new Box3().setFromObject(model);
    const size0 = new Vector3();
    box0.getSize(size0);
    const scale = PLAYER_DESIRED_HEIGHT / Math.max(0.0001, size0.y);
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    // Center model
    const box = new Box3().setFromObject(model);
    const center = new Vector3();
    box.getCenter(center);
    model.position.sub(center);
    model.position.y -= box.min.y - center.y;

    // Convert to unlit materials and collect meshes
    model.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.material = new MeshBasicMaterial({
          map: obj.material.map,
          color: new Color(selectedColor),
        });
        modelMeshes.push(obj);
      }
    });

    modelRoot = model;
    scene.add(model);

    // Point camera at model center
    const bounds = new Box3().setFromObject(model);
    const modelCenter = new Vector3();
    bounds.getCenter(modelCenter);
    camera.lookAt(modelCenter);
  });

  // Render loop
  let animating = true;

  function tick() {
    if (!animating) return;
    requestAnimationFrame(tick);

    if (modelRoot) {
      if (!dragging) rotationY += autoRotateSpeed * 0.016;
      modelRoot.rotation.y = rotationY;
    }

    renderer.render(scene, camera);
  }
  tick();

  // Return promise that resolves when player clicks Play
  return new Promise((resolve) => {
    playBtn.addEventListener("click", () => {
      animating = false;
      editorEl.style.display = "none";
      renderer.dispose();
      resolve({ color: selectedColor });
    }, { once: true });
  });
}
