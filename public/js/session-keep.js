(() => {
  const PING_MS = 60 * 1000;
  let lastPing = 0;
  let queued = false;

  async function ping() {
    const now = Date.now();
    if (now - lastPing < PING_MS) {
      if (!queued) {
        queued = true;
        setTimeout(() => {
          queued = false;
          ping();
        }, PING_MS - (now - lastPing));
      }
      return;
    }
    lastPing = now;
    try {
      await fetch("/api/me", { credentials: "same-origin" });
    } catch {
      /* ignore */
    }
  }

  function onActivity() {
    if (document.hidden) return;
    ping();
  }

  ["pointerdown", "keydown", "scroll", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, onActivity, { passive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ping();
  });

  ping();
})();
