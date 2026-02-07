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
    game/
      network.js          ← client WebSocket manager
      remotePlayers.js    ← clones boar models for other players, interpolates positions
      ...                 ← existing game code
    ui/
      ServerSelect.svelte ← server selection screen (after character editor)
      ...
  server/
    index.js              ← Node.js WebSocket server (handles join/leave, relays state)
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
| Server → Client | `joined` | `{ id, players[] }` — confirmation + existing players |
| Server → Client | `playerJoined` | `{ id, name, color }` — new player notification |
| Server → Client | `playerLeft` | `{ id }` — player disconnected |
| Server → Client | `positions` | `{ players[] }` — all player states at 20Hz |
| Server → Client | `full` | Server is at capacity (30) |

## Game Flow

Menu (enter name) → Character Editor (pick color) → **Server Select** (join server) → Game

## Scripts

```
npm run dev      # Vite client dev server
npm run server   # Node.js game server (ws://localhost:3001)
npm run build    # production client build
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

## Future Improvements

- [ ] Server-authoritative physics (server runs movement/collision, client sends inputs)
- [ ] Shared physics module (`shared/physics.js`) for both client and server
- [ ] Client-side prediction with server reconciliation
- [ ] Server-side bounds/collision validation
- [ ] Chat system
- [ ] Player count shown on server select screen
