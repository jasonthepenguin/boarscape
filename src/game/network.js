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
    this.onNpcSwooped = null;
    this.onPlayerNetEquipped = null;
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
        } else if (msg.type === "npcSwooped") {
          this.onNpcSwooped?.(msg);
        } else if (msg.type === "playerNetEquipped") {
          this.onPlayerNetEquipped?.(msg);
        } else if (msg.type === "grenadeThrown") {
          this.onGrenadeThrown?.(msg);
        }
      };

      this.ws.onerror = () => reject(new Error("Could not connect to server"));
      this.ws.onclose = () => {};
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

  sendSwoop(npcId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "swoop", npcId }));
    }
  }

  sendNetEquipped(equipped) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "netEquipped", equipped }));
    }
  }

  sendGrenade(npcId) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "grenade", npcId }));
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
    this.onNpcSwooped = null;
    this.onPlayerNetEquipped = null;
    this.onGrenadeThrown = null;
  }
}
