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
