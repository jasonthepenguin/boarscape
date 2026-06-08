# Multiplayer Plan

## Architecture

- **Relay server** — client runs physics locally, server broadcasts positions to all players
- **WebSockets** via the `ws` npm package for real-time communication
- **Single server** supporting up to 30 players
- **Same repo** — client and server code live together

## Project Structure

```
boarscape/
  src/
    config.js             ← shared tunables (player count, NPC/grenade/XP constants)
    game/
      network.js          ← client WebSocket manager
      remotePlayers.js    ← clones boar models for other players, interpolates positions
      npcManager.js       ← humanoid NPC rendering, selection ring, death animation
      phoneProjectile.js  ← phone throw projectile with arc flight
      grenadeProjectile.js← grenade throw, aim preview, AOE explosion
      ...                 ← existing game code
    ui/
      ServerSelect.svelte ← server selection screen (after character editor)
      ...
  server/
    index.js              ← Node.js WebSocket server (handles join/leave, relays state)
    npcs.js               ← server-managed NPC AI (idle/walk), hit/kill/respawn logic
  scripts/
    generate-tree-spawns.mjs ← regenerates src/data/treeSpawns.json
  package.json
```

## How It Works

1. **Client runs physics locally** — movement, gravity, collision all happen client-side
2. **Client sends its position** to the server at ~20Hz
3. **Server broadcasts all positions** to every connected client at 20Hz
4. **Remote players are interpolated** — smoothly animated between server ticks

## Data Flow

```
Client  ──►  { type: "state", x, y, z, ry, anim }     ──►  Server
Client  ◄──  { type: "positions", players: [{ id, x, y, z, ry, anim }] }  ◄──  Server
```

### Protocol Messages

| Direction | Type | Description |
|-----------|------|-------------|
| Client → Server | `join` | `{ name, color }` — sent on connect |
| Client → Server | `state` | `{ x, y, z, ry, anim }` — sent at ~20Hz |
| Client → Server | `attack` | `{ npcId }` — phone throw, applies one hit to an NPC |
| Client → Server | `grenade` | `{ x, z }` — throw grenade at a ground point (server validates range) |
| Client → Server | `levelUp` | `{ level }` — notify server the player leveled up |
| Server → Client | `joined` | `{ id, players[], npcs[] }` — confirmation + existing state (players include `level`) |
| Server → Client | `playerJoined` | `{ id, name, color, level }` — new player notification |
| Server → Client | `playerLeft` | `{ id }` — player disconnected |
| Server → Client | `playerLevelUp` | `{ id, level }` — a player leveled up |
| Server → Client | `positions` | `{ players[], npcs[] }` — all states at 20Hz |
| Server → Client | `npcHit` | `{ npcId, addiction, attackerId, attackerX/Y/Z }` — hit notification |
| Server → Client | `npcDied` | `{ npcId, killerId }` — NPC death notification |
| Server → Client | `npcRemoved` | `{ npcId }` — NPC despawned after 15s |
| Server → Client | `npcSpawned` | `{ npc: { id, name, x, y, z, ry, anim, addiction } }` — NPC respawned 10s after despawn |
| Server → Client | `grenadeThrown` | `{ attackerId, startX/Y/Z, targetX, targetZ }` — render grenade arc; detonates after fuse and kills NPCs in radius |
| Server → Client | `full` | Server is at capacity (30) |

## Game Flow

Menu (enter name) → Character Editor (pick color) → **Server Select** (join server) → Game

## Scripts

```
npm run dev             # Vite client dev server
npm run server          # Node.js game server (ws://localhost:3001)
npm run build           # production client build
npm run generate:trees  # regenerate src/data/treeSpawns.json
```

Run both `dev` and `server` in separate terminals during development.

## Deployment

- **Client** (static files): Vercel, Netlify, GitHub Pages, etc.
- **Server** (Node.js process): small VPS (DigitalOcean, Fly.io, etc.)

## Done

- [x] Install `ws` package
- [x] Create `server/index.js` — WebSocket server, handle connect/disconnect, relay positions
- [x] Create `src/game/network.js` — client WebSocket connection manager
- [x] Create `src/game/remotePlayers.js` — clone boar models, nametags, interpolation
- [x] Create `src/ui/ServerSelect.svelte` — server selection UI
- [x] Update `App.svelte` — add server select screen to flow
- [x] Update `main.js` — integrate networking, send local state, render remote players
- [x] Add interpolation for remote players
- [x] Create `server/npcs.js` — server-managed NPCs with AI (idle/walk state machine)
- [x] Create `src/game/npcManager.js` — humanoid NPC ("Kid") rendering, selection ring, death animation
- [x] Create `src/game/phoneProjectile.js` — phone throw projectile with arc flight
- [x] Create `src/game/grenadeProjectile.js` — grenade arc throw, aim preview, AOE explosion
- [x] Add phone attack system (key 1, 2s cooldown, 3-hit kill, 8-unit range)
- [x] Add grenade attack (key 2 to arm, click to throw; 8s cooldown, 12-unit range, 1.8s fuse, server-side AOE kill)
- [x] Add NPC selection via click raycasting (golden torus indicator)
- [x] Add NPC addiction bar visualization (green→orange→red)
- [x] Add NPC death animation (burn + evaporate) and 15s despawn
- [x] Sync attacks, grenades, NPC state, and death across all clients
- [x] NPC respawn 10s after despawn (`npcSpawned` broadcast)
- [x] XP / leveling system (500 XP per kill, rising thresholds, level-up glow, synced via `levelUp`/`playerLevelUp`)
- [x] HUD level badge + health bar + XP bar + 5-slot action bar (phone + grenade)
- [x] Esc pause menu (resume / leave server)

## Future Improvements

- [ ] Server-authoritative physics (server runs movement/collision, client sends inputs)
- [ ] Shared physics module (`shared/physics.js`) for both client and server
- [ ] Client-side prediction with server reconciliation
- [ ] Server-side bounds/collision validation
- [ ] Chat system
- [ ] Player count shown on server select screen
