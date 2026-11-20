import * as THREE from 'three';

// ---------- colours come from the CSS tokens ----------
const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function tokenColor(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = '#000';
  probe.fillStyle = v;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const W = 4; // slab width
const BASE_T = 0.34;

export function createScene(canvas, { reduced }) {
  const C = {
    ink: tokenColor('--color-ink'), card: tokenColor('--color-card'), pear: tokenColor('--color-accent'),
    laravel: tokenColor('--color-laravel'), ui: tokenColor('--color-layer-ui'), mint: tokenColor('--color-mint'),
    mintDeep: tokenColor('--color-mint-deep'), blue: tokenColor('--color-accent-2'), kraft: tokenColor('--color-kraft'), sugar: tokenColor('--color-sugar'), sand: tokenColor('--color-sand'),
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  const camDir = new THREE.Vector3(1, 0.82, 1).normalize();

  const world = new THREE.Group();
  scene.add(world);

  const inkLine = new THREE.LineBasicMaterial({ color: C.ink, transparent: true });

  // every material in a layer, so the layer can fade as one
  function track(list, m) { m.transparent = true; m.userData.base = m.opacity; list.push(m); return m; }

  function shades(c) {
    return [c.clone(), c.clone().multiplyScalar(0.86), c.clone().multiplyScalar(0.72)];
  }

  function box(w, h, d, color, mats, opts = {}) {
    const [top, mid, dark] = shades(color);
    const m = [dark, dark, top, top, mid, mid].map((col) => track(mats, new THREE.MeshBasicMaterial({ color: col, ...opts })));
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, m);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), track(mats, inkLine.clone()));
    mesh.add(edges);
    return mesh;
  }

  function cyl(r, h, color, mats) {
    const geo = new THREE.CylinderGeometry(r, r, h, 28);
    const mesh = new THREE.Mesh(geo, [track(mats, new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.86) })), track(mats, new THREE.MeshBasicMaterial({ color })), track(mats, new THREE.MeshBasicMaterial({ color }))]);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), track(mats, inkLine.clone())));
    return mesh;
  }

  const dataPoints = [];
  const shopItems = [];
  const nodeItems = [];
  const shipItems = [];
  const shipLights = [];
  // ---------- the six layers ----------
  const defs = [
    { color: C.ui, t: BASE_T, detail: interfaceDetail },
    { color: C.laravel, t: BASE_T * 1.75, detail: laravelDetail },
    { color: C.sugar, t: BASE_T, detail: shopDetail },
    { color: C.mint, t: BASE_T, detail: nodeDetail },
    { color: C.pear, t: BASE_T, detail: dataDetail },
    { color: C.kraft, t: BASE_T * 1.2, detail: devopsDetail },
  ];

  const layers = defs.map((def, i) => {
    const g = new THREE.Group();
    const mats = [];
    const slab = box(W, def.t, W, def.color, mats);
    g.add(slab);
    const top = new THREE.Group();
    top.position.y = def.t / 2;
    g.add(top);
    def.detail(top, mats);
    world.add(g);
    return { g, mats, t: def.t, top };
  });

  function interfaceDetail(top, mats) {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const c = (i === 1 && j === -1) ? C.pear : C.card;
      const b = box(0.9, 0.08, 0.9, c, mats);
      b.position.set(i * 1.15, 0.04, j * 1.15);
      top.add(b);
    }
  }

  function laravelDetail(top, mats) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.07, 10, 64), track(mats, new THREE.MeshBasicMaterial({ color: C.card })));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.04; top.add(ring);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const tooth = box(0.28, 0.1, 0.18, C.card, mats);
      tooth.position.set(Math.cos(a) * 1.42, 0.05, Math.sin(a) * 1.42);
      tooth.rotation.y = -a;
      top.add(tooth);
    }
    const hub = cyl(0.5, 0.14, C.card, mats); hub.position.y = 0.07; top.add(hub);
  }

  function nodeDetail(top, mats) {
    const pts = [[-1, -0.6], [0, -1.2], [1.1, -0.4], [0.7, 1], [-0.7, 0.9], [0, 0]].map(([x, z]) => new THREE.Vector3(x, 0.12, z));
    const links = [[0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [0, 1], [2, 3]];
    const pos = [];
    links.forEach(([a, b]) => pos.push(...pts[a].toArray(), ...pts[b].toArray()));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    top.add(new THREE.LineSegments(lg, track(mats, new THREE.LineBasicMaterial({ color: C.ink, opacity: 0.6 }))));
    pts.forEach((p, i) => { const n = cyl(i === 5 ? 0.3 : 0.18, 0.18, C.card, mats); n.position.copy(p); n.userData.k = i; top.add(n); nodeItems.push(n); });
  }

  function dataDetail(top, mats) {
    [[-0.9, -0.2], [0.4, -1.1], [0.8, 0.8]].forEach(([x, z]) => { const c = cyl(0.36, 0.7, C.card, mats); c.position.set(x, 0.35, z); top.add(c); });
    const dot = new THREE.SphereGeometry(0.045, 8, 6);
    const dm = track(mats, new THREE.MeshBasicMaterial({ color: C.ink, opacity: 0.45 }));
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      const s = new THREE.Mesh(dot, dm);
      s.position.set((rnd() - 0.5) * 3.6, 0.03, (rnd() - 0.5) * 3.6);
      top.add(s); dataPoints.push(s);
    }
  }

  // the e-commerce layer: product cards on a shelf, and a cart
  function shopDetail(top, mats) {
    const spots = [[-1.2, -1.2], [0, -1.2], [1.2, -1.2], [-1.2, 0], [0, 0], [-1.2, 1.2]];
    spots.forEach(([x, z], k) => {
      const card = box(0.82, 0.1, 0.82, k === 4 ? C.laravel : C.card, mats);
      card.position.set(x, 0.05, z); card.userData.k = k; top.add(card); shopItems.push(card);
      const tag = box(0.3, 0.04, 0.14, k === 4 ? C.card : C.pear, mats); tag.position.set(0.18, 0.07, 0.22); card.add(tag);
    });
    const cart = box(0.9, 0.5, 0.9, C.pear, mats); cart.position.set(1.15, 0.25, 1.1); top.add(cart);
  }

  // the ship layer: a build, test, deploy pipeline on rails, and two servers it lands on
  function devopsDetail(top, mats) {
    const rail = box(3.2, 0.04, 0.18, C.card, mats); rail.position.set(-0.2, 0.02, -0.9); top.add(rail);
    [-1.5, -0.5, 0.5].forEach((x, k) => { const st = box(0.62, 0.22, 0.62, k === 2 ? C.mint : C.card, mats); st.position.set(x, 0.11, -0.9); st.userData.k = k; st.userData.x = x; top.add(st); shipItems.push(st); });
    [[0.9, 0.7], [1.5, 0.7]].forEach(([x, z]) => {
      const srv = box(0.48, 0.9, 0.7, C.sand, mats); srv.position.set(x, 0.45, z); top.add(srv);
      for (let r = 0; r < 3; r++) { const led = box(0.5, 0.03, 0.72, C.card, mats); led.position.set(x, 0.2 + r * 0.25, z); top.add(led); shipLights.push(led); }
    });
    const pipe = box(0.18, 0.04, 1.4, C.card, mats); pipe.position.set(0.5, 0.02, -0.05); top.add(pipe);
  }

  // ---------- City Care Lab: three glass labs rise out of the Laravel layer ----------
  const labs = new THREE.Group();
  layers[1].top.add(labs);
  const labColors = [C.ui, C.mint, C.pear];
  const labSpots = [[-0.95, -0.7], [0.95, -0.85], [0, 1.0]];
  const labMats = [];
  labSpots.forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const h = 1.5;
    const floor = box(1.15, 0.05, 1.15, labColors[i], labMats); floor.position.y = 0.025; g.add(floor);
    const geo = new THREE.BoxGeometry(1.15, h, 1.15);
    const glass = new THREE.Mesh(geo, track(labMats, new THREE.MeshBasicMaterial({ color: labColors[i], opacity: 0.22, depthWrite: false })));
    glass.position.y = h / 2;
    glass.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), track(labMats, new THREE.LineBasicMaterial({ color: C.ink }))));
    g.add(glass);
    for (let r = 0; r < 3; r++) { const rec = box(0.32, 0.16, 0.22, labColors[i], labMats); rec.position.set(-0.25 + r * 0.25, 0.3 + r * 0.32, 0); g.add(rec); }
    g.scale.y = 0.001;
    labs.add(g);
  });

  // ---------- hybrid RAG: a question splits into keyword and vector search, then merges ----------
  const rag = new THREE.Group();
  layers[4].top.add(rag);
  const ragMats = [];
  const answerY = 2.5;
  const docs = [[-1.4, -0.9], [-1.2, 0.3], [-0.5, 1.3], [-1.5, 1.4]].map(([x, z]) => { const d = box(0.42, 0.06, 0.32, C.card, ragMats); d.position.set(x, 0.05, z); rag.add(d); return d.position; });
  const hits = [[1.2, -0.8], [0.6, 0.2], [1.4, 0.9]].map(([x, z]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 10), track(ragMats, new THREE.MeshBasicMaterial({ color: C.mint }))); s.position.set(x, 0.12, z); rag.add(s); return s.position; });
  const streams = [];
  function stream(from, color, side) {
    const curve = new THREE.QuadraticBezierCurve3(from.clone(), new THREE.Vector3(from.x * 0.9, answerY * 0.75, from.z * 0.4), new THREE.Vector3(side * 0.35, answerY, 0));
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
    const line = new THREE.Line(geo, track(ragMats, new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.12 })));
    line.computeLineDistances();
    geo.setDrawRange(0, 0);
    rag.add(line); streams.push(geo);
  }
  docs.slice(0, 3).forEach((p) => stream(p, C.blue, -1));
  hits.forEach((p) => stream(p, C.mintDeep, 1));
  ragMats.forEach((m) => { m.opacity = 0; });

  // ---------- interaction ----------
  const pointer = { x: 0, y: 0 };
  let dragging = false, dragX = 0, spin = 0, spinTarget = 0;
  canvas.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1;
    if (dragging) { spinTarget += (e.clientX - dragX) * 0.008; dragX = e.clientX; }
  });
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') return; dragging = true; dragX = e.clientX; canvas.classList.add('is-dragging'); canvas.setPointerCapture(e.pointerId); });
  const endDrag = () => { dragging = false; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  // ---------- layout ----------
  let view = { w: 1, h: 1, mobile: false };
  function resize() {
    const w = innerWidth, h = innerHeight;
    view = { w, h, mobile: w < 720 };
    renderer.setPixelRatio(Math.min(devicePixelRatio, view.mobile ? 1.5 : 2));
    renderer.setSize(w, h, false);
    const aspect = w / h, size = 9;
    camera.left = -size * aspect / 2; camera.right = size * aspect / 2; camera.top = size / 2; camera.bottom = -size / 2;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // stage keyframes: gap between layers, zoom, which layer the camera looks at, screen offset of the target (in view heights)
  const KEYS = [
    { gap: 0.45, zoom: 0.6, focus: 'center', shift: 0.16, fade: [1, 1, 1, 1, 1, 1] },
    { gap: 1.3, zoom: 0.6, focus: 'center', shift: 0.05, fade: [1, 1, 1, 1, 1, 1] },
    { gap: 3.4, zoom: 1.0, focus: 1, shift: 0.04, fade: [0.14, 1, 0.14, 0.14, 0.14, 0.14] },
    { gap: 3.4, zoom: 1.0, focus: 2, shift: 0.06, fade: [0.14, 0.14, 1, 0.14, 0.14, 0.14] },
    { gap: 3.4, zoom: 1.0, focus: 3, shift: 0.06, fade: [0.14, 0.14, 0.14, 1, 0.14, 0.14] },
    { gap: 3.4, zoom: 1.0, focus: 4, shift: 0.1, fade: [0.12, 0.14, 0.14, 0.14, 1, 0.14] },
    { gap: 3.4, zoom: 1.0, focus: 5, shift: 0.08, fade: [0.12, 0.12, 0.14, 0.14, 0.14, 1] },
    { gap: 0.4, zoom: 0.46, focus: 'center', shift: -0.28, fade: [1, 1, 1, 1, 1, 1] },
  ];

  const state = { s: 0, gap: KEYS[0].gap, zoom: 1, ty: 0, shift: KEYS[0].shift, fade: [...KEYS[0].fade] };
  const target = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function layerYs(gap) {
    const ys = []; let y = 0;
    for (let i = 0; i < layers.length; i++) { if (i > 0) y -= layers[i - 1].t / 2 + gap + layers[i].t / 2; ys.push(y); }
    const mid = (ys[0] + ys[ys.length - 1]) / 2;
    return ys.map((v) => v - mid);
  }

  function sample(s) {
    const last = KEYS.length - 1, i = Math.min(last - 1, Math.floor(s)), f = smooth(0.18, 0.82, s - i);
    const a = KEYS[i], b = KEYS[Math.min(last, i + 1)];
    const ys = layerYs(lerp(a.gap, b.gap, f));
    const fy = (k) => (k.focus === 'center' ? 0 : ys[k.focus]);
    return { gap: lerp(a.gap, b.gap, f), zoom: lerp(a.zoom, b.zoom, f), ty: lerp(fy(a), fy(b), f), shift: lerp(a.shift, b.shift, f), fade: a.fade.map((v, k) => lerp(v, b.fade[k], f)) };
  }

  const clock = new THREE.Timer();
  function frame(scrollStage) {
    clock.update(); const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsed();
    const want = sample(scrollStage);
    const k = reduced ? 1 : 1 - Math.pow(0.0009, dt);
    state.gap = lerp(state.gap, want.gap, k); state.zoom = lerp(state.zoom, want.zoom, k); state.ty = lerp(state.ty, want.ty, k); state.shift = lerp(state.shift, want.shift, k);
    state.fade = state.fade.map((v, i) => lerp(v, want.fade[i], k));
    state.s = lerp(state.s, scrollStage, k);

    const ys = layerYs(state.gap);
    const idle = reduced ? 0 : (1 - smooth(0.2, 0.6, state.s)) + smooth(6.5, 6.9, state.s);
    layers.forEach((L, i) => {
      L.g.position.y = ys[i] + Math.sin(t * 1.05 + i * 0.9) * 0.06 * idle;
      L.mats.forEach((m) => { m.opacity = m.userData.base * state.fade[i]; });
    });

    // labs rise during the Laravel stop
    const rise = smooth(1.45, 1.95, state.s) * (1 - smooth(2.35, 2.75, state.s));
    labs.children.forEach((g, i) => { g.scale.y = Math.max(0.001, smooth(i * 0.12, 0.64 + i * 0.12, rise)); });
    labMats.forEach((m) => { m.opacity = m.userData.base * Math.min(1, rise * 3) * state.fade[1]; });

    // RAG streams draw during the AI stop
    // MarineParts: the product cards lift off the shelf
    const shop = smooth(2.45, 2.95, state.s) * (1 - smooth(3.35, 3.75, state.s));
    shopItems.forEach((b) => { const k = b.userData.k; b.position.y = 0.05 + smooth(k * 0.06, 0.6 + k * 0.06, shop) * (0.35 + (k % 3) * 0.2); });

    // Game APIs: the service nodes rise and pulse
    const games = smooth(3.45, 3.95, state.s) * (1 - smooth(4.35, 4.75, state.s));
    nodeItems.forEach((n) => { const k = n.userData.k; const grow = smooth(k * 0.07, 0.6 + k * 0.07, games) * (k === 5 ? 6 : 3.5 + (k % 3)); const pulse = reduced ? 0 : Math.sin(t * 2.4 + k) * 0.25 * games; n.scale.y = 1 + grow + pulse; n.position.y = 0.12 + 0.09 * (n.scale.y - 1); });

    // Shipping: builds travel down the pipeline and the servers light up
    const ship = smooth(5.45, 5.95, state.s) * (1 - smooth(6.35, 6.75, state.s));
    shipItems.forEach((b) => { const run = -1.6 + ((t * 0.45 + b.userData.k / 3) % 1) * 2.6; b.position.x = lerp(b.userData.x, reduced ? b.userData.x : run, ship); });
    shipLights.forEach((l, i) => { const on = ship > 0.5 && (reduced || Math.sin(t * 3 + i * 1.7) > -0.3); l.material[2].color.copy(on ? C.mint : C.card); });

    const ai = smooth(4.45, 4.95, state.s) * (1 - smooth(5.35, 5.7, state.s));
    streams.forEach((g, i) => g.setDrawRange(0, Math.floor(49 * smooth(i * 0.06, 0.7 + i * 0.05, ai))));
    ragMats.forEach((m) => { m.opacity = Math.min(1, ai * 2.5); });
    dataPoints.forEach((p, i) => { p.position.y = 0.03 + (reduced ? 0 : Math.sin(t * 2 + i) * 0.03 * ai); });

    // the world turns a little with the pointer, and by dragging
    if (!dragging) spinTarget *= reduced ? 0 : 0.94;
    spin = lerp(spin, spinTarget, reduced ? 1 : 0.12);
    const tilt = reduced ? 0 : 1;
    world.rotation.y = spin + pointer.x * 0.12 * tilt;
    world.rotation.x = pointer.y * 0.04 * tilt;

    // camera: zoom, then aim so the target sits at its screen offset
    const zoom = state.zoom * (view.mobile ? 0.62 : Math.min(1.15, Math.max(0.78, view.w / 1440)));
    camera.zoom = zoom; camera.updateProjectionMatrix();
    const viewH = (camera.top - camera.bottom) / zoom;
    const heroDrop = view.mobile ? 0.1 * (1 - smooth(0.3, 1, state.s)) : 0; // phones: badges sit above the cube
    target.set(0, state.ty + (state.shift + heroDrop) * viewH, 0);
    camera.position.copy(target).addScaledVector(camDir, 20);
    camera.lookAt(target);
    camera.updateMatrixWorld();

    renderer.render(scene, camera);
    return { s: state.s, ys };
  }

  // screen position of a point in world space
  function toScreen(x, y, z, out = {}) {
    tmp.set(x, y, z).applyMatrix4(world.matrixWorld).project(camera);
    out.x = (tmp.x * 0.5 + 0.5) * view.w; out.y = (-tmp.y * 0.5 + 0.5) * view.h;
    return out;
  }
  function layerEdge(i, side) {
    const L = layers[i];
    const half = W / 2;
    return side === 'right' ? toScreen(half, L.g.position.y, -half) : toScreen(-half, L.g.position.y, half);
  }

  return { frame, layerEdge };
}
