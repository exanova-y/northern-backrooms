import {
  THREE, rng, Noise, pixTex, texMat, std, pbr, makeSky, envFrom, makeSun, pathCam, kf, person, instanced, mtx, mix3, clamp
} from '../lib.js';

export const DUR = 5;

function stoneTex(seed) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(512, 512, (u, v) => {
    const a = n.fbm(u, v, 4, 6), b = n.fbm(u, v, 24, 3), pit = n.vn(u * 90, v * 90, 90);
    let c = mix3([196, 176, 138], [228, 212, 172], a);
    c = c.map((k) => k * (0.9 + b * 0.18));
    if (pit > 0.8) c = c.map((k) => k * 0.72);
    const streak = n.vn(u * 30, v * 2, 30); if (streak > 0.7) c = mix3(c, [150, 130, 100], (streak - 0.7) * 1.5);
    return c;
  }, { repeat: [1, 1] });
}
function paverTex() {
  const n = Noise(8);
  return pixTex(512, 512, (u, v) => {
    const cu = (u * 4) % 1, cv = (v * 6 + (Math.floor(u * 4) % 2) * 0.5) % 1;
    let c = mix3([214, 200, 172], [236, 226, 204], n.fbm(u, v, 6, 4));
    if (cu < 0.012 || cv < 0.018) c = [160, 146, 120];
    return c;
  }, { repeat: [8, 8] });
}
function tallitTex() {
  return pixTex(256, 256, (u, v) => {
    const y = 1 - v; // stripes near the lower edge
    const stripe = (y > 0.08 && y < 0.14) || (y > 0.18 && y < 0.2) || (y > 0.24 && y < 0.3);
    return stripe ? [24, 24, 28] : [242, 240, 232];
  });
}

export async function build({ renderer, scene, camera }) {
  camera.far = 1000; camera.fov = 56; camera.updateProjectionMatrix();
  const skyC = { top: '#5f9ad8', horizon: '#e8e2d2', bottom: '#c8b890' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#e8e0cc', 0.004);
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#eef2f8', '#b09a74', 1.6));
  const sun = makeSun(scene, { color: '#fff0d6', intensity: 3.4, dir: [0.45, 0.62, 0.65], box: 16, mapSize: 2048 });
  const r = rng(70);

  // plaza
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), std({ map: paverTex() })); plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0, 25); plaza.receiveShadow = true; scene.add(plaza);

  // ---- the wall: courses of large ashlars with drafted margins, smaller stones higher up ----
  const sT = [stoneTex(1), stoneTex(2), stoneTex(3)];
  const joint = new THREE.Mesh(new THREE.PlaneGeometry(60, 22), std({ color: '#6a5a44' })); joint.position.set(0, 11, -0.12); scene.add(joint);
  const margins = [[], [], []], bosses = [[], [], []], mcol = [[], [], []], bcol = [[], [], []];
  const notes = [], plants = [];
  let y = 0; let course = 0;
  while (y < 20) {
    const h = y < 11 ? 1.05 + r() * 0.1 : 0.55 + r() * 0.25;
    let x = -30 + r() * 1.5;
    while (x < 30) {
      const w = y < 11 ? 1.6 + r() * 2.6 : 0.8 + r() * 1.0;
      const k = Math.floor(r() * 3); const col = new THREE.Color().setHSL(0.11 + (r() - 0.5) * 0.02, 0.3 + r() * 0.15, 0.62 + (r() - 0.5) * 0.14 + (y > 11 ? 0.04 : 0));
      const worn = y < 3 ? -0.05 : 0; // lower courses darker/polished by hands
      col.offsetHSL(0, 0, worn);
      margins[k].push(mtx(x + w / 2, y + h / 2, -0.05, 0, 1, 1).multiply(new THREE.Matrix4().makeScale(w - 0.04, h - 0.04, 0.12))); mcol[k].push(col.clone().offsetHSL(0, 0, -0.05));
      if (y < 11) { bosses[k].push(mtx(x + w / 2, y + h / 2, 0.01 + r() * 0.02, 0, 1, 1).multiply(new THREE.Matrix4().makeScale(w - 0.2, h - 0.2, 0.06))); bcol[k].push(col); }
      // folded notes in the joints, within reach
      if (y < 2.6 && y > 0.3) for (let q = 0; q < 6; q++) if (r() < 0.6) notes.push(mtx(x + r() * w, y + (r() < 0.5 ? 0 : h) + (r() - 0.5) * 0.03, 0.03, r() * 6, 1, 1, Math.PI / 2 + (r() - 0.5) * 0.6, r()));
      if (y > 6 && r() < 0.35) plants.push(mtx(x + r() * w, y + h, 0.12, r() * 6, 0.25 + r() * 0.35, 0.2 + r() * 0.3));
      x += w;
    }
    y += h; course++;
  }
  for (let k = 0; k < 3; k++) {
    const mm = instanced(new THREE.BoxGeometry(1, 1, 1), std({ map: sT[k] }), margins[k]); mcol[k].forEach((c, i) => mm.setColorAt(i, c)); scene.add(mm);
    const bm = instanced(new THREE.BoxGeometry(1, 1, 1), std({ map: sT[(k + 1) % 3] }), bosses[k]); bcol[k].forEach((c, i) => bm.setColorAt(i, c)); scene.add(bm);
  }
  scene.add(instanced(new THREE.BoxGeometry(0.035, 0.02, 0.05), std({ color: '#f6f4ee' }), notes, { cast: false }));
  scene.add(instanced(new THREE.IcosahedronGeometry(1, 0), std({ color: '#5a7a3a', flatShading: true }), plants));
  // hanging caper / vine at the top joints
  const vine = []; for (let i = 0; i < 30; i++) vine.push(mtx(-12 + r() * 24, 12 + r() * 6, 0.2, r() * 6, 0.15, 0.6 + r() * 0.8, 0, (r() - 0.5) * 0.3));
  scene.add(instanced(new THREE.ConeGeometry(1, 1, 5), std({ color: '#6a8a42', flatShading: true }), vine));

  // ---- the partition (mechitza), edge-on to the camera ----
  const wood = std({ color: '#6a4a2e' });
  const mz0 = 0.2, mz1 = 1.8;
  for (let z = mz0; z <= mz1; z += 1.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), wood); p.position.set(0.9, 1.0, z); p.castShadow = true; scene.add(p); }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.95, mz1 - mz0), std({ color: '#e8e4dc' })); panel.position.set(0.9, 0.5, (mz0 + mz1) / 2); panel.castShadow = true; scene.add(panel);
  const lat = []; for (let z = mz0; z <= mz1; z += 0.12) lat.push(mtx(0.9, 1.45, z)); for (let yy = 1.0; yy <= 1.95; yy += 0.12) lat.push(mtx(0.9, yy, (mz0 + mz1) / 2, 0, 1, 1).multiply(new THREE.Matrix4().makeScale(1, 1, (mz1 - mz0) / 0.02)));
  scene.add(instanced(new THREE.BoxGeometry(0.03, 0.9, 0.02), wood, lat.slice(0, Math.floor((mz1 - mz0) / 0.12) + 1)));
  scene.add(instanced(new THREE.BoxGeometry(0.03, 0.02, 0.02), wood, lat.slice(Math.floor((mz1 - mz0) / 0.12) + 1)));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, mz1 - mz0), wood); rail.position.set(0.9, 2.0, (mz0 + mz1) / 2); scene.add(rail);

  // ---- figures (faceless). Men on the left of the partition, women on the right ----
  const figs = [];
  const add = (p, x, z, ry, sway) => { p.position.set(x, 0, z); p.rotation.y = ry; scene.add(p); figs.push({ p, x, z, ry, ...sway }); return p; };
  const black = '#18181c';
  // 1. man in black suit and hat: bowed, hand to his eyes, the other hand on the stones
  const m1 = person({ pose: 'stand', shirt: black, pants: black, hair: '#1a1410', joints: { chest: [0, 1.34, 0.06], head: [0, 1.53, 0.13], sh: [0.2, 1.4, 0.04], elbowR: [0.22, 1.2, 0.2], wristR: [0.06, 1.5, 0.22], elbowL: [-0.28, 1.34, 0.26], wristL: [-0.22, 1.56, 0.46] } });
  { const J = m1.userData.J; const hatM = std({ color: '#0e0e10' });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.015, 24), hatM); brim.position.set(J.head[0], J.head[1] + 0.09, J.head[2]); brim.rotation.x = 0.25; m1.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.15, 20), hatM); crown.position.set(J.head[0], J.head[1] + 0.16, J.head[2] - 0.02); crown.rotation.x = 0.25; m1.add(crown);
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), std({ color: '#241a12' })); beard.scale.set(1, 0.9, 0.8); beard.position.set(J.head[0], J.head[1] - 0.08, J.head[2] + 0.06); m1.add(beard);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.05), std({ color: '#f4f4f2' })); collar.position.set(0, 1.44, 0.13); m1.add(collar);
    for (const s of [-1, 1]) { const payot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 5), std({ color: '#241a12' })); payot.position.set(J.head[0] + s * 0.1, J.head[1] - 0.02, J.head[2]); m1.add(payot); } }
  add(m1, -1.25, 0.62, Math.PI, { rock: 0.035, rate: 2.2, trem: 0.01 });
  // 2. man in a prayer shawl with tefillin: forehead to the wall, right hand raised on it
  const m2 = person({ pose: 'stand', shirt: '#1a1a1e', pants: '#24242a', hair: '#2a2420', joints: { chest: [0, 1.33, 0.1], head: [0, 1.52, 0.23], sh: [0.2, 1.4, 0.08], elbowR: [0.32, 1.55, 0.2], wristR: [0.24, 1.86, 0.33], elbowL: [-0.26, 1.2, 0.14], wristL: [-0.2, 1.36, 0.32] } });
  { const J = m2.userData.J;
    const shawl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.85, 20, 1, true, 0.55, Math.PI * 2 - 1.1), std({ map: tallitTex(), side: THREE.DoubleSide }));
    shawl.position.set(0, 1.0, 0.05); shawl.rotation.x = -0.12; shawl.castShadow = true; m2.add(shawl);
    const cape = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 8, 0, 6.29, 0, 1.2), std({ color: '#f2f0e8', side: THREE.DoubleSide })); cape.scale.set(1.15, 0.7, 0.9); cape.position.set(0, 1.3, 0.06); m2.add(cape);
    const kippah = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 6, 0, 6.29, 0, 0.9), std({ color: '#f4f4f0' })); kippah.position.set(J.head[0], J.head[1] + 0.07, J.head[2] - 0.03); kippah.rotation.x = -0.35; m2.add(kippah);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), std({ color: '#0c0c0c' })); box.position.set(J.head[0], J.head[1] + 0.09, J.head[2] + 0.06); m2.add(box);
    // straps wound around the left forearm
    const e = new THREE.Vector3(...J.elbowL), w = new THREE.Vector3(...J.wristL);
    for (let k = 0; k < 6; k++) { const p = e.clone().lerp(w, k / 6 + 0.05); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 4, 12), std({ color: '#0c0c0c' })); ring.position.copy(p); ring.lookAt(w.clone().add(new THREE.Vector3(0, 0.001, 0))); m2.add(ring); } }
  add(m2, -0.05, 0.4, Math.PI, { rock: 0.05, rate: 1.6, trem: 0.004 });
  // women
  const w1 = person({ pose: 'stand', shirt: '#3a4a6a', pants: '#2a2a30', skirt: '#1e2436', hair: '#3a2a20', joints: { chest: [0, 1.33, 0.08], head: [0, 1.5, 0.2], elbowL: [-0.24, 1.25, 0.2], wristL: [-0.18, 1.45, 0.38], elbowR: [0.24, 1.25, 0.2], wristR: [0.18, 1.45, 0.38] } });
  const w2 = person({ pose: 'stand', shirt: '#7a2a3a', pants: '#2a2a30', skirt: '#3a3a40', hair: '#2a1a14', joints: { chest: [0, 1.34, 0.05], head: [0, 1.53, 0.08], elbowR: [0.18, 1.2, 0.18], wristR: [0.04, 1.48, 0.17], elbowL: [-0.26, 1.3, 0.22], wristL: [-0.22, 1.52, 0.42] } });
  const w3 = person({ pose: 'stand', shirt: '#d8cdb4', pants: '#2a2a30', skirt: '#4a3a2a', hair: '#1a1410', joints: { head: [0, 1.55, 0.07], elbowL: [-0.22, 1.1, 0.12], wristL: [-0.09, 1.16, 0.3], elbowR: [0.22, 1.1, 0.12], wristR: [0.09, 1.16, 0.3] } });
  const w4 = person({ pose: 'stand', shirt: '#2a4a3a', pants: '#2a2a30', skirt: '#141418', hair: '#3a2a20', joints: { chest: [0, 1.34, 0.07], head: [0, 1.52, 0.16], elbowR: [0.22, 1.3, 0.22], wristR: [0.16, 1.58, 0.42], elbowL: [-0.16, 1.22, 0.18], wristL: [-0.03, 1.46, 0.18] } });
  const scarfCols = ['#6a1e2a', '#1e2a5a', '#c8b89a', '#3a5a4a'];
  [w1, w2, w3, w4].forEach((w, i) => { const J = w.userData.J; const sc = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, 6.29, 0, 1.9), std({ color: scarfCols[i] })); sc.position.set(J.head[0], J.head[1] + 0.02, J.head[2] - 0.02); sc.rotation.x = -0.35; w.add(sc); const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), std({ color: scarfCols[i] })); knot.position.set(J.head[0], J.head[1] - 0.02, J.head[2] - 0.14); w.add(knot); });
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.12), std({ color: '#2a2a5a' })); book.position.set(0, 1.18, 0.32); book.rotation.x = -0.6; w3.add(book);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.022, 0.11), std({ color: '#f4efe0' })); pages.position.set(0, 1.19, 0.325); pages.rotation.x = -0.6; w3.add(pages);
  add(w1, 1.75, 0.45, Math.PI, { rock: 0.0, rate: 0, trem: 0.012 });
  add(w2, 2.5, 0.55, Math.PI + 0.1, { rock: 0.0, rate: 0, trem: 0.015 });
  add(w3, 3.3, 1.0, Math.PI - 0.1, { rock: 0.02, rate: 1.4, trem: 0.004 });
  add(w4, 4.05, 0.5, Math.PI, { rock: 0.0, rate: 0, trem: 0.01 });
  // lectern with an open book, plastic chairs
  const lect = new THREE.Group(); lect.position.set(-2.5, 0, 1.0); lect.rotation.y = Math.PI; scene.add(lect);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.4), wood); top.position.set(0, 1.05, 0); top.rotation.x = 0.35; lect.add(top);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), wood); leg.position.y = 0.5; lect.add(leg);
  const ob = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), std({ color: '#f4efe0' })); ob.position.set(0, 1.09, 0); ob.rotation.x = 0.35; lect.add(ob);
  const chairM = std({ color: '#f2f2f0' });
  for (const [x, z, ry] of [[-3.6, 2.4, 2.6], [2.9, 2.8, 3.4], [4.8, 2.3, 3.0], [-4.2, 3.4, 3.6]]) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; scene.add(c);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.42), chairM); seat.position.y = 0.45; c.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.45, 0.04), chairM); back.position.set(0, 0.7, -0.2); back.rotation.x = -0.1; c.add(back);
    for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 6), chairM); l.position.set(lx, 0.225, lz); c.add(l); }
    c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  // a couple of pigeons on a ledge high up
  for (const [x, yy] of [[-2.2, 8.3], [3.4, 10.1]]) { const pg = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std({ color: '#7a7e88' })); pg.scale.set(0.8, 0.8, 1.3); pg.position.set(x, yy, 0.2); scene.add(pg); }

  // camera: a slow approach along the partition line, looking up at the height of the wall, then down to the people
  const pts = [[0.75, 0, 4.4], [0.7, 0, 3.4], [0.62, 0, 2.4]];
  const pitch = kf([[0, 0.12], [1.8, 0.05], [3.8, -0.06], [5, -0.08]]);
  const yaw = kf([[0, 0.06], [2.5, 0.12], [5, 0.1]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.01, stride: 0.7, lookAhead: 3, ease: 1.0, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => {
    cam(t);
    sun.follow(new THREE.Vector3(0.5, 0, 2));
    for (const f of figs) {
      // swaying in prayer (rocking about the feet) + a small sobbing tremble
      f.p.rotation.x = -(f.rock * Math.sin(t * f.rate * Math.PI));
      f.p.rotation.z = f.trem * Math.sin(t * 17 + f.x * 3) * (0.6 + 0.4 * Math.sin(t * 1.3 + f.z));
    }
  };
}
