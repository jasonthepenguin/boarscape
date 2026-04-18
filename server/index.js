import { WebSocketServer } from "ws";
import { createNpcs, updateNpcs, serializeNpcs, hitNpc, shouldDespawn, createNpc, killNpc, damageNpc } from "./npcs.js";
import {
  GRENADE_RANGE,
  GRENADE_FUSE,
  GRENADE_EXPLOSION_RADIUS,
  PLANE_SPAWN_X,
  PLANE_SPAWN_Y,
  PLANE_SPAWN_Z,
  PLANE_AUTOPILOT_DURATION,
  PLANE_MIN_Y,
  BULLET_DAMAGE,
  BULLET_GROUND_EXPLOSION_RADIUS,
  BULLET_GROUND_EXPLOSION_DAMAGE,
  FIELD_SIZE,
} from "../src/config.js";
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

// Plane: single shared instance
const plane = {
  x: PLANE_SPAWN_X, y: PLANE_SPAWN_Y, z: PLANE_SPAWN_Z,
  rx: 0, ry: 0, rz: 0,
  vx: 0, vy: 0, vz: 0,
  pilotId: null,
  autopilotTimer: 0,
};

function planeStateForBroadcast() {
  return {
    x: plane.x, y: plane.y, z: plane.z,
    rx: plane.rx, ry: plane.ry, rz: plane.rz,
    pilotId: plane.pilotId,
  };
}

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
            x: p.x,
            y: p.y,
            z: p.z,
            ry: p.ry,
            anim: p.anim,
          });
        }
      }
      ws.send(JSON.stringify({ type: "joined", id: playerId, players: others, npcs: serializeNpcs(npcs), plane: planeStateForBroadcast() }));

      // Notify everyone else
      broadcast(
        {
          type: "playerJoined",
          id: playerId,
          name: msg.name,
          color: msg.color,
          level: 1,
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

    if (msg.type === "grenade" && playerId) {
      const player = players.get(playerId);
      if (!player) return;

      const targetX = Number(msg.x);
      const targetZ = Number(msg.z);
      if (!Number.isFinite(targetX) || !Number.isFinite(targetZ)) return;

      // Validate range; reject anything beyond GRENADE_RANGE (client clamps too)
      const dx = targetX - player.x;
      const dz = targetZ - player.z;
      if (dx * dx + dz * dz > GRENADE_RANGE * GRENADE_RANGE + 0.01) return;

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

    if (msg.type === "bulletHit" && playerId) {
      // Only the current pilot can claim bullet hits
      if (plane.pilotId !== playerId) return;
      const npc = npcs.find(n => n.id === msg.npcId);
      if (!npc || npc.state === "dead") return;

      const result = damageNpc(npc, BULLET_DAMAGE);
      if (!result) return;

      broadcast({
        type: "npcDamaged",
        npcId: npc.id,
        hp: npc.hp,
        attackerId: playerId,
      });

      if (result.died) {
        broadcast({
          type: "npcDied",
          npcId: npc.id,
          killerId: playerId,
        });
      }
    }

    if (msg.type === "bulletGroundHit" && playerId) {
      // Only the pilot can spawn ground explosions (their bullets only).
      if (plane.pilotId !== playerId) return;
      const x = Number(msg.x);
      const z = Number(msg.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      // Reject anything outside the playfield (paranoia/cheat guard).
      const half = FIELD_SIZE / 2;
      if (Math.abs(x) > half || Math.abs(z) > half) return;

      const radiusSq = BULLET_GROUND_EXPLOSION_RADIUS * BULLET_GROUND_EXPLOSION_RADIUS;
      for (const npc of npcs) {
        if (npc.state === "dead") continue;
        const dx = npc.x - x;
        const dz = npc.z - z;
        if (dx * dx + dz * dz > radiusSq) continue;

        const result = damageNpc(npc, BULLET_GROUND_EXPLOSION_DAMAGE);
        if (!result) continue;

        broadcast({
          type: "npcDamaged",
          npcId: npc.id,
          hp: npc.hp,
          attackerId: playerId,
        });

        if (result.died) {
          broadcast({
            type: "npcDied",
            npcId: npc.id,
            killerId: playerId,
          });
        }
      }

      // Tell every other client to render the boom (pilot already rendered it locally).
      broadcast({
        type: "bulletExplosion",
        x,
        z,
        attackerId: playerId,
      });
    }

    if (msg.type === "enterPlane" && playerId) {
      if (plane.pilotId && plane.pilotId !== playerId) return;
      plane.pilotId = playerId;
      plane.autopilotTimer = 0;
      broadcast({ type: "planePilot", pilotId: playerId });
    }

    if (msg.type === "exitPlane" && playerId) {
      if (plane.pilotId !== playerId) return;
      plane.pilotId = null;
      plane.vx = Number(msg.vx) || 0;
      plane.vy = Number(msg.vy) || 0;
      plane.vz = Number(msg.vz) || 0;
      plane.autopilotTimer = PLANE_AUTOPILOT_DURATION;
      broadcast({ type: "planePilot", pilotId: null });
    }

    if (msg.type === "planeState" && playerId) {
      if (plane.pilotId !== playerId) return;
      if (!Number.isFinite(msg.x) || !Number.isFinite(msg.y) || !Number.isFinite(msg.z)) return;
      plane.x = msg.x; plane.y = msg.y; plane.z = msg.z;
      plane.rx = msg.rx; plane.ry = msg.ry; plane.rz = msg.rz;
      plane.vx = Number(msg.vx) || 0;
      plane.vy = Number(msg.vy) || 0;
      plane.vz = Number(msg.vz) || 0;
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

      // If they were piloting the plane, kick off autopilot mode
      if (plane.pilotId === playerId) {
        plane.pilotId = null;
        plane.autopilotTimer = PLANE_AUTOPILOT_DURATION;
        broadcast({ type: "planePilot", pilotId: null });
      }
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
      console.log(`NPC ${removed.id} despawned after death. Respawning in ${NPC_RESPAWN_DELAY}s.`);
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
      console.log(`NPC ${npc.id} spawned. ${npcs.length} NPCs active.`);
    }
  }

  // Plane autopilot — coast for a few seconds after pilot exits, then respawn
  if (!plane.pilotId && plane.autopilotTimer > 0) {
    plane.x += plane.vx * tickDt;
    plane.y += plane.vy * tickDt;
    plane.z += plane.vz * tickDt;
    plane.autopilotTimer -= tickDt;

    if (plane.autopilotTimer <= 0 || plane.y < PLANE_MIN_Y) {
      plane.x = PLANE_SPAWN_X;
      plane.y = PLANE_SPAWN_Y;
      plane.z = PLANE_SPAWN_Z;
      plane.rx = 0; plane.ry = 0; plane.rz = 0;
      plane.vx = 0; plane.vy = 0; plane.vz = 0;
      plane.autopilotTimer = 0;
      broadcast({ type: "planeRespawned", plane: planeStateForBroadcast() });
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
    plane: planeStateForBroadcast(),
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
