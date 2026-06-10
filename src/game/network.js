export class NetworkManager {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.playerId = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onPositions = null;
    this.onNpcPositions = null;
    this.onNpcHit = null;
    this.onNpcDied = null;
    this.onNpcRemoved = null;
    this.onNpcSpawned = null;
    this.onPlayerLevelUp = null;
    this.onGrenadeThrown = null;
  }

  connect(name, color) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ type: "join", name, color }));
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "joined") {
          this.playerId = msg.id;
          resolve(msg);
        } else if (msg.type === "full") {
          reject(new Error("Server is full"));
        } else if (msg.type === "rejected") {
          reject(new Error(msg.reason || "Connection rejected"));
        } else if (msg.type === "playerJoined") {
          this.onPlayerJoined?.(msg);
        } else if (msg.type === "playerLeft") {
          this.onPlayerLeft?.(msg);
        } else if (msg.type === "positions") {
          this.onPositions?.(msg.players);
          if (msg.npcs) this.onNpcPositions?.(msg.npcs);
        } else if (msg.type === "npcHit") {
          this.onNpcHit?.(msg);
        } else if (msg.type === "npcDied") {
          this.onNpcDied?.(msg);
        } else if (msg.type === "npcRemoved") {
          this.onNpcRemoved?.(msg);
        } else if (msg.type === "npcSpawned") {
          this.onNpcSpawned?.(msg);
        } else if (msg.type === "playerLevelUp") {
          this.onPlayerLevelUp?.(msg);
        } else if (msg.type === "grenadeThrown") {
          this.onGrenadeThrown?.(msg);
        }
      };

      this.ws.onerror = () => reject(new Error("Could not connect to server"));
      // No-op if connect already resolved/rejected; otherwise the server
      // closed on us before "joined" (e.g. kicked) and we must settle.
      this.ws.onclose = () => reject(new Error("Connection closed by server"));
    });
  }

  sendState(x, y, z, ry, anim) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "state", x, y, z, ry, anim }));
    }
  }

  sendAttack(npcId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "attack", npcId }));
    }
  }

  sendLevelUp(level) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "levelUp", level }));
    }
  }

  sendGrenade(x, z) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "grenade", x, z }));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.playerId = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onPositions = null;
    this.onNpcPositions = null;
    this.onNpcHit = null;
    this.onNpcDied = null;
    this.onNpcRemoved = null;
    this.onNpcSpawned = null;
    this.onPlayerLevelUp = null;
    this.onGrenadeThrown = null;
  }
}
