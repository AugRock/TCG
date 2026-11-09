/*
 * Vue 3D « à l'intérieur du lieu » pour les cartes légendaires.
 * Le décor est généré (ce n'est pas la maquette exacte du vrai lieu) et dépend du sport :
 *   stade (foot, rugby, athlé, tennis…), salle couverte (basket, hand, hockey, natation…),
 *   arènes, hippodrome, circuit, vélodrome.
 * La taille des tribunes suit la capacité. Les infos de la carte sont intégrées au décor :
 * écran géant (ou cube suspendu en salle), panneaux LED qui défilent, tifo / fronton de tribune.
 *
 * openStadium(card, { sport, fromEl, onDetails }) — chargé à la demande (import dynamique).
 */
import * as THREE from "./vendor/three.module.min.js";

const fmt = n => Number(n).toLocaleString("fr-FR");
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const PALETTES = [
  ["#1d4ed8", "#e5e7eb"], ["#0f766e", "#e5e7eb"], ["#7c3aed", "#f8fafc"], ["#b91c1c", "#111827"],
  ["#0369a1", "#f59e0b"], ["#15803d", "#f8fafc"], ["#1e3a8a", "#38bdf8"], ["#9a3412", "#fde68a"],
];

// Type de lieu selon le sport
export const LAYOUT = {
  football: "stadium", rugby: "stadium", us: "stadium", athletisme: "stadium", tennis: "stadium", pelote: "stadium", autre: "stadium",
  basket: "indoor", handball: "indoor", hockey: "indoor", multisport: "indoor", natation: "indoor", gym: "indoor", combat: "indoor",
  arenes: "arena", hippique: "racecourse", auto: "circuit", cyclisme: "velodrome",
};

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function floorTexture(sport, L, W) {
  const w = 1024, h = Math.max(256, Math.round(1024 * W / L)), m = 14;
  return canvasTex(w, h, g => {
    const X = x => m + (x / L) * (w - 2 * m), Y = y => m + (y / W) * (h - 2 * m), S = d => (d / L) * (w - 2 * m);
    const line = (c = "rgba(255,255,255,.92)", lw = 4) => { g.strokeStyle = c; g.lineWidth = lw; };
    const rect = (x, y, rw, rh) => g.strokeRect(X(x), Y(y), X(x + rw) - X(x), Y(y + rh) - Y(y));
    const arc = (x, y, r, a0 = 0, a1 = Math.PI * 2) => { g.beginPath(); g.arc(X(x), Y(y), S(r), a0, a1); g.stroke(); };
    const vline = x => { g.beginPath(); g.moveTo(X(x), Y(0)); g.lineTo(X(x), Y(W)); g.stroke(); };
    const grass = () => { for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "#2f8a3b" : "#2a7d35"; g.fillRect((i * w) / 12, 0, w / 12 + 1, h); } };
    switch (sport) {
      case "tennis":
        g.fillStyle = "#b5562f"; g.fillRect(0, 0, w, h); line();
        rect(0, 0, L, W); rect(0, W * 0.125, L, W * 0.75); vline(L / 2); vline(L / 2 - L * 0.27); vline(L / 2 + L * 0.27);
        g.beginPath(); g.moveTo(X(L / 2 - L * 0.27), Y(W / 2)); g.lineTo(X(L / 2 + L * 0.27), Y(W / 2)); g.stroke();
        break;
      case "hockey":
        g.fillStyle = "#eef6fb"; g.fillRect(0, 0, w, h);
        line("#c0262d", 6); vline(L / 2); line("#1d4ed8", 6); vline(L * 0.36); vline(L * 0.64);
        line("#c0262d", 3); vline(L * 0.07); vline(L * 0.93);
        line("#1d4ed8", 3); arc(L / 2, W / 2, 4.5);
        line("#c0262d", 3); for (const x of [L * 0.2, L * 0.8]) for (const y of [W * 0.3, W * 0.7]) arc(x, y, 4.5);
        line("#1f2937", 3); rect(0, 0, L, W);
        break;
      case "natation": {
        g.fillStyle = "#0e7490"; g.fillRect(0, 0, w, h);
        for (let i = 1; i < 8; i++) { g.setLineDash([18, 10]); line(i % 2 ? "#facc15" : "#ef4444", 5); g.beginPath(); g.moveTo(X(0), Y(i * W / 8)); g.lineTo(X(L), Y(i * W / 8)); g.stroke(); }
        g.setLineDash([]); g.fillStyle = "rgba(255,255,255,.12)";
        for (let i = 0; i < 40; i++) { g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 40, 6, 0, 0, Math.PI * 2); g.fill(); }
        line("#e5e7eb", 10); rect(0, 0, L, W);
        break;
      }
      case "basket": case "handball": case "multisport": case "gym": case "combat":
        for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? "#c58b4c" : "#b97d40"; g.fillRect(0, (i * h) / 40, w, h / 40 + 1); }
        line("#ffffff", 4); rect(0, 0, L, W); vline(L / 2); arc(L / 2, W / 2, sport === "basket" ? 1.8 : 3);
        if (sport === "basket") {
          for (const s of [0, 1]) { rect(s ? L - 5.8 : 0, W / 2 - 2.45, 5.8, 4.9); arc(s ? L - 1.6 : 1.6, W / 2, 6.75, s ? Math.PI / 2 : -Math.PI / 2, s ? Math.PI * 1.5 : Math.PI / 2); }
        } else {
          for (const s of [0, 1]) arc(s ? L : 0, W / 2, 6, s ? Math.PI / 2 : -Math.PI / 2, s ? Math.PI * 1.5 : Math.PI / 2);
          if (sport === "multisport") { line("#2563eb", 3); rect(L * 0.2, W * 0.1, L * 0.6, W * 0.8); line("#facc15", 3); rect(L * 0.1, W * 0.2, L * 0.8, W * 0.6); }
        }
        break;
      case "arenes": {
        const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
        gr.addColorStop(0, "#e8c98f"); gr.addColorStop(1, "#c9a463"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = "rgba(120,80,30,.08)"; for (let i = 0; i < 2000; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
        break;
      }
      case "rugby":
        grass(); line(); rect(0, 0, L, W); vline(L / 2); vline(22); vline(L - 22);
        g.setLineDash([12, 12]); for (const x of [5, L - 5, L / 2 - 10, L / 2 + 10]) vline(x); g.setLineDash([]);
        break;
      default: // football et dérivés
        grass(); line(); rect(0, 0, L, W); vline(L / 2); arc(L / 2, W / 2, 9.15);
        for (const s of [0, 1]) { rect(s ? L - 16.5 : 0, W / 2 - 20.15, 16.5, 40.3); rect(s ? L - 5.5 : 0, W / 2 - 9.16, 5.5, 18.32); }
    }
  });
}

// ---------------------------------------------------------------- géométrie
function roundedRectPath(target, a, b, r) {
  r = Math.min(r, a, b);
  target.moveTo(-a + r, -b); target.lineTo(a - r, -b); target.quadraticCurveTo(a, -b, a, -b + r);
  target.lineTo(a, b - r); target.quadraticCurveTo(a, b, a - r, b); target.lineTo(-a + r, b);
  target.quadraticCurveTo(-a, b, -a, b - r); target.lineTo(-a, -b + r); target.quadraticCurveTo(-a, -b, -a + r, -b);
}
function ringShape(hw, hh, r, width) {
  const s = new THREE.Shape(); roundedRectPath(s, hw, hh, r);
  if (width != null) { const hole = new THREE.Path(); roundedRectPath(hole, hw - width, hh - width, Math.max(1, r - width)); s.holes.push(hole); }
  return s;
}
// anneau extrudé vers le haut (hw/hh = bord extérieur)
function ringMesh(hw, hh, r, width, height, mat, y = 0) {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(hw, hh, r, width), { depth: height, bevelEnabled: false, curveSegments: 14 }), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
}
// surface plate (sol) en forme de rectangle arrondi / anneau
function flatShape(shape, mat, y = 0.03) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
}
// point sur le contour d'un rectangle arrondi, u ∈ [0,1)
function ringPoint(hw, hh, r, u) {
  r = Math.min(r, hw, hh);
  const sx = 2 * (hw - r), sy = 2 * (hh - r), arc = (Math.PI / 2) * r, q = t => t * Math.PI / 2;
  let d = u * (2 * sx + 2 * sy + 4 * arc);
  const segs = [
    [sx, t => [-hw + r + t * sx, -hh]], [arc, t => [hw - r + Math.sin(q(t)) * r, -hh + r - Math.cos(q(t)) * r]],
    [sy, t => [hw, -hh + r + t * sy]], [arc, t => [hw - r + Math.cos(q(t)) * r, hh - r + Math.sin(q(t)) * r]],
    [sx, t => [hw - r - t * sx, hh]], [arc, t => [-hw + r - Math.sin(q(t)) * r, hh - r + Math.cos(q(t)) * r]],
    [sy, t => [-hw, hh - r - t * sy]], [arc, t => [-hw + r - Math.cos(q(t)) * r, -hh + r - Math.sin(q(t)) * r]],
  ];
  for (const [len, f] of segs) { if (d <= len) return f(len ? d / len : 0); d -= len; }
  return segs[0][1](0);
}
// piste relevée (vélodrome) : bord intérieur au sol, bord extérieur surélevé, surtout dans les virages
function bankedRing(hw, hh, r, width, height, color) {
  const N = 240, pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const u = (i % N) / N;
    const [x0, z0] = ringPoint(hw - width, hh - width, Math.max(1, r - width), u);
    const [x1, z1] = ringPoint(hw, hh, r, u);
    const bank = Math.abs(x1) > hw - r ? height : height * 0.35;
    pos.push(x0, 0.05, z0, x1, bank, z1);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
}

// ---------------------------------------------------------------- scène
export async function openStadium(card, { sport, fromEl, onDetails } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "s3d";
  overlay.innerHTML = `
    <canvas></canvas>
    <div class="s3d-flash"></div>
    <button class="s3d-close" aria-label="Retour">✕ Retour</button>
    <button class="s3d-info">Fiche du lieu</button>
    <div class="s3d-hint">Glisse pour tourner · pince ou molette pour zoomer</div>`;
  document.body.appendChild(overlay);
  if (fromEl) { // la carte grossit jusqu'à remplir l'écran
    const r = fromEl.getBoundingClientRect(), clone = fromEl.cloneNode(true);
    clone.classList.add("s3d-zoom");
    Object.assign(clone.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    document.body.appendChild(clone); clone.getBoundingClientRect();
    const s = Math.max(innerWidth / r.width, innerHeight / r.height) * 1.15;
    clone.style.transform = `translate(${innerWidth / 2 - (r.left + r.width / 2)}px, ${innerHeight / 2 - (r.top + r.height / 2)}px) scale(${s})`;
    clone.style.opacity = "0";
    setTimeout(() => clone.remove(), 900);
  }
  requestAnimationFrame(() => overlay.classList.add("s3d-in"));

  const canvas = overlay.querySelector("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 3000);
  const layout = LAYOUT[card.sport] || "stadium";
  const pal = layout === "arena" ? ["#c9a66b", "#b38f57"] : PALETTES[hash(card.id) % PALETTES.length];
  const cap = card.capacity || 10000;
  const add = (...o) => { scene.add(...o); return o[0]; };
  const lambert = c => new THREE.MeshLambertMaterial({ color: c });

  // ---------- éléments d'information communs ----------
  const facts = [card.name, `${fmt(cap)} places`, card.year ? `Ouvert en ${card.year}` : null, card.city, card.region, card.club ? `Club : ${card.club}` : null, `Prestige ${card.prestige}/100`]
    .filter(Boolean).map(s => s.toUpperCase());
  const screenTex = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = "#05070c"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#f59e0b"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.textAlign = "center"; g.fillStyle = "#f59e0b"; g.font = "bold 34px system-ui, sans-serif";
    g.fillText(`★ LÉGENDAIRE · ${((sport && sport.label) || "").toUpperCase()} ★`, w / 2, 62);
    let fs = 78; g.font = `900 ${fs}px system-ui, sans-serif`;
    while (g.measureText(card.name.toUpperCase()).width > w - 80 && fs > 32) { fs -= 4; g.font = `900 ${fs}px system-ui, sans-serif`; }
    g.fillStyle = "#fff"; g.fillText(card.name.toUpperCase(), w / 2, 160);
    g.fillStyle = "#9ca3af"; g.font = "600 36px system-ui, sans-serif"; g.fillText(`${card.city}${card.region ? " · " + card.region : ""}`, w / 2, 215);
    [["CAPACITÉ", fmt(cap)], ["OUVERTURE", card.year || "?"], ["PRESTIGE", card.prestige]].forEach(([k, v], i) => {
      const x = w * (i + 0.5) / 3;
      g.fillStyle = "#fcd34d"; g.font = "900 72px system-ui, sans-serif"; g.fillText(String(v), x, 350);
      g.fillStyle = "#9ca3af"; g.font = "700 28px system-ui, sans-serif"; g.fillText(k, x, 395);
    });
    if (card.club) { g.fillStyle = "#e5e7eb"; g.font = "600 30px system-ui, sans-serif"; g.fillText(`Club résident : ${card.club}`.slice(0, 60), w / 2, 465); }
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  const ledText = "   " + facts.join("   •   ") + "   •";
  const ledTex = canvasTex(4096, 128, (g, w, h) => {
    g.fillStyle = "#020617"; g.fillRect(0, 0, w, h); g.font = "900 78px system-ui, sans-serif"; g.textBaseline = "middle";
    const tw = g.measureText(ledText).width; for (let x = 0; x < w; x += tw) { g.fillStyle = "#fcd34d"; g.fillText(ledText, x, h / 2 + 4); }
  }, true);
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false });
  const ledBoard = (len, x, z, ry, h = 1.1, y = 0) => {
    const geo = new THREE.PlaneGeometry(len, h), uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 60);
    const b = add(new THREE.Mesh(geo, ledMat)); b.position.set(x, y + h / 2 + 0.05, z); b.rotation.y = ry; return b;
  };
  const textTex = (text, color = "#fcd34d", stroke = "#111827") => canvasTex(2048, 512, (g, w, h) => {
    let fs = 300; g.font = `900 ${fs}px system-ui, sans-serif`;
    while (g.measureText(text).width > w - 80 && fs > 70) { fs -= 10; g.font = `900 ${fs}px system-ui, sans-serif`; }
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 18; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2);
    g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  });
  const photoScreen = place => {
    if (!(card.img && card.img.url)) return;
    new THREE.TextureLoader().setCrossOrigin("anonymous").load(card.img.url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace; place(tex, (tex.image.width / tex.image.height) || 1.5);
    }, undefined, () => {});
  };
  const photoMesh = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));

  // public : un point = un groupe de spectateurs
  const crowdPos = [], crowdCol = [];
  const shirts = [...pal, "#f8fafc", "#facc15", "#ef4444", "#111827"].map(c => new THREE.Color(c));
  const addSpectator = (x, y, z) => {
    crowdPos.push(x, y + Math.random() * 0.2, z);
    const c = shirts[Math.random() < 0.55 ? Math.floor(Math.random() * pal.length) : Math.floor(Math.random() * shirts.length)];
    crowdCol.push(c.r, c.g, c.b);
  };
  // gradins en anneau autour d'une aire centrale
  function bowl({ hw, hh, r, tiers, run, rise, base = 1.2, concourse = 10, fill = 0.88 }) {
    const mats = pal.map(lambert), dark = lambert("#1f2937");
    const tierTop = k => base + k * rise + Math.floor(k / concourse) * 2;
    for (let k = 0; k < tiers; k++) {
      const gap = k > 0 && k % concourse === 0;
      add(ringMesh(hw + (k + 1) * run, hh + (k + 1) * run, r + (k + 1) * run, run + 0.05, tierTop(k), gap ? dark : mats[Math.floor(k / 3) % mats.length]));
      if (gap) continue;
      const mhw = hw + k * run + run / 2, mhh = hh + k * run + run / 2, mr = r + k * run + run / 2, n = Math.round((4 * (mhw + mhh)) / 0.9);
      for (let i = 0; i < n; i++) if (Math.random() < fill) { const [x, z] = ringPoint(mhw, mhh, mr, (i + Math.random() * 0.5) / n); addSpectator(x, tierTop(k) + 0.5, z); }
    }
    return { topH: tierTop(tiers), outerHW: hw + tiers * run, outerHH: hh + tiers * run, outerR: r + tiers * run };
  }
  // texte couché sur la pente d'une tribune (tifo)
  function tifoOnSlope(text, { hh, tiers, run, rise, width, base = 1.2, side = -1 }) {
    const n = Math.min(tiers, 9), slope = Math.atan2(rise, run), len = Math.hypot(n * run, n * rise);
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(width, len), new THREE.MeshBasicMaterial({ map: textTex(text), transparent: true, toneMapped: false, depthWrite: false })));
    m.rotation.order = "YXZ"; m.rotation.y = side < 0 ? 0 : Math.PI; m.rotation.x = -(Math.PI / 2 - slope);
    m.position.set(0, base + (n * rise) / 2 + 0.9, side * (hh + (n * run) / 2));
  }

  let rig, skyColor = "#060a16", stars = true, indoor = false;

  // ======================= STADE et ARÈNES (gradins tout autour, ciel ouvert) =======================
  if (layout === "stadium" || layout === "arena") {
    const arena = layout === "arena";
    const [L, W] = { football: [105, 68], rugby: [100, 70], us: [110, 49], athletisme: [105, 68], tennis: [36, 18], pelote: [54, 20], arenes: [62, 40] }[card.sport] || [105, 68];
    const track = card.sport === "athletisme";
    const margin = arena ? 2 : track ? 14 : card.sport === "tennis" ? 8 : 9;
    const hw = L / 2 + margin, hh = W / 2 + margin, r = arena ? Math.min(hw, hh) : 22;
    const tiers = Math.max(8, Math.min(arena ? 22 : 30, Math.round(cap / (arena ? 1200 : 3000))));
    const run = arena ? 1.4 : 1.7, rise = arena ? 0.9 : 0.95, base = arena ? 2.2 : 1.2;
    add(flatShape(ringShape(hw + 1, hh + 1, r + 1), lambert(arena ? "#c9a463" : track ? "#9a3b2a" : card.sport === "tennis" ? "#1e3a8a" : "#256b2f"), 0));
    if (arena) add(flatShape(ringShape(hw - 0.5, hh - 0.5, r - 0.5), new THREE.MeshLambertMaterial({ map: floorTexture("arenes", L, W) })));
    else { const f = add(new THREE.Mesh(new THREE.PlaneGeometry(L + 4, W + 4), new THREE.MeshLambertMaterial({ map: floorTexture(card.sport, L, W) }))); f.rotation.x = -Math.PI / 2; f.position.y = 0.04; }
    if (arena) add(ringMesh(hw + 0.3, hh + 0.3, r + 0.3, 0.4, 1.6, lambert("#8b1a1a"))); // barrière rouge
    const B = bowl({ hw, hh, r, tiers, run, rise, base, concourse: arena ? 99 : 10, fill: arena ? 0.8 : 0.88 });
    const white = lambert("#ffffff");
    if (card.sport === "rugby") {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14), white)); p.position.set(sx * (L / 2 + 1), 7, sz * 2.8); }
        const bar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.6), white)); bar.rotation.x = Math.PI / 2; bar.position.set(sx * (L / 2 + 1), 3, 0);
      }
    } else if (card.sport === "tennis") {
      const net = add(new THREE.Mesh(new THREE.PlaneGeometry(W * 1.1, 1), new THREE.MeshLambertMaterial({ color: "#111827", transparent: true, opacity: 0.8, side: THREE.DoubleSide })));
      net.rotation.y = Math.PI / 2; net.position.set(0, 0.5, 0);
    } else if (!arena) {
      for (const sx of [-1, 1]) {
        const x = sx * (L / 2 + 1.5);
        for (const z of [-3.66, 3.66]) { const p = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.44), white)); p.position.set(x, 1.22, z); }
        const bar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.32), white)); bar.rotation.x = Math.PI / 2; bar.position.set(x, 2.44, 0);
      }
    }
    if (!arena) {
      // toit en anneau, rampe lumineuse, écrans géants, panneaux LED, projecteurs
      const roofDepth = Math.min(30, tiers * run * 0.8);
      add(ringMesh(B.outerHW + 3, B.outerHH + 3, B.outerR + 3, 3, B.topH + 6, lambert("#2b3442")));
      add(ringMesh(B.outerHW + 3, B.outerHH + 3, B.outerR + 3, roofDepth, 1.2, new THREE.MeshLambertMaterial({ color: "#d1d5db", transparent: true, opacity: 0.85, side: THREE.DoubleSide }), B.topH + 6));
      add(ringMesh(B.outerHW + 4.5 - roofDepth, B.outerHH + 4.5 - roofDepth, B.outerR, 1.5, 0.6, new THREE.MeshBasicMaterial({ color: "#fff7e0" }), B.topH + 5.6));
      const rIW = B.outerHW + 3 - roofDepth, rIH = B.outerHH + 3 - roofDepth;
      const sw = Math.min(30, Math.max(14, W * 0.5)), sh = sw / 2;
      for (const sx of [-1, 1]) { const s = add(new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat)); s.position.set(sx * (rIW + 2), B.topH + 5 - sh / 2, 0); s.rotation.y = -sx * Math.PI / 2; }
      photoScreen((tex, ratio) => { for (const sz of [-1, 1]) { const h = 12, m = add(photoMesh(tex, Math.min(h * ratio, L * 0.6), h)); m.position.set(0, B.topH + 5 - h / 2, sz * (rIH + 2)); m.rotation.y = sz > 0 ? Math.PI : 0; } });
      ledBoard(L + 8, 0, -(W / 2 + 4), 0); ledBoard(L + 8, 0, W / 2 + 4, Math.PI); ledBoard(W + 8, -(L / 2 + 5), 0, Math.PI / 2); ledBoard(W + 8, L / 2 + 5, 0, -Math.PI / 2);
      for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const sp = new THREE.SpotLight("#fff4dc", 900, 500, 0.7, 0.6, 1.2); sp.position.set(x * B.outerHW * 0.8, B.topH + 5, z * B.outerHH * 0.8); sp.target.position.set(-x * 10, 0, -z * 8); add(sp, sp.target); }
    } else {
      // arènes : enceinte en pierre, affiches au-dessus de la barrière, fanions sur le pourtour
      add(ringMesh(B.outerHW + 2, B.outerHH + 2, B.outerR + 2, 2, B.topH + 3, lambert("#a8875a")));
      for (const sx of [-1, 1]) { const p = add(new THREE.Mesh(new THREE.PlaneGeometry(10, 5), screenMat)); p.position.set(sx * (hw + 0.6), base + 3, 0); p.rotation.y = -sx * Math.PI / 2; }
      const flagCols = ["#dc2626", "#facc15", "#f8fafc"];
      for (let i = 0; i < 48; i++) {
        const [x, z] = ringPoint(B.outerHW + 1, B.outerHH + 1, B.outerR + 1, i / 48);
        const f = add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshLambertMaterial({ color: flagCols[i % 3], side: THREE.DoubleSide })));
        f.position.set(x, B.topH + 4.2, z); f.lookAt(0, B.topH + 4.2, 0);
      }
      const torch = new THREE.PointLight("#ffd9a0", 3000, 0, 1.3); torch.position.set(0, B.topH + 30, 0); add(torch);
      skyColor = "#0b1630";
    }
    tifoOnSlope(card.name.toUpperCase(), { hh, tiers, run, rise, base, width: Math.min(L * 0.85, 90) });
    if (arena) tifoOnSlope(`${fmt(cap)} PLACES`, { hh, tiers, run, rise, base, width: L * 0.7, side: 1 });
    rig = { kind: "orbit", hw, hh, tiers, run, rise, base, look: 6 };
  }

  // ======================= SALLE COUVERTE et VÉLODROME =======================
  if (layout === "indoor" || layout === "velodrome") {
    const velo = layout === "velodrome";
    indoor = true; stars = false; skyColor = "#05070d";
    const [L, W] = velo ? [56, 22] : ({ basket: [28, 15], handball: [40, 20], hockey: [60, 30], natation: [50, 25], combat: [24, 24], gym: [40, 20], multisport: [44, 24] }[card.sport] || [44, 24]);
    const margin = velo ? 18 : card.sport === "natation" ? 6 : 4;
    const hw = L / 2 + margin, hh = W / 2 + margin, r = velo ? 22 : card.sport === "hockey" ? 10 : 6;
    const tiers = Math.max(7, Math.min(24, Math.round(cap / 900)));
    const run = 1.2, rise = 0.75, base = velo ? 5 : 1.2;
    add(flatShape(ringShape(hw + 1, hh + 1, r + 1), lambert(card.sport === "natation" ? "#cbd5e1" : "#374151"), 0));
    const f = add(new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshLambertMaterial({ map: floorTexture(velo ? "multisport" : card.sport, L, W) })));
    f.rotation.x = -Math.PI / 2; f.position.y = 0.04;
    if (card.sport === "hockey") add(ringMesh(L / 2 + 0.3, W / 2 + 0.3, 8.5, 0.3, 1.2, new THREE.MeshLambertMaterial({ color: "#f8fafc", transparent: true, opacity: 0.85 })));
    if (card.sport === "basket") {
      for (const sx of [-1, 1]) {
        const post = add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.05, 0.3), lambert("#111827"))); post.position.set(sx * (L / 2 + 1), 1.5, 0);
        const board = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 1.8), new THREE.MeshLambertMaterial({ color: "#e5e7eb", transparent: true, opacity: 0.7 }))); board.position.set(sx * (L / 2 - 0.2), 3.5, 0);
        const hoop = add(new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 8, 24), lambert("#f97316"))); hoop.rotation.x = Math.PI / 2; hoop.position.set(sx * (L / 2 - 0.5), 3.05, 0);
      }
    }
    if (velo) add(bankedRing(hw - 1, hh - 1, r - 1, 8, 4.5, "#c08a52"));
    const B = bowl({ hw, hh, r, tiers, run, rise, base, concourse: 12 });
    // salle fermée : murs, plafond, rampes lumineuses
    const roofY = B.topH + 9;
    add(ringMesh(B.outerHW + 2, B.outerHH + 2, B.outerR + 2, 2, roofY, lambert("#1f2937")));
    const ceil = add(new THREE.Mesh(new THREE.ShapeGeometry(ringShape(B.outerHW + 2, B.outerHH + 2, B.outerR + 2)), new THREE.MeshLambertMaterial({ color: "#0b1020", side: THREE.DoubleSide })));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = roofY;
    const panel = new THREE.MeshBasicMaterial({ color: "#fff7e0" });
    for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { const p = add(new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 1.2), panel)); p.position.set(i * B.outerHW / 3.5, roofY - 0.3, j * B.outerHH / 2.5); }
    const lamp = new THREE.PointLight("#fff4dc", 2500, 0, 1.4); lamp.position.set(0, roofY - 2, 0); add(lamp);
    // cube écran suspendu au-dessus de l'aire de jeu, avec un anneau LED
    const cubeW = Math.max(7, Math.min(14, L * 0.3)), cubeH = cubeW / 2, dark = lambert("#0b0f19");
    const cube = add(new THREE.Mesh(new THREE.BoxGeometry(cubeW, cubeH, cubeW), [screenMat, screenMat, dark, dark, screenMat, screenMat]));
    cube.position.set(0, Math.max(10, B.topH * 0.75), 0);
    const ringLed = add(new THREE.Mesh(new THREE.CylinderGeometry(cubeW * 0.72, cubeW * 0.72, 1, 48, 1, true), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false, side: THREE.DoubleSide })));
    ringLed.position.set(0, cube.position.y - cubeH / 2 - 0.9, 0);
    photoScreen((tex, ratio) => { for (const sz of [-1, 1]) { const h = 6, m = add(photoMesh(tex, h * ratio, h)); m.position.set(0, B.topH + 4, sz * (B.outerHH + 1)); m.rotation.y = sz > 0 ? Math.PI : 0; } });
    ledBoard(L + 2, 0, -(W / 2 + (velo ? 9.5 : 2)), 0, 0.9); ledBoard(L + 2, 0, W / 2 + (velo ? 9.5 : 2), Math.PI, 0.9);
    tifoOnSlope(card.name.toUpperCase(), { hh, tiers, run, rise, base, width: Math.min(L * 1.2, 60) });
    rig = { kind: "orbit", hw, hh, tiers, run, rise, base, look: Math.max(4, B.topH * 0.35), zoom: 1.4, ceiling: roofY - 2 };
  }

  // ======================= HIPPODROME et CIRCUIT (une grande tribune le long de la ligne droite) =======================
  if (layout === "racecourse" || layout === "circuit") {
    const horse = layout === "racecourse";
    const hw = horse ? 170 : 190, hh = horse ? 70 : 85, r = horse ? 70 : 45, trackW = horse ? 28 : 16;
    const g0 = add(new THREE.Mesh(new THREE.PlaneGeometry(900, 700), lambert(horse ? "#2d6a2f" : "#3d6b35"))); g0.rotation.x = -Math.PI / 2;
    add(flatShape(ringShape(hw, hh, r, trackW), lambert(horse ? "#4f9d4a" : "#3a3d42")));
    const white = lambert("#f8fafc");
    if (horse) { // lices blanches
      add(ringMesh(hw + 0.2, hh + 0.2, r + 0.2, 0.25, 1.1, white));
      add(ringMesh(hw - trackW + 0.1, hh - trackW + 0.1, r - trackW + 0.1, 0.25, 1.1, white));
    } else { // vibreurs rouge et blanc + ligne de départ en damier
      const kerb = canvasTex(64, 8, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#dc2626" : "#f8fafc"; g.fillRect(i * 8, 0, 8, h); } }, true);
      kerb.repeat.set(0.4, 0.4);
      for (const [a, b, rr] of [[hw, hh, r], [hw - trackW + 1.5, hh - trackW + 1.5, r - trackW + 1.5]]) add(flatShape(ringShape(a, b, rr, 1.5), new THREE.MeshLambertMaterial({ map: kerb }), 0.05));
      const chk = canvasTex(128, 32, g => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#111" : "#fff"; g.fillRect(i * 8, j * 8, 8, 8); } });
      const start = add(new THREE.Mesh(new THREE.PlaneGeometry(3, trackW), new THREE.MeshLambertMaterial({ map: chk })));
      start.rotation.x = -Math.PI / 2; start.position.set(20, 0.06, hh - trackW / 2);
    }
    const tiers = Math.max(8, Math.min(28, Math.round(cap / 3500))), run = 1.6, rise = 1;
    const len = Math.min(260, 80 + cap / 300), z0 = hh + 8;
    const mats = pal.map(lambert);
    for (let k = 0; k < tiers; k++) {
      const h = 1.2 + k * rise;
      const box = add(new THREE.Mesh(new THREE.BoxGeometry(len, h, run), mats[Math.floor(k / 3) % mats.length])); box.position.set(0, h / 2, z0 + k * run + run / 2);
      for (let x = -len / 2 + 0.5; x < len / 2; x += 0.9) if (Math.random() < 0.85) addSpectator(x, h + 0.5, z0 + k * run + run / 2);
    }
    const topH = 1.2 + tiers * rise, roofD = tiers * run * 0.9;
    const back = add(new THREE.Mesh(new THREE.BoxGeometry(len + 4, topH + 9, 2), lambert("#2b3442"))); back.position.set(0, (topH + 9) / 2, z0 + tiers * run + 1);
    const roof = add(new THREE.Mesh(new THREE.BoxGeometry(len + 4, 0.8, roofD), lambert("#d1d5db"))); roof.position.set(0, topH + 8, z0 + tiers * run - roofD / 2 + 2);
    // fronton de la tribune : le nom du lieu (vu depuis la piste) + panneau LED en bord de piste
    const fz = z0 + tiers * run - roofD + 1.9;
    const fasciaBg = add(new THREE.Mesh(new THREE.PlaneGeometry(len + 4, 4), lambert("#111827"))); fasciaBg.position.set(0, topH + 8, fz - 0.05); fasciaBg.rotation.y = Math.PI;
    const fascia = add(new THREE.Mesh(new THREE.PlaneGeometry(Math.min(len, 120), 4), new THREE.MeshBasicMaterial({ map: textTex(card.name.toUpperCase(), "#fcd34d", "#0b1020"), transparent: true, toneMapped: false })));
    fascia.position.set(0, topH + 8, fz - 0.1); fascia.rotation.y = Math.PI;
    ledBoard(len, 0, z0 - 2, 0, 1.2);
    // écran géant dans l'aire centrale, face à la tribune
    const sw = 36, sh = 18, sz = -hh * 0.25;
    const scr = add(new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat)); scr.position.set(0, sh / 2 + 6, sz);
    for (const sx of [-1, 1]) { const p = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), lambert("#374151"))); p.position.set(sx * sw * 0.35, 3, sz - 0.5); }
    photoScreen((tex, ratio) => { const h = 14, w = h * ratio, m = add(photoMesh(tex, w, h)); m.position.set(-sw / 2 - w / 2 - 8, h / 2 + 6, sz); });
    // le nom peint dans l'herbe du centre, lisible depuis la tribune
    const grassName = add(new THREE.Mesh(new THREE.PlaneGeometry(Math.min(hw * 1.2, 200), 30), new THREE.MeshBasicMaterial({ map: textTex(card.name.toUpperCase(), "rgba(255,255,255,.85)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false })));
    grassName.rotation.x = -Math.PI / 2; grassName.position.set(0, 0.06, sz + 26);
    // mâts d'éclairage
    for (const x of [-hw * 0.85, -hw * 0.45, hw * 0.45, hw * 0.85]) for (const z of [-hh - 12, hh - trackW - 6]) {
      const mast = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 35), lambert("#4b5563"))); mast.position.set(x, 17.5, z);
      const head = add(new THREE.Mesh(new THREE.BoxGeometry(6, 2, 1), new THREE.MeshBasicMaterial({ color: "#fff7e0" }))); head.position.set(x, 35, z);
    }
    for (const x of [-hw * 0.6, hw * 0.6]) { const sp = new THREE.SpotLight("#fff4dc", 4000, 900, 0.9, 0.6, 1.2); sp.position.set(x, 80, 0); sp.target.position.set(x * 0.6, 0, 0); add(sp, sp.target); }
    rig = { kind: "grandstand", y: 1.2 + tiers * 0.55 * rise + 4, z: z0 + tiers * 0.55 * run, lookZ: -hh * 0.35, span: len };
  }

  // ---------- lumière, ciel ----------
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, 300, 1400);
  add(new THREE.HemisphereLight("#cfd8ff", "#1b2a12", indoor ? 0.6 : 0.9));
  const sun = new THREE.DirectionalLight("#fff3d6", 1.1); sun.position.set(80, 160, 60); add(sun);
  if (stars) {
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) { const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2, R = 1200; sp.set([Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2, color: "#ffffff", sizeAttenuation: false, fog: false })));
  }
  const crowdGeo = new THREE.BufferGeometry();
  crowdGeo.setAttribute("position", new THREE.Float32BufferAttribute(crowdPos, 3));
  crowdGeo.setAttribute("color", new THREE.Float32BufferAttribute(crowdCol, 3));
  add(new THREE.Points(crowdGeo, new THREE.PointsMaterial({ size: 0.75, vertexColors: true })));
  const flashN = 160, flashPos = new Float32Array(flashN * 3), flashGeo = new THREE.BufferGeometry();
  flashGeo.setAttribute("position", new THREE.BufferAttribute(flashPos, 3));
  const flashes = add(new THREE.Points(flashGeo, new THREE.PointsMaterial({ size: 1.6, color: "#ffffff", transparent: true })));
  const reseedFlashes = () => {
    const n = crowdPos.length / 3; if (!n) return;
    for (let i = 0; i < flashN; i++) { const j = Math.floor(Math.random() * n) * 3; flashPos[i * 3] = crowdPos[j]; flashPos[i * 3 + 1] = crowdPos[j + 1] + 0.3; flashPos[i * 3 + 2] = crowdPos[j + 2]; }
    flashGeo.attributes.position.needsUpdate = true;
  };

  // ---------- caméra ----------
  let az = Math.PI * 0.62, zoom = rig.zoom || 1.25, lift = 12, yaw = 0, userUntil = 0;
  const lookAt = new THREE.Vector3();
  const camTarget = () => {
    if (rig.kind === "orbit") { // assis dans les gradins, on fait le tour
      const off = rig.tiers * rig.run * 0.35 * zoom;
      let y = rig.base + (Math.min(off, rig.tiers * rig.run) / rig.run) * rig.rise + 7 + lift;
      if (rig.ceiling) y = Math.min(y, rig.ceiling - 1);
      lookAt.set(0, rig.look, 0);
      return new THREE.Vector3(Math.cos(az) * (rig.hw + off), y, Math.sin(az) * (rig.hh + off));
    }
    // une seule tribune : on reste assis et on tourne la tête vers la piste
    lookAt.set(Math.sin(yaw) * 140, 6, rig.lookZ);
    return new THREE.Vector3(Math.sin(yaw) * rig.span * 0.15, rig.y + lift * 0.4, rig.z + (zoom - 1.25) * 30);
  };
  const from = rig.kind === "grandstand" ? new THREE.Vector3(-120, 160, -260) : new THREE.Vector3(260, 260, 420);
  const intro = { t0: performance.now(), dur: 3800 }, ease = k => 1 - Math.pow(1 - k, 3);
  let drag = null, pinch = null;
  canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, az, lift, yaw }; canvas.setPointerCapture(e.pointerId); userUntil = performance.now() + 4000; });
  canvas.addEventListener("pointermove", e => {
    if (!drag || pinch) return;
    az = drag.az - (e.clientX - drag.x) * 0.006;
    yaw = Math.max(-1.2, Math.min(1.2, drag.yaw - (e.clientX - drag.x) * 0.004));
    lift = Math.max(-5, Math.min(80, drag.lift + (e.clientY - drag.y) * 0.15));
    userUntil = performance.now() + 4000;
  });
  canvas.addEventListener("pointerup", () => (drag = null));
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoom = Math.max(0.15, Math.min(2.6, zoom * (1 + e.deltaY * 0.001))); userUntil = performance.now() + 4000; }, { passive: false });
  canvas.addEventListener("touchmove", e => {
    if (e.touches.length !== 2) { pinch = null; return; }
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (pinch) zoom = Math.max(0.15, Math.min(2.6, pinch.z * pinch.d / d)); else pinch = { d, z: zoom };
    userUntil = performance.now() + 4000;
  }, { passive: true });
  canvas.addEventListener("touchend", () => (pinch = null));
  const resize = () => { const w = overlay.clientWidth, h = overlay.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 75 : 55; camera.updateProjectionMatrix(); };
  resize(); addEventListener("resize", resize);

  let running = true, lastFlash = 0;
  const tick = now => {
    if (!running) return;
    const k = Math.min(1, (now - intro.t0) / intro.dur);
    if (now > userUntil && k >= 1) { az += 0.0012; if (rig.kind === "grandstand") yaw = Math.sin((now - intro.t0 - intro.dur) / 7000) * 0.35; }
    const target = camTarget();
    if (k < 1) camera.position.lerpVectors(from, target, ease(k)); else camera.position.copy(target);
    camera.lookAt(lookAt);
    ledTex.offset.x = (now / 9000) % 1;
    if (now - lastFlash > 140) { reseedFlashes(); flashes.material.opacity = 0.4 + Math.random() * 0.6; lastFlash = now; }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const close = () => {
    running = false; removeEventListener("resize", resize);
    overlay.classList.remove("s3d-in");
    setTimeout(() => {
      renderer.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); });
      overlay.remove();
    }, 400);
  };
  overlay.querySelector(".s3d-close").onclick = close;
  overlay.querySelector(".s3d-info").onclick = () => { close(); onDetails && onDetails(); };
  return { close };
}
