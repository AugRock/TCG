/*
 * Animation d'ouverture d'une carte légendaire : on traverse le tunnel des joueurs,
 * on débouche dans le stade, puis les infos de la carte apparaissent une par une.
 * Walkout.play(card, { cardHtml, sport, regionLabel }) → Promise (résolue à la fin ou au toucher final).
 */
const Walkout = (() => {
  const fmt = n => Number(n).toLocaleString("fr-FR");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function play(card, { cardHtml, sport }) {
    return new Promise(resolve => {
      const el = document.createElement("div");
      el.className = "walkout";
      el.innerHTML = `
        <canvas></canvas>
        <div class="wo-row"></div>
        <div class="wo-big"></div>
        <div class="wo-card"></div>
        <div class="wo-hint">Touchez pour passer</div>`;
      document.body.appendChild(el);
      const canvas = el.querySelector("canvas"), ctx = canvas.getContext("2d");
      const big = el.querySelector(".wo-big"), row = el.querySelector(".wo-row"), cardBox = el.querySelector(".wo-card"), hint = el.querySelector(".wo-hint");
      let W, H, dpr;
      const resize = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
      resize(); addEventListener("resize", resize);

      // Foule : points fixes répartis dans les tribunes (dessin de la phase « stade »)
      const crowd = Array.from({ length: 900 }, () => ({ a: Math.random() * Math.PI * 2, r: 0.55 + Math.random() * 0.45, c: `hsl(${Math.random() * 360},60%,${45 + Math.random() * 30}%)` }));

      // Étapes : [instant (s), action]
      const T = reduced ? 0.35 : 1;
      const steps = [
        [3.0, () => reveal(`<span class="wo-flag">${card.flag || ""}</span>`, card.region || "France")],
        [4.3, () => reveal(`<span class="wo-ico">${sport.icon}</span>`, sport.label)],
        [5.6, () => reveal(`<span class="wo-ico">📍</span>`, card.city)],
        [6.9, () => revealCount(card.capacity)],
        [8.6, () => showCard()],
      ].map(([t, f]) => [t * T, f]);
      let start = performance.now(), done = false, finished = false, si = 0;

      function reveal(icon, text) {
        if (big.dataset.chip) pushChip(big.dataset.chip);
        big.innerHTML = `<div class="wo-slam">${icon}<div class="wo-text">${esc(text)}</div></div>`;
        big.dataset.chip = `${icon.replace(/class="wo-(flag|ico)"/, 'class="wo-mini"')} ${esc(text)}`;
      }
      function revealCount(n) {
        if (big.dataset.chip) pushChip(big.dataset.chip);
        big.innerHTML = `<div class="wo-slam"><span class="wo-ico">👥</span><div class="wo-text"><span class="wo-num">0</span> places</div></div>`;
        const num = big.querySelector(".wo-num"), t0 = performance.now(), dur = 1200 * T;
        const tick = () => {
          const k = Math.min(1, (performance.now() - t0) / dur);
          num.textContent = fmt(Math.round(n * (1 - Math.pow(1 - k, 3))));
          if (k < 1 && !finished) requestAnimationFrame(tick);
        };
        tick();
        big.dataset.chip = `<span class="wo-mini">👥</span> ${fmt(n)}`;
      }
      function pushChip(html) { row.insertAdjacentHTML("beforeend", `<span class="wo-chip">${html}</span>`); }
      function showCard() {
        if (big.dataset.chip) pushChip(big.dataset.chip);
        big.innerHTML = ""; big.dataset.chip = "";
        cardBox.innerHTML = cardHtml + `<div class="wo-name">${esc(card.name)}</div>`;
        el.classList.add("wo-final");
        hint.textContent = "Touchez pour continuer";
        finished = true;
      }

      // Rendu canvas : tunnel puis stade illuminé
      function frame(now) {
        if (done) return;
        const t = (now - start) / 1000;
        const enter = 2.2 * T; // moment où l'on débouche sur la pelouse
        if (t < enter) drawTunnel(t / enter); else drawStadium(t - enter);
        if (t > enter - 0.15 * T && t < enter + 0.6 * T) { // flash de lumière à la sortie du tunnel
          const k = 1 - Math.abs((t - enter - 0.1 * T) / (0.5 * T));
          ctx.fillStyle = `rgba(255,236,190,${Math.max(0, k)})`; ctx.fillRect(0, 0, W, H);
        }
        while (si < steps.length && t >= steps[si][0]) steps[si++][1]();
        requestAnimationFrame(frame);
      }
      function drawTunnel(p) {
        const cx = W / 2, cy = H * 0.52;
        ctx.fillStyle = "#050608"; ctx.fillRect(0, 0, W, H);
        // lumière au bout du tunnel, qui grandit
        const R = Math.max(W, H) * (0.08 + p * p * 0.9);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        g.addColorStop(0, "rgba(255,244,214,1)"); g.addColorStop(0.35, "rgba(255,210,120,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // cadres du tunnel qui défilent vers nous
        const N = 14;
        for (let i = 0; i < N; i++) {
          const z = ((i / N - p * 2.2) % 1 + 1) % 1; // 0 = loin, 1 = près
          const s = 0.06 + Math.pow(z, 2.4) * 1.6;
          const w = W * s, h = H * s * 0.95;
          ctx.strokeStyle = `rgba(200,210,230,${0.08 + z * 0.35})`; ctx.lineWidth = 1 + z * 6;
          ctx.beginPath();
          ctx.moveTo(cx - w / 2, cy + h / 2); ctx.lineTo(cx - w / 2, cy - h / 4);
          ctx.quadraticCurveTo(cx, cy - h / 2 - h * 0.15, cx + w / 2, cy - h / 4);
          ctx.lineTo(cx + w / 2, cy + h / 2); ctx.stroke();
          // spots au plafond
          ctx.fillStyle = `rgba(255,250,235,${z * 0.8})`;
          ctx.beginPath(); ctx.arc(cx, cy - h * 0.42, 1 + z * 6, 0, Math.PI * 2); ctx.fill();
        }
        // lignes du sol
        ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 2;
        for (const k of [-1, -0.35, 0.35, 1]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + k * W, H); ctx.stroke(); }
      }
      function drawStadium(t) {
        const cx = W / 2, cy = H * 0.62;
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#04060d"); sky.addColorStop(0.55, "#101a33"); sky.addColorStop(1, "#071009");
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        const rx = W * 0.75, ry = H * 0.38;
        // tribunes + foule
        ctx.fillStyle = "#151b26"; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.25, ry * 1.25, 0, 0, Math.PI * 2); ctx.fill();
        for (const p of crowd) {
          const x = cx + Math.cos(p.a) * rx * (1 + p.r * 0.25), y = cy + Math.sin(p.a) * ry * (1 + p.r * 0.25) - p.r * 18;
          ctx.fillStyle = p.c; ctx.fillRect(x, y, 2, 2);
        }
        // pelouse
        const grass = ctx.createRadialGradient(cx, cy, 10, cx, cy, rx);
        grass.addColorStop(0, "#2f8f3a"); grass.addColorStop(1, "#14501c");
        ctx.fillStyle = grass; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.18, ry * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy - ry * 0.95); ctx.lineTo(cx, cy + ry * 0.95); ctx.stroke();
        // faisceaux des projecteurs
        for (let i = 0; i < 4; i++) {
          const sx = i < 2 ? W * 0.08 : W * 0.92, a = Math.sin(t * 0.9 + i * 1.7) * 0.35;
          ctx.save(); ctx.translate(sx, 0); ctx.rotate((i < 2 ? -0.45 : 0.45) + a);
          const beam = ctx.createLinearGradient(0, 0, 0, H * 1.1);
          beam.addColorStop(0, "rgba(255,240,200,.35)"); beam.addColorStop(1, "rgba(255,240,200,0)");
          ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(W * 0.18, H * 1.1); ctx.lineTo(-W * 0.18, H * 1.1); ctx.fill();
          ctx.restore();
        }
        // flashs d'appareils photo dans le public
        for (let i = 0; i < 26; i++) {
          if (Math.random() > 0.5) continue;
          const a = Math.random() * Math.PI * 2, r = 1.05 + Math.random() * 0.2;
          ctx.fillStyle = "rgba(255,255,255,.9)";
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r - 10, 1.5 + Math.random() * 2.5, 0, Math.PI * 2); ctx.fill();
        }
        // halo doré final
        if (el.classList.contains("wo-final")) {
          const g = ctx.createRadialGradient(cx, H * 0.45, 0, cx, H * 0.45, Math.max(W, H) * 0.6);
          g.addColorStop(0, "rgba(245,158,11,.35)"); g.addColorStop(1, "rgba(245,158,11,0)");
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        }
      }
      requestAnimationFrame(frame);

      el.addEventListener("click", () => {
        if (!finished) { // passer directement à la carte
          start = performance.now() - steps[steps.length - 1][0] * 1000 - 1;
          while (si < steps.length - 1) steps[si++][1]();
          return;
        }
        done = true; removeEventListener("resize", resize);
        el.classList.add("wo-out");
        setTimeout(() => { el.remove(); resolve(); }, 350);
      });
    });
  }
  return { play };
})();
