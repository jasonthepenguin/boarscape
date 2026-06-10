// Shared reactive state between game code and Svelte UI

const ACTION_BAR_DEFAULTS = {
  cooldownRemaining: 0,
  cooldownTotal: 0,
  grenadeCooldownRemaining: 0,
  grenadeCooldownTotal: 0,
  grenadeArmed: false,
  selectedSlot: null,
  selectedNpcId: null,
};

const PLAYER_STATS_DEFAULTS = {
  xp: 0,
  level: 1,
  xpForNextLevel: 1000,
  xpIntoCurrentLevel: 0,
};

export const loading = $state({ text: null });
export const actionBar = $state({ ...ACTION_BAR_DEFAULTS });
export const playerStats = $state({ ...PLAYER_STATS_DEFAULTS });
export const gameMenu = $state({ open: false });

export function resetUiState() {
  loading.text = null;
  Object.assign(actionBar, ACTION_BAR_DEFAULTS);
  Object.assign(playerStats, PLAYER_STATS_DEFAULTS);
  gameMenu.open = false;
}
