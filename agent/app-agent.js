// Assistant La Qualia — interface (version site Web, sans dépendance à Claude.ai)
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  const SCENARIOS = [
    "un client en colère au sujet d'une facture", "un propriétaire inquiet dont le chien vomit depuis ce matin",
    "un client qui veut annuler une chirurgie le matin même", "un client en deuil qui appelle pour l'incinération",
    "un client qui demande une dose de médicament", "un nouveau client qui veut un rendez-vous rapidement",
    "un appel où l'animal a peut-être avalé un toxique", "un client qui conteste un dépôt pour chirurgie",
    "un technicien qui te demande de rappeler un client pour des résultats", "un client pressé qui veut parler au vétérinaire tout de suite",
    "un client qui trouve les prix trop élevés", "un client âgé qui a du mal à comprendre les consignes préopératoires",
  ];

  let cfg = { name: "Assistant La Qualia", examples: [] };
  let turns = [];
  let ctl = null;
  let code = store.get("lq-agent-code") || "";
  let shown = new Set();
  try { shown = new Set(JSON.parse(store.get("lq-shown") || "[]")); } catch {}

  /* ---------- config ---------- */
  function applyCfg() {
    $("agentName").textContent = cfg.name || "Assistant La Qualia";
    $("agentTag").textContent = cfg.tag || "";
    $("disclaimerText").textContent = cfg.disclaimer || "";
    $("disclaimer").hidden = !cfg.disclaimer;
    if (cfg.name) document.title = cfg.name;
    fillChips($("examples"), pickExamples(4));
  }

  function pool() { return (Array.isArray(cfg.examples) ? cfg.examples : String(cfg.examples || "").split("\n")).map((s) => String(s).trim()).filter(Boolean); }
  function pickExamples(n) {
    const all = pool();
    let fresh = all.filter((t) => !shown.has(t));
    if (fresh.length < n) { shown = new Set(); fresh = all.slice(); }
    for (let i = fresh.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fresh[i], fresh[j]] = [fresh[j], fresh[i]]; }
    const out = fresh.slice(0, n);
    out.forEach((t) => shown.add(t));
    store.set("lq-shown", JSON.stringify([...shown]));
    return out;
  }
  function fillChips(el, list) {
    el.textContent = "";
    list.forEach((t) => {
      const b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = t;
      b.onclick = () => { $("q").value = t; ask(); };
      el.append(b);
    });
  }
  function startScenario() {
    const sc = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    $("q").value = `Mets-moi en situation : je suis à la réception et je reçois un appel de ${sc}.`;
    ask();
  }

  /* ---------- markdown ---------- */
  function md(src) {
    const lines = esc(src).split("\n"); const out = []; let list = null;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>").replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, "$1<em>$2</em>").replace(/`([^`]+)`/g, "<code>$1</code>");
    const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
    for (const l of lines) {
      let m;
      if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); out.push(`<h3>${inline(m[1])}</h3>`); }
      else if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); out.push("<ol>"); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); }
      else if (!l.trim()) close();
      else { close(); out.push(`<p>${inline(l)}</p>`); }
    }
    close();
    return out.join("");
  }

  /* ---------- chat ---------- */
  function addMsg(kind, text) {
    $("empty").hidden = true;
    const m = document.createElement("div"); m.className = "msg " + kind;
    const who = document.createElement("div"); who.className = "who"; who.textContent = kind === "q" ? "Vous" : (cfg.name || "Assistant");
    const body = document.createElement("div"); body.className = "body";
    if (kind === "q") body.textContent = text; else body.innerHTML = '<span class="thinking">Consultation de la documentation…</span>';
    m.append(who, body); $("thread").append(m);
    m.scrollIntoView({ block: "end", behavior: "smooth" });
    return m;
  }

  async function ask() {
    const q = $("q").value.trim();
    if (!q || ctl) return;
    $("q").value = ""; autosize();
    addMsg("q", q);
    const m = addMsg("a"); const body = m.querySelector(".body");
    ctl = new AbortController();
    $("send").hidden = true; $("stop").hidden = false;
    let text = "";
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json", "x-agent-code": code },
        body: JSON.stringify({ question: q, history: turns.slice(-8) }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        let msg = "La réponse a échoué. Réessayez.";
        try { msg = (await res.json()).error || msg; } catch {}
        if (res.status === 401) { m.previousElementSibling?.remove(); m.remove(); if (!$("thread").querySelector(".msg")) $("empty").hidden = false; $("q").value = q; askCode(true); return; }
        body.innerHTML = `<p class="err">${esc(msg)}</p>`;
        return;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        body.innerHTML = md(text);
      }
      if (!text.trim()) { body.innerHTML = '<p class="err">Aucune réponse reçue. Réessayez.</p>'; return; }
      turns.push({ role: "user", content: q }, { role: "assistant", content: text });
      let sources = [];
      try { sources = JSON.parse(decodeURIComponent(res.headers.get("x-agent-sources") || "[]")); } catch {}
      const cited = sources.filter((t) => text.includes(t));
      if (cited.length) {
        const s = document.createElement("div"); s.className = "srcs"; s.textContent = "Sources : ";
        cited.forEach((t) => { const c = document.createElement("span"); c.className = "src"; c.textContent = t; s.append(c); });
        m.append(s);
      }
      document.querySelectorAll(".next").forEach((n) => n.remove());
      const nx = document.createElement("div"); nx.className = "next";
      const lab = document.createElement("div"); lab.className = "who"; lab.textContent = "Pour continuer à vous former";
      const ch = document.createElement("div"); ch.className = "chips"; fillChips(ch, pickExamples(3));
      const tb = document.createElement("button"); tb.className = "chip train"; tb.type = "button"; tb.textContent = "Nouvelle mise en situation"; tb.onclick = startScenario; ch.append(tb);
      nx.append(lab, ch); m.after(nx);
    } catch (e) {
      if (e.name === "AbortError") { if (text) turns.push({ role: "user", content: q }, { role: "assistant", content: text }); if (!text) body.textContent = "Réponse arrêtée."; }
      else body.innerHTML = (text ? md(text) : "") + '<p class="err">La connexion a été interrompue. Vérifiez Internet et réessayez.</p>';
    } finally {
      ctl = null; $("send").hidden = false; $("stop").hidden = true;
      m.scrollIntoView({ block: "end" });
    }
  }

  /* ---------- access code ---------- */
  function askCode(invalid) {
    $("codebox").hidden = false;
    $("codeErr").hidden = !invalid || !code;
    if (invalid) { code = ""; store.del("lq-agent-code"); }
    $("view-chat").hidden = true;
    $("code").focus();
  }
  $("codeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    code = $("code").value.trim(); if (!code) return;
    store.set("lq-agent-code", code);
    $("codebox").hidden = true; $("view-chat").hidden = false; $("code").value = "";
    if ($("q").value.trim()) ask();
  });

  /* ---------- UI wiring ---------- */
  function autosize() { const t = $("q"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 200) + "px"; }
  $("q").addEventListener("input", autosize);
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } });
  $("form").addEventListener("submit", (e) => { e.preventDefault(); ask(); });
  $("stop").onclick = () => ctl?.abort();
  $("trainBtn").onclick = startScenario;
  $("shuffleBtn").onclick = () => fillChips($("examples"), pickExamples(4));
  $("clear").onclick = () => {
    ctl?.abort(); turns = [];
    [...$("thread").querySelectorAll(".msg,.next")].forEach((n) => n.remove());
    fillChips($("examples"), pickExamples(4));
    $("empty").hidden = false;
  };

  /* ---------- boot ---------- */
  fetch("config.json", { cache: "no-cache" }).then((r) => r.json()).then((c) => { cfg = { ...cfg, ...c }; applyCfg(); }).catch(applyCfg);
  fetch("/api/agent").then((r) => r.ok ? r.json() : null).then((s) => {
    if (!s) return;
    if (!s.ready) $("kbInfo").textContent = "L'assistant n'est pas encore activé : la clé API reste à ajouter dans Cloudflare.";
    else if (s.needsCode && !code) askCode(false);
  }).catch(() => {});
})();
