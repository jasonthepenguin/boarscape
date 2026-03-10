<script>
  import { gameMenu } from "./stores.svelte.js";

  let { onresume, onleave } = $props();
</script>

{#if gameMenu.open}
  <div
    class="esc-backdrop"
    role="button"
    tabindex="0"
    aria-label="Close game menu"
    onclick={onresume}
    onkeydown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onresume();
      }
    }}
  >
    <div
      class="esc-window"
      role="dialog"
      aria-modal="true"
      aria-label="Game menu"
      tabindex="-1"
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      <div class="esc-title-row">
        <div class="esc-title">Game Options</div>
        <div class="esc-title-trim"></div>
      </div>

      <div class="esc-copy">
        Your boar will stay where you left it. Choose an option below.
      </div>

      <div class="esc-actions">
        <button class="esc-btn primary" onclick={onresume}>Resume</button>
        <button class="esc-btn danger" onclick={onleave}>Leave Server</button>
      </div>

      <div class="esc-hint">Press <span>Esc</span> to close this menu.</div>
    </div>
  </div>
{/if}

<style>
  .esc-backdrop {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at center, rgba(29, 18, 7, 0.15) 0%, rgba(5, 4, 3, 0.68) 70%),
      rgba(0, 0, 0, 0.38);
    pointer-events: auto;
  }

  .esc-window {
    width: min(90vw, 420px);
    padding: 14px;
    border: 3px solid #211306;
    border-radius: 3px;
    background:
      linear-gradient(180deg, rgba(98, 68, 37, 0.96) 0%, rgba(61, 41, 20, 0.98) 100%);
    box-shadow:
      inset 0 0 0 2px rgba(170, 126, 63, 0.55),
      inset 0 1px 0 rgba(255, 244, 209, 0.18),
      0 18px 36px rgba(0, 0, 0, 0.55);
    color: #f1db9a;
    font-family: "Times New Roman", serif;
    pointer-events: auto;
  }

  .esc-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .esc-title {
    font-family: "MedievalSharp", cursive;
    font-size: 28px;
    color: var(--rs-gold);
    text-shadow:
      1px 1px 0 #000,
      0 0 10px rgba(255, 215, 0, 0.18);
    white-space: nowrap;
  }

  .esc-title-trim {
    flex: 1;
    height: 8px;
    border: 1px solid rgba(32, 17, 6, 0.9);
    background:
      linear-gradient(180deg, rgba(205, 170, 109, 0.9) 0%, rgba(118, 77, 33, 0.85) 100%);
    box-shadow: inset 0 1px 0 rgba(255, 244, 214, 0.35);
  }

  .esc-copy {
    padding: 12px;
    margin-bottom: 12px;
    border: 2px solid rgba(31, 18, 8, 0.95);
    background: rgba(15, 10, 5, 0.36);
    color: #f7e7bd;
    line-height: 1.5;
    font-size: 16px;
    text-align: center;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .esc-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .esc-btn {
    padding: 10px 14px;
    border: 2px solid #211306;
    border-radius: 2px;
    font-family: "MedievalSharp", cursive;
    font-size: 18px;
    letter-spacing: 0.5px;
    cursor: pointer;
    color: #fff4cf;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      inset 0 -1px 0 rgba(0, 0, 0, 0.35);
    transition:
      filter 0.15s ease,
      transform 0.15s ease;
  }

  .esc-btn:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }

  .esc-btn:active {
    transform: translateY(0);
    filter: brightness(0.92);
  }

  .esc-btn.primary {
    background:
      linear-gradient(180deg, #5f8f38 0%, #3d6a21 55%, #294514 100%);
  }

  .esc-btn.danger {
    background:
      linear-gradient(180deg, #8b3f2b 0%, #6c2819 55%, #4c170d 100%);
  }

  .esc-hint {
    margin-top: 12px;
    text-align: center;
    font-size: 14px;
    color: #d9c18b;
  }

  .esc-hint span {
    display: inline-block;
    min-width: 28px;
    padding: 1px 6px;
    margin-left: 4px;
    border: 1px solid rgba(33, 19, 6, 0.95);
    background: rgba(17, 11, 6, 0.55);
    color: #fff2c6;
  }
</style>
