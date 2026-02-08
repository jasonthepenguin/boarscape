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
let _selectedNpcId = $state(null);

export const actionBar = {
  get cooldownRemaining() { return _cooldownRemaining; },
  set cooldownRemaining(v) { _cooldownRemaining = v; },
  get cooldownTotal() { return _cooldownTotal; },
  set cooldownTotal(v) { _cooldownTotal = v; },
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
