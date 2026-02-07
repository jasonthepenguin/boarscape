<script>
  import { onMount } from "svelte";

  let { onsubmit } = $props();

  let name = $state("");
  let inputEl;

  function submit() {
    onsubmit(name.trim() || "Player");
  }

  onMount(() => {
    inputEl?.focus();
  });
</script>

<div class="menu">
  <div class="menu-title">BoarScape</div>
  <div class="menu-box">
    <label class="menu-label" for="name-input">Enter your name</label>
    <input
      bind:this={inputEl}
      id="name-input"
      type="text"
      maxlength="16"
      placeholder="Player"
      autocomplete="off"
      bind:value={name}
      onkeydown={(e) => e.key === "Enter" && submit()}
    />
    <button class="play-btn" onclick={submit}>Play</button>
  </div>
</div>

<style>
  .menu {
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

  .menu-title {
    font-family: "MedievalSharp", cursive;
    font-size: 72px;
    color: var(--rs-gold);
    text-shadow:
      2px 2px 0 var(--rs-brown),
      3px 3px 0 var(--rs-border),
      4px 4px 12px rgba(0, 0, 0, 0.9),
      0 0 30px rgba(255, 215, 0, 0.35);
    letter-spacing: 3px;
    margin-bottom: 40px;
    user-select: none;
  }

  .menu-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 28px 36px;
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
  }

  .menu-label {
    font-family: "MedievalSharp", cursive;
    font-size: 18px;
    color: var(--rs-gold);
    letter-spacing: 1px;
  }

  #name-input {
    width: 220px;
    padding: 8px 12px;
    border-radius: 4px;
    border: 2px solid var(--rs-border);
    background: linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%);
    color: #fff;
    font-family: "MedievalSharp", cursive;
    font-size: 16px;
    text-align: center;
    outline: none;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.8);
  }

  #name-input:focus {
    border-color: var(--rs-gold-dark);
  }

  .play-btn {
    margin-top: 4px;
    padding: 10px 40px;
    border-radius: 4px;
    border: 2px solid var(--rs-border);
    background: linear-gradient(180deg, #4a8c2a 0%, #2d6b1a 50%, #1a4a0e 100%);
    color: #fff;
    font-family: "MedievalSharp", cursive;
    font-size: 20px;
    letter-spacing: 2px;
    cursor: pointer;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 4px 8px rgba(0, 0, 0, 0.5);
    transition: filter 0.15s;
  }

  .play-btn:hover {
    filter: brightness(1.2);
  }

  .play-btn:active {
    filter: brightness(0.9);
  }
</style>
