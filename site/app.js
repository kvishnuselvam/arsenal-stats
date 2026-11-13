/* Arsenal Stats: static site reading JSON built by scripts/build_site_data.py */
"use strict";

const ARSENAL = "359";
const COMP_NAMES = { PL: "Premier League", UCL: "Champions League", ALL: "PL + UCL" };
const S = { meta: null, matches: [], players: [], league: {}, comp: "PL", season: null, view: "team" };

// ---------- stat definitions ----------
const PSTATS = [
  { k: "g", l: "Goals" }, { k: "a", l: "Assists" },
  { k: "xg", l: "xG", fpl: 1 }, { k: "xa", l: "xA", fpl: 1 },
  { k: "sh", l: "Shots" }, { k: "sot", l: "Shots on target" },
  { k: "fs", l: "Fouls won" }, { k: "fc", l: "Fouls committed" },
  { k: "ptkl", l: "Tackles", fpl: 1 }, { k: "cbi", l: "Clear./blocks/int.", fpl: 1 },
  { k: "rec", l: "Recoveries", fpl: 1 }, { k: "dc", l: "Defensive contrib.", fpl: 1 },
  { k: "yc", l: "Yellow cards" }, { k: "rc", l: "Red cards" },
  { k: "sv", l: "Saves", gk: 1 }, { k: "gc", l: "Goals conceded", gk: 1 },
];
const decs = (s, per90) => (per90 ? 2 : s.k === "xg" || s.k === "xa" ? 2 : 0);
const PCT_STATS = ["g", "a", "xg", "xa", "sh", "sot", "fs", "ptkl", "cbi", "rec"];
const GK_PCT = ["sv", "gc"];
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
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '<span class="na">n/a</span>' : Number.isInteger(v) && d < 9 ? String(v) : v.toFixed(d));
const fmtd = (v, d) => (v == null || Number.isNaN(v) ? '<span class="na">n/a</span>' : v.toFixed(d));
const dateStr = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
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
// a single competition and season, used where league-wide comparisons are needed
function singleScope() {
  const comp = S.comp === "ALL" ? "PL" : S.comp;
  const seasons = seasonsFor(comp);
  const season = S.season === "ALL" || !seasons.includes(S.season) ? seasons[0] : S.season;
  return { comp, season };
}

// ---------- aggregation ----------
function aggTeam(ms) {
  const t = { mp: 0, w: 0, d: 0, l: 0, f: {}, a: {}, poss: 0, possN: 0, xgm: 0, n: {} };
  for (const m of ms) {
    t.mp++; t[m.res.toLowerCase()]++;
    for (const side of ["f", "a"]) {
      for (const [k, v] of Object.entries(m[side] || {})) t[side][k] = (t[side][k] || 0) + v;
    }
    for (const k of Object.keys(m.f || {})) if (k !== "xg" && m.a && k in m.a) t.n[k] = (t.n[k] || 0) + 1;
    t.f.goals = (t.f.goals || 0) + m.gf; t.a.goals = (t.a.goals || 0) + m.ga;
    if (m.poss != null) { t.poss += m.poss; t.possN++; }
    if (m.f && m.f.xg != null) t.xgm++;
  }
  t.poss = t.possN ? t.poss / t.possN : null;
  t.pts = 3 * t.w + t.d;
  return t;
}
// per-match value for a team stat definition; works for Arsenal aggregates and league team rows
function teamVal(t, def) {
  if (def.k === "poss") return t.poss ?? null;
  if (def.k === "passpct") return t.f.pass ? (100 * (t.f.passacc || 0)) / t.f.pass : null;
  const n = def.k === "xg" ? t.xgm : def.k === "goals" ? t.mp : (t.n && t.n[def.k] != null ? t.n[def.k] : t.mp);
  const v = t[def.side][def.k];
  if (!n || v == null) return null;
  return v / n;
}
function aggPlayer(p, filter) {
  const a = { id: p.id, name: p.name, grp: p.grp, apps: 0, starts: 0, min: 0, fmin: 0 };
  const seasonsWithF = new Set();
  for (const r of p.matches) {
    const m = MATCH_BY_ID[r.m];
    if (!m || !filter(m)) continue;
    a.apps++; a.starts += r.st || 0; a.min += r.min;
    for (const s of PSTATS) if (!s.fpl && r[s.k]) a[s.k] = (a[s.k] || 0) + r[s.k];
    if (r.f) {
      a.fmin += r.min; seasonsWithF.add(m.season);
      for (const s of PSTATS) if (s.fpl) a[s.k] = (a[s.k] || 0) + (r[s.k] || 0);
    }
  }
  // past PL seasons: season totals from FPL (only attached when the player spent the whole season at Arsenal)
  for (const [season, px] of Object.entries(p.past_xg || {})) {
    if (seasonsWithF.has(season)) continue;
    if (!filter({ comp: "PL", season })) continue;
    a.fmin += px.min; a.xg = (a.xg || 0) + px.xg; a.xa = (a.xa || 0) + px.xa;
  }
  return a;
}
function statVal(a, s, per90) {
  const v = a[s.k];
  if (s.fpl) {
    if (!a.fmin) return null;
    if (["ptkl", "cbi", "rec", "dc"].includes(s.k) && v == null) return null;
    return per90 ? ((v || 0) * 90) / a.fmin : v || 0;
  }
  if (per90) return a.min ? ((v || 0) * 90) / a.min : null;
  return v || 0;
}
// league rows have the same short keys; defensive FPL stats only exist where FPL tracked them
function leagueVal(row, k) {
  const s = PSTATS.find((x) => x.k === k);
  if (s.fpl) {
    if (!row.fmin || (["ptkl", "cbi", "rec", "dc"].includes(k) && row[k] == null && !row.cbi && !row.rec)) return null;
    return ((row[k] || 0) * 90) / row.fmin;
  }
  return row.min ? ((row[k] || 0) * 90) / row.min : null;
}

// ---------- tooltip ----------
const tip = $("#tip");
document.addEventListener("mouseover", (e) => {
  const el = e.target.closest("[data-tip]");
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
// bar with a rounded data end; dir 1 grows up from baseline y0, -1 grows down
function vbar(x, y0, w, h, dir) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  if (dir > 0) {
    const y = y0 - h;
    return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`;
  }
  const y = y0 + h;
  return `M${x},${y0}V${y - r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y - r}V${y0}Z`;
}
function hbarPath(x0, y, w, h) {
  if (w <= 0) return "";
  const r = Math.min(4, h / 2, w);
  return `M${x0},${y}H${x0 + w - r}Q${x0 + w},${y} ${x0 + w},${y + r}V${y + h - r}Q${x0 + w},${y + h} ${x0 + w - r},${y + h}H${x0}Z`;
}
const chartW = (max) => Math.max(340, Math.min(max, (document.querySelector("main").clientWidth || max) - 26));
const nf = (v, d) => (v == null ? "n/a" : v.toFixed(Math.abs(v) >= 100 ? 0 : d));
// mirrored match-by-match bars: Arsenal value up, opponent value down
function matchBars(ms, key, label) {
  const W = chartW(1100), H = 230, top = 16, mid = 112, pad = 34;
  const vals = ms.map((m) => [key === "goals" ? m.gf : m.f[key], key === "goals" ? m.ga : m.a[key]]);
  const max = Math.max(1, ...vals.flat().filter((v) => v != null));
  const scale = (mid - top - 6) / max;
  const n = ms.length, slot = (W - pad) / Math.max(n, 1), bw = Math.max(2, Math.min(22, slot - 2));
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} per match">`;
  for (const t of [max, max / 2]) {
    const v = Math.round(t * 10) / 10;
    s += `<line x1="${pad}" x2="${W}" y1="${mid - t * scale}" y2="${mid - t * scale}" stroke="var(--grid)"/>`;
    s += `<line x1="${pad}" x2="${W}" y1="${mid + t * scale}" y2="${mid + t * scale}" stroke="var(--grid)"/>`;
    s += `<text x="${pad - 6}" y="${mid - t * scale + 4}" text-anchor="end">${v}</text><text x="${pad - 6}" y="${mid + t * scale + 4}" text-anchor="end">${v}</text>`;
  }
  ms.forEach((m, i) => {
    const x = pad + i * slot + (slot - bw) / 2;
    const [f, a] = vals[i];
    if (f != null) s += `<path d="${vbar(x, mid - 1, bw, f * scale, 1)}" fill="var(--s1)"/>`;
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
// ranked horizontal bars, highlighted ids in series colours, others neutral
function rankBars(rows, opts) {
  const W = chartW(760), rh = 22, lw = W < 520 ? 128 : 170, vw = 60, H = rows.length * rh + 6;
  const max = Math.max(...rows.map((r) => r.v ?? 0), 0.0001);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.label)} ranking">`;
  rows.forEach((r, i) => {
    const y = i * rh + 3, w = ((r.v ?? 0) / max) * (W - lw - vw - 10);
    s += `<g data-tip="${esc(`<b>${esc(r.name)}</b>${esc(opts.label)}: ${r.v == null ? "n/a" : r.v.toFixed(opts.d ?? 2)}<br>Rank ${i + 1} of ${rows.length}`)}">`;
    s += `<rect x="0" y="${y - 2}" width="${W}" height="${rh}" fill="transparent"/>`;
    s += `<text class="lab" x="${lw - 8}" y="${y + 13}" text-anchor="end" ${r.color ? 'font-weight="700"' : ""}>${esc(r.name)}</text>`;
    s += `<path d="${hbarPath(lw, y + 2, w, rh - 8)}" fill="${r.color || "var(--other)"}"/>`;
    s += `<text class="val" x="${lw + w + 6}" y="${y + 13}">${r.v == null ? "n/a" : r.v.toFixed(opts.d ?? 2)}</text></g>`;
  });
  s += `<line x1="${lw}" x2="${lw}" y1="0" y2="${H}" stroke="var(--axis)"/>`;
  return s + "</svg>";
}
// small multiples: one block per metric, one bar per entity
function compareBars(entities, metrics) {
  const W = 360, rh = 20, lw = 0, H = entities.length * rh + 4;
  return metrics.map((m) => {
    const vals = entities.map((e) => e.vals[m.k]);
    const max = Math.max(...vals.filter((v) => v != null), 0.0001);
    let s = `<div class="card"><div style="font-weight:600;font-size:13px;margin-bottom:6px">${esc(m.l)}</div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.l)}">`;
    entities.forEach((e, i) => {
      const v = vals[i], y = i * rh + 2, w = v == null ? 0 : (v / max) * (W - 70);
      s += `<g data-tip="${esc(`<b>${esc(e.name)}</b>${esc(m.l)}: ${nf(v, m.d ?? 2)}`)}"><rect x="0" y="${y - 1}" width="${W}" height="${rh}" fill="transparent"/>`;
      s += `<path d="${hbarPath(lw, y + 2, w, rh - 8)}" fill="${e.color}"/>`;
      s += `<text class="val" x="${w + 6}" y="${y + 13}">${nf(v, m.d ?? 2)}</text></g>`;
    });
    return s + "</svg></div>";
  }).join("");
}

// ---------- sortable tables ----------
function table(cols, rows, opts = {}) {
  const id = "t" + Math.random().toString(36).slice(2, 8);
  const state = { k: opts.sort || null, asc: false };
  const render = () => {
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
    const body = rs.map((r) => `<tr class="${opts.hl && opts.hl(r) ? "hl" : ""}">${cols.map((c) => `<td class="${c.left ? "l" : ""}">${c.f ? c.f(r) : fmt(r[c.k])}</td>`).join("")}</tr>`).join("");
    document.getElementById(id).innerHTML = `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    document.querySelectorAll(`#${id} th`).forEach((th) => th.addEventListener("click", () => {
      const k = th.dataset.k;
      if (state.k === k) state.asc = !state.asc; else { state.k = k; state.asc = !!(cols.find((c) => c.k === k).left); }
      render();
    }));
  };
  setTimeout(render, 0);
  return `<div class="tablewrap" id="${id}"></div>`;
}
function toggle(name, options, value) {
  return `<span class="toggle" data-toggle="${name}">${options.map(([v, l]) => `<button data-v="${v}" class="${v === value ? "on" : ""}">${esc(l)}</button>`).join("")}</span>`;
}
function onToggle(name, fn) {
  document.querySelectorAll(`[data-toggle="${name}"] button`).forEach((b) => b.addEventListener("click", () => fn(b.dataset.v)));
}

// ---------- views ----------
let MATCH_BY_ID = {};

async function viewTeam() {
  const ms = S.matches.filter(inScope);
  const t = aggTeam(ms);
  const pm = (side, k) => teamVal(t, { k, side });
  let h = `<h1>Arsenal</h1><p class="sub">${esc(scopeLabel())} · ${t.mp} matches</p>`;
  if (!t.mp) { $("#app").innerHTML = h + `<p class="muted">No matches in this selection yet.</p>`; return; }
  const tiles = [
    [`${t.w}-${t.d}-${t.l}`, "Won-drawn-lost", S.comp === "PL" && S.season !== "ALL" ? `${t.pts} points` : ""],
    [`${t.f.goals}-${t.a.goals}`, "Goals for-against", `${(t.f.goals / t.mp).toFixed(2)} scored per match`],
    t.xgm ? [`${t.f.xg.toFixed(1)}-${t.a.xg.toFixed(1)}`, "xG for-against", `PL only, ${t.xgm} of ${t.mp} matches`] : ["n/a", "xG for-against", "xG only for the current PL season"],
    [pm("f", "sh")?.toFixed(1), "Shots per match", `${pm("a", "sh")?.toFixed(1)} conceded`],
    [pm("f", "sot")?.toFixed(1), "On target per match", `${pm("a", "sot")?.toFixed(1)} conceded`],
    [t.poss != null ? t.poss.toFixed(1) + "%" : "n/a", "Average possession", ""],
    [t.f.pass ? ((100 * t.f.passacc) / t.f.pass).toFixed(1) + "%" : "n/a", "Pass accuracy", ""],
  ];
  h += `<div class="tiles">${tiles.map(([v, l, x]) => `<div class="tile"><div class="v">${v ?? "n/a"}</div><div class="l">${l}</div><div class="x">${x}</div></div>`).join("")}</div>`;
  const keys = [["goals", "Goals"], ["sh", "Shots"], ["sot", "Shots on target"]];
  if (t.xgm) keys.splice(1, 0, ["xg", "xG"]);
  const mk = store.get("mbKey") && keys.some((k) => k[0] === store.get("mbKey")) ? store.get("mbKey") : "goals";
  const show = ms.slice(-60);
  h += `<h2>Match by match</h2><div class="row">${toggle("mb", keys, mk)}${ms.length > 60 ? '<span class="note">Showing the latest 60 matches</span>' : ""}</div>`;
  h += `<div class="chart"><div class="legend"><span><i style="background:var(--s1)"></i>Arsenal (up)</span><span><i style="background:var(--s2)"></i>Opponent (down)</span></div>${matchBars(show, mk, keys.find((k) => k[0] === mk)[1])}</div>`;

  if (S.season === "ALL") {
    const groups = {};
    for (const m of ms) (groups[`${m.season}|${m.comp}`] ||= []).push(m);
    const rows = Object.entries(groups).map(([k, g]) => {
      const a = aggTeam(g), [season, comp] = k.split("|");
      return { season, comp, mp: a.mp, w: a.w, d: a.d, l: a.l, pts: comp === "PL" ? a.pts : null, gf: a.f.goals, ga: a.a.goals,
        sh: teamVal(a, TSTATS[4]), sha: teamVal(a, TSTATS[5]), sot: teamVal(a, TSTATS[6]), poss: a.poss, xg: a.xgm ? a.f.xg : null, xga: a.xgm ? a.a.xg : null };
    });
    h += `<h2>Season by season</h2>` + table([
      { k: "season", l: "Season", left: 1, f: (r) => r.season }, { k: "comp", l: "Comp", left: 1, f: (r) => r.comp },
      { k: "mp", l: "P" }, { k: "w", l: "W" }, { k: "d", l: "D" }, { k: "l", l: "L" }, { k: "pts", l: "Pts" },
      { k: "gf", l: "GF" }, { k: "ga", l: "GA" }, { k: "xg", l: "xG", f: (r) => fmtd(r.xg, 1) }, { k: "xga", l: "xGA", f: (r) => fmtd(r.xga, 1) },
      { k: "sh", l: "Shots/m", f: (r) => fmtd(r.sh, 1) }, { k: "sha", l: "Conceded/m", f: (r) => fmtd(r.sha, 1) },
      { k: "sot", l: "On target/m", f: (r) => fmtd(r.sot, 1) }, { k: "poss", l: "Poss %", f: (r) => fmtd(r.poss, 1) },
    ], rows, { sort: "season" });
  } else if (S.comp !== "ALL") {
    h += await leagueSection(S.comp, S.season);
  } else {
    h += `<p class="note">Pick a single competition to compare Arsenal with the other teams.</p>`;
  }
  $("#app").innerHTML = h;
  onToggle("mb", (v) => { store.set("mbKey", v); viewTeam(); });
  onToggle("rk", (v) => { store.set("rkKey", v); viewTeam(); });
}

async function leagueSection(comp, season) {
  const L = await league(comp, season);
  if (!L) return `<p class="note">League comparison data is not available for this season yet.</p>`;
  const teams = L.teams.map((t) => ({ ...t, possN: 1 }));
  const avail = TSTATS.filter((d) => teams.some((t) => teamVal(t, d) != null));
  const rk = avail.find((d) => tkey(d) === store.get("rkKey")) || avail[0];
  const top = comp === "UCL" ? 24 : 20;
  let rows = teams.map((t) => ({ id: t.id, name: t.name, v: teamVal(t, rk) }));
  rows.sort((a, b) => ((b.v ?? -1e9) - (a.v ?? -1e9)) * (rk.low ? -1 : 1));
  if (rows.length > top) {
    const ars = rows.find((r) => r.id === ARSENAL);
    rows = rows.slice(0, top);
    if (ars && !rows.includes(ars)) rows.push(ars);
  }
  rows.forEach((r) => { if (r.id === ARSENAL) r.color = "var(--s1)"; });
  let h = `<h2>How Arsenal compare · ${COMP_NAMES[comp]} ${season}</h2>`;
  h += `<div class="row"><label>Metric (per match)<select id="rk-sel">${avail.map((d) => `<option value="${tkey(d)}" ${d === rk ? "selected" : ""}>${esc(d.l)}</option>`).join("")}</select></label>`;
  h += `<span class="note">${rk.low ? "Lower is better; best at the top." : "Highest at the top."}${teams.length > top ? ` Top ${top} of ${teams.length} shown, plus Arsenal.` : ""}</span></div>`;
  h += `<div class="chart">${rankBars(rows, { label: rk.l + " per match", d: rk.k === "poss" || rk.k === "passpct" ? 1 : 2 })}</div>`;
  const cols = [{ k: "name", l: "Team", left: 1, f: (r) => esc(r.name) }, { k: "mp", l: "P" }, { k: "w", l: "W" }, { k: "d", l: "D" }, { k: "l", l: "L" }];
  if (comp === "PL") cols.push({ k: "pts", l: "Pts" });
  for (const d of avail) cols.push({ k: tkey(d), l: d.l, sv: (r) => teamVal(r, d), f: (r) => fmtd(teamVal(r, d), d.k === "poss" || d.k === "passpct" ? 1 : 2) });
  h += `<h2>All teams, per match</h2>` + table(cols, teams, { sort: comp === "PL" ? "pts" : "w", hl: (r) => r.id === ARSENAL });
  setTimeout(() => { const el = $("#rk-sel"); if (el) el.addEventListener("change", () => { store.set("rkKey", el.value); viewTeam(); }); }, 0);
  return h;
}

function viewPlayers() {
  const per90 = store.get("per90") === "1";
  const minMin = +(store.get("minMin") || 0);
  let rows = S.players.map((p) => aggPlayer(p, inScope)).filter((a) => a.apps > 0);
  const shown = rows.filter((a) => a.min >= minMin);
  const statCols = PSTATS.filter((s) => !s.gk && s.k !== "rc" && rows.some((a) => statVal(a, s, false) != null && (s.fpl ? a.fmin : true)));
  const cols = [
    { k: "name", l: "Player", left: 1, f: (a) => `<a href="#/player/${a.id}">${esc(a.name)}</a>` },
    { k: "grp", l: "Pos", left: 1, f: (a) => a.grp },
    { k: "apps", l: "Apps" }, { k: "starts", l: "Starts" }, { k: "min", l: "Min" },
    ...statCols.map((s) => ({ k: s.k, l: s.l, title: s.fpl ? `${s.l} (Fantasy Premier League data, PL only)` : s.l,
      sv: (a) => statVal(a, s, per90), f: (a) => fmtd(statVal(a, s, per90), decs(s, per90)) })),
  ];
  let h = `<h1>Squad</h1><p class="sub">${esc(scopeLabel())} · Arsenal appearances only</p>`;
  h += `<div class="row">${toggle("p90", [["0", "Totals"], ["1", "Per 90"]], per90 ? "1" : "0")}<label>Minimum minutes<select id="minmin">${[0, 90, 270, 450, 900, 1800].map((v) => `<option ${v === minMin ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>`;
  h += table(cols, shown, { sort: "min" });
  h += `<p class="note">xG, xA, tackles, clearances/blocks/interceptions, recoveries and defensive contributions come from Fantasy Premier League data, so they cover Premier League matches only. Per-90 rates for these use only the minutes they cover. xG is available per match for the current season and as season totals from 2022-23 for players still in the league.</p>`;
  $("#app").innerHTML = h;
  onToggle("p90", (v) => { store.set("per90", v); viewPlayers(); });
  $("#minmin").addEventListener("change", (e) => { store.set("minMin", e.target.value); viewPlayers(); });
}

async function viewPlayer(id) {
  const p = S.players.find((x) => x.id === id);
  if (!p) { $("#app").innerHTML = `<p>Player not found. <a href="#/players">Back to the squad</a></p>`; return; }
  const a = aggPlayer(p, inScope);
  const all = aggPlayer(p, () => true);
  const first = p.matches.length ? MATCH_BY_ID[p.matches[0].m] : null;
  let h = `<p><a href="#/players">← Squad</a></p><h1>${esc(p.name)}</h1><p class="sub">${p.grp} · ${all.apps} Arsenal appearances in PL and UCL since ${first ? dateStr(first.date) : "2020"}</p>`;
  const tiles = [[a.apps, "Appearances", `${a.starts} starts`], [a.min, "Minutes", ""], [a.g || 0, "Goals", a.min ? `${((90 * (a.g || 0)) / a.min).toFixed(2)} per 90` : ""],
    [a.a || 0, "Assists", a.min ? `${((90 * (a.a || 0)) / a.min).toFixed(2)} per 90` : ""],
    [a.fmin ? (a.xg || 0).toFixed(2) : "n/a", "xG", a.fmin ? `over ${a.fmin} PL minutes` : "not available for this selection"],
    [a.fmin ? (a.xa || 0).toFixed(2) : "n/a", "xA", ""], [a.sh || 0, "Shots", `${a.sot || 0} on target`]];
  if (p.grp === "GK") tiles.push([a.sv || 0, "Saves", `${a.gc || 0} conceded`]);
  h += `<p class="sub" style="margin-top:-8px">Selection: ${esc(scopeLabel())}</p>`;
  h += `<div class="tiles">${tiles.map(([v, l, x]) => `<div class="tile"><div class="v">${v}</div><div class="l">${l}</div><div class="x">${x}</div></div>`).join("")}</div>`;

  // season by season, all competitions
  const groups = {};
  for (const r of p.matches) { const m = MATCH_BY_ID[r.m]; if (m) groups[`${m.season}|${m.comp}`] = 1; }
  for (const s of Object.keys(p.past_xg || {})) groups[`${s}|PL`] = 1;
  const srows = Object.keys(groups).map((k) => {
    const [season, comp] = k.split("|");
    return { season, comp, ...aggPlayer(p, (m) => m.season === season && m.comp === comp) };
  }).filter((r) => r.apps > 0);
  srows.push({ season: "Total", comp: "All", ...all, total: 1 });
  const sc = PSTATS.filter((s) => (p.grp === "GK" || !s.gk) && s.k !== "rc" && (s.fpl ? all.fmin : true));
  h += `<h2>Season by season (Arsenal only)</h2>` + table([
    { k: "season", l: "Season", left: 1, f: (r) => (r.total ? "<b>Since 2020-21</b>" : r.season), sv: (r) => (r.total ? "0000" : r.season) },
    { k: "comp", l: "Comp", left: 1, f: (r) => r.comp }, { k: "apps", l: "Apps" }, { k: "starts", l: "Starts" }, { k: "min", l: "Min" },
    ...sc.map((s) => ({ k: s.k, l: s.l, sv: (r) => statVal(r, s, false), f: (r) => fmtd(statVal(r, s, false), decs(s, false)) })),
  ], srows, { sort: "season", hl: (r) => r.total });
  h += `<p class="note">xG and xA cover Premier League seasons from 2022-23 only (season totals, counted only when the whole season was at Arsenal). Tackles, clearances/blocks/interceptions, recoveries and defensive contributions cover the current Premier League season only. Totals include only the seasons where each stat exists.</p>`;

  // percentiles vs league peers in the same position group
  const sc1 = singleScope();
  const L = await league(sc1.comp, sc1.season);
  h += `<h2>Percentiles vs ${p.grp === "GK" ? "goalkeepers" : { DEF: "defenders", MID: "midfielders", FWD: "forwards" }[p.grp]} · ${COMP_NAMES[sc1.comp]} ${sc1.season}</h2>`;
  if (L) {
    const me = L.players.filter((r) => r.id === p.id && r.tid === ARSENAL)[0];
    const peers = L.players.filter((r) => r.grp === p.grp && r.min >= 450);
    if (!me || me.min < 450) {
      h += `<p class="note">Needs at least 450 Arsenal minutes in this competition and season (has ${me ? me.min : 0}). Change the filters above to pick another season.</p>`;
    } else {
      const keys = p.grp === "GK" ? GK_PCT : PCT_STATS;
      h += `<div class="card"><div class="pct">`;
      for (const k of keys) {
        const s = PSTATS.find((x) => x.k === k);
        const mv = leagueVal(me, k);
        const pv = peers.map((r) => leagueVal(r, k)).filter((v) => v != null && (!s.fpl || true));
        if (mv == null || pv.length < 10) continue;
        const less = pv.filter((v) => v < mv).length, eq = pv.filter((v) => v === mv).length;
        let pct = Math.round((100 * (less + eq / 2)) / pv.length);
        if (k === "gc") pct = 100 - pct;
        h += `<div>${esc(s.l)} <span class="muted">per 90</span></div><div class="bar" data-tip="${esc(`<b>${esc(s.l)} per 90</b>${mv.toFixed(2)}, better than ${pct}% of ${pv.length} ${p.grp} with 450+ minutes`)}"><span style="width:${Math.max(pct, 1)}%"></span></div><div class="n">${mv.toFixed(2)} · ${pct}th</div>`;
      }
      h += `</div><p class="note">Peers: players in the same position group with at least 450 minutes. ${k90note(sc1.comp)}</p></div>`;
    }
  } else h += `<p class="note">No league data for this season.</p>`;

  // match log
  const log = p.matches.filter((r) => MATCH_BY_ID[r.m] && inScope(MATCH_BY_ID[r.m])).slice().reverse();
  h += `<h2>Match log · ${esc(scopeLabel())}</h2>` + table([
    { k: "date", l: "Date", left: 1, sv: (r) => MATCH_BY_ID[r.m].date, f: (r) => dateStr(MATCH_BY_ID[r.m].date) },
    { k: "opp", l: "Opponent", left: 1, sv: (r) => MATCH_BY_ID[r.m].opp.name, f: (r) => { const m = MATCH_BY_ID[r.m]; return `${m.ha === "home" ? "vs" : "at"} ${esc(m.opp.name)}`; } },
    { k: "comp", l: "Comp", left: 1, sv: (r) => MATCH_BY_ID[r.m].comp, f: (r) => MATCH_BY_ID[r.m].comp },
    { k: "res", l: "Result", left: 1, sv: (r) => MATCH_BY_ID[r.m].res, f: (r) => { const m = MATCH_BY_ID[r.m]; return `<span class="res ${m.res}">${m.res}</span> ${m.gf}-${m.ga}`; } },
    { k: "min", l: "Min" }, { k: "g", l: "G", f: (r) => r.g || 0 }, { k: "a", l: "A", f: (r) => r.a || 0 },
    { k: "sh", l: "Shots", f: (r) => r.sh || 0 }, { k: "sot", l: "On target", f: (r) => r.sot || 0 },
    { k: "xg", l: "xG", f: (r) => (r.f ? (r.xg || 0).toFixed(2) : '<span class="na">n/a</span>') },
    { k: "xa", l: "xA", f: (r) => (r.f ? (r.xa || 0).toFixed(2) : '<span class="na">n/a</span>') },
  ], log, { sort: "date" });
  $("#app").innerHTML = h;
}
const k90note = (comp) => (comp === "PL" ? "xG, xA and defensive stats use Fantasy Premier League data." : "Champions League data has no xG or defensive actions.");

function viewMatches() {
  const ms = S.matches.filter(inScope).slice().reverse();
  const rowsByMatch = {};
  for (const p of S.players) for (const r of p.matches) (rowsByMatch[r.m] ||= []).push({ ...r, name: p.name, id: p.id });
  let h = `<h1>Matches</h1><p class="sub">${esc(scopeLabel())} · ${ms.length} matches · click a match for details</p>`;
  h += ms.map((m) => {
    const lines = TSTATS.filter((d) => d.side === "f" || d.k === "poss").filter((d) => d.k !== "goals").map((d) => {
      const f = d.k === "poss" ? m.poss : m.f[d.k], a = d.k === "poss" ? (m.poss != null ? 100 - m.poss : null) : m.a[d.k];
      return f == null && a == null ? "" : `<tr><td class="l">${esc(d.l.replace(" against", "").replace(" conceded", ""))}</td><td>${fmtd(f ?? null, d.k === "xg" || d.k === "poss" ? 1 : 0)}</td><td>${fmtd(a ?? null, d.k === "xg" || d.k === "poss" ? 1 : 0)}</td></tr>`;
    }).join("");
    const pr = (rowsByMatch[m.id] || []).sort((x, y) => y.st - x.st || y.min - x.min);
    const plines = pr.map((r) => `<tr><td class="l"><a href="#/player/${r.id}">${esc(r.name)}</a></td><td>${r.st ? "Start" : "Sub"}</td><td>${r.min}</td><td>${r.g || 0}</td><td>${r.a || 0}</td><td>${r.sh || 0}</td><td>${r.sot || 0}</td><td>${r.f ? (r.xg || 0).toFixed(2) : '<span class="na">n/a</span>'}</td></tr>`).join("");
    return `<details class="match"><summary><span>${dateStr(m.date)}</span><span><span class="res ${m.res}">${m.res}</span></span><span><b>${m.gf}-${m.ga}</b> ${m.ha === "home" ? "vs" : "at"} ${esc(m.opp.name)}</span><span>${m.comp}</span><span class="hide-sm muted">${m.f.xg != null ? `xG ${m.f.xg.toFixed(1)}-${m.a.xg.toFixed(1)}` : `Shots ${m.f.sh ?? "?"}-${m.a.sh ?? "?"}`}</span></summary>
      <div class="body grid2"><div class="tablewrap"><table><thead><tr><th class="l">Team stats</th><th>Arsenal</th><th>${esc(m.opp.abbr || m.opp.name)}</th></tr></thead><tbody>${lines}</tbody></table></div>
      <div class="tablewrap"><table><thead><tr><th class="l">Player</th><th></th><th>Min</th><th>G</th><th>A</th><th>Sh</th><th>SoT</th><th>xG</th></tr></thead><tbody>${plines}</tbody></table></div></div></details>`;
  }).join("");
  $("#app").innerHTML = h;
}

const COLORS = ["var(--s1)", "var(--s2)", "var(--s3)"];
async function viewCompare() {
  const mode = store.get("cmpMode") || "players";
  const { comp, season } = singleScope();
  const L = await league(comp, season);
  let h = `<h1>Compare</h1><p class="sub">${COMP_NAMES[comp]} ${season}${S.comp === "ALL" || S.season === "ALL" ? " (comparisons need one competition and season; using this one)" : ""}</p>`;
  h += `<div class="row">${toggle("cmode", [["players", "Players"], ["teams", "Teams"]], mode)}</div>`;
  if (!L) { $("#app").innerHTML = h + `<p class="note">No data for this season.</p>`; onToggle("cmode", (v) => { store.set("cmpMode", v); viewCompare(); }); return; }
  const selKey = `cmp_${mode}_${comp}_${season}`;
  let sel = [];
  try { sel = JSON.parse(store.get(selKey) || "[]"); } catch (e) { sel = []; }
  if (mode === "players") {
    const pool = L.players.filter((r) => r.min >= 90);
    const key = (r) => `${r.id}|${r.tid}`;
    sel = sel.filter((k) => pool.some((r) => key(r) === k));
    if (!sel.length) sel = pool.filter((r) => r.tid === ARSENAL && r.grp !== "GK").sort((x, y) => ((y.g || 0) + (y.a || 0)) - ((x.g || 0) + (x.a || 0)) || y.min - x.min).slice(0, 2).map(key);
    const ents = sel.map((k, i) => { const r = pool.find((x) => key(x) === k); return { name: `${r.name} (${r.team})`, color: COLORS[i], row: r }; });
    const metrics = PCT_STATS.concat(["fc"]).map((k) => PSTATS.find((s) => s.k === k)).filter((s) => ents.some((e) => leagueVal(e.row, s.k) != null));
    ents.forEach((e) => { e.vals = {}; metrics.forEach((s) => { e.vals[s.k] = leagueVal(e.row, s.k); }); });
    h += `<div class="row"><label>Add a player (up to 3)<input type="search" id="cmp-add" list="cmp-list" placeholder="Type a name"></label><datalist id="cmp-list">${pool.sort((a, b) => a.name.localeCompare(b.name)).map((r) => `<option value="${esc(r.name)} · ${esc(r.team)} · ${r.grp}">`).join("")}</datalist></div>`;
    h += `<div class="chips">${ents.map((e, i) => `<span class="chip"><i style="background:${e.color}"></i>${esc(e.name)} · ${e.row.min} min<button data-rm="${i}" aria-label="Remove">×</button></span>`).join("")}</div>`;
    h += `<p class="note">All values per 90 minutes. ${k90note(comp)}</p><div class="grid2">${compareBars(ents, metrics)}</div>`;
    h += `<h2>Table</h2>` + table([{ k: "s", l: "Per 90", left: 1, f: (r) => r.s }, ...ents.map((e, i) => ({ k: "e" + i, l: e.row.name, f: (r) => fmtd(r["e" + i], 2) }))],
      metrics.map((s) => ({ s: s.l, ...Object.fromEntries(ents.map((e, i) => ["e" + i, e.vals[s.k]])) })));
    $("#app").innerHTML = h;
    $("#cmp-add").addEventListener("change", (ev) => {
      const v = ev.target.value; const r = pool.find((x) => `${x.name} · ${x.team} · ${x.grp}` === v);
      if (r && !sel.includes(key(r))) { sel = sel.concat(key(r)).slice(-3); store.set(selKey, JSON.stringify(sel)); viewCompare(); }
    });
  } else {
    const teams = L.teams;
    sel = sel.filter((id) => teams.some((t) => t.id === id));
    if (!sel.length) sel = [ARSENAL, ...teams.filter((t) => t.id !== ARSENAL).slice(0, 2).map((t) => t.id)].filter((id) => teams.some((t) => t.id === id));
    const metrics = TSTATS.filter((d) => teams.some((t) => teamVal(t, d) != null)).map((d) => ({ k: tkey(d), l: d.l + (d.calc ? "" : " per match"), def: d, d: d.calc ? 1 : 2 }));
    const ents = sel.map((id, i) => { const t = teams.find((x) => x.id === id); const vals = {}; metrics.forEach((m) => { vals[m.k] = teamVal(t, m.def); }); return { name: t.name, color: COLORS[i], vals }; });
    h += `<div class="row"><label>Add a team (up to 3)<select id="cmp-team"><option value="">Choose…</option>${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</select></label></div>`;
    h += `<div class="chips">${ents.map((e, i) => `<span class="chip"><i style="background:${e.color}"></i>${esc(e.name)}<button data-rm="${i}" aria-label="Remove">×</button></span>`).join("")}</div>`;
    h += `<p class="note">Values per match.${comp === "PL" && season !== S.meta.seasons.PL.slice().sort().reverse()[0] ? " xG is only available for the current Premier League season." : ""}</p><div class="grid2">${compareBars(ents, metrics)}</div>`;
    $("#app").innerHTML = h;
    $("#cmp-team").addEventListener("change", (ev) => {
      const v = ev.target.value;
      if (v && !sel.includes(v)) { sel = sel.concat(v).slice(-3); store.set(selKey, JSON.stringify(sel)); viewCompare(); }
    });
  }
  document.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => {
    sel.splice(+b.dataset.rm, 1); store.set(selKey, JSON.stringify(sel)); viewCompare();
  }));
  onToggle("cmode", (v) => { store.set("cmpMode", v); viewCompare(); });
}

function viewAbout() {
  const m = S.meta;
  $("#app").innerHTML = `<h1>About this tracker</h1>
  <div class="card"><p>Arsenal team and player stats for the Premier League (from 2020-21) and the Champions League (from 2023-24, the first season Arsenal were back in it in this period). Player stats count Arsenal appearances only.</p>
  <p><b>Updates:</b> automatically twice a day (05:00 and 12:00 IST). New matches appear after the next run. Last update: ${esc(m.updated)}.</p>
  <p><b>Sources:</b></p><ul>
  <li>ESPN public match data: results, team stats (shots, possession, passing, crosses, tackles, interceptions, clearances, corners, fouls) and player stats (minutes, goals, assists, shots, shots on target, fouls, cards, saves). Minutes are worked out from substitution times and ignore stoppage time.</li>
  <li>Official Fantasy Premier League API (Opta data): xG, xA, tackles, clearances/blocks/interceptions, recoveries and defensive contributions, Premier League only. Per match for the current season; season totals of xG and xA from 2022-23 for players still in the league. Team xG is the sum of its players' xG.</li></ul>
  <p><b>Not available from free sources:</b> big chances, duels, dribbles, aerial duels, line-breaking passes, Champions League xG, and Premier League xG before 2022-23.</p></div>`;
}

// ---------- routing and filters ----------
function setSeasonOptions() {
  const seasons = seasonsFor(S.comp);
  if (S.season !== "ALL" && !seasons.includes(S.season)) S.season = seasons[0];
  $("#f-season").innerHTML = seasons.map((s) => `<option value="${s}">${s}</option>`).join("") + `<option value="ALL">All seasons</option>`;
  $("#f-season").value = S.season;
}
async function route() {
  const [, view, arg] = (location.hash || "#/team").split("/");
  S.view = view || "team";
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === S.view || (S.view === "player" && a.dataset.nav === "players")));
  $("#filters").style.display = S.view === "about" ? "none" : "";
  tip.hidden = true;
  try {
    if (S.view === "players") viewPlayers();
    else if (S.view === "player") await viewPlayer(decodeURIComponent(arg || ""));
    else if (S.view === "matches") viewMatches();
    else if (S.view === "compare") await viewCompare();
    else if (S.view === "about") viewAbout();
    else await viewTeam();
  } catch (e) {
    console.error(e);
    $("#app").innerHTML = `<p>Something went wrong showing this page: ${esc(e.message)}</p>`;
  }
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
  $("#updated").textContent = `Updated ${S.meta.updated}`;
  $("#f-comp").addEventListener("change", (e) => { S.comp = e.target.value; store.set("comp", S.comp); setSeasonOptions(); store.set("season", S.season); route(); });
  $("#f-season").addEventListener("change", (e) => { S.season = e.target.value; store.set("season", S.season); route(); });
  addEventListener("hashchange", route);
  route();
}
init();
