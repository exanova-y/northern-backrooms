import {
  THREE, rng, Noise, pixTex, texMat, std, pbr, makeSky, envFrom, makeSun, kf, instanced, mtx, mix3, clamp, lerp, smooth
} from '../lib.js';

export const DUR = 5;

// ---------------- textures ----------------
const rgb = (h) => { const v = new THREE.Color(h).getHex(); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  return pixTex(w, h, null, { repeat, srgb, post: draw });
}
function brickTex() {
  const n = Noise(3);
  return pixTex(512, 512, (u, v) => {
    const row = Math.floor(v * 16), cu = (u * 4 + (row % 2) * 0.5) % 1, cv = (v * 16) % 1;
    const a = n.fbm(u, v, 8, 3);
    let c = mix3([232, 222, 196], [216, 202, 170], a);
    if (cu < 0.035 || cv < 0.11) c = [150, 140, 126];
    return c;
  }, { repeat: [3, 2] });
}
function floorTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6e5a4a'; ctx.fillRect(0, 0, w, h);
    const s = w / 4, c = s * 0.29;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * s, y = j * s;
      ctx.fillStyle = (i + j) % 3 ? '#b4583a' : '#c0673f';
      ctx.beginPath(); ctx.moveTo(x + c, y + 2); ctx.lineTo(x + s - c, y + 2); ctx.lineTo(x + s - 2, y + c); ctx.lineTo(x + s - 2, y + s - c); ctx.lineTo(x + s - c, y + s - 2); ctx.lineTo(x + c, y + s - 2); ctx.lineTo(x + 2, y + s - c); ctx.lineTo(x + 2, y + c); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = (i + j) % 2 ? '#1e1c1c' : '#e8e4dc'; ctx.fillRect(-c * 0.66, -c * 0.66, c * 1.32, c * 1.32); ctx.restore();
    }
  }, [6, 6]);
}
function floralTex(base = '#5a0e10', fg = '#e0782a', fg2 = '#f2b248', repeat = [3, 1]) {
  const r = rng(7);
  return canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const x = (i + (j % 2) * 0.5) * w / 6, y = (j + 0.5) * h / 3;
      ctx.strokeStyle = fg; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, w / 14, h / 7.5, 0, 0, 6.28); ctx.stroke();
      for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; ctx.fillStyle = k % 2 ? fg : fg2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 14, y + Math.sin(a) * 12, 6, 3.5, a, 0, 6.28); ctx.fill(); }
      ctx.fillStyle = fg2; ctx.beginPath(); ctx.arc(x, y, 6, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#c23a20'; for (let k = 0; k < 10; k++) { ctx.beginPath(); ctx.arc(x + (r() - 0.5) * 70, y + (r() - 0.5) * 70, 2, 0, 6.28); ctx.fill(); }
    }
  }, repeat);
}
function carpetTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8a1a1a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8dcc4'; ctx.fillRect(28, 28, w - 56, h - 56);
    ctx.fillStyle = '#9a2020'; ctx.fillRect(44, 44, w - 88, h - 88);
    ctx.fillStyle = '#efe4cc';
    ctx.beginPath(); ctx.moveTo(w / 2, 70); ctx.lineTo(w - 90, h / 2); ctx.lineTo(w / 2, h - 70); ctx.lineTo(90, h / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a1414'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 60, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#1e1a2a'; for (let i = 0; i < 90; i++) { const a = i * 2.4, rr = 70 + (i % 9) * 12; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr * 0.8, 4, 0, 6.28); ctx.fill(); }
    ctx.strokeStyle = '#1e1a2a'; ctx.lineWidth = 3; for (let k = 0; k < 18; k++) { ctx.beginPath(); ctx.moveTo(36 + k * 25, 36); ctx.lineTo(48 + k * 25, 20); ctx.stroke(); }
  });
}
function clothTex() {
  const r = rng(9);
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#c86478'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = r() * w, y = r() * h, s = 14 + r() * 26;
      ctx.strokeStyle = r() < 0.5 ? '#5ab8b0' : '#e6c8d0'; ctx.lineWidth = 2.5;
      for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + r(); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * s, y + Math.sin(a + 0.5) * s, x + Math.cos(a) * s * 1.4, y + Math.sin(a) * s * 1.4); ctx.stroke(); }
    }
  }, [2, 2]);
}
function cushionTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b01c1c'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f0b030'; ctx.fillRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#c42424'; ctx.fillRect(28, 28, w - 56, h - 56);
    ctx.fillStyle = '#f0c040'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 60, 44, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#b02020'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 40, 26, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#1c3a7a'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 16, 12, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#1c1c1c'; for (const [x, y] of [[50, 50], [w - 50, 50], [50, h - 50], [w - 50, h - 50]]) { ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.28); ctx.fill(); }
  });
}
function suzaniTex() {
  const r = rng(12);
  return canvasTex(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#ece0c6'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2e6a3a'; ctx.lineWidth = 5;
    for (let i = 0; i < 40; i++) { ctx.beginPath(); const x = r() * w, y = r() * h; ctx.moveTo(x, y); ctx.bezierCurveTo(x + 40, y - 30, x + 60, y + 40, x + 100, y + 10); ctx.stroke(); }
    const rose = (x, y, R) => {
      const cols = ['#b21e1e', '#e8dcc0', '#b21e1e', '#e0a030', '#b21e1e', '#1c2a5a'];
      cols.forEach((c, k) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, R * (1 - k * 0.15), 0, 6.28); ctx.fill(); });
      ctx.fillStyle = '#b21e1e'; for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 1.12, y + Math.sin(a) * R * 1.12, R * 0.12, 0, 6.28); ctx.fill(); }
    };
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) rose((i + 0.5) * w / 3, (j + 0.5) * h / 2, 90);
    for (let i = 0; i < 4; i++) rose(i * w / 3, h / 2, 40);
    ctx.strokeStyle = '#b21e1e'; ctx.lineWidth = 16; ctx.strokeRect(8, 8, w - 16, h - 16);
  });
}
function paxtaTex() { // blue "cotton" pattern on white porcelain
  return canvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4f2'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d3f8a';
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.5) * w / 4, y = h * 0.55;
      for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + 0.78; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 12, y + Math.sin(a) * 12, 9, 6, a, 0, 6.28); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(x - 20, y + 18); ctx.lineTo(x + 20, y + 18); ctx.lineTo(x, y + 38); ctx.fill();
    }
    ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 8, w, 8);
  }, [1, 1]);
}
function ceilingTex() {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1e3c72'; ctx.fillRect(0, 0, w, h);
    const s = w / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const x = i * s + s / 2, y = j * s + s / 2;
      ctx.fillStyle = '#c8962e'; ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28, R = k % 2 ? s * 0.22 : s * 0.42; ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a52a2a'; ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#2e8a6a'; ctx.beginPath(); ctx.arc(x, y, s * 0.07, 0, 6.28); ctx.fill();
    }
    ctx.strokeStyle = '#e8d8a8'; ctx.lineWidth = 4; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke(); }
  }, [2, 2]);
}
function riceTex() {
  const r = rng(21);
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d8a050'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const x = r() * w, y = r() * h; ctx.fillStyle = ['#f0d090', '#e8b868', '#fae4b0', '#c88a3a'][Math.floor(r() * 4)]; ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 6.28); ctx.beginPath(); ctx.ellipse(0, 0, 5, 1.8, 0, 0, 6.28); ctx.fill(); ctx.restore(); }
  });
}
function nonTex() {
  return canvasTex(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); g.addColorStop(0, '#e8c48a'); g.addColorStop(0.45, '#d6a262'); g.addColorStop(0.7, '#b8783a'); g.addColorStop(1, '#8a5424');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9a6a38'; for (let k = 0; k < 90; k++) { const a = k * 2.399, rr = Math.sqrt(k) * 7; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr, 2.2, 0, 6.28); ctx.fill(); }
    ctx.strokeStyle = '#a8703a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h / 2, 74, 0, 6.28); ctx.stroke();
    ctx.fillStyle = '#f4ecd8'; for (let k = 0; k < 60; k++) { const a = Math.random() * 6.28, rr = 80 + Math.random() * 30; ctx.beginPath(); ctx.ellipse(w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr, 2, 1, a, 0, 6.28); ctx.fill(); }
  });
}

// ---------------- props ----------------
function bowl(r, h, mat, inner = null) {
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r * (0.45 + 0.55 * Math.sin(t * Math.PI / 2)), h * t)); }
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), mat); outer.material.side = THREE.DoubleSide; g.add(outer);
  if (inner) { const f = new THREE.Mesh(new THREE.CircleGeometry(r * 0.93, 24), inner); f.rotation.x = -Math.PI / 2; f.position.y = h * 0.8; g.add(f); }
  return g;
}
function plate(r, mat) { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, 0.015, 32), mat); p.position.y = 0.0075; return p; }

export async function build({ renderer, scene, camera }) {
  makeSky(scene, { top: '#8ec0ea', horizon: '#f0e2c6', bottom: '#b8a080' });
  const env = envFrom(renderer, { top: '#d8c8a8', horizon: '#f4e0c0', bottom: '#8a5a3a' });
  scene.fog = null;
  renderer.toneMappingExposure = 1.05;
  scene.add(new THREE.HemisphereLight('#fff0dc', '#8a4a30', 1.25));
  const sun = new THREE.DirectionalLight('#ffe0b0', 5.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.position.set(9, 7, 2.5); sun.target.position.set(0, 0.5, -0.3); scene.add(sun, sun.target);
  const r = rng(1406);
  const wood = std({ color: '#b86a2a' }), woodDark = std({ color: '#8a4a1c' });

  // room shell: floor, walls, painted ceiling, lattice window on the right (sunlit)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), std({ map: floorTex() })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const brick = std({ map: brickTex() });
  const wall = (w, h, x, y, z, ry, mat = brick) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); return m; };
  wall(6, 3.8, 0, 1.9, -1.75, 0);                 // back wall
  // left wall with two recessed arched niches (tokcha)
  const NZ = [-0.9, 0.4];
  const lw = new THREE.Shape(); lw.moveTo(-3.5, 0); lw.lineTo(2.5, 0); lw.lineTo(2.5, 3.8); lw.lineTo(-3.5, 3.8); lw.lineTo(-3.5, 0);
  for (const zc of NZ) { const h = new THREE.Path(); const u = -zc; h.moveTo(u - 0.45, 1.5); h.lineTo(u + 0.45, 1.5); h.lineTo(u + 0.45, 2.6); h.absarc(u, 2.6, 0.45, 0, Math.PI, false); h.lineTo(u - 0.45, 1.5); lw.holes.push(h); }
  const lwg = new THREE.ShapeGeometry(lw, 16); { const uv = lwg.attributes.uv, p = lwg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + 3.5) / 2, p.getY(i) / 1.9); }
  const lwm = new THREE.Mesh(lwg, brick); lwm.position.set(-2.05, 0, 0); lwm.rotation.y = Math.PI / 2; lwm.receiveShadow = true; scene.add(lwm);
  const reveal = std({ color: '#d8c8a4' }), nicheBack = std({ color: '#4a3424' });
  for (const zc of NZ) {
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), nicheBack); back.position.set(-2.4, 2.3, zc); back.rotation.y = Math.PI / 2; scene.add(back);
    for (const s of [-1, 1]) { const sd = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 0.02), reveal); sd.position.set(-2.225, 2.05, zc + s * 0.45); scene.add(sd); }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.9), reveal); sill.position.set(-2.225, 1.5, zc); scene.add(sill);
    const vault = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16, 1, true, 0, Math.PI), reveal); vault.material = reveal.clone(); vault.material.side = THREE.DoubleSide; vault.rotation.z = Math.PI / 2; vault.rotation.y = 0; vault.position.set(-2.225, 2.6, zc); scene.add(vault);
  }
  wall(6, 3.8, 0, 1.9, 4, Math.PI);               // behind camera
  // right wall with an arched lattice window
  const rw = new THREE.Group(); scene.add(rw);
  const rb = (w, h, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, w), brick); m.position.set(2.4, y, z); m.castShadow = true; m.receiveShadow = true; rw.add(m); };
  rb(1.5, 3.8, 1.9, -1.0); rb(3.0, 3.8, 1.9, 2.5); rb(1.5, 0.7, 0.35, 0.5); rb(1.5, 1.2, 3.2, 0.5);
  const lat = []; for (let k = 0; k <= 12; k++) { lat.push(mtx(2.4, 1.65, -0.25 + k * 0.125, 0, 1)); } for (let k = 0; k <= 16; k++) lat.push(mtx(2.4, 0.7 + k * 0.125, 0.5, Math.PI / 2, 1));
  const latM = instanced(new THREE.BoxGeometry(0.04, 1.9, 0.02), woodDark, lat.slice(0, 13)); scene.add(latM);
  const latH = instanced(new THREE.BoxGeometry(0.04, 0.02, 1.5), woodDark, lat.slice(13).map((m) => { const e = new THREE.Matrix4(); const p = new THREE.Vector3(); p.setFromMatrixPosition(m); e.makeTranslation(p.x, p.y, 0.5); return e; })); scene.add(latH);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), std({ map: ceilingTex() })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 3.8, 1); scene.add(ceil);
  for (let x = -2; x <= 2; x += 0.8) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 6), std({ color: '#7a3e1a' })); b.position.set(x, 3.7, 1); scene.add(b); }
  // suzani on the back wall, niches with stacked quilts on the left wall, carved door
  const suz = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), std({ map: suzaniTex() })); suz.position.set(0, 2.55, -1.73); scene.add(suz);
  const quiltCols = ['#c42a2a', '#2a6ab0', '#e0a030', '#6a2a8a', '#2a8a5a', '#d84a7a', '#f0e0c0'];
  for (const zc of NZ) {
    for (let k = 0; k < 7; k++) { const q = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.84), std({ map: floralTex(quiltCols[(k + (zc > 0 ? 3 : 0)) % 7], '#f4d27a', '#ffffff', [1, 1]) })); q.position.set(-2.24, 1.59 + k * 0.145, zc); q.castShadow = true; scene.add(q); }
    const archTop = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.035, 6, 16, Math.PI), woodDark); archTop.rotation.y = Math.PI / 2; archTop.position.set(-2.04, 2.6, zc); scene.add(archTop);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.3), std({ map: canvasTex(256, 512, (ctx, w, h) => { ctx.fillStyle = '#6a3a1a'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#3a1e0c'; ctx.lineWidth = 6; for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) { ctx.strokeRect(20 + i * (w / 2 - 10), 30 + j * 115, w / 2 - 30, 95); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, cx = 20 + i * (w / 2 - 10) + (w / 2 - 30) / 2, cy = 30 + j * 115 + 47; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18, 10, 0, 6.28); ctx.stroke(); } } }) }));
  door.position.set(-2.04, 1.15, 2.2); door.rotation.y = Math.PI / 2; scene.add(door);

  // ---- the tapchan ----
  const T = new THREE.Group(); scene.add(T);
  const platform = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 2.4), wood); platform.position.y = 0.39; platform.castShadow = platform.receiveShadow = true; T.add(platform);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.33, 2.36), woodDark); skirt.position.y = 0.17; T.add(skirt);
  // turned balusters
  const bp = []; bp.push(new THREE.Vector2(0.025, 0)); bp.push(new THREE.Vector2(0.03, 0.05)); bp.push(new THREE.Vector2(0.018, 0.12)); bp.push(new THREE.Vector2(0.034, 0.2)); bp.push(new THREE.Vector2(0.034, 0.26)); bp.push(new THREE.Vector2(0.018, 0.33)); bp.push(new THREE.Vector2(0.026, 0.4)); bp.push(new THREE.Vector2(0.02, 0.44));
  const balGeo = new THREE.LatheGeometry(bp, 8);
  const bal = [];
  const railRun = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.11); for (let i = 0; i <= n; i++) { const t = i / n; bal.push(mtx(lerp(x0, x1, t), 0.45, lerp(z0, z1, t))); } const rail = new THREE.Mesh(new THREE.BoxGeometry(L, 0.07, 0.09), wood); rail.position.set((x0 + x1) / 2, 0.93, (z0 + z1) / 2); rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0); rail.castShadow = true; T.add(rail); };
  railRun(-1.25, -1.15, 1.25, -1.15); railRun(-1.25, -1.15, -1.25, 1.15); railRun(1.25, -1.15, 1.25, 1.15); railRun(-1.25, 1.15, -0.2, 1.15);
  T.add(instanced(balGeo, wood, bal));
  for (const [x, z] of [[-1.25, -1.15], [1.25, -1.15], [-1.25, 1.15], [1.25, 1.15], [-0.2, 1.15]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.6, 0.11), wood); post.position.set(x, 0.75, z); post.castShadow = true; T.add(post);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), std({ color: '#c47a34' })); knob.position.set(x, 1.13, z); knob.castShadow = true; T.add(knob);
  }
  // carpet + kurpacha mattresses + cushions
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.7), std({ map: carpetTex() })); carpet.rotation.x = -Math.PI / 2; carpet.position.set(0.1, 0.452, 0.1); carpet.receiveShadow = true; T.add(carpet);
  const kmat = std({ map: floralTex() });
  for (const [w, d, x, z] of [[2.4, 0.55, 0, -0.85], [0.55, 1.7, -0.95, 0.3], [0.55, 1.7, 0.95, 0.3]]) { const k = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), kmat); k.position.set(x, 0.5, z); k.castShadow = k.receiveShadow = true; T.add(k); }
  const cmat = std({ map: cushionTex() });
  for (const [x, z, ry] of [[-0.6, -1.02, 0], [0.6, -1.02, 0], [-1.1, 0.0, Math.PI / 2], [1.1, 0.1, -Math.PI / 2], [-1.1, 0.9, Math.PI / 2]]) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.14, 4, 4, 1), cmat); const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i); p.setZ(i, zz * (1 - Math.pow(Math.max(Math.abs(p.getX(i)) / 0.275, Math.abs(p.getY(i)) / 0.21), 4) * 0.6)); } c.geometry.computeVertexNormals();
    c.position.set(x, 0.74, z); c.rotation.set(-0.25, ry, 0); c.castShadow = true; T.add(c);
  }
  // low table with pink cloth under clear plastic
  const TY = 0.82;
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.86), std({ map: clothTex() })); table.position.set(0.05, TY - 0.025, 0.1); table.castShadow = true; table.receiveShadow = true; T.add(table);
  const drop = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.16, 0.92), std({ map: clothTex() })); drop.position.set(0.05, TY - 0.1, 0.1); T.add(drop);
  const plastic = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.96), pbr({ color: '#ffffff', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.0, envMap: env, envMapIntensity: 2.0 })); plastic.rotation.x = -Math.PI / 2; plastic.position.set(0.05, TY + 0.002, 0.1); T.add(plastic);
  for (const [x, z] of [[-0.5, -0.28], [0.6, -0.28], [-0.5, 0.48], [0.6, 0.48]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), woodDark); l.position.set(x, 0.6, z); T.add(l); }

  // ---- food ----
  const F = new THREE.Group(); F.position.set(0.05, TY, 0.1); T.add(F);
  const porcelain = std({ map: paxtaTex() }), white = std({ color: '#f4f2ec' });
  // plov on a big lagan
  const lagan = plate(0.24, porcelain); F.add(lagan);
  const laganRim = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.012, 6, 40), std({ color: '#1d3f8a' })); laganRim.rotation.x = Math.PI / 2; laganRim.position.y = 0.016; F.add(laganRim);
  const moundG = new THREE.SphereGeometry(0.19, 32, 12, 0, 6.29, 0, Math.PI / 2); moundG.scale(1, 0.42, 1);
  const mound = new THREE.Mesh(moundG, std({ map: riceTex() })); mound.position.y = 0.014; mound.castShadow = true; F.add(mound);
  const carrotM = std({ color: '#e8761e' }), meatM = std({ color: '#6a3a22' });
  const cr = [], mt = [], chick = [];
  for (let i = 0; i < 160; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 0.17, y = 0.014 + 0.08 * Math.sqrt(Math.max(0, 1 - (rr / 0.19) ** 2)); cr.push(mtx(Math.cos(a) * rr, y + 0.002, Math.sin(a) * rr, r() * 6, 1, 1, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5)); }
  F.add(instanced(new THREE.BoxGeometry(0.035, 0.005, 0.006), carrotM, cr, { cast: false }));
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28, rr = i === 0 ? 0 : 0.07 + r() * 0.05; mt.push(mtx(Math.cos(a) * rr, 0.08 - rr * 0.35, Math.sin(a) * rr, r() * 6, 1, 1, r(), r())); }
  F.add(instanced(new THREE.BoxGeometry(0.04, 0.03, 0.035), meatM, mt));
  for (let i = 0; i < 40; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * 0.16; chick.push(mtx(Math.cos(a) * rr, 0.014 + 0.08 * Math.sqrt(Math.max(0, 1 - (rr / 0.19) ** 2)) + 0.004, Math.sin(a) * rr)); }
  F.add(instanced(new THREE.SphereGeometry(0.008, 6, 4), std({ color: '#e0c070' }), chick, { cast: false }));
  const garlic = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), std({ color: '#efe6d2' })); garlic.scale.set(1, 0.85, 1); garlic.position.set(0, 0.105, 0); F.add(garlic);
  for (let i = 0; i < 4; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), white); e.scale.set(1, 0.7, 1.3); e.position.set(Math.cos(i * 1.57 + 0.6) * 0.06, 0.09, Math.sin(i * 1.57 + 0.6) * 0.06); F.add(e); }
  // manti with sour cream
  const manti = new THREE.Group(); manti.position.set(-0.38, 0, -0.18); F.add(manti);
  manti.add(plate(0.13, porcelain));
  const mG = new THREE.SphereGeometry(0.042, 20, 12); { const p = mG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x); const pleat = y > 0 ? 1 + 0.12 * Math.sin(a * 8) * (y / 0.042) : 1; p.setXYZ(i, x * pleat, y > 0 ? y * 0.85 + 0.006 * Math.sin(a * 8) : y * 0.35, z * pleat); } mG.computeVertexNormals(); }
  const mantiM = pbr({ color: '#f2ead8', roughness: 0.35, envMap: env, envMapIntensity: 0.6 });
  for (const [x, z] of [[0, 0], [0.07, 0.04], [-0.07, 0.03], [0.03, -0.07], [-0.05, -0.06], [0.07, -0.04]]) { const m = new THREE.Mesh(mG, mantiM); m.position.set(x, 0.03, z); m.rotation.y = r() * 6; m.castShadow = true; manti.add(m); }
  const pep = []; for (let i = 0; i < 40; i++) pep.push(mtx((r() - 0.5) * 0.18, 0.068, (r() - 0.5) * 0.16)); manti.add(instanced(new THREE.BoxGeometry(0.004, 0.002, 0.004), std({ color: '#b02010' }), pep, { cast: false }));
  const qat = bowl(0.04, 0.03, std({ map: paxtaTex() }), std({ color: '#faf8f0' })); qat.position.set(0.11, 0.0, 0.09); manti.add(qat);
  // samsa
  const samsa = new THREE.Group(); samsa.position.set(0.4, 0, -0.2); F.add(samsa);
  samsa.add(plate(0.12, porcelain));
  const tri = new THREE.Shape(); tri.moveTo(-0.045, -0.03); tri.lineTo(0.045, -0.03); tri.lineTo(0, 0.05); tri.lineTo(-0.045, -0.03);
  const sG = new THREE.ExtrudeGeometry(tri, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3 }); sG.rotateX(-Math.PI / 2);
  const sesT = canvasTex(128, 128, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#d89440'); g.addColorStop(1, '#a8621e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f6ead0'; for (let i = 0; i < 70; i++) { ctx.save(); ctx.translate(Math.random() * w, Math.random() * h); ctx.rotate(Math.random() * 6); ctx.beginPath(); ctx.ellipse(0, 0, 3, 1.5, 0, 0, 6.28); ctx.fill(); ctx.restore(); } }, [8, 8]);
  const samM = pbr({ map: sesT, roughness: 0.45, envMap: env, envMapIntensity: 0.5 });
  for (const [x, z, ry] of [[-0.04, 0.02, 0.2], [0.05, 0.03, 2.4], [0.0, -0.05, 4.3], [0.06, -0.06, 1.1]]) { const s = new THREE.Mesh(sG, samM); s.position.set(x, 0.02, z); s.rotation.y = ry; s.castShadow = true; samsa.add(s); }
  // non bread
  const nonG = new THREE.CylinderGeometry(0.12, 0.12, 0.035, 32, 1); { const p = nonG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); const rr = Math.hypot(x, z); if (y > 0 && rr < 0.08) p.setY(i, y - 0.018); } nonG.computeVertexNormals(); }
  const nonMs = [std({ color: '#b8783a' }), std({ map: nonTex() }), std({ color: '#9a6030' })];
  for (const [x, z, y] of [[-0.42, 0.24, 0.02], [-0.36, 0.27, 0.055]]) { const n = new THREE.Mesh(nonG, nonMs); n.position.set(x, y, z); n.rotation.set(0.05, r(), 0.04); n.castShadow = true; F.add(n); }
  // tea: pialas, teapot
  const teaM = std({ color: '#8a4a1a' });
  for (const [x, z] of [[0.22, 0.3], [0.5, 0.26], [-0.12, 0.34], [0.52, 0.02]]) { const p = bowl(0.045, 0.045, std({ map: paxtaTex() }), teaM); p.position.set(x, 0, z); F.add(p); }
  const pot = new THREE.Group(); pot.position.set(0.32, 0, 0.22); F.add(pot);
  const pb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), std({ map: paxtaTex() })); pb.scale.set(1, 0.85, 1); pb.position.y = 0.06; pb.castShadow = true; pot.add(pb);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.02, 16), porcelain); lid.position.y = 0.125; pot.add(lid);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.08, 8), porcelain); spout.position.set(0.075, 0.08, 0); spout.rotation.z = -0.8; pot.add(spout);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 12, Math.PI), porcelain); handle.position.set(-0.07, 0.07, 0); handle.rotation.z = Math.PI / 2; pot.add(handle);
  // cherries, achichuk salad, dried apricots, navat
  const cher = bowl(0.06, 0.04, std({ color: '#f4f2ec' })); cher.position.set(-0.05, 0, 0.32); F.add(cher);
  const cm = []; for (let i = 0; i < 14; i++) { const a = r() * 6.28, rr = r() * 0.04; cm.push(mtx(-0.05 + Math.cos(a) * rr, 0.035 + r() * 0.02, 0.32 + Math.sin(a) * rr)); }
  F.add(instanced(new THREE.SphereGeometry(0.013, 10, 8), pbr({ color: '#7a0a14', roughness: 0.2, envMap: env }), cm));
  const sal = bowl(0.065, 0.04, std({ map: paxtaTex() })); sal.position.set(0.18, 0, -0.33); F.add(sal);
  const sl = []; const slc = []; for (let i = 0; i < 16; i++) { const a = r() * 6.28, rr = r() * 0.045; sl.push(mtx(0.18 + Math.cos(a) * rr, 0.036 + r() * 0.01, -0.33 + Math.sin(a) * rr, r() * 6, 1, 1, r() * 0.4)); slc.push(new THREE.Color(i % 3 ? '#d42a1a' : '#f2eee0')); }
  const slices = instanced(new THREE.CylinderGeometry(0.016, 0.016, 0.006, 10), std({ color: '#fff' }), sl, { cast: false }); slc.forEach((c, i) => slices.setColorAt(i, c)); F.add(slices);
  const nav = plate(0.06, porcelain); nav.position.set(-0.2, 0, -0.34); F.add(nav);
  const nv = []; for (let i = 0; i < 12; i++) nv.push(mtx(-0.2 + (r() - 0.5) * 0.07, 0.022, -0.34 + (r() - 0.5) * 0.07, r() * 6, 1, 1, r(), r()));
  F.add(instanced(new THREE.BoxGeometry(0.018, 0.014, 0.014), pbr({ color: '#f4e8b8', roughness: 0.1, transparent: true, opacity: 0.85, envMap: env }), nv));
  // spoons
  for (const [x, z, ry] of [[-0.2, 0.05, 0.4], [0.25, 0.05, -0.3]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.012), pbr({ color: '#c8ccd0', metalness: 0.9, roughness: 0.25, envMap: env })); s.position.set(x, 0.004, z); s.rotation.y = ry; F.add(s); }

  // steam off the plov
  const steamT = canvasTex(64, 64, (ctx, w, h) => { const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }, [1, 1], false);
  const steam = []; for (let i = 0; i < 18; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamT, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s); steam.push({ s, ph: i / 18, dx: (r() - 0.5) * 0.12, dz: (r() - 0.5) * 0.12 }); }

  // ---- camera: look down at the table, then tilt up into the room ----
  const P0 = new THREE.Vector3(0.1, 1.58, 0.72), P1 = new THREE.Vector3(0.15, 1.7, 2.1);
  const L0 = new THREE.Vector3(0.02, TY, 0.08), L1 = new THREE.Vector3(-0.35, 2.55, -1.7);
  const pos = new THREE.Vector3(), tgt = new THREE.Vector3();
  return (t) => {
    const k = smooth(1.2, 4.7, t);
    pos.lerpVectors(P0, P1, k); pos.x += Math.sin(t * 0.6) * 0.03; pos.y += Math.sin(t * 1.1) * 0.008;
    tgt.lerpVectors(L0, L1, k * k * (3 - 2 * k) * 0.35 + k * 0.65);
    camera.position.copy(pos); camera.lookAt(tgt);
    steam.forEach((q) => { const a = ((t * 0.35 + q.ph) % 1); q.s.position.set(0.05 + q.dx + Math.sin(a * 5 + q.ph * 9) * 0.02, TY + 0.1 + a * 0.45, 0.1 + q.dz); const sc = 0.06 + a * 0.16; q.s.scale.set(sc, sc, 1); q.s.material.opacity = 0.22 * Math.sin(a * Math.PI); });
  };
}
