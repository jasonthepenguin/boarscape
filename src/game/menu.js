export function setupMenu(onNameReady) {
  const menuEl = document.querySelector("#menu");
  const nameInput = document.querySelector("#name-input");
  const playBtn = document.querySelector("#play-btn");

  function submit() {
    const name = nameInput.value.trim() || "Player";
    menuEl.style.display = "none";
    onNameReady(name);
  }

  playBtn.addEventListener("click", submit);

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}

export function getGameDOM() {
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

  function showGame() {
    canvas.style.display = "block";
    hudEl.style.display = "block";
  }

  return { canvas, showLoading, hideLoading, showGame };
}
