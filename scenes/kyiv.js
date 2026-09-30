import {
  THREE, rng, Noise, pixTex, peelTex, concreteTex, glowTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, person, wire, instanced, mtx, poplarGeos, mix3, clamp
} from '../lib.js';
import { buildCar, blockTex } from './metro.js';

export const DUR = 10;

// stair geometry: from platform edge x=8.05 (y=0) down to street (y=-4.5) at x=17.05
const SX0 = 8.05, SX1 = 17.05, SY1 = -4.5, SZ = -9.8, SW = 3.6;
const stairY = (x) => x <= SX0 ? 0 : x >= SX1 ? SY1 : -0.5 * (x - SX0);
const wallTop = (x) => stairY(Math.min(x, SX1)) + 1.05;

function snowTex({ seed, repeat = [1, 1], size = 512, base = [236, 240, 243], tracks = 0, prints = 0, dirt = 0.0 }) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(size, size, (u, v) => {
    const a = n.fbm(u, v, 4, 5), g = r();
    let c = mix3(base, [196, 206, 216], clamp((a - 0.45) * 2));
    c = c.map((k) => k * (0.97 + (g - 0.5) * 0.05));
    if (dirt) c = mix3(c, [150, 145, 138], clamp((n.fbm(u + 0.3, v, 3, 4) - 0.62) * 4) * dirt);
    if (tracks) {
      for (const tc of [0.22, 0.34, 0.66, 0.78]) {
        const d = Math.abs(u - tc - (n.vn(v * 6, 0, 6) - 0.5) * 0.01);
        if (d < 0.035) c = mix3(c, [120, 116, 110], (1 - d / 0.035) * 0.75 * tracks);
      }
    }
    return c;
  }, {
    repeat, post: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(150,160,172,0.55)';
      for (let i = 0; i < prints; i++) {
        const x = w * (0.3 + 0.4 * r()) + Math.sin(i * 0.7) * 14, y = (i / prints) * h;
        ctx.beginPath(); ctx.ellipse(x + (i % 2 ? 9 : -9), y, 4, 8, 0, 0, 6.28); ctx.fill();
      }
    }
  });
}

function platformSnowTex(seed) {
  // u across the platform (edge at u=0), v along; granite showing through a trodden path
  const n = Noise(seed), r = rng(seed + 1);
  return pixTex(256, 1024, (u, v) => {
    const cu = (u * 13) % 1, cv = (v * 24 * 13 / 6.6 / 10) % 1;
    const sp = r();
    let g = sp > 0.9 ? [70, 70, 72] : sp > 0.75 ? [205, 200, 192] : [150, 148, 144];
    if (cu < 0.02 || cv < 0.02) g = [95, 92, 88];
    const snow = mix3([238, 242, 245], [200, 210, 220], n.fbm(u, v, 4, 4));
    const path = Math.exp(-(((u - 0.33) / 0.1) ** 2)) * 0.9;
    let cover = clamp(0.95 - path + (n.fbm(u, v * 3, 6, 4) - 0.5) * 1.2);
    if (u < 0.08) cover = Math.max(cover, 0.9);
    const slush = mix3(g, [120, 118, 112], 0.35);
    return mix3(slush, snow, cover);
  }, {
    repeat: [1, 12], post: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(110,112,116,0.45)';
      for (let i = 0; i < 90; i++) { const x = w * (0.25 + r() * 0.3), y = r() * h; ctx.beginPath(); ctx.ellipse(x, y, 3, 7, (r() - 0.5) * 0.4, 0, 6.28); ctx.fill(); }
    }
  });
}

function facadeTex(seed, color, floors, bays) {
  const n = Noise(seed), r = rng(seed);
  const W = 512, H = 512;
  const C = new THREE.Color(color); const base = [C.r * 255, C.g * 255, C.b * 255];
  // (getHex-safe) re-read as sRGB
  const hx = C.getHex(); const B = [(hx >> 16) & 255, (hx >> 8) & 255, hx & 255];
  const lit = []; for (let i = 0; i < floors * bays; i++) lit.push(r() < 0.22);
  return pixTex(W, H, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    const fy = (1 - v) * floors, fx = u * bays;
    const fl = Math.floor(fy), bx = Math.floor(fx), ly = fy - fl, lx = fx - bx;
    let c = B.map((k) => k * (0.88 + a * 0.2));
    // cornice between floors
    if (ly > 0.93) c = c.map((k) => Math.min(255, k * 1.12));
    if (ly > 0.9 && ly < 0.93) c = c.map((k) => k * 0.75);
    const win = fl === 0 ? (lx > 0.12 && lx < 0.88 && ly > 0.1 && ly < 0.78) : (lx > 0.3 && lx < 0.7 && ly > 0.22 && ly < 0.8);
    const frame = fl === 0 ? (lx > 0.1 && lx < 0.9 && ly > 0.08 && ly < 0.8) : (lx > 0.27 && lx < 0.73 && ly > 0.19 && ly < 0.83);
    if (frame && !win) c = [236, 234, 226];
    if (win) {
      const on = lit[fl * bays + bx];
      c = on ? [236, 196, 120] : [70, 82, 92];
      if (Math.abs(lx - 0.5) < 0.012) c = [226, 224, 218];
      if (!on && ly > 0.5) c = c.map((k) => k * 1.12);
    }
    // soot streaks under sills
    c = c.map((k) => k * (1 - 0.1 * clamp(n.vn(u * 50, v * 4, 50) - 0.6) * 2));
    return c;
  });
}

export async function build({ renderer, scene, camera }) {
  const skyC = { top: '#c3ccd4', horizon: '#e5e8ea', bottom: '#c9cfd3' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#d7dce0', 0.011);
  renderer.toneMappingExposure = 0.9;
  scene.add(new THREE.HemisphereLight('#eef3f6', '#9aa2a8', 2.3));
  const sun = makeSun(scene, { color: '#f4f2ee', intensity: 0.9, dir: [0.4, 0.8, 0.35], box: 34, mapSize: 2048 });
  const r = rng(4242);
  const white = std({ color: '#eef1f4' });
  const snowMat = texMat(snowTex({ seed: 1, repeat: [6, 6] }));

  // ================= platform =================
  const plat = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.1, 120), [std({ color: '#8a8680' }), std({ color: '#8a8680' }), texMat(platformSnowTex(7)), std({ color: '#777' }), std({ color: '#8a8680' }), std({ color: '#8a8680' })]);
  plat.position.set(1.45 + 3.3, -0.55, -30); plat.receiveShadow = true; plat.castShadow = true; scene.add(plat);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 120), std({ color: '#e6e6e2' })); edge.position.set(1.62, 0.005, -30); scene.add(edge);
  const yl = []; for (let z = 29; z > -89; z -= 1) if (r() > 0.3) yl.push(mtx(2.1, 0.007, z, 0, 1, 1).multiply(new THREE.Matrix4().makeScale(1, 1, 0.4 + r() * 0.6)));
  scene.add(instanced(new THREE.BoxGeometry(0.12, 0.012, 1), std({ color: '#d8b030' }), yl, { cast: false }));
  // track bed under snow
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 400), texMat(snowTex({ seed: 3, repeat: [2, 60], dirt: 0.6 }))); deck.position.set(-3.5, -1.7, -60); deck.receiveShadow = true; scene.add(deck);
  const railM = std({ color: '#4a4744' });
  for (const tx of [0, -4.2]) {
    for (const rx of [-0.76, 0.76]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 400), railM); rl.position.set(tx + rx, -1.02, -60); scene.add(rl); }
    const slp = []; for (let z = 140; z > -260; z -= 0.6) slp.push(mtx(tx, -1.08, z));
    scene.add(instanced(new THREE.BoxGeometry(2.4, 0.08, 0.22), std({ color: '#b9bec2' }), slp, { cast: false }));
    const third = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 400), std({ color: '#3a3836' })); third.position.set(tx - 1.35, -0.9, -60); scene.add(third);
  }
  const rails2 = []; for (let z = 140; z > -260; z -= 0.5) rails2.push(mtx(-9.4, -0.55, z));
  scene.add(instanced(new THREE.BoxGeometry(0.04, 1.1, 0.04), std({ color: '#3f5a4c' }), rails2, { cast: false }));
  const hr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 400), white); hr.position.set(-9.4, 0.02, -60); scene.add(hr);

  // right railing with a gap for the stair
  const bal = []; for (let z = 29; z > -89; z -= 0.14) if (z > SZ + SW / 2 + 0.1 || z < SZ - SW / 2 - 0.1) bal.push(mtx(7.95, 0.55, z));
  scene.add(instanced(new THREE.BoxGeometry(0.025, 1.1, 0.025), std({ color: '#3f5a4c' }), bal));
  for (const [z0, z1] of [[29, SZ + SW / 2], [SZ - SW / 2, -89]]) for (const y of [1.1, 0.12]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(y > 1 ? 0.1 : 0.07, y > 1 ? 0.09 : 0.06, z0 - z1), y > 1 ? white : std({ color: '#3f5a4c' })); h.position.set(7.95, y, (z0 + z1) / 2); scene.add(h);
  }
  // platform canopy
  const colMat = texMat(peelTex({ seed: 93, top: '#5d7a6a', under: '#a19a8a', peel: 0.7, size: 256, stainAmt: 0.3 }));
  const cz0 = 14, cz1 = -70;
  for (let z = cz0 - 2; z > cz1; z -= 7) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), colMat); c.position.set(5.3, 1.7, z); c.castShadow = true; scene.add(c);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.18, 0.2), colMat); arm.position.set(4.9, 3.35, z); scene.add(arm);
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, cz0 - cz1), texMat(concreteTex({ seed: 94, color: '#d2cdc2', repeat: [2, 20], cracks: 4 }), { emissive: '#55524c' }));
  slab.position.set(4.9, 3.55, (cz0 + cz1) / 2); slab.castShadow = true; scene.add(slab);
  const slabSnow = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.18, cz0 - cz1), white); slabSnow.position.set(4.9, 3.75, (cz0 + cz1) / 2); scene.add(slabSnow);
  const tube = new THREE.MeshBasicMaterial({ color: '#f4f6ee' });
  for (let z = cz0 - 5.5; z > cz1; z -= 7) { const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.3), tube); t1.position.set(3.6, 3.4, z); scene.add(t1); }

  // M lightbox texture
  const mT = pixTex(256, 256, () => [236, 238, 232], {
    post: (ctx, w, h) => { ctx.fillStyle = '#1f8a4c'; ctx.font = '900 210px "DejaVu Sans"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', w / 2, h / 2 + 10); }
  });
  const mFace = std({ color: '#ddd', map: mT, emissive: '#ffffff', emissiveMap: mT, emissiveIntensity: 0.55 });
  const mBox = () => new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.7), [mFace, mFace, std({ color: '#555' }), std({ color: '#555' }), std({ color: '#555' }), std({ color: '#555' })]);
  const mTop = mBox(); mTop.position.set(7.7, 2.75, SZ); scene.add(mTop);
  const nameT = pixTex(1024, 128, () => [40, 70, 120], { post: (ctx, w, h) => { ctx.fillStyle = '#f2f2ee'; ctx.font = '700 86px "DejaVu Sans"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ДНІПРО', w / 2, h / 2 + 4); } });
  for (const z of [-26, -48]) { const nb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.4), std({ map: nameT, emissive: '#222' })); nb.position.set(1.52, 3.1, z); nb.rotation.y = -Math.PI / 2; scene.add(nb); }
  for (const z of [-19, -33]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 1.8), std({ color: '#6a4a30' })); b.position.set(6.9, 0.45, z); scene.add(b);
    const bs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 1.8), white); bs.position.set(6.9, 0.5, z); scene.add(bs);
  }

  // ================= train, snow on the roof =================
  for (let i = 0; i < 3; i++) {
    const c = buildCar({ seed: 300 + i * 5, cab: i === 0, roofColor: '#eef1f4' });
    c.rotation.y = Math.PI / 2; c.position.set(0, 0.05, -2 - i * 19.8); scene.add(c);
  }
  for (const s of [0.95, -0.95]) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff4dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 })); sp.position.set(s, 0.47, -2 + 0.62); sp.scale.setScalar(1.0); scene.add(sp); }
  const pax = person({ pose: 'stand', shirt: '#2a2c32', pants: '#1e2026' }); pax.position.set(4.6, 0, -34); pax.rotation.y = 0.4; scene.add(pax);

  // ================= exit stair under an arched polycarbonate canopy =================
  const gr = new THREE.MeshLambertMaterial({ color: '#9c9892' });
  const nosing = std({ color: '#5a5854' });
  for (let i = 0; i < 30; i++) {
    const top = -0.15 * (i + 1), x0 = SX0 + 0.3 * i, h = top + 4.6;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.3, h, SW), gr); st.position.set(x0 + 0.15, top - h / 2, SZ); st.receiveShadow = true; scene.add(st);
    const ns = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, SW), nosing); ns.position.set(x0 + 0.03, top + 0.005, SZ); scene.add(ns);
    // a little blown-in snow at the sides of the lower steps
    if (i > 18) for (const s of [-1, 1]) { const sn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.35 + r() * 0.3), white); sn.position.set(x0 + 0.15, top + 0.02, SZ + s * (SW / 2 - 0.3)); scene.add(sn); }
  }
  const wallShape = new THREE.Shape(); wallShape.moveTo(SX0, -4.6); wallShape.lineTo(SX1 + 0.9, -4.6); wallShape.lineTo(SX1 + 0.9, SY1 + 1.05); wallShape.lineTo(SX1, SY1 + 1.05); wallShape.lineTo(SX0, 1.05); wallShape.lineTo(SX0, -4.6);
  const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 0.3, bevelEnabled: false });
  const marble = texMat(concreteTex({ seed: 71, color: '#b9b6b0', repeat: [0.25, 0.25], cracks: 3 }));
  for (const s of [-1, 1]) { const w = new THREE.Mesh(wallGeo, marble); w.position.z = SZ + s * (SW / 2 + 0.15) - 0.15; w.castShadow = true; w.receiveShadow = true; scene.add(w); }
  // handrails
  const railMat = std({ color: '#b8bcbe', emissive: '#222' });
  for (const zz of [SZ - SW / 2 + 0.12, SZ + SW / 2 - 0.12, SZ]) {
    const pts = [new THREE.Vector3(SX0 - 0.2, 0.95, zz), new THREE.Vector3(SX0 + 0.3, 0.9, zz), new THREE.Vector3(SX1 - 0.3, SY1 + 0.9 + 0.15, zz), new THREE.Vector3(SX1 + 0.4, SY1 + 0.95, zz)];
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 40, 0.025, 6), railMat); scene.add(t);
  }
  // canopy: half-cylinder sheared along the stair slope
  const R = SW / 2 + 0.2, CX0 = SX0 - 0.3, CX1 = SX1 + 0.9;
  const cg = new THREE.CylinderGeometry(R, R, CX1 - CX0, 20, 12, true, 0, Math.PI); cg.rotateZ(Math.PI / 2); cg.translate((CX0 + CX1) / 2, 0, SZ);
  { const p = cg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + wallTop(p.getX(i))); cg.computeVertexNormals(); }
  const poly = new THREE.MeshLambertMaterial({ color: '#aebcc6', emissive: '#3c4448', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
  const canopy = new THREE.Mesh(cg, poly); scene.add(canopy);
  const ribMat = std({ color: '#7d8488' });
  for (let x = CX0; x <= CX1 + 0.01; x += 1.2) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R, x > CX1 - 0.1 ? 0.07 : 0.035, 5, 20, Math.PI), ribMat); rib.rotation.y = Math.PI / 2; rib.position.set(x, wallTop(x), SZ); scene.add(rib);
  }
  for (const a of [0.35, 0.8, 1.2, 1.57, 1.95, 2.35, 2.8]) { // longitudinal purlins
    const pts = []; for (let x = CX0; x <= CX1; x += 0.5) pts.push(new THREE.Vector3(x, wallTop(x) + Math.sin(a) * R, SZ + Math.cos(a) * R));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.02, 4), ribMat));
  }
  // snow lying on top of the canopy (seen as shadows through it) + light strip
  const strip = []; for (let x = CX0 + 0.6; x < CX1 - 0.5; x += 1.2) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.08), tube); l.position.set(x + 0.3, wallTop(x + 0.3) + R - 0.1, SZ); scene.add(l); }
  const mMouth = mBox(); mMouth.position.set(CX1 - 0.15, SY1 + 1.05 + R - 0.62, SZ); scene.add(mMouth);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), std({ color: '#333' })); rod.position.set(CX1 - 0.15, SY1 + 1.05 + R - 0.12, SZ); scene.add(rod);

  // embankment wall under the platform along the street side
  const emb = new THREE.Mesh(new THREE.BoxGeometry(18, 4.6, 400), texMat(concreteTex({ seed: 81, color: '#8f8b84', repeat: [6, 60], cracks: 20 })));
  emb.position.set(8.05 - 9, -4.6 + 2.3 - 1.1, -60); scene.add(emb);

  // ================= the city street (y = -4.5) =================
  const Y = SY1;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), texMat(snowTex({ seed: 11, repeat: [80, 80], dirt: 0.25 }))); ground.rotation.x = -Math.PI / 2; ground.position.y = Y - 0.01; ground.receiveShadow = true; scene.add(ground);
  const roadT = snowTex({ seed: 12, repeat: [1, 30], tracks: 1, dirt: 0.5, base: [226, 229, 231] });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 400), texMat(roadT)); road.rotation.x = -Math.PI / 2; road.position.set(26, Y + 0.005, -80); road.receiveShadow = true; scene.add(road);
  const walkT = snowTex({ seed: 13, repeat: [1, 40], prints: 140 });
  for (const x of [19, 32.5]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 400), texMat(walkT)); w.rotation.x = -Math.PI / 2; w.position.set(x, Y + 0.12, -80); w.receiveShadow = true; scene.add(w); const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 400), std({ color: '#9a9690' })); kerb.position.set(x + (x < 26 ? 1.9 : -1.9), Y + 0.07, -80); scene.add(kerb); }
  // snow banks along the kerbs
  const bankGeo = new THREE.SphereGeometry(1, 8, 5, 0, 6.29, 0, 1.4); bankGeo.scale(0.6, 0.4, 1.8);
  const banks = []; for (let z = 30; z > -220; z -= 1.7) for (const x of [21.2, 30.8]) if (r() > 0.2) banks.push(mtx(x + (r() - 0.5) * 0.3, Y, z, 0, 0.7 + r() * 0.5, 0.6 + r() * 0.6));
  scene.add(instanced(bankGeo, std({ color: '#e4e8ea' }), banks));

  // far-side old buildings (fronts at x = 34.5)
  const pal = ['#e8d49a', '#d9e3d2', '#e7c7b8', '#f0ece2', '#c8d8e4', '#e3b98f', '#d7cfc0'];
  let z = 40;
  const roofSnow = std({ color: '#eef1f4' });
  while (z > -230) {
    const w = 14 + r() * 12, floors = 3 + Math.floor(r() * 3), h = floors * 3.4 + 0.8, d = 12;
    const bays = Math.max(4, Math.round(w / 2.6));
    const ft = facadeTex(Math.floor(r() * 1e6), pal[Math.floor(r() * pal.length)], floors, bays);
    const side = std({ color: '#b8b2a6' });
    const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, w), [side, std({ map: ft }), side, side, side, side]);
    // the -x face must show the facade with correct u: BoxGeometry -x face spans z; fine as texture is symmetric-ish
    b.position.set(34.5 + d / 2, Y + h / 2, z - w / 2); b.castShadow = true; b.receiveShadow = true; scene.add(b);
    // pitched roof with snow
    const tri = new THREE.Shape(); tri.moveTo(-d / 2 - 0.3, 0); tri.lineTo(d / 2 + 0.3, 0); tri.lineTo(0, 3 + r()); tri.lineTo(-d / 2 - 0.3, 0);
    const rg = new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false });
    const roof = new THREE.Mesh(rg, roofSnow); roof.position.set(34.5 + d / 2, Y + h, z - w); roof.castShadow = true; scene.add(roof);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, w), std({ color: '#efece4' })); cornice.position.set(34.3, Y + h - 0.1, z - w / 2); scene.add(cornice);
    z -= w + 0.05;
  }
  // golden domes at the end of the street
  const church = new THREE.Group(); church.position.set(30, Y, -175); scene.add(church);
  const cw = std({ color: '#f2efe6' });
  const body = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 18), cw); body.position.y = 7; church.add(body);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 7, 16), cw); drum.position.y = 17.5; church.add(drum);
  const gold = pbr({ color: '#e0b24a', metalness: 0.9, roughness: 0.28, envMap: env, envMapIntensity: 1.8 });
  const onion = (s) => { const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24; const rad = Math.sin(Math.min(1, a * 1.25) * Math.PI) * (1 - a * 0.2) * 1.15 + (a < 0.1 ? 0.8 * (1 - a * 10) : 0); pts.push(new THREE.Vector2(Math.max(0.02, rad) * s, a * 2.6 * s)); } return new THREE.Mesh(new THREE.LatheGeometry(pts, 20), gold); };
  const d1 = onion(3.6); d1.position.y = 21; church.add(d1);
  for (const [x, zz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 5, 10), cw); t.position.set(x, 16.5, zz); church.add(t); const d = onion(1.5); d.position.set(x, 19, zz); church.add(d); }

  // street lamps (near side) + trolleybus wires
  const poleM = std({ color: '#3c3f40' });
  const lampPts = [];
  for (let zz = 20; zz > -200; zz -= 22) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 8, 8), poleM); p.position.set(21.3, Y + 4, zz); scene.add(p);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.07, 0.07), poleM); arm.position.set(22.3, Y + 7.8, zz); scene.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.3), std({ color: '#333', emissive: '#ffcf8a', emissiveIntensity: 1.2 })); lamp.position.set(23.3, Y + 7.7, zz); scene.add(lamp);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); gl.position.set(23.3, Y + 7.55, zz); gl.scale.setScalar(2.2); scene.add(gl);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 8, 8), poleM); p2.position.set(31.2, Y + 4, zz - 11); scene.add(p2);
    lampPts.push(zz);
  }
  for (const zz of lampPts) wire(scene, [21.3, Y + 7.2, zz], [31.2, Y + 7.2, zz - 11], 0.35, '#2a2a2a');
  for (const x of [25.2, 25.8, 27.6, 28.2]) wire(scene, [x, Y + 6.6, 30], [x, Y + 6.6, -210], 0.0, '#1e1e1e');
  const sl1 = new THREE.PointLight('#ffcf8a', 8, 14, 1.5); sl1.position.set(23.3, Y + 7.3, -2); scene.add(sl1);

  // bare snowy trees along both sidewalks
  const tg = poplarGeos(1911, 9, { crownColor: '#c3cacf', width: 1.7, crownStart: 0.38 });
  const tr = []; for (let zz = 16; zz > -200; zz -= 9) for (const x of [19.8, 33.2]) if (Math.abs(zz - SZ) > 4 || x > 30) tr.push(mtx(x + (r() - 0.5) * 0.4, Y, zz + (r() - 0.5) * 2, r() * 6, 0.85 + r() * 0.3));
  scene.add(instanced(tg.trunk, std({ color: '#3a3632' }), tr)); scene.add(instanced(tg.crown, std({ vertexColors: true, flatShading: true }), tr));

  // parked car with snow on it, a blue trolleybus down the street
  const car = new THREE.Group(); car.position.set(30.0, Y, -24); scene.add(car);
  const carBody = std({ color: '#7a2a24' });
  const cb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 4.1), carBody); cb.position.y = 0.6; car.add(cb);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.55, 2.0), std({ color: '#3a4450' })); cab.position.set(0, 1.2, -0.15); car.add(cab);
  const cs = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 2.1), white); cs.position.set(0, 1.52, -0.15); car.add(cs);
  const hs = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.1, 1.1), white); hs.position.set(0, 0.99, 1.45); car.add(hs);
  const wg = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12); wg.rotateZ(Math.PI / 2);
  for (const [x, zz] of [[-0.75, 1.3], [0.75, 1.3], [-0.75, -1.3], [0.75, -1.3]]) { const w = new THREE.Mesh(wg, std({ color: '#151515' })); w.position.set(x, 0.3, zz); car.add(w); }
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const tb = new THREE.Group(); tb.position.set(24.5, Y, -62); scene.add(tb);
  const tbB = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.9, 12), std({ color: '#3d78b8' })); tbB.position.y = 1.85; tb.add(tbB);
  const tbW = new THREE.Mesh(new THREE.BoxGeometry(2.52, 1.1, 11.2), std({ color: '#26303a' })); tbW.position.y = 2.25; tb.add(tbW);
  const tbS = new THREE.Mesh(new THREE.BoxGeometry(2.53, 0.2, 12.02), std({ color: '#e8c030' })); tbS.position.y = 1.55; tb.add(tbS);
  const tbR = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 11), white); tbR.position.y = 3.4; tb.add(tbR);
  for (const x of [0.7, 1.3]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 6.2, 5), std({ color: '#222' })); pole.position.set(x, 4.9, 1.2); pole.rotation.x = 0.55; tb.add(pole); }
  const tbF = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.2), std({ color: '#1a2028', emissive: '#111' })); tbF.position.set(0, 2.3, 6.01); tb.add(tbF);
  for (const x of [-0.8, 0.8]) { const l = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff2d8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); l.position.set(x, 0.9, 6.1); l.scale.setScalar(0.8); tb.add(l); }

  // people in winter coats
  const folk = [[19.3, -26, 3.1, '#2b2d33'], [32.6, -14, -1.4, '#5a2a2a'], [32.3, -38, 0.1, '#2e3238'], [19.0, -44, 0.2, '#3a3a40']];
  for (const [x, zz, ry, c] of folk) { const p = person({ pose: 'stand', shirt: c, pants: '#1c1d22', hair: '#2a2622' }); p.position.set(x, Y + 0.12, zz); p.rotation.y = ry; scene.add(p); }

  // river + far bank (visible from the platform to the left)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), pbr({ color: '#6f8795', roughness: 0.3, metalness: 0.35, envMap: env }));
  water.rotation.x = -Math.PI / 2; water.position.y = -18; water.position.x = -1600; scene.add(water);
  const bTex = [blockTex(1, '#e0dbd2'), blockTex(2, '#cfc8bc'), blockTex(4, '#e8e6e0')];
  for (let i = 0; i < 40; i++) { const h = 20 + r() * 60, w = 12 + r() * 20; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), texMat(bTex[Math.floor(r() * 3)])); m.position.set(-170 - r() * 200, -18 + h / 2, 60 - r() * 600); scene.add(m); }

  // ================= falling snow =================
  const NF = 5000, fr = rng(77);
  const base = new Float32Array(NF * 3), spd = new Float32Array(NF), phs = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { base[i * 3] = fr() * 40 - 20; base[i * 3 + 1] = fr() * 16; base[i * 3 + 2] = fr() * 40 - 20; spd[i] = 0.6 + fr() * 0.7; phs[i] = fr() * 6.28; }
  const fgeo = new THREE.BufferGeometry(); const fpos = new Float32Array(NF * 3); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flakes = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.045, map: glowTex(), color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.95, sizeAttenuation: true }));
  flakes.frustumCulled = false; scene.add(flakes);
  const wrap = (v, lo, span) => lo + (((v - lo) % span) + span) % span;

  // ================= camera =================
  const pts = [[3.7, 0, 5], [3.9, 0, 0], [4.8, 0, -5], [6.7, 0, -8.8], [8.4, -0.05, -9.8], [12.6, -2.25, -9.8], [16.8, -4.45, -9.8], [19.4, -4.5, -10.6], [20.9, -4.5, -13.2], [21.6, -4.5, -16.5]];
  const yaw = kf([[0, 0.28], [1.6, 0.35], [3.0, 0.0], [4.2, 0], [7.4, 0.0], [8.6, 0.25], [10, 0.1]]);
  const pitch = kf([[0, 0.0], [3.2, -0.05], [4.3, -0.3], [6.3, -0.22], [7.6, -0.05], [8.6, 0.04], [10, 0.06]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.014, stride: 0.75, lookAhead: 3.5, ease: 0.8, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => {
    cam(t);
    sun.follow(camera.position);
    const c = camera.position;
    for (let i = 0; i < NF; i++) {
      const x = base[i * 3] + Math.sin(t * 0.8 + phs[i]) * 0.3 + t * 0.25, y = base[i * 3 + 1] - spd[i] * t, zz = base[i * 3 + 2] + Math.cos(t * 0.6 + phs[i]) * 0.3;
      fpos[i * 3] = wrap(x, c.x - 20, 40); fpos[i * 3 + 1] = wrap(y, c.y - 6, 16); fpos[i * 3 + 2] = wrap(zz, c.z - 20, 40);
    }
    fgeo.attributes.position.needsUpdate = true;
  };
}
