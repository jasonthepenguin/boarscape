import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

const RIVER_WIDTH = 6;
const BANK_EXTRA = 2.6; // how much wider the muddy bank is than the water
const SEGMENT_STEP = 2;

const WATER_COLOR = "#3a7bc8";
const BANK_COLOR = "#4a3b28";

const FLOW_SPEED = 0.15; // texture scroll speed, in v-units per second

// Procedural water texture: blue base with lighter streaks stretched along
// the flow direction so scrolling it reads as moving water.
function makeWaterTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = WATER_COLOR;
  ctx.fillRect(0, 0, size, size);

  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 20 + rand() * 50;
    const light = rand() > 0.5;
    ctx.strokeStyle = light
      ? `rgba(255, 255, 255, ${0.06 + rand() * 0.1})`
      : `rgba(10, 40, 90, ${0.08 + rand() * 0.1})`;
    ctx.lineWidth = 1.5 + rand() * 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Streaks run along y, which maps to the ribbon's length (v axis)
    ctx.lineTo(x + (rand() - 0.5) * 6, y + len);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

// Centerline of the river: a gentle S-curve running along the z-axis.
export function riverCenterX(z) {
  return 8 * Math.sin(z * 0.045) + 4 * Math.sin(z * 0.11 + 1.7);
}

// Used to keep trees (and anything else) off the river and its banks.
export function isInRiverZone(x, z, margin = 1.5) {
  return Math.abs(x - riverCenterX(z)) < RIVER_WIDTH / 2 + BANK_EXTRA / 2 + margin;
}

// Builds a flat ribbon mesh following the river centerline.
function buildRibbon(width, y, extent, material) {
  const positions = [];
  const uvs = [];
  const indices = [];

  let i = 0;
  for (let z = -extent; z <= extent; z += SEGMENT_STEP, i++) {
    const cx = riverCenterX(z);
    // Perpendicular to the curve tangent so the ribbon keeps constant width.
    const slope = (riverCenterX(z + 0.1) - riverCenterX(z - 0.1)) / 0.2;
    const invLen = 1 / Math.sqrt(1 + slope * slope);
    const px = invLen;
    const pz = -slope * invLen;

    const hw = width / 2;
    positions.push(cx - px * hw, y, z - pz * hw);
    positions.push(cx + px * hw, y, z + pz * hw);
    uvs.push(0, i * 0.1, 1, i * 0.1);

    if (z + SEGMENT_STEP <= extent) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function createRiver(scene, fieldSize) {
  // Extend past the field edge so the river runs under the boundary hills.
  const extent = (fieldSize / 2) * 1.6;

  const bank = buildRibbon(
    RIVER_WIDTH + BANK_EXTRA,
    0.02,
    extent,
    new MeshStandardMaterial({ color: BANK_COLOR, roughness: 1, metalness: 0 })
  );
  scene.add(bank);

  const waterTexture = makeWaterTexture();
  const water = buildRibbon(
    RIVER_WIDTH,
    0.06,
    extent,
    new MeshStandardMaterial({
      map: waterTexture,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    })
  );
  // Draw before other transparent objects (nametags, auras) so they aren't
  // blended underneath the water — the river is huge and centered at the
  // origin, which confuses three.js's distance-based transparency sorting.
  water.renderOrder = -1;
  scene.add(water);

  // Scroll the texture along the ribbon's length to fake flowing water.
  function update(dt) {
    waterTexture.offset.y -= FLOW_SPEED * dt;
  }

  return { update };
}
