export function setupMenu(onStart) {
  const menuEl = document.querySelector("#menu");
  const nameInput = document.querySelector("#name-input");
  const playBtn = document.querySelector("#play-btn");
  const canvas = document.querySelector("#game");
  const hudEl = document.querySelector("#hud");
  const loadingEl = document.querySelector("#loading");

  function showLoading(text) {
    if (!loadingEl) return;
    loadingEl.textContent = text;
    loadingEl.style.display = "block";
  }

  function hideLoading() {
    if (!loadingEl) return;
    loadingEl.style.display = "none";
  }

  function startGame(playerName) {
    menuEl.style.display = "none";
    canvas.style.display = "block";
    hudEl.style.display = "block";
    onStart(playerName, { canvas, showLoading, hideLoading });
  }

  playBtn.addEventListener("click", () => {
    const name = nameInput.value.trim() || "Player";
    startGame(name);
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const name = nameInput.value.trim() || "Player";
      startGame(name);
    }
  });
}
