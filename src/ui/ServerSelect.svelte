<script>
  import { NetworkManager } from "../game/network.js";

  let { name, color, onjoin } = $props();

  let status = $state("idle");
  let errorMsg = $state("");

  const SERVER_URL = "ws://localhost:3001";

  async function joinServer() {
    status = "connecting";
    errorMsg = "";

    const network = new NetworkManager(SERVER_URL);
    try {
      const result = await network.connect(name, color);
      onjoin({ network, existingPlayers: result.players, existingNpcs: result.npcs || [], existingPlane: result.plane || null });
    } catch (err) {
      status = "error";
      errorMsg = err.message;
    }
  }
</script>

<div class="select">
  <div class="select-title">Select Server</div>
  <div class="select-box">
    <div class="server-entry">
      <div class="server-info">
        <div class="server-name">BoarScape World 1</div>
        <div class="server-status">localhost:3001</div>
      </div>
      <button
        class="join-btn"
        onclick={joinServer}
        disabled={status === "connecting"}
      >
        {status === "connecting" ? "Connecting..." : "Join"}
      </button>
    </div>
    {#if status === "error"}
      <div class="error">{errorMsg}</div>
    {/if}
    <button class="back-btn" onclick={() => history.back?.() || location.reload()}>
      Back
    </button>
  </div>
</div>

<style>
  .select {
    position: fixed;
    inset: 0;
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: url("/dungeon-wall.svg") center / cover no-repeat #0b1220;
    z-index: 100;
  }

  .select-title {
    font-family: "MedievalSharp", cursive;
    font-size: 42px;
    color: var(--rs-gold);
    text-shadow:
      2px 2px 0 var(--rs-brown),
      3px 3px 0 var(--rs-border),
      4px 4px 12px rgba(0, 0, 0, 0.9),
      0 0 20px rgba(255, 215, 0, 0.3);
    letter-spacing: 2px;
    margin-bottom: 24px;
    user-select: none;
  }

  .select-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 24px 32px;
    border-radius: 8px;
    background: linear-gradient(
      180deg,
      var(--rs-brown-light) 0%,
      var(--rs-brown) 100%
    );
    border: 2px solid var(--rs-border);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 8px 24px rgba(0, 0, 0, 0.6);
    min-width: 320px;
  }

  .server-entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 16px;
    border-radius: 6px;
    background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
    border: 2px solid var(--rs-border);
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.8);
  }

  .server-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .server-name {
    font-family: "MedievalSharp", cursive;
    font-size: 18px;
    color: var(--rs-gold);
    letter-spacing: 1px;
  }

  .server-status {
    font-size: 12px;
    color: #888;
  }

  .join-btn {
    padding: 8px 24px;
    border-radius: 4px;
    border: 2px solid var(--rs-border);
    background: linear-gradient(180deg, #4a8c2a 0%, #2d6b1a 50%, #1a4a0e 100%);
    color: #fff;
    font-family: "MedievalSharp", cursive;
    font-size: 16px;
    letter-spacing: 1px;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 4px 8px rgba(0, 0, 0, 0.5);
    transition: filter 0.15s;
  }

  .join-btn:hover:not(:disabled) {
    filter: brightness(1.2);
  }

  .join-btn:active:not(:disabled) {
    filter: brightness(0.9);
  }

  .join-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .back-btn {
    padding: 6px 20px;
    border-radius: 4px;
    border: 2px solid var(--rs-border);
    background: linear-gradient(
      180deg,
      var(--rs-brown-light) 0%,
      var(--rs-brown) 100%
    );
    color: var(--rs-gold);
    font-family: "MedievalSharp", cursive;
    font-size: 14px;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.5);
    transition: filter 0.15s;
  }

  .back-btn:hover {
    filter: brightness(1.2);
  }

  .error {
    color: var(--rs-health);
    font-family: "MedievalSharp", cursive;
    font-size: 14px;
    text-shadow: 0 0 4px rgba(196, 30, 58, 0.4);
  }
</style>
