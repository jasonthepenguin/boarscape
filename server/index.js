import { WebSocketServer } from "ws";
import { createNpcs, updateNpcs, serializeNpcs } from "./npcs.js";

const PORT = 3001;
const MAX_PLAYERS = 30;
const TICK_RATE = 20;

const wss = new WebSocketServer({ port: PORT });
const players = new Map();
const npcs = createNpcs();
let nextId = 1;

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
