// Exploration : où trouver le Recensement des équipements sportifs (RES) et quels champs il contient.
import { writeFileSync, mkdirSync } from "node:fs";
const UA = "TribunesTCG/0.1 (https://github.com/AugRock/TCG)";
const out = [];
const get = async (url) => {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    const t = await r.text();
    out.push(`\n### ${url}\nHTTP ${r.status}\n${t.slice(0, 6000)}`);
    try { return JSON.parse(t); } catch { return null; }
  } catch (e) { out.push(`\n### ${url}\nERREUR ${e.message}`); return null; }
};
const ds = await get("https://www.data.gouv.fr/api/1/datasets/?q=recensement%20equipements%20sportifs&page_size=5");
for (const d of (ds && ds.data) || []) {
  out.push(`\n== ${d.title} | ${d.organization && d.organization.name} | ${d.page}`);
  for (const r of d.resources || []) out.push(`  - ${r.title} | ${r.format} | ${r.filesize || "?"} o | ${r.url}`);
}
await get("https://equipements.sports.gouv.fr/api/explore/v2.1/catalog/datasets?limit=20");
await get("https://equipements.sports.gouv.fr/api/explore/v2.1/catalog/datasets/data-es/records?limit=2");
mkdirSync("data", { recursive: true });
writeFileSync("data/probe-res.txt", out.join("\n"));
