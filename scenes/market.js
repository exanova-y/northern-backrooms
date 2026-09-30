import {
  THREE, rng, Noise, pixTex, peelTex, concreteTex, dirtTex, tileTex, glowTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, person, instanced, mtx, mix3, clamp
} from '../lib.js';

export const DUR = 5;

export function porkTex(seed) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(256, 512, (u, v) => {
    const a = n.fbm(u, v, 4, 5), m = n.fbm(u * 2, v * 6, 6, 4);
    let c = mix3([196, 72, 78], [226, 120, 120], a);
    if (m > 0.62) c = mix3(c, [244, 226, 214], clamp((m - 0.62) * 6)); // marbling / fat seams
    if (u < 0.12) c = mix3([246, 236, 224], [236, 214, 200], a);       // back fat
    return c;
  }, {
    post: (ctx, w, h) => { ctx.strokeStyle = 'rgba(250,240,230,0.8)'; ctx.lineWidth = 6; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(w * 0.2, 60 + i * 60); ctx.bezierCurveTo(w * 0.5, 50 + i * 60, w * 0.7, 80 + i * 60, w, 70 + i * 60); ctx.stroke(); } }
  });
}
export function checkerTex() {
  const n = Noise(5);
  return pixTex(512, 512, (u, v) => {
    const c = (Math.floor(u * 8) + Math.floor(v * 8)) % 2;
    const a = n.fbm(u, v, 4, 3);
    const cu = (u * 8) % 1, cv = (v * 8) % 1;
    if (cu < 0.015 || cv < 0.015) return [120, 118, 110];
    return c ? [32, 32, 34].map((k) => k * (0.9 + a * 0.3)) : [226, 220, 196].map((k) => k * (0.92 + a * 0.12));
  }, { repeat: [3, 7] });
}
export function shelfTex(seed) {
  // rows of bottles/boxes on a shelf face, no lettering
  const r = rng(seed);
  const cols = ['#2a6a2a', '#8a1a1a', '#e8c040', '#2a4a8a', '#f0f0e8', '#6a3a1a', '#d86a2a', '#1a1a1a', '#b83a6a', '#4a8a8a'];
  return pixTex(512, 512, null, {
    post: (ctx, w, h) => {
      ctx.fillStyle = '#f2e27a'; ctx.fillRect(0, 0, w, h);
      for (let row = 0; row < 5; row++) {
        const y0 = row * h / 5; ctx.fillStyle = '#bdb8a8'; ctx.fillRect(0, y0 + h / 5 - 8, w, 8);
        let x = 4;
        while (x < w - 10) {
          const bw = 10 + r() * 18, bh = h / 5 * (0.5 + r() * 0.42); const c = cols[Math.floor(r() * cols.length)];
          const n = 1 + Math.floor(r() * 4);
          for (let k = 0; k < n && x < w - 10; k++) {
            ctx.fillStyle = c;
            if (r() < 0.5) { ctx.fillRect(x, y0 + h / 5 - 8 - bh, bw, bh); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(x + 2, y0 + h / 5 - 8 - bh * 0.55, bw - 4, bh * 0.2); }
            else { ctx.fillRect(x + bw * 0.25, y0 + h / 5 - 8 - bh, bw * 0.5, bh * 0.25); ctx.fillRect(x, y0 + h / 5 - 8 - bh * 0.78, bw, bh * 0.78); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 1, y0 + h / 5 - 8 - bh * 0.5, bw - 2, bh * 0.18); }
            x += bw + 2;
          }
          x += 3;
        }
      }
    }
  });
}
export function signTex(color, seed) { // blank signboard: painted panel with a faded border only
  const n = Noise(seed);
  return pixTex(512, 128, (u, v) => {
    const b = new THREE.Color(color).getHex(); let c = [(b >> 16) & 255, (b >> 8) & 255, b & 255];
    if (u < 0.02 || u > 0.98 || v < 0.08 || v > 0.92) c = [232, 222, 200];
    return c.map((k) => k * (0.85 + 0.25 * n.fbm(u, v, 6, 3)));
  });
}

export async function build({ renderer, scene, camera }) {
  camera.far = 1500; camera.updateProjectionMatrix();
  const skyC = { top: '#c4c0b4', horizon: '#dcd4c0', bottom: '#b8ac94' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, { top: '#fff8e0', horizon: '#f0e8c8', bottom: '#8a8070' });
  scene.fog = new THREE.FogExp2('#d8cfbc', 0.03);
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#f0ebe0', '#8a7a64', 1.6));
  const sun = makeSun(scene, { color: '#fff0d8', intensity: 2.2, dir: [0.55, 0.5, 0.35], box: 22, mapSize: 2048 });
  const r = rng(371);

  // ---------------- street ----------------
  const street = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), texMat(dirtTex({ seed: 31, color: '#9a9082', repeat: [18, 18], shells: 20, butts: 6, red: 4 })));
  street.rotation.x = -Math.PI / 2; street.position.set(0, 0, 10); street.receiveShadow = true; scene.add(street);

  const tileF = texMat(tileTex({ seed: 32, repeat: [4, 3], cols: 8, rows: 14, dirt: 0.5 }));
  const shutter = texMat(pixTex(256, 256, (u, v) => { const k = (v * 40) % 1 < 0.2 ? 0.75 : 1; return [150 * k, 154 * k, 158 * k]; }, { repeat: [1, 1] }));
  const signCols = ['#c4161c', '#c4161c', '#1c4a9a', '#c4161c', '#e8b020', '#2a7a3a'];
  // shop rows along both sides, two storeys, blank signboards, roll-up shutters
  const shopRow = (x, face, z0, z1, seed) => {
    const rr = rng(seed); let z = z0;
    while (z > z1) {
      const w = 4 + rr() * 3;
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, 6.5, w), [tileF, tileF, std({ color: '#8a8478' }), std({ color: '#777' }), tileF, tileF]); b.position.set(x + face * 4, 3.25, z - w / 2); b.castShadow = b.receiveShadow = true; scene.add(b);
      const sg = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, 0.9), std({ map: signTex(signCols[Math.floor(rr() * signCols.length)], seed + z) })); sg.position.set(x - face * 0.02, 3.1, z - w / 2); sg.rotation.y = face > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(sg);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 2.4), rr() < 0.6 ? shutter : std({ color: '#2a2a2c' })); sh.position.set(x - face * 0.02, 1.2, z - w / 2); sh.rotation.y = sg.rotation.y; scene.add(sh);
      const eave = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, w), std({ color: '#7a2a24' })); eave.position.set(x - face * 0.3, 6.6, z - w / 2); scene.add(eave);
      z -= w;
    }
  };
  shopRow(9.5, 1, 30, -4.2, 1); shopRow(-8.5, -1, 30, -4.2, 2);

  // telephone pole + sagging wires
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9, 8), std({ color: '#8a8680' })); pole.position.set(6.8, 4.5, 3); pole.castShadow = true; scene.add(pole);

  // ---- pork racks ----
  const pipe = std({ color: '#3a3c3e' });
  const hooks = std({ color: '#8a8e92' });
  const porkM = [std({ map: porkTex(41) }), std({ map: porkTex(42) }), std({ map: porkTex(43) })];
  const fatM = std({ color: '#f0e2d6' });
  const slabs = [];
  const rack = (x, z0, z1, seed) => {
    const rr = rng(seed);
    for (const z of [z0, z1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 8), pipe); p.position.set(x, 1.1, z); p.castShadow = true; scene.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, Math.abs(z1 - z0), 8), pipe); bar.rotation.x = Math.PI / 2; bar.position.set(x, 2.15, (z0 + z1) / 2); bar.castShadow = true; scene.add(bar);
    for (let z = z0 - 0.25; z > z1 + 0.15; z -= 0.38 + rr() * 0.12) {
      const hk = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 10, Math.PI * 1.5), hooks); hk.position.set(x, 2.05, z); hk.rotation.y = Math.PI / 2; scene.add(hk);
      if (rr() < 0.08) continue;
      const w = 0.32 + rr() * 0.12, h = 0.6 + rr() * 0.45, d = 0.1 + rr() * 0.05;
      const g = new THREE.BoxGeometry(d, h, w, 1, 4, 3); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const yy = p.getY(i) / h + 0.5; p.setZ(i, p.getZ(i) * (0.75 + 0.35 * Math.sin(yy * Math.PI))); p.setX(i, p.getX(i) * (0.8 + 0.4 * Math.sin(yy * Math.PI))); }
      g.computeVertexNormals();
      const m = porkM[Math.floor(rr() * 3)];
      const slab = new THREE.Mesh(g, [m, m, fatM, fatM, fatM, fatM]); slab.position.set(x, 2.0 - h / 2, z); slab.rotation.y = (rr() - 0.5) * 0.6 + Math.PI / 2; slab.castShadow = true; scene.add(slab);
      slabs.push({ slab, ph: rr() * 6 });
    }
    // table below with white plastic sheet, cuts of meat, a platform scale on a stool
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, Math.abs(z1 - z0) * 0.8), std({ color: '#f0eee8' })); tb.position.set(x + 0.9, 0.8, (z0 + z1) / 2); tb.castShadow = true; tb.receiveShadow = true; scene.add(tb);
    for (const dz of [-0.4, 0.4]) for (const dx of [-0.4, 0.4]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), std({ color: '#6a4a30' })); l.position.set(x + 0.9 + dx, 0.4, (z0 + z1) / 2 + dz * Math.abs(z1 - z0) * 0.9); scene.add(l); }
    for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.3), porkM[k % 3]); c.position.set(x + 0.9 + (rr() - 0.5) * 0.5, 0.87, (z0 + z1) / 2 + (rr() - 0.5) * Math.abs(z1 - z0) * 0.6); c.rotation.y = rr() * 3; c.castShadow = true; scene.add(c); }
    const stool = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), std({ color: '#7a5a3a' })); stool.position.set(x - 0.5, 0.25, z1 + 0.3); stool.castShadow = true; scene.add(stool);
    const scale = new THREE.Group(); scale.position.set(x - 0.5, 0.5, z1 + 0.3); scene.add(scale);
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.3), std({ color: '#b8b6b0' })); sb.position.y = 0.04; scale.add(sb);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.28), pbr({ color: '#d8dadc', metalness: 0.8, roughness: 0.3, envMap: env })); sp.position.y = 0.09; scale.add(sp);
    const scr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.16), std({ color: '#222', emissive: '#2a4a2a' })); scr.position.set(-0.17, 0.1, 0); scr.rotation.z = 0.4; scale.add(scr);
  };
  rack(2.6, 7, 3.2, 51); rack(2.6, 2.0, -1.4, 52); rack(-2.4, 6.2, 3.0, 53);
  // blue plastic bags, basins, cabbages and scallions on the left
  const bagM = std({ color: '#3a7ac8' });
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), bagM); b.scale.set(1, 1.3, 0.8); b.position.set(3.5 + k * 0.1, 0.95, 5 - k * 1.3); scene.add(b); }
  const veg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 2.2), std({ color: '#3a5a8a' })); veg.position.set(-3.2, 0.3, -0.6); scene.add(veg);
  const cab = []; for (let i = 0; i < 18; i++) cab.push(mtx(-3.2 + (r() - 0.5) * 0.8, 0.72 + r() * 0.12, -0.6 + (r() - 0.5) * 1.9, r() * 6, 0.9 + r() * 0.3, 1.3));
  scene.add(instanced(new THREE.IcosahedronGeometry(0.16, 1), std({ color: '#b8d08a', flatShading: true }), cab));
  const scal = []; for (let i = 0; i < 40; i++) scal.push(mtx(-2.6 + (r() - 0.5) * 0.3, 0.62, -2.0 + (r() - 0.5) * 0.5, 0, 1, 1, 0, Math.PI / 2 + (r() - 0.5) * 0.1));
  scene.add(instanced(new THREE.CylinderGeometry(0.018, 0.022, 1.3, 6), std({ color: '#e8ecd8' }), scal));
  const scalG = scal.map((m) => { const p = new THREE.Vector3().setFromMatrixPosition(m); return mtx(p.x - 0.95, p.y, p.z, 0, 1, 1, 0, Math.PI / 2 + (r() - 0.5) * 0.3); });
  scene.add(instanced(new THREE.CylinderGeometry(0.012, 0.018, 0.7, 5), std({ color: '#3a7a2a' }), scalG));
  for (const [x, z, c] of [[-4.2, 2, '#d8342a'], [-4.0, 1.2, '#2a6ac8'], [-4.3, 0.5, '#e8b020']]) { const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.18, 16, 1, true), std({ color: c, side: THREE.DoubleSide })); bs.position.set(x, 0.09, z); scene.add(bs); }

  // people in winter coats
  const coats = ['#1c1d22', '#2a2c34', '#3a2a24', '#4a4a50', '#1a2a3a', '#6a2a2a'];
  const folk = [[3.6, 5.6, -1.6], [3.5, 1.2, -1.6], [2.0, -0.6, 1.2], [-0.4, 3.2, -0.6], [-1.5, 5.0, 1.2], [-3.4, 3.5, 1.4], [-1.2, -2.5, 0.2], [4.8, -2.8, -2.4], [-4.8, -1.5, 1.8], [-0.2, 9.5, 2.8]];
  const ppl = folk.map(([x, z, ry], i) => { const p = person({ pose: 'stand', shirt: coats[i % coats.length], pants: '#22242a', hair: i % 3 ? '#1a1714' : '#5a5a5a' }); p.position.set(x, 0, z); p.rotation.y = ry; scene.add(p); return p; });
  const redBag = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), std({ color: '#c8242a' })); redBag.scale.set(1, 1.2, 0.8); redBag.position.set(-1.25, 0.72, 5.25); redBag.visible = true; scene.add(redBag);

  // ---------------- the grocery store (door at z = -4.2) ----------------
  const SZ0 = -4.2, SZ1 = -18, SX0 = -2.2, SX1 = 3.8, SH = 3.2;
  const yellow = std({ color: '#e8d44a' });
  // facade with door + display windows
  const fac = std({ map: tileTex({ seed: 61, repeat: [4, 2], cols: 10, rows: 12, dirt: 0.4 }) });
  const fb = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), fac); m.position.set(x, y, SZ0); m.castShadow = true; m.receiveShadow = true; scene.add(m); };
  fb(8.4, 6.5, -6.4, 3.25); fb(8.4, 6.5, 8.0, 3.25); // neighbours
  fb(2.0, 3.9, 2.8, 4.55); fb(2.0, 3.9, -1.2, 4.55); fb(1.6, 4.2, 0.9, 4.4); // above
  fb(0.4, 2.6, -2.0, 1.3); fb(0.4, 2.6, 3.6, 1.3); fb(0.2, 2.6, 0.0, 1.3); fb(0.2, 2.6, 1.8, 1.3);
  fb(1.6, 0.6, -1.0, 0.3); fb(1.6, 0.6, 2.8, 0.3);
  const glass = pbr({ color: '#c8d8e0', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1, envMap: env });
  for (const x of [-1.0, 2.8]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), glass); g.position.set(x, 1.6, SZ0 + 0.02); scene.add(g); }
  const storeSign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 0.9), std({ map: signTex('#2a8a3a', 77), emissive: '#0a2a0a' })); storeSign.position.set(0.9, 3.05, SZ0 + 0.17); scene.add(storeSign);
  // interior shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SX1 - SX0, SZ0 - SZ1), pbr({ map: checkerTex(), roughness: 0.25, metalness: 0.05, envMap: env, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((SX0 + SX1) / 2, 0.01, (SZ0 + SZ1) / 2); floor.receiveShadow = true; scene.add(floor);
  const wallL = new THREE.Mesh(new THREE.PlaneGeometry(SZ0 - SZ1, SH), yellow); wallL.position.set(SX0, SH / 2, (SZ0 + SZ1) / 2); wallL.rotation.y = Math.PI / 2; scene.add(wallL);
  const wallR = new THREE.Mesh(new THREE.PlaneGeometry(SZ0 - SZ1, SH), yellow); wallR.position.set(SX1, SH / 2, (SZ0 + SZ1) / 2); wallR.rotation.y = -Math.PI / 2; scene.add(wallR);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(SX1 - SX0, SH), yellow); back.position.set((SX0 + SX1) / 2, SH / 2, SZ1); scene.add(back);
  const backDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), new THREE.MeshBasicMaterial({ color: '#fbf8ee' })); backDoor.position.set(1.0, 1.1, SZ1 + 0.01); scene.add(backDoor);
  const ceilT = pixTex(256, 256, (u, v) => { const cu = (u * 4) % 1, cv = (v * 4) % 1; return cu < 0.03 || cv < 0.03 ? [180, 176, 166] : [226, 222, 212]; }, { repeat: [3, 7] });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(SX1 - SX0, SZ0 - SZ1), std({ map: ceilT })); ceil.rotation.x = Math.PI / 2; ceil.position.set((SX0 + SX1) / 2, SH, (SZ0 + SZ1) / 2); scene.add(ceil);
  const panelM = new THREE.MeshBasicMaterial({ color: '#fbfbf4' });
  for (let z = SZ0 - 1.2; z > SZ1 + 0.5; z -= 2.2) for (const x of [-0.6, 2.2]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), panelM); p.rotation.x = Math.PI / 2; p.position.set(x, SH - 0.01, z); scene.add(p); }
  for (const z of [-6.5, -11, -15.5]) { const l = new THREE.PointLight('#fff6e4', 9, 9, 1.4); l.position.set(0.8, SH - 0.3, z); scene.add(l); }
  // wall shelves with goods (no labels)
  const sT = [shelfTex(1), shelfTex(2), shelfTex(3)];
  for (const [x, ry, i] of [[SX0 + 0.02, Math.PI / 2, 0], [SX1 - 0.02, -Math.PI / 2, 1]]) {
    for (let z = SZ0 - 1.5; z > SZ1 + 1; z -= 3) { const s = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), std({ map: sT[(i + Math.round(z)) % 3 < 0 ? 0 : (i + Math.round(-z)) % 3] })); s.position.set(x, 1.95, z - 1.5); s.rotation.y = ry; scene.add(s); }
  }
  // curved-glass deli counters on both sides
  const counterBase = std({ color: '#2e8a3a' }), steel = pbr({ color: '#c8ccd0', metalness: 0.8, roughness: 0.3, envMap: env });
  const trayCols = ['#e8c89a', '#c84a3a', '#f0e8d8', '#8a5a3a', '#e89a3a', '#d8d06a', '#b8d0e0', '#e86a6a'];
  const counter = (x, z0, z1, side) => {
    const L = z0 - z1, cz = (z0 + z1) / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, L), counterBase); base.position.set(x, 0.375, cz); base.castShadow = true; scene.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, L), steel); top.position.set(x, 0.78, cz); scene.add(top);
    const trays = []; const tc = [];
    for (let z = z0 - 0.3; z > z1 + 0.2; z -= 0.42) for (const dx of [-0.18, 0.18]) { trays.push(mtx(x + dx, 0.83, z)); tc.push(new THREE.Color(trayCols[Math.floor(r() * trayCols.length)])); }
    const tm = instanced(new THREE.BoxGeometry(0.32, 0.05, 0.36), std({ color: '#fff' }), trays, { cast: false }); tc.forEach((c, i) => tm.setColorAt(i, c)); scene.add(tm);
    const prof = new THREE.Shape(); prof.moveTo(0, 0); prof.absarc(0, 0, 0.5, 0, Math.PI / 2, false);
    const cg = new THREE.CylinderGeometry(0.48, 0.48, L, 12, 1, true, side > 0 ? Math.PI : 0, Math.PI / 2);
    cg.rotateX(Math.PI / 2);
    const cgl = new THREE.Mesh(cg, pbr({ color: '#e0eef4', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0.1, envMap: env, envMapIntensity: 2, side: THREE.DoubleSide, depthWrite: false }));
    cgl.position.set(x - side * 0.44, 0.8, cz); scene.add(cgl);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, L), new THREE.MeshBasicMaterial({ color: '#fffbe8' })); lamp.position.set(x + side * 0.1, 1.26, cz); scene.add(lamp);
  };
  counter(-1.5, -5.6, -12.5, -1); counter(3.1, -6.6, -13.5, 1);
  // fruit stand just inside the door (left): bananas, oranges, pineapples, apples
  const fs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.4), std({ color: '#8a6a3a' })); fs.position.set(-1.6, 0.35, -5.0); fs.rotation.x = 0; scene.add(fs);
  const oranges = [], apples = [], bananas = [];
  for (let i = 0; i < 40; i++) oranges.push(mtx(-1.8 + (r() - 0.5) * 0.4, 0.76 + r() * 0.08, -4.6 + (r() - 0.5) * 0.5));
  for (let i = 0; i < 30; i++) apples.push(mtx(-1.4 + (r() - 0.5) * 0.35, 0.76 + r() * 0.07, -4.6 + (r() - 0.5) * 0.5));
  for (let i = 0; i < 24; i++) bananas.push(mtx(-1.6 + (r() - 0.5) * 0.6, 0.78 + r() * 0.06, -5.4 + (r() - 0.5) * 0.5, r() * 3, 1, 1, 0, Math.PI / 2 + (r() - 0.5) * 0.4));
  scene.add(instanced(new THREE.SphereGeometry(0.045, 10, 8), std({ color: '#f08a1a' }), oranges));
  scene.add(instanced(new THREE.SphereGeometry(0.042, 10, 8), std({ color: '#b8141e' }), apples));
  const banGeo = new THREE.TorusGeometry(0.12, 0.022, 6, 10, 1.4);
  scene.add(instanced(banGeo, std({ color: '#f2d23a' }), bananas));
  for (let k = 0; k < 3; k++) { const pa = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), std({ color: '#b8862a', flatShading: true })); pa.scale.set(1, 1.5, 1); pa.position.set(-1.25, 0.85, -5.6 + k * 0.2); scene.add(pa); const crown = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), std({ color: '#3a7a3a', flatShading: true })); crown.position.set(-1.25, 1.06, -5.6 + k * 0.2); scene.add(crown); }
  // red drinks fridge at the back right (plain, no logo)
  const fr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.7), std({ color: '#c8161e' })); fr.position.set(3.35, 1.0, -15.5); scene.add(fr);
  const frg = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.5), std({ map: shelfTex(9), emissive: '#3a3a30' })); frg.position.set(2.94, 1.1, -15.5); frg.rotation.y = -Math.PI / 2; scene.add(frg);
  // shoppers + clerk
  const inside = [[0.5, -8.5, Math.PI, '#2a2c34'], [1.4, -11.5, Math.PI + 0.2, '#3a2a24'], [0.9, -14.5, 0.3, '#1c1d22'], [-2.0, -9.5, Math.PI / 2, '#e8e6e0'], [3.5, -10.5, -Math.PI / 2, '#e8e6e0']];
  inside.forEach(([x, z, ry, c]) => { const p = person({ pose: 'stand', shirt: c, pants: '#22242a' }); p.position.set(x, 0, z); p.rotation.y = ry; scene.add(p); });

  // camera: along the market, then through the door and down the aisle
  const pts = [[0.95, 0, 5.5], [0.9, 0, 1.5], [0.9, 0, -2.2], [0.9, 0, -4.2], [0.85, 0, -7.0], [0.8, 0, -10]];
  const yaw = kf([[0, -0.1], [1.0, -0.42], [2.0, -0.3], [2.8, 0.0], [4, 0.08], [5, 0.0]]);
  const pitch = kf([[0, -0.03], [1.2, 0.02], [3, 0.0], [5, -0.04]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.015, stride: 0.75, lookAhead: 4, ease: 0.5, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => {
    cam(t);
    sun.follow(camera.position);
    slabs.forEach((s) => { s.slab.rotation.z = 0.03 * Math.sin(t * 1.3 + s.ph); });
  };
}
