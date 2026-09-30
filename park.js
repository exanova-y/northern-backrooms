import {
  THREE, rng, Noise, pixTex, peelTex, concreteTex, dirtTex, textTex, rustTex, glowTex, softTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, Smoke, person, loudspeakerPole, wire, instanced, mtx, poplarGeos, poplarBark, mix3, lerp
} from '../lib.js';

export const DUR = 15;

export async function build({ renderer, scene, camera }) {
  const skyC = { top: '#aaa89e', horizon: '#c9c2ae', bottom: '#b3aa96' };
  makeSky(scene, skyC);
  scene.fog = new THREE.FogExp2('#c3bca9', 0.02);
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#dcd8cc', '#7b705c', 2.2));
  const sunDir = [0.3, 0.55, -0.78];
  const sun = makeSun(scene, { color: '#f5dcb4', intensity: 1.5, dir: sunDir, box: 40, mapSize: 1536 });
  const sd = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fbe7c6', fog: false, transparent: true, depthWrite: false, opacity: 0.7 }));
  sd.scale.set(40, 40, 1); scene.add(sd);
  const r = rng(303);
  const soft = softTex();

  // ground: cracked concrete tiles + dirt beyond
  const dirt = dirtTex({ seed: 61, color: '#7d725c', repeat: [60, 60], leaves: 50 });
  const g0 = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), texMat(dirt)); g0.rotation.x = -Math.PI / 2; g0.position.y = -0.01; g0.receiveShadow = true; scene.add(g0);
  const tileN = Noise(62);
  const plazaT = pixTex(512, 512, (u, v) => {
    const cu = (u * 4) % 1, cv = (v * 4) % 1;
    const a = tileN.fbm(u, v, 4, 6), g = tileN.fbm(u, v, 64, 2);
    let c = mix3([168, 162, 148], [140, 134, 120], a);
    if (cu < 0.02 || cv < 0.02) c = [90, 92, 80];
    const moss = tileN.fbm(u + 0.4, v, 3, 4);
    if (moss > 0.63) c = mix3(c, [86, 92, 58], Math.min(1, (moss - 0.63) * 6));
    return [c[0] * (0.9 + g * 0.2), c[1] * (0.9 + g * 0.2), c[2] * (0.9 + g * 0.2)];
  }, {
    repeat: [12, 16], post: (ctx, w, h) => {
      const rr = rng(9); ctx.strokeStyle = 'rgba(40,38,32,0.6)';
      for (let k = 0; k < 16; k++) { let x = rr() * w, y = rr() * h, a = rr() * 6.28; ctx.lineWidth = 1 + rr(); ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 22; s++) { a += (rr() - 0.5) * 1.2; x += Math.cos(a) * 7; y += Math.sin(a) * 7; ctx.lineTo(x, y); } ctx.stroke(); }
      // litter: shells, a few scraps
      const r2 = rng(10);
      for (let i = 0; i < 60; i++) { ctx.save(); ctx.translate(r2() * w, r2() * h); ctx.rotate(r2() * 6); ctx.fillStyle = r2() < 0.8 ? '#1c1a18' : '#d6d0c0'; ctx.beginPath(); ctx.ellipse(0, 0, 2.2, 1, 0, 0, 6.28); ctx.fill(); ctx.restore(); }
    }
  });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(48, 64), texMat(plazaT)); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.0, -22); plaza.receiveShadow = true; scene.add(plaza);

  const conc = concreteTex({ seed: 64, color: '#a8a296', repeat: [1, 1], cracks: 8, moss: 0.6 });
  const concMat = texMat(conc);
  const redPeel = peelTex({ seed: 65, top: '#9b2b22', under: '#b7ad98', stain: '#4a3a2a', peel: 0.58, size: 256 });
  const redMat = texMat(redPeel);
  const rust = texMat(rustTex({ seed: 66, paint: '#4a7a6a', rust: 0.6, repeat: [2, 2] }));
  const rustRed = texMat(rustTex({ seed: 67, paint: '#9a3a2a', rust: 0.55 }));

  // --- gate 人民公园 ---
  const gate = new THREE.Group(); gate.position.set(0, 0, 6); scene.add(gate);
  for (const x of [-4.2, 4.2]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 6, 1.1), concMat); p.position.set(x, 3, 0); p.castShadow = p.receiveShadow = true; gate.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(10.4, 1.4, 1.2), concMat); beam.position.set(0, 6.4, 0); beam.castShadow = true; gate.add(beam);
  const signT = textTex(['人民公园'], { w: 1024, h: 180, color: '#a82a20', under: '#9a4538', fade: 0.3, peel: 0.62, seed: 70, font: '900 140px "Noto Serif CJK SC"' });
  for (const z of [0.61, -0.61]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.2), texMat(signT)); s.position.set(0, 6.4, z); if (z < 0) s.rotation.y = Math.PI; gate.add(s); }
  const star = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, rad = i % 2 ? 0.38 : 0.9; const x = Math.cos(a) * rad, y = Math.sin(a) * rad; i ? star.lineTo(x, y) : star.moveTo(x, y); }
  const starM = new THREE.Mesh(new THREE.ExtrudeGeometry(star, { depth: 0.2, bevelEnabled: false }), redMat); starM.position.set(0, 7.9, -0.1); starM.castShadow = true; gate.add(starM);
  // rusted fence
  const fenceBars = [];
  for (let x = 5; x < 60; x += 0.25) for (const s of [-1, 1]) fenceBars.push(mtx(s * x, 0.9, 6, 0, 1, 1, 0, (r() - 0.5) * (r() < 0.08 ? 0.5 : 0.03)));
  scene.add(instanced(new THREE.BoxGeometry(0.03, 1.8, 0.03), rust.clone(), fenceBars));
  for (const s of [-1, 1]) for (const y of [0.3, 1.6]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(55, 0.05, 0.05), rust); rail.position.set(s * 32.5, y, 6); scene.add(rail); }

  // --- statue on plinth ---
  const statue = new THREE.Group(); statue.position.set(0, 0, -32); scene.add(statue);
  const st1 = new THREE.Mesh(new THREE.BoxGeometry(5, 0.6, 5), concMat); st1.position.y = 0.3; statue.add(st1);
  const st2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 2.4), concMat); st2.position.y = 2.2; statue.add(st2);
  const plT = textTex(['为人民服务'], { w: 128, h: 640, vertical: true, color: '#8e2a20', under: '#aba594', fade: 0.4, peel: 0.6, seed: 71, font: '900 100px "Noto Serif CJK SC"' });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.6), texMat(plT)); pl.position.set(0, 2.2, 1.21); statue.add(pl);
  const figMat = texMat(concreteTex({ seed: 72, color: '#8f8a80', cracks: 6, moss: 0.3 }));
  const F = new THREE.Group(); F.position.y = 3.8; statue.add(F);
  const part = (w, h, d, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), figMat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; F.add(m); };
  part(0.42, 1.9, 0.5, -0.32, 0.95, 0.1, 0.1); part(0.42, 1.9, 0.5, 0.32, 0.95, -0.2, -0.2); // legs, striding
  part(1.2, 1.5, 0.7, 0, 2.55, 0); // torso
  part(0.35, 1.5, 0.35, 0.75, 3.7, 0, 0, -0.35); // raised arm
  part(0.35, 1.3, 0.35, -0.75, 2.5, 0.1, 0.2, 0.15);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 10, 8), figMat); head.position.set(0, 3.6, 0); head.castShadow = true; F.add(head);
  part(0.8, 0.14, 0.14, -0.5, 1.5, 0.4, 0, 0.9); // tool handle (hammer)

  // --- dry fountain ---
  const fz = -17;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.1, 0.7, 40, 1, true), concMat); ring.position.set(0, 0.35, fz); ring.receiveShadow = ring.castShadow = true; scene.add(ring);
  const ringIn = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.7, 0.7, 40, 1, true), std({ map: conc, side: THREE.BackSide })); ringIn.position.set(0, 0.35, fz); scene.add(ringIn);
  const ringTop = new THREE.Mesh(new THREE.RingGeometry(4.7, 5.1, 40), concMat); ringTop.rotation.x = -Math.PI / 2; ringTop.position.set(0, 0.7, fz); scene.add(ringTop);
  const basinT = dirtTex({ seed: 73, color: '#5f5a4a', repeat: [3, 3], leaves: 160, shells: 60 });
  const basin = new THREE.Mesh(new THREE.CircleGeometry(4.7, 40), texMat(basinT)); basin.rotation.x = -Math.PI / 2; basin.position.set(0, 0.05, fz); basin.receiveShadow = true; scene.add(basin);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.6, 1.8, 10), concMat); spout.position.set(0, 0.9, fz); spout.castShadow = true; scene.add(spout);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.4, 0.4, 16), concMat); bowl.position.set(0, 1.9, fz); bowl.castShadow = true; scene.add(bowl);

  // --- swing set with children (left) ---
  const sw = new THREE.Group(); sw.position.set(-9.5, 0, -14); sw.rotation.y = 1.0; scene.add(sw);
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.3, 8);
  for (const x of [-2.3, 2.3]) for (const s of [-1, 1]) { const l = new THREE.Mesh(legGeo, rust); l.position.set(x, 1.55, s * 0.55); l.rotation.x = s * 0.33; l.castShadow = true; sw.add(l); }
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.8, 8), rust); top.rotation.z = Math.PI / 2; top.position.y = 3.1; top.castShadow = true; sw.add(top);
  const swings = [];
  const kids = [
    person({ pose: 'sit', shirt: '#c43a2e', pants: '#2f3b6c', scale: 0.6 }),
    person({ pose: 'sit', shirt: '#e3e0d6', pants: '#32323a', scale: 0.58 }),
  ];
  for (const [i, x] of [[0, -1.1], [1, 1.1]].map(([i, x]) => [i, x])) {
    const piv = new THREE.Group(); piv.position.set(x, 3.05, 0); sw.add(piv);
    for (const dx of [-0.3, 0.3]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.5, 4), std({ color: '#3a3430' })); ch.position.set(dx, -1.25, 0); piv.add(ch); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.25), rustRed); seat.position.y = -2.5; seat.castShadow = true; piv.add(seat);
    const k = kids[i]; k.position.set(0, -2.5 - 0.26, -0.08); k.rotation.y = 0; piv.add(k);
    swings.push(piv);
  }
  // child standing at the fountain rim, staring
  const kid3 = person({ pose: 'stand', shirt: '#5a7a4a', pants: '#2e2e36', scale: 0.62 }); kid3.position.set(3.3, 0, fz + 4.2); kid3.rotation.y = 0.2 + Math.PI; scene.add(kid3);
  kid3.rotation.y = 0.6;
  const kid4 = person({ pose: 'stand', shirt: '#d8b64a', pants: '#3a3a44', scale: 0.55 }); kid4.position.set(9, 0, -40); kid4.rotation.y = -0.3; scene.add(kid4);

  // --- pavilion (right) ---
  const pav = new THREE.Group(); pav.position.set(12, 0, -20); scene.add(pav);
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.4, 5.5), concMat); base.position.y = 0.2; base.receiveShadow = true; base.castShadow = true; pav.add(base);
  for (const x of [-2.2, 2.2]) for (const z of [-2.2, 2.2]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3, 10), redMat); c.position.set(x, 1.9, z); c.castShadow = true; pav.add(c); }
  const roofGeo = new THREE.ConeGeometry(4.6, 1.9, 4, 1); roofGeo.rotateY(Math.PI / 4);
  const roofM = new THREE.Mesh(roofGeo, texMat(peelTex({ seed: 76, top: '#3f6a52', under: '#6b6a5a', peel: 0.6, size: 256 }))); roofM.position.y = 4.35; roofM.castShadow = true; pav.add(roofM);
  const eave = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.35, 5.2), redMat); eave.position.y = 3.45; eave.castShadow = true; pav.add(eave);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 0.4), redMat); bench.position.set(0, 0.85, 2.0); pav.add(bench);

  // --- slogan billboard (faded) ---
  const bb = new THREE.Group(); bb.position.set(-16, 0, -34); bb.rotation.y = 0.55; scene.add(bb);
  for (const x of [-3.6, 3.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 5.5, 0.15), rust); p.position.set(x, 2.75, 0); p.castShadow = true; bb.add(p); }
  const bbN = Noise(77);
  const bbT = pixTex(1024, 512, (u, v) => {
    const a = Math.atan2(v - 0.95, u - 0.5), ray = Math.sin(a * 22) > 0;
    let c = ray ? [196, 70, 48] : [214, 150, 70];
    const d = Math.hypot(u - 0.5, (v - 0.95) * 2);
    if (d < 0.22) c = [230, 190, 90];
    if (v > 0.82) c = [150, 60, 45];
    const f = bbN.fbm(u, v, 4, 5), k = f > 0.6 ? 1 : 0.55; // sun-bleached, peeling
    const under = [216, 205, 180];
    return [c[0] * k + under[0] * (1 - k), c[1] * k + under[1] * (1 - k), c[2] * k + under[2] * (1 - k)];
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(7.6, 3.6, 0.1), [rust, rust, rust, rust, texMat(bbT), rust]); board.position.y = 3.6; board.castShadow = true; bb.add(board);

  // --- lamp posts, some globes broken ---
  const globe = std({ color: '#efeee6', emissive: '#2a2820' });
  for (const [x, z, broken] of [[-5.5, -4, 0], [5.5, -4, 1], [-5.5, -26, 1], [5.5, -26, 0], [-5.5, -44, 0], [5.5, -44, 0]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4, 8), rust); p.position.set(x, 2, z); p.castShadow = true; scene.add(p);
    if (!broken) { const gl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), globe); gl.position.set(x, 4.25, z); scene.add(gl); }
    else { const gl = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10, 0, 6.29, 0, 1.2), std({ color: '#efeee6', side: THREE.DoubleSide })); gl.position.set(x, 4.1, z); gl.rotation.z = 0.4; scene.add(gl); }
  }
  const lp = loudspeakerPole({ h: 7 }); lp.position.set(7.5, 0, -8); scene.add(lp);

  // --- rusted ferris wheel in the smog ---
  const fw = new THREE.Group(); fw.position.set(20, 0, -66); fw.rotation.y = -0.35; scene.add(fw);
  const R = 22, C = 25;
  const fwMat = std({ color: '#5a3a2a' });
  for (const z of [-1.2, 1.2]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.3, 5, 72), fwMat); rim.position.set(0, C, z); fw.add(rim); const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.2, 5, 48), fwMat); rim2.position.set(0, C, z); fw.add(rim2); }
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    for (const z of [-1.2, 1.2]) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, R, 4), fwMat); sp.position.set(Math.cos(a) * R / 2, C + Math.sin(a) * R / 2, z); sp.rotation.z = a - Math.PI / 2; fw.add(sp); }
    if (i % 2 === 0) { const gd = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.0, 1.8), i % 4 ? std({ color: '#7a5a3a' }) : std({ color: '#6a3f35' })); gd.position.set(Math.cos(a) * R, C + Math.sin(a) * R - 1.6, 0); gd.rotation.z = (r() - 0.5) * 0.3; fw.add(gd); }
  }
  for (const z of [-3, 3]) for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 27, 6), fwMat); leg.position.set(s * 6, C / 2, z); leg.rotation.z = s * 0.24; fw.add(leg); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 10), fwMat); hub.rotation.x = Math.PI / 2; hub.position.y = C; fw.add(hub);
  fw.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  // trees around the edges (poplars + a few willows-ish)
  const H = 16; const bark = poplarBark(H, 1.2, 88); const barkMat = std({ map: bark }); const crownMat = std({ vertexColors: true, flatShading: true });
  const tp = poplarGeos(301, H, { crownColor: '#5e6a44', width: 1.6, crownStart: 0.3 }); const tms = [];
  for (let z = 4; z > -90; z -= 4.5) for (const x of [-26, 26]) tms.push(mtx(x + (r() - 0.5) * 3, 0, z, r() * 6, 0.8 + r() * 0.3));
  for (let x = -24; x < 24; x += 4.5) tms.push(mtx(x, 0, -58 + (r() - 0.5) * 3, r() * 6, 0.8 + r() * 0.3));
  scene.add(instanced(tp.trunk, barkMat, tms)); scene.add(instanced(tp.crown, crownMat, tms));

  // weeds in the cracks
  const weedGeo = new THREE.IcosahedronGeometry(0.22, 0); weedGeo.scale(1, 0.4, 1);
  const wm = []; for (let i = 0; i < 450; i++) { const x = (r() - 0.5) * 44, z = 4 - r() * 60; if (Math.hypot(x, z - fz) < 5.2) continue; wm.push(mtx(x, 0, z, r() * 6, 0.5 + r() * 1.1, 0.4 + r() * 1.0)); }
  scene.add(instanced(weedGeo, std({ color: '#5a6639', flatShading: true }), wm, { cast: false }));
  // plastic bag drifting
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), std({ color: '#e8e6e0', transparent: true, opacity: 0.85 })); bag.scale.set(1, 0.6, 0.8); scene.add(bag);

  const pts = [[0.4, 0, 14], [0.2, 0, 6], [-0.6, 0, -2], [-1.2, 0, -8], [-5.8, 0, -14], [-6.5, 0, -20]];
  const yaw = kf([[0, 0.0], [4, 0.0], [6.5, 0.45], [9, 0.75], [10.5, 0.4], [12.5, -0.35], [15, -0.55]]);
  const pitch = kf([[0, 0.08], [3, 0.12], [5, 0.0], [9, -0.06], [12, 0.02], [15, 0.1]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.018, stride: 0.75, lookAhead: 5, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  const sv = new THREE.Vector3(...sunDir).normalize();
  return (t) => {
    cam(t);
    sun.follow(camera.position);
    sd.position.copy(camera.position).addScaledVector(sv, 800);
    swings[0].rotation.x = Math.sin(t * 1.9) * 0.38;
    swings[1].rotation.x = Math.sin(t * 1.1 + 1) * 0.05;
    bag.position.set(-3 + t * 0.55, 0.25 + Math.abs(Math.sin(t * 1.3)) * 0.8, -6 - t * 0.2); bag.rotation.set(t, t * 0.7, 0);
  };
}
