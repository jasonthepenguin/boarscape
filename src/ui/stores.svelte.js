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
