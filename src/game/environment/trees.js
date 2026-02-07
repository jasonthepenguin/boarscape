import {
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import {
  SPAWN_AVOID_RADIUS,
  PINE_RATIO,
  ROUND_RATIO,
  BIRCH_RATIO,
  TRUNK_COLORS,
  LEAF_COLORS,
  BIRCH_TRUNK_COLORS,
  BIRCH_LEAF_COLORS,
} from "../../config.js";

function varyColor(rng, baseHex, hueVar = 0.05, satVar = 0.15, lightVar = 0.1) {
  const color = new Color(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  hsl.h += (rng() - 0.5) * hueVar;
  hsl.s = Math.max(0, Math.min(1, hsl.s + (rng() - 0.5) * satVar));
  hsl.l = Math.max(0, Math.min(1, hsl.l + (rng() - 0.5) * lightVar));
  return new Color().setHSL(hsl.h, hsl.s, hsl.l);
}

function randomPosition(rng, half) {
  let x = 0, z = 0;
  for (let tries = 0; tries < 50; tries++) {
    x = (rng() * 2 - 1) * (half - 6);
    z = (rng() * 2 - 1) * (half - 6);
    if (x * x + z * z > SPAWN_AVOID_RADIUS * SPAWN_AVOID_RADIUS) break;
  }
  return { x, z };
}

export function createTrees(scene, rng, fieldSize, treeCount) {
  const half = fieldSize / 2;
  const colliders = [];
  const forest = new Group();

  const tmpMatrix = new Matrix4();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3();
  const yAxis = new Vector3(0, 1, 0);

  // ===== Layered Pine Trees =====
  const pineCount = Math.floor(treeCount * PINE_RATIO);
  const pineTrunkGeo = new CylinderGeometry(0.12, 0.22, 1.0, 6);
  const pineLayerGeo = new ConeGeometry(1.0, 1.4, 7);

  const pineTrunkMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
  const pineLeavesMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });

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
    const { x, z } = randomPosition(rng, half);
    const scale = 0.7 + rng() * 0.8;
    const height = 3.5 + rng() * 2.5;
    const rotY = rng() * Math.PI * 2;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Trunk
    tmpPos.set(x, height * 0.15, z);
    tmpScale.set(scale, height * 0.3, scale);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    pineTrunks.setMatrixAt(i, tmpMatrix);
    pineTrunks.setColorAt(i, varyColor(rng, TRUNK_COLORS[i % TRUNK_COLORS.length], 0.02, 0.1, 0.15));

    const layerColor = varyColor(rng, LEAF_COLORS[i % LEAF_COLORS.length], 0.08, 0.2, 0.12);

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

    colliders.push({ position: new Vector3(x, 0, z), radius: scale * 0.8 });
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

  // ===== Round Deciduous Trees =====
  const roundCount = Math.floor(treeCount * ROUND_RATIO);
  const roundTrunkGeo = new CylinderGeometry(0.15, 0.28, 1.0, 8);
  const roundCanopyGeo = new DodecahedronGeometry(1.0, 1);

  const roundTrunkMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 1 });
  const roundLeavesMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 });

  const roundTrunks = new InstancedMesh(roundTrunkGeo, roundTrunkMat, roundCount);
  const roundCanopies = new InstancedMesh(roundCanopyGeo, roundLeavesMat, roundCount);

  roundTrunks.castShadow = true;
  roundTrunks.receiveShadow = true;
  roundCanopies.castShadow = true;

  for (let i = 0; i < roundCount; i++) {
    const { x, z } = randomPosition(rng, half);
    const scale = 0.8 + rng() * 0.7;
    const trunkHeight = 1.8 + rng() * 1.5;
    const rotY = rng() * Math.PI * 2;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Trunk
    tmpPos.set(x, trunkHeight * 0.5, z);
    tmpScale.set(scale * 0.8, trunkHeight, scale * 0.8);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    roundTrunks.setMatrixAt(i, tmpMatrix);
    roundTrunks.setColorAt(i, varyColor(rng, TRUNK_COLORS[(i + 2) % TRUNK_COLORS.length], 0.02, 0.1, 0.15));

    // Canopy (squashed sphere)
    const canopyScale = scale * (1.3 + rng() * 0.5);
    tmpPos.set(x, trunkHeight + canopyScale * 0.6, z);
    tmpScale.set(canopyScale, canopyScale * (0.7 + rng() * 0.3), canopyScale);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    roundCanopies.setMatrixAt(i, tmpMatrix);
    roundCanopies.setColorAt(i, varyColor(rng, LEAF_COLORS[(i + 3) % LEAF_COLORS.length], 0.1, 0.25, 0.15));

    colliders.push({ position: new Vector3(x, 0, z), radius: canopyScale * 0.7 });
  }

  roundTrunks.instanceMatrix.needsUpdate = true;
  roundTrunks.instanceColor.needsUpdate = true;
  roundCanopies.instanceMatrix.needsUpdate = true;
  roundCanopies.instanceColor.needsUpdate = true;

  forest.add(roundTrunks, roundCanopies);

  // ===== Tall Slim Birch-like Trees =====
  const slimCount = Math.floor(treeCount * BIRCH_RATIO);
  const slimTrunkGeo = new CylinderGeometry(0.08, 0.14, 1.0, 6);
  const slimCanopyGeo = new SphereGeometry(1.0, 6, 5);

  const slimTrunkMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });
  const slimLeavesMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });

  const slimTrunks = new InstancedMesh(slimTrunkGeo, slimTrunkMat, slimCount);
  const slimCanopies = new InstancedMesh(slimCanopyGeo, slimLeavesMat, slimCount);

  slimTrunks.castShadow = true;
  slimTrunks.receiveShadow = true;
  slimCanopies.castShadow = true;

  for (let i = 0; i < slimCount; i++) {
    const { x, z } = randomPosition(rng, half);
    const scale = 0.6 + rng() * 0.5;
    const trunkHeight = 3.5 + rng() * 2.0;
    const rotY = rng() * Math.PI * 2;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Tall slim trunk
    tmpPos.set(x, trunkHeight * 0.5, z);
    tmpScale.set(scale * 0.6, trunkHeight, scale * 0.6);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    slimTrunks.setMatrixAt(i, tmpMatrix);
    slimTrunks.setColorAt(i, varyColor(rng, BIRCH_TRUNK_COLORS[i % BIRCH_TRUNK_COLORS.length], 0.02, 0.08, 0.1));

    // Smaller, elongated canopy
    const canopyWidth = scale * (0.8 + rng() * 0.4);
    const canopyHeight = scale * (1.2 + rng() * 0.6);
    tmpPos.set(x, trunkHeight + canopyHeight * 0.4, z);
    tmpScale.set(canopyWidth, canopyHeight, canopyWidth);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    slimCanopies.setMatrixAt(i, tmpMatrix);
    slimCanopies.setColorAt(i, varyColor(rng, BIRCH_LEAF_COLORS[i % BIRCH_LEAF_COLORS.length], 0.08, 0.2, 0.12));

    colliders.push({ position: new Vector3(x, 0, z), radius: canopyWidth * 0.6 });
  }

  slimTrunks.instanceMatrix.needsUpdate = true;
  slimTrunks.instanceColor.needsUpdate = true;
  slimCanopies.instanceMatrix.needsUpdate = true;
  slimCanopies.instanceColor.needsUpdate = true;

  forest.add(slimTrunks, slimCanopies);

  scene.add(forest);

  return { group: forest, colliders };
}
