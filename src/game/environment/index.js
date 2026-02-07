import { createRng } from "./rng.js";
import { makeGrassTexture, makeCloudTexture } from "./textures.js";
import { createSky } from "./sky.js";
import { createGround } from "./ground.js";
import { createTrees } from "./trees.js";
import { createClouds } from "./clouds.js";
import {
  FIELD_SIZE,
  TREE_COUNT,
  GROUND_Y,
  RNG_SEED,
  CLOUD_RANGE_FACTOR,
} from "../../config.js";

export function createEnvironment(scene, { fieldSize = FIELD_SIZE, treeCount = TREE_COUNT } = {}) {
  const rng = createRng(RNG_SEED);
  const half = fieldSize / 2;

  createSky(scene);

  // RNG call order must be preserved for deterministic generation:
  // grass texture → trees (pine → round → birch) → cloud texture → clouds
  const grassTexture = makeGrassTexture(rng);
  createGround(scene, grassTexture, fieldSize);

  const { colliders } = createTrees(scene, rng, fieldSize, treeCount);

  const cloudTexture = makeCloudTexture(rng);
  const clouds = createClouds(scene, rng, cloudTexture, half * CLOUD_RANGE_FACTOR);

  return {
    boundsHalfSize: half,
    groundY: GROUND_Y,
    treeColliders: colliders,
    update: clouds.update,
  };
}
