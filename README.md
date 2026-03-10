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
- **Click**: select NPC
- **F**: throw phone at selected NPC (2s cooldown, 3 hits to kill)

## Features

- Third-person camera with 12 boar color presets
- Multiplayer via WebSocket relay server (20Hz tick rate)
- 8 server-managed NPCs with walking AI
- Phone throw attack with parabolic arc projectile
- NPC addiction system, death animation, and 15s despawn
- Procedural environment: 500 trees (3 types), grass texture, seeded RNG
- Medieval-themed UI: name entry, character editor, server select, in-game HUD
