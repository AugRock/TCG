/*
 * Photos des cartes, chargées depuis Wikipedia / Wikimedia Commons.
 * - On prend l'image principale de l'article (ou THEME.cards[].image si précisée).
 * - On ne garde QUE les fichiers hébergés sur Commons (licences libres) et
 *   on récupère auteur + licence pour les créditer (obligatoire en CC BY-SA).
 * - Résultat mis en cache 7 jours dans le navigateur.
 */
const CardImages = (() => {
  const CACHE_KEY = "tcg-images-v1";
  const TTL = 7 * 24 * 3600 * 1000;
  const WIDTH = 800;
  let images = {};

  const stripHtml = h => { const d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent.trim(); };
  const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  const api = async (host, params) => {
    const url = `https://${host}/w/api.php?` + new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${host} ${r.status}`);
    return r.json();
  };

  async function fetchAll(cards) {
    // 1) Nom du fichier image de chaque article
    const fileOf = {}; // card.id -> "Fichier.jpg"
    const needLookup = cards.filter(c => !c.image && c.wiki);
    cards.filter(c => c.image).forEach(c => (fileOf[c.id] = c.image));
    for (const group of chunks(needLookup, 50)) {
      const data = await api("en.wikipedia.org", {
        action: "query", prop: "pageimages", piprop: "name", redirects: "1",
        titles: group.map(c => c.wiki).join("|"),
      });
      const q = data.query || {};
      const resolve = t => {
        for (const n of q.normalized || []) if (n.from === t) t = n.to;
        for (const r of q.redirects || []) if (r.from === t) t = r.to;
        return t;
      };
      const pageByTitle = Object.fromEntries((q.pages || []).map(p => [p.title, p]));
      group.forEach(c => { const p = pageByTitle[resolve(c.wiki)]; if (p && p.pageimage) fileOf[c.id] = p.pageimage; });
    }

    // 2) URL + auteur + licence depuis Commons (les fichiers non-libres n'y sont pas)
    const files = [...new Set(Object.values(fileOf))];
    const info = {};
    for (const group of chunks(files, 50)) {
      const data = await api("commons.wikimedia.org", {
        action: "query", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: String(WIDTH),
        titles: group.map(f => "File:" + f).join("|"),
      });
      const q = data.query || {};
      const norm = Object.fromEntries((q.normalized || []).map(n => [n.to, n.from]));
      for (const p of q.pages || []) {
        const ii = p.imageinfo && p.imageinfo[0];
        if (!ii || p.missing) continue;
        const md = ii.extmetadata || {};
        const original = (norm[p.title] || p.title).replace(/^File:/, "");
        info[original] = {
          url: ii.thumburl || ii.url,
          page: ii.descriptionurl,
          artist: stripHtml(md.Artist && md.Artist.value) || "Auteur inconnu",
          license: stripHtml(md.LicenseShortName && md.LicenseShortName.value) || "Licence libre",
        };
      }
    }
    const out = {};
    for (const [id, f] of Object.entries(fileOf)) {
      const key = Object.keys(info).find(k => k.replace(/ /g, "_") === f.replace(/ /g, "_"));
      if (key) out[id] = info[key];
    }
    return out;
  }

  async function load(cards) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && Date.now() - cached.t < TTL && cards.every(c => c.id in cached.images || cached.missing.includes(c.id))) {
        return (images = cached.images);
      }
    } catch {}
    try {
      images = await fetchAll(cards);
      const missing = cards.filter(c => !images[c.id]).map(c => c.id);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), images, missing })); } catch {}
    } catch (e) {
      console.warn("Photos indisponibles (hors ligne ?) :", e.message);
    }
    return images;
  }

  return { load, get: id => images[id] };
})();
