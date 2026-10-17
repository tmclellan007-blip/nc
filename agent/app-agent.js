// Assistant La Qualia — interface application (site Web, sans dépendance à Claude.ai)
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const ICON = "avatar.webp";
  const SVG_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>';

  const SCENARIOS = [
    "un client en colère au sujet d'une facture", "un propriétaire inquiet dont le chien vomit depuis ce matin",
    "un client qui veut annuler une chirurgie le matin même", "un client en deuil qui appelle pour l'incinération",
    "un client qui demande une dose de médicament", "un nouveau client qui veut un rendez-vous rapidement",
    "un appel où l'animal a peut-être avalé un toxique", "un client qui conteste un dépôt pour chirurgie",
    "un technicien qui te demande de rappeler un client pour des résultats", "un client pressé qui veut parler au vétérinaire tout de suite",
    "un client qui trouve les prix trop élevés", "un client âgé qui a du mal à comprendre les consignes préopératoires",
  ];
  const TAGS = [
    [/urgen|vomit|toxique|chocolat|litière|signes/i, "Triage"],
    [/veut dire|signifie|qu'est-ce|différence|«/i, "Lexique"],
    [/vétérinaire|technicien|message|interrompre/i, "Équipe clinique"],
    [/deuil|euthanasie|pleure|décès/i, "Moment délicat"],
    [/.*/, "Client"],
  ];
  const tagFor = (t) => TAGS.find(([re]) => re.test(t))[1];

  let cfg = { name: "Assistant La Qualia", examples: [] };
  let turns = [];
  let inScenario = false;
  let ctl = null;
  let code = store.get("lq-agent-code") || "";
  let shown = new Set();
  try { shown = new Set(JSON.parse(store.get("lq-shown") || "[]")); } catch {}

  /* ---------- exemples qui tournent ---------- */
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
  function renderWelcomeCards() {
    const el = $("examples"); el.textContent = "";
    const t = document.createElement("button");
    t.type = "button"; t.className = "card train";
    t.innerHTML = '<span class="tag">Entraînement</span>Me mettre en situation d\'appel';
    t.onclick = startScenario; el.append(t);
    pickExamples(3).forEach((q) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "card";
      const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = tagFor(q);
      b.append(tag, document.createTextNode(q));
      b.onclick = () => send(q);
      el.append(b);
    });
  }
  function renderSideList() {
    const el = $("sideExamples"); el.textContent = "";
    pickExamples(6).forEach((q) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "side-item";
      b.innerHTML = '<span class="bullet"></span>';
      b.append(document.createTextNode(q));
      b.onclick = () => { closeMenu(); send(q); };
      el.append(b);
    });
  }
  function chipsInto(el, list) {
    list.forEach((t) => {
      const b = document.createElement("button");
      b.className = "chip"; b.type = "button"; b.textContent = t;
      b.onclick = () => send(t);
      el.append(b);
    });
  }
  function startScenario() {
    closeMenu();
    inScenario = true;
    const sc = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    send(`Mets-moi en situation : je suis à la réception et je reçois un appel de ${sc}.`);
  }

  /* ---------- config ---------- */
  function applyCfg() {
    $("agentName").textContent = cfg.name || "Assistant La Qualia";
    $("agentTag").textContent = cfg.tag || "";
    $("disclaimerText").textContent = cfg.disclaimer || "";
    $("disclaimer").hidden = !cfg.disclaimer;
    if (cfg.name) document.title = cfg.name;
    renderWelcomeCards();
    renderSideList();
  }
  function setStatus(kind, text) {
    $("status").className = "status " + kind;
    $("kbInfo").textContent = text;
  }

  /* ---------- réponse en deux parties : En direct + Apprentissage ---------- */
  const LIVE_RE = /\[\s*EN DIRECT\s*\]/i;
  const LEARN_RE = /\[\s*APPRENTISSAGE\s*\]/i;
  const SVG_BOLT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';
  const SVG_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
  const SVG_BOOK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>';
  function splitAnswer(text) {
    const li = text.search(LIVE_RE);
    if (li === -1) {
      // le marqueur peut être en train d'arriver : on attend avant d'afficher du texte brut
      if (/^\s*\[[^\]]*$/.test(text)) return { pending: true };
      return { plain: text };
    }
    const after = text.slice(li).replace(LIVE_RE, "");
    const lj = after.search(LEARN_RE);
    if (lj === -1) return { live: after.replace(/\n\s*\[[^\]\n]*$/, "").trim(), learn: null };
    return { live: after.slice(0, lj).trim(), learn: after.slice(lj).replace(LEARN_RE, "").trim() };
  }
  function renderAnswer(body, text, done) {
    const p = splitAnswer(text);
    if (p.pending) return;
    if (p.plain !== undefined) {
      body.dataset.live = "";
      body.innerHTML = inScenario
        ? `<section class="box-learn box-scene"><div class="box-head">${SVG_PHONE}Mise en situation</div><div class="box-body">${md(p.plain)}</div></section>`
        : md(p.plain);
      return;
    }
    body.dataset.live = p.live;
    let html = `<section class="box-live"><div class="box-head">${SVG_BOLT}En direct</div><div class="box-body">${md(p.live) || '<span class="typing"><i></i><i></i><i></i></span>'}</div></section>`;
    if (p.learn !== null) html += `<section class="box-learn"><div class="box-head">${SVG_BOOK}Apprentissage</div><div class="box-body">${md(p.learn) || '<span class="typing"><i></i><i></i><i></i></span>'}</div></section>`;
    else if (!done) html += `<section class="box-learn waiting"><div class="box-head">${SVG_BOOK}Apprentissage</div><div class="box-body"><span class="typing"><i></i><i></i><i></i></span></div></section>`;
    body.innerHTML = html;
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

  /* ---------- messages ---------- */
  const scroller = $("scroller");
  const nearBottom = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140;
  const toBottom = () => { scroller.scrollTop = scroller.scrollHeight; };

  function addQuestion(text) {
    $("empty").hidden = true;
    const m = document.createElement("div"); m.className = "msg q";
    const b = document.createElement("div"); b.className = "qbub"; b.textContent = text;
    m.append(b); $("thread").append(m); toBottom();
    return m;
  }
  function addAnswer() {
    const m = document.createElement("div"); m.className = "msg a";
    const av = document.createElement("div"); av.className = "av"; av.innerHTML = `<img src="${ICON}" alt="">`;
    const col = document.createElement("div"); col.className = "a-col";
    const who = document.createElement("div"); who.className = "who"; who.textContent = cfg.name || "Assistant";
    const body = document.createElement("div"); body.className = "body";
    body.innerHTML = '<span class="typing" aria-label="L\'assistant écrit"><i></i><i></i><i></i></span>';
    col.append(who, body); m.append(av, col); $("thread").append(m); toBottom();
    return { m, col, body };
  }

  async function send(text) {
    const q = String(text ?? $("q").value).trim();
    if (!q || ctl) return;
    $("q").value = ""; autosize();
    const qm = addQuestion(q);
    const { m, col, body } = addAnswer();
    if (!cfg.apiUrl) { body.innerHTML = '<p class="err">L\'assistant n\'est pas encore activé.</p>'; return; }
    ctl = new AbortController();
    busy(true);
    let answer = "";
    try {
      const res = await fetch(cfg.apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-agent-code": code },
        body: JSON.stringify({ question: q, history: turns.slice(-8) }),
        signal: ctl.signal,
      });
      if (!res.ok) {
        let msg = "La réponse a échoué. Réessayez.";
        try { msg = (await res.json()).error || msg; } catch {}
        if (res.status === 401) {
          qm.remove(); m.remove();
          if (!$("thread").children.length) $("empty").hidden = false;
          $("q").value = q; autosize(); askCode(true); return;
        }
        body.innerHTML = `<p class="err">${esc(msg)}</p>`;
        return;
      }
      const reader = res.body.getReader(); const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const stick = nearBottom();
        answer += dec.decode(value, { stream: true });
        renderAnswer(body, answer, false);
        if (stick) toBottom();
      }
      renderAnswer(body, answer, true);
      if (!answer.trim()) { body.innerHTML = '<p class="err">Aucune réponse reçue. Réessayez.</p>'; return; }
      turns.push({ role: "user", content: q }, { role: "assistant", content: answer });
      finishAnswer(res, col, answer);
    } catch (e) {
      if (e.name === "AbortError") {
        if (answer) { renderAnswer(body, answer, true); turns.push({ role: "user", content: q }, { role: "assistant", content: answer }); }
        else body.innerHTML = '<p class="err">Réponse arrêtée.</p>';
      } else { if (answer) renderAnswer(body, answer, true); else body.textContent = ""; body.insertAdjacentHTML("beforeend", '<p class="err">La connexion a été interrompue. Vérifiez Internet et réessayez.</p>'); }
    } finally {
      ctl = null; busy(false);
    }
  }

  function finishAnswer(res, col, answer) {
    let sources = [];
    try { sources = JSON.parse(decodeURIComponent(res.headers.get("x-agent-sources") || "[]")); } catch {}
    const cited = sources.filter((t) => answer.includes(t));
    if (cited.length) {
      const s = document.createElement("div"); s.className = "srcs"; s.textContent = "Sources : ";
      cited.forEach((t) => { const c = document.createElement("span"); c.className = "src"; c.textContent = t; s.append(c); });
      col.append(s);
    }
    const acts = document.createElement("div"); acts.className = "actions";
    const cp = document.createElement("button"); cp.type = "button"; cp.className = "act"; const label = () => (col.querySelector(".body")?.dataset.live ? "Copier la réponse en direct" : "Copier");
    cp.innerHTML = SVG_COPY + "<span></span>"; cp.querySelector("span").textContent = label();
    cp.onclick = async () => {
      const live = col.querySelector(".body")?.dataset.live;
      try { await navigator.clipboard.writeText(live || answer); cp.querySelector("span").textContent = "Copié"; }
      catch { cp.querySelector("span").textContent = "Copie impossible"; }
      setTimeout(() => { cp.querySelector("span").textContent = label(); }, 2000);
    };
    acts.append(cp); col.append(acts);

    document.querySelectorAll(".next").forEach((n) => n.remove());
    const nx = document.createElement("div"); nx.className = "next";
    const lab = document.createElement("div"); lab.className = "who"; lab.textContent = "Pour continuer à vous former";
    const ch = document.createElement("div"); ch.className = "chips"; chipsInto(ch, pickExamples(2));
    const tb = document.createElement("button"); tb.className = "chip train"; tb.type = "button"; tb.textContent = "Nouvelle mise en situation"; tb.onclick = startScenario; ch.append(tb);
    nx.append(lab, ch); $("thread").append(nx);
  }

  function busy(on) {
    $("send").hidden = on; $("stop").hidden = !on;
    if (!on) updateSend();
  }
  function updateSend() { $("send").disabled = !$("q").value.trim(); }

  function resetConversation() {
    ctl?.abort(); turns = []; inScenario = false;
    $("thread").textContent = "";
    $("empty").hidden = false;
    renderWelcomeCards(); renderSideList();
    scroller.scrollTop = 0;
    closeMenu();
    $("q").focus();
  }

  /* ---------- code d'accès ---------- */
  function askCode(invalid) {
    $("codebox").hidden = false;
    $("codeErr").hidden = !invalid;
    if (invalid) { code = ""; store.del("lq-agent-code"); }
    setTimeout(() => $("code").focus(), 50);
  }
  $("codeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("code").value.trim(); if (!v) return;
    code = v; store.set("lq-agent-code", code);
    $("codebox").hidden = true; $("code").value = "";
    if ($("q").value.trim()) send();
    else $("q").focus();
  });

  /* ---------- menu (téléphone) ---------- */
  function openMenu() { $("app").classList.add("open"); }
  function closeMenu() { $("app").classList.remove("open"); }
  $("menuBtn").onclick = openMenu;
  $("closeMenu").onclick = closeMenu;
  $("scrim").onclick = closeMenu;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---------- branchements ---------- */
  function autosize() { const t = $("q"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 180) + "px"; updateSend(); }
  $("q").addEventListener("input", autosize);
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  $("form").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  $("stop").onclick = () => ctl?.abort();
  $("sideTrain").onclick = startScenario;
  $("sideNew").onclick = resetConversation;
  $("clear").onclick = resetConversation;
  $("shuffleBtn").onclick = () => { renderSideList(); if (!$("empty").hidden) renderWelcomeCards(); };

  /* ---------- démarrage ---------- */
  fetch("config.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then((c) => { cfg = { ...cfg, ...c }; })
    .catch(() => {})
    .then(() => {
      applyCfg();
      if (!cfg.apiUrl) { setStatus("bad", "Assistant pas encore activé"); return; }
      return fetch(cfg.apiUrl).then((r) => (r.ok ? r.json() : null)).then((s) => {
        if (!s) { setStatus("bad", "Service indisponible"); return; }
        if (!s.ready) { setStatus("bad", "Clé API manquante"); return; }
        setStatus("ok", "En ligne");
        if (s.needsCode && !code) askCode(false);
      }).catch(() => setStatus("bad", "Service injoignable"));
    });
})();
