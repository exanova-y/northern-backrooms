import {
  THREE, rng, Noise, pixTex, texMat, std, makeSky, makeSun, softTex, pathCam, kf, person, instanced, mtx, mix3, clamp
} from '../lib.js';

export const DUR = 5;

const H = (x, z) => 2.2 * Math.sin(x * 0.035 + 0.5) + 1.6 * Math.sin(z * 0.022) + 1.2 * Math.sin((x + z) * 0.018);
const OFF = (z) => 7 * Math.sin(z * 0.012) + 3 * Math.sin(z * 0.03 + 1);
const BW = 3.2;
const PAL = ['#d6267f', '#d81e2a', '#f07418', '#f6cf1c', '#6a36b0', '#f27fb2', '#f3f0ec', '#9a78d8', '#ef4f55', '#ffa02a'];
const bandOf = (x, z) => Math.floor((x + OFF(z)) / BW);
const colOf = (b) => PAL[((b % PAL.length) + PAL.length) % PAL.length];
export const PATH_X = (z) => -OFF(z); // band boundary at k = 0

export async function build({ renderer, scene, camera }) {
  camera.far = 6000; camera.updateProjectionMatrix();
  makeSky(scene, { top: '#3f7fd0', horizon: '#cfe0ee', bottom: '#8aa0b4' });
  scene.fog = new THREE.FogExp2('#c9d8e6', 0.00021);
  renderer.toneMappingExposure = 1.0;
  scene.add(new THREE.HemisphereLight('#d8e8f8', '#6a7a4a', 1.6));
  const sunDir = [-0.35, 0.75, -0.55];
  const sun = makeSun(scene, { color: '#fff1d8', intensity: 3.2, dir: sunDir, box: 30, mapSize: 2048 });
  const r = rng(515);
  const n = Noise(3);

  // ---- terrain with painted stripes (mip-mapped texture handles the distance) ----
  const TW = 600, TD = 900;
  const hexRGB = PAL.map((h) => { const v = new THREE.Color(h).getHex(); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; });
  const stripe = pixTex(1024, 1536, (u, v, px, py) => {
    const x = -TW / 2 + u * TW, z = -TD / 2 + v * TD;
    const w = (x + OFF(z)) / BW, b = Math.floor(w), f = w - b;
    const green = [70, 112, 48];
    let c = hexRGB[((b % PAL.length) + PAL.length) % PAL.length];
    if (f < 0.1 || f > 0.92) c = green;
    const a = n.fbm(u * 3, v * 3, 8, 3);
    c = c.map((k) => k * (0.85 + a * 0.25));
    const dp = Math.abs(x + OFF(z));
    if (z > -56 && z < 14 && dp < 17 && !(f < 0.1 || f > 0.92)) c = mix3(c, green, 0.55);
    if (dp < 0.45 && z > -120 && z < 40) c = [112, 100, 76];
    return c;
  });
  stripe.wrapS = stripe.wrapT = THREE.ClampToEdgeWrapping; stripe.anisotropy = 16;
  const tg = new THREE.PlaneGeometry(TW, TD, 200, 300); tg.rotateX(-Math.PI / 2);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i))); tg.computeVertexNormals(); }
  const terrain = new THREE.Mesh(tg, std({ map: stripe })); terrain.receiveShadow = true; scene.add(terrain);
  // green grass beyond the painted area
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), std({ color: '#5f7a3e' })); outer.rotation.x = -Math.PI / 2; outer.position.y = -4.5; scene.add(outer);

  // ---- tulips near the path: stems + leaves + heads, coloured by band ----
  const headGeo = new THREE.IcosahedronGeometry(1, 1); headGeo.scale(0.055, 0.085, 0.055);
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.01, 1, 4); stemGeo.translate(0, 0.5, 0);
  const leafGeo = new THREE.ConeGeometry(0.07, 0.3, 4); leafGeo.translate(0, 0.15, 0);
  const heads = [], stems = [], leaves = [], hcol = [];
  for (let z = 10; z > -52; z -= 0.3) {
    const px = PATH_X(z);
    for (let dx = -16; dx < 16; dx += 0.3) {
      const x = px + dx + (r() - 0.5) * 0.18, zz = z + (r() - 0.5) * 0.18;
      const w = (x + OFF(zz)) / BW, f = w - Math.floor(w);
      if (Math.abs(x - PATH_X(zz)) < 0.5) continue; // the path
      if (f < 0.1 || f > 0.92) continue; // green gap between bands
      const y = H(x, zz), sh = 0.32 + r() * 0.16;
      stems.push(mtx(x, y, zz, 0, 1, sh).multiply(new THREE.Matrix4().makeScale(1, 1, 1)));
      leaves.push(mtx(x, y, zz, r() * 6, 0.8 + r() * 0.5, 0.8 + r() * 0.5, (r() - 0.5) * 0.4));
      heads.push(mtx(x + (r() - 0.5) * 0.03, y + sh + 0.05, zz, r() * 6, 0.9 + r() * 0.3, 1, (r() - 0.5) * 0.25, (r() - 0.5) * 0.25));
      const c = new THREE.Color(colOf(Math.floor(w))); c.offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.08); hcol.push(c);
    }
  }
  const hm = instanced(headGeo, std({ color: '#ffffff' }), heads); hcol.forEach((c, i) => hm.setColorAt(i, c)); scene.add(hm);
  scene.add(instanced(stemGeo, std({ color: '#4f8a3a' }), stems, { cast: false }));
  scene.add(instanced(leafGeo, std({ color: '#3f7a34', flatShading: true }), leaves, { cast: false }));

  // ---- dark conifer line on a far rise, other people in the fields ----
  const coneGeo = new THREE.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
  const cones = [];
  for (let i = 0; i < 220; i++) { const x = -260 + r() * 520, z = -170 - r() * 60 - Math.abs(x) * 0.1; const h = 9 + r() * 9; cones.push(mtx(x, H(x, z) - 0.5, z, 0, 2.2 + r(), h)); }
  scene.add(instanced(coneGeo, std({ color: '#23402c', flatShading: true }), cones, { cast: false }));
  const folks = [[6, -30, 0.4, '#2e3240'], [-9, -42, -0.8, '#b8322b'], [14, -70, 0.2, '#f0ece2'], [-18, -90, 1.2, '#3a4a6a'], [4, -110, 0, '#2a2a2a']];
  for (const [x, z, ry, c] of folks) { const p = person({ pose: 'stand', shirt: c, pants: '#2a2e38' }); p.position.set(x, H(x, z), z); p.rotation.y = ry; scene.add(p); }

  // ---- snow-capped mountains far ahead ----
  const mg = new THREE.PlaneGeometry(7000, 1800, 280, 72); mg.rotateX(-Math.PI / 2);
  const mn = Noise(9);
  { const p = mg.attributes.position; const cols = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const front = clamp((900 - (z + 900)) / 400); // rises from the front edge
      let h = 0, a = 1, f = 1 / 900;
      for (let o = 0; o < 6; o++) { h += a * (1 - Math.abs(mn.vn(x * f + 50, z * f + 50) * 2 - 1)); a *= 0.5; f *= 2.1; }
      h = Math.pow(h / 1.9, 1.8) * 1100 * front;
      p.setY(i, h);
      const snow = h > 330 + mn.vn(x / 60, z / 60) * 80;
      const c = snow ? [0.94, 0.95, 0.97] : h > 160 ? [0.26, 0.29, 0.36] : [0.16, 0.24, 0.18];
      cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2];
    }
    mg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); mg.computeVertexNormals(); }
  const mtn = new THREE.Mesh(mg, std({ vertexColors: true, flatShading: true })); mtn.position.set(0, -5, -1150 - 900); scene.add(mtn);

  // clouds
  const soft = softTex(128, 44);
  for (let i = 0; i < 16; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.75, fog: false })); s.position.set(-1500 + r() * 3000, 500 + r() * 400, -1800 - r() * 1200); s.scale.set(500 + r() * 500, 180 + r() * 150, 1); scene.add(s); }

  // ---- the run ----
  const pts = []; for (let z = 6; z >= -19; z -= 1) pts.push([PATH_X(z), H(PATH_X(z), z), z]);
  const yaw = kf([[0, 0.05], [2.5, -0.08], [5, 0.06]]);
  const pitch = kf([[0, -0.1], [2, -0.06], [5, -0.03]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.6, bob: 0, lookAhead: 6, ease: 0.45, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  const L = curve.getLength(); window.RUN_LEN = L;
  const STRIDE = 1.35;
  return (t) => {
    const s = cam(t);
    const ph = (s * L) / STRIDE * Math.PI;
    camera.position.y += 0.065 * Math.abs(Math.sin(ph)) - 0.03;
    camera.rotateZ(0.018 * Math.sin(ph));
    sun.follow(camera.position);
  };
}
