import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Color } from "three";
import {
  FIELD_SIZE,
  TREE_COUNT,
  SPAWN_AVOID_RADIUS,
  PINE_RATIO,
  ROUND_RATIO,
  BIRCH_RATIO,
  TRUNK_COLORS,
  LEAF_COLORS,
  BIRCH_TRUNK_COLORS,
  BIRCH_LEAF_COLORS,
} from "../src/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.resolve(__dirname, "../src/data/treeSpawns.json");
const seed = Number(process.argv[2] ?? 42);

function createRng(initialSeed) {
  let s = initialSeed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function varyColor(rng, baseHex, hueVar = 0.05, satVar = 0.15, lightVar = 0.1) {
  const color = new Color(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  hsl.h += (rng() - 0.5) * hueVar;
  hsl.s = Math.max(0, Math.min(1, hsl.s + (rng() - 0.5) * satVar));
  hsl.l = Math.max(0, Math.min(1, hsl.l + (rng() - 0.5) * lightVar));
  return new Color().setHSL(hsl.h, hsl.s, hsl.l).getHexString();
}

function randomPosition(rng, half) {
  let x = 0;
  let z = 0;
  for (let tries = 0; tries < 50; tries++) {
    x = (rng() * 2 - 1) * (half - 6);
    z = (rng() * 2 - 1) * (half - 6);
    if (x * x + z * z > SPAWN_AVOID_RADIUS * SPAWN_AVOID_RADIUS) break;
  }
  return { x, z };
}

function round(value) {
  return Number(value.toFixed(4));
}

function generateTreeSpawns() {
  const rng = createRng(seed);
  const half = FIELD_SIZE / 2;
  const trees = [];

  const pineCount = Math.floor(TREE_COUNT * PINE_RATIO);
  for (let i = 0; i < pineCount; i++) {
    const { x, z } = randomPosition(rng, half);
    const scale = 0.7 + rng() * 0.8;
    const height = 3.5 + rng() * 2.5;
    const rotY = rng() * Math.PI * 2;

    trees.push({
      type: "pine",
      x: round(x),
      z: round(z),
      scale: round(scale),
      height: round(height),
      rotY: round(rotY),
      trunkColor: `#${varyColor(rng, TRUNK_COLORS[i % TRUNK_COLORS.length], 0.02, 0.1, 0.15)}`,
      leafColor: `#${varyColor(rng, LEAF_COLORS[i % LEAF_COLORS.length], 0.08, 0.2, 0.12)}`,
    });
  }

  const roundCount = Math.floor(TREE_COUNT * ROUND_RATIO);
  for (let i = 0; i < roundCount; i++) {
    const { x, z } = randomPosition(rng, half);
    const scale = 0.8 + rng() * 0.7;
    const trunkHeight = 1.8 + rng() * 1.5;
    const rotY = rng() * Math.PI * 2;
    const canopyScale = scale * (1.3 + rng() * 0.5);
    const canopyHeight = canopyScale * (0.7 + rng() * 0.3);

    trees.push({
      type: "round",
      x: round(x),
      z: round(z),
      scale: round(scale),
      trunkHeight: round(trunkHeight),
      canopyScale: round(canopyScale),
      canopyHeight: round(canopyHeight),
      rotY: round(rotY),
      trunkColor: `#${varyColor(rng, TRUNK_COLORS[(i + 2) % TRUNK_COLORS.length], 0.02, 0.1, 0.15)}`,
      leafColor: `#${varyColor(rng, LEAF_COLORS[(i + 3) % LEAF_COLORS.length], 0.1, 0.25, 0.15)}`,
    });
  }

  const birchCount = Math.floor(TREE_COUNT * BIRCH_RATIO);
  for (let i = 0; i < birchCount; i++) {
    const { x, z } = randomPosition(rng, half);
    const scale = 0.6 + rng() * 0.5;
    const trunkHeight = 3.5 + rng() * 2.0;
    const rotY = rng() * Math.PI * 2;
    const canopyWidth = scale * (0.8 + rng() * 0.4);
    const canopyHeight = scale * (1.2 + rng() * 0.6);

    trees.push({
      type: "birch",
      x: round(x),
      z: round(z),
      scale: round(scale),
      trunkHeight: round(trunkHeight),
      canopyWidth: round(canopyWidth),
      canopyHeight: round(canopyHeight),
      rotY: round(rotY),
      trunkColor: `#${varyColor(rng, BIRCH_TRUNK_COLORS[i % BIRCH_TRUNK_COLORS.length], 0.02, 0.08, 0.1)}`,
      leafColor: `#${varyColor(rng, BIRCH_LEAF_COLORS[i % BIRCH_LEAF_COLORS.length], 0.08, 0.2, 0.12)}`,
    });
  }

  return {
    fieldSize: FIELD_SIZE,
    treeCount: trees.length,
    trees,
  };
}

async function main() {
  const data = generateTreeSpawns();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${data.treeCount} trees to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
