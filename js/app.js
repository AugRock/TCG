/* Moteur du jeu — indépendant du thème (voir data.js). */
(() => {
  // Mode démo : ?demo=1 dans l'URL, ou 5 tapes rapides sur le logo. Sauvegarde séparée.
  const params = new URLSearchParams(location.search);
  try {
    if (params.get("demo") === "1") localStorage.setItem("tcg-demo", "1");
    if (params.get("demo") === "0") localStorage.removeItem("tcg-demo");
  } catch {}
  const DEMO = (() => { try { return localStorage.getItem("tcg-demo") === "1"; } catch { return params.get("demo") === "1"; } })();
  const SAVE_KEY = DEMO ? "tcg-save-demo" : "tcg-save-v1";
  let forcedRarity = ""; // démo : forcer la rareté de toutes les cartes
  const FREE_PACK_COOLDOWN = 4 * 60 * 60 * 1000;
  const PACK_SIZE = 5;
  const RARITY_ORDER = ["commune", "rare", "epique", "legendaire"];
  const PACKS = {
    free:     { cost: 0,   minRarity: "commune" },
    standard: { cost: 100, minRarity: "rare" },
    premium:  { cost: 300, minRarity: "epique" },
  };

  const $ = s => document.querySelector(s);
  const byId = Object.fromEntries(THEME.cards.map(c => [c.id, c]));

  // ---------- Sauvegarde ----------
  const defaultState = () => ({ coins: 300, owned: {}, lastFree: 0, stats: { packs: 0, wins: 0, losses: 0 } });
  let state;
  try { state = { ...defaultState(), ...JSON.parse(localStorage.getItem(SAVE_KEY) || "{}") }; }
  catch { state = defaultState(); }
  // Cartes qui n'existent plus (changement de base de données) : on les retire de la sauvegarde
  state.owned = Object.fromEntries(Object.entries(state.owned || {}).filter(([id]) => byId[id]));
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} };

  // ---------- Utilitaires ----------
  const fmt = n => n.toLocaleString("fr-FR");
  const rank = r => RARITY_ORDER.indexOf(r);
  const toast = msg => {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2200);
  };
  const power = c => THEME.stats.reduce((s, st) => s + normStat(st, c), 0);
  // Statistiques normalisées 0-1 pour comparer des cartes entre elles
  const statMax = Object.fromEntries(THEME.stats.map(st => [st.key, Math.max(...THEME.cards.map(st.get))]));
  const normStat = (st, c) => st.get(c) / statMax[st.key];

  function rollRarity(min = "commune") {
    const pool = RARITY_ORDER.filter(r => rank(r) >= rank(min));
    const total = pool.reduce((s, r) => s + THEME.rarities[r].weight, 0);
    let x = Math.random() * total;
    for (const r of pool) { if ((x -= THEME.rarities[r].weight) < 0) return r; }
    return pool[0];
  }
  function rollCard(min) {
    const r = forcedRarity || rollRarity(min);
    const pool = THEME.cards.filter(c => c.rarity === r);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- Rendu d'une carte ----------
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  function cardHTML(c, { count = 0, missing = false, isNew = false } = {}) {
    const sport = THEME.sports[c.sport] || THEME.sports.autre;
    const img = !missing && CardImages.get(c.id);
    const full = !missing && img;
    const foil = full && THEME.foil[c.rarity];
    const cls = ["card", "r-" + c.rarity, missing && "missing", isNew && "new", full && "full", img && "has-img"].filter(Boolean).join(" ");
    if (missing) {
      return `<div class="${cls}" data-id="${c.id}"><div class="c-top"><span>${THEME.rarities[c.rarity].label}</span><span>${sport.icon}</span></div>
        <div class="c-art">❔</div><div class="c-name">???</div><div class="c-city">${sport.label}</div></div>`;
    }
    const style = img ? ` style="--img:url(&quot;${esc(img.url)}&quot;)"` : "";
    const stats = THEME.stats.map(st => `<div data-stat="${st.key}" title="${st.label}"><b>${(st.show && st.show(c)) || fmt(st.get(c))}</b>${st.icon} <span class="lbl">${st.label}</span></div>`).join("");
    const art = full ? `<div class="c-spacer"></div>`
      : `<div class="c-art">${img ? "" : sport.icon}<span class="flag">${c.flag}</span>${img ? `<span class="sport-chip">${sport.icon}</span>` : ""}</div>`;
    return `<div class="${cls}" data-id="${c.id}"${style}>
      ${count > 1 ? `<span class="count">×${count}</span>` : ""}
      <div class="c-top"><span>${THEME.rarities[c.rarity].label}</span><span>${full ? sport.icon + " " + c.flag : sport.label}</span></div>
      ${art}
      <div class="c-info">
        <div class="c-name">${esc(c.name)}</div>
        <div class="c-city">${esc(c.city)}${c.year ? " · " + c.year : ""}</div>
        <div class="c-stats">${stats}</div>
      </div>
      ${foil ? `<div class="holo ${foil}"></div>` : ""}
    </div>`;
  }

  // ---------- Header / boutique ----------
  function renderHeader() {
    $("#coins").textContent = fmt(state.coins);
    $("#btn-standard").disabled = !DEMO && state.coins < PACKS.standard.cost;
    $("#btn-premium").disabled = !DEMO && state.coins < PACKS.premium.cost;
    const left = state.lastFree + FREE_PACK_COOLDOWN - Date.now();
    $("#btn-free").disabled = !DEMO && left > 0;
    if (DEMO) $("#free-timer").textContent = "Mode démo : illimité";
    else if (left > 0) {
      const h = Math.floor(left / 3.6e6), m = Math.floor((left % 3.6e6) / 6e4), s = Math.floor((left % 6e4) / 1000);
      $("#free-timer").textContent = `Prochain dans ${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    } else $("#free-timer").textContent = "Disponible !";
  }

  async function openPack(type) {
    const p = PACKS[type];
    if (!DEMO && state.coins < p.cost) return;
    if (type === "free") state.lastFree = Date.now();
    if (!DEMO) state.coins -= p.cost;
    const cards = Array.from({ length: PACK_SIZE }, (_, i) => rollCard(i === PACK_SIZE - 1 ? p.minRarity : "commune"));
    cards.sort((a, b) => rank(a.rarity) - rank(b.rarity)); // suspense : la meilleure à la fin
    const seenNew = new Set();
    const fresh = cards.map(c => !state.owned[c.id] && !seenNew.has(c.id) && seenNew.add(c.id));
    cards.forEach(c => (state.owned[c.id] = (state.owned[c.id] || 0) + 1));
    state.stats.packs++;
    save(); renderHeader();

    // Légendaire dans le paquet : animation d'entrée dans le stade avant d'afficher les cartes
    const legend = cards.find(c => c.rarity === "legendaire");
    if (legend) await playWalkout(legend);

    $("#pack-cards").innerHTML = cards.map((c, i) =>
      `<div class="flip"><div class="back">🏟️</div>${cardHTML(c, { isNew: fresh[i] })}</div>`).join("");
    $("#pack-cards").querySelectorAll(".flip").forEach(f => f.addEventListener("click", () => f.classList.add("revealed")));
    $("#pack-modal").hidden = false;
  }

  // ---------- Animations légendaires ----------
  function playWalkout(c) {
    return Walkout.play(c, { cardHtml: cardHTML(c), sport: THEME.sports[c.sport] || THEME.sports.autre });
  }
  let stadiumModule = null;
  async function openStadium3D(c, fromEl) {
    try {
      stadiumModule = stadiumModule || (await import("./stadium3d.js?v=1.3"));
      stadiumModule.openStadium(c, { sport: { key: c.sport, ...(THEME.sports[c.sport] || THEME.sports.autre) }, fromEl, onDetails: () => showDetail(c.id) });
    } catch (e) {
      console.warn("Vue 3D indisponible :", e);
      showDetail(c.id);
    }
  }

  // ---------- Collection ----------
  const PAGE = 60;
  let shown = PAGE;
  const norm = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  function renderCollection(keepPage) {
    if (keepPage !== true) shown = PAGE;
    const sport = $("#filter-sport").value, rar = $("#filter-rarity").value, ownedOnly = $("#filter-owned").checked;
    const region = $("#filter-region").value, q = norm($("#filter-search").value);
    const ownedCount = THEME.cards.filter(c => state.owned[c.id]).length;
    const pct = Math.round((ownedCount / THEME.cards.length) * 100);
    $("#progress-bar").style.width = pct + "%";
    $("#progress-text").textContent = `${ownedCount} / ${THEME.cards.length} cartes (${pct} %) · ${state.stats.packs} paquets ouverts · ${state.stats.wins} victoires`;

    const list = THEME.cards
      .filter(c => (!sport || c.sport === sport) && (!rar || c.rarity === rar) && (!region || c.region === region)
        && (!ownedOnly || state.owned[c.id])
        && (!q || (state.owned[c.id] && norm(c.name + " " + c.city + " " + (c.club || "")).includes(q))))
      .sort((a, b) => !!state.owned[b.id] - !!state.owned[a.id] || rank(b.rarity) - rank(a.rarity) || b.prestige - a.prestige);
    $("#collection-grid").innerHTML = list.slice(0, shown).map(c => cardHTML(c, { count: state.owned[c.id] || 0, missing: !state.owned[c.id] })).join("")
      || `<p class="muted">Aucune carte.</p>`;
    $("#collection-more").hidden = list.length <= shown;
    $("#collection-more").textContent = `Afficher plus (${list.length - shown} restantes)`;
  }

  function sellDupes() {
    let gain = 0, n = 0;
    for (const [id, count] of Object.entries(state.owned)) {
      if (count > 1) { gain += (count - 1) * THEME.rarities[byId[id].rarity].sellValue; n += count - 1; state.owned[id] = 1; }
    }
    if (!n) return toast("Aucun doublon à recycler.");
    state.coins += gain; save(); renderHeader(); renderCollection();
    toast(`${n} doublon(s) recyclé(s) : +🪙 ${gain}`);
  }

  function showDetail(id) {
    const c = byId[id];
    if (!state.owned[c.id]) return;
    const sport = THEME.sports[c.sport];
    $("#card-detail").innerHTML = `<div class="detail-card">${cardHTML(c)}</div>
      <h3>${c.flag} ${esc(c.name)}</h3>
      <p class="muted">${sport.icon} ${sport.label} · ${c.city}${c.region ? " (" + c.region + ")" : ""}<br>${c.year ? "Ouvert en " + c.year + " · " : ""}${fmt(c.capacity)} places</p>
      ${c.club ? `<p>Club résident : <b>${esc(c.club)}</b></p>` : ""}
      ${c.wikidata ? `<p class="credit"><a href="https://www.wikidata.org/wiki/${c.wikidata}" target="_blank" rel="noopener">Fiche Wikidata</a></p>` : ""}
      ${c.res ? `<p class="credit">Capacité et équipement : Recensement des équipements sportifs (ministère des Sports)</p>` : ""}
      ${c.osm ? `<p class="credit"><a href="https://www.openstreetmap.org/${c.osm}" target="_blank" rel="noopener">Voir sur OpenStreetMap</a> · © contributeurs OpenStreetMap</p>` : ""}
      ${c.fact ? `<p>${c.fact}</p>` : ""}
      ${(img => img ? `<p class="credit">Photo : <a href="${esc(img.page)}" target="_blank" rel="noopener">${esc(img.artist)}</a> · ${esc(img.license)} · Wikimedia Commons</p>` : "")(CardImages.get(c.id))}
      <p class="muted">Exemplaires : ${state.owned[c.id]}</p>
      <button class="primary" id="btn-close-detail">Fermer</button>`;
    $("#card-modal").hidden = false;
    $("#btn-close-detail").onclick = () => ($("#card-modal").hidden = true);
  }

  // ---------- Duel (façon « bataille de stats ») ----------
  let duel = null;
  function myDeck() {
    return Object.keys(state.owned).map(id => byId[id]).sort((a, b) => power(b) - power(a)).slice(0, 5);
  }
  function startDuel() {
    const mine = myDeck();
    if (mine.length < 5) { $("#duel-warning").textContent = "Il te faut au moins 5 cartes différentes. Ouvre un paquet !"; return; }
    // Adversaire de niveau proche du tien
    const target = mine.reduce((s, c) => s + power(c), 0) / 5;
    const ai = [...THEME.cards].sort(() => Math.random() - .5)
      .sort((a, b) => Math.abs(power(a) - target) - Math.abs(power(b) - target)).slice(0, 12)
      .sort(() => Math.random() - .5).slice(0, 5);
    duel = { mine: [...mine].sort(() => Math.random() - .5), ai, round: 0, me: 0, op: 0, myTurn: Math.random() < .5 };
    $("#duel-setup").hidden = true; $("#duel-board").hidden = false;
    nextRound();
  }
  function nextRound() {
    const d = duel;
    $("#score-me").textContent = d.me; $("#score-ai").textContent = d.op;
    if (d.me === 3 || d.op === 3) return endDuel();
    const mc = d.mine[d.round], ac = d.ai[d.round];
    $("#duel-me").innerHTML = cardHTML(mc);
    $("#duel-ai").innerHTML = `<div class="flip"><div class="back">❔</div>${cardHTML(ac)}</div>`;
    const acts = $("#duel-actions");
    if (d.myTurn) {
      $("#duel-log").textContent = `Manche ${d.round + 1} — à toi de choisir la statistique.`;
      acts.innerHTML = THEME.stats.map(st => `<button class="primary" data-stat="${st.key}">${st.label} : ${fmt(st.get(mc))}</button>`).join("");
      acts.querySelectorAll("button").forEach(b => (b.onclick = () => resolve(b.dataset.stat)));
    } else {
      $("#duel-log").textContent = `Manche ${d.round + 1} — l'adversaire choisit…`;
      acts.innerHTML = "";
      const best = THEME.stats.reduce((a, b) => (normStat(b, ac) > normStat(a, ac) ? b : a));
      setTimeout(() => resolve(best.key), 900);
    }
  }
  function resolve(key) {
    const d = duel, st = THEME.stats.find(s => s.key === key);
    const mc = d.mine[d.round], ac = d.ai[d.round];
    const a = st.get(mc), b = st.get(ac);
    $("#duel-ai .flip").classList.add("revealed");
    const win = a > b, tie = a === b;
    if (!tie) win ? d.me++ : d.op++;
    $("#duel-me").querySelector(`[data-stat="${key}"]`).classList.add(win ? "stat-win" : "stat-lose");
    setTimeout(() => $("#duel-ai").querySelector(`[data-stat="${key}"]`)?.classList.add(!win && !tie ? "stat-win" : "stat-lose"), 300);
    $("#duel-log").textContent = `${st.label} : ${fmt(a)} contre ${fmt(b)} — ${tie ? "égalité !" : win ? "manche gagnée !" : "manche perdue."}`;
    $("#duel-actions").innerHTML = `<button id="btn-next">Suivant</button>`;
    $("#score-me").textContent = d.me; $("#score-ai").textContent = d.op;
    $("#btn-next").onclick = () => {
      d.round++; d.myTurn = tie ? d.myTurn : win;
      if (d.round >= 5 && d.me < 3 && d.op < 3) return endDuel();
      nextRound();
    };
  }
  function endDuel() {
    const won = duel.me > duel.op;
    const gain = won ? 50 : 10;
    state.coins += gain; won ? state.stats.wins++ : state.stats.losses++;
    save(); renderHeader();
    $("#duel-log").textContent = `${won ? "🏆 Victoire" : duel.me === duel.op ? "Match nul" : "Défaite"} ${duel.me}–${duel.op} · +🪙 ${gain}`;
    $("#duel-actions").innerHTML = `<button class="primary" id="btn-rematch">Rejouer</button><button id="btn-quit">Retour</button>`;
    $("#btn-rematch").onclick = startDuel;
    $("#btn-quit").onclick = () => { $("#duel-board").hidden = true; $("#duel-setup").hidden = false; };
  }

  // ---------- Mode démo ----------
  function setupDemo() {
    document.body.classList.add("demo");
    $(".brand").insertAdjacentHTML("beforeend", ` <span class="demo-badge">DÉMO</span>`);
    $("#view-shop").insertAdjacentHTML("beforeend", `
      <div class="demo-panel">
        <h3>🛠️ Mode démo</h3>
        <p class="muted">Paquets gratuits et illimités. Progression séparée de ta vraie partie.</p>
        <div class="demo-row">
          <label>Forcer la rareté
            <select id="demo-rarity"><option value="">Aléatoire (normal)</option>${RARITY_ORDER.map(r => `<option value="${r}">${THEME.rarities[r].label}</option>`).join("")}</select>
          </label>
        </div>
        <div class="demo-row">
          <button id="demo-all">Débloquer toutes les cartes</button>
          <button id="demo-coins">+ 🪙 1 000</button>
          <button id="demo-reset">Réinitialiser la démo</button>
          <button id="demo-photos">Recharger les photos</button>
          <button id="demo-walkout">Tester l'animation légendaire</button>
          <button id="demo-3d">Tester la vue 3D</button>
          <button id="demo-exit">Quitter le mode démo</button>
        </div>
      </div>`);
    $("#demo-rarity").onchange = e => (forcedRarity = e.target.value);
    $("#demo-all").onclick = () => { THEME.cards.forEach(c => (state.owned[c.id] = state.owned[c.id] || 1)); save(); renderCollection(); toast("Toutes les cartes débloquées"); };
    $("#demo-coins").onclick = () => { state.coins += 1000; save(); renderHeader(); };
    $("#demo-reset").onclick = () => { state = defaultState(); save(); renderHeader(); renderCollection(); toast("Démo réinitialisée"); };
    $("#demo-photos").onclick = () => { try { localStorage.removeItem("tcg-images-v1"); } catch {} location.reload(); };
    const randomLegend = () => { const l = THEME.cards.filter(c => c.rarity === "legendaire"); return l[Math.floor(Math.random() * l.length)]; };
    $("#demo-walkout").onclick = () => playWalkout(randomLegend());
    $("#demo-3d").onclick = () => openStadium3D(randomLegend());
    $("#demo-exit").onclick = () => { try { localStorage.removeItem("tcg-demo"); } catch {} location.href = location.pathname; };
  }

  // ---------- Initialisation ----------
  function init() {
    document.title = `${THEME.name} — jeu de cartes à collectionner`;
    $("#game-name").textContent = THEME.name;
    $("#tagline").textContent = THEME.tagline;
    const total = RARITY_ORDER.reduce((s, r) => s + THEME.rarities[r].weight, 0);
    $("#odds").innerHTML = RARITY_ORDER.map(r =>
      `<span style="color:${THEME.rarities[r].color}">● ${THEME.rarities[r].label} ${((THEME.rarities[r].weight / total) * 100).toFixed(0)} %</span>`).join("");

    $("#filter-sport").innerHTML = `<option value="">Tous les sports</option>` +
      Object.entries(THEME.sports).filter(([k]) => THEME.cards.some(c => c.sport === k))
        .map(([k, s]) => `<option value="${k}">${s.icon} ${s.label}</option>`).join("");
    $("#filter-rarity").innerHTML = `<option value="">Toutes raretés</option>` +
      RARITY_ORDER.map(r => `<option value="${r}">${THEME.rarities[r].label}</option>`).join("");
    const regions = [...new Set(THEME.cards.map(c => c.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    $("#filter-region").innerHTML = `<option value="">Toutes les régions</option>` + regions.map(r => `<option>${esc(r)}</option>`).join("");
    $("#filter-region").hidden = !regions.length;
    ["#filter-sport", "#filter-rarity", "#filter-owned", "#filter-region"].forEach(s => $(s).addEventListener("change", renderCollection));
    $("#filter-search").addEventListener("input", renderCollection);
    $("#collection-more").onclick = () => { shown += PAGE; renderCollection(true); };

    document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
      document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
      if (b.dataset.view === "collection") renderCollection();
    }));

    $("#btn-free").onclick = () => openPack("free");
    $("#btn-standard").onclick = () => openPack("standard");
    $("#btn-premium").onclick = () => openPack("premium");
    $("#btn-reveal-all").onclick = () => document.querySelectorAll("#pack-cards .flip").forEach((f, i) => setTimeout(() => f.classList.add("revealed"), i * 150));
    $("#btn-close-pack").onclick = () => { $("#pack-modal").hidden = true; renderCollection(); };
    $("#btn-sell-dupes").onclick = sellDupes;
    $("#btn-start-duel").onclick = startDuel;
    $("#collection-grid").addEventListener("click", e => {
      const el = e.target.closest(".card"); if (!el) return;
      const c = byId[el.dataset.id];
      if (c && c.rarity === "legendaire" && state.owned[c.id]) openStadium3D(c, el);
      else showDetail(el.dataset.id);
    });
    $("#card-modal").addEventListener("click", e => { if (e.target.id === "card-modal") $("#card-modal").hidden = true; });

    // Effet holographique : suit le pointeur sur les cartes full art
    document.addEventListener("pointermove", e => {
      const card = e.target.closest && e.target.closest(".card.full");
      if (!card) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (y * 100).toFixed(1) + "%");
      card.style.setProperty("--rx", ((0.5 - y) * 14).toFixed(2) + "deg");
      card.style.setProperty("--ry", ((x - 0.5) * 14).toFixed(2) + "deg");
    });

    // 5 tapes rapides sur le logo = activer/désactiver le mode démo
    let taps = [];
    $(".brand").addEventListener("click", () => {
      taps = [...taps.filter(t => Date.now() - t < 2000), Date.now()];
      if (taps.length >= 5) {
        try { DEMO ? localStorage.removeItem("tcg-demo") : localStorage.setItem("tcg-demo", "1"); } catch {}
        location.href = location.pathname;
      }
    });
    if (DEMO) setupDemo();

    renderHeader(); renderCollection();
    setInterval(renderHeader, 1000);
    CardImages.load(THEME.cards).then(() => renderCollection());
  }
  init();
})();
