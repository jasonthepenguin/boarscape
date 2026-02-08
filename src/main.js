import "./style.css";

import { mount } from "svelte";
import App from "./App.svelte";
import { loading, actionBar } from "./ui/stores.svelte.js";
import { createScene } from "./game/scene.js";
import { createEnvironment } from "./game/environment/index.js";
import { InputManager } from "./game/input.js";
import { loadPlayer } from "./game/player.js";
import { RemotePlayerManager } from "./game/remotePlayers.js";
import { NpcManager } from "./game/npcManager.js";
import { PhoneProjectileManager } from "./game/phoneProjectile.js";
import { ATTACK_COOLDOWN, ATTACK_RANGE } from "./config.js";
import { Raycaster, Vector2, Vector3 } from "three";

const modelUrl = new URL("../boar3.glb", import.meta.url).href;

mount(App, {
  target: document.getElementById("app"),
  props: {
    modelUrl,
    onstart: startGame,
  },
});

function startGame({ name, color, network, existingPlayers, existingNpcs }) {
  const canvas = document.getElementById("game");
  canvas.style.display = "block";

  const { scene, camera, start } = createScene(canvas);

  loading.text = "Loading world...";
  const env = createEnvironment(scene);
  loading.text = null;

  const input = new InputManager(canvas);
  const remotePlayers = new RemotePlayerManager(scene, modelUrl);
  const npcManager = new NpcManager(scene);
  const phoneProjectiles = new PhoneProjectileManager(scene);

  // Raycaster for NPC click selection
  const raycaster = new Raycaster();
  const pointerNdc = new Vector2();
  let attackCooldown = 0;

  // Spawn existing players that were already on the server
  for (const p of existingPlayers) {
    remotePlayers.addPlayer(p.id, p.name, p.color);
  }

  // Spawn NPCs that are already on the server
  for (const n of existingNpcs) {
    npcManager.addNpc(n.id, n.name);
    if (n.addiction > 0) {
      npcManager.setAddiction(n.id, n.addiction);
    }
  }

  // Wire up network events
  network.onPlayerJoined = (msg) => {
    remotePlayers.addPlayer(msg.id, msg.name, msg.color);
  };
  network.onPlayerLeft = (msg) => {
    remotePlayers.removePlayer(msg.id);
  };
  network.onPositions = (states) => {
    const remoteStates = states.filter((s) => s.id !== network.playerId);
    remotePlayers.updatePositions(remoteStates);
  };
  network.onNpcPositions = (states) => {
    npcManager.updatePositions(states);
  };

  // Attack events
  network.onNpcHit = (msg) => {
    npcManager.setAddiction(msg.npcId, msg.addiction);

    // Spawn phone visual for remote players' attacks
    if (msg.attackerId !== network.playerId) {
      const startPos = new Vector3(msg.attackerX, msg.attackerY + 1.2, msg.attackerZ);
      const endPos = npcManager.getNpcWorldPosition(msg.npcId);
      if (endPos) {
        endPos.y += 0.8;
        phoneProjectiles.spawn(startPos, endPos, null);
      }
    }
  };
  network.onNpcDied = (msg) => {
    npcManager.killNpc(msg.npcId);
  };
  network.onNpcRemoved = (msg) => {
    npcManager.removeNpc(msg.npcId);
    if (actionBar.selectedNpcId === msg.npcId) {
      actionBar.selectedNpcId = null;
    }
  };

  // NPC selection via click
  function handleClick(clickEvent) {
    if (!player?.root) return;

    pointerNdc.x = (clickEvent.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(clickEvent.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    const playerPos = player.root.position;
    let bestId = null;
    let bestDist = Infinity;

    for (const [id, npc] of npcManager.npcs) {
      if (npc.dead) continue;
      const npcPos = npc.root.position;
      const distToPlayer = Math.sqrt(
        (npcPos.x - playerPos.x) ** 2 + (npcPos.z - playerPos.z) ** 2
      );
      if (distToPlayer > ATTACK_RANGE) continue;

      const intersects = raycaster.intersectObject(npc.root, true);
      if (intersects.length > 0) {
        const hitDist = intersects[0].distance;
        if (hitDist < bestDist) {
          bestDist = hitDist;
          bestId = id;
        }
      }
    }

    if (bestId) {
      npcManager.selectNpc(bestId);
      actionBar.selectedNpcId = bestId;
    } else {
      npcManager.deselectNpc();
      actionBar.selectedNpcId = null;
    }
  }

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
    npcManager.update(dt);
    phoneProjectiles.update(dt);

    // Attack cooldown
    if (attackCooldown > 0) {
      attackCooldown -= dt;
      if (attackCooldown < 0) attackCooldown = 0;
      actionBar.cooldownRemaining = attackCooldown;
    }

    // Handle click for NPC selection
    const click = input.consumeClick();
    if (click) {
      handleClick(click);
    }

    // Handle F key for attack
    if (input.wasAttackPressed() && npcManager.selectedNpcId && attackCooldown <= 0 && player?.root) {
      const targetPos = npcManager.getNpcWorldPosition(npcManager.selectedNpcId);
      if (targetPos) {
        const playerPos = player.root.position;
        const dist = Math.sqrt(
          (targetPos.x - playerPos.x) ** 2 + (targetPos.z - playerPos.z) ** 2
        );

        if (dist <= ATTACK_RANGE) {
          // Start cooldown
          attackCooldown = ATTACK_COOLDOWN;
          actionBar.cooldownRemaining = ATTACK_COOLDOWN;
          actionBar.cooldownTotal = ATTACK_COOLDOWN;

          // Spawn phone projectile
          const startPos = player.root.position.clone();
          startPos.y += 1.2;
          targetPos.y += 0.8;

          const npcId = npcManager.selectedNpcId;
          phoneProjectiles.spawn(startPos, targetPos, () => {
            network.sendAttack(npcId);
          });
        }
      }
    }

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
