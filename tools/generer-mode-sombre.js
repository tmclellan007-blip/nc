// Régénère agent/dark.css (mode sombre) à partir des styles de l'application.
// Usage : npm i postcss@8 puis node tools/generer-mode-sombre.js agent > /tmp/gen.css,
// et coller le résultat sous la couche manuelle en tête de agent/dark.css.
// Génère agent/dark.css : versions sombres des règles de couleur de l'application.
// node gen.js <dossier agent> > dark-gen.css
const fs = require("fs"), path = require("path"), postcss = require("postcss");
const AG = process.argv[2];
const html = fs.readFileSync(path.join(AG, "index.html"), "utf8");
const inline = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const sources = [
  ["styles.css", fs.readFileSync(path.join(AG, "../styles.css"), "utf8"), true],
  ["inline", inline, false],
  ["app.css", fs.readFileSync(path.join(AG, "app.css"), "utf8"), false],
];
// classes et id réellement présents dans l'application (HTML + JS)
const corpus = html + ["app-agent.js", "nutrition.js", "journey.js", "dashboard.js", "user-chip.js"].map((f) => fs.readFileSync(path.join(AG, f), "utf8")).join("\n");
const known = new Set(corpus.match(/[A-Za-z][\w-]*/g));

// ---------- couleurs ----------
const NAMED = { white: "#ffffff", black: "#000000" };
function parse(c) {
  c = c.trim().toLowerCase(); if (NAMED[c]) c = NAMED[c];
  let m;
  if ((m = c.match(/^#([0-9a-f]{3,8})$/))) {
    let h = m[1]; if (h.length <= 4) h = [...h].map((x) => x + x).join("");
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  if ((m = c.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/))) {
    let a = m[4] === undefined ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], a];
  }
  return null;
}
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gam = (v) => { v = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255); };
function toOklch([r, g, b]) {
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}
function fromOklch(L, C, H) {
  for (let k = 0; k < 30; k++) {
    const A = C * Math.cos(H), B = C * Math.sin(H);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (rgb.every((v) => v >= -0.001 && v <= 1.001) || C < 0.002) return rgb.map(gam);
    C *= 0.92;
  }
  return [0, 0, 0];
}
const fmt = ([r, g, b], a) => (a >= 0.999 ? "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("") : `rgba(${r},${g},${b},${+a.toFixed(3)})`);
const VIOLET = Math.atan2(-0.09, 0.03); // teinte prune du thème
function map(c, role) {
  const p = parse(c); if (!p) return null;
  const a = p[3]; if (a === 0) return null;
  let [L, C, H] = toOklch(p);
  if (role === "fg") {
    if (L >= 0.66) return null;
    L = Math.min(0.95, 0.97 - L * 0.32); C = Math.min(C, 0.13);
    return fmt(fromOklch(L, C, H), a);
  }
  if (role === "bg") {
    if (L <= 0.5 || C > 0.11) return null;            // fonds sombres et couleurs vives : inchangés
    if (a < 0.4 && L > 0.9) return null;               // voile blanc translucide : reste un voile clair
    if (C < 0.015) { H = VIOLET; C = 0.014; } else C = Math.min(C * 0.55, 0.06);
    L = L > 0.995 ? 0.345 : Math.min(0.42, 0.268 + (1 - L) * 0.75);   // les cartes blanches restent un cran au-dessus du fond
    return fmt(fromOklch(L, C, H), a);
  }
  if (role === "border") {
    if (L <= 0.5 || C > 0.13) return null;
    if (C < 0.015) { H = VIOLET; C = 0.02; } else C = Math.min(C * 0.6, 0.07);
    L = 0.43 + (1 - L) * 0.45;
    return fmt(fromOklch(L, C, H), a);
  }
  if (role === "shadow") {
    if (L > 0.9) return map(c, "bg");                  // anneaux blancs autour des pastilles
    if (L < 0.4) return fmt([0, 0, 0], Math.min(1, a * 1.8));
    return null;
  }
  if (role === "svg") {
    if (L > 0.9 && C < 0.05) return map(c, "bg");
    if (L < 0.3) return map(c, "fg");
    return null;
  }
  return null;
}
const ROLE = (prop) => {
  if (/^(color|caret-color|-webkit-text-fill-color|text-decoration-color|outline-color|column-rule-color)$/.test(prop)) return "fg";
  if (/^background/.test(prop)) return "bg";
  if (/^border|^outline$/.test(prop)) return "border";
  if (/shadow$/.test(prop)) return "shadow";
  if (/^(fill|stroke)$/.test(prop)) return "svg";
  return null;
};
const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\b(white|black)\b/g;
function mapValue(val, role) {
  let changed = false;
  const out = val.replace(COLOR_RE, (c) => { const m = map(c, role); if (m) { changed = true; return m; } return c; });
  return changed ? out : null;
}

// ---------- variables ----------
const VAR_ROLE = (name) => {
  if (/(^--(ink|muted|text|fg)|-ink$|ink-?\d?$)/.test(name)) return "fg";
  if (/(paper|^--bg$|surface|soft|mist|rail|panel|^--card|^--app-soft)/.test(name)) return "bg";
  if (/(line|border)/.test(name)) return "border";
  return null;
};
const KEEP_VARS = new Set();  // variables de marque sombres utilisées comme couleur de texte
const varVal = {};

// ---------- génération ----------
const out = [];
for (const [name, css, filter] of sources) {
  const root = postcss.parse(css);
  root.walkDecls(/^--/, (d) => { if (!varVal[d.prop]) varVal[d.prop] = d.value.trim(); });
  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === "atrule" && /keyframes/.test(rule.parent.name)) return;
    let sels = rule.selectors.filter((s) => !/::-webkit-scrollbar|::selection|::backdrop/.test(s) || true);
    if (filter) sels = sels.filter((s) => (s.match(/[.#][\w-]+/g) || []).every((t) => known.has(t.slice(1))) && !/^(input|select|textarea)$/.test(s.trim()));
    if (!sels.length) return;
    const decls = [];
    const ruleBgKept = rule.nodes.some((d) => d.type === "decl" && /^background/.test(d.prop) && (() => { const cs = d.value.match(COLOR_RE); if (!cs) return /var\(--(purple|role|band|orange|blue|lime|app-nav|night|brand)(?![\w-])/.test(d.value); return cs.some((c) => { const p = parse(c); if (!p || p[3] < 0.5) return false; const [L, C] = toOklch(p); return L <= 0.5 || C > 0.11; }); })());
    for (const d of rule.nodes) {
      if (d.type !== "decl") continue;
      const imp = d.important ? "!important" : "";
      if (d.prop.startsWith("--")) {
        const r = VAR_ROLE(d.prop); if (!r) continue;
        const v = mapValue(d.value, r); if (v) decls.push(`${d.prop}:${v}${imp}`);
        continue;
      }
      const role = ROLE(d.prop); if (!role) continue;
      if (role === "fg" && ruleBgKept) continue;           // texte posé sur un fond vif ou sombre : inchangé
      const brandFg = role === "fg" && /var\(--(purple|role|band|role-ink|purple-ink|brand|brand-ink)(?![\w-])/.test(d.value) && !/color-mix/.test(d.value);
      let v = brandFg ? `color-mix(in oklab, ${d.value} 40%, white)` : mapValue(d.value, role);
      if (v) decls.push(`${d.prop}:${v}${imp}`);
    }
    if (!decls.length) return;
    const pre = (s) => {
      s = s.trim();
      if (/^(html|:root)\b/.test(s)) return s.replace(/^(html|:root)/, "html.dark");
      return "html.dark " + s;
    };
    let block = `${sels.map(pre).join(",")}{${decls.join(";")}}`;
    let p = rule.parent; while (p && p.type === "atrule") { block = `@${p.name} ${p.params}{${block}}`; p = p.parent; }
    out.push(block);
  });
}
process.stdout.write("/* Généré à partir des styles de l'application (gen.js) */\n" + out.join("\n") + "\n");
console.error("règles :", out.length);
