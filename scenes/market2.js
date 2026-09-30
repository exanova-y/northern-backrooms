import {
  THREE, rng, Noise, pixTex, concreteTex, dirtTex, tileTex, glowTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, person, instanced, mtx, wire, mix3, clamp
} from '../lib.js';
import { porkTex, checkerTex, shelfTex, signTex } from './market.js';

export const DUR = 8;
export const DOOR_T = 5.9; // camera crosses the shop door around here (used by the sound script)

const XL = -4.2, XR = 3.6; // building fronts, left and right
const DOORZ = -2.2;

function facadeTex(seed, base, floors, bays, kind) {
  const n = Noise(seed), r = rng(seed);
  const hx = new THREE.Color(base).getHex(); const B = [(hx >> 16) & 255, (hx >> 8) & 255, hx & 255];
  return pixTex(512, 512, (u, v) => {
    const fy = (1 - v) * floors, fx = u * bays, fl = Math.floor(fy), bx = Math.floor(fx), ly = fy - fl, lx = fx - bx;
    let c = B.map((k) => k * (0.85 + 0.22 * n.fbm(u, v, 6, 4)));
    if (kind === 'brick') { const row = Math.floor(v * 90), cu = (u * 30 + (row % 2) * 0.5) % 1, cv = (v * 90) % 1; if (cu < 0.06 || cv < 0.15) c = c.map((k) => k * 0.75); }
    if (kind === 'tile') { if ((u * 60) % 1 < 0.06 || (v * 90) % 1 < 0.08) c = c.map((k) => k * 0.85); }
    if (fl >= 1 && lx > 0.25 && lx < 0.75 && ly > 0.25 && ly < 0.8) { c = [62, 72, 80]; if (Math.abs(lx - 0.5) < 0.02) c = [220, 220, 214]; }
    if (fl === 0) { if (lx > 0.08 && lx < 0.92 && ly < 0.78) c = (bx % 2) ? [132, 138, 146].map((k) => k * (0.9 + 0.1 * Math.sin(v * 400))) : [44, 48, 52]; }
    c = c.map((k) => k * (1 - 0.15 * clamp(n.vn(u * 40, v * 3, 40) - 0.55) * 2));
    return c;
  });
}

// the grocery (interior along local -z from the door at local z=0), built into a parent group
function buildGrocery(G, env, r) {
  const SZ0 = 0, SZ1 = -13.8, SX0 = -3.1, SX1 = 2.9, SH = 3.2;
  const yellow = std({ color: '#e8d44a' });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(SX1 - SX0, SZ0 - SZ1), pbr({ map: checkerTex(), roughness: 0.25, metalness: 0.05, envMap: env, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((SX0 + SX1) / 2, 0.01, (SZ0 + SZ1) / 2); floor.receiveShadow = true; G.add(floor);
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(SZ0 - SZ1, SH), yellow); wl.position.set(SX0, SH / 2, (SZ0 + SZ1) / 2); wl.rotation.y = Math.PI / 2; G.add(wl);
  const wr = new THREE.Mesh(new THREE.PlaneGeometry(SZ0 - SZ1, SH), yellow); wr.position.set(SX1, SH / 2, (SZ0 + SZ1) / 2); wr.rotation.y = -Math.PI / 2; G.add(wr);
  const bk = new THREE.Mesh(new THREE.PlaneGeometry(SX1 - SX0, SH), yellow); bk.position.set((SX0 + SX1) / 2, SH / 2, SZ1); G.add(bk);
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.2), new THREE.MeshBasicMaterial({ color: '#fbf8ee' })); bd.position.set(0, 1.1, SZ1 + 0.01); G.add(bd);
  const ceilT = pixTex(256, 256, (u, v) => { const cu = (u * 4) % 1, cv = (v * 4) % 1; return cu < 0.03 || cv < 0.03 ? [180, 176, 166] : [226, 222, 212]; }, { repeat: [3, 7] });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(SX1 - SX0, SZ0 - SZ1), std({ map: ceilT })); ceil.rotation.x = Math.PI / 2; ceil.position.set((SX0 + SX1) / 2, SH, (SZ0 + SZ1) / 2); G.add(ceil);
  const panelM = new THREE.MeshBasicMaterial({ color: '#fbfbf4' });
  for (let z = -1.2; z > SZ1 + 0.5; z -= 2.2) for (const x of [-1.5, 1.3]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), panelM); p.rotation.x = Math.PI / 2; p.position.set(x, SH - 0.01, z); G.add(p); }
  for (const z of [-2.5, -7, -11.5]) { const l = new THREE.PointLight('#fff6e4', 9, 9, 1.4); l.position.set(0, SH - 0.3, z); G.add(l); }
  const sT = [shelfTex(1), shelfTex(2), shelfTex(3)];
  let k = 0;
  for (const [x, ry] of [[SX0 + 0.02, Math.PI / 2], [SX1 - 0.02, -Math.PI / 2]]) for (let z = -1.5; z > SZ1 + 1; z -= 3) { const s = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), std({ map: sT[k++ % 3] })); s.position.set(x, 1.95, z - 1.5); s.rotation.y = ry; G.add(s); }
  const base = std({ color: '#2e8a3a' }), steel = pbr({ color: '#c8ccd0', metalness: 0.8, roughness: 0.3, envMap: env });
  const trayCols = ['#e8c89a', '#c84a3a', '#f0e8d8', '#8a5a3a', '#e89a3a', '#d8d06a', '#b8d0e0', '#e86a6a'];
  const counter = (x, z0, z1, side) => {
    const L = z0 - z1, cz = (z0 + z1) / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.75, L), base); b.position.set(x, 0.375, cz); G.add(b);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, L), steel); tp.position.set(x, 0.78, cz); G.add(tp);
    const trays = [], tc = [];
    for (let z = z0 - 0.3; z > z1 + 0.2; z -= 0.42) for (const dx of [-0.18, 0.18]) { trays.push(mtx(x + dx, 0.83, z)); tc.push(new THREE.Color(trayCols[Math.floor(r() * trayCols.length)])); }
    const tm = instanced(new THREE.BoxGeometry(0.32, 0.05, 0.36), std({ color: '#fff' }), trays, { cast: false }); tc.forEach((c, i) => tm.setColorAt(i, c)); G.add(tm);
    const cg = new THREE.CylinderGeometry(0.48, 0.48, L, 12, 1, true, side > 0 ? Math.PI : 0, Math.PI / 2); cg.rotateX(Math.PI / 2);
    const gl = new THREE.Mesh(cg, pbr({ color: '#e0eef4', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0.1, envMap: env, envMapIntensity: 2, side: THREE.DoubleSide, depthWrite: false })); gl.position.set(x - side * 0.44, 0.8, cz); G.add(gl);
  };
  counter(-2.4, -1.4, -8.3, -1); counter(2.2, -2.4, -9.3, 1);
  const fs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.2), std({ color: '#8a6a3a' })); fs.position.set(-2.5, 0.35, -0.9); G.add(fs);
  const org = [], app = []; for (let i = 0; i < 30; i++) org.push(mtx(-2.7 + (r() - 0.5) * 0.4, 0.76 + r() * 0.08, -0.7 + (r() - 0.5) * 0.4)); for (let i = 0; i < 24; i++) app.push(mtx(-2.3 + (r() - 0.5) * 0.35, 0.76 + r() * 0.07, -1.1 + (r() - 0.5) * 0.4));
  G.add(instanced(new THREE.SphereGeometry(0.045, 10, 8), std({ color: '#f08a1a' }), org)); G.add(instanced(new THREE.SphereGeometry(0.042, 10, 8), std({ color: '#b8141e' }), app));
  const fr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.7), std({ color: '#c8161e' })); fr.position.set(2.45, 1.0, -11.5); G.add(fr);
  for (const [x, z, ry, c] of [[-0.3, -4.5, Math.PI, '#2a2c34'], [0.6, -7.5, Math.PI + 0.2, '#3a2a24'], [0.1, -10.5, 0.3, '#1c1d22'], [-2.9, -5.5, Math.PI / 2, '#e8e6e0'], [2.6, -6.5, -Math.PI / 2, '#e8e6e0']]) { const p = person({ pose: 'stand', shirt: c, pants: '#22242a' }); p.position.set(x, 0, z); p.rotation.y = ry; G.add(p); }
  // glass door frame + display windows in the facade (local z = 0)
  const glass = pbr({ color: '#c8d8e0', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1, envMap: env });
  for (const x of [-2.1, 2.0]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.0), glass); g.position.set(x, 1.6, 0.02); G.add(g); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 0.8), std({ map: signTex('#2a8a3a', 77), emissive: '#0a2a0a' })); sign.position.set(0, 3.05, 0.2); G.add(sign);
}

export async function build({ renderer, scene, camera }) {
  camera.far = 1500; camera.updateProjectionMatrix();
  const skyC = { top: '#d6dde4', horizon: '#ece8e0', bottom: '#c4bcac' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, { top: '#fff8e8', horizon: '#f0e8d0', bottom: '#8a8070' });
  scene.fog = new THREE.FogExp2('#e4e0d8', 0.016);
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#f4f2ee', '#8a8070', 2.0));
  const sun = makeSun(scene, { color: '#fff4e4', intensity: 1.4, dir: [0.35, 0.8, 0.3], box: 24, mapSize: 2048 });
  const r = rng(8812);

  // street: concrete with dust and litter
  const street = new THREE.Mesh(new THREE.PlaneGeometry(XR - XL + 0.4, 160), texMat(concreteTex({ seed: 5, color: '#a8a296', repeat: [2, 40], cracks: 10 })));
  street.rotation.x = -Math.PI / 2; street.position.set((XL + XR) / 2, 0, -50); street.receiveShadow = true; scene.add(street);
  const dust = new THREE.Mesh(new THREE.PlaneGeometry(XR - XL, 160), texMat(dirtTex({ seed: 6, color: '#b8ae9a', repeat: [3, 60], shells: 30, butts: 8, red: 10, leaves: 20 }), { transparent: true, opacity: 0.55 })); dust.rotation.x = -Math.PI / 2; dust.position.set((XL + XR) / 2, 0.005, -50); scene.add(dust);

  // ---- buildings: 2-3 storeys, tile / brick / paint, shutters, AC units, lanterns, awnings ----
  const kinds = [['#e8e4da', 'tile'], ['#9a9894', 'brick'], ['#d8c8a8', 'paint'], ['#f0ece4', 'tile'], ['#b8a898', 'brick'], ['#c8d0d0', 'paint']];
  const acM = std({ color: '#e8e8e4' }), lantern = std({ color: '#d8201a', emissive: '#5a0808' });
  const row = (x, face, z0, z1, seed, skip = null) => {
    const rr = rng(seed); let z = z0;
    while (z > z1) {
      let w = 4 + rr() * 5;
      if (skip && z <= skip[0] && z > skip[1]) { z = skip[1]; continue; }
      if (skip && z > skip[0] && z - w < skip[0]) w = z - skip[0];
      const zc = z - w / 2;
      const floors = 2 + (rr() < 0.4 ? 1 : 0), h = floors * 3.2 + 0.5;
      const [col, kind] = kinds[Math.floor(rr() * kinds.length)];
      const ft = facadeTex(Math.floor(rr() * 1e6), col, floors, Math.max(2, Math.round(w / 2.4)), kind);
      const side = std({ color: col });
      const b = new THREE.Mesh(new THREE.BoxGeometry(8, h, w), [face > 0 ? std({ map: ft }) : side, face < 0 ? std({ map: ft }) : side, std({ color: '#7a7670' }), side, side, side]);
      b.position.set(x - face * 4, h / 2, zc); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      const fx = x + face * 0.02;
      if (rr() < 0.6) { const ac = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.8), acM); ac.position.set(x + face * 0.18, 3.8 + rr() * 2, zc + (rr() - 0.5) * (w - 1.5)); ac.castShadow = true; scene.add(ac); }
      if (rr() < 0.45) for (const dz of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lantern); l.scale.set(1, 0.85, 1); l.position.set(x + face * 0.5, 2.9, zc + dz); scene.add(l); const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.25, 6), std({ color: '#e8b020' })); tas.position.set(x + face * 0.5, 2.6, zc + dz); scene.add(tas); }
      if (rr() < 0.5) { const aw = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, w - 0.4), std({ color: rr() < 0.5 ? '#2a5aa8' : '#c83a2a' })); aw.position.set(x + face * 0.45, 2.7, zc); aw.rotation.z = face * 0.25; scene.add(aw); }
      if (rr() < 0.4) { const sg = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 0.6), std({ map: signTex(['#c4161c', '#1c4a9a', '#e8b020'][Math.floor(rr() * 3)], seed + zc) })); sg.position.set(fx, 3.3, zc); sg.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(sg); }
      // red paper strips on door jambs (blank)
      if (rr() < 0.4) for (const dz of [-0.8, 0.8]) { const cp = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.6), std({ color: '#c81c18' })); cp.position.set(fx + face * 0.01, 1.3, zc + dz); cp.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(cp); }
      z -= w;
    }
  };
  // left fronts face +x (face = +1 means facade on the +x side of the box)
  row(XL, 1, 30, -110, 11); row(XR, -1, 30, -110, 12, [DOORZ + 3.3, DOORZ - 3.3]);

  // grocery set into the right-hand row, door facing the street
  const G = new THREE.Group(); G.rotation.y = -Math.PI / 2; G.position.set(XR, 0, DOORZ); scene.add(G);
  const shopBox = new THREE.Mesh(new THREE.BoxGeometry(14.5, 7, 0.1), std({ color: '#e0dcd2' })); // (hidden roof filler)
  buildGrocery(G, env, r);
  const fac = std({ map: tileTex({ seed: 61, repeat: [4, 2], cols: 10, rows: 12, dirt: 0.4 }) });
  const fb = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.3), fac); m.position.set(x, y, 0); m.castShadow = true; G.add(m); };
  fb(6.6, 3.4, 0, 5.2); fb(0.4, 3.5, -3.2, 1.75); fb(0.4, 3.5, 3.2, 1.75); fb(0.3, 2.6, -1.05, 1.3); fb(0.3, 2.6, 1.05, 1.3); fb(1.7, 0.6, -2.1, 0.3); fb(1.7, 0.6, 2.05, 0.3);
  const upper = new THREE.Mesh(new THREE.BoxGeometry(6.6, 7, 14), [std({ color: '#d8d4c8' }), std({ color: '#d8d4c8' }), std({ color: '#7a7670' }), std({ color: '#d8d4c8' }), std({ color: '#d8d4c8' }), std({ color: '#d8d4c8' })]);
  upper.position.set(0, 3.5 + 3.3, -7.1); upper.scale.set(1, 0.06, 1); G.add(upper);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(6.8, 7, 14.2), std({ color: '#d8d4c8', side: THREE.BackSide })); shell.visible = false; G.add(shell);

  // poles and a tangle of wires overhead
  const poleM = std({ color: '#a8a49c' });
  const polePts = [];
  for (let z = 14; z > -100; z -= 16) { for (const x of [XL + 0.4, XR - 0.35]) { if (x > 0 && Math.abs(z - DOORZ) < 3) continue; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 9, 8), poleM); p.position.set(x, 4.5, z + (x > 0 ? -7 : 0)); p.castShadow = true; scene.add(p); polePts.push([x, z + (x > 0 ? -7 : 0)]); } }
  const L = polePts.filter((p) => p[0] < 0), R = polePts.filter((p) => p[0] > 0);
  for (let i = 0; i < L.length - 1; i++) for (const [h, sag] of [[8.6, 0.6], [8.2, 0.8], [7.6, 1.0]]) wire(scene, [L[i][0], h, L[i][1]], [L[i + 1][0], h, L[i + 1][1]], sag);
  for (let i = 0; i < R.length - 1; i++) for (const [h, sag] of [[8.4, 0.7], [7.8, 0.9]]) wire(scene, [R[i][0], h, R[i][1]], [R[i + 1][0], h, R[i + 1][1]], sag);
  for (let i = 0; i < Math.min(L.length, R.length); i++) { wire(scene, [L[i][0], 8.4, L[i][1]], [R[i][0], 8.0, R[i][1]], 0.7); wire(scene, [L[i][0], 7.9, L[i][1]], [XR, 5.5, L[i][1] - 3], 0.5); wire(scene, [R[i][0], 7.7, R[i][1]], [XL, 5.2, R[i][1] + 4], 0.6); }

  // ---- stalls ----
  const crateCols = ['#e8e8e2', '#3a8a4a', '#2a6aa8', '#e8e8e2'];
  const crates = [], crateC = [], produce = [], prodC = [];
  const crateRun = (x, z0, z1) => { for (let z = z0; z > z1; z -= 0.5) { if (r() < 0.2) continue; crates.push(mtx(x + (r() - 0.5) * 0.15, 0.14, z, (r() - 0.5) * 0.2)); crateC.push(new THREE.Color(crateCols[Math.floor(r() * 4)])); const pc = ['#d83a28', '#e8a030', '#7a4a8a', '#e8d4a0', '#3a8a3a', '#f0801a'][Math.floor(r() * 6)]; for (let k = 0; k < 7; k++) { produce.push(mtx(x + (r() - 0.5) * 0.35, 0.3 + r() * 0.05, z + (r() - 0.5) * 0.3)); prodC.push(new THREE.Color(pc)); } } };
  crateRun(XL + 0.8, 9, 3.5); crateRun(XL + 1.25, 8.6, 4.5); crateRun(XL + 0.8, -3, -9); crateRun(XL + 0.8, -18, -26); crateRun(XR - 0.8, -8, -14);
  const cm = instanced(new THREE.BoxGeometry(0.42, 0.28, 0.36), std({ color: '#fff' }), crates); crateC.forEach((c, i) => cm.setColorAt(i, c)); scene.add(cm);
  const pm = instanced(new THREE.SphereGeometry(0.045, 8, 6), std({ color: '#fff' }), produce); prodC.forEach((c, i) => pm.setColorAt(i, c)); scene.add(pm);
  // greens on a tarp, cabbages
  const tarp = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.2), std({ color: '#2a7a4a' })); tarp.rotation.x = -Math.PI / 2; tarp.position.set(XL + 1.1, 0.01, 1.4); scene.add(tarp);
  const greens = []; for (let i = 0; i < 70; i++) greens.push(mtx(XL + 1.1 + (r() - 0.5) * 1.2, 0.05, 1.4 + (r() - 0.5) * 2.8, r() * 6, 0.12 + r() * 0.08, 0.3, 0, (r() - 0.5) * 0.6));
  scene.add(instanced(new THREE.ConeGeometry(1, 1, 5), std({ color: '#3a8a2a', flatShading: true }), greens, { cast: false }));
  const cab = []; for (let i = 0; i < 14; i++) cab.push(mtx(XL + 0.9 + (r() - 0.5) * 0.8, 0.14, -12 + (r() - 0.5) * 1.5, r() * 6, 1, 1.2));
  scene.add(instanced(new THREE.IcosahedronGeometry(0.16, 1), std({ color: '#b8d08a', flatShading: true }), cab));
  // red goods laid out on cloths (right side), all blank
  const clothM = [std({ color: '#b8342a' }), std({ color: '#d8a07a' }), std({ color: '#c84a3a' })];
  const redGoods = [], rgc = [];
  for (const [z0, len] of [[10, 3.6], [6, 3.0], [-7, 3.2], [-14, 3.5]]) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, len), clothM[Math.floor(r() * 3)]); cl.rotation.x = -Math.PI / 2; cl.position.set(XR - 1.1, 0.012, z0 - len / 2); scene.add(cl);
    for (let i = 0; i < 26; i++) { redGoods.push(mtx(XR - 1.1 + (r() - 0.5) * 1.3, 0.02, z0 - r() * len, r() * 0.3, 1, 1)); rgc.push(new THREE.Color(r() < 0.8 ? '#d81e1a' : '#e8b020')); }
  }
  const rg = instanced(new THREE.BoxGeometry(0.26, 0.02, 0.4), std({ color: '#fff' }), redGoods, { cast: false }); rgc.forEach((c, i) => rg.setColorAt(i, c)); scene.add(rg);
  // pork racks at the left stalls
  const pipe = std({ color: '#3a3c3e' }); const porkM = [std({ map: porkTex(41) }), std({ map: porkTex(42) }), std({ map: porkTex(43) })]; const fatM = std({ color: '#f0e2d6' });
  const slabs = [];
  const rack = (x, z0, z1) => {
    for (const z of [z0, z1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.2, 8), pipe); p.position.set(x, 1.1, z); scene.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, Math.abs(z1 - z0), 8), pipe); bar.rotation.x = Math.PI / 2; bar.position.set(x, 2.15, (z0 + z1) / 2); scene.add(bar);
    for (let z = z0 - 0.25; z > z1 + 0.15; z -= 0.4 + r() * 0.1) {
      const w = 0.32 + r() * 0.12, h = 0.6 + r() * 0.45, d = 0.1 + r() * 0.05;
      const g = new THREE.BoxGeometry(d, h, w, 1, 4, 3); const pp = g.attributes.position;
      for (let i = 0; i < pp.count; i++) { const yy = pp.getY(i) / h + 0.5; pp.setZ(i, pp.getZ(i) * (0.75 + 0.35 * Math.sin(yy * Math.PI))); pp.setX(i, pp.getX(i) * (0.8 + 0.4 * Math.sin(yy * Math.PI))); }
      g.computeVertexNormals(); const m = porkM[Math.floor(r() * 3)];
      const s = new THREE.Mesh(g, [m, m, fatM, fatM, fatM, fatM]); s.position.set(x, 2.0 - h / 2, z); s.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.6; s.castShadow = true; scene.add(s); slabs.push({ s, ph: r() * 6 });
    }
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, Math.abs(z1 - z0) * 0.8), std({ color: '#f0eee8' })); tb.position.set(x + 0.7, 0.8, (z0 + z1) / 2); scene.add(tb);
    for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.28), porkM[k % 3]); c.position.set(x + 0.7 + (r() - 0.5) * 0.4, 0.87, (z0 + z1) / 2 + (r() - 0.5) * 1.2); c.rotation.y = r() * 3; scene.add(c); }
    const block = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 14), std({ color: '#b89a6a' })); block.position.set(x + 0.75, 0.9, z1 + 0.4); scene.add(block);
  };
  rack(XL + 0.7, 0.0, -2.2); rack(XL + 0.7, -30, -33);

  // vehicles: white car (right), white van (left, far), electric tricycle, shopping trolley
  const vehicle = (len, h, col) => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.75, h * 0.55, len), std({ color: col })); b.position.y = 0.3 + h * 0.275; g.add(b); const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, h * 0.42, len * 0.55), std({ color: '#2a3440' })); c.position.set(0, 0.3 + h * 0.55 + h * 0.21, -0.1); g.add(c); const wg = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12); wg.rotateZ(Math.PI / 2); for (const [x, z] of [[-0.85, len * 0.33], [0.85, len * 0.33], [-0.85, -len * 0.33], [0.85, -len * 0.33]]) { const w = new THREE.Mesh(wg, std({ color: '#151515' })); w.position.set(x, 0.32, z); g.add(w); } g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; };
  const car = vehicle(4.3, 1.4, '#eeeeec'); car.position.set(XR - 1.1, 0, -20); scene.add(car);
  const van = vehicle(4.6, 1.9, '#e8e8e6'); van.position.set(XL + 1.2, 0, -38); scene.add(van);
  const tri = new THREE.Group(); tri.position.set(XL + 1.6, 0, 11.5); tri.rotation.y = 0.2; scene.add(tri);
  const tb2 = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 1.4), std({ color: '#3a6ab0' })); tb2.position.set(0, 0.6, 0.4); tri.add(tb2);
  const tc2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.6), std({ color: '#c8342a' })); tc2.position.set(0, 0.9, -0.7); tri.add(tc2);
  const trolley = new THREE.Group(); trolley.position.set(0.9, 0, 7.0); trolley.rotation.y = 0.3; scene.add(trolley);
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.3), std({ map: pixTex(64, 64, (u, v) => ((Math.floor(u * 8) + Math.floor(v * 8)) % 2 ? [40, 40, 60] : [120, 80, 90])) })); bag.position.set(0, 0.55, 0); trolley.add(bag);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6), std({ color: '#222' })); handle.position.set(0, 0.8, -0.14); handle.rotation.x = -0.25; trolley.add(handle);

  // ---- the crowd ----
  const coats = ['#1c1d22', '#2a2c34', '#3a2a24', '#4a4a50', '#1a2a3a', '#6a2a2a', '#7a3a8a', '#b84a8a', '#2a5a8a', '#5a4a3a', '#c8c0b4'];
  const crowd = [];
  for (let i = 0; i < 60; i++) {
    const z = 13 - Math.pow(r(), 0.7) * 90, x = XL + 0.6 + r() * (XR - XL - 1.2);
    if (z > -6 && x > -0.6 && x < 1.9) continue; // keep the camera's path clear
    const kid = r() < 0.08;
    const p = person({ pose: 'stand', shirt: coats[Math.floor(r() * coats.length)], pants: r() < 0.5 ? '#22242a' : '#3a3e48', hair: r() < 0.7 ? '#1a1714' : '#8a8680', scale: kid ? 0.62 : 0.94 + r() * 0.1 });
    p.position.set(x, 0, z); const walking = r() < 0.55; const dir = r() < 0.5 ? -1 : 1;
    p.rotation.y = walking ? (dir < 0 ? Math.PI : 0) : r() * 6.28; scene.add(p);
    crowd.push({ p, x, z, walking, v: dir * (0.7 + r() * 0.5), ph: r() * 6 });
  }
  // the woman in the purple coat with her trolley, just ahead on the right
  const pw = person({ pose: 'stand', shirt: '#8a3a9a', pants: '#1c1c22', hair: '#1a1714' }); pw.position.set(2.0, 0, 3.0); pw.rotation.y = Math.PI + 0.1; scene.add(pw);
  crowd.push({ p: pw, x: 2.0, z: 3.0, walking: true, v: -0.45, ph: 1 });
  const pwTrolley = trolley.clone(); pwTrolley.position.set(2.1, 0, 2.5); scene.add(pwTrolley);

  // camera: down the street, then a right turn into the grocery
  const pts = [[0.35, 0, 12.5], [0.4, 0, 8], [0.5, 0, 3.5], [0.9, 0, 0.2], [2.2, 0, -1.7], [3.6, 0, -2.2], [6.2, 0, -2.2], [9.0, 0, -2.2]];
  const yaw = kf([[0, 0.12], [1.4, 0.35], [2.6, -0.15], [3.8, 0.1], [4.6, 0.0], [8, 0.0]]);
  const pitch = kf([[0, 0.02], [2, -0.02], [6, 0.0], [8, -0.03]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.015, stride: 0.75, lookAhead: 3.2, ease: 0.6, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => {
    cam(t);
    sun.follow(camera.position);
    for (const c of crowd) {
      if (!c.walking) { c.p.rotation.z = 0.01 * Math.sin(t * 2 + c.ph); continue; }
      c.p.position.z = c.z + c.v * t; c.p.position.y = 0.02 * Math.abs(Math.sin(t * 5 + c.ph));
    }
    pwTrolley.position.z = pw.position.z - 0.5;
    slabs.forEach((s) => { s.s.rotation.z = 0.03 * Math.sin(t * 1.3 + s.ph); });
  };
}
