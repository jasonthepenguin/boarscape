<script>
  import Menu from "./ui/Menu.svelte";
  import CharacterEditor from "./ui/CharacterEditor.svelte";
  import ServerSelect from "./ui/ServerSelect.svelte";
  import Hud from "./ui/Hud.svelte";

  let { modelUrl, onstart } = $props();

  let screen = $state("menu");
  let playerName = $state("Player");
  let playerColor = $state(null);

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
    onstart({ name: playerName, color: playerColor, network, existingPlayers, existingNpcs });
  }
</script>

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
  />
{/if}

{#if screen === "game"}
  <Hud />
{/if}
