import "./style.css";

import { mount } from "svelte";
import App from "./App.svelte";
import { loading } from "./ui/stores.svelte.js";
import { createScene } from "./game/scene.js";
import { createEnvironment } from "./game/environment/index.js";
import { InputManager } from "./game/input.js";
import { loadPlayer } from "./game/player.js";

const modelUrl = new URL("../boar3.glb", import.meta.url).href;

mount(App, {
  target: document.getElementById("app"),
  props: {
    modelUrl,
    onstart: startGame,
  },
});

function startGame({ name, color }) {
  const canvas = document.getElementById("game");
  canvas.style.display = "block";

  const { scene, camera, start } = createScene(canvas);

  loading.text = "Loading world...";
  const env = createEnvironment(scene);
  loading.text = null;

  const input = new InputManager(canvas);

  let player = null;
  loading.text = "Loading player...";

  loadPlayer(scene, camera, input, env, {
    modelUrl,
    playerName: name,
    color,
    onProgress: (pct) => {
      loading.text = `Loading player... ${pct}%`;
    },
  })
    .then((result) => {
      player = result;
      loading.text = null;
    })
    .catch((err) => {
      console.error(err);
      loading.text = "Failed to load player model. Check console.";
    });

  start((dt) => {
    env.update(dt);
    if (player?.controller) player.controller.update(dt);
    if (player?.mixer) player.mixer.update(dt);
  });
}
