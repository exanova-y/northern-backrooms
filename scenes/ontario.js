import {
  THREE, rng, Noise, pixTex, concreteTex, glowTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, person, instanced, mtx, poplarGeos, mix3, clamp
} from '../lib.js';
import { blockTex } from './metro.js';

export const DUR = 5;

function snowTex({ seed, repeat = [1, 1], size = 512, prints = 0, pebbles = 0 }) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(size, size, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    let c = mix3([242, 244, 246], [200, 210, 224], clamp((a - 0.45) * 2.2));
    if (pebbles) { const p = n.fbm(u + 3, v, 3, 4); if (p > 1 - pebbles) { const g = n.vn(u * 90, v * 90, 90); c = mix3([128, 120, 110], [196, 186, 170], g); } }
    return c;
  }, {
    repeat, post: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(160,172,190,0.6)';
      for (let i = 0; i < prints; i++) { const x = w * 0.5 + (i % 2 ? 10 : -10) + Math.sin(i * 0.4) * 20, y = (i / prints) * h; ctx.beginPath(); ctx.ellipse(x, y, 5, 10, 0, 0, 6.28); ctx.fill(); }
    }
  });
}

function ropeTex() {
  return pixTex(64, 256, (u, v) => { const s = Math.sin((u * 3 + v * 24) * Math.PI * 2) * 0.5 + 0.5; const k = 0.78 + 0.22 * s; return [226 * k, 218 * k, 200 * k]; }, { repeat: [1, 20] });
}

// low-poly Canada goose; facing +z
export function goose({ flying = false, hiss = false } = {}) {
  const g = new THREE.Group();
  const bodyM = std({ color: '#7a6a58' }), blk = std({ color: '#151515' }), wht = std({ color: '#f0eee8' }), belly = std({ color: '#cfc6b6' });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bodyM); body.scale.set(0.85, 0.75, 1.5); g.add(body);
  const bl = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), belly); bl.scale.set(0.8, 0.6, 1.3); bl.position.set(0, -0.05, 0.02); g.add(bl);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 6), blk); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.02, -0.34); g.add(tail);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), wht); rump.position.set(0, -0.02, -0.26); g.add(rump);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 8), blk);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), blk); head.scale.set(0.8, 0.85, 1.4);
  const bill = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 6), blk); bill.rotation.x = Math.PI / 2;
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), wht); chin.scale.set(0.9, 0.7, 1.1);
  if (flying) {
    neck.rotation.x = Math.PI / 2; neck.position.set(0, 0.02, 0.45); head.position.set(0, 0.03, 0.7); bill.position.set(0, 0.02, 0.8); chin.position.set(0, -0.0, 0.69);
  } else if (hiss) { // neck stretched low and forward, wings half open
    neck.rotation.x = 1.25; neck.position.set(0, 0.1, 0.4); head.position.set(0, 0.16, 0.62); bill.position.set(0, 0.15, 0.72); chin.position.set(0, 0.13, 0.61);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bodyM); w.scale.set(0.9, 0.12, 1.2); w.position.set(s * 0.22, 0.1, -0.02); w.rotation.z = s * 0.9; g.add(w); }
    for (const x of [-0.06, 0.06]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), blk); leg.position.set(x, -0.24, 0.02); g.add(leg); }
    g.position.y = 0.33;
  } else {
    neck.rotation.x = 0.3; neck.position.set(0, 0.28, 0.24); head.position.set(0, 0.5, 0.33); bill.position.set(0, 0.49, 0.43); chin.position.set(0, 0.47, 0.32);
    for (const x of [-0.06, 0.06]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), blk); leg.position.set(x, -0.24, 0.02); g.add(leg); }
    g.position.y = 0.33;
  }
  g.add(neck, head, bill, chin);
  if (flying) {
    const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0.12); wingShape.lineTo(0.8, 0.02); wingShape.lineTo(0.72, -0.1); wingShape.lineTo(0, -0.14); wingShape.lineTo(0, 0.12);
    const wg = new THREE.ShapeGeometry(wingShape); wg.rotateX(-Math.PI / 2);
    const wm = std({ color: '#5e5044', side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wg, wm), wr = new THREE.Mesh(wg, wm); wr.scale.x = -1;
    const pl = new THREE.Group(), pr = new THREE.Group(); pl.position.set(0.1, 0.05, 0.05); pr.position.set(-0.1, 0.05, 0.05); pl.add(wl); pr.add(wr); g.add(pl, pr);
    g.userData.wings = [pl, pr];
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export async function build({ renderer, scene, camera }) {
  camera.far = 6000; camera.updateProjectionMatrix();
  const skyC = { top: '#6d8db4', horizon: '#f0cfae', bottom: '#8e98a4' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#dcd4cc', 0.0002);
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#cdd9e8', '#8a8274', 1.8));
  const sunDir = [-0.75, 0.22, -0.45];
  const sun = makeSun(scene, { color: '#ffcf98', intensity: 2.8, dir: sunDir, box: 22, mapSize: 2048 });
  const r = rng(1812);
  const white = std({ color: '#f1f3f5' });

  // ground: snow, path with footprints, pebbles peeking out towards the stones
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), texMat(snowTex({ seed: 2, repeat: [30, 30] }))); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.position.x = -95; scene.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 80), texMat(snowTex({ seed: 3, repeat: [1, 12], prints: 60 }))); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.006, -20); path.receiveShadow = true; scene.add(path);
  const peb = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 80), texMat(snowTex({ seed: 4, repeat: [1, 14], pebbles: 0.45 }))); peb.rotation.x = -Math.PI / 2; peb.position.set(2.9, 0.004, -20); peb.receiveShadow = true; scene.add(peb);

  // rope fence on timber posts, snow caps
  const wood = std({ color: '#8a7a64' });
  const ropeM = std({ map: ropeTex() });
  const posts = [];
  for (let z = 12; z > -60; z -= 2.6) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), wood); p.position.set(1.55, 0.52, z); p.rotation.y = (r() - 0.5) * 0.2; p.castShadow = true; scene.add(p);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), white); cap.position.set(1.55, 1.07, z); scene.add(cap);
    posts.push(z);
  }
  for (let i = 0; i < posts.length - 1; i++) for (const [y, sag] of [[0.95, 0.12], [0.5, 0.1]]) {
    const a = new THREE.Vector3(1.55, y, posts[i]), b = new THREE.Vector3(1.55, y, posts[i + 1]);
    const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * sag; pts.push(p); }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.028, 6), ropeM); rope.castShadow = true; scene.add(rope);
  }

  // limestone armour blocks with snow on top
  const lime = texMat(concreteTex({ seed: 5, color: '#b7ae9c', repeat: [1, 1], cracks: 6, moss: 0.1 }));
  for (let z = 14; z > -70; z -= 1.3 + r() * 0.9) {
    for (const [x0, y0] of [[3.6, -0.25], [5.0, -0.7]]) {
      const w = 1.1 + r() * 0.8, h = 0.7 + r() * 0.5, d = 1.0 + r() * 0.8;
      const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.9 + r() * 0.2), p.getY(i) * (0.9 + r() * 0.2), p.getZ(i) * (0.9 + r() * 0.2)); g.computeVertexNormals();
      const b = new THREE.Mesh(g, lime); b.position.set(x0 + (r() - 0.5) * 0.5, y0 + h / 2 - 0.2, z); b.rotation.y = (r() - 0.5) * 0.5; b.rotation.z = (r() - 0.5) * 0.15; b.castShadow = b.receiveShadow = true; scene.add(b);
      const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.08, d * 0.8), white); s.position.set(b.position.x, b.position.y + h / 2 - 0.02, z); s.rotation.copy(b.rotation); scene.add(s);
    }
  }
  // the lake: rippled, reflective
  const wn = Noise(6);
  const nrm = pixTex(256, 256, (u, v) => {
    const e = 1 / 256; const h = (x, y) => wn.fbm(x, y, 8, 4);
    const dx = (h(u + e, v) - h(u - e, v)) * 40, dy = (h(u, v + e) - h(u, v - e)) * 40;
    const nz = 1; const L = Math.hypot(dx, dy, nz);
    return [(-dx / L * 0.5 + 0.5) * 255, (-dy / L * 0.5 + 0.5) * 255, (nz / L * 0.5 + 0.5) * 255];
  }, { srgb: false, repeat: [900, 900] });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), pbr({ color: '#56707f', roughness: 0.12, metalness: 0.2, envMap: env, envMapIntensity: 1.3, normalMap: nrm, normalScale: new THREE.Vector2(0.08, 0.08) }));
  water.rotation.x = -Math.PI / 2; water.position.set(4500, -0.9, 0); scene.add(water);
  // shore ice floes
  for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.4 + r() * 0.9, 7), std({ color: '#e8eef2' })); f.rotation.x = -Math.PI / 2; f.position.set(6 + r() * 6, -0.87, 12 - r() * 70); f.scale.set(1, 0.6 + r() * 0.8, 1); scene.add(f); }

  // bare snowy tree on the left, a few more further along
  const tg = poplarGeos(88, 9, { crownColor: '#cfd4d8', width: 2.0, crownStart: 0.35 });
  const tm = [mtx(-2.2, 0, -7.5, 0.4, 1.1), mtx(-3.5, 0, -16, 1.4, 0.9), mtx(-2.4, 0, -27, 2, 1.0), mtx(-4, 0, 4, 0.2, 1.0)];
  scene.add(instanced(tg.trunk, std({ color: '#3e3a36' }), tm)); scene.add(instanced(tg.crown, std({ vertexColors: true, flatShading: true }), tm));

  // ---- the skyline across the water ----
  const cam0 = new THREE.Vector3(0, 1.65, 2);
  const dir = new THREE.Vector3(0.81, 0, -0.58).normalize(), perp = new THREE.Vector3(0.58, 0, 0.81);
  const C = cam0.clone().addScaledVector(dir, 1300); C.y = -0.9;
  const glassCols = ['#8fa4b4', '#a9b4bc', '#c2c7c6', '#6f8596', '#d9cdb0', '#b8a37a'];
  const texs = glassCols.map((c, i) => blockTex(20 + i, c));
  for (let i = 0; i < 70; i++) {
    const off = (r() - 0.5) * 1100, depth = (r() - 0.3) * 200;
    const cen = Math.exp(-((off / 330) ** 2));
    const h = 40 + r() * 90 + cen * r() * 200;
    const w = 25 + r() * 40;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * (0.7 + r() * 0.6)), texMat(texs[Math.floor(r() * texs.length)]));
    b.position.copy(C).addScaledVector(perp, off).addScaledVector(dir, depth); b.position.y = -0.9 + h / 2; b.rotation.y = Math.atan2(dir.x, dir.z) + (r() - 0.5) * 0.3; scene.add(b);
  }
  // low-rise band and the treeline along the far shore
  const band = new THREE.Mesh(new THREE.BoxGeometry(20, 14, 2600), std({ color: '#8a8c86' })); band.position.copy(C).addScaledVector(dir, -150); band.position.y = 6; band.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2; scene.add(band);
  const trees = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 900), std({ color: '#6c6f6a' })); trees.position.copy(C).addScaledVector(dir, -200).addScaledVector(perp, 750); trees.position.y = 5; trees.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2; scene.add(trees);
  // CN Tower
  const cn = new THREE.Group(); cn.position.copy(C).addScaledVector(perp, 40).addScaledVector(dir, -60); scene.add(cn);
  const concrete = std({ color: '#d6d0c4' });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5, 11, 345, 6), concrete); shaft.position.y = 172; cn.add(shaft);
  for (let k = 0; k < 3; k++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 160, 26), concrete); fin.position.set(Math.cos(k * 2.094) * 12, 80, Math.sin(k * 2.094) * 12); fin.rotation.y = -k * 2.094; fin.scale.set(1, 1, 1); cn.add(fin); }
  const pod = new THREE.Mesh(new THREE.CylinderGeometry(20, 17, 16, 20), concrete); pod.position.y = 350; cn.add(pod);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 5, 8, 24), std({ color: '#b9b4aa' })); ring.rotation.x = Math.PI / 2; ring.position.y = 345; cn.add(ring);
  const podTop = new THREE.Mesh(new THREE.CylinderGeometry(12, 20, 8, 20), concrete); podTop.position.y = 362; cn.add(podTop);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 90, 8), concrete); upper.position.y = 410; cn.add(upper);
  const sky = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 7, 12), concrete); sky.position.y = 447; cn.add(sky);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.2, 100, 6), std({ color: '#e8e2d8' })); ant.position.y = 500; cn.add(ant);
  // stadium dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(110, 24, 10, 0, 6.29, 0, 1.2), std({ color: '#eceae4' })); dome.scale.set(1, 0.32, 1); dome.position.copy(C).addScaledVector(perp, 120).addScaledVector(dir, -40); dome.position.y = -0.9; scene.add(dome);

  // ---- Canada geese: a few on the snow, a skein flying across ----
  const ground_geese = [[-1.6, -6.5, 0.8], [-2.3, -5.2, 2.2], [-0.9, -9.5, -0.6], [-2.8, -8.8, 1.4], [2.4, -11, 3.0]];
  const standing = ground_geese.map(([x, z, ry], i) => { const g = goose(); g.position.set(x, 0.33, z); g.rotation.y = ry; scene.add(g); return g; });
  standing[1].children.forEach((c) => {}); // one grazing: tilt its neck group down via whole-body pitch
  standing[1].rotation.x = 0.35;
  const skein = [];
  const V = [[0, 0], [1, 1], [-1, 1], [2, 2], [-2, 2], [3, 3], [-3, 3], [4, 4], [5, 5]];
  for (const [a, b] of V) { const g = goose({ flying: true }); g.scale.setScalar(1.25); scene.add(g); skein.push({ g, a, b, ph: r() * 6.28 }); }

  // light snowfall
  const NF = 3500, fr = rng(71);
  const base = new Float32Array(NF * 3), spd = new Float32Array(NF), phs = new Float32Array(NF);
  for (let i = 0; i < NF; i++) { base[i * 3] = fr() * 40 - 20; base[i * 3 + 1] = fr() * 16; base[i * 3 + 2] = fr() * 40 - 20; spd[i] = 0.5 + fr() * 0.6; phs[i] = fr() * 6.28; }
  const fgeo = new THREE.BufferGeometry(); const fpos = new Float32Array(NF * 3); fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
  const flakes = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.04, map: glowTex(), color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.9 }));
  flakes.frustumCulled = false; scene.add(flakes);
  const wrap = (v, lo, span) => lo + (((v - lo) % span) + span) % span;

  const pts = [[0.1, 0, 3], [0.1, 0, -4.5]];
  const yaw = kf([[0, -0.78], [2.5, -0.9], [5, -1.0]]);
  const pitch = kf([[0, 0.03], [5, 0.07]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.014, stride: 0.75, lookAhead: 4, ease: 0.6, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  const fdir = new THREE.Vector3(-0.55, 0, 0.84).normalize(); // flight heading (right-to-left across the view)
  const side = new THREE.Vector3(0.84, 0, 0.55);
  return (t) => {
    cam(t);
    sun.follow(camera.position);
    water.material.normalMap.offset.set(t * 0.02, t * 0.013);
    // skein
    const lead = new THREE.Vector3(60, 34, -58).addScaledVector(fdir, t * 13);
    for (const s of skein) {
      const p = lead.clone().addScaledVector(fdir, -s.b * 2.2).addScaledVector(side, s.a * 2.0); p.y += Math.sin(t * 1.3 + s.ph) * 0.3;
      s.g.position.copy(p); s.g.rotation.y = Math.atan2(fdir.x, fdir.z);
      const f = Math.sin(t * 7 + s.ph) * 0.6;
      s.g.userData.wings[0].rotation.z = f; s.g.userData.wings[1].rotation.z = -f;
    }
    const c = camera.position;
    for (let i = 0; i < NF; i++) {
      const x = base[i * 3] + Math.sin(t * 0.8 + phs[i]) * 0.3 + t * 0.3, y = base[i * 3 + 1] - spd[i] * t, zz = base[i * 3 + 2] + Math.cos(t * 0.6 + phs[i]) * 0.3;
      fpos[i * 3] = wrap(x, c.x - 20, 40); fpos[i * 3 + 1] = wrap(y, c.y - 6, 16); fpos[i * 3 + 2] = wrap(zz, c.z - 20, 40);
    }
    fgeo.attributes.position.needsUpdate = true;
  };
}
