import "./style.css";

import { mount } from "svelte";
import App from "./App.svelte";
import { loading } from "./ui/stores.svelte.js";
import { createScene } from "./game/scene.js";
import { createEnvironment } from "./game/environment/index.js";
import { InputManager } from "./game/input.js";
import { loadPlayer } from "./game/player.js";
import { RemotePlayerManager } from "./game/remotePlayers.js";

const modelUrl = new URL("../boar3.glb", import.meta.url).href;

mount(App, {
  target: document.getElementById("app"),
  props: {
    modelUrl,
    onstart: startGame,
  },
});

function startGame({ name, color, network, existingPlayers }) {
  const canvas = document.getElementById("game");
  canvas.style.display = "block";

  const { scene, camera, start } = createScene(canvas);

  loading.text = "Loading world...";
  const env = createEnvironment(scene);
  loading.text = null;

  const input = new InputManager(canvas);
  const remotePlayers = new RemotePlayerManager(scene, modelUrl);

  // Spawn existing players that were already on the server
  for (const p of existingPlayers) {
    remotePlayers.addPlayer(p.id, p.name, p.color);
  }

  // Wire up network events
  network.onPlayerJoined = (msg) => {
    remotePlayers.addPlayer(msg.id, msg.name, msg.color);
  };
  network.onPlayerLeft = (msg) => {
    remotePlayers.removePlayer(msg.id);
  };
  network.onPositions = (states) => {
    // Only update remote players, not ourselves
    const remoteStates = states.filter((s) => s.id !== network.playerId);
    remotePlayers.updatePositions(remoteStates);
  };

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

  // Send local player state to server at ~20Hz
  let sendTimer = 0;

  start((dt) => {
    if (player?.controller) player.controller.update(dt);
    if (player?.mixer) player.mixer.update(dt);
    remotePlayers.update(dt);

    // Send position to server
    if (player?.root) {
      sendTimer += dt;
      if (sendTimer >= 0.05) {
        sendTimer = 0;
        const pos = player.root.position;
        const ry = player.root.rotation.y;
        let anim = "idle";
        if (!player.controller.onGround) anim = "jump";
        else if (player.controller._isMoving) anim = "walk";
        network.sendState(pos.x, pos.y, pos.z, ry, anim);
      }
    }
  });
}
