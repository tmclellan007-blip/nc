// Pastille de l'usager connecté (photo ou initiales + nom), en haut à droite.
// Lecture seule : un GET /api/me, aucune modification. Reste masquée sans session.
(() => {
  const chip = document.getElementById("userChip");
  if (!chip) return;
  fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const u = d && d.user;
      if (!u) return;
      const full = [u.first_name, u.last_name].filter(Boolean).join(" ");
      const email = (d.identities || []).find((i) => i.email)?.email || u.contact_email || "";
      const name = full || email || "Mon profil";
      const ini = (((u.first_name || "")[0] || "") + ((u.last_name || "")[0] || "")).toUpperCase() || (email[0] || "?").toUpperCase();
      const av = document.createElement("span");
      av.className = "uchip-av"; av.setAttribute("aria-hidden", "true");
      if (u.photo) {
        const img = document.createElement("img");
        img.src = u.photo; img.alt = ""; img.referrerPolicy = "no-referrer";
        img.onerror = () => { img.remove(); av.textContent = ini; };
        av.append(img);
      } else av.textContent = ini;
      const nm = document.createElement("span");
      nm.className = "uchip-n"; nm.textContent = name;
      chip.textContent = "";
      chip.append(av, nm);
      chip.title = "Connecté : " + name + " — Mon profil";
      chip.setAttribute("aria-label", "Connecté : " + name + ". Ouvrir mon profil");
      chip.hidden = false;
    })
    .catch(() => {});
})();
