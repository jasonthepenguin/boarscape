import "./style.css";

import { mount } from "svelte";
import App from "./App.svelte";
import { loading, actionBar, playerStats, gameMenu, resetUiState } from "./ui/stores.svelte.js";
import { createScene } from "./game/scene.js";
import { createEnvironment } from "./game/environment/index.js";
import { InputManager } from "./game/input.js";
import { loadPlayer, createLevelUpAura, updateNametag } from "./game/player.js";
import { RemotePlayerManager } from "./game/remotePlayers.js";
import { NpcManager } from "./game/npcManager.js";
import { PhoneProjectileManager } from "./game/phoneProjectile.js";
import { GrenadeManager, GrenadeAimer } from "./game/grenadeProjectile.js";
import { ATTACK_COOLDOWN, ATTACK_RANGE, GRENADE_COOLDOWN, GRENADE_RANGE, XP_PER_KILL, XP_BASE_THRESHOLD, XP_THRESHOLD_INCREMENT } from "./config.js";
import { DoubleSide, Mesh, MeshBasicMaterial, Plane, Raycaster, TorusGeometry, Vector2, Vector3 } from "three";

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

  const { scene, camera, start, stop } = createScene(canvas);
  let destroyed = false;

  loading.text = "Loading world...";
  const env = createEnvironment(scene);
  loading.text = null;

  const input = new InputManager(canvas);
  const remotePlayers = new RemotePlayerManager(scene, modelUrl);
  const npcManager = new NpcManager(scene);
  const phoneProjectiles = new PhoneProjectileManager(scene);
  const grenadeManager = new GrenadeManager(scene);
  const grenadeAimer = new GrenadeAimer(scene);

  // Raycaster for NPC click selection + grenade ground targeting
  const raycaster = new Raycaster();
  const pointerNdc = new Vector2();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const groundHit = new Vector3();
  let attackCooldown = 0;
  let grenadeCooldown = 0;
  let levelUpAura = null;
  let wasMenuOpen = false;

  // Range indicator ring shown around the player while a grenade is armed
  const grenadeRangeRing = new Mesh(
    new TorusGeometry(GRENADE_RANGE, 0.06, 8, 64),
    new MeshBasicMaterial({ color: 0xff8c3a, transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }),
  );
  grenadeRangeRing.rotation.x = -Math.PI / 2;
  grenadeRangeRing.position.y = 0.05;

  function setGrenadeArmed(armed) {
    if (actionBar.grenadeArmed === armed) return;
    actionBar.grenadeArmed = armed;
    if (armed && player?.root) {
      player.root.add(grenadeRangeRing);
      canvas.classList.add("aiming");
      grenadeAimer.show();
    } else {
      grenadeRangeRing.parent?.remove(grenadeRangeRing);
      canvas.classList.remove("aiming");
      grenadeAimer.hide();
    }
  }

  // Resolve current mouse position to a clamped throw target on the ground
  // plane. Returns null if no plane intersection (e.g. camera looking up).
  const aimerTarget = new Vector3();
  function resolveAimTarget() {
    if (!player?.root) return null;
    const ptr = input.getPointerPosition();
    pointerNdc.x = (ptr.x / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(ptr.y / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    const hit = raycaster.ray.intersectPlane(groundPlane, aimerTarget);
    if (!hit) return null;

    const playerPos = player.root.position;
    const dx = hit.x - playerPos.x;
    const dz = hit.z - playerPos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > GRENADE_RANGE * GRENADE_RANGE) {
      const scale = GRENADE_RANGE / Math.sqrt(distSq);
      hit.x = playerPos.x + dx * scale;
      hit.z = playerPos.z + dz * scale;
    }
    return hit;
  }

  // XP / leveling helpers
  function cumulativeXpForLevel(level) {
    // Level 1 = 0 XP, level 2 = 1000, level 3 = 2100, etc.
    if (level <= 1) return 0;
    const n = level - 1;
    return n * XP_BASE_THRESHOLD + (n * (n - 1) / 2) * XP_THRESHOLD_INCREMENT;
  }

  function addXp(amount) {
    const oldLevel = playerStats.level;
    playerStats.xp += amount;

    // Recalculate level
    let lvl = oldLevel;
    while (playerStats.xp >= cumulativeXpForLevel(lvl + 1)) {
      lvl++;
    }
    playerStats.level = lvl;

    // Update bar progress
    const xpAtCurrentLevel = cumulativeXpForLevel(lvl);
    const xpAtNextLevel = cumulativeXpForLevel(lvl + 1);
    playerStats.xpIntoCurrentLevel = playerStats.xp - xpAtCurrentLevel;
    playerStats.xpForNextLevel = xpAtNextLevel - xpAtCurrentLevel;

    // Level up glow + nametag + network broadcast
    if (lvl > oldLevel) {
      if (player?.root) levelUpAura = createLevelUpAura(player.root);
      if (player?.nametag) updateNametag(player.nametag, player.name, lvl);
      network.sendLevelUp(lvl);
    }
  }

  function getPlayerYaw() {
    if (!player?.root) return 0;
    const q = player.root.quaternion;
    return Math.atan2(
      2 * (q.x * q.z + q.w * q.y),
      q.w * q.w - q.x * q.x - q.y * q.y + q.z * q.z
    );
  }

  function sendIdleState() {
    if (!player?.root) return;
    const pos = player.root.position;
    network.sendState(pos.x, pos.y, pos.z, getPlayerYaw(), "idle");
  }

  function pauseLocalPlayer() {
    if (!player?.controller) return;
    player.controller.velocity.x = 0;
    player.controller.velocity.z = 0;
    if (player.controller._isMoving) {
      player.controller._isMoving = false;
      player.stopAnimation?.("walk");
    }
    sendIdleState();
  }

  // Spawn existing players that were already on the server
  for (const p of existingPlayers) {
    remotePlayers.addPlayer(p.id, p.name, p.color, p.level ?? 1);
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
    remotePlayers.addPlayer(msg.id, msg.name, msg.color, msg.level ?? 1);
  };
  network.onPlayerLeft = (msg) => {
    remotePlayers.removePlayer(msg.id);
  };
  network.onPlayerLevelUp = (msg) => {
    remotePlayers.setLevel(msg.id, msg.level);
  };
  network.onGrenadeThrown = (msg) => {
    // Attacker already spawned locally on press. Observers spawn here.
    if (msg.attackerId === network.playerId) return;
    const startPos = new Vector3(msg.startX, msg.startY + 1.2, msg.startZ);
    const targetPos = new Vector3(msg.targetX, 0, msg.targetZ);
    grenadeManager.throwAt(startPos, targetPos);
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
    if (msg.killerId === network.playerId) {
      addXp(XP_PER_KILL);
    }
  };
  network.onNpcRemoved = (msg) => {
    npcManager.removeNpc(msg.npcId);
    if (actionBar.selectedNpcId === msg.npcId) {
      actionBar.selectedNpcId = null;
    }
  };
  network.onNpcSpawned = (msg) => {
    npcManager.addNpc(msg.npc.id, msg.npc.name);
  };

  function setRayFromClick(clickEvent) {
    pointerNdc.x = (clickEvent.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(clickEvent.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
  }

  // NPC selection via click
  function handleNpcSelectClick(clickEvent) {
    if (!player?.root) return;
    setRayFromClick(clickEvent);

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

  // Grenade throw via click — uses the same aim resolver as the preview
  function handleGrenadeThrowClick(clickEvent) {
    if (!player?.root) return false;
    // Update pointer position from the click in case mouse hasn't moved since
    setRayFromClick(clickEvent);
    const hit = raycaster.ray.intersectPlane(groundPlane, groundHit);
    if (!hit) return false;

    const playerPos = player.root.position;
    let targetX = hit.x;
    let targetZ = hit.z;
    const dx = targetX - playerPos.x;
    const dz = targetZ - playerPos.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > GRENADE_RANGE * GRENADE_RANGE) {
      const scale = GRENADE_RANGE / Math.sqrt(distSq);
      targetX = playerPos.x + dx * scale;
      targetZ = playerPos.z + dz * scale;
    }

    grenadeCooldown = GRENADE_COOLDOWN;
    actionBar.grenadeCooldownRemaining = GRENADE_COOLDOWN;
    actionBar.grenadeCooldownTotal = GRENADE_COOLDOWN;

    const startPos = playerPos.clone();
    startPos.y += 1.2;
    const landPos = new Vector3(targetX, 0, targetZ);
    grenadeManager.throwAt(startPos, landPos);
    network.sendGrenade(targetX, targetZ);

    setGrenadeArmed(false);
    return true;
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
      if (destroyed) {
        result.root.removeFromParent();
        return;
      }
      player = result;
      loading.text = null;
    })
    .catch((err) => {
      if (destroyed) return;
      console.error(err);
      loading.text = "Failed to load player model. Check console.";
    });

  // Send local player state to server at ~20Hz
  let sendTimer = 0;

  start((dt) => {
    if (destroyed) return;

    if (gameMenu.open && !wasMenuOpen) {
      pauseLocalPlayer();
      setGrenadeArmed(false);
    }
    wasMenuOpen = gameMenu.open;

    if (gameMenu.open) {
      input.clearTransientInputs();
    }

    if (!gameMenu.open && player?.controller) player.controller.update(dt);
    if (player?.mixer) player.mixer.update(dt);
    remotePlayers.update(dt);
    npcManager.update(dt);
    phoneProjectiles.update(dt);
    grenadeManager.update(dt);
    if (actionBar.grenadeArmed && player?.root) {
      const aim = resolveAimTarget();
      if (aim) {
        const playerPos = player.root.position;
        grenadeAimer.update(dt, playerPos.x, playerPos.y + 1.2, playerPos.z, aim.x, aim.z);
      }
    }
    if (levelUpAura && !levelUpAura.done) levelUpAura.update(dt);

    // Attack cooldown
    if (attackCooldown > 0) {
      attackCooldown -= dt;
      if (attackCooldown < 0) attackCooldown = 0;
      actionBar.cooldownRemaining = attackCooldown;
    }

    // Grenade cooldown
    if (grenadeCooldown > 0) {
      grenadeCooldown -= dt;
      if (grenadeCooldown < 0) grenadeCooldown = 0;
      actionBar.grenadeCooldownRemaining = grenadeCooldown;
    }

    // Handle click — armed grenade throws to ground point, otherwise NPC select
    const click = input.consumeClick();
    if (!gameMenu.open && click) {
      if (actionBar.grenadeArmed) {
        handleGrenadeThrowClick(click);
      } else {
        handleNpcSelectClick(click);
      }
    }

    // Handle F key for attack
    if (!gameMenu.open && input.wasAttackPressed() && npcManager.selectedNpcId && attackCooldown <= 0 && player?.root) {
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

    // Handle 2 key for grenade — toggles armed; click then chooses landing point
    if (!gameMenu.open && input.wasGrenadePressed() && player?.root) {
      if (actionBar.grenadeArmed) {
        setGrenadeArmed(false);
      } else if (grenadeCooldown <= 0) {
        setGrenadeArmed(true);
      }
    }

    // Send position to server
    if (!gameMenu.open && player?.root) {
      sendTimer += dt;
      if (sendTimer >= 0.05) {
        sendTimer = 0;
        const pos = player.root.position;
        const ry = getPlayerYaw();
        let anim = "idle";
        if (!player.controller.onGround) anim = "jump";
        else if (player.controller._isMoving) anim = "walk";
        network.sendState(pos.x, pos.y, pos.z, ry, anim);
      }
    }
  });

  function disposeSceneGraph() {
    scene.traverse((obj) => {
      if (obj.geometry?.dispose) obj.geometry.dispose();

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value?.isTexture && value.dispose) value.dispose();
        }
        material.dispose?.();
      }
    });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    network.disconnect();
    input.dispose();
    gameMenu.open = false;
    canvas.classList.remove("dragging");
    canvas.style.display = "none";
    stop();
    disposeSceneGraph();
    resetUiState();
  }

  return { destroy };
}
