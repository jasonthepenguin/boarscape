import { createRng } from "./rng.js";
import { makeGrassTexture } from "./textures.js";
import { createGround } from "./ground.js";
import { createTrees } from "./trees.js";
import {
  FIELD_SIZE,
  TREE_COUNT,
  GROUND_Y,
  RNG_SEED,
} from "../../config.js";

export function createEnvironment(scene, { fieldSize = FIELD_SIZE, treeCount = TREE_COUNT } = {}) {
  const rng = createRng(RNG_SEED);
  const half = fieldSize / 2;

  // RNG call order must be preserved for deterministic generation:
  const grassTexture = makeGrassTexture(rng);
  createGround(scene, grassTexture, fieldSize);

  const { colliders } = createTrees(scene, rng, fieldSize, treeCount);

  return {
    boundsHalfSize: half,
    groundY: GROUND_Y,
    treeColliders: colliders,
  };
}
