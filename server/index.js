import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { createNpcs, updateNpcs, serializeNpcs, hitNpc, shouldDespawn, createNpc, killNpc } from "./npcs.js";
import {
  ATTACK_RANGE,
  GRENADE_RANGE,
  GRENADE_FUSE,
  GRENADE_EXPLOSION_RADIUS,
  NPC_RESPAWN_DELAY,
} from "../src/config.js";

const PORT = Number(process.env.PORT) || 3001;
const MAX_PLAYERS = 30;
const TICK_RATE = 20;

// Serve the built client (dist/) from the same process so site + game server
// share one host/port in production. In dev, Vite serves the client instead
// and this just 404s (harmlessly) for anything but the WebSocket upgrade.
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
};

const httpServer = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    let filePath = path.normalize(path.join(distDir, urlPath));
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (urlPath === "/" || urlPath === "") {
      filePath = path.join(distDir, "index.html");
    }

    let data;
    try {
      data = await readFile(filePath);
    } catch {
      // SPA fallback — unknown paths get the app shell
      filePath = path.join(distDir, "index.html");
      data = await readFile(filePath);
    }

    res.writeHead(200, { "Content-Type": MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end();
  }
});

const wss = new WebSocketServer({ server: httpServer, maxPayload: 4096 });
const players = new Map();
const npcs = createNpcs();
let nextId = 1;
let nextNpcIndex = npcs.length;
const respawnQueue = []; // { timer, index }
const pendingGrenades = []; // { timer, x, z, attackerId }

// =============================================================================
// Connection protection
// =============================================================================
const MAX_CONNECTIONS_PER_IP = 4;
const MAX_CONNECTS_PER_WINDOW = 8;
const CONNECT_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_SECOND = 60;
const HEARTBEAT_INTERVAL_MS = 30_000;

const ipConnections = new Map(); // ip -> live connection count
const ipConnectWindows = new Map(); // ip -> { windowStart, count }

// Behind Railway, the rightmost x-forwarded-for entry is the trusted client
// IP. Behind Cloudflare, Railway sees Cloudflare's edge as the client, and the
// real IP arrives in cf-connecting-ip — set TRUST_CF_HEADER=1 when moving to
// Cloudflare. (Don't trust cf-connecting-ip otherwise: clients can forge it.)
function getClientIp(req) {
  if (process.env.TRUST_CF_HEADER === "1" && req.headers["cf-connecting-ip"]) {
    return req.headers["cf-connecting-ip"];
  }
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rejectConnection(ws, reason) {
  ws.send(JSON.stringify({ type: "rejected", reason }));
  ws.close(4000, reason);
}

// Heartbeat: terminate connections that stop answering pings, so dead
// tabs/sleeping laptops free their player slots. Also prune stale
// connect-rate windows while we're at it.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
  const now = Date.now();
  for (const [ip, win] of ipConnectWindows) {
    if (now - win.windowStart > CONNECT_WINDOW_MS) ipConnectWindows.delete(ip);
  }
}, HEARTBEAT_INTERVAL_MS);

wss.on("connection", (ws, req) => {
  let playerId = null;
  const ip = getClientIp(req);

  // Without this, a protocol error (e.g. payload over maxPayload) emits an
  // unhandled 'error' event and crashes the whole process. ws closes the
  // offending connection itself (1009); we just need to not die.
  ws.on("error", (err) => {
    console.log(`Socket error from ${ip}: ${err.message}`);
  });

  // Per-IP concurrent connection cap (e.g. someone opening 30 tabs)
  const liveCount = (ipConnections.get(ip) || 0) + 1;
  if (liveCount > MAX_CONNECTIONS_PER_IP) {
    rejectConnection(ws, "Too many connections from your network");
    return;
  }
  ipConnections.set(ip, liveCount);
  ws.on("close", () => {
    const n = (ipConnections.get(ip) || 1) - 1;
    if (n <= 0) ipConnections.delete(ip);
    else ipConnections.set(ip, n);
  });

  // Per-IP connect rate limit (reconnect spam)
  const now = Date.now();
  const win = ipConnectWindows.get(ip);
  if (!win || now - win.windowStart > CONNECT_WINDOW_MS) {
    ipConnectWindows.set(ip, { windowStart: now, count: 1 });
  } else if (++win.count > MAX_CONNECTS_PER_WINDOW) {
    rejectConnection(ws, "Reconnecting too fast, slow down");
    return;
  }

  // Heartbeat state
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Per-connection message rate limit
  let msgWindowStart = Date.now();
  let msgCount = 0;
  let kicked = false;

  ws.on("message", (raw) => {
    if (kicked) return;
    const nowMs = Date.now();
    if (nowMs - msgWindowStart >= 1000) {
      msgWindowStart = nowMs;
      msgCount = 0;
    }
    if (++msgCount > MAX_MESSAGES_PER_SECOND) {
      kicked = true;
      console.log(`Kicking ${ip} (player ${playerId ?? "?"}): message flood`);
      ws.terminate();
      return;
    }

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
      ws.send(JSON.stringify({ type: "joined", id: playerId, players: others, npcs: serializeNpcs(npcs) }));

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

      // Validate range (client clamps too). Slack accounts for latency between
      // the client firing and the server's last known positions.
      const adx = npc.x - player.x;
      const adz = npc.z - player.z;
      const maxDist = ATTACK_RANGE + 2;
      if (adx * adx + adz * adz > maxDist * maxDist) return;

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

httpServer.listen(PORT, () => {
  console.log(`BoarScape server running on http://localhost:${PORT} (ws on same port)`);
  console.log(`Max players: ${MAX_PLAYERS}, tick rate: ${TICK_RATE}Hz`);
  console.log(`${npcs.length} NPCs spawned`);
});
