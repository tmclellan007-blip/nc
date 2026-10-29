// Mode sombre de l'application : choix mémorisé dans ce navigateur, appliqué avant l'affichage.
(() => {
  const KEY = "lq-theme", root = document.documentElement;
  let dark = false;
  try { dark = localStorage.getItem(KEY) === "dark"; } catch {}
  root.classList.toggle("dark", dark);
  function paint() {
    const b = document.getElementById("themeToggle"); if (!b) return;
    const on = root.classList.contains("dark");
    b.setAttribute("aria-pressed", String(on));
    b.title = on ? "Passer au mode clair" : "Passer au mode sombre";
    const l = b.querySelector(".tt-l"); if (l) l.textContent = on ? "Mode clair" : "Mode sombre";
    const logo = document.querySelector("#homeLogo img");
    if (logo) logo.src = on ? "../assets/logo-sombre.svg" : "../assets/logo-clair.svg";
  }
  function bind() {
    const b = document.getElementById("themeToggle"); if (!b) return;
    b.addEventListener("click", () => {
      const on = !root.classList.contains("dark");
      root.classList.add("theme-switching");
      root.classList.toggle("dark", on);
      try { localStorage.setItem(KEY, on ? "dark" : "light"); } catch {}
      paint();
      setTimeout(() => root.classList.remove("theme-switching"), 400);
    });
    paint();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind); else bind();
})();
