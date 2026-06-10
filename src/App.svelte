<script>
  import Menu from "./ui/Menu.svelte";
  import CharacterEditor from "./ui/CharacterEditor.svelte";
  import ServerSelect from "./ui/ServerSelect.svelte";
  import Hud from "./ui/Hud.svelte";
  import { gameMenu } from "./ui/stores.svelte.js";

  let { modelUrl, onstart } = $props();

  let screen = $state("menu");
  let playerName = $state("Player");
  let playerColor = $state(null);
  let gameSession = $state(null);

  function handleNameSubmit(name) {
    playerName = name;
    screen = "editor";
  }

  function handleColorSelected({ color }) {
    playerColor = color;
    screen = "serverSelect";
  }

  function handleServerJoined({ network, existingPlayers, existingNpcs }) {
    screen = "game";
    gameMenu.open = false;
    gameSession = onstart({ name: playerName, color: playerColor, network, existingPlayers, existingNpcs });
  }

  function handleResumeGame() {
    gameMenu.open = false;
  }

  function handleLeaveServer() {
    gameMenu.open = false;
    gameSession?.destroy?.();
    gameSession = null;
    screen = "serverSelect";
  }

  function handleWindowKeydown(event) {
    if (screen !== "game" || event.key !== "Escape") return;
    event.preventDefault();
    gameMenu.open = !gameMenu.open;
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if screen === "menu"}
  <Menu onsubmit={handleNameSubmit} />
{/if}

{#if screen === "editor"}
  <CharacterEditor {modelUrl} onplay={handleColorSelected} />
{/if}

{#if screen === "serverSelect"}
  <ServerSelect
    name={playerName}
    color={playerColor}
    onjoin={handleServerJoined}
    onback={() => (screen = "editor")}
  />
{/if}

{#if screen === "game"}
  <Hud onresume={handleResumeGame} onleave={handleLeaveServer} />
{/if}
