// Relais sécurisé de l'Assistant La Qualia (Cloudflare Pages Function).
// La clé API Anthropic reste côté serveur : elle est lue dans la variable
// d'environnement ANTHROPIC_API_KEY et n'est jamais envoyée au navigateur.
//
// Variables d'environnement (Cloudflare > Pages > nc > Settings > Variables and Secrets) :
//   ANTHROPIC_API_KEY  (obligatoire, de type « Secret »)
//   AGENT_CODE         (recommandé) code d'accès que l'équipe saisit une fois
//   AGENT_MODEL        (facultatif) remplace le modèle choisi dans agent/config.json

const MODELS = { quick: "claude-haiku-5-5", default: "claude-sonnet-5-5", complex: "claude-opus-5-5" };
const AUD = {
  telephonistes: "des téléphonistes et réceptionnistes sans formation clinique (langage simple, phrases prêtes à dire)",
  proprietaires: "des propriétaires d'animaux (vulgarise, évite le jargon)",
  techniciens: "des techniciens en santé animale (vocabulaire technique accepté)",
  veterinaires: "des vétérinaires (réponse technique et concise)",
};
const MAX_QUESTION = 2000;
const MAX_TURN = 6000;
const MAX_HISTORY = 8;
const CTX_BUDGET = 60000;
const MAX_TOKENS = 1600;

let cache = null; // { at, config, chunks }

export async function onRequestGet({ env }) {
  return json(200, { ready: !!env.ANTHROPIC_API_KEY, needsCode: !!env.AGENT_CODE });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json(403, { error: "Requête refusée." });
  if (!env.ANTHROPIC_API_KEY) return json(503, { error: "L'assistant n'est pas encore configuré : la clé API est manquante." });
  if (env.AGENT_CODE && request.headers.get("x-agent-code") !== env.AGENT_CODE) {
    return json(401, { error: "Code d'accès invalide." });
  }

  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Requête invalide." }); }
  const question = String(body?.question || "").trim().slice(0, MAX_QUESTION);
  if (!question) return json(400, { error: "La question est vide." });
  const history = cleanHistory(body?.history);

  const { config, chunks } = await loadKnowledge(request, env);
  const ctx = retrieve(chunks, question);
  const ctxText = ctx.length
    ? ctx.map((c) => `### [${c.title}]\n${c.text}`).join("\n\n")
    : "(Aucun extrait pertinent dans la documentation de référence.)";
  const system = `${config.instructions}\n\nPublic visé : ${AUD[config.audience] || AUD.telephonistes}.\nÉcris en Markdown simple (titres ###, listes, gras). Pas de tableaux.`;
  const messages = [...history, { role: "user", content: `DOCUMENTATION DE RÉFÉRENCE (extraits)\n\n${ctxText}\n\n---\nQUESTION\n${question}` }];
  const model = env.AGENT_MODEL || MODELS[config.tier] || MODELS.default;

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages, stream: true }),
  });

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status;
    const msg = status === 401 ? "La clé API est invalide. Vérifiez ANTHROPIC_API_KEY dans Cloudflare."
      : status === 429 ? "Trop de questions en même temps. Réessayez dans une minute."
      : status === 400 ? "La demande a été refusée par le service. Raccourcissez la question ou commencez une nouvelle conversation."
      : "Le service est momentanément indisponible. Réessayez.";
    return json(status === 401 ? 502 : status, { error: msg });
  }

  const sources = [...new Set(ctx.map((c) => c.title))];
  return new Response(sseToText(upstream.body), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-agent-sources": encodeURIComponent(JSON.stringify(sources)),
    },
  });
}

/* ---------- helpers ---------- */
function json(status, data) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // certains navigateurs n'envoient pas Origin en same-origin
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}

function cleanHistory(h) {
  if (!Array.isArray(h)) return [];
  const turns = h
    .filter((t) => t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_TURN) }))
    .slice(-MAX_HISTORY);
  while (turns.length && turns[0].role !== "user") turns.shift();
  const out = [];
  for (const t of turns) { if (out.length && out[out.length - 1].role === t.role) out[out.length - 1] = t; else out.push(t); }
  if (out.length && out[out.length - 1].role === "user") out.pop(); // la nouvelle question est ajoutée ensuite
  return out;
}

function sseToText(stream) {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  return stream.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
        if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") ctl.enqueue(enc.encode(ev.delta.text));
        else if (ev.type === "message_delta" && ev.delta?.stop_reason === "max_tokens") ctl.enqueue(enc.encode("\n\n_(Réponse coupée : demandez la suite.)_"));
        else if (ev.type === "error") ctl.enqueue(enc.encode("\n\n_(La réponse a été interrompue. Réessayez.)_"));
      }
    },
  }));
}

async function asset(request, env, path) {
  const res = await env.ASSETS.fetch(new URL(path, request.url));
  if (!res.ok) throw new Error(path);
  return res;
}

async function loadKnowledge(request, env) {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache;
  let config = {};
  try { config = await (await asset(request, env, "/agent/config.json")).json(); } catch {}
  if (!config.instructions) config.instructions = "Tu es un assistant pour l'équipe d'accueil d'un établissement vétérinaire. Réponds en français.";
  let files = [];
  try { files = await (await asset(request, env, "/agent/docs/index.json")).json(); } catch {}
  const chunks = [];
  for (const f of Array.isArray(files) ? files : []) {
    const file = typeof f === "string" ? f : f.file;
    const title = (typeof f === "object" && f.title) || String(file).replace(/\.[^.]+$/, "");
    if (!file || /[\/\\]|\.\./.test(file)) continue;
    try {
      const text = (await (await asset(request, env, "/agent/docs/" + encodeURIComponent(file))).text()).replace(/\r/g, "");
      for (let i = 0; i < text.length; i += 1400) {
        const piece = text.slice(i, i + 1600);
        chunks.push({ title, text: piece, tf: countTerms(piece + " " + title) });
      }
    } catch {}
  }
  cache = { at: Date.now(), config, chunks };
  return cache;
}

const STOP = new Set("les des une un du de la le et ou en au aux pour par sur dans avec sans que qui quoi est sont pas plus mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ce cet cette ces il elle ils elles on nous vous je tu me te se lui y a ai as avait avoir etre etait faire fait peut peux doit dois quel quelle quels quelles comment quand pourquoi combien tres bien aussi alors donc mais si ne qu".split(" "));
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const terms = (s) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => (w.length > 5 ? w.replace(/(s|x)$/, "") : w));
function countTerms(s) { const m = new Map(); for (const t of terms(s)) m.set(t, (m.get(t) || 0) + 1); return m; }

function retrieve(chunks, question) {
  const all = chunks.reduce((a, c) => a + c.text.length, 0);
  if (all <= CTX_BUDGET) return chunks.slice();
  const q = [...new Set(terms(question))];
  const N = chunks.length;
  const df = new Map(q.map((t) => [t, chunks.filter((c) => c.tf.has(t)).length]));
  const scored = chunks
    .map((c) => { let s = 0; for (const t of q) { const f = c.tf.get(t); if (f) s += (1 + Math.log(f)) * Math.log(1 + N / (df.get(t) || 1)); } return { c, s }; })
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const out = []; let used = 0;
  for (const { c } of scored) { if (used + c.text.length > CTX_BUDGET) break; out.push(c); used += c.text.length; }
  return out;
}
