(() => {
  const countdown = document.getElementById("hero-countdown");
  if (!countdown) return;

  const start = Date.parse("2027-01-29T17:00:00+09:00");

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
  }

  updateCountdown();
  countdown.hidden = false;
  window.setInterval(updateCountdown, 1000);
})();
