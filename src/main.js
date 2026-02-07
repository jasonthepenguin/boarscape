import "./style.css";

import { setupMenu } from "./game/menu.js";
import { createScene } from "./game/scene.js";
import { createEnvironment } from "./game/environment/index.js";
import { InputManager } from "./game/input.js";
import { loadPlayer } from "./game/player.js";

setupMenu((playerName, { canvas, showLoading, hideLoading }) => {
  const { scene, camera, start } = createScene(canvas);

  showLoading("Loading world...");
  const env = createEnvironment(scene);
  hideLoading();

  const input = new InputManager(canvas);

  let player = null;
  showLoading("Loading player...");

  const modelUrl = new URL("../boar3.glb", import.meta.url).href;

  loadPlayer(scene, camera, input, env, {
    modelUrl,
    playerName,
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
