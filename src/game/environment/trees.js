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
export function createTrees(scene, fieldSize, treeDefinitions) {
  const colliders = [];
  const forest = new Group();

  const tmpMatrix = new Matrix4();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3();
  const yAxis = new Vector3(0, 1, 0);
  const pineTrees = treeDefinitions.filter((tree) => tree.type === "pine");
  const roundTrees = treeDefinitions.filter((tree) => tree.type === "round");
  const birchTrees = treeDefinitions.filter((tree) => tree.type === "birch");

  // ===== Layered Pine Trees =====
  const pineCount = pineTrees.length;
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
    const tree = pineTrees[i];
    const { x, z, scale, height, rotY } = tree;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Trunk
    tmpPos.set(x, height * 0.15, z);
    tmpScale.set(scale, height * 0.3, scale);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    pineTrunks.setMatrixAt(i, tmpMatrix);
    pineTrunks.setColorAt(i, new Color(tree.trunkColor));

    const layerColor = new Color(tree.leafColor);

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
  const roundCount = roundTrees.length;
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
    const tree = roundTrees[i];
    const { x, z, scale, trunkHeight, rotY, canopyScale, canopyHeight } = tree;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Trunk
    tmpPos.set(x, trunkHeight * 0.5, z);
    tmpScale.set(scale * 0.8, trunkHeight, scale * 0.8);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    roundTrunks.setMatrixAt(i, tmpMatrix);
    roundTrunks.setColorAt(i, new Color(tree.trunkColor));

    // Canopy (squashed sphere)
    tmpPos.set(x, trunkHeight + canopyScale * 0.6, z);
    tmpScale.set(canopyScale, canopyHeight, canopyScale);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    roundCanopies.setMatrixAt(i, tmpMatrix);
    roundCanopies.setColorAt(i, new Color(tree.leafColor));

    colliders.push({ position: new Vector3(x, 0, z), radius: canopyScale * 0.7 });
  }

  roundTrunks.instanceMatrix.needsUpdate = true;
  roundTrunks.instanceColor.needsUpdate = true;
  roundCanopies.instanceMatrix.needsUpdate = true;
  roundCanopies.instanceColor.needsUpdate = true;

  forest.add(roundTrunks, roundCanopies);

  // ===== Tall Slim Birch-like Trees =====
  const slimCount = birchTrees.length;
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
    const tree = birchTrees[i];
    const { x, z, scale, trunkHeight, rotY, canopyWidth, canopyHeight } = tree;
    tmpQuat.setFromAxisAngle(yAxis, rotY);

    // Tall slim trunk
    tmpPos.set(x, trunkHeight * 0.5, z);
    tmpScale.set(scale * 0.6, trunkHeight, scale * 0.6);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    slimTrunks.setMatrixAt(i, tmpMatrix);
    slimTrunks.setColorAt(i, new Color(tree.trunkColor));

    // Smaller, elongated canopy
    tmpPos.set(x, trunkHeight + canopyHeight * 0.4, z);
    tmpScale.set(canopyWidth, canopyHeight, canopyWidth);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    slimCanopies.setMatrixAt(i, tmpMatrix);
    slimCanopies.setColorAt(i, new Color(tree.leafColor));

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
