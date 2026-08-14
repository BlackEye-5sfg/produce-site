(() => {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/edit";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    const data = new FormData(form);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.get("username"),
          password: data.get("password"),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorEl.textContent = body.error || "Login failed";
        errorEl.classList.remove("hidden");
        return;
      }
      location.href = next.startsWith("/") ? next : "/edit";
    } catch {
      errorEl.textContent = "Network error";
      errorEl.classList.remove("hidden");
    }
  });
})();
