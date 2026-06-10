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

const tmpMatrix = new Matrix4();
const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const yAxis = new Vector3(0, 1, 0);

/**
 * Builds one InstancedMesh per part for a list of trees. Each part spec
 * provides geometry/material plus a `place` function returning
 * { y, scale: [sx, sy, sz], color } for a given tree definition.
 */
function buildInstancedParts(treeList, parts) {
  const count = treeList.length;
  const meshes = parts.map((part) => {
    const mesh = new InstancedMesh(part.geometry, part.material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = part.receiveShadow ?? false;
    return mesh;
  });

  for (let i = 0; i < count; i++) {
    const tree = treeList[i];
    tmpQuat.setFromAxisAngle(yAxis, tree.rotY);
    for (let j = 0; j < parts.length; j++) {
      const { y, scale, color } = parts[j].place(tree);
      tmpPos.set(tree.x, y, tree.z);
      tmpScale.set(scale[0], scale[1], scale[2]);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      meshes[j].setMatrixAt(i, tmpMatrix);
      meshes[j].setColorAt(i, color);
    }
  }

  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return meshes;
}

function trunkPart(geometry, roughness, place) {
  return {
    geometry,
    material: new MeshStandardMaterial({ color: "#ffffff", roughness }),
    receiveShadow: true,
    place,
  };
}

// Pine layers share one cone geometry/material; each layer differs only in
// height along the trunk, width/height multipliers, and a lightness offset.
const pineLayerGeo = new ConeGeometry(1.0, 1.4, 7);
const pineLeavesMat = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 });

function pineLayerPart(yFactor, widthMul, heightMul, lightOffset) {
  return {
    geometry: pineLayerGeo,
    material: pineLeavesMat,
    place: (tree) => ({
      y: tree.height * yFactor,
      scale: [tree.scale * widthMul, tree.scale * heightMul, tree.scale * widthMul],
      color: new Color(tree.leafColor).offsetHSL(0, 0, lightOffset),
    }),
  };
}

const TREE_TYPES = [
  {
    type: "pine",
    colliderRadius: (tree) => tree.scale * 0.8,
    parts: [
      trunkPart(new CylinderGeometry(0.12, 0.22, 1.0, 6), 1, (tree) => ({
        y: tree.height * 0.15,
        scale: [tree.scale, tree.height * 0.3, tree.scale],
        color: new Color(tree.trunkColor),
      })),
      pineLayerPart(0.35, 1.3, 1.1, -0.05),
      pineLayerPart(0.55, 1.0, 1.0, 0),
      pineLayerPart(0.75, 0.7, 0.9, 0.05),
    ],
  },
  {
    type: "round",
    colliderRadius: (tree) => tree.canopyScale * 0.7,
    parts: [
      trunkPart(new CylinderGeometry(0.15, 0.28, 1.0, 8), 1, (tree) => ({
        y: tree.trunkHeight * 0.5,
        scale: [tree.scale * 0.8, tree.trunkHeight, tree.scale * 0.8],
        color: new Color(tree.trunkColor),
      })),
      {
        geometry: new DodecahedronGeometry(1.0, 1),
        material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.85 }),
        place: (tree) => ({
          y: tree.trunkHeight + tree.canopyScale * 0.6,
          scale: [tree.canopyScale, tree.canopyHeight, tree.canopyScale],
          color: new Color(tree.leafColor),
        }),
      },
    ],
  },
  {
    type: "birch",
    colliderRadius: (tree) => tree.canopyWidth * 0.6,
    parts: [
      trunkPart(new CylinderGeometry(0.08, 0.14, 1.0, 6), 0.9, (tree) => ({
        y: tree.trunkHeight * 0.5,
        scale: [tree.scale * 0.6, tree.trunkHeight, tree.scale * 0.6],
        color: new Color(tree.trunkColor),
      })),
      {
        geometry: new SphereGeometry(1.0, 6, 5),
        material: new MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 }),
        place: (tree) => ({
          y: tree.trunkHeight + tree.canopyHeight * 0.4,
          scale: [tree.canopyWidth, tree.canopyHeight, tree.canopyWidth],
          color: new Color(tree.leafColor),
        }),
      },
    ],
  },
];

export function createTrees(scene, treeDefinitions) {
  const colliders = [];
  const forest = new Group();

  for (const { type, colliderRadius, parts } of TREE_TYPES) {
    const trees = treeDefinitions.filter((tree) => tree.type === type);
    forest.add(...buildInstancedParts(trees, parts));
    for (const tree of trees) {
      colliders.push({ position: new Vector3(tree.x, 0, tree.z), radius: colliderRadius(tree) });
    }
  }

  scene.add(forest);

  return { group: forest, colliders };
}
