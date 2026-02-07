<script>
  import Menu from "./ui/Menu.svelte";
  import CharacterEditor from "./ui/CharacterEditor.svelte";
  import Hud from "./ui/Hud.svelte";

  let { modelUrl, onstart } = $props();

  let screen = $state("menu");
  let playerName = $state("Player");

  function handleNameSubmit(name) {
    playerName = name;
    screen = "editor";
  }

  function handleColorSelected({ color }) {
    screen = "game";
    onstart({ name: playerName, color });
  }
</script>

{#if screen === "menu"}
  <Menu onsubmit={handleNameSubmit} />
{/if}

{#if screen === "editor"}
  <CharacterEditor {modelUrl} onplay={handleColorSelected} />
{/if}

{#if screen === "game"}
  <Hud />
{/if}
