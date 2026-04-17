import { NPC_COUNT, NPC_WALK_SPEED, FIELD_SIZE, NPC_MAX_ADDICTION, NPC_DESPAWN_DELAY } from "../src/config.js";

const BOUNDS_HALF = FIELD_SIZE / 2;
const BOUNDS_MARGIN = 4;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function createNpc(index) {
  // Spread NPCs in a ring around spawn
  const angle = (index / NPC_COUNT) * Math.PI * 2;
  const dist = 15 + Math.random() * 20;

  return {
    id: `npc_${index + 1}`,
    name: `Human NPC #${index + 1}`,
    x: Math.cos(angle) * dist,
    y: 0,
    z: Math.sin(angle) * dist,
    ry: Math.random() * Math.PI * 2,
    anim: "idle",
    vx: 0,
    vz: 0,
    state: "idle",
    stateTimer: 0,
    nextChange: 1 + Math.random() * 3,
    addiction: 0,
  };
}

export function createNpcs() {
  const npcs = [];
  for (let i = 0; i < NPC_COUNT; i++) {
    npcs.push(createNpc(i));
  }
  return npcs;
}

export function hitNpc(npc) {
  if (npc.state === "dead") return null;
  npc.addiction++;
  if (npc.addiction >= NPC_MAX_ADDICTION) {
    npc.state = "dead";
    npc.anim = "dead";
    npc.vx = 0;
    npc.vz = 0;
    npc.deathTimer = 0;
    return { hit: true, died: true };
  }
  return { hit: true, died: false };
}

export function shouldDespawn(npc) {
  return npc.state === "dead" && (npc.deathTimer || 0) >= NPC_DESPAWN_DELAY;
}

export function swoopKill(npc) {
  if (npc.state === "dead") return null;
  npc.state = "dead";
  npc.anim = "dead";
  npc.vx = 0;
  npc.vz = 0;
  npc.deathTimer = 0;
  npc.addiction = NPC_MAX_ADDICTION;
  return { killed: true };
}

export function updateNpcs(npcs, dt) {
  const limit = BOUNDS_HALF - BOUNDS_MARGIN;

  for (const npc of npcs) {
    if (npc.state === "dead") {
      npc.deathTimer = (npc.deathTimer || 0) + dt;
      continue;
    }

    npc.stateTimer += dt;

    if (npc.stateTimer >= npc.nextChange) {
      npc.stateTimer = 0;

      if (npc.state === "idle") {
        // Start walking in a random direction
        npc.state = "walk";
        npc.anim = "walk";
        npc.ry = Math.random() * Math.PI * 2;
        npc.vx = Math.sin(npc.ry) * NPC_WALK_SPEED;
        npc.vz = Math.cos(npc.ry) * NPC_WALK_SPEED;
        npc.nextChange = 3 + Math.random() * 3;
      } else {
        // Stop and idle
        npc.state = "idle";
        npc.anim = "idle";
        npc.vx = 0;
        npc.vz = 0;
        npc.nextChange = 2 + Math.random() * 2;
      }
    }

    // Move
    npc.x += npc.vx * dt;
    npc.z += npc.vz * dt;

    // Bounce off world bounds
    if (Math.abs(npc.x) > limit || Math.abs(npc.z) > limit) {
      npc.x = clamp(npc.x, -limit, limit);
      npc.z = clamp(npc.z, -limit, limit);
      npc.ry += Math.PI + (Math.random() - 0.5) * 0.6;
      npc.vx = Math.sin(npc.ry) * NPC_WALK_SPEED;
      npc.vz = Math.cos(npc.ry) * NPC_WALK_SPEED;
    }
  }
}

export function serializeNpcs(npcs) {
  return npcs.map((n) => ({
    id: n.id,
    name: n.name,
    x: n.x,
    y: n.y,
    z: n.z,
    ry: n.ry,
    anim: n.anim,
    addiction: n.addiction,
  }));
}
