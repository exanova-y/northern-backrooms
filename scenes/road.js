import {
  THREE, rng, Noise, pixTex, peelTex, concreteTex, asphaltTex, dirtTex, glowTex, softTex, texMat, std, makeSky, envFrom, makeSun,
  pathCam, kf, pbr, Smoke, person, loudspeakerPole, wire, instanced, mtx, poplarGeos, poplarBark, clamp, smooth, mix3
} from '../lib.js';

export const DUR = 15;

export async function build({ renderer, scene, camera }) {
  const skyC = { top: '#b3ae9f', horizon: '#d3c8ad', bottom: '#c2b69b' };
  makeSky(scene, skyC);
  scene.environment = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#cdc2a8', 0.0125);
  renderer.toneMappingExposure = 1.05;
  scene.add(new THREE.HemisphereLight('#e2dac6', '#7a6c52', 1.7));
  const sunDir = [-0.45, 0.62, -0.64];
  const sun = makeSun(scene, { color: '#ffe0b0', intensity: 2.6, dir: sunDir, box: 40, mapSize: 1536 });
  // smog sun disc
  const sd = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffe6c0', fog: false, transparent: true, depthWrite: false, opacity: 0.9 }));
  sd.scale.set(70, 70, 1); scene.add(sd);
  const sd2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#fff4dc', fog: false, transparent: true, depthWrite: false, opacity: 0.85 }));
  sd2.scale.set(16, 16, 1); scene.add(sd2);

  // ground (fields)
  const soil = dirtTex({ seed: 2, color: '#6b5a44', repeat: [220, 220], size: 512 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), texMat(soil));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  // raised shoulder + road
  const shoulderT = dirtTex({ seed: 4, color: '#7d6c54', repeat: [4, 180], leaves: 60, butts: 6 });
  const shoulder = new THREE.Mesh(new THREE.BoxGeometry(17, 0.4, 900), texMat(shoulderT));
  shoulder.position.set(0, 0, -300); shoulder.receiveShadow = true; scene.add(shoulder);
  const asph = asphaltTex({ seed: 6, repeat: [2, 260], color: '#67635d' });
  const road = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 900), texMat(asph, { roughness: 0.85 }));
  road.position.set(0, 0, -300); road.receiveShadow = true; scene.add(road);
  const ROAD_Y = 0.3;
  // faded edge lines, broken
  const lineMat = std({ color: '#c9c4b4', roughness: 0.9 });
  const r = rng(7);
  const lineMats = [];
  // evenly spaced centre dashes (2 m dash / 4 m gap) + continuous edge lines
  for (let z = 40; z > -700; z -= 6) lineMats.push(mtx(0, ROAD_Y + 0.004, z, 0, 1, 1));
  const lg = new THREE.PlaneGeometry(0.14, 2.0); lg.rotateX(-Math.PI / 2);
  scene.add(instanced(lg, lineMat, lineMats, { cast: false }));
  for (const x of [-3.25, 3.25]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 740), lineMat); e.rotation.x = -Math.PI / 2; e.position.set(x, ROAD_Y + 0.004, -330); scene.add(e); }

  // wheat drying on the right half of the asphalt
  const wn = Noise(12);
  const wheat = pixTex(512, 512, (u, v, x, y) => {
    const a = wn.fbm(u, v, 8, 5), rake = Math.sin(u * 6.28 * 18 + wn.fbm(u, v, 2, 3) * 3) * 0.5 + 0.5, g = Math.random();
    const base = mix3([201, 160, 82], [166, 125, 60], a);
    const k = 0.8 + rake * 0.15 + (g - 0.5) * 0.35;
    return [base[0] * k, base[1] * k, base[2] * k];
  }, { repeat: [3, 10] });
  const wheatMat = std({ map: wheat, roughness: 1, alphaTest: 0.5 });
  let z0 = -4;
  const patches = [];
  while (z0 > -160) {
    const len = 12 + r() * 16, w = 2.6 + r() * 0.5, x = 1.8 + (r() - 0.5) * 0.3;
    const alpha = pixTex(128, 256, (u, v) => {
      const e = Math.min(u, 1 - u) * w, f = Math.min(v, 1 - v) * len; const d = Math.min(e, f);
      const n = wn.fbm(u + z0, v, 6, 3);
      const k = d > 0.15 + n * 0.35 ? 255 : 0; return [k, k, k];
    }, { srgb: false });
    const m = wheatMat.clone(); m.alphaMap = alpha;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, len), m);
    p.rotation.x = -Math.PI / 2; p.position.set(x, ROAD_Y + 0.02, z0 - len / 2); p.receiveShadow = true; scene.add(p);
    patches.push([z0, z0 - len]);
    // bricks marking the patch
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.12), std({ color: '#8f4a34' }));
      b.position.set(x - w / 2 - 0.1, ROAD_Y + 0.03, z0 - r() * len); b.rotation.y = r(); b.castShadow = true; scene.add(b);
    }
    z0 -= len + 1.5 + r() * 5;
  }
  // wooden rake (木锨) lying on wheat + woven sacks
  const rake = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), std({ color: '#8b6a42' })); shaft.rotation.z = Math.PI / 2; rake.add(shaft);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.5), std({ color: '#a5845a' })); blade.position.x = 0.8; rake.add(blade);
  rake.position.set(1.4, ROAD_Y + 0.04, -14); rake.rotation.y = 0.5; rake.traverse((o) => o.castShadow = true); scene.add(rake);
  const sackT = pixTex(128, 128, (u, v) => { const k = ((Math.floor(u * 40) + Math.floor(v * 40)) % 2) ? 0.92 : 1; return [228 * k, 226 * k, 216 * k]; }, { repeat: [2, 2] });
  const sackGeo = new THREE.BoxGeometry(0.75, 0.3, 0.45, 3, 2, 2); { const pp = sackGeo.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const k = 1 - Math.abs(x) * 0.25; pp.setXYZ(i, x, y * k, z * (0.85 + 0.3 * (1 - Math.abs(y) * 3))); } sackGeo.computeVertexNormals(); }
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(sackGeo, std({ map: sackT, roughness: 0.8 }));
    s.position.set(4.1 + (i % 3) * 0.55, 0.36 + (i > 2 ? 0.3 : 0), -26 - (i % 3) * 0.2 + (i > 2 ? -0.3 : 0)); s.rotation.y = i; s.castShadow = true; s.receiveShadow = true; scene.add(s);
  }

  // poplars, trunks limewashed
  const H = 19;
  const bark = poplarBark(H, 1.3);
  const barkMat = std({ map: bark, roughness: 0.95 });
  const crownMat = std({ vertexColors: true, roughness: 0.95, flatShading: true });
  const templates = [0, 1, 2].map((k) => poplarGeos(100 + k, H, { crownColor: ['#56643c', '#5d6b42', '#515f37'][k], width: 1.05, crownStart: 0.36 }));
  const tm = [[], [], []];
  for (const x of [-5.6, -7.6, 5.6, 7.6]) {
    for (let z = 30; z > -230; z -= 3.2) {
      if (r() < (Math.abs(x) > 7 ? 0.45 : 0.04)) continue; // a gap here and there
      const k = Math.floor(r() * 3), s = 0.85 + r() * 0.3;
      tm[k].push(mtx(x + (r() - 0.5) * 0.3, 0.1, z + (r() - 0.5) * 0.6, r() * 6.28, s, s * (0.9 + r() * 0.2)));
    }
  }
  templates.forEach((t, k) => { scene.add(instanced(t.trunk, barkMat, tm[k])); scene.add(instanced(t.crown, crownMat, tm[k])); });

  // plastic film plantation: low tunnels & mulch strips, kilometers of it
  const film = pbr({ color: '#b3bab9', roughness: 0.3, metalness: 0.05, envMapIntensity: 1.0, side: THREE.DoubleSide });
  const tunnelGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, true, 0, Math.PI); tunnelGeo.rotateX(Math.PI / 2); tunnelGeo.rotateZ(Math.PI / 2);
  const stripGeo = new THREE.PlaneGeometry(0.85, 1); stripGeo.rotateX(-Math.PI / 2);
  const ridgeGeo = new THREE.CylinderGeometry(0.45, 0.45, 1, 8, 1, false, 0, Math.PI); ridgeGeo.rotateX(Math.PI / 2); ridgeGeo.rotateZ(Math.PI / 2);
  const tun = [], strip = [], ridge = [];
  for (const side of [-1, 1]) {
    for (let bx = 10.5; bx < 170; bx += 42) {
      for (let bz = 40; bz > -260; bz -= 64) {
        const type = r(); const len = 58 + r() * 3;
        for (let x = bx; x < bx + 39; x += 1.5) {
          const X = side * x;
          if (type < 0.68) tun.push(mtx(X, 0, bz - len / 2, 0, 1, 1).multiply(new THREE.Matrix4().makeScale(1, 0.9 + r() * 0.1, len)));
          else if (type < 0.85) { ridge.push(mtx(X, -0.3, bz - len / 2, 0, 1, 1).multiply(new THREE.Matrix4().makeScale(1, 1, len))); strip.push(mtx(X, 0.16, bz - len / 2, 0, 1, 1).multiply(new THREE.Matrix4().makeScale(1, 1, len))); }
        }
      }
    }
  }
  scene.add(instanced(tunnelGeo, film, tun));
  scene.add(instanced(ridgeGeo, texMat(soil), ridge, { cast: false }));
  scene.add(instanced(stripGeo, film, strip, { cast: false }));
  // film shredded on some tunnel ends: loose flapping sheets
  const loose = [];
  for (let i = 0; i < 40; i++) loose.push(mtx((r() < 0.5 ? -1 : 1) * (10 + r() * 60), 0.05, -r() * 300, r() * 6, 0.6 + r(), 1, -Math.PI / 2 + (r() - 0.5) * 0.4));
  scene.add(instanced(new THREE.PlaneGeometry(1.2, 0.8), film, loose));

  // utility poles on the left, one with loudspeakers
  const poleMat = texMat(concreteTex({ seed: 33, color: '#98938a', size: 128, cracks: 2 }));
  const poles = [];
  for (let z = 25; z > -260; z -= 42) {
    const x = -4.3;
    if (Math.abs(z - -59) < 1) {
      const lp = loudspeakerPole({ h: 8.4 }); lp.position.set(x, 0.2, z); scene.add(lp);
    } else {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 8.6, 8), poleMat); p.position.set(x, 4.3, z); p.castShadow = true; scene.add(p);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.08), std({ color: '#6b665e' })); bar.position.set(x, 8.2, z); scene.add(bar);
    poles.push(z);
  }
  for (let i = 0; i < poles.length - 1; i++) for (const dx of [-0.55, 0, 0.55]) wire(scene, [-4.3 + dx, 8.25, poles[i]], [-4.3 + dx, 8.25, poles[i + 1]], 0.7);

  // blue farm tricycle + squatting smoker
  const tri = new THREE.Group();
  const blue = std({ color: '#2f5f9a', roughness: 0.5, metalness: 0.3 });
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 1.6), blue); bed.position.set(0, 0.72, 0.5); tri.add(bed);
  const bedIn = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.5), std({ color: '#3b3a36' })); bedIn.position.set(0, 0.78, 0.5); tri.add(bedIn);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), blue); cab.position.set(0, 0.85, -0.6); tri.add(cab);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.35), std({ color: '#222' })); seat.position.set(0, 0.95, -0.3); tri.add(seat);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), std({ color: '#222', metalness: 0.6 })); bars.rotation.z = Math.PI / 2; bars.position.set(0, 1.25, -0.85); tri.add(bars);
  const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.14, 14); wheelGeo.rotateZ(Math.PI / 2);
  const tire = std({ color: '#161616' });
  for (const [x, z] of [[-0.62, 0.7], [0.62, 0.7], [0, -0.95]]) { const w = new THREE.Mesh(wheelGeo, tire); w.position.set(x, 0.26 + 0.2, z); tri.add(w); }
  tri.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  tri.position.set(5.0, 0.0, -19.5); tri.rotation.y = 0.12; scene.add(tri);

  const man = person({ pose: 'squat', shirt: '#dcd8cb', pants: '#2b2f3a', cig: true, sleeves: 'none', arm: 'mouth' });
  man.position.set(4.05, 0.2, -23.2); man.rotation.y = -Math.PI / 2 - 0.35; scene.add(man);
  const man2 = person({ pose: 'squat', shirt: '#4a5a6a', pants: '#2a2a2a', cig: true, bald: true, sleeves: 'short' });
  man2.position.set(4.75, 0.2, -24.0); man2.rotation.y = -Math.PI / 2 - 0.9; scene.add(man2);
  const soft = softTex();
  const cigSmoke = [man, man2].map((m, i) => {
    m.updateMatrixWorld(true);
    const p = new THREE.Vector3(); m.userData.ember.getWorldPosition(p);
    return new Smoke(scene, { origin: [p.x, p.y, p.z], count: 18, life: 4, rise: 0.25, grow: 5, size: 0.08, color: '#d8d6d2', opacity: 0.35, wind: [0.1, 0, -0.05], spread: 0.02, seed: 50 + i, tex: soft });
  });

  // lone child far ahead on the shoulder
  const kid = person({ pose: 'stand', shirt: '#b8322b', pants: '#3a4a7a', scale: 0.68 });
  kid.position.set(-3.9, 0.2, -92); kid.rotation.y = 0.3; scene.add(kid);
  const kid2 = person({ pose: 'stand', shirt: '#e3c24a', pants: '#3c3c44', scale: 0.6 });
  kid2.position.set(-4.5, 0.2, -93.1); kid2.rotation.y = 0.9; scene.add(kid2);

  // distant village silhouette + straw/cooking smoke
  const houseMat = std({ color: '#a39a8a' });
  for (let i = 0; i < 24; i++) {
    const w = 8 + r() * 8, h = 3 + r() * 4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), houseMat); b.position.set(-40 - r() * 120, h / 2, -230 - r() * 60); scene.add(b);
  }
  const smokes = [
    new Smoke(scene, { origin: [-70, 3, -200], count: 60, life: 22, rise: 2.2, grow: 7, size: 5, color: '#aaa396', opacity: 0.5, wind: [0.25, 0, 0.05], spread: 1, seed: 3, tex: soft }),
    new Smoke(scene, { origin: [45, 1, -120], count: 50, life: 20, rise: 1.6, grow: 6, size: 4, color: '#b3ac9e', opacity: 0.45, wind: [0.3, 0, 0], spread: 1.2, seed: 4, tex: soft }),
  ];
  // drifting poplar fluff (杨絮)
  const fluffMat = new THREE.SpriteMaterial({ map: glowTex(), color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.8 });
  const fluff = [];
  for (let i = 0; i < 140; i++) { const s = new THREE.Sprite(fluffMat); s.scale.setScalar(0.03 + r() * 0.03); scene.add(s); fluff.push({ s, x: (r() - 0.5) * 14, y: 0.4 + r() * 5, z: -r() * 70 + 5, ph: r() * 6.28 }); }

  const cam = pathCam(camera, [[0.6, ROAD_Y, 6], [0.5, ROAD_Y, -6], [0.3, ROAD_Y, -18], [0.1, ROAD_Y, -30], [0, ROAD_Y, -40]], DUR, { eye: 1.65, bob: 0.018, stride: 0.8, lookAhead: 6 });
  const yaw = kf([[0, 0.05], [3, 0.0], [6.5, -0.7], [9, -1.25], [10.5, -1.1], [12.5, -0.1], [15, 0.25]]);
  const pitch = kf([[0, 0.02], [6, -0.08], [9.5, -0.18], [11.5, 0.0], [15, 0.05]]);
  const camLook = pathCam(camera, [[0.6, ROAD_Y, 6], [0.5, ROAD_Y, -6], [0.3, ROAD_Y, -18], [0.1, ROAD_Y, -30], [0, ROAD_Y, -40]], DUR, { eye: 1.65, bob: 0.018, stride: 0.8, lookAhead: 6, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  const sv = new THREE.Vector3(...sunDir).normalize();
  return (t) => {
    camLook(t);
    sun.follow(camera.position);
    sd.position.copy(camera.position).addScaledVector(sv, 800); sd2.position.copy(sd.position);
    cigSmoke.forEach((s) => s.update(t)); smokes.forEach((s) => s.update(t));
    for (const f of fluff) { f.s.position.set(f.x + Math.sin(t * 0.4 + f.ph) * 0.8 + t * 0.35, f.y + Math.sin(t * 0.7 + f.ph * 2) * 0.3, f.z + Math.cos(t * 0.3 + f.ph) * 0.5); }
    for (const m of [man, man2]) { const e = m.userData.ember; e.material.color.setHSL(0.05, 1, 0.45 + 0.1 * Math.sin(t * 3 + m.position.z)); }
  };
}
