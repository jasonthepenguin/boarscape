<script>
  import { loading } from "./stores.svelte.js";
</script>

<div class="hud">
  {#if loading.text}
    <div class="panel loading">{loading.text}</div>
  {/if}

  <div class="game-title">BoarScape</div>

  <div class="bars-container">
    <div class="stat-bar health-bar">
      <div class="bar-icon">&#9829;</div>
      <div class="bar-track">
        <div class="bar-fill health-fill" style:width="100%"></div>
        <div class="bar-text">100 / 100</div>
      </div>
    </div>
    <div class="stat-bar xp-bar">
      <div class="bar-icon">&#9733;</div>
      <div class="bar-track">
        <div class="bar-fill xp-fill" style:width="35%"></div>
        <div class="bar-text">350 / 1000 XP</div>
      </div>
    </div>
  </div>

  <div class="panel help">
    <div class="title">Controls</div>
    <div><span class="key">WASD</span> Move</div>
    <div><span class="key">Shift</span> Run</div>
    <div><span class="key">Space</span> Jump</div>
    <div><span class="key">Mouse drag</span> Rotate camera</div>
    <div><span class="key">Wheel</span> Zoom</div>
  </div>
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .game-title {
    position: absolute;
    top: 16px;
    left: 20px;
    font-family: "MedievalSharp", cursive;
    font-size: 42px;
    color: var(--rs-gold);
    text-shadow:
      2px 2px 0 var(--rs-brown),
      3px 3px 0 var(--rs-border),
      4px 4px 8px rgba(0, 0, 0, 0.8),
      0 0 20px rgba(255, 215, 0, 0.3);
    letter-spacing: 2px;
    user-select: none;
  }

  .bars-container {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 320px;
  }

  .stat-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bar-icon {
    width: 28px;
    height: 28px;
    background: linear-gradient(
      180deg,
      var(--rs-brown-light) 0%,
      var(--rs-brown) 100%
    );
    border: 2px solid var(--rs-border);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 2px 4px rgba(0, 0, 0, 0.5);
  }

  .health-bar .bar-icon {
    color: var(--rs-health);
    text-shadow: 0 0 6px var(--rs-health);
  }

  .xp-bar .bar-icon {
    color: var(--rs-gold);
    text-shadow: 0 0 6px var(--rs-gold);
  }

  .bar-track {
    flex: 1;
    height: 24px;
    background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
    border: 2px solid var(--rs-border);
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.8),
      0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .bar-fill {
    position: absolute;
    top: 2px;
    left: 2px;
    bottom: 2px;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .health-fill {
    background: linear-gradient(
      180deg,
      #e53935 0%,
      var(--rs-health) 50%,
      var(--rs-health-dark) 100%
    );
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 8px rgba(196, 30, 58, 0.5);
  }

  .xp-fill {
    background: linear-gradient(
      180deg,
      #4caf50 0%,
      var(--rs-xp) 50%,
      var(--rs-xp-dark) 100%
    );
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.3),
      0 0 8px rgba(0, 179, 89, 0.5);
  }

  .bar-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "MedievalSharp", cursive;
    font-size: 12px;
    color: #fff;
    text-shadow:
      1px 1px 0 #000,
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      0 0 4px rgba(0, 0, 0, 0.8);
    letter-spacing: 1px;
  }

  .panel {
    pointer-events: none;
    position: absolute;
    padding: 10px 14px;
    border-radius: 6px;
    background: linear-gradient(
      180deg,
      var(--rs-brown-light) 0%,
      var(--rs-brown) 100%
    );
    border: 2px solid var(--rs-border);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 4px 8px rgba(0, 0, 0, 0.5);
    color: var(--rs-gold);
    font-family: "MedievalSharp", cursive;
    font-size: 13px;
    line-height: 1.6;
  }

  .loading {
    left: 16px;
    top: 80px;
  }

  .help {
    right: 16px;
    bottom: 80px;
    max-width: 220px;
  }

  .title {
    font-weight: 400;
    font-size: 16px;
    margin-bottom: 8px;
    letter-spacing: 1px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    border-bottom: 1px solid var(--rs-gold-dark);
    padding-bottom: 6px;
  }

  .key {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: linear-gradient(180deg, #2a1a08 0%, #1a0f00 100%);
    border: 1px solid var(--rs-gold-dark);
    font-weight: 400;
    color: #fff;
    font-size: 11px;
    margin-right: 4px;
  }
</style>
