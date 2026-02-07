import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import {
  BG_COLOR,
  MAX_DT,
  TONE_MAPPING_EXPOSURE,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_FAR,
  HEMI_SKY_COLOR,
  HEMI_GROUND_COLOR,
  HEMI_INTENSITY,
  AMBIENT_INTENSITY,
  SUN_INTENSITY,
  SUN_POSITION,
  SUN_SHADOW_BIAS,
  SUN_SHADOW_NORMAL_BIAS,
  SHADOW_MAP_SIZE,
  SHADOW_NEAR,
  SHADOW_FAR,
  SHADOW_RANGE,
  FILL_INTENSITY,
  FILL_POSITION,
} from "../config.js";

export function createScene(canvas) {
  const scene = new Scene();
  scene.background = new Color(BG_COLOR);

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
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
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

  // Lighting
  const hemi = new HemisphereLight(HEMI_SKY_COLOR, HEMI_GROUND_COLOR, HEMI_INTENSITY);
  scene.add(hemi);

  const ambient = new AmbientLight(0xffffff, AMBIENT_INTENSITY);
  scene.add(ambient);

  const sun = new DirectionalLight(0xffffff, SUN_INTENSITY);
  sun.position.set(...SUN_POSITION);
  sun.castShadow = true;
  sun.shadow.bias = SUN_SHADOW_BIAS;
  sun.shadow.normalBias = SUN_SHADOW_NORMAL_BIAS;
  sun.shadow.mapSize.width = SHADOW_MAP_SIZE;
  sun.shadow.mapSize.height = SHADOW_MAP_SIZE;
  sun.shadow.camera.near = SHADOW_NEAR;
  sun.shadow.camera.far = SHADOW_FAR;
  sun.shadow.camera.left = -SHADOW_RANGE;
  sun.shadow.camera.right = SHADOW_RANGE;
  sun.shadow.camera.top = SHADOW_RANGE;
  sun.shadow.camera.bottom = -SHADOW_RANGE;
  scene.add(sun);

  const fill = new DirectionalLight(0xffffff, FILL_INTENSITY);
  fill.position.set(...FILL_POSITION);
  fill.castShadow = false;
  scene.add(fill);

  // Resize handler
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // Game loop
  function start(updateFn) {
    const clock = new Clock();

    function tick() {
      requestAnimationFrame(tick);
      const dt = Math.min(MAX_DT, clock.getDelta());
      updateFn(dt);
      renderer.render(scene, camera);
    }

    tick();
  }

  return { scene, camera, start };
}
