import { makeGrassTexture } from "./textures.js";
import { createGround } from "./ground.js";
import { createTrees } from "./trees.js";
import { createHills } from "./hills.js";
import treeSpawns from "../../data/treeSpawns.json";
import {
  FIELD_SIZE,
  TREE_COUNT,
  GROUND_Y,
} from "../../config.js";

export function createEnvironment(scene, { fieldSize = FIELD_SIZE, treeCount = TREE_COUNT } = {}) {
  const half = fieldSize / 2;
  const grassTexture = makeGrassTexture();
  createGround(scene, grassTexture, fieldSize);
  createHills(scene, fieldSize);

  const treeDefinitions = treeSpawns.trees.slice(0, treeCount);
  const { colliders } = createTrees(scene, treeDefinitions);

  return {
    boundsHalfSize: half,
    groundY: GROUND_Y,
    treeColliders: colliders,
  };
}
