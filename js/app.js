/* Moteur du jeu — indépendant du thème (voir data.js). */
(() => {
  const SAVE_KEY = "tcg-save-v1";
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
    const r = rollRarity(min);
    const pool = THEME.cards.filter(c => c.rarity === r);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- Rendu d'une carte ----------
  function cardHTML(c, { count = 0, missing = false, isNew = false } = {}) {
    const sport = THEME.sports[c.sport] || THEME.sports.autre;
    const cls = ["card", "r-" + c.rarity, missing && "missing", isNew && "new"].filter(Boolean).join(" ");
    if (missing) {
      return `<div class="${cls}" data-id="${c.id}"><div class="c-top"><span>${THEME.rarities[c.rarity].label}</span><span>${sport.icon}</span></div>
        <div class="c-art">❔</div><div class="c-name">???</div><div class="c-city">${sport.label}</div></div>`;
    }
    const stats = THEME.stats.map(st => `<div data-stat="${st.key}"><b>${fmt(st.get(c))}</b>${st.label}</div>`).join("");
    return `<div class="${cls}" data-id="${c.id}">
      ${count > 1 ? `<span class="count">×${count}</span>` : ""}
      <div class="c-top"><span>${THEME.rarities[c.rarity].label}</span><span>${sport.label}</span></div>
      <div class="c-art">${sport.icon}<span class="flag">${c.flag}</span></div>
      <div class="c-name">${c.name}</div>
      <div class="c-city">${c.city} · ${c.year}</div>
      <div class="c-stats">${stats}</div>
    </div>`;
  }

  // ---------- Header / boutique ----------
  function renderHeader() {
    $("#coins").textContent = fmt(state.coins);
    $("#btn-standard").disabled = state.coins < PACKS.standard.cost;
    $("#btn-premium").disabled = state.coins < PACKS.premium.cost;
    const left = state.lastFree + FREE_PACK_COOLDOWN - Date.now();
    $("#btn-free").disabled = left > 0;
    if (left > 0) {
      const h = Math.floor(left / 3.6e6), m = Math.floor((left % 3.6e6) / 6e4), s = Math.floor((left % 6e4) / 1000);
      $("#free-timer").textContent = `Prochain dans ${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    } else $("#free-timer").textContent = "Disponible !";
  }

  function openPack(type) {
    const p = PACKS[type];
    if (state.coins < p.cost) return;
    if (type === "free") state.lastFree = Date.now();
    state.coins -= p.cost;
    const cards = Array.from({ length: PACK_SIZE }, (_, i) => rollCard(i === PACK_SIZE - 1 ? p.minRarity : "commune"));
    cards.sort((a, b) => rank(a.rarity) - rank(b.rarity)); // suspense : la meilleure à la fin
    const fresh = cards.map(c => !state.owned[c.id]);
    cards.forEach(c => (state.owned[c.id] = (state.owned[c.id] || 0) + 1));
    state.stats.packs++;
    save(); renderHeader();

    $("#pack-cards").innerHTML = cards.map((c, i) =>
      `<div class="flip"><div class="back">🏟️</div>${cardHTML(c, { isNew: fresh[i] })}</div>`).join("");
    $("#pack-cards").querySelectorAll(".flip").forEach(f => f.addEventListener("click", () => f.classList.add("revealed")));
    $("#pack-modal").hidden = false;
  }

  // ---------- Collection ----------
  function renderCollection() {
    const sport = $("#filter-sport").value, rar = $("#filter-rarity").value, ownedOnly = $("#filter-owned").checked;
    const ownedCount = THEME.cards.filter(c => state.owned[c.id]).length;
    const pct = Math.round((ownedCount / THEME.cards.length) * 100);
    $("#progress-bar").style.width = pct + "%";
    $("#progress-text").textContent = `${ownedCount} / ${THEME.cards.length} cartes (${pct} %) · ${state.stats.packs} paquets ouverts · ${state.stats.wins} victoires`;

    const list = THEME.cards
      .filter(c => (!sport || c.sport === sport) && (!rar || c.rarity === rar) && (!ownedOnly || state.owned[c.id]))
      .sort((a, b) => rank(b.rarity) - rank(a.rarity) || a.name.localeCompare(b.name));
    $("#collection-grid").innerHTML = list.map(c => cardHTML(c, { count: state.owned[c.id] || 0, missing: !state.owned[c.id] })).join("")
      || `<p class="muted">Aucune carte.</p>`;
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
      <h3>${c.flag} ${c.name}</h3>
      <p class="muted">${sport.icon} ${sport.label} · ${c.city} · ouvert en ${c.year}<br>${fmt(c.capacity)} places</p>
      ${c.fact ? `<p>${c.fact}</p>` : ""}
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
    ["#filter-sport", "#filter-rarity", "#filter-owned"].forEach(s => $(s).addEventListener("change", renderCollection));

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
    $("#collection-grid").addEventListener("click", e => { const c = e.target.closest(".card"); if (c) showDetail(c.dataset.id); });
    $("#card-modal").addEventListener("click", e => { if (e.target.id === "card-modal") $("#card-modal").hidden = true; });

    renderHeader(); renderCollection();
    setInterval(renderHeader, 1000);
  }
  init();
})();
