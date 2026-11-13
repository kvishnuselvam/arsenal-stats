/* Arsenal Stats: static site reading JSON built by scripts/build_site_data.py */
"use strict";

const ARSENAL = "359";
const COMP_NAMES = { PL: "Premier League", UCL: "Champions League", ALL: "PL + UCL" };
const S = { meta: null, matches: [], players: [], league: {}, comp: "PL", season: null };
const PCOL = ["var(--s1)", "var(--s2)", "var(--s3)"];

// ---------- stat definitions ----------
const PSTATS = [
  { k: "g", l: "Goals", grp: "Attacking" }, { k: "xg", l: "xG", fpl: 1, grp: "Attacking" },
  { k: "sh", l: "Shots", grp: "Attacking" }, { k: "sot", l: "Shots on target", grp: "Attacking" },
  { k: "a", l: "Assists", grp: "Creating" }, { k: "xa", l: "xA", fpl: 1, grp: "Creating" },
  { k: "fs", l: "Fouls won", grp: "Creating" },
  { k: "ptkl", l: "Tackles", fpl: 1, grp: "Defending" }, { k: "cbi", l: "Clearances, blocks, interceptions", short: "Clr/blk/int", fpl: 1, grp: "Defending" },
  { k: "rec", l: "Recoveries", fpl: 1, grp: "Defending" }, { k: "dc", l: "Defensive contributions", short: "Def. contrib.", fpl: 1, grp: "Defending" },
  { k: "fc", l: "Fouls committed", grp: "Discipline" }, { k: "yc", l: "Yellow cards", grp: "Discipline" }, { k: "rc", l: "Red cards", grp: "Discipline" },
  { k: "sv", l: "Saves", gk: 1, grp: "Goalkeeping" }, { k: "gc", l: "Goals conceded", gk: 1, low: 1, grp: "Goalkeeping" },
  { k: "min", l: "Minutes", grp: "Playing time", base: 1 }, { k: "apps", l: "Appearances", grp: "Playing time", base: 1 }, { k: "starts", l: "Starts", grp: "Playing time", base: 1 },
];
const STAT = Object.fromEntries(PSTATS.map((s) => [s.k, s]));
const DEF_KEYS = ["ptkl", "cbi", "rec", "dc"];
const PCT_STATS = ["g", "a", "xg", "xa", "sh", "sot", "fs", "ptkl", "cbi", "rec"];
const GK_PCT = ["sv", "gc"];
const H2H_STATS = ["min", "g", "a", "xg", "xa", "sh", "sot", "fs", "ptkl", "cbi", "rec", "dc", "fc", "yc", "sv", "gc"];
const TSTATS = [
  { k: "goals", l: "Goals", side: "f" }, { k: "goals", l: "Goals conceded", side: "a", low: 1 },
  { k: "xg", l: "xG", side: "f" }, { k: "xg", l: "xG against", side: "a", low: 1 },
  { k: "sh", l: "Shots", side: "f" }, { k: "sh", l: "Shots conceded", side: "a", low: 1 },
  { k: "sot", l: "Shots on target", side: "f" }, { k: "sot", l: "On target conceded", side: "a", low: 1 },
  { k: "poss", l: "Possession %", calc: 1 }, { k: "passpct", l: "Pass accuracy %", calc: 1 },
  { k: "pass", l: "Passes", side: "f" }, { k: "cross", l: "Crosses", side: "f" },
  { k: "cor", l: "Corners", side: "f" }, { k: "tkl", l: "Tackles", side: "f" },
  { k: "int", l: "Interceptions", side: "f" }, { k: "clr", l: "Clearances", side: "f" },
  { k: "blk", l: "Shots blocked", side: "f" }, { k: "fc", l: "Fouls", side: "f", low: 1 },
  { k: "off", l: "Offsides", side: "f" },
];
const tkey = (t) => `${t.side || "c"}.${t.k}`;

// ---------- helpers ----------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NA = '<span class="na">n/a</span>';
const fmtd = (v, d) => (v == null || Number.isNaN(v) ? NA : v.toFixed(d));
const nf = (v, d) => (v == null ? "n/a" : v.toFixed(Math.abs(v) >= 100 ? 0 : d));
const dateStr = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
const sec = (ix, title) => `<h2 class="sec"><span class="ix">${ix} //</span>${esc(title)}</h2>`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
};
async function getJSON(path) {
  const r = await fetch(path, { cache: "no-cache" });
  if (!r.ok) throw new Error(path + " " + r.status);
  return r.json();
}
async function league(comp, season) {
  const key = `${comp}|${season}`;
  if (!(key in S.league)) {
    try { S.league[key] = await getJSON(`data/league_${comp}_${season}.json`); } catch (e) { S.league[key] = null; }
  }
  return S.league[key];
}
function seasonsFor(comp) {
  const m = S.meta.seasons || {};
  const list = comp === "ALL" ? [...new Set([...(m.PL || []), ...(m.UCL || [])])] : m[comp] || [];
  return list.sort().reverse();
}
const inScope = (m) => (S.comp === "ALL" || m.comp === S.comp) && (S.season === "ALL" || m.season === S.season);
const scopeLabel = () => `${COMP_NAMES[S.comp]} · ${S.season === "ALL" ? "all seasons since 2020-21" : S.season}`;
function singleScope() {
  const comp = S.comp === "ALL" ? "PL" : S.comp;
  const seasons = seasonsFor(comp);
  const season = S.season === "ALL" || !seasons.includes(S.season) ? seasons[0] : S.season;
  return { comp, season };
}
const initials = (name) => { const p = String(name || "").split(/\s+/).filter(Boolean); return ((p[0] || "")[0] || "") + (p.length > 1 ? p[p.length - 1][0] : (p[0] || "")[1] || ""); };

// ---------- club badges and player kit cards (built from club colours; no logos or photos) ----------
function hex(c, fb) { return c && /^[0-9a-f]{6}$/i.test(c) ? "#" + c : fb; }
function teamInfo(tid, name) {
  const t = (S.meta.teams || {})[tid] || {};
  let c = hex(t.color, null);
  if (!c) { let h = 0; for (const ch of String(name || tid)) h = (h * 31 + ch.charCodeAt(0)) % 360; c = `hsl(${h} 55% 38%)`; }
  if (tid === ARSENAL) c = "#e00b2a";
  let c2 = "#ffffff";
  if (c.startsWith("#")) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    if (0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45) c2 = "#0b0b10";
  }
  const nm = t.name || name || "";
  return { c, c2, abbr: t.abbr || nm.slice(0, 3).toUpperCase(), name: nm, short: t.short || nm };
}
function badge(tid, name, size = "") {
  const t = teamInfo(tid, name);
  return `<span class="badge ${size}" style="--c:${t.c};--c2:${t.c2}" title="${esc(t.name)}">${esc(t.abbr)}</span>`;
}
function kit(p, size = "") {
  const tid = p.tid || ARSENAL;
  const c = tid === ARSENAL ? "var(--neon)" : teamInfo(tid, p.team).c;
  const glow = tid === ARSENAL ? "var(--neon)" : `color-mix(in srgb, ${c}, #fff 35%)`;
  const label = p.no ? `<text class="no" x="50" y="66">${esc(p.no)}</text>` : `<text class="ini" x="50" y="63">${esc(initials(p.name).toUpperCase())}</text>`;
  return `<div class="kit ${size}" style="--c:${glow}"><svg viewBox="0 0 100 100" aria-hidden="true">
    <path class="shirt" fill="url(#kitfill)" d="M34 8 L43 5 Q50 14 57 5 L66 8 L91 22 L83 41 L73 36 L73 93 L27 93 L27 36 L17 41 L9 22 Z"/>
    <path d="M43 5 Q50 14 57 5" fill="none" stroke="${glow}" stroke-width="2"/>${label}</svg></div>`;
}

// ---------- aggregation ----------
let MATCH_BY_ID = {};
function aggTeam(ms) {
  const t = { mp: 0, w: 0, d: 0, l: 0, f: {}, a: {}, poss: 0, possN: 0, xgm: 0, n: {} };
  for (const m of ms) {
    t.mp++; t[m.res.toLowerCase()]++;
    for (const side of ["f", "a"]) for (const [k, v] of Object.entries(m[side] || {})) t[side][k] = (t[side][k] || 0) + v;
    for (const k of Object.keys(m.f || {})) if (k !== "xg" && m.a && k in m.a) t.n[k] = (t.n[k] || 0) + 1;
    t.f.goals = (t.f.goals || 0) + m.gf; t.a.goals = (t.a.goals || 0) + m.ga;
    if (m.poss != null) { t.poss += m.poss; t.possN++; }
    if (m.f && m.f.xg != null) t.xgm++;
  }
  t.poss = t.possN ? t.poss / t.possN : null;
  t.pts = 3 * t.w + t.d;
  return t;
}
function teamVal(t, def) {
  if (def.k === "poss") return t.poss ?? null;
  if (def.k === "passpct") return t.f.pass ? (100 * (t.f.passacc || 0)) / t.f.pass : null;
  const n = def.k === "xg" ? t.xgm : def.k === "goals" ? t.mp : (t.n && t.n[def.k] != null ? t.n[def.k] : t.mp);
  const v = t[def.side][def.k];
  if (!n || v == null) return null;
  return v / n;
}
function aggPlayer(p, filter) {
  const a = { key: "a:" + p.id, id: p.id, tid: ARSENAL, team: "Arsenal", name: p.name, grp: p.grp, no: p.no, nat: p.nat, apps: 0, starts: 0, min: 0, fmin: 0 };
  const seasonsWithF = new Set();
  for (const r of p.matches) {
    const m = MATCH_BY_ID[r.m];
    if (!m || !filter(m)) continue;
    a.apps++; a.starts += r.st || 0; a.min += r.min;
    for (const s of PSTATS) if (!s.fpl && !s.base && r[s.k]) a[s.k] = (a[s.k] || 0) + r[s.k];
    if (r.f) {
      a.fmin += r.min; seasonsWithF.add(m.season);
      for (const s of PSTATS) if (s.fpl) a[s.k] = (a[s.k] || 0) + (r[s.k] || 0);
    }
  }
  for (const [season, px] of Object.entries(p.past_xg || {})) {
    if (seasonsWithF.has(season) || !filter({ comp: "PL", season })) continue;
    a.fmin += px.min; a.xg = (a.xg || 0) + px.xg; a.xa = (a.xa || 0) + px.xa;
  }
  return a;
}
// league rows → same shape as aggPlayer output
function fromLeague(r, arsById) {
  const p = { ...r, key: `${r.id}|${r.tid}` };
  if (r.fmin && !r.fpl_past) for (const k of ["xg", "xa", ...DEF_KEYS]) p[k] = p[k] || 0;
  if (r.fmin && r.fpl_past) for (const k of ["xg", "xa"]) p[k] = p[k] || 0;
  if (r.tid === ARSENAL && arsById[r.id]) { p.no = arsById[r.id].no; p.nat = arsById[r.id].nat; }
  return p;
}
function statVal(a, s, per90) {
  if (s.base) return s.k === "min" || !per90 ? a[s.k] || 0 : null;
  const v = a[s.k];
  if (s.fpl) {
    if (!a.fmin || v == null) return null;
    return per90 ? (v * 90) / a.fmin : v;
  }
  if (per90) return a.min ? ((v || 0) * 90) / a.min : null;
  return v || 0;
}
const decs = (s, per90) => (s.base ? 0 : per90 ? 2 : s.k === "xg" || s.k === "xa" ? 2 : 0);

// ---------- tooltip ----------
const tip = $("#tip");
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest && e.target.closest("[data-tip]");
  if (!el) { tip.hidden = true; return; }
  tip.innerHTML = el.getAttribute("data-tip");
  tip.hidden = false;
});
document.addEventListener("mousemove", (e) => {
  if (tip.hidden) return;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = e.clientY - h - 14;
  tip.style.left = x + "px"; tip.style.top = y + "px";
});

// ---------- charts ----------
const chartW = (max) => Math.max(340, Math.min(max, (document.querySelector("main").clientWidth || max) - 34));
function vbar(x, y0, w, h, dir) {
  if (h <= 0) return "";
  const r = Math.min(3, w / 2, h);
  const y = dir > 0 ? y0 - h : y0 + h, s = dir > 0 ? 1 : -1;
  return `M${x},${y0}V${y + s * r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + s * r}V${y0}Z`;
}
function hbarPath(x0, y, w, h) {
  if (w <= 0) return "";
  const r = Math.min(3, h / 2, w);
  return `M${x0},${y}H${x0 + w - r}Q${x0 + w},${y} ${x0 + w},${y + r}V${y + h - r}Q${x0 + w},${y + h} ${x0 + w - r},${y + h}H${x0}Z`;
}
function matchBars(ms, key, label) {
  const W = chartW(1180), H = 240, top = 16, mid = 116, pad = 34;
  const vals = ms.map((m) => [key === "goals" ? m.gf : m.f[key], key === "goals" ? m.ga : m.a[key]]);
  const max = Math.max(1, ...vals.flat().filter((v) => v != null));
  const scale = (mid - top - 6) / max;
  const n = ms.length, slot = (W - pad) / Math.max(n, 1), bw = Math.max(2, Math.min(22, slot - 3));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} per match"><defs><filter id="glow"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  for (const t of [max, max / 2]) {
    const v = Math.round(t * 10) / 10;
    for (const y of [mid - t * scale, mid + t * scale]) s += `<line x1="${pad}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--grid)" stroke-dasharray="2 4"/>`;
    s += `<text x="${pad - 6}" y="${mid - t * scale + 4}" text-anchor="end">${v}</text><text x="${pad - 6}" y="${mid + t * scale + 4}" text-anchor="end">${v}</text>`;
  }
  ms.forEach((m, i) => {
    const x = pad + i * slot + (slot - bw) / 2;
    const [f, a] = vals[i];
    if (f != null) s += `<path d="${vbar(x, mid - 1, bw, f * scale, 1)}" fill="var(--s1)" filter="url(#glow)"/>`;
    if (a != null) s += `<path d="${vbar(x, mid + 1, bw, a * scale, -1)}" fill="var(--s2)"/>`;
    const t = `<b>${esc(dateStr(m.date))} · ${m.ha === "home" ? "vs" : "at"} ${esc(m.opp.name)}</b>${m.comp} · ${m.gf}-${m.ga} (${m.res})<br>Arsenal ${esc(label)}: ${f ?? "n/a"}<br>Opponent: ${a ?? "n/a"}`;
    s += `<rect x="${pad + i * slot}" y="${top}" width="${slot}" height="${H - top - 24}" fill="transparent" data-tip="${esc(t)}"/>`;
  });
  s += `<line x1="${pad}" x2="${W}" y1="${mid}" y2="${mid}" stroke="var(--axis)"/>`;
  const step = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 85))));
  ms.forEach((m, i) => {
    if (i % step) return;
    s += `<text x="${pad + i * slot + slot / 2}" y="${H - 4}" text-anchor="middle">${esc(new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }))}</text>`;
  });
  return s + "</svg>";
}
// ranked horizontal bars with club badges; Arsenal in neon
function rankBars(rows, opts) {
  const W = chartW(1180), rh = 30, lw = W < 520 ? 150 : 230, vw = 64, H = rows.length * rh + 6;
  const max = Math.max(...rows.map((r) => r.v ?? 0), 0.0001);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)} ranking">`;
  rows.forEach((r, i) => {
    const y = i * rh + 3, w = ((r.v ?? 0) / max) * (W - lw - vw - 10);
    const t = teamInfo(r.id, r.name), ars = r.id === ARSENAL;
    s += `<g data-tip="${esc(`<b>${esc(r.name)}</b>${esc(opts.label)}: ${r.v == null ? "n/a" : r.v.toFixed(opts.d ?? 2)}<br>Rank ${r.rank} of ${opts.total}`)}">`;
    s += `<rect x="0" y="${y - 2}" width="${W}" height="${rh}" fill="${ars ? "rgba(255,45,75,0.08)" : "transparent"}"/>`;
    s += `<text x="4" y="${y + 17}" class="val" fill="var(--muted)">${String(r.rank).padStart(2, "0")}</text>`;
    s += `<g transform="translate(30 ${y + 1})"><path d="M10 0 20 4 20 15 10 22 0 15 0 4Z" fill="${t.c}"/><text x="10" y="14" text-anchor="middle" style="font:700 6.5px var(--display);fill:${t.c2}">${esc(t.abbr)}</text></g>`;
    s += `<text class="lab" x="58" y="${y + 17}" ${ars ? 'style="fill:var(--neon)"' : ""}>${esc(W < 520 ? t.abbr : t.short)}</text>`;
    s += `<path d="${hbarPath(lw, y + 5, w, rh - 14)}" fill="${ars ? "var(--s1)" : "var(--other)"}" ${ars ? 'filter="url(#glow2)"' : ""}/>`;
    s += `<text class="val" x="${lw + w + 8}" y="${y + 17}">${r.v == null ? "n/a" : r.v.toFixed(opts.d ?? 2)}</text></g>`;
  });
  s += `<defs><filter id="glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  return s + "</svg>";
}
// head-to-head rows: one block per metric, a bar per entity, leader glows
function h2hRows(ents, metrics) {
  return metrics.map((m) => {
    const vals = ents.map((e) => e.vals[m.k]);
    const real = vals.filter((v) => v != null);
    const max = Math.max(...real, 0.0001);
    const best = real.length ? (m.low ? Math.min(...real) : Math.max(...real)) : null;
    const bars = ents.map((e, i) => {
      const v = vals[i], lead = v != null && v === best && real.length > 1;
      return `<div class="bar" style="--pc:${e.color}" data-tip="${esc(`<b>${esc(e.name)}</b>${esc(m.l)}: ${nf(v, m.d ?? 2)}`)}"><div class="track"><i class="${lead ? "lead" : ""}" style="width:${v == null ? 0 : Math.max(1, (100 * v) / max)}%"></i></div><div class="n ${lead ? "lead" : ""}">${nf(v, m.d ?? 2)}</div></div>`;
    }).join("");
    return `<div class="h2h-row"><div class="lab">${esc(m.l)}</div><div class="bars">${bars}</div></div>`;
  }).join("");
}

// ---------- sortable tables ----------
function table(cols, rows, opts = {}) {
  const id = "t" + Math.random().toString(36).slice(2, 8);
  const state = { k: opts.sort || null, asc: !!opts.asc };
  const render = () => {
    const el = document.getElementById(id);
    if (!el) return;
    let rs = rows.slice();
    if (state.k) {
      const c = cols.find((c) => c.k === state.k);
      rs.sort((x, y) => {
        const a = c.sv ? c.sv(x) : x[c.k], b = c.sv ? c.sv(y) : y[c.k];
        if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
        return (a < b ? -1 : a > b ? 1 : 0) * (state.asc ? 1 : -1);
      });
    }
    const head = cols.map((c) => `<th data-k="${c.k}" class="${c.left ? "l" : ""} ${state.k === c.k ? "sorted" + (state.asc ? " asc" : "") : ""}" title="${esc(c.title || c.l)}">${esc(c.l)}</th>`).join("");
    const body = rs.map((r) => `<tr class="${opts.hl && opts.hl(r) ? "hl" : ""}">${cols.map((c) => `<td class="${c.left ? "l" : ""}">${c.f ? c.f(r) : r[c.k] ?? NA}</td>`).join("")}</tr>`).join("");
    el.innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    el.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (state.k === k) state.asc = !state.asc; else { state.k = k; state.asc = !!(cols.find((c) => c.k === k).left); }
      render();
    }));
  };
  setTimeout(render, 0);
  return `<div class="hud tablewrap" id="${id}"></div>`;
}
function toggle(name, options, value) {
  return `<span class="toggle" data-toggle="${name}">${options.map(([v, l]) => `<button data-v="${v}" class="${v === value ? "on" : ""}">${esc(l)}</button>`).join("")}</span>`;
}
function onToggle(name, fn) {
  document.querySelectorAll(`[data-toggle="${name}"] button`).forEach((b) => b.addEventListener("click", () => fn(b.dataset.v)));
}
const tiles = (list) => `<div class="tiles">${list.map(([v, l, x, hot]) => `<div class="hud pad tile ${hot ? "hot" : ""}"><div class="v">${v ?? "n/a"}</div><div class="l">${l}</div><div class="x">${x || ""}</div></div>`).join("")}</div>`;

// ---------- TEAM ----------
async function viewTeam() {
  const ms = S.matches.filter(inScope);
  const t = aggTeam(ms);
  if (!t.mp) { $("#app").innerHTML = `<section class="hero"><div class="kicker">${esc(scopeLabel())}</div><h1>Arsenal</h1><p class="sub">No matches in this selection yet.</p></section>`; return; }
  const pm = (side, k) => teamVal(t, { k, side });
  const single = S.comp !== "ALL" && S.season !== "ALL";
  let posTxt = "";
  if (single) {
    const L = await league(S.comp, S.season);
    if (L && S.comp === "PL") {
      const ix = L.teams.findIndex((x) => x.id === ARSENAL);
      if (ix >= 0) posTxt = ["1st", "2nd", "3rd"][ix] || ix + 1 + "th";
    }
  }
  let h = `<section class="hero"><div class="kicker">${esc(COMP_NAMES[S.comp])} // ${S.season === "ALL" ? "Since 2020-21" : esc(S.season)}</div><h1>Arsenal</h1>
    <p class="sub">${t.mp} matches${posTxt ? ` · ${posTxt} in the table` : ""}</p>
    <div class="bignums">
      <div class="bignum"><div class="v">${t.w}<small>W</small> ${t.d}<small>D</small> ${t.l}<small>L</small></div><div class="l">Record</div></div>
      ${S.comp === "PL" && S.season !== "ALL" ? `<div class="bignum"><div class="v">${t.pts}</div><div class="l">Points</div></div>` : ""}
      <div class="bignum"><div class="v">${t.f.goals}<small>:</small>${t.a.goals}</div><div class="l">Goals for : against</div></div>
      ${t.xgm ? `<div class="bignum"><div class="v">${t.f.xg.toFixed(1)}<small>:</small>${t.a.xg.toFixed(1)}</div><div class="l">xG for : against</div></div>` : ""}
    </div></section>`;
  h += tiles([
    [pm("f", "sh")?.toFixed(1), "Shots per match", `${pm("a", "sh")?.toFixed(1)} conceded`],
    [pm("f", "sot")?.toFixed(1), "On target per match", `${pm("a", "sot")?.toFixed(1)} conceded`],
    [(t.f.goals / t.mp).toFixed(2), "Goals per match", `${(t.a.goals / t.mp).toFixed(2)} conceded`, 1],
    [t.xgm ? (t.f.xg / t.xgm).toFixed(2) : "n/a", "xG per match", t.xgm ? `${(t.a.xg / t.xgm).toFixed(2)} against` : "current PL season only"],
    [t.poss != null ? t.poss.toFixed(1) + "%" : "n/a", "Possession", "average"],
    [t.f.pass ? ((100 * t.f.passacc) / t.f.pass).toFixed(1) + "%" : "n/a", "Pass accuracy", ""],
  ]);
  // recent form
  const last = ms.slice(-10).reverse();
  h += sec("01", "Form") + `<div class="form">${last.map((m) => `<div class="hud fm" data-tip="${esc(`<b>${m.ha === "home" ? "vs" : "at"} ${esc(m.opp.name)}</b>${dateStr(m.date)} · ${m.comp}`)}">${badge(m.opp.id, m.opp.name)}<span class="res ${m.res}">${m.res}</span><span class="sc">${m.gf}-${m.ga}</span><span class="d">${new Date(m.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span></div>`).join("")}</div>`;
  const keys = [["goals", "Goals"], ["sh", "Shots"], ["sot", "On target"]];
  if (t.xgm) keys.splice(1, 0, ["xg", "xG"]);
  const mk = keys.some((k) => k[0] === store.get("mbKey")) ? store.get("mbKey") : "goals";
  const show = ms.slice(-60);
  h += sec("02", "Match by match") + `<div class="ctl">${toggle("mb", keys, mk)}${ms.length > 60 ? '<span class="note">Latest 60 matches</span>' : ""}</div>`;
  h += `<div class="hud chart"><div class="legend"><span><i style="background:var(--s1)"></i>Arsenal ▲</span><span><i style="background:var(--s2)"></i>Opponent ▼</span></div>${matchBars(show, mk, keys.find((k) => k[0] === mk)[1])}</div>`;
  if (S.season === "ALL") h += seasonTable(ms);
  else if (S.comp !== "ALL") h += await leagueSection(S.comp, S.season);
  else h += `<p class="note">Pick a single competition to compare Arsenal with other teams.</p>`;
  $("#app").innerHTML = h;
  onToggle("mb", (v) => { store.set("mbKey", v); viewTeam(); });
  wireLeague();
}
function seasonTable(ms) {
  const groups = {};
  for (const m of ms) (groups[`${m.season}|${m.comp}`] ||= []).push(m);
  const rows = Object.entries(groups).map(([k, g]) => {
    const a = aggTeam(g), [season, comp] = k.split("|");
    return { season, comp, mp: a.mp, w: a.w, d: a.d, l: a.l, pts: comp === "PL" ? a.pts : null, gf: a.f.goals, ga: a.a.goals,
      sh: teamVal(a, TSTATS[4]), sha: teamVal(a, TSTATS[5]), sot: teamVal(a, TSTATS[6]), poss: a.poss, xg: a.xgm ? a.f.xg : null, xga: a.xgm ? a.a.xg : null };
  });
  return sec("03", "Season by season") + table([
    { k: "season", l: "Season", left: 1 }, { k: "comp", l: "Comp", left: 1 },
    { k: "mp", l: "P" }, { k: "w", l: "W" }, { k: "d", l: "D" }, { k: "l", l: "L" }, { k: "pts", l: "Pts" },
    { k: "gf", l: "GF" }, { k: "ga", l: "GA" }, { k: "xg", l: "xG", f: (r) => fmtd(r.xg, 1) }, { k: "xga", l: "xGA", f: (r) => fmtd(r.xga, 1) },
    { k: "sh", l: "Shots/m", f: (r) => fmtd(r.sh, 1) }, { k: "sha", l: "Conceded/m", f: (r) => fmtd(r.sha, 1) },
    { k: "sot", l: "On target/m", f: (r) => fmtd(r.sot, 1) }, { k: "poss", l: "Poss %", f: (r) => fmtd(r.poss, 1) },
  ], rows, { sort: "season" });
}
let wireLeague = () => {};
async function leagueSection(comp, season) {
  const L = await league(comp, season);
  if (!L) return `<p class="note">League comparison data is not available for this season yet.</p>`;
  const teams = L.teams;
  const avail = TSTATS.filter((d) => teams.some((t) => teamVal(t, d) != null));
  const rk = avail.find((d) => tkey(d) === store.get("rkKey")) || avail[0];
  const top = comp === "UCL" ? 20 : 20;
  let rows = teams.map((t) => ({ id: t.id, name: t.name, v: teamVal(t, rk) }));
  rows.sort((a, b) => ((b.v ?? -1e9) - (a.v ?? -1e9)) * (rk.low ? -1 : 1));
  rows.forEach((r, i) => { r.rank = i + 1; });
  if (rows.length > top) {
    const ars = rows.find((r) => r.id === ARSENAL);
    rows = rows.slice(0, top);
    if (ars && !rows.includes(ars)) rows.push(ars);
  }
  const dec = rk.k === "poss" || rk.k === "passpct" ? 1 : 2;
  let h = sec("03", `Arsenal vs the ${comp === "PL" ? "league" : "competition"}`);
  h += `<div class="ctl"><label>Stat (per match)<select id="rk-sel">${avail.map((d) => `<option value="${tkey(d)}" ${d === rk ? "selected" : ""}>${esc(d.l)}</option>`).join("")}</select></label>`;
  h += `<span class="note">${rk.low ? "Lower is better; best at the top." : "Highest at the top."}${teams.length > top ? ` Top ${top} of ${teams.length}, plus Arsenal.` : ""}</span></div>`;
  h += `<div class="hud chart">${rankBars(rows, { label: rk.l + " per match", d: dec, total: teams.length })}</div>`;

  // head to head with up to two other clubs
  const hkey = `h2hTeams_${comp}_${season}`;
  let picks = [];
  try { picks = JSON.parse(store.get(hkey) || "[]"); } catch (e) { picks = []; }
  picks = picks.filter((id) => id !== ARSENAL && teams.some((t) => t.id === id));
  if (!picks.length) picks = teams.filter((t) => t.id !== ARSENAL).slice(0, 1).map((t) => t.id);
  const ents = [ARSENAL, ...picks].filter((id) => teams.some((t) => t.id === id)).map((id, i) => {
    const t = teams.find((x) => x.id === id); const vals = {};
    avail.forEach((d) => { vals[tkey(d)] = teamVal(t, d); });
    return { id, name: t.name, color: PCOL[i], vals };
  });
  const metrics = avail.map((d) => ({ k: tkey(d), l: d.l, low: d.low, d: d.calc ? 1 : 2 }));
  h += sec("04", "Head to head");
  h += `<div class="hud h2h"><div class="h2h-heads" style="grid-template-columns:repeat(${ents.length},minmax(0,1fr))">${ents.map((e, i) => `<div class="h2h-head" style="--pc:${e.color}">${badge(e.id, e.name, "lg")}<div><div class="nm">${esc(teamInfo(e.id, e.name).short)}</div><div class="sub2">${(() => { const t = teams.find((x) => x.id === e.id); return `${t.w}-${t.d}-${t.l}${comp === "PL" ? ` · ${t.pts} pts` : ""}`; })()}</div></div>${i ? `<button class="x" data-rmteam="${e.id}" aria-label="Remove">×</button>` : ""}</div>`).join("")}</div>
    <div class="ctl" style="margin-top:0">${ents.length < 3 ? `<label>Add a club<select id="h2h-add"><option value="">Choose…</option>${teams.filter((t) => !ents.some((e) => e.id === t.id)).map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label>` : ""}<span class="note">Per match. The leader on each stat glows.</span></div>
    <div class="h2h-rows">${h2hRows(ents, metrics)}</div></div>`;

  const cols = [{ k: "name", l: "Club", left: 1, f: (r) => `<span class="tm">${badge(r.id, r.name, "sm")}${esc(teamInfo(r.id, r.name).short)}</span>` }, { k: "mp", l: "P" }, { k: "w", l: "W" }, { k: "d", l: "D" }, { k: "l", l: "L" }];
  if (comp === "PL") cols.push({ k: "pts", l: "Pts" });
  for (const d of avail) cols.push({ k: tkey(d), l: d.l, sv: (r) => teamVal(r, d), f: (r) => fmtd(teamVal(r, d), d.calc ? 1 : 2) });
  h += sec("05", "All clubs, per match") + table(cols, teams, { sort: comp === "PL" ? "pts" : "w", hl: (r) => r.id === ARSENAL });
  wireLeague = () => {
    const el = $("#rk-sel"); if (el) el.addEventListener("change", () => { store.set("rkKey", el.value); viewTeam(); });
    const add = $("#h2h-add"); if (add) add.addEventListener("change", () => { if (add.value) { store.set(hkey, JSON.stringify([...picks, add.value].slice(-2))); viewTeam(); } });
    document.querySelectorAll("[data-rmteam]").forEach((b) => b.addEventListener("click", () => { store.set(hkey, JSON.stringify(picks.filter((id) => id !== b.dataset.rmteam))); viewTeam(); }));
  };
  return h;
}

// ---------- PLAYERS (leaderboard + head to head) ----------
async function viewPlayers() {
  const pool = store.get("pool") || "ars";
  const per90 = store.get("per90") === "1";
  const statK = STAT[store.get("stat")] ? store.get("stat") : "g";
  const stat = STAT[statK];
  const pos = store.get("posF") || "ALL";
  const minMin = +(store.get("minMin") ?? 0);
  const arsById = Object.fromEntries(S.players.map((p) => [p.id, p]));
  let ents, scopeTxt, scopeNote = "";
  if (pool === "ars") {
    ents = S.players.map((p) => aggPlayer(p, inScope)).filter((a) => a.apps > 0);
    scopeTxt = `Arsenal squad · ${scopeLabel()}`;
  } else {
    const sc = singleScope();
    const L = await league(sc.comp, sc.season);
    ents = L ? L.players.map((r) => fromLeague(r, arsById)) : [];
    scopeTxt = `All ${COMP_NAMES[sc.comp]} players · ${sc.season}`;
    if (S.comp === "ALL" || S.season === "ALL") scopeNote = "League-wide boards need one competition and season, so this uses the one shown.";
  }
  const pinKey = "pins_" + pool;
  let pins = [];
  try { pins = JSON.parse(store.get(pinKey) || "[]"); } catch (e) { pins = []; }
  pins = pins.filter((k) => ents.some((e) => e.key === k));
  if (!pins.length && !store.get(pinKey + "_set")) {
    pins = ents.filter((e) => e.tid === ARSENAL && e.grp !== "GK").sort((x, y) => ((y.g || 0) + (y.a || 0)) - ((x.g || 0) + (x.a || 0)) || y.min - x.min).slice(0, 2).map((e) => e.key);
  }

  const ranked = ents.filter((e) => (pos === "ALL" || e.grp === pos) && e.min >= minMin)
    .map((e) => ({ e, v: statVal(e, stat, per90) })).filter((r) => r.v != null)
    .sort((a, b) => (stat.low ? a.v - b.v : b.v - a.v) || b.e.min - a.e.min);
  const shown = +(store.get("shown") || 24);
  const max = Math.max(...ranked.map((r) => r.v), 0.0001);
  const groups = [...new Set(PSTATS.map((s) => s.grp))];
  const avail = (s) => ents.some((e) => statVal(e, s, false) != null && (!s.fpl || e.fmin));

  let h = `<section class="hero"><div class="kicker">Player stats // ${esc(scopeTxt)}</div><h1>Players</h1><p class="sub">Pick a stat to rank players. Pin up to three to put them head to head.</p></section>`;
  h += `<div class="ctl">
    ${toggle("pool", [["ars", "Arsenal"], ["lg", "Whole league"]], pool)}
    <label>Stat<select id="stat-sel">${groups.map((g) => `<optgroup label="${g}">${PSTATS.filter((s) => s.grp === g && avail(s)).map((s) => `<option value="${s.k}" ${s.k === statK ? "selected" : ""}>${esc(s.l)}</option>`).join("")}</optgroup>`).join("")}</select></label>
    ${toggle("p90", [["0", "Total"], ["1", "Per 90"]], per90 ? "1" : "0")}
    ${toggle("pos", [["ALL", "All"], ["GK", "GK"], ["DEF", "DEF"], ["MID", "MID"], ["FWD", "FWD"]], pos)}
    <label>Min. minutes<select id="minmin" style="min-width:110px">${[0, 90, 270, 450, 900, 1800].map((v) => `<option ${v === minMin ? "selected" : ""}>${v}</option>`).join("")}</select></label>
  </div>`;
  if (scopeNote) h += `<p class="note">${scopeNote}</p>`;
  if (stat.fpl) h += `<p class="note">${esc(stat.l)} comes from Fantasy Premier League data: Premier League only${["xg", "xa"].includes(stat.k) ? ", per match this season and season totals from 2022-23" : ", current season only"}. Per 90 uses only the minutes it covers.</p>`;

  // head to head
  const pinned = pins.map((k, i) => ({ ...ents.find((e) => e.key === k), color: PCOL[i] }));
  if (pinned.length) {
    const anyGK = pinned.some((p) => p.grp === "GK");
    const metrics = H2H_STATS.map((k) => STAT[k]).filter((s) => (anyGK || !s.gk) && pinned.some((p) => statVal(p, s, per90 && !s.base) != null))
      .map((s) => ({ k: s.k, l: s.base ? s.l : s.l + (per90 ? " /90" : ""), low: s.low || ["fc", "yc", "gc"].includes(s.k), d: decs(s, per90) }));
    pinned.forEach((p) => { p.vals = {}; metrics.forEach((m) => { p.vals[m.k] = statVal(p, STAT[m.k], per90 && !STAT[m.k].base); }); });
    h += sec("01", "Head to head") + `<div class="hud h2h"><div class="h2h-heads" style="grid-template-columns:repeat(${pinned.length},minmax(0,1fr))">${pinned.map((p) => `<div class="h2h-head" style="--pc:${p.color}">${kit(p)}<div><a class="nm" href="#/player/${p.tid === ARSENAL ? p.id : ""}" ${p.tid === ARSENAL ? "" : 'onclick="return false"'}>${esc(p.name)}</a><div class="sub2">${badge(p.tid, p.team, "sm")} ${esc(teamInfo(p.tid, p.team).short)} · ${p.grp} · ${p.min} min</div></div><button class="x" data-unpin="${esc(p.key)}" aria-label="Remove">×</button></div>`).join("")}</div>
      <div class="h2h-rows">${h2hRows(pinned, metrics)}</div></div>`;
  } else {
    h += `<p class="note">Pin players below to compare them head to head.</p>`;
  }

  h += sec(pinned.length ? "02" : "01", `${stat.l}${per90 && !stat.base ? " per 90" : ""} · leaderboard`);
  if (!ranked.length) h += `<p class="note">No players with this stat in this selection.</p>`;
  h += `<div class="board">${ranked.slice(0, shown).map((r, i) => {
    const e = r.e, on = pins.includes(e.key), link = e.tid === ARSENAL;
    return `<div class="hud pcard ${i === 0 ? "top1" : ""}"><span class="rk">#${String(i + 1).padStart(2, "0")}</span>${kit(e)}
      <div><a class="nm" ${link ? `href="#/player/${e.id}"` : ""}>${esc(e.name)}</a><div class="meta">${badge(e.tid, e.team, "sm")}<span>${esc(teamInfo(e.tid, e.team).short)}</span><span>· ${e.grp}</span></div></div>
      <div class="val"><b>${r.v.toFixed(decs(stat, per90))}</b><span>${e.apps} apps<br>${e.min} min</span></div>
      <div class="meter"><i style="width:${Math.max(1, (100 * r.v) / max)}%"></i></div>
      <button class="pin ${on ? "on" : ""}" data-pin="${esc(e.key)}">${on ? "◆ Pinned" : "◇ Compare"}</button></div>`;
  }).join("")}</div>`;
  if (ranked.length > shown) h += `<div class="ctl" style="justify-content:center;margin-top:18px"><button class="btn" id="more">Show more (${ranked.length - shown} left)</button></div>`;
  $("#app").innerHTML = h;

  const savePins = (p) => { store.set(pinKey, JSON.stringify(p)); store.set(pinKey + "_set", "1"); viewPlayers(); };
  document.querySelectorAll("[data-pin]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.pin;
    savePins(pins.includes(k) ? pins.filter((x) => x !== k) : [...pins, k].slice(-3));
  }));
  document.querySelectorAll("[data-unpin]").forEach((b) => b.addEventListener("click", () => savePins(pins.filter((x) => x !== b.dataset.unpin))));
  onToggle("pool", (v) => { store.set("pool", v); store.set("shown", 24); viewPlayers(); });
  onToggle("p90", (v) => { store.set("per90", v); if (v === "1" && minMin < 270) store.set("minMin", 270); viewPlayers(); });
  onToggle("pos", (v) => { store.set("posF", v); viewPlayers(); });
  $("#stat-sel").addEventListener("change", (e) => { store.set("stat", e.target.value); viewPlayers(); });
  $("#minmin").addEventListener("change", (e) => { store.set("minMin", e.target.value); viewPlayers(); });
  const more = $("#more"); if (more) more.addEventListener("click", () => { store.set("shown", shown + 24); viewPlayers(); });
}

// ---------- PLAYER ----------
async function viewPlayer(id) {
  const p = S.players.find((x) => x.id === id);
  if (!p) { $("#app").innerHTML = `<p>Player not found. <a href="#/players">Back to players</a></p>`; return; }
  const a = aggPlayer(p, inScope);
  const all = aggPlayer(p, () => true);
  const first = p.matches.length ? MATCH_BY_ID[p.matches[0].m] : null;
  const posName = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" }[p.grp];
  let h = `<section class="hero">${p.no ? `<div class="no-big">${esc(p.no)}</div>` : ""}<div class="phero">${kit({ ...p, tid: ARSENAL }, "lg")}<div>
    <div class="kicker"><a href="#/players" style="text-decoration:none">◂ Players</a> // ${esc(posName)}</div><h1 style="font-size:clamp(38px,6vw,76px)">${esc(p.name)}</h1>
    <div class="chips">${p.no ? `<span class="chip">No. ${esc(p.no)}</span>` : ""}${p.nat ? `<span class="chip">${esc(p.nat)}</span>` : ""}${p.age ? `<span class="chip">Age ${esc(p.age)}</span>` : ""}<span class="chip">${all.apps} apps since ${first ? new Date(first.date).getFullYear() : 2020}</span><button class="chip" id="cmp-me" style="cursor:pointer;color:#fff;background:var(--neon);border-color:var(--neon)">◇ Compare</button></div>
  </div></div></section>`;
  h += `<p class="note" style="margin-top:-10px">Selection: ${esc(scopeLabel())}</p>`;
  const t = [[a.apps, "Appearances", `${a.starts} starts`], [a.min, "Minutes", ""], [a.g || 0, "Goals", a.min ? `${((90 * (a.g || 0)) / a.min).toFixed(2)} per 90` : "", 1],
    [a.a || 0, "Assists", a.min ? `${((90 * (a.a || 0)) / a.min).toFixed(2)} per 90` : ""],
    [a.fmin ? (a.xg || 0).toFixed(2) : "n/a", "xG", a.fmin ? `over ${a.fmin} PL min` : "not available here"],
    [a.fmin ? (a.xa || 0).toFixed(2) : "n/a", "xA", ""], [a.sh || 0, "Shots", `${a.sot || 0} on target`]];
  if (p.grp === "GK") t.push([a.sv || 0, "Saves", `${a.gc || 0} conceded`]);
  h += tiles(t);

  // percentiles
  const sc1 = singleScope();
  const L = await league(sc1.comp, sc1.season);
  h += sec("01", `Percentiles vs ${p.grp === "GK" ? "goalkeepers" : { DEF: "defenders", MID: "midfielders", FWD: "forwards" }[p.grp]} · ${COMP_NAMES[sc1.comp]} ${sc1.season}`);
  const arsById = Object.fromEntries(S.players.map((x) => [x.id, x]));
  if (L) {
    const rows = L.players.map((r) => fromLeague(r, arsById));
    const me = rows.find((r) => r.id === p.id && r.tid === ARSENAL);
    const peers = rows.filter((r) => r.grp === p.grp && r.min >= 450);
    if (!me || me.min < 450) {
      h += `<p class="note">Needs at least 450 Arsenal minutes in this competition and season (has ${me ? me.min : 0}). Change the filters above to pick another season.</p>`;
    } else {
      h += `<div class="hud pad"><div class="pct">`;
      for (const k of p.grp === "GK" ? GK_PCT : PCT_STATS) {
        const s = STAT[k];
        const mv = statVal(me, s, true);
        const pv = peers.map((r) => statVal(r, s, true)).filter((v) => v != null);
        if (mv == null || pv.length < 10) continue;
        const less = pv.filter((v) => v < mv).length, eq = pv.filter((v) => v === mv).length;
        let pct = Math.round((100 * (less + eq / 2)) / pv.length);
        if (s.low) pct = 100 - pct;
        const on = Math.round(pct / 5);
        h += `<div class="lab">${esc(s.l)}</div><div class="seg" data-tip="${esc(`<b>${esc(s.l)} per 90</b>${mv.toFixed(2)}; better than ${pct}% of ${pv.length} ${p.grp} with 450+ minutes`)}">${Array.from({ length: 20 }, (_, i) => `<i class="${i < on ? "on" : ""}"></i>`).join("")}</div><div class="n">${pct}<small>th · ${mv.toFixed(2)}</small></div>`;
      }
      h += `</div><p class="note">Per 90 minutes; peers are players in the same position group with 450+ minutes. ${sc1.comp === "PL" ? "xG, xA and defensive stats use Fantasy Premier League data." : "Champions League data has no xG or defensive actions."}</p></div>`;
    }
  } else h += `<p class="note">No league data for this season.</p>`;

  // season by season
  const groups = {};
  for (const r of p.matches) { const m = MATCH_BY_ID[r.m]; if (m) groups[`${m.season}|${m.comp}`] = 1; }
  for (const s of Object.keys(p.past_xg || {})) groups[`${s}|PL`] = 1;
  const srows = Object.keys(groups).map((k) => {
    const [season, comp] = k.split("|");
    return { season, comp, ...aggPlayer(p, (m) => m.season === season && m.comp === comp) };
  }).filter((r) => r.apps > 0);
  srows.push({ ...all, season: "Total", comp: "All", total: 1 });
  const sc = PSTATS.filter((s) => !s.base && (p.grp === "GK" || !s.gk) && s.k !== "rc" && (s.fpl ? all.fmin : true));
  h += sec("02", "Season by season · Arsenal only") + table([
    { k: "season", l: "Season", left: 1, f: (r) => (r.total ? "<b>Since 2020-21</b>" : r.season), sv: (r) => (r.total ? "0000" : r.season) },
    { k: "comp", l: "Comp", left: 1 }, { k: "apps", l: "Apps" }, { k: "starts", l: "Starts" }, { k: "min", l: "Min" },
    ...sc.map((s) => ({ k: s.k, l: s.short || s.l, sv: (r) => statVal(r, s, false), f: (r) => fmtd(statVal(r, s, false), decs(s, false)) })),
  ], srows, { sort: "season", hl: (r) => r.total });
  h += `<p class="note">xG and xA cover Premier League seasons from 2022-23 (counted only when the whole season was at Arsenal). Tackles, clearances/blocks/interceptions, recoveries and defensive contributions cover the current Premier League season only.</p>`;

  const log = p.matches.filter((r) => MATCH_BY_ID[r.m] && inScope(MATCH_BY_ID[r.m])).slice().reverse();
  const M = (r) => MATCH_BY_ID[r.m];
  h += sec("03", `Match log · ${scopeLabel()}`) + table([
    { k: "date", l: "Date", left: 1, sv: (r) => M(r).date, f: (r) => dateStr(M(r).date) },
    { k: "opp", l: "Opponent", left: 1, sv: (r) => M(r).opp.name, f: (r) => `<span class="tm">${badge(M(r).opp.id, M(r).opp.name, "sm")}${M(r).ha === "home" ? "vs" : "at"} ${esc(teamInfo(M(r).opp.id, M(r).opp.name).short)}</span>` },
    { k: "comp", l: "Comp", left: 1, sv: (r) => M(r).comp, f: (r) => M(r).comp },
    { k: "res", l: "Result", left: 1, sv: (r) => M(r).res, f: (r) => `<span class="res ${M(r).res}">${M(r).res}</span> ${M(r).gf}-${M(r).ga}` },
    { k: "min", l: "Min" }, { k: "g", l: "G", f: (r) => r.g || 0 }, { k: "a", l: "A", f: (r) => r.a || 0 },
    { k: "sh", l: "Shots", f: (r) => r.sh || 0 }, { k: "sot", l: "On target", f: (r) => r.sot || 0 },
    { k: "xg", l: "xG", f: (r) => (r.f ? (r.xg || 0).toFixed(2) : NA) }, { k: "xa", l: "xA", f: (r) => (r.f ? (r.xa || 0).toFixed(2) : NA) },
  ], log, { sort: "date" });
  $("#app").innerHTML = h;
  $("#cmp-me").addEventListener("click", () => {
    let pins = [];
    try { pins = JSON.parse(store.get("pins_ars") || "[]"); } catch (e) { pins = []; }
    const k = "a:" + p.id;
    if (!pins.includes(k)) pins = [...pins, k].slice(-3);
    store.set("pins_ars", JSON.stringify(pins)); store.set("pins_ars_set", "1"); store.set("pool", "ars");
    location.hash = "#/players";
  });
}

// ---------- MATCHES ----------
function viewMatches() {
  const ms = S.matches.filter(inScope).slice().reverse();
  const rowsByMatch = {};
  for (const p of S.players) for (const r of p.matches) (rowsByMatch[r.m] ||= []).push({ ...r, name: p.name, id: p.id, no: p.no });
  let h = `<section class="hero"><div class="kicker">Results // ${esc(scopeLabel())}</div><h1>Matches</h1><p class="sub">${ms.length} matches · open one for the full breakdown</p></section>`;
  h += ms.map((m) => {
    const lines = TSTATS.filter((d) => d.side === "f" || d.k === "poss").filter((d) => d.k !== "goals").map((d) => {
      const f = d.k === "poss" ? m.poss : m.f[d.k], a = d.k === "poss" ? (m.poss != null ? 100 - m.poss : null) : m.a[d.k];
      if (f == null && a == null) return "";
      const tot = (f || 0) + (a || 0), pf = tot ? (100 * (f || 0)) / tot : 50;
      const dd = d.k === "xg" || d.k === "poss" ? 1 : 0;
      return `<tr><td class="l">${fmtd(f ?? null, dd)}</td><td style="text-align:center;width:46%"><div style="font:600 11px var(--display);letter-spacing:.12em;text-transform:uppercase;color:var(--ink-2);margin-bottom:4px">${esc(d.l)}</div><div style="display:flex;height:6px;gap:3px"><i style="flex:${pf};background:var(--s1);box-shadow:0 0 8px var(--neon-glow)"></i><i style="flex:${100 - pf};background:var(--s2)"></i></div></td><td>${fmtd(a ?? null, dd)}</td></tr>`;
    }).join("");
    const pr = (rowsByMatch[m.id] || []).sort((x, y) => y.st - x.st || y.min - x.min);
    const plines = pr.map((r) => `<tr><td class="l"><a href="#/player/${r.id}">${r.no ? `<span class="muted">${esc(r.no)}</span> ` : ""}${esc(r.name)}</a></td><td>${r.st ? "XI" : "Sub"}</td><td>${r.min}'</td><td>${r.g || 0}</td><td>${r.a || 0}</td><td>${r.sh || 0}</td><td>${r.sot || 0}</td><td>${r.f ? (r.xg || 0).toFixed(2) : NA}</td></tr>`).join("");
    return `<details class="hud match"><summary><span class="comp">${dateStr(m.date)}</span><span class="res ${m.res}">${m.res}</span><span class="opp"><b>${m.gf}-${m.ga}</b>${badge(m.opp.id, m.opp.name)}<span>${m.ha === "home" ? "vs" : "at"} ${esc(teamInfo(m.opp.id, m.opp.name).short)}</span></span><span class="comp">${m.comp}</span><span class="hide-sm comp" style="text-align:right">${m.f.xg != null ? `xG ${m.f.xg.toFixed(1)} : ${m.a.xg.toFixed(1)}` : `Shots ${m.f.sh ?? "?"} : ${m.a.sh ?? "?"}`}</span></summary>
      <div class="body grid2"><div class="tablewrap"><table><thead><tr><th class="l">Arsenal</th><th style="text-align:center">Team stats</th><th>${esc(m.opp.abbr || m.opp.name)}</th></tr></thead><tbody>${lines}</tbody></table></div>
      <div class="tablewrap"><table><thead><tr><th class="l">Player</th><th></th><th>Min</th><th>G</th><th>A</th><th>Sh</th><th>SoT</th><th>xG</th></tr></thead><tbody>${plines}</tbody></table></div></div></details>`;
  }).join("");
  $("#app").innerHTML = h;
}

// ---------- ABOUT ----------
function viewAbout() {
  const m = S.meta;
  $("#app").innerHTML = `<section class="hero"><div class="kicker">System // Info</div><h1>About</h1><p class="sub">An unofficial, personal Arsenal stats tracker.</p></section>
  <div class="hud pad"><p>Arsenal team and player stats for the Premier League (from 2020-21) and the Champions League (from 2023-24, the first season Arsenal were back in it in this period). Player stats count Arsenal appearances only; the whole-league boards include every player.</p>
  <p><b>Updates:</b> automatically twice a day (05:00 and 12:00 IST). Last update: ${esc(m.updated)}.</p>
  <p><b>Sources:</b></p><ul>
  <li>ESPN public match data: results, team stats (shots, possession, passing, crosses, tackles, interceptions, clearances, corners, fouls), player stats (minutes, goals, assists, shots, shots on target, fouls, cards, saves), shirt numbers and club colours. Minutes come from substitution times and ignore stoppage time.</li>
  <li>Official Fantasy Premier League API: xG, xA, tackles, clearances/blocks/interceptions, recoveries and defensive contributions, Premier League only. Per match for the current season; xG and xA season totals from 2022-23 for players still in the league. Team xG is the sum of its players' xG.</li></ul>
  <p><b>Not available from free sources:</b> big chances, duels, dribbles, aerial duels, Champions League xG, and Premier League xG before 2022-23.</p>
  <p><b>Design:</b> club badges are simple shapes in each club's colours with its short name, and player cards show shirt numbers; no club crests or player photos are used.</p></div>`;
}

// ---------- routing and filters ----------
function setSeasonOptions() {
  const seasons = seasonsFor(S.comp);
  if (S.season !== "ALL" && !seasons.includes(S.season)) S.season = seasons[0];
  $("#f-season").innerHTML = seasons.map((s) => `<option value="${s}">${s}</option>`).join("") + `<option value="ALL">All seasons</option>`;
  $("#f-season").value = S.season;
}
async function route() {
  let [, view, arg] = (location.hash || "#/team").split("/");
  if (view === "compare") { location.hash = "#/players"; return; }
  view = view || "team";
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === view || (view === "player" && a.dataset.nav === "players")));
  $("#filters").style.display = view === "about" ? "none" : "";
  tip.hidden = true;
  try {
    if (view === "players") await viewPlayers();
    else if (view === "player") await viewPlayer(decodeURIComponent(arg || ""));
    else if (view === "matches") viewMatches();
    else if (view === "about") viewAbout();
    else await viewTeam();
  } catch (e) {
    console.error(e);
    $("#app").innerHTML = `<p>Something went wrong showing this page: ${esc(e.message)}</p>`;
  }
  if (view !== S.lastView) scrollTo(0, 0);
  S.lastView = view;
}
async function init() {
  try {
    [S.meta, S.matches, S.players] = await Promise.all([getJSON("data/meta.json"), getJSON("data/arsenal_matches.json"), getJSON("data/arsenal_players.json")]);
  } catch (e) {
    $("#app").innerHTML = `<p>Data is still being collected. Check back shortly.</p>`;
    return;
  }
  MATCH_BY_ID = Object.fromEntries(S.matches.map((m) => [m.id, m]));
  S.comp = store.get("comp") || "PL";
  if (!seasonsFor(S.comp).length) S.comp = "PL";
  S.season = store.get("season") || seasonsFor(S.comp)[0];
  $("#f-comp").value = S.comp;
  setSeasonOptions();
  $("#updated").innerHTML = `<i></i>Updated ${esc(S.meta.updated)}`;
  $("#f-comp").addEventListener("change", (e) => { S.comp = e.target.value; store.set("comp", S.comp); setSeasonOptions(); store.set("season", S.season); route(); });
  $("#f-season").addEventListener("change", (e) => { S.season = e.target.value; store.set("season", S.season); route(); });
  addEventListener("hashchange", route);
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(route, 250); });
  route();
}
init();
