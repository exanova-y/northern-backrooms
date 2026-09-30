import {
  THREE, rng, Noise, pixTex, peelTex, concreteTex, dirtTex, glowTex, softTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, person, wire, instanced, mtx, poplarGeos, poplarBark, mix3, clamp
} from '../lib.js';

export const DUR = 5;

// ---------- train textures ----------
function liveryTex(seed, closedDoors) {
  // side panel 19 m x 2.6 m, uv: u along length, v up (y from -0.4 to 2.2)
  const n = Noise(seed);
  const W = 2048, H = 280;
  const yOf = (y) => H - ((y + 0.4) / 2.6) * H; // world y -> canvas y
  return pixTex(W, H, (u, v) => {
    const y = -0.4 + (1 - v) * 2.6;
    const a = n.fbm(u * 8, v, 4, 4);
    let c = [58, 122, 190]; // Kyiv metro blue
    if (y > 0.86 && y < 1.0) c = [238, 196, 40]; // yellow stripe under the windows
    if (y > -0.16 && y < -0.08) c = [238, 196, 40];
    if (y < -0.2) c = [40, 70, 110];
    const grime = 1 - 0.25 * Math.max(0, 0.4 - (y + 0.4)) * 2 - 0.08 * a;
    return [c[0] * grime, c[1] * grime, c[2] * grime];
  }, {
    post: (ctx) => {
      if (!closedDoors) return;
      ctx.strokeStyle = 'rgba(20,35,60,0.9)'; ctx.lineWidth = 3;
      for (const dx of [2.6, 7.2, 11.8, 16.4]) {
        const x0 = (dx - 0.65) / 19 * W, x1 = (dx + 0.65) / 19 * W;
        ctx.strokeRect(x0, yOf(1.95), x1 - x0, yOf(0) - yOf(1.95));
        ctx.beginPath(); ctx.moveTo((x0 + x1) / 2, yOf(1.95)); ctx.lineTo((x0 + x1) / 2, yOf(0)); ctx.stroke();
      }
    }
  });
}

const DOORS = [2.6, 7.2, 11.8, 16.4];
const WINDOWS = [[0.6, 1.9], [3.6, 6.2], [8.2, 10.8], [12.8, 15.4], [17.4, 18.4]];

function sideShape(withDoors) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.4); s.lineTo(19, -0.4); s.lineTo(19, 2.2); s.lineTo(0, 2.2); s.lineTo(0, -0.4);
  const hole = (x0, y0, x1, y1) => { const h = new THREE.Path(); h.moveTo(x0, y0); h.lineTo(x0, y1); h.lineTo(x1, y1); h.lineTo(x1, y0); h.lineTo(x0, y0); s.holes.push(h); };
  for (const [a, b] of WINDOWS) {
    // pairs of windows with a mullion
    const mid = (a + b) / 2;
    if (b - a > 2) { hole(a + 0.1, 1.05, mid - 0.05, 1.95); hole(mid + 0.05, 1.05, b - 0.1, 1.95); }
    else hole(a + 0.05, 1.05, b - 0.05, 1.95);
  }
  if (withDoors) for (const d of DOORS) hole(d - 0.65, 0.0, d + 0.65, 1.95);
  return s;
}

export function buildCar(opts) {
  const { seed, cab, roofColor = '#8a939a' } = opts;
  const g = new THREE.Group();
  const outNear = new THREE.MeshLambertMaterial({ map: liveryTex(seed, false), side: THREE.DoubleSide });
  const outFar = new THREE.MeshLambertMaterial({ map: liveryTex(seed + 1, true), side: THREE.DoubleSide });
  const inner = std({ color: '#d9d2bd', side: THREE.DoubleSide });
  const uvFix = (geo) => { // ShapeGeometry uv = xy -> normalise to 0..1
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / 19, (p.getY(i) + 0.4) / 2.6);
    return geo;
  };
  const nearGeo = uvFix(new THREE.ShapeGeometry(sideShape(true)));
  const farGeo = uvFix(new THREE.ShapeGeometry(sideShape(false)));
  const add = (geo, mat, z) => { const m = new THREE.Mesh(geo, mat); m.position.z = z; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  add(nearGeo, outNear, 1.35); add(nearGeo, inner, 1.29);
  add(farGeo, outFar, -1.35); add(farGeo, inner, -1.29);
  // door reveals (thickness) on the open side
  const reveal = std({ color: '#8e97a0' });
  for (const d of DOORS) {
    for (const dx of [-0.65, 0.65]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.95, 0.08), reveal); r.position.set(d + dx, 0.975, 1.32); g.add(r); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.04, 0.08), reveal); top.position.set(d, 1.95, 1.32); g.add(top);
    // door leaves slid into the pockets, just visible
    for (const s of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.9, 0.03), std({ color: '#b9c0c4' })); leaf.position.set(d + s * 0.98, 0.97, 1.31); g.add(leaf); }
  }
  // glass
  const glass = new THREE.MeshLambertMaterial({ color: '#3c4c58', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  for (const z of [1.34, -1.34]) for (const [a, b] of WINDOWS) { const gl = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 0.9), glass); gl.position.set((a + b) / 2, 1.5, z); g.add(gl); }
  // floor, ceiling, lights
  const floor = new THREE.Mesh(new THREE.BoxGeometry(19, 0.08, 2.6), std({ color: '#7a5a44' })); floor.position.set(9.5, -0.04, 0); floor.receiveShadow = true; g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(19, 2.6), std({ color: '#ece6d4', emissive: '#6a6458' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(9.5, 2.15, 0); g.add(ceil);
  for (const z of [-0.55, 0.55]) { const l = new THREE.Mesh(new THREE.BoxGeometry(18, 0.04, 0.16), new THREE.MeshBasicMaterial({ color: '#fff6e0' })); l.position.set(9.5, 2.12, z); g.add(l); }
  // seats between doors
  const seatM = std({ color: '#6a4032' }), backM = std({ color: '#7a4a3a' });
  const segs = [[0.3, 1.9], [3.35, 6.45], [7.95, 11.05], [12.55, 15.65], [17.15, 18.7]];
  for (const [a, b] of segs) for (const s of [-1, 1]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.14, 0.48), seatM); seat.position.set((a + b) / 2, 0.45, s * 1.02); g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.5, 0.1), backM); back.position.set((a + b) / 2, 0.8, s * 1.22); back.rotation.x = s * 0.12; g.add(back);
    const base = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.38, 0.4), std({ color: '#3a3a3c' })); base.position.set((a + b) / 2, 0.19, s * 1.02); g.add(base);
  }
  // poles & rails
  const chrome = std({ color: '#c9cdd0', emissive: '#2a2a2a' });
  for (const d of DOORS) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.15, 8), chrome); p.position.set(d + s * 0.72, 1.07, s * 0.0 + 0.62); g.add(p); }
  for (const z of [-0.75, 0.75]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 18.4, 6), chrome); r.rotation.z = Math.PI / 2; r.position.set(9.5, 1.95, z); g.add(r); }
  // interior light to spill onto the platform through the doors
  const il = new THREE.PointLight('#ffe9c4', 5, 8, 1.4); il.position.set(4.9, 1.8, 0.3); g.add(il);
  // roof
  const prof = new THREE.Shape(); prof.moveTo(-1.36, 0);
  for (let i = 0; i <= 12; i++) { const a = Math.PI - i / 12 * Math.PI; prof.lineTo(Math.cos(a) * 1.36, Math.sin(a) * 0.32); }
  prof.lineTo(-1.36, 0);
  const rg = new THREE.ExtrudeGeometry(prof, { depth: 19, bevelEnabled: false, curveSegments: 12 }); rg.rotateY(-Math.PI / 2); rg.translate(19, 0, 0);
  const roof = new THREE.Mesh(rg, std({ color: roofColor })); roof.position.y = 2.2; roof.castShadow = true; g.add(roof);
  // undercarriage + bogies
  const under = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.55, 2.3), std({ color: '#2a2c2e' })); under.position.set(9.5, -0.68, 0); under.castShadow = true; g.add(under);
  const wheelGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.1, 16); wheelGeo.rotateX(Math.PI / 2);
  for (const bx of [3.2, 15.8]) {
    const bog = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 2.0), std({ color: '#1f2022' })); bog.position.set(bx, -0.85, 0); g.add(bog);
    for (const wx of [-1.05, 1.05]) for (const wz of [-0.72, 0.72]) { const w = new THREE.Mesh(wheelGeo, std({ color: '#3a3634' })); w.position.set(bx + wx, -1.05 + 0.39 - 0.4, wz); g.add(w); }
  }
  // end walls
  for (const ex of [0, 19]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.6, 2.7), std({ color: '#35587e' })); e.position.set(ex, 0.9, 0); g.add(e); }
  if (cab) {
    // cab nose at local x<0
    const nose = new THREE.Group(); g.add(nose);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.9, 2.7), std({ color: '#3a7abe' })); body.position.set(-0.27, 0.85, 0); body.castShadow = true; nose.add(body);
    const face = -0.56;
    const wind = std({ color: '#1a2230', emissive: '#10151c' });
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 0.95), wind); w.position.set(face, 1.45, s * 0.6); w.rotation.y = -Math.PI / 2; nose.add(w); }
    const frame = std({ color: '#eec428' });
    const bar = (w, h, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, h, w), frame); m.position.set(face - 0.005, y, z); nose.add(m); };
    bar(2.5, 0.07, 0.93, 0); bar(2.5, 0.05, 1.96, 0); bar(0.05, 1.05, 1.45, 0); bar(0.05, 1.05, 1.45, 1.22); bar(0.05, 1.05, 1.45, -1.22);
    bar(2.7, 0.08, -0.12, 0);
    const lampM = new THREE.MeshBasicMaterial({ color: '#fff8e8' });
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), lampM); l.position.set(face - 0.01, 0.42, s * 0.95); l.rotation.y = -Math.PI / 2; nose.add(l);
      const red = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: '#5a1010' })); red.position.set(face - 0.01, 0.42, s * 0.65); red.rotation.y = -Math.PI / 2; nose.add(red);
    }
    const route = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), std({ color: '#111', emissive: '#1a1a1a' })); route.position.set(face - 0.01, 2.12, 0); route.rotation.y = -Math.PI / 2; nose.add(route);
    const coupler = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.3), std({ color: '#222' })); coupler.position.set(-0.6, -0.55, 0); nose.add(coupler);
    const noseRoof = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 2.6), std({ color: roofColor })); noseRoof.position.set(-0.27, 2.35, 0); nose.add(noseRoof);
    g.userData.headlights = [0.95, -0.95];
  }
  g.traverse((o) => { if (o.isMesh && o.castShadow === false && o.geometry.type === 'BoxGeometry') o.castShadow = true; });
  return g;
}

export function blockTex(seed, base = '#d8cbb4', lit = 0.0) {
  const r = rng(seed);
  return pixTex(256, 512, (u, v) => {
    const cu = u * 8, cv = v * 24, fu = cu % 1, fv = cv % 1;
    const win = fu > 0.25 && fu < 0.75 && fv > 0.3 && fv < 0.8;
    const b = new THREE.Color(base);
    let c = [b.r * 255, b.g * 255, b.b * 255];
    if (win) c = [60, 70, 80];
    if (Math.abs(u - 0.5) < 0.004) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
    return c;
  });
}

export async function build({ renderer, scene, camera }) {
  const skyC = { top: '#7fbcd2', horizon: '#e4dcc6', bottom: '#9aa5a6' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#cfd6d2', 0.0034);
  renderer.toneMappingExposure = 1.05;
  scene.add(new THREE.HemisphereLight('#cfe6ee', '#6d6458', 1.7));
  const sunDir = [0.55, 0.3, 0.55];
  const sun = makeSun(scene, { color: '#ffd9a8', intensity: 3.0, dir: sunDir, box: 30, mapSize: 2048 });
  const r = rng(909);

  // ---- platform (top at y=0), track bed at y=-1.1 ----
  const gn = Noise(91);
  const granite = pixTex(512, 512, (u, v, x, y) => {
    const cu = (u * 4) % 1, cv = (v * 4) % 1;
    const sp = Math.random();
    let c = sp > 0.9 ? [70, 70, 72] : sp > 0.75 ? [205, 200, 192] : [158, 154, 148];
    const a = gn.fbm(u, v, 4, 5); c = c.map((k) => k * (0.85 + 0.25 * a));
    if (cu < 0.012 || cv < 0.012) c = [95, 92, 88];
    return c;
  }, { repeat: [3, 30] });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(6.6, 1.1, 120), texMat(granite));
  plat.position.set(1.45 + 3.3, -0.55, -30); plat.receiveShadow = true; plat.castShadow = true; scene.add(plat);
  const edgeMat = std({ color: '#d9d4c6' });
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.02, 120), edgeMat); edge.position.set(1.62, 0.005, -30); edge.receiveShadow = true; scene.add(edge);
  const yl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 120), std({ color: '#e8b820' })); yl.position.set(2.1, 0.006, -30); yl.receiveShadow = true; scene.add(yl);
  // track bed on the bridge deck
  const deckT = concreteTex({ seed: 92, color: '#8a8378', repeat: [2, 40], cracks: 10 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 400), texMat(deckT)); deck.position.set(-3.5, -1.7, -60); deck.receiveShadow = true; scene.add(deck);
  const railM = std({ color: '#7d7a76' });
  for (const tx of [0, -4.2]) {
    for (const rx of [-0.76, 0.76]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 400), railM); rl.position.set(tx + rx, -1.02, -60); scene.add(rl); }
    const slp = []; for (let z = 140; z > -260; z -= 0.6) slp.push(mtx(tx, -1.1, z));
    scene.add(instanced(new THREE.BoxGeometry(2.4, 0.12, 0.22), std({ color: '#5a544c' }), slp, { cast: false }));
    const third = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 400), std({ color: '#4a4640' })); third.position.set(tx - 1.35, -0.9, -60); scene.add(third);
  }
  // far deck railing
  const rails2 = []; for (let z = 140; z > -260; z -= 0.5) rails2.push(mtx(-9.4, -0.55, z));
  scene.add(instanced(new THREE.BoxGeometry(0.04, 1.1, 0.04), std({ color: '#4a5a52' }), rails2, { cast: false }));
  const hr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 400), std({ color: '#4a5a52' })); hr.position.set(-9.4, 0.0, -60); scene.add(hr);

  // platform railing on the right (painted green steel, a bit rusty)
  const bal = []; for (let z = 29; z > -89; z -= 0.14) bal.push(mtx(7.95, 0.55, z));
  scene.add(instanced(new THREE.BoxGeometry(0.025, 1.1, 0.025), std({ color: '#3f5a4c' }), bal));
  for (const y of [1.1, 0.12]) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 118), std({ color: '#3f5a4c' })); h.position.set(7.95, y, -30); scene.add(h); }

  // canopy: columns + slab + fluorescent tubes
  const colMat = texMat(peelTex({ seed: 93, top: '#5d7a6a', under: '#a19a8a', peel: 0.7, size: 256, stainAmt: 0.3 }));
  const canopyZ0 = 14, canopyZ1 = -70;
  for (let z = canopyZ0 - 2; z > canopyZ1; z -= 7) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), colMat); c.position.set(5.3, 1.7, z); c.castShadow = true; c.receiveShadow = true; scene.add(c);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.18, 0.2), colMat); arm.position.set(4.9, 3.35, z); arm.castShadow = true; scene.add(arm);
  }
  const slabT = concreteTex({ seed: 94, color: '#d2cdc2', repeat: [2, 20], cracks: 4, moss: 0 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, canopyZ0 - canopyZ1), texMat(slabT, { emissive: '#4a4740' })); slab.position.set(4.9, 3.55, (canopyZ0 + canopyZ1) / 2); slab.castShadow = true; slab.receiveShadow = true; scene.add(slab);
  const tube = new THREE.MeshBasicMaterial({ color: '#f4f6ee' });
  for (let z = canopyZ0 - 5.5; z > canopyZ1; z -= 7) { const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.3), tube); t1.position.set(3.6, 3.4, z); scene.add(t1); }

  // hanging green M sign in a lightbox
  const mT = pixTex(256, 256, (u, v) => [236, 238, 232], {
    post: (ctx, w, h) => { ctx.fillStyle = '#1f8a4c'; ctx.font = '900 210px "DejaVu Sans"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', w / 2, h / 2 + 10); }
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.7), [std({ color: '#ddd', map: mT, emissive: '#ffffff', emissiveMap: mT, emissiveIntensity: 0.6 }), std({ color: '#ddd', map: mT, emissive: '#ffffff', emissiveMap: mT, emissiveIntensity: 0.6 }), std({ color: '#555' }), std({ color: '#555' }), std({ color: '#555' }), std({ color: '#555' })]);
  // face the sign toward +z (camera): box faces x, so rotate
  box.rotation.y = Math.PI / 2; box.position.set(3.4, 2.95, -12); scene.add(box);
  for (const dx of [-0.25, 0.25]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 4), std({ color: '#333' })); rod.position.set(3.4 + dx, 3.42, -12); scene.add(rod); }
  // station name board (Cyrillic), on the canopy fascia
  const nameT = pixTex(1024, 128, (u, v) => [40, 70, 120], {
    post: (ctx, w, h) => { ctx.fillStyle = '#f2f2ee'; ctx.font = '700 86px "DejaVu Sans"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ДНІПРО', w / 2, h / 2 + 4); }
  });
  const nameB = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.4), std({ map: nameT, emissive: '#222222' })); nameB.position.set(1.52, 3.1, -26); nameB.rotation.y = -Math.PI / 2; scene.add(nameB);
  const nameB2 = nameB.clone(); nameB2.position.z = -48; scene.add(nameB2);

  // benches + bin under canopy
  for (const z of [-5, -19, -33]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 1.8), std({ color: '#6a4a30' })); b.position.set(6.9, 0.45, z); b.castShadow = true; scene.add(b);
    for (const dz of [-0.75, 0.75]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.06), std({ color: '#2e3a34' })); l.position.set(6.9, 0.22, z + dz); scene.add(l); }
  }

  // ---- the train: 3 cars, cab facing the camera at z = -2 ----
  const cars = [];
  for (let i = 0; i < 3; i++) {
    const c = buildCar({ seed: 300 + i * 5, cab: i === 0 });
    c.rotation.y = Math.PI / 2; c.position.set(0, 0.05, -2 - i * 19.8); scene.add(c); cars.push(c);
  }
  const hl = cars[0].userData.headlights.map((s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff4dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })); sp.position.set(s, 0.47, -2 + 0.62); sp.scale.setScalar(0.9); scene.add(sp); return sp; });

  // a lone passenger far down the platform
  const pax = person({ pose: 'stand', shirt: '#2e3036', pants: '#1e2026', hair: '#2a2420' }); pax.position.set(4.6, 0, -34); pax.rotation.y = 0.4; scene.add(pax);

  // ---- surroundings ----
  // river
  const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), pbr({ color: '#5a7f93', roughness: 0.25, metalness: 0.4, envMap: env, envMapIntensity: 1.0 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -18; scene.add(water);
  // far (left) bank: tower blocks in haze
  const bTex = [blockTex(1, '#dccfb6'), blockTex(2, '#c9b9a0'), blockTex(3, '#b86a52'), blockTex(4, '#e2dccc')];
  for (let i = 0; i < 60; i++) {
    const h = 20 + r() * 60, w = 12 + r() * 20;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), texMat(bTex[Math.floor(r() * 4)]));
    m.position.set(-170 - r() * 200, -18 + h / 2, 60 - r() * 600); scene.add(m);
  }
  // far bank low shore & trees
  const shore = new THREE.Mesh(new THREE.BoxGeometry(600, 4, 1400), std({ color: '#7a7058' })); shore.position.set(-460, -17, -200); scene.add(shore);
  // arch bridge downstream (behind-left)
  const arch = new THREE.Mesh(new THREE.TorusGeometry(160, 2.2, 6, 64, Math.PI), std({ color: '#d9d6cc' }));
  arch.position.set(-140, -10, -420); arch.rotation.y = 0.35; arch.scale.set(1, 0.33, 1); scene.add(arch);
  const archDeck = new THREE.Mesh(new THREE.BoxGeometry(340, 3, 12), std({ color: '#b8b4aa' })); archDeck.position.set(-140, -8, -420); archDeck.rotation.y = 0.35; scene.add(archDeck);
  // bridge continuing ahead
  const brg = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 700), texMat(deckT)); brg.position.set(-3.5, -3.8, -450); scene.add(brg);
  for (let z = -120; z > -800; z -= 60) { const p = new THREE.Mesh(new THREE.BoxGeometry(6, 16, 5), std({ color: '#9a958a' })); p.position.set(-3.5, -12, z); scene.add(p); }

  // right side: wooded hillside, late-autumn trees, a golden dome
  const hill = new THREE.Mesh(new THREE.PlaneGeometry(400, 300, 20, 20), std({ color: '#6e6040' }));
  { const p = hill.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, Math.max(0, (x + 200) * 0.28) + Math.sin(y * 0.05) * 3); } hill.geometry.computeVertexNormals(); }
  hill.rotation.x = -Math.PI / 2; hill.rotation.z = Math.PI / 2; hill.position.set(12 + 200, -14, -60);
  // simpler: ramp mesh
  hill.visible = false; scene.add(hill);
  const slope = new THREE.Mesh(new THREE.BoxGeometry(200, 2, 500), std({ color: '#6e6444' })); slope.position.set(100, 10, -80); slope.rotation.z = 0.32; slope.receiveShadow = true; scene.add(slope);
  const tg = poplarGeos(911, 12, { crownColor: '#8a6a44', width: 1.9, crownStart: 0.3 });
  const tg2 = poplarGeos(912, 10, { crownColor: '#9a7a40', width: 1.6, crownStart: 0.35 });
  const tA = [], tB = [];
  for (let i = 0; i < 260; i++) {
    const x = 24 + r() * 110, z = 30 - r() * 260; const y = -12 + (x - 24) * 0.33;
    (r() < 0.5 ? tA : tB).push(mtx(x, y, z, r() * 6, 0.8 + r() * 0.5));
  }
  const barkM = std({ color: '#5a524a' });
  scene.add(instanced(tg.trunk, barkM, tA)); scene.add(instanced(tg.crown, std({ vertexColors: true, flatShading: true }), tA));
  scene.add(instanced(tg2.trunk, barkM, tB)); scene.add(instanced(tg2.crown, std({ vertexColors: true, flatShading: true }), tB));
  // bell tower with golden dome on the hill
  const bt = new THREE.Group(); bt.position.set(70, 18, -150); scene.add(bt);
  const white = std({ color: '#efece2' });
  const tiers = [[14, 16], [11, 14], [8, 12], [6, 10]]; let yy = 0;
  for (const [w, h] of tiers) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), white); t.position.y = yy + h / 2; bt.add(t); yy += h; }
  const dPts = []; for (let i = 0; i <= 20; i++) { const a = i / 20; dPts.push(new THREE.Vector2(Math.sin(a * Math.PI) * 3.2 * (1 - a * 0.4) + (a > 0.8 ? 0 : 0), a * 7)); }
  dPts.push(new THREE.Vector2(0.2, 8.5)); dPts.push(new THREE.Vector2(0, 9));
  const dome = new THREE.Mesh(new THREE.LatheGeometry(dPts, 16), pbr({ color: '#e0b24a', metalness: 0.9, roughness: 0.25, envMap: env, envMapIntensity: 1.6 }));
  dome.position.y = yy; bt.add(dome);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), pbr({ color: '#e0b24a', metalness: 0.9, roughness: 0.3, envMap: env })); cross.position.y = yy + 10; bt.add(cross);

  // power catenary poles along the far railing (light)
  for (let z = 20; z > -200; z -= 40) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), std({ color: '#5a625e' })); p.position.set(-9.2, 2.4, z); scene.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), std({ color: '#eee', emissive: '#555' })); l.position.set(-9.0, 5.4, z); scene.add(l); }

  // a few leaves on the platform
  const leafGeo = new THREE.PlaneGeometry(0.08, 0.05); leafGeo.rotateX(-Math.PI / 2);
  const lf = []; for (let i = 0; i < 400; i++) lf.push(mtx(2.3 + r() * 5.4, 0.012, 16 - r() * 80, r() * 6, 0.7 + r() * 0.8));
  const leaves = instanced(leafGeo, std({ color: '#fff', side: THREE.DoubleSide }), lf, { cast: false });
  lf.forEach((_, i) => leaves.setColorAt(i, new THREE.Color(['#b8742e', '#8a5a2a', '#c9a040', '#6a4a2a'][Math.floor(r() * 4)]))); scene.add(leaves);

  const pts = [[3.7, 0, 9], [3.6, 0, 4], [3.5, 0, -1], [3.45, 0, -3]];
  const yaw = kf([[0, 0.12], [2.5, 0.22], [5, 0.42]]);
  const pitch = kf([[0, 0.0], [5, -0.04]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.015, stride: 0.75, lookAhead: 6, ease: 0.6, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => { cam(t); sun.follow(camera.position.clone().add(new THREE.Vector3(0, 0, -8))); };
}
