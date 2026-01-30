import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  SphereGeometry,
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

export function createEnvironment(scene, { fieldSize = 120, treeCount = 500 } = {}) {
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

  // Trees - multiple types for variety
  const half = fieldSize / 2;
  const spawnAvoidRadius = 16;
  const treeColliders = [];
  const forest = new Group();

  // Helper for random color variation
  const varyColor = (baseHex, hueVar = 0.05, satVar = 0.15, lightVar = 0.1) => {
    const color = new Color(baseHex);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    hsl.h += (Math.random() - 0.5) * hueVar;
    hsl.s = Math.max(0, Math.min(1, hsl.s + (Math.random() - 0.5) * satVar));
    hsl.l = Math.max(0, Math.min(1, hsl.l + (Math.random() - 0.5) * lightVar));
    return new Color().setHSL(hsl.h, hsl.s, hsl.l);
  };

  // Trunk colors (browns, grays)
  const trunkColors = ["#5c3d2e", "#7b4a2a", "#6b5344", "#4a3728", "#8b6914"];
  // Leaf colors (greens, some autumn touches)
  const leafColors = ["#2f8f3a", "#1e6b2e", "#4a9f4a", "#3d7a3d", "#5aaf5a", "#2d5a1e", "#6b8e23"];

  const tmpMatrix = new Matrix4();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3();
  const yAxis = new Vector3(0, 1, 0);

  // ===== TREE TYPE 1: Layered Pine Trees =====
  const pineCount = Math.floor(treeCount * 0.4);
  const pineTrunkGeo = new CylinderGeometry(0.12, 0.22, 1.0, 6);
  const pineLayerGeo = new ConeGeometry(1.0, 1.4, 7);
  
  const pineTrunkMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
  const pineLeavesMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });

  // 3 layers per pine tree
  const pineTrunks = new InstancedMesh(pineTrunkGeo, pineTrunkMat, pineCount);
  const pineLayer1 = new InstancedMesh(pineLayerGeo, pineLeavesMat, pineCount);
  const pineLayer2 = new InstancedMesh(pineLayerGeo, pineLeavesMat, pineCount);
  const pineLayer3 = new InstancedMesh(pineLayerGeo, pineLeavesMat, pineCount);

  pineTrunks.castShadow = true;
  pineTrunks.receiveShadow = true;
  pineLayer1.castShadow = true;
  pineLayer2.castShadow = true;
  pineLayer3.castShadow = true;

  for (let i = 0; i < pineCount; i++) {
    let x = 0, z = 0;
    for (let tries = 0; tries < 50; tries++) {
      x = (Math.random() * 2 - 1) * (half - 6);
      z = (Math.random() * 2 - 1) * (half - 6);
      if (x * x + z * z > spawnAvoidRadius * spawnAvoidRadius) break;
    }

    const scale = 0.7 + Math.random() * 0.8;
    const height = 3.5 + Math.random() * 2.5;
    const rotY = Math.random() * Math.PI * 2;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Trunk
    tmpPos.set(x, height * 0.15, z);
    tmpScale.set(scale, height * 0.3, scale);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    pineTrunks.setMatrixAt(i, tmpMatrix);
    pineTrunks.setColorAt(i, varyColor(trunkColors[i % trunkColors.length], 0.02, 0.1, 0.15));

    // Layer colors with slight variation per tree
    const layerColor = varyColor(leafColors[i % leafColors.length], 0.08, 0.2, 0.12);

    // Bottom layer (largest)
    tmpPos.set(x, height * 0.35, z);
    tmpScale.set(scale * 1.3, scale * 1.1, scale * 1.3);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    pineLayer1.setMatrixAt(i, tmpMatrix);
    pineLayer1.setColorAt(i, layerColor.clone().offsetHSL(0, 0, -0.05));

    // Middle layer
    tmpPos.set(x, height * 0.55, z);
    tmpScale.set(scale * 1.0, scale * 1.0, scale * 1.0);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    pineLayer2.setMatrixAt(i, tmpMatrix);
    pineLayer2.setColorAt(i, layerColor);

    // Top layer (smallest)
    tmpPos.set(x, height * 0.75, z);
    tmpScale.set(scale * 0.7, scale * 0.9, scale * 0.7);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    pineLayer3.setMatrixAt(i, tmpMatrix);
    pineLayer3.setColorAt(i, layerColor.clone().offsetHSL(0, 0, 0.05));

    treeColliders.push({ position: new Vector3(x, 0, z), radius: scale * 0.8 });
  }

  pineTrunks.instanceMatrix.needsUpdate = true;
  pineTrunks.instanceColor.needsUpdate = true;
  pineLayer1.instanceMatrix.needsUpdate = true;
  pineLayer1.instanceColor.needsUpdate = true;
  pineLayer2.instanceMatrix.needsUpdate = true;
  pineLayer2.instanceColor.needsUpdate = true;
  pineLayer3.instanceMatrix.needsUpdate = true;
  pineLayer3.instanceColor.needsUpdate = true;

  forest.add(pineTrunks, pineLayer1, pineLayer2, pineLayer3);

  // ===== TREE TYPE 2: Round Deciduous Trees =====
  const roundCount = Math.floor(treeCount * 0.35);
  const roundTrunkGeo = new CylinderGeometry(0.15, 0.28, 1.0, 8);
  const roundCanopyGeo = new DodecahedronGeometry(1.0, 1); // Low-poly sphere-ish

  const roundTrunkMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
  const roundLeavesMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 });

  const roundTrunks = new InstancedMesh(roundTrunkGeo, roundTrunkMat, roundCount);
  const roundCanopies = new InstancedMesh(roundCanopyGeo, roundLeavesMat, roundCount);

  roundTrunks.castShadow = true;
  roundTrunks.receiveShadow = true;
  roundCanopies.castShadow = true;

  for (let i = 0; i < roundCount; i++) {
    let x = 0, z = 0;
    for (let tries = 0; tries < 50; tries++) {
      x = (Math.random() * 2 - 1) * (half - 6);
      z = (Math.random() * 2 - 1) * (half - 6);
      if (x * x + z * z > spawnAvoidRadius * spawnAvoidRadius) break;
    }

    const scale = 0.8 + Math.random() * 0.7;
    const trunkHeight = 1.8 + Math.random() * 1.5;
    const rotY = Math.random() * Math.PI * 2;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Trunk
    tmpPos.set(x, trunkHeight * 0.5, z);
    tmpScale.set(scale * 0.8, trunkHeight, scale * 0.8);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    roundTrunks.setMatrixAt(i, tmpMatrix);
    roundTrunks.setColorAt(i, varyColor(trunkColors[(i + 2) % trunkColors.length], 0.02, 0.1, 0.15));

    // Canopy (squashed sphere)
    const canopyScale = scale * (1.3 + Math.random() * 0.5);
    tmpPos.set(x, trunkHeight + canopyScale * 0.6, z);
    tmpScale.set(canopyScale, canopyScale * (0.7 + Math.random() * 0.3), canopyScale);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    roundCanopies.setMatrixAt(i, tmpMatrix);
    roundCanopies.setColorAt(i, varyColor(leafColors[(i + 3) % leafColors.length], 0.1, 0.25, 0.15));

    treeColliders.push({ position: new Vector3(x, 0, z), radius: canopyScale * 0.7 });
  }

  roundTrunks.instanceMatrix.needsUpdate = true;
  roundTrunks.instanceColor.needsUpdate = true;
  roundCanopies.instanceMatrix.needsUpdate = true;
  roundCanopies.instanceColor.needsUpdate = true;

  forest.add(roundTrunks, roundCanopies);

  // ===== TREE TYPE 3: Tall Slim Birch-like Trees =====
  const slimCount = Math.floor(treeCount * 0.25);
  const slimTrunkGeo = new CylinderGeometry(0.08, 0.14, 1.0, 6);
  const slimCanopyGeo = new SphereGeometry(1.0, 6, 5);

  const slimTrunkMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
  const slimLeavesMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });

  const slimTrunks = new InstancedMesh(slimTrunkGeo, slimTrunkMat, slimCount);
  const slimCanopies = new InstancedMesh(slimCanopyGeo, slimLeavesMat, slimCount);

  slimTrunks.castShadow = true;
  slimTrunks.receiveShadow = true;
  slimCanopies.castShadow = true;

  // Lighter trunk colors for birch-like trees
  const lightTrunkColors = ["#d4c8b8", "#e8dcc8", "#c9b99a", "#bfb5a0"];

  for (let i = 0; i < slimCount; i++) {
    let x = 0, z = 0;
    for (let tries = 0; tries < 50; tries++) {
      x = (Math.random() * 2 - 1) * (half - 6);
      z = (Math.random() * 2 - 1) * (half - 6);
      if (x * x + z * z > spawnAvoidRadius * spawnAvoidRadius) break;
    }

    const scale = 0.6 + Math.random() * 0.5;
    const trunkHeight = 3.5 + Math.random() * 2.0;
    const rotY = Math.random() * Math.PI * 2;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Tall slim trunk
    tmpPos.set(x, trunkHeight * 0.5, z);
    tmpScale.set(scale * 0.6, trunkHeight, scale * 0.6);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    slimTrunks.setMatrixAt(i, tmpMatrix);
    slimTrunks.setColorAt(i, varyColor(lightTrunkColors[i % lightTrunkColors.length], 0.02, 0.08, 0.1));

    // Smaller, elongated canopy
    const canopyWidth = scale * (0.8 + Math.random() * 0.4);
    const canopyHeight = scale * (1.2 + Math.random() * 0.6);
    tmpPos.set(x, trunkHeight + canopyHeight * 0.4, z);
    tmpScale.set(canopyWidth, canopyHeight, canopyWidth);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    slimCanopies.setMatrixAt(i, tmpMatrix);
    
    // Lighter, more yellow-green for birch leaves
    const birchLeafColors = ["#8bc34a", "#9ccc65", "#7cb342", "#aed581"];
    slimCanopies.setColorAt(i, varyColor(birchLeafColors[i % birchLeafColors.length], 0.08, 0.2, 0.12));

    treeColliders.push({ position: new Vector3(x, 0, z), radius: canopyWidth * 0.6 });
  }

  slimTrunks.instanceMatrix.needsUpdate = true;
  slimTrunks.instanceColor.needsUpdate = true;
  slimCanopies.instanceMatrix.needsUpdate = true;
  slimCanopies.instanceColor.needsUpdate = true;

  forest.add(slimTrunks, slimCanopies);

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
