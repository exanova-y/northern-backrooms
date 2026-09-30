import {
  THREE, rng, Noise, pixTex, concreteTex, asphaltTex, glowTex, softTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, person, instanced, mtx, poplarGeos, mix3, clamp
} from '../lib.js';
import { blockTex } from './metro.js';
import { goose } from './ontario.js';

export const DUR = 5;
const R0 = 116;                 // camera radius (inner sidewalk)
const C = new THREE.Vector3(R0, 0, 0); // ring centre (road curves to the right)
const onRing = (r, a) => new THREE.Vector3(C.x - r * Math.cos(a), 0, C.z - r * Math.sin(a));

function grassTex(seed) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(512, 512, (u, v) => {
    const a = n.fbm(u, v, 4, 5), g = r();
    let c = mix3([74, 118, 46], [110, 146, 60], a);
    c = c.map((k) => k * (0.85 + g * 0.3));
    return c;
  }, { repeat: [120, 120] });
}

function brutalTex(seed) {
  // precast concrete panels with narrow deep-set windows
  const n = Noise(seed);
  return pixTex(512, 512, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    const cu = (u * 10) % 1, cv = (v * 7) % 1;
    let c = [176, 170, 158].map((k) => k * (0.82 + a * 0.28));
    if (cu > 0.2 && cu < 0.55 && cv > 0.3 && cv < 0.78) c = [44, 52, 58];
    if (cu < 0.02 || cv < 0.03) c = c.map((k) => k * 0.8);
    const stain = n.vn(u * 40, v * 3, 40); c = c.map((k) => k * (1 - 0.12 * clamp(stain - 0.5) * 2));
    return c;
  });
}
function glassTex(seed) {
  const n = Noise(seed);
  return pixTex(512, 512, (u, v) => {
    const cu = (u * 12) % 1, cv = (v * 16) % 1;
    const a = n.fbm(u, v, 3, 3);
    let c = mix3([70, 110, 140], [150, 185, 205], a * 0.8 + v * 0.3);
    if (cu < 0.04 || cv < 0.05) c = [60, 64, 68];
    return c;
  });
}
function brickTex(seed) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(256, 256, (u, v) => {
    const row = Math.floor(v * 32), cu = (u * 12 + (row % 2) * 0.5) % 1, cv = (v * 32) % 1;
    let c = [150, 62, 42].map((k) => k * (0.85 + n.fbm(u, v, 8, 3) * 0.25));
    if (cu < 0.06 || cv < 0.12) c = [170, 160, 150];
    return c;
  }, { repeat: [8, 8] });
}

export async function build({ renderer, scene, camera }) {
  camera.far = 3000; camera.updateProjectionMatrix();
  const skyC = { top: '#5d93d0', horizon: '#e9dcc2', bottom: '#8aa068' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#d9dcd4', 0.0035);
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#dbe8f6', '#6a7a44', 1.7));
  const sunDir = [-0.55, 0.42, -0.3];
  const sun = makeSun(scene, { color: '#ffe0b4', intensity: 3.0, dir: sunDir, box: 36, mapSize: 2048 });
  const r = rng(2025);

  // grass everywhere
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), texMat(grassTex(5))); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; scene.add(grass);
  // ring road + sidewalk + curbs (annuli around C)
  const ann = (r0, r1, mat, y) => { const g = new THREE.RingGeometry(r0, r1, 512, 1); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, mat); m.position.set(C.x, y, C.z); m.receiveShadow = true; scene.add(m); return m; };
  const asph = asphaltTex({ seed: 7, repeat: [60, 60], color: '#5a5a5c' });
  ann(118, 126.5, texMat(asph), 0.03);
  ann(114.3, 117.6, texMat(concreteTex({ seed: 8, color: '#c4c0b8', repeat: [60, 60], cracks: 3 })), 0.09);
  ann(117.6, 118.0, std({ color: '#b0aca4' }), 0.12);
  ann(118.12, 118.26, std({ color: '#e8e6e0' }), 0.035);
  ann(126.2, 126.34, std({ color: '#e8e6e0' }), 0.035);
  // yellow centre dashes near the camera's stretch of road
  const dash = new THREE.PlaneGeometry(0.13, 3); dash.rotateX(-Math.PI / 2);
  const dm = [];
  for (let a = -0.5; a < 1.2; a += 6 / 122.25) { const p = onRing(122.25, a); dm.push(mtx(p.x, 0.036, p.z, -a, 1, 1)); }
  scene.add(instanced(dash, std({ color: '#e0b020' }), dm, { cast: false }));
  // sidewalk joints
  const jt = new THREE.PlaneGeometry(3.3, 0.03); jt.rotateX(-Math.PI / 2);
  const jm = []; for (let a = -0.3; a < 0.9; a += 1.5 / 116) { const p = onRing(115.95, a); jm.push(mtx(p.x, 0.092, p.z, -a, 1)); }
  scene.add(instanced(jt, std({ color: '#8a8680' }), jm, { cast: false }));

  // ---- campus buildings inside the ring (ahead-right) ----
  const bT = brutalTex(11), gT = glassTex(12), kT = brickTex(13);
  const bld = (a, rr, w, h, d, mats, rotOff = 0) => {
    const p = onRing(rr, a); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.position.set(p.x, h / 2, p.z); m.rotation.y = Math.PI / 2 - a + rotOff; m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
  };
  const conc = std({ map: bT }), glass = pbr({ map: gT, roughness: 0.15, metalness: 0.5, envMap: env, envMapIntensity: 1.2 }), brick = std({ map: kT }), plain = std({ color: '#a8a296' });
  bld(0.25, 88, 60, 20, 26, [conc, conc, plain, plain, conc, conc]);          // brutalist block
  bld(0.12, 82, 34, 26, 30, [glass, glass, plain, plain, glass, glass]);        // glass building
  bld(0.12, 74, 36, 7, 34, [brick, brick, plain, plain, brick, brick]);         // brick podium
  bld(0.45, 62, 44, 14, 22, [brick, brick, plain, plain, glass, glass]);
  bld(0.62, 76, 50, 22, 30, [conc, conc, plain, plain, conc, conc]);
  bld(0.36, 84, 40, 16, 26, [glass, glass, plain, plain, brick, brick]);
  // tall brick smokestack
  const sp = new THREE.Vector3(24, 0, -72);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.6, 52, 20), texMat(brickTex(14), { }));
  stack.material.map.repeat.set(4, 30); stack.position.set(sp.x, 26, sp.z); stack.castShadow = true; scene.add(stack);
  for (const y of [49, 51.5]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.6, 20), std({ color: '#3a3430' })); band.position.set(sp.x, y, sp.z); scene.add(band); }
  // outside the ring (left): parking lot + low building
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), texMat(asphaltTex({ seed: 15, repeat: [6, 8], color: '#6a6a6a' }))); lot.rotation.x = -Math.PI / 2; const lp = onRing(160, 0.25); lot.position.set(lp.x, 0.02, lp.z); lot.rotation.z = 0.25; scene.add(lot);
  bld(0.4, 200, 60, 12, 30, [conc, conc, plain, plain, conc, conc]);

  // trees: leafy, scattered on both sides
  const tg = poplarGeos(301, 11, { crownColor: '#4f7a34', width: 3.2, crownStart: 0.32 });
  const tg2 = poplarGeos(302, 9, { crownColor: '#6a8a3a', width: 2.8, crownStart: 0.3 });
  const tA = [], tB = [];
  for (let i = 0; i < 90; i++) {
    const a = -0.2 + r() * 1.0, side = r() < 0.28;
    const rr = side ? 96 + r() * 16 : 131 + r() * 30;
    if (!side && rr < 133) continue;
    const p = onRing(rr, a); (r() < 0.5 ? tA : tB).push(mtx(p.x, 0, p.z, r() * 6, 0.8 + r() * 0.4));
  }
  scene.add(instanced(tg.trunk, std({ color: '#4a3e34' }), tA)); scene.add(instanced(tg.crown, std({ vertexColors: true, flatShading: true }), tA));
  scene.add(instanced(tg2.trunk, std({ color: '#4a3e34' }), tB)); scene.add(instanced(tg2.crown, std({ vertexColors: true, flatShading: true }), tB));
  // lamp posts along the sidewalk
  for (let a = -0.1; a < 0.8; a += 30 / 116) { const p = onRing(114.0, a); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5, 8), std({ color: '#2e3134' })); l.position.set(p.x, 2.5, p.z); l.castShadow = true; scene.add(l); const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.3), std({ color: '#2e3134' })); h.position.set(p.x, 5.05, p.z); scene.add(h); }

  // ---- the geese ----
  const gs = [];
  const lawn = [[112.6, 0.03, 0.8], [111.4, 0.045, 2.4], [110.8, 0.02, -0.6], [109.3, 0.06, 1.2], [112.2, 0.075, 3.4], [108.2, 0.035, 0.1], [110.2, 0.09, 2.0], [106.5, 0.07, -1.0], [113.2, 0.11, 0.4]];
  lawn.forEach(([rr, a, ry], i) => { const g = goose(); const p = onRing(rr, a); g.position.set(p.x, 0.33, p.z); g.rotation.y = ry; if (i % 3 === 0) g.rotation.x = 0.4; scene.add(g); gs.push(g); });
  // the one on the sidewalk, standing its ground
  const boss = goose({ hiss: true }); const bp = onRing(116.1, 0.076); boss.position.set(bp.x, 0.42, bp.z); boss.rotation.y = -0.076 + 0.2; boss.scale.setScalar(1.08); scene.add(boss);
  // students
  const folk = [[115.5, 0.22, Math.PI, '#2e3a52'], [114.9, 0.3, 0.2, '#c9b28a'], [100, 0.18, 1.2, '#7a2a2a'], [140, 0.12, -0.5, '#3a3a3a']];
  for (const [rr, a, ry, c] of folk) { const p = onRing(rr, a); const pp = person({ pose: 'stand', shirt: c, pants: '#2a2e38' }); pp.position.set(p.x, rr > 114 && rr < 118 ? 0.09 : 0, p.z); pp.rotation.y = ry - a; scene.add(pp); }

  // ---- a car passing on the ring road (opposite direction) ----
  const car = new THREE.Group(); scene.add(car);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.4), std({ color: '#9aa4ae' })); body.position.y = 0.65; car.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.3), std({ color: '#26303a' })); cab.position.set(0, 1.25, -0.2); car.add(cab);
  const wg = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12); wg.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.4], [0.85, -1.4]]) { const w = new THREE.Mesh(wg, std({ color: '#151515' })); w.position.set(x, 0.33, z); car.add(w); }
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // camera: walk along the inner sidewalk arc
  const pts = []; for (let k = 0; k <= 12; k++) { const a = -0.0 + k * (0.052 / 12); const p = onRing(R0, a); pts.push([p.x, 0.09, p.z]); }
  const yaw = kf([[0, 0.1], [1.8, -0.35], [3.2, -0.25], [5, -0.08]]);
  const pitch = kf([[0, -0.02], [3, -0.12], [5, -0.14]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.015, stride: 0.75, lookAhead: 4, ease: 0.6, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => {
    cam(t);
    sun.follow(camera.position);
    // car: outer lane, heading back toward the camera (decreasing angle)
    const a = 0.32 - t * 0.12; const p = onRing(124.3, a);
    car.position.set(p.x, 0.03, p.z); car.rotation.y = -a + Math.PI;
    // grazing geese bob their heads a little, the boss sways
    gs.forEach((g, i) => { if (i % 3 === 0) g.rotation.x = 0.4 + 0.08 * Math.sin(t * 3 + i); });
    boss.rotation.z = 0.05 * Math.sin(t * 6);
  };
}
