<script>
  import { onMount, onDestroy } from "svelte";
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

  let { modelUrl, onplay } = $props();

  let canvas;
  let selectedIndex = $state(0);
  let selectedColor = $derived(BOAR_COLOR_PRESETS[selectedIndex].hex);

  let renderer;
  let modelMeshes = [];
  let modelRoot = null;
  let animating = true;
  let rotationY = 0;
  let dragging = false;
  let lastX = 0;
  const autoRotateSpeed = 0.8;

  function applyColor(hex) {
    const color = new Color(hex);
    for (const mesh of modelMeshes) {
      if (mesh.material) mesh.material.color.copy(color);
    }
  }

  $effect(() => {
    applyColor(selectedColor);
  });

  function handlePointerDown(e) {
    dragging = true;
    lastX = e.clientX;
    canvas?.setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rotationY += dx * 0.01;
  }

  function handlePointerUp() {
    dragging = false;
  }

  onMount(() => {
    const scene = new Scene();
    scene.background = new Color("#000000");

    const camera = new PerspectiveCamera(
      40,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      50,
    );
    camera.position.set(0, 1.2, 4.5);

    renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = SRGBColorSpace;

    function resizePreview() {
      const rect = canvas.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
    }
    resizePreview();

    scene.add(new AmbientLight(0xffffff, 0.8));
    const light = new DirectionalLight(0xffffff, 1.2);
    light.position.set(3, 5, 4);
    scene.add(light);

    const loader = new GLTFLoader();
    loader.load(modelUrl, (gltf) => {
      const model = gltf.scene;

      const box0 = new Box3().setFromObject(model);
      const size0 = new Vector3();
      box0.getSize(size0);
      const scale = PLAYER_DESIRED_HEIGHT / Math.max(0.0001, size0.y);
      model.scale.setScalar(scale);
      model.updateMatrixWorld(true);

      const box = new Box3().setFromObject(model);
      const center = new Vector3();
      box.getCenter(center);
      model.position.sub(center);
      model.position.y -= box.min.y - center.y;

      model.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material = new MeshBasicMaterial({
            map: obj.material.map,
            color: new Color(BOAR_COLOR_PRESETS[0].hex),
          });
          modelMeshes.push(obj);
        }
      });

      modelRoot = model;
      scene.add(model);

      const bounds = new Box3().setFromObject(model);
      const modelCenter = new Vector3();
      bounds.getCenter(modelCenter);
      camera.lookAt(modelCenter);
    });

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
  });

  onDestroy(() => {
    animating = false;
    renderer?.dispose();
  });
</script>

<div class="editor">
  <div class="editor-title">Customize Your Boar</div>
  <div class="editor-box">
    <canvas
      bind:this={canvas}
      class="preview-canvas"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointercancel={handlePointerUp}
    ></canvas>
    <div class="color-swatches">
      {#each BOAR_COLOR_PRESETS as preset, i}
        <button
          class="swatch"
          class:selected={i === selectedIndex}
          style:background-color={preset.hex}
          title={preset.name}
          onclick={() => {
            selectedIndex = i;
          }}
        ></button>
      {/each}
    </div>
    <button
      class="editor-play-btn"
      onclick={() => onplay({ color: selectedColor })}
    >
      Play
    </button>
  </div>
</div>

<style>
  .editor {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: url("/dungeon-wall.svg") center / cover no-repeat #0b1220;
    z-index: 100;
  }

  .editor-title {
    font-family: "MedievalSharp", cursive;
    font-size: 42px;
    color: var(--rs-gold);
    text-shadow:
      2px 2px 0 var(--rs-brown),
      3px 3px 0 var(--rs-border),
      4px 4px 12px rgba(0, 0, 0, 0.9),
      0 0 20px rgba(255, 215, 0, 0.3);
    letter-spacing: 2px;
    margin-bottom: 24px;
    user-select: none;
  }

  .editor-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 24px 32px;
    border-radius: 8px;
    background: linear-gradient(
      180deg,
      var(--rs-brown-light) 0%,
      var(--rs-brown) 100%
    );
    border: 2px solid var(--rs-border);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 8px 24px rgba(0, 0, 0, 0.6);
  }

  .preview-canvas {
    width: 300px;
    height: 280px;
    border-radius: 6px;
    border: 2px solid var(--rs-border);
    background: #000000;
    cursor: grab;
  }

  .preview-canvas:active {
    cursor: grabbing;
  }

  .color-swatches {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    max-width: 300px;
  }

  .swatch {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid var(--rs-border);
    cursor: pointer;
    transition:
      transform 0.12s,
      border-color 0.12s;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .swatch:hover {
    transform: scale(1.15);
  }

  .swatch.selected {
    border-color: var(--rs-gold);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 0 8px rgba(255, 215, 0, 0.5),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .editor-play-btn {
    margin-top: 4px;
    padding: 10px 40px;
    border-radius: 4px;
    border: 2px solid var(--rs-border);
    background: linear-gradient(180deg, #4a8c2a 0%, #2d6b1a 50%, #1a4a0e 100%);
    color: #fff;
    font-family: "MedievalSharp", cursive;
    font-size: 20px;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 4px 8px rgba(0, 0, 0, 0.5);
    transition: filter 0.15s;
  }

  .editor-play-btn:hover {
    filter: brightness(1.2);
  }

  .editor-play-btn:active {
    filter: brightness(0.9);
  }
</style>
