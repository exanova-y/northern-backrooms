import {
  THREE, rng, Noise, pixTex, texMat, std, pbr, makeSky, envFrom, makeSun, pathCam, kf, instanced, mtx, mix3, clamp
} from '../lib.js';

export const DUR = 5;
const TOWN_Y = -34;
const gh = (x) => x < 7 ? 0 : x > 66 ? TOWN_Y : -(x - 7) * (-TOWN_Y) / 59;

function snowTex(seed, rocks = 0, repeat = [1, 1]) {
  const n = Noise(seed), r = rng(seed);
  return pixTex(512, 512, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    let c = mix3([238, 240, 243], [206, 212, 220], clamp((a - 0.45) * 2));
    if (rocks) { const g = n.fbm(u + 7, v, 6, 4); if (g > 1 - rocks) c = mix3([70, 66, 62], [120, 114, 108], n.vn(u * 120, v * 120, 120)); }
    return c;
  }, { repeat });
}
function panelTex(color, floors, bays, seed) {
  const n = Noise(seed), r = rng(seed);
  const hx = new THREE.Color(color).getHex(); const B = [(hx >> 16) & 255, (hx >> 8) & 255, hx & 255];
  const varied = []; for (let i = 0; i < floors * bays; i++) varied.push(r());
  return pixTex(512, 256, (u, v) => {
    const fy = (1 - v) * floors, fx = u * bays, fl = Math.floor(fy), bx = Math.floor(fx), ly = fy - fl, lx = fx - bx;
    let c = B.map((k) => k * (0.86 + 0.2 * n.fbm(u, v, 4, 3)));
    if (lx < 0.02 || ly < 0.03) c = c.map((k) => k * 0.82); // panel seams
    const win = lx > 0.22 && lx < 0.78 && ly > 0.28 && ly < 0.78;
    if (win) { const q = varied[fl * bays + bx]; c = q < 0.1 ? [210, 190, 140] : [58 + q * 30, 66 + q * 30, 76 + q * 30]; if (Math.abs(lx - 0.5) < 0.025) c = [230, 230, 226]; }
    else if (lx > 0.19 && lx < 0.81 && ly > 0.25 && ly < 0.81) c = [236, 234, 228];
    // rust/soot streaks
    c = c.map((k) => k * (1 - 0.14 * clamp(n.vn(u * 60, v * 2, 60) - 0.55) * 2));
    return c;
  });
}

function crane(color) {
  const g = new THREE.Group(), m = std({ color }), dark = std({ color: '#2a3a40' });
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 12, 0.7), m); l.position.set(x, 6, z); l.rotation.set(z * 0.02, 0, -x * 0.02); g.add(l); }
  for (const y of [11.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1, 7.5), m); b.position.y = y; g.add(b); }
  const tur = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4, 4), m); tur.position.y = 14; g.add(tur);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.8), dark); cab.position.set(1.4, 14.6, 2.4); g.add(cab);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), m); mast.position.set(0, 20, 0); g.add(mast);
  const boomG = new THREE.Group(); boomG.position.set(0.5, 15, 0); boomG.rotation.z = 0.95; g.add(boomG);
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.9, 26, 0.9), m); boom.position.y = 13; boomG.add(boom);
  const cw = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), dark); cw.position.set(-2.4, 13.5, 0); g.add(cw);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 14, 4), dark); cable.position.set(0.5 + Math.sin(0.95) * 26 * -1 + 0, 15 + Math.cos(0.95) * 26 - 7, 0); g.add(cable);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export async function build({ renderer, scene, camera }) {
  camera.far = 8000; camera.updateProjectionMatrix();
  const skyC = { top: '#dfe3e8', horizon: '#eef0f2', bottom: '#e0e4e8' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#e8eaed', 0.00028);
  renderer.toneMappingExposure = 0.92;
  scene.add(new THREE.HemisphereLight('#f4f6f8', '#b8bcc0', 2.5));
  const sun = makeSun(scene, { color: '#f4f2ee', intensity: 0.8, dir: [-0.3, 0.8, -0.4], box: 40, mapSize: 2048 });
  const r = rng(6400);

  // terrain: road shelf, slope down to the town, flat town ground
  const tg = new THREE.PlaneGeometry(900, 900, 180, 90); tg.rotateX(-Math.PI / 2);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 330; p.setY(i, gh(x) + (x > 7 && x < 60 ? Math.sin(p.getZ(i) * 0.05) * 0.8 : 0)); } tg.computeVertexNormals(); }
  const terrain = new THREE.Mesh(tg, texMat(snowTex(1, 0.18, [90, 90]))); terrain.position.set(330, 0, -150); terrain.receiveShadow = true; scene.add(terrain);
  // the road we're on (snow-packed asphalt) and its gravel berm
  const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 400), texMat(snowTex(2, 0.12, [4, 120]))); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, -100); road.receiveShadow = true; scene.add(road);
  const rocks = []; for (let i = 0; i < 1600; i++) { const x = 4.2 + (r() < 0.6 ? r() * 1.6 : 12 + r() * 4), z = 20 - r() * 140; const sc = 0.03 + r() * 0.1; rocks.push(mtx(x, gh(x) + 0.02, z, r() * 6, sc, sc * (0.5 + r() * 0.4), r() * 0.3, r() * 0.3)); }
  scene.add(instanced(new THREE.DodecahedronGeometry(1, 0), std({ color: '#55504a', flatShading: true }), rocks));
  // white road posts with black tops
  for (let z = 30; z > -120; z -= 6.5) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 12), std({ color: '#f2f2f0' })); p.position.set(4.6, 0.55, z); p.castShadow = true; scene.add(p);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.18, 12), std({ color: '#141414' })); t.position.set(4.6, 1.02, z); scene.add(t);
  }
  // lower road with a guardrail, halfway down
  const LX = 34, LY = gh(34);
  const lroad = new THREE.Mesh(new THREE.PlaneGeometry(9, 500), texMat(snowTex(3, 0.5, [2, 60]))); lroad.rotation.x = -Math.PI / 2; lroad.position.set(LX, LY + 0.05, -150); lroad.rotation.z = 0; scene.add(lroad);
  const gr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 500), pbr({ color: '#b8bcc0', metalness: 0.7, roughness: 0.35, envMap: env })); gr.position.set(LX + 5, LY + 0.8, -150); scene.add(gr);
  const grp = []; for (let z = 100; z > -400; z -= 4) grp.push(mtx(LX + 5.1, LY + 0.45, z)); scene.add(instanced(new THREE.BoxGeometry(0.12, 0.9, 0.12), std({ color: '#7a7e82' }), grp));
  const lposts = []; for (let z = 100; z > -400; z -= 12) lposts.push(mtx(LX - 5, LY + 0.55, z)); scene.add(instanced(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8), std({ color: '#f0f0ee' }), lposts));

  // ---- the town: 5-storey panel blocks in faded pastel colours ----
  const cols = ['#e8d45a', '#6ac4c0', '#e894b8', '#d8d4c8', '#9cc0e0', '#f0e2c0', '#c8c4bc', '#e8b87a', '#b8e0d0', '#f2f0ea'];
  const texCache = cols.map((c, i) => panelTex(c, 5, 16, 100 + i));
  const roofM = std({ color: '#6a6e72' });
  const blocks = [
    [72, -40, 110, 5], [80, -150, 90, 5], [125, -10, 80, 5], [132, -100, 120, 5], [140, -210, 70, 9], [185, -60, 100, 5],
    [192, -170, 90, 5], [95, 60, 90, 4], [155, 70, 70, 5], [238, -120, 110, 5], [245, 10, 80, 9], [222, -240, 90, 5], [290, -60, 100, 5], [282, -190, 80, 5], [61, -250, 60, 4]
  ];
  blocks.forEach(([x, z, len, fl], i) => {
    const h = fl * 3 + 1, ci = (i * 3) % cols.length;
    const ft = fl === 5 ? texCache[ci] : panelTex(cols[ci], fl, 16, 200 + i);
    ft.repeat.set(len / 60, 1);
    const side = std({ color: cols[ci] });
    const b = new THREE.Mesh(new THREE.BoxGeometry(12, h, len), [side, std({ map: ft }), roofM, roofM, side, side]);
    b.position.set(x, TOWN_Y + h / 2, z); b.rotation.y = (r() - 0.5) * 0.25; b.castShadow = true; b.receiveShadow = true; scene.add(b);
    const rs = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.4, len), std({ color: '#f0f2f4' })); rs.position.set(x, TOWN_Y + h + 0.2, z); rs.rotation.y = b.rotation.y; scene.add(rs);
  });
  // a dark brick boiler house + chimney, a few sheds
  const bh = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 40), std({ color: '#5a5c60' })); bh.position.set(90, TOWN_Y + 6, 60); scene.add(bh);
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 40, 12), std({ color: '#7a7c80' })); ch.position.set(100, TOWN_Y + 20, 40); scene.add(ch);
  for (let i = 0; i < 20; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(6 + r() * 8, 3 + r() * 3, 6 + r() * 10), std({ color: ['#8a8680', '#6a6e72', '#9a7a6a'][i % 3] })); s.position.set(80 + r() * 250, TOWN_Y + 2, -280 + r() * 380); scene.add(s); }

  // ---- the port: cranes along the quay, coal heap ----
  const quay = new THREE.Mesh(new THREE.BoxGeometry(60, 3, 600), std({ color: '#8a8a88' })); quay.position.set(365, TOWN_Y - 1.5, -120); scene.add(quay);
  const craneCols = ['#2e7a8a', '#2a6aa0', '#3a8a9a', '#2e7a8a', '#1e5a8a', '#2e8a7a'];
  [[378, -40], [384, -10], [374, 25], [382, -150], [376, -185], [386, -110]].forEach(([x, z], i) => { const c = crane(craneCols[i]); c.position.set(x, TOWN_Y, z); c.rotation.y = -Math.PI / 2 + (r() - 0.5) * 0.6; scene.add(c); });
  const coal = new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8, 0, 6.29, 0, Math.PI / 2), std({ color: '#1e1e20', flatShading: true })); coal.scale.set(1, 0.3, 1.6); coal.position.set(352, TOWN_Y, 40); scene.add(coal);
  // floodlight masts
  for (const z of [-70, 60, -220]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 30, 8), std({ color: '#9a9ea2' })); m.position.set(356, TOWN_Y + 15, z); scene.add(m); }

  // ---- frozen bay and the snowy plateau across it ----
  const ice = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), texMat(snowTex(9, 0, [60, 60]))); ice.rotation.x = -Math.PI / 2; ice.position.set(4895, TOWN_Y - 1, 0); scene.add(ice);
  const hg = new THREE.PlaneGeometry(1000, 12000, 60, 300); hg.rotateX(-Math.PI / 2);
  const hn = Noise(11);
  { const p = hg.attributes.position; const cols2 = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); const front = clamp((x + 500) / 250);
      let h = 160 * front * (0.75 + 0.35 * hn.fbm(z / 12000 + 0.5, x / 1000 + 0.5, 6, 4));
      const gully = hn.vn(z / 45, x / 120, 256);
      h -= gully * 30 * front;
      p.setY(i, h);
      const dark = gully > 0.62 && front > 0.2 && front < 0.95 ? 0.55 : 1;
      cols2[i * 3] = 0.95 * dark; cols2[i * 3 + 1] = 0.96 * dark; cols2[i * 3 + 2] = 0.98 * dark;
    }
    hg.setAttribute('color', new THREE.BufferAttribute(cols2, 3)); hg.computeVertexNormals(); }
  const hills = new THREE.Mesh(hg, std({ vertexColors: true, flatShading: true })); hills.position.set(2900, TOWN_Y - 1, -1500); hills.rotation.y = 0.12; scene.add(hills);

  // camera: moving along the upper road, looking out over the town
  const pts = [[1.0, 0, 8], [1.0, 0, -8]];
  const yaw = kf([[0, -1.12], [2.5, -1.2], [5, -1.28]]);
  const pitch = kf([[0, -0.2], [5, -0.17]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.7, bob: 0.01, stride: 0.8, lookAhead: 5, ease: 0.3, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => { cam(t); sun.follow(camera.position); };
}
