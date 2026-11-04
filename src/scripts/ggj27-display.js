(() => {
  const countdown = document.getElementById("hero-countdown");
  const toggle = document.getElementById("toggle-motion");
  if (!countdown || !toggle) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const start = Date.parse("2027-01-29T17:00:00+09:00");
  let paused = reducedMotion.matches;
  let manuallyPaused = false;

  function updateCountdown() {
    const remaining = Math.max(0, Math.ceil((start - Date.now()) / 1000));
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    countdown.textContent =
      remaining === 0
        ? "開催日時を迎えました！"
        : `開催まで ${days}日 ${hours}時間 ${minutes}分 ${seconds}秒`;
    if (paused) countdown.textContent += "（一時停止中）";
  }

  function applyPreference() {
    document.documentElement.dataset.motionPaused = String(paused);
    toggle.textContent = paused
      ? "動きと自動更新を再開"
      : "動きと自動更新を停止";
    updateCountdown();
  }

  toggle.addEventListener("click", () => {
    paused = !paused;
    manuallyPaused = paused;
    applyPreference();
  });
  reducedMotion.addEventListener("change", () => {
    paused = reducedMotion.matches || manuallyPaused;
    applyPreference();
  });

  applyPreference();
  countdown.hidden = false;
  toggle.hidden = false;
  window.setInterval(() => {
    if (!paused) updateCountdown();
  }, 1000);
})();
