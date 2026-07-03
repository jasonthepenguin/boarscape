import {
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";

const HILL_COLORS = ["#1c4a1c", "#225222", "#183f18", "#2a5c2a", "#204820"];
const SKIRT_COLOR = "#1d431d";

// Seeded PRNG so every client sees the same hills.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two overlapping rings of hills: a low inner ring hugging the field edge and
// a taller outer ring behind it for a layered horizon.
const RINGS = [
  { offset: 5, spacing: 9, radiusMin: 7, radiusMax: 11, heightMin: 2.5, heightMax: 5 },
  { offset: 16, spacing: 13, radiusMin: 11, radiusMax: 18, heightMin: 5, heightMax: 10 },
];

export function createHills(scene, fieldSize) {
  const half = fieldSize / 2;
  const rand = mulberry32(0xb0a5);

  // Darker ground skirt beyond the playable field so hills don't sit on sky.
  const skirtGeo = new PlaneGeometry(fieldSize * 4, fieldSize * 4, 1, 1);
  skirtGeo.rotateX(-Math.PI / 2);
  const skirt = new Mesh(
    skirtGeo,
    new MeshStandardMaterial({ color: SKIRT_COLOR, roughness: 1, metalness: 0 })
  );
  skirt.position.y = -0.08;
  skirt.receiveShadow = true;
  scene.add(skirt);

  const placements = [];
  for (const ring of RINGS) {
    const edge = half + ring.offset;
    for (let side = 0; side < 4; side++) {
      for (let t = -edge; t <= edge; t += ring.spacing) {
        const along = t + (rand() - 0.5) * ring.spacing * 0.6;
        const out = edge + (rand() - 0.5) * 5;
        let x, z;
        if (side === 0) [x, z] = [along, -out];
        else if (side === 1) [x, z] = [along, out];
        else if (side === 2) [x, z] = [-out, along];
        else [x, z] = [out, along];

        placements.push({
          x,
          z,
          radius: ring.radiusMin + rand() * (ring.radiusMax - ring.radiusMin),
          height: ring.heightMin + rand() * (ring.heightMax - ring.heightMin),
          rotY: rand() * Math.PI * 2,
          color: HILL_COLORS[(rand() * HILL_COLORS.length) | 0],
        });
      }
    }
  }

  const geo = new SphereGeometry(1, 8, 6);
  const mat = new MeshStandardMaterial({ color: "#ffffff", roughness: 1, metalness: 0 });
  const mesh = new InstancedMesh(geo, mat, placements.length);
  mesh.receiveShadow = true;

  const tmpMatrix = new Matrix4();
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3();
  const yAxis = new Vector3(0, 1, 0);

  for (let i = 0; i < placements.length; i++) {
    const hill = placements[i];
    tmpPos.set(hill.x, -hill.height * 0.1, hill.z);
    tmpQuat.setFromAxisAngle(yAxis, hill.rotY);
    tmpScale.set(hill.radius, hill.height, hill.radius * (0.85 + rand() * 0.3));
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    mesh.setMatrixAt(i, tmpMatrix);
    mesh.setColorAt(i, new Color(hill.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  scene.add(mesh);
}
