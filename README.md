# Boarscape

Multiplayer 3D third-person game built with Three.js, Svelte 5, and WebSockets. Play as a boar in a procedurally generated world with up to 30 players.

## Run

```bash
npm install
npm run server   # Start WebSocket server (port 3001)
npm run dev      # Start Vite dev server (port 5173)
npm run generate:trees  # Regenerate src/data/treeSpawns.json
```

Run both commands in separate terminals, then open `http://localhost:5173`.

## Controls

- **WASD**: move
- **Shift**: run
- **Space**: jump
- **Mouse drag**: rotate camera
- **Mouse wheel**: zoom
- **Click**: select NPC (or pick a target while a grenade is armed)
- **1**: throw phone at selected NPC (2s cooldown, 3 hits to kill, 8-unit range)
- **2**: arm grenade, then click the ground to throw (8s cooldown, 12-unit range, 1.8s fuse)
- **Esc**: open pause menu (resume / leave server)

## Features

- Third-person camera with 12 boar color presets
- Multiplayer via WebSocket relay server (20Hz tick rate)
- 16 server-managed humanoid NPCs ("Kids") with idle/walk AI
- Phone throw attack with parabolic arc projectile
- Grenade attack with arced throw, ground targeting, and area-of-effect explosion
- NPC addiction system, death animation, 15s despawn, and 10s respawn
- XP and leveling: 500 XP per kill, rising thresholds, level-up glow synced across clients
- HUD with level badge, health bar, XP bar, and 5-slot action bar (phone + grenade)
- Procedural environment: ~250 trees (3 types), grass texture, seeded RNG
- Medieval-themed UI: name entry, character editor, server select, in-game HUD, Esc pause menu
