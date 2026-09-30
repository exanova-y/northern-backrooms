import {
  THREE, rng, Noise, pixTex, concreteTex, glowTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, person, instanced, mtx, mix3, clamp
} from '../lib.js';
import { blockTex } from './metro.js';

export const DUR = 5;
export const SWAY_W = (2 * Math.PI) / 1.3; // skating stroke rate, mirrored in sound.py

function sandstoneTex(seed, bays, floors) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(1024, 512, (u, v) => {
    const a = n.fbm(u, v, 6, 5);
    let c = mix3([128, 110, 92], [160, 140, 118], a);
    const row = Math.floor(v * 40), cu = (u * 60 + (row % 2) * 0.5) % 1, cv = (v * 40) % 1;
    if (cv < 0.06 || cu < 0.02) c = c.map((k) => k * 0.8);
    // arched windows
    const fy = (1 - v) * floors, fx = u * bays, lx = fx % 1, ly = fy % 1;
    const inArch = lx > 0.3 && lx < 0.7 && ly > 0.18 && (ly < 0.62 || Math.hypot((lx - 0.5) / 0.2, (ly - 0.62) / 0.14) < 1);
    if (inArch) c = [42, 44, 50];
    if (ly > 0.9) c = c.map((k) => k * 1.08);
    return c;
  });
}

export async function build({ renderer, scene, camera }) {
  camera.far = 3000; camera.updateProjectionMatrix();
  const skyC = { top: '#aeb3b8', horizon: '#d4d6d8', bottom: '#c4c6c8' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#cfd2d5', 0.0095);
  renderer.toneMappingExposure = 0.95;
  scene.add(new THREE.HemisphereLight('#eef1f4', '#9a9ea2', 2.4));
  const sun = makeSun(scene, { color: '#f2f0ec', intensity: 0.7, dir: [0.3, 0.9, 0.3], box: 40, mapSize: 2048 });
  const r = rng(1899);
  const white = std({ color: '#eef1f4' });

  // plaza snow
  const sn = Noise(4);
  const snowT = pixTex(512, 512, (u, v) => { const a = sn.fbm(u, v, 4, 5); return mix3([236, 239, 242], [200, 206, 214], clamp((a - 0.45) * 2)); }, { repeat: [60, 60] });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), texMat(snowT)); plaza.rotation.x = -Math.PI / 2; plaza.receiveShadow = true; scene.add(plaza);
  // the rink: scratched ice with a dusting of snow
  const inn = Noise(5), ir = rng(6);
  const iceT = pixTex(1024, 1024, (u, v) => {
    const a = inn.fbm(u, v, 4, 5);
    let c = mix3([214, 224, 232], [242, 244, 246], clamp((a - 0.4) * 1.6));
    return c;
  }, {
    repeat: [2, 2], post: (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 700; i++) { const x = ir() * w, y = ir() * h, a = ir() * 6.28, L = 20 + ir() * 120; ctx.lineWidth = 0.5 + ir(); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + (ir() - 0.5) * 30, y + Math.sin(a) * L * 0.5 + (ir() - 0.5) * 30, x + Math.cos(a) * L, y + Math.sin(a) * L); ctx.stroke(); }
    }
  });
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(64, 48), pbr({ map: iceT, roughness: 0.35, metalness: 0.05, envMap: env, envMapIntensity: 0.8 }));
  ice.rotation.x = -Math.PI / 2; ice.position.set(0, 0.02, 0); ice.receiveShadow = true; scene.add(ice);
  // boards
  const boardM = std({ color: '#e9ebee' });
  for (const [w, d, x, z] of [[64, 0.2, 0, -24], [64, 0.2, 0, 24], [0.2, 48, -32, 0], [0.2, 48, 32, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), boardM); b.position.set(x, 0.45, z); b.castShadow = true; scene.add(b); }

  // the lattice arch over the rink
  const archZ = -16, span = 58, rise = 11;
  const archY = (x, off) => rise * (1 - (x / (span / 2)) ** 2) + off;
  const archM = std({ color: '#d8dade' });
  const chord = (off) => { const pts = []; for (let i = 0; i <= 60; i++) { const x = -span / 2 + (i / 60) * span; pts.push(new THREE.Vector3(x, archY(x, off), archZ)); } return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.28, 8), archM); };
  scene.add(chord(0), chord(1.6));
  const lace = [];
  for (let i = 0; i <= 44; i++) {
    const x = -span / 2 + (i / 44) * span, y0 = archY(x, 0), y1 = archY(x, 1.6);
    lace.push(mtx(x, (y0 + y1) / 2, archZ, 0, 1, 1));
    const x2 = x + span / 88; const y2 = archY(x2, 1.6);
    if (i < 44) { const m = new THREE.Matrix4(); const len = Math.hypot(x2 - x, y2 - y0); const ang = Math.atan2(y2 - y0, x2 - x); m.compose(new THREE.Vector3((x + x2) / 2, (y0 + y2) / 2, archZ), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, ang - Math.PI / 2)), new THREE.Vector3(1, len / 1.6, 1)); lace.push(m); }
  }
  scene.add(instanced(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), archM, lace));
  const snowTop = []; for (let i = 0; i <= 60; i++) { const x = -span / 2 + (i / 60) * span; const y = archY(x, 1.6) + 0.25; const x2 = x + span / 60; const ang = Math.atan2(archY(x2, 1.6) - archY(x, 1.6), span / 60); snowTop.push(mtx(x + span / 120, y, archZ, 0, 1, 1, 0, ang)); }
  scene.add(instanced(new THREE.BoxGeometry(span / 60 + 0.05, 0.12, 0.45), white, snowTop, { cast: false }));

  // ---- Old City Hall ----
  const hall = new THREE.Group(); hall.position.set(0, 0, -78); scene.add(hall);
  const sT = sandstoneTex(21, 22, 3), sT2 = sandstoneTex(22, 5, 3), sT3 = sandstoneTex(23, 3, 5);
  const side = std({ color: '#86735f' });
  const mk = (w, h, d, x, y, z, tex) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, std({ map: tex }), side]); m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true; hall.add(m); return m; };
  mk(96, 20, 26, 0, 0, 0, sT); // main range
  mk(22, 25, 30, 0, 0, 2.5, sT2); // centre pavilion
  mk(18, 22, 30, -39, 0, 2.5, sT2); mk(18, 22, 30, 39, 0, 2.5, sT2); // end pavilions
  // steep snowy roofs
  const hip = (w, d, h, x, y, z) => { const g = new THREE.ConeGeometry(1, 1, 4, 1); g.rotateY(Math.PI / 4); const m = new THREE.Mesh(g, white); m.scale.set(w * 0.72, h, d * 0.72); m.position.set(x, y + h / 2, z); m.castShadow = true; hall.add(m); return m; };
  const ridge = new THREE.Shape(); ridge.moveTo(-14, 0); ridge.lineTo(14, 0); ridge.lineTo(0, 9); ridge.lineTo(-14, 0);
  const rg = new THREE.ExtrudeGeometry(ridge, { depth: 94, bevelEnabled: false }); rg.rotateY(Math.PI / 2); rg.translate(-47, 0, 0);
  const roof = new THREE.Mesh(rg, white); roof.position.set(0, 20, 0); roof.castShadow = true; hall.add(roof);
  hip(24, 32, 12, 0, 25, 2.5); hip(20, 32, 10, -39, 22, 2.5); hip(20, 32, 10, 39, 22, 2.5);
  // dormers + small spires along the roof
  for (let x = -30; x <= 30; x += 10) if (Math.abs(x) > 8) { const dm = new THREE.Mesh(new THREE.ConeGeometry(1.6, 5, 4), white); dm.rotation.y = Math.PI / 4; dm.position.set(x, 24, 13.5); hall.add(dm); const db = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.2), std({ map: sT2 })); db.position.set(x, 22, 13.2); hall.add(db); }
  for (const x of [-10.5, 10.5, -29.5, 29.5, -48.5, 48.5]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 6, 10), side); t.position.set(x, 22 + 3, 17.3); hall.add(t); const c = new THREE.Mesh(new THREE.ConeGeometry(1.7, 6, 10), std({ color: '#5f7870' })); c.position.set(x, 31, 17.3); hall.add(c); }
  // the clock tower
  const tw = new THREE.Group(); tw.position.set(30, 0, 12); hall.add(tw);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(10, 58, 10), [std({ map: sT3 }), std({ map: sT3 }), side, side, std({ map: sT3 }), std({ map: sT3 })]); shaft.position.y = 29; shaft.castShadow = true; tw.add(shaft);
  const belfry = new THREE.Mesh(new THREE.BoxGeometry(11, 7, 11), std({ color: '#7d6a58' })); belfry.position.y = 61; tw.add(belfry);
  const clockT = pixTex(256, 256, (u, v) => { const d = Math.hypot(u - 0.5, v - 0.5); return d < 0.46 ? [236, 234, 224] : d < 0.5 ? [60, 55, 50] : [125, 108, 90]; }, {
    post: (ctx, w, h) => { ctx.strokeStyle = '#222'; ctx.lineCap = 'round'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + 50, h / 2 - 30); ctx.stroke(); ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 - 20, h / 2 - 90); ctx.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; ctx.fillStyle = '#333'; ctx.fillRect(w / 2 + Math.cos(a) * 100 - 4, h / 2 + Math.sin(a) * 100 - 4, 8, 8); } }
  });
  for (const [x, z, ry] of [[0, 5.51, 0], [-5.51, 0, -Math.PI / 2], [5.51, 0, Math.PI / 2]]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), std({ map: clockT, emissive: '#222' })); c.position.set(x, 61, z); c.rotation.y = ry; tw.add(c); }
  const spire = new THREE.Mesh(new THREE.ConeGeometry(8, 16, 4), white); spire.rotation.y = Math.PI / 4; spire.position.y = 72.5; tw.add(spire);
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { const t = new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 8), white); t.position.set(x, 67.5, z); tw.add(t); }
  const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), std({ color: '#333' })); flag.position.y = 83; tw.add(flag);

  // ghostly towers in the snow behind
  const tt = [blockTex(31, '#6e7478'), blockTex(32, '#5c6266'), blockTex(33, '#8a8e90')];
  for (const [x, z, w, h] of [[-18, -170, 34, 230], [16, -200, 38, 260], [-60, -150, 30, 140], [58, -165, 34, 180], [-95, -210, 40, 160], [95, -230, 40, 200]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), texMat(tt[Math.floor(r() * 3)])); b.position.set(x, h / 2, z); scene.add(b);
  }

  // lamp posts around the rink
  for (const [x, z] of [[-34, 12], [-34, -12], [34, 12], [34, -12], [-14, 26], [14, 26]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 8), std({ color: '#2a2d30' })); p.position.set(x, 2.5, z); scene.add(p);
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffe0b0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 })); g.position.set(x, 5.1, z); g.scale.setScalar(1.4); scene.add(g);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std({ color: '#fff', emissive: '#ffd9a0', emissiveIntensity: 1.2 })); b.position.set(x, 5.1, z); scene.add(b);
  }

  // skaters
  const coats = ['#1c1e24', '#2b2f38', '#7a1f24', '#e8e6e0', '#d9e84a', '#3a4a6a', '#5a3a2a', '#1a3a5a', '#b33a3a', '#2e2e2e'];
  const skaters = [];
  for (let i = 0; i < 30; i++) {
    const kid = r() < 0.3;
    const p = person({ pose: 'stand', shirt: coats[Math.floor(r() * coats.length)], pants: '#1e2026', hair: r() < 0.5 ? '#2a2420' : '#b84a3a', scale: kid ? 0.6 + r() * 0.1 : 0.95 + r() * 0.1 });
    scene.add(p);
    skaters.push({ p, cx: (r() - 0.5) * 50, cz: -20 + r() * 34, R: 3 + r() * 10, w: (r() < 0.5 ? -1 : 1) * (0.25 + r() * 0.25), ph: r() * 6.28 });
  }

  // heavy snowfall
  const NF = 9000, fr = rng(91);
  const base = new Float32Array(NF * 3), spd = new Float32Array(NF), phs = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { base[i * 3] = fr() * 50 - 25; base[i * 3 + 1] = fr() * 20; base[i * 3 + 2] = fr() * 50 - 25; spd[i] = 0.8 + fr() * 0.8; phs[i] = fr() * 6.28; }
  const fgeo = new THREE.BufferGeometry(); const fpos = new Float32Array(NF * 3); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flakes = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.09, map: glowTex(), color: '#ffffff', transparent: true, depthWrite: false, opacity: 1.0 }));
  flakes.frustumCulled = false; scene.add(flakes);
  const wrap = (v, lo, span) => lo + (((v - lo) % span) + span) % span;

  // skating glide toward the hall
  const pts = [[0, 0.02, 16], [0, 0.02, -4]];
  const pitch = kf([[0, 0.14], [5, 0.2]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.72, bob: 0, lookAhead: 6, ease: 0.4, look: (t) => ({ pitch: pitch(t) }) });
  return (t) => {
    cam(t);
    const s = Math.sin(SWAY_W * t);
    camera.position.x += 0.4 * s; camera.position.y -= 0.04 * Math.abs(Math.cos(SWAY_W * t));
    camera.rotateZ(-0.035 * s); camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), 0.03 * Math.cos(SWAY_W * t));
    sun.follow(camera.position);
    for (const k of skaters) {
      const a = k.ph + k.w * t;
      k.p.position.set(k.cx + Math.cos(a) * k.R, 0.02, k.cz + Math.sin(a) * k.R * 0.6);
      k.p.rotation.y = -a + (k.w > 0 ? 0 : Math.PI);
      k.p.rotation.z = 0.08 * Math.sign(k.w);
    }
    const c = camera.position;
    for (let i = 0; i < NF; i++) {
      const x = base[i * 3] + Math.sin(t * 0.9 + phs[i]) * 0.4 + t * 0.6, y = base[i * 3 + 1] - spd[i] * t, zz = base[i * 3 + 2] + Math.cos(t * 0.7 + phs[i]) * 0.4;
      fpos[i * 3] = wrap(x, c.x - 25, 50); fpos[i * 3 + 1] = wrap(y, c.y - 6, 20); fpos[i * 3 + 2] = wrap(zz, c.z - 25, 50);
    }
    fgeo.attributes.position.needsUpdate = true;
  };
}
