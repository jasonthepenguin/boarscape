import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";

function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#3b7d2a";
  ctx.fillRect(0, 0, size, size);

  // Speckle + blades
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 110 + Math.random() * 70;
    const a = 0.08 + Math.random() * 0.12;
    ctx.fillStyle = `rgba(0, ${g | 0}, 0, ${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 4 + Math.random() * 10;
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 0.6;
    const x2 = x + Math.cos(angle) * len;
    const y2 = y + Math.sin(angle) * len;
    ctx.strokeStyle = `rgba(30, 120, 20, ${0.10 + Math.random() * 0.10})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function makeCloudTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  // Soft blobs
  for (let i = 0; i < 28; i++) {
    const x = (0.18 + Math.random() * 0.64) * size;
    const y = (0.22 + Math.random() * 0.56) * size;
    const r = (0.10 + Math.random() * 0.18) * size;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Light noise for texture breakup
  const image = ctx.getImageData(0, 0, size, size);
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
  }
  ctx.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createEnvironment(scene, { fieldSize = 520, treeCount = 260 } = {}) {
  // Background
  scene.background = new Color("#87cfff");

  // Sky dome shader (subtle, keeps it blue)
  const sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const sun = new Vector3();
  const elevation = 18;
  const azimuth = 120;
  const phi = (90 - elevation) * (Math.PI / 180);
  const theta = azimuth * (Math.PI / 180);
  sun.setFromSphericalCoords(1, phi, theta);
  sky.material.uniforms["sunPosition"].value.copy(sun);
  sky.material.uniforms["turbidity"].value = 8;
  sky.material.uniforms["rayleigh"].value = 2.2;
  sky.material.uniforms["mieCoefficient"].value = 0.004;
  sky.material.uniforms["mieDirectionalG"].value = 0.84;

  // Ground
  const grassTex = makeGrassTexture();
  grassTex.repeat.set(fieldSize / 6, fieldSize / 6);
  const groundGeo = new PlaneGeometry(fieldSize, fieldSize, 1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new MeshStandardMaterial({
    map: grassTex,
    roughness: 1,
    metalness: 0,
  });
  const ground = new Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);

  // Trees (instanced for performance)
  const trunkGeo = new CylinderGeometry(0.18, 0.26, 2.0, 8);
  const leavesGeo = new ConeGeometry(1.15, 2.7, 8);
  const trunkMat = new MeshStandardMaterial({ color: new Color("#7b4a2a"), roughness: 1 });
  const leavesMat = new MeshStandardMaterial({ color: new Color("#2f8f3a"), roughness: 1 });

  const trunks = new InstancedMesh(trunkGeo, trunkMat, treeCount);
  const leaves = new InstancedMesh(leavesGeo, leavesMat, treeCount);
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  leaves.castShadow = true;

  const treeColliders = [];
  const tmpMatrix = new Matrix4();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3();
  const yAxis = new Vector3(0, 1, 0);

  const half = fieldSize / 2;
  const spawnAvoidRadius = 16;

  for (let i = 0; i < treeCount; i++) {
    let x = 0;
    let z = 0;
    // Keep spawn area clear
    for (let tries = 0; tries < 50; tries++) {
      x = (Math.random() * 2 - 1) * (half - 6);
      z = (Math.random() * 2 - 1) * (half - 6);
      if (x * x + z * z > spawnAvoidRadius * spawnAvoidRadius) break;
    }

    const h = 1 + Math.random() * 1.2;
    const s = 0.9 + Math.random() * 0.6;
    const rotY = Math.random() * Math.PI * 2;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Trunk matrix
    tmpPos.set(x, (2.0 * h) / 2, z);
    tmpScale.set(s, h, s);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    trunks.setMatrixAt(i, tmpMatrix);

    // Leaves matrix
    tmpPos.set(x, 2.0 * h + (2.7 * s) / 2 - 0.2, z);
    tmpScale.set(1.0 * s, 1.0 * s, 1.0 * s);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    leaves.setMatrixAt(i, tmpMatrix);

    treeColliders.push({
      position: new Vector3(x, 0, z),
      radius: 1.15 * s,
    });
  }

  trunks.instanceMatrix.needsUpdate = true;
  leaves.instanceMatrix.needsUpdate = true;

  const forest = new Group();
  forest.add(trunks);
  forest.add(leaves);
  scene.add(forest);

  // Clouds
  const cloudTex = makeCloudTexture();

  const clouds = [];
  const cloudLayerY = 46;
  const cloudRange = half * 1.2;
  const cloudCount = 34;
  for (let i = 0; i < cloudCount; i++) {
    const sprite = new Sprite(
      new SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.55 + Math.random() * 0.32,
        depthWrite: false,
      }),
    );
    const w = 24 + Math.random() * 46;
    sprite.scale.set(w, w * (0.55 + Math.random() * 0.25), 1);
    sprite.position.set(
      (Math.random() * 2 - 1) * cloudRange,
      cloudLayerY + Math.random() * 16,
      (Math.random() * 2 - 1) * cloudRange,
    );
    sprite.renderOrder = 10;
    scene.add(sprite);
    clouds.push({
      sprite,
      speed: 0.5 + Math.random() * 1.2,
    });
  }

  function update(deltaSeconds) {
    // Drift clouds
    for (const c of clouds) {
      c.sprite.position.x += c.speed * deltaSeconds;
      if (c.sprite.position.x > cloudRange) c.sprite.position.x = -cloudRange;
    }
  }

  return {
    boundsHalfSize: half,
    groundY: 0,
    treeColliders,
    update,
  };
}
