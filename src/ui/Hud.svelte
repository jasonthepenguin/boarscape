<script>
  import { loading, actionBar, playerStats, planeUi } from "./stores.svelte.js";
  import EscMenu from "./EscMenu.svelte";

  let { onresume, onleave } = $props();

  let cooldownPct = $derived(
    actionBar.cooldownTotal > 0
      ? (actionBar.cooldownRemaining / actionBar.cooldownTotal) * 100
      : 0
  );
  let grenadeCooldownPct = $derived(
    actionBar.grenadeCooldownTotal > 0
      ? (actionBar.grenadeCooldownRemaining / actionBar.grenadeCooldownTotal) * 100
      : 0
  );
  let canAttack = $derived(actionBar.cooldownRemaining <= 0 && actionBar.selectedNpcId !== null);
  let canGrenade = $derived(actionBar.grenadeCooldownRemaining <= 0 && actionBar.selectedNpcId !== null);
  let xpPct = $derived(
    playerStats.xpForNextLevel > 0
      ? (playerStats.xpIntoCurrentLevel / playerStats.xpForNextLevel) * 100
      : 0
  );
</script>

<div class="hud">
  <EscMenu {onresume} {onleave} />

  {#if loading.text}
    <div class="panel loading">{loading.text}</div>
  {/if}

  <div class="title-row">
    <div class="game-title">BoarScape</div>
    <div class="level-badge">{playerStats.level}</div>
  </div>

  {#if planeUi.promptVisible && !planeUi.inPlane}
    <div class="plane-prompt"><span class="key">E</span> Enter plane</div>
  {/if}

  {#if planeUi.inPlane}
    <div class="plane-prompt"><span class="key">E</span> Exit &nbsp;·&nbsp; <span class="key">W</span>/<span class="key">S</span> throttle &nbsp;·&nbsp; <span class="mouse-hint">Mouse</span> aim &nbsp;·&nbsp; <span class="mouse-hint">RMB</span> fire</div>
    <div class="plane-crosshair"></div>
  {/if}

  {#if !planeUi.inPlane}
  <div class="action-bar">
    <div class="action-slot active" class:ready={canAttack} class:selected={actionBar.selectedSlot === 1}>
      <div class="slot-key">1</div>
      <div class="slot-icon">📱</div>
      {#if cooldownPct > 0}
        <div class="cooldown-overlay" style:height="{cooldownPct}%"></div>
      {/if}
    </div>
    <div class="action-slot active" class:ready={canGrenade} class:selected={actionBar.selectedSlot === 2} class:armed={actionBar.grenadeArmed}>
      <div class="slot-key">2</div>
      <div class="slot-icon">💣</div>
      {#if grenadeCooldownPct > 0}
        <div class="cooldown-overlay" style:height="{grenadeCooldownPct}%"></div>
      {/if}
    </div>
    {#each Array(3) as _, i}
      <div class="action-slot locked">
        <div class="slot-key">{i + 3}</div>
      </div>
    {/each}
  </div>
  {/if}

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
        <div class="bar-fill xp-fill" style:width="{xpPct}%"></div>
        <div class="bar-text">{playerStats.xpIntoCurrentLevel} / {playerStats.xpForNextLevel} XP</div>
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
    <div><span class="key">Click</span> Select NPC</div>
    <div><span class="key">1</span> Throw phone (target needed)</div>
    <div><span class="key">2</span> then click — grenade</div>
    <div><span class="key">Esc</span> Game menu</div>
  </div>
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  }

  .title-row {
    position: absolute;
    top: 16px;
    left: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .game-title {
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

  .level-badge {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(180deg, var(--rs-brown-light) 0%, var(--rs-brown) 100%);
    border: 2px solid var(--rs-gold);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: "MedievalSharp", cursive;
    font-size: 20px;
    color: var(--rs-gold);
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.15),
      0 2px 6px rgba(0, 0, 0, 0.6),
      0 0 10px rgba(255, 215, 0, 0.2);
    user-select: none;
  }

  /* ===== Action Bar ===== */
  .action-bar {
    position: absolute;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
  }

  .action-slot {
    width: 48px;
    height: 48px;
    background: linear-gradient(180deg, var(--rs-brown-light) 0%, var(--rs-brown) 100%);
    border: 2px solid var(--rs-border);
    border-radius: 6px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .action-slot.active {
    border-color: var(--rs-gold-dark);
  }

  .action-slot.active.ready {
    border-color: var(--rs-gold);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.5),
      0 0 8px rgba(255, 215, 0, 0.3);
  }

  .action-slot.active.selected {
    border-color: #ffb877;
    background: linear-gradient(180deg, #5a3010 0%, #321a05 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 2px 4px rgba(0, 0, 0, 0.5),
      0 0 12px rgba(255, 140, 58, 0.6);
  }

  .action-slot.active.armed {
    animation: armedPulse 1.2s ease-in-out infinite;
  }

  @keyframes armedPulse {
    0%, 100% { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 4px rgba(0, 0, 0, 0.5), 0 0 10px rgba(255, 140, 58, 0.5); }
    50%      { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 2px 4px rgba(0, 0, 0, 0.5), 0 0 22px rgba(255, 140, 58, 1.0); }
  }

  .action-slot.locked {
    opacity: 0.4;
  }

  .slot-key {
    position: absolute;
    top: 2px;
    right: 4px;
    font-family: "MedievalSharp", cursive;
    font-size: 10px;
    color: var(--rs-gold);
    text-shadow: 1px 1px 0 #000;
  }

  .slot-icon {
    font-size: 22px;
    filter: grayscale(0.2);
  }

  .cooldown-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(0, 0, 0, 0.6);
    pointer-events: none;
  }

  /* ===== Bars ===== */
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

  .plane-crosshair {
    position: fixed;
    top: 50%;
    left: 50%;
    width: 28px;
    height: 28px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    background-image:
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><circle cx='14' cy='14' r='9' fill='none' stroke='black' stroke-opacity='0.55' stroke-width='3.5'/><circle cx='14' cy='14' r='9' fill='none' stroke='white' stroke-width='1.6'/><circle cx='14' cy='14' r='2' fill='white' stroke='black' stroke-opacity='0.6' stroke-width='0.8'/></svg>");
    background-repeat: no-repeat;
    background-position: center;
  }

  .mouse-hint {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    background: linear-gradient(180deg, #2a1a08 0%, #1a0f00 100%);
    border: 1px solid var(--rs-gold-dark);
    color: #fff;
    font-size: 11px;
    margin-right: 4px;
  }

  .plane-prompt {
    position: absolute;
    bottom: 180px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 18px;
    border-radius: 6px;
    background: linear-gradient(180deg, var(--rs-brown-light) 0%, var(--rs-brown) 100%);
    border: 2px solid var(--rs-gold-dark);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      0 4px 10px rgba(0, 0, 0, 0.6);
    color: var(--rs-gold);
    font-family: "MedievalSharp", cursive;
    font-size: 14px;
    letter-spacing: 1px;
    user-select: none;
    pointer-events: none;
  }
</style>
