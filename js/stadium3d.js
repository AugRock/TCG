/*
 * Vue 3D « à l'intérieur du stade » pour les cartes légendaires.
 * Stade généré (pas une maquette exacte) : la taille des tribunes suit la capacité,
 * le terrain suit le sport. Les infos de la carte sont intégrées au décor :
 * écran géant, panneaux LED qui défilent, tifo dans la tribune.
 *
 * openStadium(card, { sport, fromEl, onDetails }) — chargé à la demande (import dynamique).
 */
import * as THREE from "./vendor/three.module.min.js";

const fmt = n => Number(n).toLocaleString("fr-FR");

// Couleurs des sièges, choisies à partir de l'identifiant de la carte (stable d'une visite à l'autre)
const PALETTES = [
  ["#1d4ed8", "#e5e7eb", "#dc2626"], ["#0f766e", "#e5e7eb"], ["#7c3aed", "#f8fafc"], ["#b91c1c", "#111827"],
  ["#0369a1", "#f59e0b"], ["#15803d", "#f8fafc"], ["#1e3a8a", "#38bdf8"], ["#9a3412", "#fde68a"],
];
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const PITCH = {
  football: { L: 105, W: 68 }, rugby: { L: 100, W: 70 }, us: { L: 110, W: 49 }, athletisme: { L: 105, W: 68, track: true },
  hippique: { L: 160, W: 80 }, auto: { L: 160, W: 80 }, cyclisme: { L: 80, W: 40, track: true },
  default: { L: 60, W: 34 },
};

function textCanvas(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function pitchTexture(sport, L, W) {
  return textCanvas(1024, Math.round(1024 * W / L), (g, w, h) => {
    const stripes = 12;
    for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? "#2f8a3b" : "#2a7d35"; g.fillRect((i * w) / stripes, 0, w / stripes + 1, h); }
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 4;
    const m = 12, X = x => m + (x / L) * (w - 2 * m), Y = y => m + (y / W) * (h - 2 * m);
    g.strokeRect(X(0), Y(0), X(L) - X(0), Y(W) - Y(0));
    g.beginPath(); g.moveTo(X(L / 2), Y(0)); g.lineTo(X(L / 2), Y(W)); g.stroke();
    if (sport === "rugby") {
      for (const x of [22, L - 22, 5, L - 5]) { g.setLineDash(x === 5 || x === L - 5 ? [10, 10] : []); g.beginPath(); g.moveTo(X(x), Y(0)); g.lineTo(X(x), Y(W)); g.stroke(); }
      g.setLineDash([]);
    } else {
      g.beginPath(); g.arc(X(L / 2), Y(W / 2), (9.15 / L) * (w - 2 * m), 0, Math.PI * 2); g.stroke();
      for (const side of [0, 1]) {
        const x0 = side ? L - 16.5 : 0, x1 = side ? L : 16.5, y0 = W / 2 - 20.15, y1 = W / 2 + 20.15;
        g.strokeRect(X(Math.min(x0, x1)), Y(y0), X(16.5) - X(0), Y(y1) - Y(y0));
        const s0 = side ? L - 5.5 : 0;
        g.strokeRect(X(s0), Y(W / 2 - 9.16), X(5.5) - X(0), Y(18.32) - Y(0));
      }
    }
  });
}

function roundedRectShape(hw, hh, r, holeOffset) {
  const s = new THREE.Shape();
  const path = (shape, a, b, rad) => {
    shape.moveTo(-a + rad, -b); shape.lineTo(a - rad, -b); shape.quadraticCurveTo(a, -b, a, -b + rad);
    shape.lineTo(a, b - rad); shape.quadraticCurveTo(a, b, a - rad, b); shape.lineTo(-a + rad, b);
    shape.quadraticCurveTo(-a, b, -a, b - rad); shape.lineTo(-a, -b + rad); shape.quadraticCurveTo(-a, -b, -a + rad, -b);
  };
  path(s, hw, hh, r);
  if (holeOffset != null) { const hole = new THREE.Path(); path(hole, hw - holeOffset, hh - holeOffset, Math.max(2, r - holeOffset)); s.holes.push(hole); }
  return s;
}
// Point sur le contour d'un rectangle arrondi, paramètre u ∈ [0,1)
function ringPoint(hw, hh, r, u) {
  const straightX = 2 * (hw - r), straightY = 2 * (hh - r), arc = (Math.PI / 2) * r;
  const P = 2 * straightX + 2 * straightY + 4 * arc;
  let d = u * P;
  const segs = [
    [straightX, t => [-hw + r + t * straightX, -hh]],
    [arc, t => [hw - r + Math.sin(t * Math.PI / 2) * r, -hh + r - Math.cos(t * Math.PI / 2) * r]],
    [straightY, t => [hw, -hh + r + t * straightY]],
    [arc, t => [hw - r + Math.cos(t * Math.PI / 2) * r, hh - r + Math.sin(t * Math.PI / 2) * r]],
    [straightX, t => [hw - r - t * straightX, hh]],
    [arc, t => [-hw + r - Math.sin(t * Math.PI / 2) * r, hh - r + Math.cos(t * Math.PI / 2) * r]],
    [straightY, t => [-hw, hh - r - t * straightY]],
    [arc, t => [-hw + r - Math.cos(t * Math.PI / 2) * r, -hh + r - Math.sin(t * Math.PI / 2) * r]],
  ];
  for (const [len, f] of segs) { if (d <= len) return f(len ? d / len : 0); d -= len; }
  return segs[0][1](0);
}

export async function openStadium(card, { sport, fromEl, onDetails } = {}) {
  // ---------- Transition : la carte grossit jusqu'à remplir l'écran ----------
  const overlay = document.createElement("div");
  overlay.className = "s3d";
  overlay.innerHTML = `
    <canvas></canvas>
    <div class="s3d-flash"></div>
    <button class="s3d-close" aria-label="Retour">✕ Retour</button>
    <button class="s3d-info">Fiche du stade</button>
    <div class="s3d-hint">Glisse pour tourner · pince ou molette pour zoomer</div>`;
  document.body.appendChild(overlay);
  if (fromEl) {
    const r = fromEl.getBoundingClientRect();
    const clone = fromEl.cloneNode(true);
    clone.classList.add("s3d-zoom");
    Object.assign(clone.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
    document.body.appendChild(clone);
    clone.getBoundingClientRect();
    const s = Math.max(innerWidth / r.width, innerHeight / r.height) * 1.15;
    clone.style.transform = `translate(${innerWidth / 2 - (r.left + r.width / 2)}px, ${innerHeight / 2 - (r.top + r.height / 2)}px) scale(${s})`;
    clone.style.opacity = "0";
    setTimeout(() => clone.remove(), 900);
  }
  requestAnimationFrame(() => overlay.classList.add("s3d-in"));

  // ---------- Scène ----------
  const canvas = overlay.querySelector("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#060a16");
  scene.fog = new THREE.Fog("#060a16", 250, 700);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2000);

  const dims = PITCH[card.sport] || PITCH[sport && sport.key] || PITCH.default;
  const L = dims.L, W = dims.W;
  const tiers = Math.max(8, Math.min(30, Math.round((card.capacity || 20000) / 3000)));
  const run = 1.7, rise = 0.95;
  const baseHW = L / 2 + (dims.track ? 14 : 9), baseHH = W / 2 + (dims.track ? 14 : 9), baseR = 22;
  const pal = PALETTES[hash(card.id) % PALETTES.length];

  scene.add(new THREE.HemisphereLight("#cfd8ff", "#1b2a12", 0.9));
  const sun = new THREE.DirectionalLight("#fff3d6", 1.2); sun.position.set(80, 160, 60); scene.add(sun);

  // pelouse + piste éventuelle
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(baseHW * 2 + 4, baseHH * 2 + 4), new THREE.MeshLambertMaterial({ color: dims.track ? "#9a3b2a" : "#256b2f" }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(L + 6, W + 6), new THREE.MeshLambertMaterial({ map: pitchTexture(card.sport, L, W) }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.02; scene.add(pitch);

  // poteaux de rugby
  if (card.sport === "rugby") {
    const mat = new THREE.MeshLambertMaterial({ color: "#f8fafc" });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 14), mat); p.position.set(sx * (L / 2 + 3), 7, sz * 2.8); scene.add(p);
    }
    for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.6), mat); b.rotation.x = Math.PI / 2; b.position.set(sx * (L / 2 + 3), 3, 0); scene.add(b); }
  }
  // buts de football
  if (["football", "athletisme"].includes(card.sport) || !PITCH[card.sport]) {
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff" });
    for (const sx of [-1, 1]) {
      const x = sx * (L / 2 + 3);
      for (const z of [-3.66, 3.66]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.44), mat); p.position.set(x, 1.22, z); scene.add(p); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.32), mat); bar.rotation.x = Math.PI / 2; bar.position.set(x, 2.44, 0); scene.add(bar);
    }
  }

  // tribunes en gradins
  const standMat = [new THREE.MeshLambertMaterial({ color: pal[0] }), new THREE.MeshLambertMaterial({ color: pal[1] }), new THREE.MeshLambertMaterial({ color: "#1f2937" })];
  for (let k = 0; k < tiers; k++) {
    const concourse = k > 0 && k % 10 === 0;
    const hw = baseHW + k * run, hh = baseHH + k * run, rr = baseR + k * run;
    const height = 1.2 + k * rise + (k >= 10 ? 2 : 0) + (k >= 20 ? 2 : 0);
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(hw + run, hh + run, rr + run, run + 0.05), { depth: height, bevelEnabled: false, curveSegments: 10 });
    const m = new THREE.Mesh(geo, concourse ? standMat[2] : standMat[(Math.floor(k / 3) % 2 === 0 || pal.length < 2) ? 0 : 1]);
    m.rotation.x = -Math.PI / 2; scene.add(m);
  }
  const topH = 1.2 + tiers * rise + (tiers > 10 ? 2 : 0) + (tiers > 20 ? 2 : 0);
  const outerHW = baseHW + tiers * run, outerHH = baseHH + tiers * run, outerR = baseR + tiers * run;
  // mur extérieur + toit
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRectShape(outerHW + 3, outerHH + 3, outerR + 3, 3), { depth: topH + 6, bevelEnabled: false, curveSegments: 12 }), new THREE.MeshLambertMaterial({ color: "#2b3442" }));
  wall.rotation.x = -Math.PI / 2; scene.add(wall);
  const roofDepth = Math.min(30, tiers * run * 0.8);
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRectShape(outerHW + 3, outerHH + 3, outerR + 3, roofDepth), { depth: 1.2, bevelEnabled: false, curveSegments: 12 }),
    new THREE.MeshLambertMaterial({ color: "#d1d5db", transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  roof.rotation.x = -Math.PI / 2; roof.position.y = topH + 6; scene.add(roof);
  // rampe lumineuse sous le toit
  const lightRing = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRectShape(outerHW + 3 - roofDepth + 1.5, outerHH + 3 - roofDepth + 1.5, outerR, 1.5), { depth: 0.6, bevelEnabled: false, curveSegments: 12 }),
    new THREE.MeshBasicMaterial({ color: "#fff7e0" }));
  lightRing.rotation.x = -Math.PI / 2; lightRing.position.y = topH + 5.6; scene.add(lightRing);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const spot = new THREE.SpotLight("#fff4dc", 900, 500, 0.7, 0.6, 1.2);
    spot.position.set(x * outerHW * 0.8, topH + 5, z * outerHH * 0.8); spot.target.position.set(-x * 10, 0, -z * 8);
    scene.add(spot, spot.target);
  }

  // public : un point par groupe de spectateurs
  const pos = [], col = [];
  const shirt = [...pal, "#f8fafc", "#facc15", "#ef4444", "#111827"].map(c => new THREE.Color(c));
  for (let k = 0; k < tiers; k++) {
    if (k > 0 && k % 10 === 0) continue;
    const hw = baseHW + k * run + run / 2, hh = baseHH + k * run + run / 2, rr = baseR + k * run + run / 2;
    const y = 1.2 + k * rise + (k >= 10 ? 2 : 0) + (k >= 20 ? 2 : 0) + 0.5;
    const n = Math.round((4 * (hw + hh)) / 0.9);
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.12) continue; // places vides
      const [x, z] = ringPoint(hw, hh, rr, (i + Math.random() * 0.5) / n);
      pos.push(x, y + Math.random() * 0.2, z);
      const c = shirt[Math.random() < 0.55 ? Math.floor(Math.random() * pal.length) : Math.floor(Math.random() * shirt.length)];
      col.push(c.r, c.g, c.b);
    }
  }
  const crowdGeo = new THREE.BufferGeometry();
  crowdGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  crowdGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const crowd = new THREE.Points(crowdGeo, new THREE.PointsMaterial({ size: 0.75, vertexColors: true }));
  scene.add(crowd);
  // flashs d'appareils photo
  const flashN = 160, flashPos = new Float32Array(flashN * 3);
  const flashGeo = new THREE.BufferGeometry(); flashGeo.setAttribute("position", new THREE.BufferAttribute(flashPos, 3));
  const flashes = new THREE.Points(flashGeo, new THREE.PointsMaterial({ size: 1.6, color: "#ffffff", transparent: true, opacity: 0.95 }));
  scene.add(flashes);
  const reseedFlashes = () => {
    for (let i = 0; i < flashN; i++) {
      const p = pos.length / 3, j = Math.floor(Math.random() * p) * 3;
      flashPos[i * 3] = pos[j]; flashPos[i * 3 + 1] = pos[j + 1] + 0.3; flashPos[i * 3 + 2] = pos[j + 2];
    }
    flashGeo.attributes.position.needsUpdate = true;
  };

  // ---------- Infos intégrées au décor ----------
  const facts = [card.name, `${fmt(card.capacity)} places`, card.year ? `Ouvert en ${card.year}` : null, card.city, card.region, card.club ? `Club : ${card.club}` : null, `Prestige ${card.prestige}/100`]
    .filter(Boolean).map(s => s.toUpperCase());
  // écran géant
  const screenTex = textCanvas(1024, 512, (g, w, h) => {
    g.fillStyle = "#05070c"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#f59e0b"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = "#f59e0b"; g.font = "bold 34px system-ui, sans-serif"; g.textAlign = "center";
    g.fillText("★ LÉGENDAIRE ★", w / 2, 62);
    g.fillStyle = "#fff"; let fs = 78; g.font = `900 ${fs}px system-ui, sans-serif`;
    while (g.measureText(card.name.toUpperCase()).width > w - 80 && fs > 36) { fs -= 4; g.font = `900 ${fs}px system-ui, sans-serif`; }
    g.fillText(card.name.toUpperCase(), w / 2, 160);
    g.fillStyle = "#9ca3af"; g.font = "600 36px system-ui, sans-serif";
    g.fillText(`${card.city}${card.region ? " · " + card.region : ""}`, w / 2, 215);
    const stats = [["CAPACITÉ", fmt(card.capacity)], ["OUVERTURE", card.year || "?"], ["PRESTIGE", card.prestige]];
    stats.forEach(([k, v], i) => {
      const x = w * (i + 0.5) / 3;
      g.fillStyle = "#fcd34d"; g.font = "900 72px system-ui, sans-serif"; g.fillText(String(v), x, 350);
      g.fillStyle = "#9ca3af"; g.font = "700 28px system-ui, sans-serif"; g.fillText(k, x, 395);
    });
    if (card.club) { g.fillStyle = "#e5e7eb"; g.font = "600 30px system-ui, sans-serif"; g.fillText(`Club résident : ${card.club}`, w / 2, 465); }
  });
  const screenW = Math.min(30, W * 0.5), screenH = screenW / 2;
  const roofInnerHW = outerHW + 3 - roofDepth, roofInnerHH = outerHH + 3 - roofDepth;
  for (const sx of [-1, 1]) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
    scr.position.set(sx * (roofInnerHW + 2), topH + 5 - screenH / 2, 0);
    scr.rotation.y = -sx * Math.PI / 2; scene.add(scr);
  }
  // photo réelle sur un second écran (si la photo autorise l'affichage en 3D)
  if (card.img && card.img.url) {
    new THREE.TextureLoader().setCrossOrigin("anonymous").load(card.img.url, tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
      const ratio = tex.image.width / tex.image.height || 1.5, h = 12, w = Math.min(h * ratio, L * 0.6);
      for (const sz of [-1, 1]) {
        const ph = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
        ph.position.set(0, topH + 5 - h / 2, sz * (roofInnerHH + 2)); ph.rotation.y = sz > 0 ? Math.PI : 0; scene.add(ph);
      }
    }, undefined, () => {});
  }
  // panneaux LED autour du terrain (texte qui défile)
  const ledText = "   " + facts.join("   •   ") + "   •";
  const ledTex = textCanvas(4096, 128, (g, w, h) => {
    g.fillStyle = "#020617"; g.fillRect(0, 0, w, h);
    g.font = "900 78px system-ui, sans-serif"; g.textBaseline = "middle";
    let x = 0; const tw = g.measureText(ledText).width;
    while (x < w) { g.fillStyle = "#fcd34d"; g.fillText(ledText, x, h / 2 + 4); x += tw; }
  });
  ledTex.wrapS = THREE.RepeatWrapping;
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false });
  const boardH = 1.1;
  for (const [len, x, z, ry] of [[L + 8, 0, -(W / 2 + 5), 0], [L + 8, 0, W / 2 + 5, Math.PI], [W + 8, -(L / 2 + 6), 0, Math.PI / 2], [W + 8, L / 2 + 6, 0, -Math.PI / 2]]) {
    const geo = new THREE.PlaneGeometry(len, boardH);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 60);
    const b = new THREE.Mesh(geo, ledMat); b.position.set(x, boardH / 2 + 0.05, z); b.rotation.y = ry; scene.add(b);
  }
  // tifo : le nom du stade déployé dans la tribune latérale
  const tifoTex = textCanvas(2048, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let fs = 300; g.font = `900 ${fs}px system-ui, sans-serif`;
    while (g.measureText(card.name.toUpperCase()).width > w - 80 && fs > 80) { fs -= 10; g.font = `900 ${fs}px system-ui, sans-serif`; }
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 18; g.strokeStyle = "#111827";
    g.strokeText(card.name.toUpperCase(), w / 2, h / 2); g.fillStyle = "#fcd34d"; g.fillText(card.name.toUpperCase(), w / 2, h / 2);
  });
  const tifoTiers = Math.min(tiers, 9), slope = Math.atan2(rise, run);
  const tifoLen = Math.hypot(tifoTiers * run, tifoTiers * rise);
  const tifo = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.8, tifoLen), new THREE.MeshBasicMaterial({ map: tifoTex, transparent: true, toneMapped: false, depthWrite: false }));
  tifo.rotation.x = -(Math.PI / 2 - slope);
  tifo.position.set(0, 1.2 + (tifoTiers * rise) / 2 + 0.9, -(baseHH + (tifoTiers * run) / 2));
  scene.add(tifo);

  // ---------- Caméra : arrivée par le ciel, puis on plonge dans le stade ----------
  const center = new THREE.Vector3(0, 7, 0);
  // la caméra « s'assoit » dans la tribune : toujours au-dessus des gradins
  let az = Math.PI * 0.62, zoom = 1.25, lift = 12, userUntil = 0;
  const camPos = () => {
    const off = tiers * run * 0.35 * zoom;
    const y = 1.2 + (Math.min(off, tiers * run) / run) * rise + 7 + lift;
    return new THREE.Vector3(Math.cos(az) * (baseHW + off), y, Math.sin(az) * (baseHH + off));
  };
  const intro = { t0: performance.now(), dur: 3800 };
  const from = new THREE.Vector3(outerHW * 1.6, topH * 9 + 120, outerHH * 2.6);
  const ease = k => 1 - Math.pow(1 - k, 3);

  // contrôles tactiles / souris
  let drag = null, pinch = null;
  canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, az, lift }; canvas.setPointerCapture(e.pointerId); userUntil = performance.now() + 4000; });
  canvas.addEventListener("pointermove", e => {
    if (!drag || pinch) return;
    az = drag.az - (e.clientX - drag.x) * 0.006;
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
    if (now > userUntil && k >= 1) az += 0.0012;
    const target = camPos();
    if (k < 1) camera.position.lerpVectors(from, target, ease(k)); else camera.position.copy(target);
    camera.lookAt(center);
    ledTex.offset.x = (now / 9000) % 1;
    if (now - lastFlash > 140) { reseedFlashes(); flashes.material.opacity = 0.4 + Math.random() * 0.6; lastFlash = now; }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ---------- Fermeture ----------
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
