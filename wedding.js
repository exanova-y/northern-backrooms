import {
  THREE, rng, Noise, pixTex, peelTex, concreteTex, dirtTex, tileTex, glowTex, softTex, texMat, std, makeSky,
  pathCam, kf, person, loudspeakerPole, wire, instanced, mtx, poplarGeos, poplarBark, clamp, smooth, lerp
} from '../lib.js';

export const DUR = 15;
const hsh = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

function doorTex(seed) {
  const n = Noise(seed);
  return pixTex(256, 256, (u, v) => {
    const a = n.fbm(u, v, 4, 5); const seam = Math.abs(u - 0.5) < 0.008 ? 0.4 : 1;
    const c = a > 0.7 ? [100, 55, 40] : [150, 28, 24]; const k = seam * (0.85 + 0.3 * a);
    return [c[0] * k, c[1] * k, c[2] * k];
  }, {
    post: (ctx, w, h) => {
      ctx.fillStyle = '#c9a24c';
      for (const cx of [w * 0.25, w * 0.75]) for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(cx - 30 + j * 30, h * 0.25 + i * 30, 3.5, 0, 6.28); ctx.fill(); }
      // blank red paper diamonds pasted on each leaf
      for (const cx of [w * 0.25, w * 0.75]) { ctx.save(); ctx.translate(cx, h * 0.42); ctx.rotate(Math.PI / 4); ctx.fillStyle = '#d42a1e'; ctx.fillRect(-26, -26, 52, 52); ctx.restore(); }
    }
  });
}

export async function build({ renderer, scene, camera }) {
  makeSky(scene, { top: '#0b1122', horizon: '#34405e', bottom: '#151a26' });
  scene.fog = new THREE.FogExp2('#1c2335', 0.04);
  renderer.toneMappingExposure = 1.25;
  scene.add(new THREE.HemisphereLight('#51628a', '#1b1b22', 0.9));
  const r = rng(505);
  const soft = softTex(), glow = glowTex();

  // lane: packed dirt, carpet of red paper near the gate from earlier strings
  const laneT = dirtTex({ seed: 81, color: '#6d665a', repeat: [16, 60], shells: 30, red: 40 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(40, 150), texMat(laneT)); lane.rotation.x = -Math.PI / 2; lane.position.z = -40; lane.receiveShadow = true; scene.add(lane);
  const redT = dirtTex({ seed: 82, color: '#6d665a', repeat: [2, 2], red: 1400 });
  const redPatch = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), texMat(redT)); redPatch.rotation.x = -Math.PI / 2; redPatch.position.set(-1, 0.004, -12); redPatch.scale.set(1, 1.6, 1); scene.add(redPatch);

  // courtyard walls + gates, both sides
  const wallMat = texMat(peelTex({ seed: 83, top: '#d9d3c4', under: '#8a8274', band: { color: '#7f7d77', from: 0.62 }, repeat: [2, 1], peel: 0.66 }));
  const capMat = std({ color: '#5e5c58' });
  const tileMat = texMat(tileTex({ seed: 84, repeat: [1, 2], cols: 6, rows: 20 }));
  const roofT = pixTex(128, 128, (u, v) => { const k = 0.7 + 0.3 * Math.abs(Math.sin(u * Math.PI * 10)); return [70 * k, 72 * k, 78 * k]; }, { repeat: [6, 2] });
  const lanternMat = std({ color: '#d41f14', emissive: '#b01408', emissiveIntensity: 1.1 });
  const lanterns = [];
  const winMat = std({ color: '#111', emissive: '#ffb45a', emissiveIntensity: 1.3 });
  const darkWin = std({ color: '#0c0f16' });
  for (const side of [-1, 1]) {
    for (let z = 12, i = 0; z > -80; z -= 12, i++) {
      const g = new THREE.Group(); g.position.set(side * 2.9, 0, z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(g);
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 0.3), wallMat); w.position.set(sx * 3.7, 1.3, 0); w.castShadow = w.receiveShadow = true; g.add(w);
        const c = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 0.45), capMat); c.position.set(sx * 3.7, 2.66, 0); g.add(c);
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.3, 0.5), tileMat); p.position.set(sx * 1.45, 1.65, 0.05); g.add(p);
        // blank red paper strips either side of the door
        const cp = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 2.0), std({ color: '#b3231a' })); cp.position.set(sx * 1.45, 1.8, 0.31); g.add(cp);
      }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.6), texMat(doorTex(i * 7 + (side > 0 ? 1 : 0)))); door.position.set(0, 1.3, -0.02); g.add(door);
      const gr = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 1.0), texMat(roofT)); gr.position.set(0, 3.35, 0.1); gr.rotation.x = 0.15; g.add(gr);
      // house behind: pitched roof + a few lit windows (everyone is up early)
      const house = new THREE.Mesh(new THREE.BoxGeometry(11.5, 3.2, 5), std({ color: '#8f8a80' })); house.position.set(0, 1.6, -7.5); g.add(house);
      const tri = new THREE.Shape(); tri.moveTo(-3, 0); tri.lineTo(3, 0); tri.lineTo(0, 1.6); tri.lineTo(-3, 0);
      const rg = new THREE.ExtrudeGeometry(tri, { depth: 12, bevelEnabled: false }); rg.rotateY(Math.PI / 2); rg.translate(-6, 0, 0);
      const roof = new THREE.Mesh(rg, texMat(roofT)); roof.position.set(0, 3.2, -7.5); g.add(roof);
      for (const wx of [-3.5, 0, 3.5]) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), hsh(i * 3 + wx + side) > 0.45 ? winMat : darkWin); wm.position.set(wx, 1.8, -4.98); g.add(wm); }
      // the wedding house (left, near the arch) gets lanterns
      if (side < 0 && (z === -12 || z === 0)) {
        for (const lx of [-1.0, 1.0]) {
          const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), lanternMat); l.scale.set(1, 0.85, 1); l.position.set(lx, 2.75, 0.55); g.add(l);
          const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 10), std({ color: '#c9a24c', emissive: '#3a2a08' })); cap1.position.set(lx, 3.04, 0.55); g.add(cap1);
          const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.3, 6), std({ color: '#e0b030', emissive: '#4a3008' })); tassel.position.set(lx, 2.3, 0.55); g.add(tassel);
          lanterns.push(l);
        }
      }
    }
  }
  scene.updateMatrixWorld(true);
  const lanternGlows = lanterns.map((l) => { const p = new THREE.Vector3(); l.getWorldPosition(p); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ff4a2a', transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending })); s.position.copy(p); s.scale.setScalar(2.2); scene.add(s); return s; });
  const lanternLight = new THREE.PointLight('#ff4a30', 6, 12, 1.6); lanternLight.position.set(-1.8, 2.6, -12); scene.add(lanternLight);

  // inflatable wedding arch across the lane
  const archPts = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI * (1 - i / 40);
    archPts.push(new THREE.Vector3(Math.cos(a) * 3.25, 3.1 + Math.sin(a) * 1.3, 0));
  }
  const archCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-3.25, 0, 0), new THREE.Vector3(-3.25, 1.6, 0), ...archPts, new THREE.Vector3(3.25, 1.6, 0), new THREE.Vector3(3.25, 0, 0)]);
  const arch = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 90, 0.48, 14, false), std({ color: '#c41c16', emissive: '#3a0604' }));
  arch.position.set(0, 0, -14); arch.castShadow = true; scene.add(arch);
  const band = new THREE.Mesh(new THREE.TubeGeometry(archCurve, 90, 0.5, 14, false), std({ color: '#e0b43a', emissive: '#3a2a08', transparent: true, opacity: 1 }));
  band.scale.set(1, 1, 0.25); band.position.set(0, 0, -14); scene.add(band);
  for (const x of [-3.25, 3.25]) { const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), std({ color: '#e0b43a', emissive: '#4a3408' })); ball.position.set(x, 0.3, -14); scene.add(ball); }
  // balloon clusters
  const balloonGeo = new THREE.SphereGeometry(0.2, 10, 8); balloonGeo.scale(1, 1.15, 1);
  const bm = [], bc = [];
  for (const x of [-3.25, 3.25]) for (let i = 0; i < 18; i++) { bm.push(mtx(x + (r() - 0.5) * 0.9, 2.2 + r() * 1.2, -14 + 0.5 + (r() - 0.3) * 0.5, r() * 6, 0.8 + r() * 0.4)); bc.push(new THREE.Color(['#e8404a', '#f06a8a', '#f2e4e8', '#d42a2a'][Math.floor(r() * 4)])); }
  const balloons = instanced(balloonGeo, std({ color: '#fff' }), bm); bc.forEach((c, i) => balloons.setColorAt(i, c)); scene.add(balloons);

  // lights: sodium street lamp, bare bulb at the gate
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 6.5, 8), std({ color: '#6a6a66' })); lampPole.position.set(2.5, 3.25, -24); scene.add(lampPole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.1), std({ color: '#6a6a66' })); arm.position.set(1.85, 6.4, -24); scene.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.25), std({ color: '#222', emissive: '#ff9a3a', emissiveIntensity: 2 })); head.position.set(1.2, 6.32, -24); scene.add(head);
  const sodium = new THREE.PointLight('#ff9a48', 30, 32, 1.5); sodium.position.set(1.2, 6.0, -24); scene.add(sodium);
  const sg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffa050', transparent: true, depthWrite: false, opacity: 0.6, blending: THREE.AdditiveBlending })); sg.position.copy(sodium.position); sg.scale.setScalar(4); scene.add(sg);
  const bulb = new THREE.PointLight('#ffd49a', 5, 10, 1.6); bulb.position.set(-2.4, 3.1, -3); scene.add(bulb);
  const bulbM = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff2d0' })); bulbM.position.copy(bulb.position); scene.add(bulbM);
  const bgl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffd49a', transparent: true, depthWrite: false, opacity: 0.6, blending: THREE.AdditiveBlending })); bgl.position.copy(bulb.position); bgl.scale.setScalar(0.9); scene.add(bgl);

  const lp = loudspeakerPole({ h: 7.2 }); lp.position.set(-2.5, 0, -30); scene.add(lp);
  wire(scene, [-2.5, 6.9, -30], [2.5, 6.3, -24], 0.5); wire(scene, [2.5, 6.3, -24], [2.6, 6.3, 4], 1.2); wire(scene, [-2.5, 6.8, -30], [-2.6, 6.6, -60], 1.0);

  // poplar silhouettes behind the roofs
  const H = 17; const tp = poplarGeos(505, H, { crownColor: '#26302a', width: 1.3, crownStart: 0.33 }); const tms = [];
  for (let i = 0; i < 36; i++) { const s = r() < 0.5 ? -1 : 1; tms.push(mtx(s * (15 + r() * 8), 0, 12 - r() * 90, r() * 6, 0.8 + r() * 0.3)); }
  scene.add(instanced(tp.trunk, std({ color: '#3a3a36' }), tms)); scene.add(instanced(tp.crown, std({ vertexColors: true, flatShading: true }), tms));

  // onlookers
  const folk = [
    [person({ pose: 'stand', shirt: '#3a3f4a', pants: '#1c1f28' }), -2.1, -10.5, 0.9],
    [person({ pose: 'stand', shirt: '#6b2a28', pants: '#20222a', hair: '#9a9690' }), -2.3, -9.3, 1.2],
    [person({ pose: 'squat', shirt: '#2e3440', pants: '#1a1c22', cig: true }), -2.35, -7.8, 1.5],
    [person({ pose: 'stand', shirt: '#c43a2e', pants: '#2a3560', scale: 0.62 }), 2.2, -9.2, -1.7],
  ];
  folk.forEach(([p, x, z, ry]) => { p.position.set(x, 0, z); p.rotation.y = ry; scene.add(p); });

  // --- the firecracker string laid along the lane, burning toward the camera ---
  const S = (u) => new THREE.Vector3(0.7 + Math.sin(u * 11) * 0.45 + Math.sin(u * 3.1) * 0.3, 0.03, -30 + 25 * u);
  const NC = 900;
  const crackGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.065, 6); crackGeo.rotateZ(Math.PI / 2);
  const crackMats = [];
  for (let i = 0; i < NC; i++) { const u = i / NC, p = S(u); const side = i % 2 ? 1 : -1; crackMats.push(mtx(p.x + side * 0.04, p.y, p.z, 0.3 * side + (hsh(i) - 0.5) * 0.4)); }
  const crackers = instanced(crackGeo, std({ color: '#c8231a', emissive: '#300404' }), crackMats, { cast: false });
  scene.add(crackers);
  const fuse = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 60 }, (_, i) => S(i / 59))), 300, 0.008, 4), std({ color: '#3a2a1a' })); scene.add(fuse);
  const front = (t) => clamp((t - 0.4) / 14.2); // u of burning point
  // flash light + sprites
  const flash = new THREE.PointLight('#ffc27a', 0, 22, 1.4); scene.add(flash);
  const flashSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#fff0c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(flashSpr);
  const sparks = []; for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: i % 3 ? '#ffb040' : '#fff4d0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(s); sparks.push(s); }
  // flying red paper bits
  const bits = []; for (let i = 0; i < 70; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: i % 5 ? '#b5241a' : '#e8d6b0', fog: true })); scene.add(s); bits.push(s); }
  // red paper accumulating along the burnt trail
  const flakeGeo = new THREE.PlaneGeometry(0.06, 0.04); flakeGeo.rotateX(-Math.PI / 2);
  const NF = 2400, flakeBase = [];
  for (let i = 0; i < NF; i++) { const u = r(), p = S(u); const rad = Math.pow(r(), 1.5) * 1.6, a = r() * 6.28; flakeBase.push({ u, x: p.x + Math.cos(a) * rad, z: p.z + Math.sin(a) * rad, ry: r() * 6, s: 0.6 + r() * 1.2 }); }
  const flakes = new THREE.InstancedMesh(flakeGeo, std({ color: '#ffffff', side: THREE.DoubleSide }), NF);
  flakeBase.forEach((f, i) => flakes.setColorAt(i, new THREE.Color(hsh(i + 3) < 0.8 ? '#a8221a' : '#d8c8a8')));
  flakes.receiveShadow = true; scene.add(flakes);
  // smoke puffs spawned along the trail, lingering and drifting
  const NP = 140, puffs = [];
  for (let i = 0; i < NP; i++) {
    const u = i / NP, p = S(u);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#50545e', transparent: true, depthWrite: false, opacity: 0, rotation: hsh(i) * 6 }));
    scene.add(s); puffs.push({ s, u, p, k: 0.7 + hsh(i + 9) * 0.6, dx: (hsh(i + 1) - 0.5), dz: (hsh(i + 2) - 0.5) });
  }
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), Yax = new THREE.Vector3(0, 1, 0);

  const pts = [[0.3, 0, 7], [-0.1, 0, 3], [-0.3, 0, -1], [-0.4, 0, -4]];
  const yaw = kf([[0, 0.0], [5, 0.05], [8, 0.25], [10, 0.1], [12, -0.2], [15, -0.35]]);
  const pitch = kf([[0, 0.02], [4, -0.05], [9, -0.12], [12, -0.22], [15, -0.28]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.62, bob: 0.012, stride: 0.7, lookAhead: 5, ease: 2, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });

  return (t) => {
    cam(t);
    const fi = Math.floor(t * 24);
    const uf = front(t), burning = t > 0.4 && uf < 1;
    const fp = S(uf);
    // unexploded crackers: those with u > uf
    for (let i = 0; i < NC; i++) {
      const u = i / NC;
      if (u < uf) { tmpM.makeScale(0, 0, 0); crackers.setMatrixAt(i, tmpM); } else crackers.setMatrixAt(i, crackMats[i]);
    }
    crackers.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NF; i++) {
      const f = flakeBase[i];
      if (f.u > uf) tmpS.set(0, 0, 0); else tmpS.setScalar(f.s);
      tmpM.compose(tmpP.set(f.x, 0.008, f.z), tmpQ.setFromAxisAngle(Yax, f.ry), tmpS); flakes.setMatrixAt(i, tmpM);
    }
    flakes.instanceMatrix.needsUpdate = true;
    // flash: random bursts
    const b = hsh(fi * 1.7), b2 = hsh(fi * 3.1 + 5);
    const inten = burning ? (b > 0.25 ? 12 + 70 * b * b * b : 3) : 0;
    flash.intensity = inten; flash.position.set(fp.x + (b2 - 0.5) * 0.4, 0.35, fp.z);
    flashSpr.position.set(fp.x + (b2 - 0.5) * 0.3, 0.2 + b * 0.2, fp.z);
    flashSpr.scale.setScalar(burning ? 0.4 + b * b * 2.4 : 0); flashSpr.material.opacity = burning ? 0.5 + 0.5 * b : 0;
    sparks.forEach((s, i) => {
      const h1 = hsh(fi * 41 + i * 7), h2 = hsh(fi * 13 + i * 3), h3 = hsh(fi * 7 + i * 11);
      const on = burning && h1 > 0.35;
      s.visible = on;
      if (on) { s.position.set(fp.x + (h2 - 0.5) * 1.2, 0.05 + h3 * 0.9, fp.z + (h1 - 0.5) * 1.2); s.scale.setScalar(0.04 + h2 * 0.12); s.material.opacity = 0.9; }
    });
    // paper bits: short parabolic hops from the front
    bits.forEach((s, i) => {
      const life = 0.7, ph = hsh(i * 5.3) * life; const age = ((t + ph) % life); const tb = t - age; if (tb < 0.4 || front(tb) >= 1) { s.visible = false; return; }
      const p0 = S(front(tb)); const vx = (hsh(i * 2 + Math.floor((t + ph) / life)) - 0.5) * 3, vz = (hsh(i * 9 + Math.floor((t + ph) / life)) - 0.5) * 3, vy = 1.5 + hsh(i * 4 + Math.floor((t + ph) / life)) * 3;
      const y = 0.1 + vy * age - 4.9 * age * age; s.visible = y > 0;
      s.position.set(p0.x + vx * age, Math.max(0.01, y), p0.z + vz * age); s.scale.set(0.05, 0.035, 1);
    });
    // smoke
    puffs.forEach((q, i) => {
      const tb = 0.4 + q.u * 14.2; const age = t - tb;
      if (age < 0) { q.s.visible = false; return; }
      q.s.visible = true;
      const grow = 1 - Math.exp(-age * 0.5);
      q.s.position.set(q.p.x + q.dx * (0.5 + age * 0.4) + age * 0.08, 0.25 + grow * 1.5 + age * 0.08, q.p.z + q.dz * (0.5 + age * 0.35));
      const sc = (0.5 + grow * 2.8) * q.k; q.s.scale.set(sc, sc, 1);
      q.s.material.opacity = 0.42 * smooth(0, 0.3, age) * (1 - smooth(8, 16, age));
      // lit by nearby flashes
      const d = Math.hypot(q.s.position.x - fp.x, q.s.position.z - fp.z);
      const lit = burning ? inten / 80 * Math.exp(-d * 0.5) : 0;
      q.s.material.color.setRGB(0.2 + lit * 0.8, 0.21 + lit * 0.55, 0.25 + lit * 0.3);
    });
    lanternGlows.forEach((g, i) => { g.material.opacity = 0.5 + 0.05 * Math.sin(t * 2 + i); });
  };
}
