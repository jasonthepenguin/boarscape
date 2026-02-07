import "./style.css";

import { setupMenu, getGameDOM } from "./game/menu.js";
import { createScene } from "./game/scene.js";
import { createEnvironment } from "./game/environment/index.js";
import { InputManager } from "./game/input.js";
import { loadPlayer } from "./game/player.js";
import { showCharacterEditor } from "./game/characterEditor.js";

const modelUrl = new URL("../boar3.glb", import.meta.url).href;

setupMenu(async (playerName) => {
  // Character editor — pick a color with 3D preview
  const { color } = await showCharacterEditor(modelUrl);

  // Transition to game
  const { canvas, showLoading, hideLoading, showGame } = getGameDOM();
  showGame();

  const { scene, camera, start } = createScene(canvas);

  showLoading("Loading world...");
  const env = createEnvironment(scene);
  hideLoading();

  const input = new InputManager(canvas);

  let player = null;
  showLoading("Loading player...");

  loadPlayer(scene, camera, input, env, {
    modelUrl,
    playerName,
    color,
    onProgress: (pct) => showLoading(`Loading player... ${pct}%`),
  })
    .then((result) => {
      player = result;
      hideLoading();
    })
    .catch((err) => {
      console.error(err);
      showLoading("Failed to load player model. Check console.");
    });

  start((dt) => {
    env.update(dt);
    if (player?.controller) player.controller.update(dt);
    if (player?.mixer) player.mixer.update(dt);
  });
});
