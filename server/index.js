import { WebSocketServer } from "ws";
import { createNpcs, updateNpcs, serializeNpcs, hitNpc, shouldDespawn, createNpc, killNpc } from "./npcs.js";
import { NET_RANGE, GRENADE_RANGE, GRENADE_FUSE, GRENADE_EXPLOSION_RADIUS } from "../src/config.js";
import { NPC_RESPAWN_DELAY } from "../src/config.js";

const PORT = 3001;
const MAX_PLAYERS = 30;
const TICK_RATE = 20;

const wss = new WebSocketServer({ port: PORT });
const players = new Map();
const npcs = createNpcs();
let nextId = 1;
let nextNpcIndex = npcs.length;
const respawnQueue = []; // { timer, index }
const pendingGrenades = []; // { timer, x, z, attackerId }

wss.on("connection", (ws) => {
  let playerId = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === "join") {
      if (players.size >= MAX_PLAYERS) {
        ws.send(JSON.stringify({ type: "full" }));
        ws.close();
        return;
      }

      playerId = String(nextId++);
      players.set(playerId, {
        id: playerId,
        name: msg.name,
        color: msg.color,
        level: 1,
        netEquipped: false,
        x: 0,
        y: 0,
        z: 0,
        ry: 0,
        anim: "idle",
        ws,
      });

      // Send join confirmation with all existing players
      const others = [];
      for (const [id, p] of players) {
        if (id !== playerId) {
          others.push({
            id: p.id,
            name: p.name,
            color: p.color,
            level: p.level,
            netEquipped: p.netEquipped,
            x: p.x,
            y: p.y,
            z: p.z,
            ry: p.ry,
            anim: p.anim,
          });
        }
      }
      ws.send(JSON.stringify({ type: "joined", id: playerId, players: others, npcs: serializeNpcs(npcs) }));

      // Notify everyone else
      broadcast(
        {
          type: "playerJoined",
          id: playerId,
          name: msg.name,
          color: msg.color,
          level: 1,
          netEquipped: false,
        },
        playerId,
      );

      console.log(
        `Player "${msg.name}" joined (id=${playerId}). ${players.size}/${MAX_PLAYERS} online.`,
      );
    }

    if (msg.type === "state" && playerId) {
      const player = players.get(playerId);
      if (player) {
        player.x = msg.x;
        player.y = msg.y;
        player.z = msg.z;
        player.ry = msg.ry;
        player.anim = msg.anim;
      }
    }

    if (msg.type === "attack" && playerId) {
      const npc = npcs.find(n => n.id === msg.npcId);
      if (!npc) return;

      const player = players.get(playerId);
      if (!player) return;

      const result = hitNpc(npc);
      if (!result) return;

      // Broadcast hit to ALL clients so everyone sees the phone + addiction update
      broadcast({
        type: "npcHit",
        npcId: npc.id,
        addiction: npc.addiction,
        attackerId: playerId,
        attackerX: player.x,
        attackerY: player.y,
        attackerZ: player.z,
      });

      if (result.died) {
        broadcast({
          type: "npcDied",
          npcId: npc.id,
          killerId: playerId,
        });
      }
    }

    if (msg.type === "netEquipped" && playerId) {
      const player = players.get(playerId);
      if (!player) return;
      const equipped = !!msg.equipped;
      if (player.netEquipped === equipped) return;
      player.netEquipped = equipped;
      broadcast({ type: "playerNetEquipped", id: playerId, equipped });
    }

    if (msg.type === "swoop" && playerId) {
      const npc = npcs.find(n => n.id === msg.npcId);
      if (!npc) return;
      const player = players.get(playerId);
      if (!player) return;
      if (!player.netEquipped) return;

      const dx = npc.x - player.x;
      const dz = npc.z - player.z;
      if (dx * dx + dz * dz > NET_RANGE * NET_RANGE) return;

      const result = killNpc(npc);
      if (!result) return;

      broadcast({
        type: "npcSwooped",
        npcId: npc.id,
        attackerId: playerId,
        attackerX: player.x,
        attackerY: player.y,
        attackerZ: player.z,
      });
      broadcast({
        type: "npcDied",
        npcId: npc.id,
        killerId: playerId,
      });

      // Auto-unequip after swoop
      player.netEquipped = false;
      broadcast({ type: "playerNetEquipped", id: playerId, equipped: false });
    }

    if (msg.type === "grenade" && playerId) {
      const npc = npcs.find(n => n.id === msg.npcId);
      if (!npc || npc.state === "dead") return;
      const player = players.get(playerId);
      if (!player) return;

      const dx = npc.x - player.x;
      const dz = npc.z - player.z;
      if (dx * dx + dz * dz > GRENADE_RANGE * GRENADE_RANGE) return;

      const targetX = npc.x;
      const targetZ = npc.z;

      pendingGrenades.push({
        timer: GRENADE_FUSE,
        x: targetX,
        z: targetZ,
        attackerId: playerId,
      });

      broadcast({
        type: "grenadeThrown",
        attackerId: playerId,
        startX: player.x,
        startY: player.y,
        startZ: player.z,
        targetX,
        targetZ,
      });
    }

    if (msg.type === "levelUp" && playerId) {
      const player = players.get(playerId);
      if (!player) return;
      const newLevel = Number(msg.level);
      if (!Number.isFinite(newLevel) || newLevel <= player.level) return;
      player.level = newLevel;
      broadcast({ type: "playerLevelUp", id: playerId, level: newLevel });
    }
  });

  ws.on("close", () => {
    if (playerId) {
      const player = players.get(playerId);
      console.log(
        `Player "${player?.name}" left (id=${playerId}). ${players.size - 1}/${MAX_PLAYERS} online.`,
      );
      players.delete(playerId);
      broadcast({ type: "playerLeft", id: playerId });
    }
  });
});

function broadcast(msg, excludeId = null) {
  const data = JSON.stringify(msg);
  for (const [id, p] of players) {
    if (id !== excludeId && p.ws.readyState === 1) {
      p.ws.send(data);
    }
  }
}

// Tick: update NPCs and broadcast all positions
const tickDt = 1 / TICK_RATE;
setInterval(() => {
  updateNpcs(npcs, tickDt);

  // Check for NPCs that should despawn
  for (let i = npcs.length - 1; i >= 0; i--) {
    if (shouldDespawn(npcs[i])) {
      const removed = npcs[i];
      broadcast({ type: "npcRemoved", npcId: removed.id });
      npcs.splice(i, 1);
      respawnQueue.push({ timer: NPC_RESPAWN_DELAY, name: removed.name, id: removed.id });
      console.log(`NPC "${removed.name}" despawned after death. Respawning in ${NPC_RESPAWN_DELAY}s.`);
    }
  }

  // Process pending grenades — detonate when fuse runs out
  for (let i = pendingGrenades.length - 1; i >= 0; i--) {
    pendingGrenades[i].timer -= tickDt;
    if (pendingGrenades[i].timer > 0) continue;

    const g = pendingGrenades[i];
    pendingGrenades.splice(i, 1);

    const radiusSq = GRENADE_EXPLOSION_RADIUS * GRENADE_EXPLOSION_RADIUS;
    for (const npc of npcs) {
      const dx = npc.x - g.x;
      const dz = npc.z - g.z;
      if (dx * dx + dz * dz > radiusSq) continue;
      if (killNpc(npc)) {
        broadcast({ type: "npcDied", npcId: npc.id, killerId: g.attackerId });
      }
    }
  }

  // Process respawn queue
  for (let i = respawnQueue.length - 1; i >= 0; i--) {
    respawnQueue[i].timer -= tickDt;
    if (respawnQueue[i].timer <= 0) {
      const entry = respawnQueue[i];
      respawnQueue.splice(i, 1);
      const npc = createNpc(nextNpcIndex++);
      npc.id = entry.id;
      npc.name = entry.name;
      npcs.push(npc);
      broadcast({ type: "npcSpawned", npc: { id: npc.id, name: npc.name, x: npc.x, y: npc.y, z: npc.z, ry: npc.ry, anim: npc.anim, addiction: npc.addiction } });
      console.log(`NPC "${npc.name}" spawned. ${npcs.length} NPCs active.`);
    }
  }

  if (players.size === 0) return;

  const playerStates = [];
  for (const [, p] of players) {
    playerStates.push({
      id: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      ry: p.ry,
      anim: p.anim,
    });
  }

  const data = JSON.stringify({
    type: "positions",
    players: playerStates,
    npcs: serializeNpcs(npcs),
  });
  for (const [, p] of players) {
    if (p.ws.readyState === 1) {
      p.ws.send(data);
    }
  }
}, 1000 / TICK_RATE);

console.log(`BoarScape server running on ws://localhost:${PORT}`);
console.log(`Max players: ${MAX_PLAYERS}, tick rate: ${TICK_RATE}Hz`);
console.log(`${npcs.length} NPCs spawned`);
