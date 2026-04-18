// Shared reactive state between game code and Svelte UI

let _loadingText = $state(null);

export const loading = {
  get text() {
    return _loadingText;
  },
  set text(v) {
    _loadingText = v;
  },
};

// Action bar state
let _cooldownRemaining = $state(0);
let _cooldownTotal = $state(0);
let _netCooldownRemaining = $state(0);
let _netCooldownTotal = $state(0);
let _netEquipped = $state(false);
let _grenadeCooldownRemaining = $state(0);
let _grenadeCooldownTotal = $state(0);
let _selectedNpcId = $state(null);

export const actionBar = {
  get cooldownRemaining() { return _cooldownRemaining; },
  set cooldownRemaining(v) { _cooldownRemaining = v; },
  get cooldownTotal() { return _cooldownTotal; },
  set cooldownTotal(v) { _cooldownTotal = v; },
  get netCooldownRemaining() { return _netCooldownRemaining; },
  set netCooldownRemaining(v) { _netCooldownRemaining = v; },
  get netCooldownTotal() { return _netCooldownTotal; },
  set netCooldownTotal(v) { _netCooldownTotal = v; },
  get netEquipped() { return _netEquipped; },
  set netEquipped(v) { _netEquipped = v; },
  get grenadeCooldownRemaining() { return _grenadeCooldownRemaining; },
  set grenadeCooldownRemaining(v) { _grenadeCooldownRemaining = v; },
  get grenadeCooldownTotal() { return _grenadeCooldownTotal; },
  set grenadeCooldownTotal(v) { _grenadeCooldownTotal = v; },
  get selectedNpcId() { return _selectedNpcId; },
  set selectedNpcId(v) { _selectedNpcId = v; },
};

// Player stats (XP / leveling)
let _xp = $state(0);
let _level = $state(1);
let _xpForNextLevel = $state(1000);
let _xpIntoCurrentLevel = $state(0);

export const playerStats = {
  get xp() { return _xp; },
  set xp(v) { _xp = v; },
  get level() { return _level; },
  set level(v) { _level = v; },
  get xpForNextLevel() { return _xpForNextLevel; },
  set xpForNextLevel(v) { _xpForNextLevel = v; },
  get xpIntoCurrentLevel() { return _xpIntoCurrentLevel; },
  set xpIntoCurrentLevel(v) { _xpIntoCurrentLevel = v; },
};

let _gameMenuOpen = $state(false);

export const gameMenu = {
  get open() { return _gameMenuOpen; },
  set open(v) { _gameMenuOpen = v; },
};

export function resetUiState() {
  _loadingText = null;
  _cooldownRemaining = 0;
  _cooldownTotal = 0;
  _netCooldownRemaining = 0;
  _netCooldownTotal = 0;
  _netEquipped = false;
  _grenadeCooldownRemaining = 0;
  _grenadeCooldownTotal = 0;
  _selectedNpcId = null;
  _xp = 0;
  _level = 1;
  _xpForNextLevel = 1000;
  _xpIntoCurrentLevel = 0;
  _gameMenuOpen = false;
}
