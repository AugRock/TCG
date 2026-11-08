/*
 * Génère js/cards.js (les cartes du jeu) à partir de données ouvertes :
 *  - Wikidata (CC0) : stades en France, capacité, ouverture, ville, région, sport, club, photo, notoriété
 *  - OpenStreetMap (ODbL) : capacité quand Wikidata ne l'a pas (via le tag wikidata=*)
 *  - Wikimedia Commons : URL, auteur et licence des photos
 *
 * Usage : node scripts/build-cards.mjs [nombre_de_cartes=1000]
 * Lancé automatiquement par .github/workflows/build-cards.yml
 */
import { writeFileSync, mkdirSync } from "node:fs";

const TARGET = Number(process.argv[2] || 1000);
const UA = "TribunesTCG/0.1 (https://github.com/AugRock/TCG; jeu de cartes open source)";
const COUNTRY = "Q142"; // France
const STADIUM = "Q483110";
const VENUE = "Q1076486"; // lieu sportif (salles, arènes, hippodromes, circuits…)
const report = [];
const log = (...a) => { const l = a.join(" "); console.log(l); report.push(l); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function http(url, opts = {}, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { ...opts, headers: { "User-Agent": UA, "Accept": "application/json", ...(opts.headers || {}) } });
      if (r.ok) return r.json();
      const body = (await r.text()).slice(0, 200);
      if (i === tries || ![429, 500, 502, 503, 504].includes(r.status)) throw new Error(`HTTP ${r.status} ${body}`);
    } catch (e) { if (i === tries) throw e; }
    await sleep(2000 * 2 ** i);
  }
}

const sparql = async q => (await http("https://query.wikidata.org/sparql", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/sparql-results+json" },
  body: new URLSearchParams({ query: q }),
})).results.bindings;
const qid = uri => uri.split("/").pop();
const val = (b, k) => b[k] && b[k].value;

// ---------- 1. Stades en France (Wikidata) ----------
const baseQuery = where => `
SELECT ?s ?sLabel ?cap ?open ?inc ?img ?links ?classLabel WHERE {
  ${where}
  ?s wikibase:sitelinks ?links .
  FILTER NOT EXISTS { ?s wdt:P576 [] }
  OPTIONAL { ?s wdt:P31 ?class }
  OPTIONAL { ?s wdt:P1083 ?cap }
  OPTIONAL { ?s wdt:P1619 ?open }
  OPTIONAL { ?s wdt:P571 ?inc }
  OPTIONAL { ?s wdt:P18 ?img }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
}`;
const items = new Map();
const year = d => { const m = /^(-?\d{1,4})-/.exec(d || ""); return m ? Number(m[1]) : null; };
function addRows(rows) {
 for (const b of rows) {
  const id = qid(val(b, "s"));
  const it = items.get(id) || { id, name: val(b, "sLabel"), caps: [], years: [], openYears: [], img: null, links: 0, sports: new Set(), clubs: new Set(), classes: new Set() };
  if (val(b, "classLabel")) it.classes.add(val(b, "classLabel"));
  if (val(b, "cap")) it.caps.push(Math.round(Number(val(b, "cap"))));
  if (val(b, "open")) it.openYears.push(year(val(b, "open")));
  if (val(b, "inc")) it.years.push(year(val(b, "inc")));
  if (val(b, "img") && !it.img) it.img = decodeURIComponent(val(b, "img").split("/").pop());
  it.links = Math.max(it.links, Number(val(b, "links") || 0));
  items.set(id, it);
 }
}
// 1a. Tous les stades (avec ou sans capacité)
try {
  addRows(await sparql(baseQuery(`?s wdt:P17 wd:${COUNTRY} ; wdt:P31/wdt:P279* wd:${STADIUM} .`)));
  log(`Wikidata : ${items.size} stades en France (non démolis)`);
} catch (e) { log(`⚠️ requête stades : ${e.message}`); }
// 1b. Tous les autres lieux sportifs qui ont une capacité
try {
  const before = items.size;
  addRows(await sparql(baseQuery(`?s wdt:P17 wd:${COUNTRY} ; wdt:P1083 [] ; wdt:P31 ?c . ?c wdt:P279* wd:${VENUE} .`)));
  log(`Wikidata : +${items.size - before} autres lieux sportifs avec capacité (salles, arènes, circuits…)`);
} catch (e) { log(`⚠️ requête lieux sportifs : ${e.message}`); }

// ---------- 2. Ville, région, sport, club (requêtes par lots) ----------
async function batched(ids, build, onRow, size = 300) {
  for (let i = 0; i < ids.length; i += size) {
    const values = ids.slice(i, i + size).map(id => "wd:" + id).join(" ");
    try { (await sparql(build(values))).forEach(onRow); }
    catch (e) { log(`  ⚠️ lot ${i / size + 1} ignoré : ${e.message}`); }
    await sleep(1000);
  }
}
// ---------- 3. OpenStreetMap : tous les lieux sportifs avec capacité ----------
let osmFilled = 0;
const osmLinked = new Map(); // Q-id -> {cap, sport}
const osmOnly = [];          // lieux sans fiche Wikidata
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
// Zone = relation OSM 2202 (France, outre-mer compris) → identifiant de zone 3600002202
const osmQuery = `[out:json][timeout:240][maxsize:2000000000];area(id:3600002202)->.fr;
nwr(area.fr)["capacity"]["leisure"~"^(stadium|sports_centre|sports_hall|track|ice_rink|pitch)$"];out tags;`;
let osm = null;
for (const ep of OVERPASS) {
  try {
    const res = await http(ep, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: osmQuery }) }, 4);
    const nb = (res.elements || []).length;
    log(`OpenStreetMap (${new URL(ep).host}) : ${nb} lieux sportifs avec capacité${res.remark ? " — " + res.remark.slice(0, 200) : ""}`);
    if (nb > 0) { osm = res; break; }
  }
  catch (e) { log(`⚠️ Overpass ${new URL(ep).host} : ${e.message.slice(0, 120)}`); }
}
if (osm) {
  const LEISURE_RANK = { stadium: 0, sports_centre: 1, sports_hall: 2, ice_rink: 3, track: 4, pitch: 5 };
  const seen = new Map();
  for (const el of osm.elements) {
    const t = el.tags;
    const cap = parseInt(String(t.capacity || "").replace(/[\s.,]/g, ""), 10);
    if (!(cap > 0) || cap > 120000) continue;
    if (/^Q\d+$/.test(t.wikidata || "")) {
      const prev = osmLinked.get(t.wikidata);
      if (!prev || cap > prev.cap) osmLinked.set(t.wikidata, { cap, sport: t.sport });
      continue;
    }
    const name = (t.name || "").trim();
    if (!name || cap < 500) continue; // sans nom ou trop petit : pas une carte intéressante
    const city = t["addr:city"] || t["is_in:city"] || null;
    const key = name.toLowerCase() + "|" + (city || "").toLowerCase();
    const cand = { id: `osm${el.type[0]}${el.id}`, name, city, cap, sport: t.sport, rank: LEISURE_RANK[t.leisure] ?? 9 };
    const prev = seen.get(key);
    if (!prev || cand.rank < prev.rank || (cand.rank === prev.rank && cap > prev.cap)) seen.set(key, cand);
  }
  osmOnly.push(...seen.values());
  // Lieux reliés à Wikidata mais absents de notre liste : on récupère leur fiche
  const unknown = [...osmLinked.keys()].filter(w => !items.has(w));
  const before = items.size;
  for (let i = 0; i < unknown.length; i += 200) {
    const v = unknown.slice(i, i + 200).map(x => "wd:" + x).join(" ");
    try { addRows(await sparql(baseQuery(`VALUES ?s { ${v} }`))); }
    catch (e) { log(`  ⚠️ lot OSM ${i / 200 + 1} : ${e.message}`); }
    await sleep(1000);
  }
  for (const it of items.values()) {
    const o = osmLinked.get(it.id); if (!o) continue;
    if (!it.caps.length) { it.caps.push(o.cap); it.osm = true; osmFilled++; }
    if (o.sport) o.sport.split(";").forEach(x => it.sports.add("osm:" + x.trim()));
  }
  log(`OpenStreetMap : ${osmLinked.size} reliés à Wikidata (+${items.size - before} lieux, ${osmFilled} capacités ajoutées), ${osmOnly.length} lieux sans fiche Wikidata`);
}

// Lieux qui ne sont pas des lieux sportifs (classes Wikidata parasites)
const NEVER = /refuge|cabane|gîte/i; // capacité = nombre de lits
const NOT_SPORT_STRONG = /serre|marché|cinéma|hôtel|gare|école|université|église|musée|camping|bibliothèque|port de plaisance|salle des fêtes/i;
const NOT_SPORT = /théâtre|archéolog|concert|auditorium|château|parc d'attractions/i;
const SPORT_CLASS = /stade|sport|aréna|arena|arène|gymnase|patinoire|vélodrome|hippodrome|circuit|court|tennis|piscine|aquatique|terrain|salle multisport|palais des sports/i;
const removed = [];
for (const [id, it] of items) {
  const cl = [...it.classes];
  const sporty = cl.some(c => SPORT_CLASS.test(c)) || SPORT_CLASS.test(it.name || "");
  if (cl.some(c => NEVER.test(c)) || (!sporty && cl.some(c => NOT_SPORT.test(c) || NOT_SPORT_STRONG.test(c)))) { items.delete(id); removed.push(`${it.name} [${cl.join(", ")}]`); }
}
log(`Écartés (pas des lieux sportifs) : ${removed.length} — ${removed.slice(0, 20).join(" · ")}`);

// ---------- 3b. Ville, région, sport, club ----------
const ids = [...items.keys()].filter(id => /^Q\d+$/.test(id) && items.get(id).caps.length);
await batched(ids, v => `SELECT ?s ?cityLabel WHERE { VALUES ?s { ${v} } ?s wdt:P131 ?city .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". } }`,
  b => { const it = items.get(qid(val(b, "s"))); if (it && !it.city) it.city = val(b, "cityLabel"); });
await batched(ids, v => `SELECT ?s ?regionLabel WHERE { VALUES ?s { ${v} } ?s wdt:P131+ ?region . ?region wdt:P31 wd:Q36784 . FILTER NOT EXISTS { ?region wdt:P576 [] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". } }`,
  b => { const it = items.get(qid(val(b, "s"))); if (it && !it.region) it.region = val(b, "regionLabel"); }, 40);
await batched(ids, v => `SELECT ?s ?sportLabel ?clubLabel ?clubSportLabel WHERE { VALUES ?s { ${v} }
  { ?s wdt:P641 ?sport } UNION { ?s wdt:P466 ?club . OPTIONAL { ?club wdt:P641 ?clubSport } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". } }`,
  b => {
    const it = items.get(qid(val(b, "s"))); if (!it) return;
    if (val(b, "sportLabel")) it.sports.add(val(b, "sportLabel").toLowerCase());
    if (val(b, "clubSportLabel")) it.sports.add(val(b, "clubSportLabel").toLowerCase());
    if (val(b, "clubLabel") && !/^Q\d+$/.test(val(b, "clubLabel"))) it.clubs.add(val(b, "clubLabel"));
  });

// ---------- 4. Nettoyage et sélection ----------
const SPORT_RULES = [
  ["us", /football américain|osm:american_football/],
  ["football", /^football$|football association|association football|soccer|osm:soccer/],
  ["rugby", /rugby/],
  ["tennis", /tennis/],
  ["basket", /basket/],
  ["multisport", /osm:multi/],
  ["handball", /handball/],
  ["hockey", /hockey|osm:ice_skating/],
  ["athletisme", /athlétisme|athletics/],
  ["cyclisme", /cyclisme|vélo|cycling/],
  ["auto", /automobile|motocyclisme|sport mécanique|motorsport|motor/],
  ["hippique", /hippique|équitation|horse|equestrian/],
  ["baseball", /baseball/],
  ["natation", /natation|swimming|piscine|osm:swimming/],
  ["golf", /golf/],
];
function sportOf(it) {
  const all = [...it.sports].join("|");
  for (const [k, re] of SPORT_RULES) if (re.test(all)) return k;
  const n = (it.name || "").toLowerCase();
  if (n.includes("hippodrome")) return "hippique";
  if (n.includes("circuit")) return "auto";
  if (n.includes("vélodrome")) return "cyclisme";
  if (n.includes("patinoire")) return "hockey";
  if (n.includes("piscine") || n.includes("centre aquatique")) return "natation";
  return "autre";
}
// Lieux OpenStreetMap sans fiche Wikidata (doublons de nom écartés)
const known = new Set([...items.values()].map(it => (it.name || "").toLowerCase()));
for (const o of osmOnly) {
  if (known.has(o.name.toLowerCase())) continue;
  items.set(o.id, { id: o.id, name: o.name, city: o.city, caps: [o.cap], years: [], openYears: [], img: null, links: 0,
    sports: new Set(o.sport ? o.sport.split(";").map(x => "osm:" + x.trim()) : []), clubs: new Set(), classes: new Set(["OSM"]), osm: true, osmOnly: true });
}
const all = [...items.values()];
const eligible = all.filter(it => it.caps.length && it.name && !/^Q\d+$/.test(it.name));
log(`Avec une capacité connue : ${eligible.length} (sans capacité, écartés : ${all.length - eligible.length})`);
for (const it of eligible) {
  it.capacity = Math.max(...it.caps);
  const ys = [...it.openYears, ...it.years].filter(y => y && y > 1700 && y <= 2026);
  it.year = it.openYears.find(y => y > 1700) || (ys.length ? Math.min(...ys) : null);
  // Notoriété = nombre de Wikipédias + bonus de taille
  it.score = it.links + Math.log10(it.capacity) * 2;
}
eligible.sort((a, b) => b.score - a.score);
const chosen = eligible.slice(0, TARGET);
log(`Sélection : ${chosen.length} cartes (objectif ${TARGET})`);

// Rareté par rang de notoriété : 1 % légendaire, 4 % épique, 15 % rare, le reste commune
const n = chosen.length;
chosen.forEach((it, i) => {
  const p = i / n;
  it.rarity = p < 0.01 ? "legendaire" : p < 0.05 ? "epique" : p < 0.20 ? "rare" : "commune";
  it.prestige = Math.max(1, Math.round(100 * (1 - i / n)));
});

// ---------- 5. Photos : URL + auteur + licence (Commons) ----------
const withImg = chosen.filter(it => it.img);
const strip = h => String(h || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
for (let i = 0; i < withImg.length; i += 50) {
  const group = withImg.slice(i, i + 50);
  try {
    const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
      action: "query", format: "json", formatversion: "2", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "640",
      titles: group.map(it => "File:" + it.img).join("|"),
    });
    const q = (await http(url)).query || {};
    const norm = Object.fromEntries((q.normalized || []).map(x => [x.to, x.from]));
    const byFile = {};
    for (const p of q.pages || []) {
      const ii = p.imageinfo && p.imageinfo[0]; if (!ii) continue;
      const md = ii.extmetadata || {};
      byFile[(norm[p.title] || p.title).replace(/^File:/, "").replace(/_/g, " ")] = {
        url: ii.thumburl || ii.url, page: ii.descriptionurl,
        artist: strip(md.Artist && md.Artist.value).slice(0, 120) || "Auteur inconnu",
        license: strip(md.LicenseShortName && md.LicenseShortName.value) || "Licence libre",
      };
    }
    group.forEach(it => { it.photo = byFile[it.img.replace(/_/g, " ")] || null; });
  } catch (e) { log(`  ⚠️ photos lot ${i / 50 + 1} : ${e.message}`); }
  await sleep(1000);
}
const photos = chosen.filter(it => it.photo).length;
log(`Photos : ${photos} / ${chosen.length}`);

// ---------- 6. Écriture ----------
const cards = chosen.map(it => ({
  id: it.id.toLowerCase(), name: it.name.charAt(0).toUpperCase() + it.name.slice(1), city: it.city || "France", region: it.region || null,
  flag: "🇫🇷", sport: sportOf(it), year: it.year, capacity: it.capacity, prestige: it.prestige, rarity: it.rarity,
  club: [...it.clubs].slice(0, 2).join(", ") || undefined,
  img: it.photo || undefined, wikidata: it.osmOnly ? undefined : it.id,
  osm: it.osmOnly ? it.id.replace(/^osm(\w)(\d+)$/, (_, t, n) => `${{ n: "node", w: "way", r: "relation" }[t]}/${n}`) : undefined,
}));
const count = k => Object.entries(cards.reduce((m, c) => ((m[c[k] || "?"] = (m[c[k] || "?"] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(", ");
log(`Raretés : ${count("rarity")}`);
log(`Sports : ${count("sport")}`);
log(`Régions : ${count("region")}`);
log(`Types de lieux : ${Object.entries(chosen.reduce((m, it) => { [...it.classes].slice(0, 1).forEach(k => (m[k] = (m[k] || 0) + 1)); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([a, b]) => `${a} ${b}`).join(", ")}`);
const odd = chosen.filter(it => [...it.classes].some(c => NOT_SPORT.test(c)));
log(`À vérifier (classe culturelle + sportive) : ${odd.map(it => `${it.name} [${[...it.classes].join(", ")}]`).join(" · ")}`);
log(`Sans année : ${cards.filter(c => !c.year).length} · Capacité via OSM : ${chosen.filter(c => c.osm).length} · Lieux uniquement OSM : ${chosen.filter(c => c.osmOnly).length}`);
log(`Top 15 : ${cards.slice(0, 15).map(c => `${c.name} (${c.capacity})`).join(" · ")}`);

const header = `/* FICHIER GÉNÉRÉ par scripts/build-cards.mjs — ne pas modifier à la main.
 * Données : Wikidata (CC0), © contributeurs OpenStreetMap (ODbL), photos Wikimedia Commons (auteurs et licences indiqués).
 * Généré le ${new Date().toISOString().slice(0, 10)} · ${cards.length} cartes */\n`;
writeFileSync("js/cards.js", header +
  `THEME.tagline = "Collectionne les ${cards.length} stades et arènes de France";\nTHEME.cards = ${JSON.stringify(cards, null, 0).replace(/\},\{/g, "},\n{")};\n`);
mkdirSync("data", { recursive: true });
writeFileSync("data/build-report.txt", report.join("\n") + "\n");
console.log("OK → js/cards.js");
