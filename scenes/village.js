import {
  THREE, rng, Noise, pixTex, peelTex, concreteTex, dirtTex, tileTex, textTex, glowTex, softTex, texMat, std, pbr, makeSky, envFrom, makeSun,
  pathCam, kf, Smoke, person, loudspeakerPole, wire, instanced, mtx, poplarGeos, poplarBark, solarHeater, cornString, palmFan, thermos, stool, mix3
} from '../lib.js';

export const DUR = 15;

function cornTex(seed = 5) {
  const r = rng(seed);
  return pixTex(256, 256, (u, v) => {
    const row = Math.floor(v * 40), cu = u * 22 + (row % 2) * 0.5, cv = v * 40, fu = cu % 1, fv = cv % 1;
    const d = Math.hypot(fu - 0.5, (fv - 0.5) * 0.9);
    const k = d > 0.5 ? 0.35 : 1.2 - d * 1.2;
    const hue = Math.sin(Math.floor(cu) * 12.3 + Math.floor(cv) * 7.1) * 0.5 + 0.5;
    const base = mix3([226, 160, 40], [205, 120, 30], hue);
    return [base[0] * k, base[1] * k, base[2] * k];
  }, { repeat: [4, 3] });
}

function gateTex(char = '福', seed = 1) {
  const n = Noise(seed);
  return pixTex(512, 512, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    const panel = (Math.abs(u - 0.5) < 0.006) ? 0.5 : 1;
    const rib = (Math.floor(v * 10) % 2 === 0 && (v * 10) % 1 < 0.08) ? 0.8 : 1;
    const rust = a > 0.68 ? [110, 60, 40] : [168, 32, 28];
    const k = panel * rib * (0.85 + a * 0.3);
    return [rust[0] * k, rust[1] * k, rust[2] * k];
  }, {
    post: (ctx, w, h) => {
      for (const cx of [w * 0.25, w * 0.75]) {
        ctx.fillStyle = '#c7a24a'; ctx.beginPath(); ctx.arc(cx, h * 0.45, 70, 0, 6.28); ctx.fill();
        ctx.strokeStyle = '#e7d9b0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, h * 0.45, 50, 0, 6.28); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, h * 0.45, 22, 0, 6.28); ctx.stroke();
        // door studs
        ctx.fillStyle = '#d0a850';
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(cx - 60 + j * 60, h * 0.75 + i * 26 - 20, 6, 0, 6.28); ctx.fill(); }
      }
    }
  });
}

export async function build({ renderer, scene, camera }) {
  const skyC = { top: '#a8b0b4', horizon: '#d8cfbb', bottom: '#c9bea8' };
  makeSky(scene, skyC);
  const env = envFrom(renderer, skyC);
  scene.fog = new THREE.FogExp2('#cfc6b2', 0.022);
  renderer.toneMappingExposure = 1.05;
  scene.add(new THREE.HemisphereLight('#dfe0da', '#806e56', 1.6));
  const sunDir = [0.8, 0.38, -0.25];
  const sun = makeSun(scene, { color: '#ffd9a8', intensity: 2.8, dir: sunDir, box: 32, mapSize: 1536 });
  const r = rng(77);
  const soft = softTex();

  // lane ground with sunflower seed shells + cigarette butts
  const laneT = dirtTex({ seed: 21, color: '#8b806e', repeat: [20, 80], shells: 70, butts: 2 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(40, 160), texMat(laneT));
  lane.rotation.x = -Math.PI / 2; lane.position.z = -50; lane.receiveShadow = true; scene.add(lane);
  // extra-dense shell patch where the men squat
  const shellT = dirtTex({ seed: 22, color: '#8b806e', repeat: [2, 3], shells: 520, butts: 12 });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), texMat(shellT, { transparent: false }));
  patch.rotation.x = -Math.PI / 2; patch.position.set(1.9, 0.005, -17); patch.receiveShadow = true; scene.add(patch);

  const facade = tileTex({ seed: 3, repeat: [3, 2], cols: 10, rows: 22, dirt: 0.45 });
  const facadeMat = texMat(facade);
  const glass = pbr({ color: '#4d90b8', metalness: 0.85, roughness: 0.08, envMap: env, envMapIntensity: 1.4 });
  const frameMat = std({ color: '#d9d9d4' });
  const wallT = peelTex({ seed: 8, top: '#e4ddcc', under: '#8f8778', band: { color: '#8c8a84', from: 0.62 }, repeat: [2, 1], peel: 0.66 });
  const wallMat = texMat(wallT);
  const capMat = std({ color: '#7d7a73' });
  const roofTileT = pixTex(256, 256, (u, v) => { const k = 0.75 + 0.25 * Math.abs(Math.sin(u * Math.PI * 12)) - ((v * 16) % 1 < 0.12 ? 0.2 : 0); return [92 * k, 94 * k, 98 * k]; }, { repeat: [6, 2] });
  const roofMat = texMat(roofTileT);
  const cornMat = texMat(cornTex());
  const smokes = [];
  const fu = ['福', '福', '囍', '福'];
  const couplet = [['春回大地风光好', '福满人间喜事多'], ['天增岁月人增寿', '春满乾坤福满门'], ['一帆风顺年年好', '万事如意步步高']];

  const buildLot = (side, z, idx) => {
    const X = side * 2.7; // lane edge
    const type = idx % 3 === 1 ? 'A' : 'B';
    const g = new THREE.Group(); g.position.set(X, 0, z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(g);
    // local frame: +z points into lane, x along lane, -z back into lot
    const L = 13;
    if (type === 'A') {
      const H = 6.6, D = 10;
      const body = new THREE.Mesh(new THREE.BoxGeometry(L, H, D), [std({ color: '#cfcac0' }), std({ color: '#cfcac0' }), std({ color: '#bdb8ad' }), std({ color: '#bdb8ad' }), facadeMat, std({ color: '#cfcac0' })]);
      body.position.set(0, H / 2, -D / 2); body.castShadow = body.receiveShadow = true; g.add(body);
      const par = new THREE.Mesh(new THREE.BoxGeometry(L + 0.2, 0.5, 0.25), capMat); par.position.set(0, H + 0.25, 0); par.castShadow = true; g.add(par);
      // windows
      for (const [wx, wy, ww, wh] of [[-3.8, 4.6, 2.2, 1.6], [0, 4.6, 2.2, 1.6], [3.8, 4.6, 2.2, 1.6], [0.8, 1.7, 2.6, 1.7], [4.4, 1.7, 1.8, 1.7]]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), glass); w.position.set(wx, wy, 0.02); g.add(w);
        const f1 = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.12, 0.08, 0.08), frameMat); f1.position.set(wx, wy + wh / 2, 0.04); g.add(f1);
        const f2 = f1.clone(); f2.position.y = wy - wh / 2; g.add(f2);
        const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.06, wh, 0.06), frameMat); f3.position.set(wx, wy, 0.04); g.add(f3);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.3, 0.06, 0.2), capMat); sill.position.set(wx, wy - wh / 2 - 0.05, 0.1); g.add(sill);
      }
      // floor band
      const band = new THREE.Mesh(new THREE.BoxGeometry(L, 0.2, 0.2), capMat); band.position.set(0, 3.3, 0.1); band.castShadow = true; g.add(band);
      // gate on the ground floor left
      const gate = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), texMat(gateTex(fu[idx % 4], idx + 3))); gate.position.set(-3.6, 1.2, 0.03); g.add(gate);
      // solar heater(s) on roof
      const sh = solarHeater(idx); sh.position.set(-2 + (r() - 0.5) * 3, H, -3); sh.rotation.y = Math.PI; g.add(sh);
      const sh2 = solarHeater(idx + 9); sh2.position.set(3, H, -5); sh2.rotation.y = Math.PI; g.add(sh2);
      // corn drying on the roof edge
      for (let k = 0; k < 3; k++) { const pile = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6, 0, 6.29, 0, 1.3), cornMat); pile.scale.set(1.4, 0.45, 1); pile.position.set(-5 + k * 2.4, H - 0.15, -1.3); pile.castShadow = true; g.add(pile); }
      // corn strings hanging under the floor band
      for (let k = 0; k < 7; k++) { const c = cornString(1.5 + r() * 0.6, idx * 10 + k); c.position.set(-5.8 + k * 0.28, 3.15, 0.25); g.add(c); }
    } else {
      // courtyard wall + gate + pitched-roof house behind
      const WH = 2.5;
      const wallGeoL = new THREE.BoxGeometry(L / 2 - 1.5, WH, 0.3);
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(wallGeoL, wallMat); w.position.set(sx * (L / 4 + 0.75), WH / 2, 0); w.castShadow = w.receiveShadow = true; g.add(w);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(L / 2 - 1.5, 0.12, 0.45), capMat); cap.position.set(sx * (L / 4 + 0.75), WH + 0.06, 0); g.add(cap);
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), facadeMat); pil.position.set(sx * 1.5, 1.6, 0.05); pil.castShadow = true; g.add(pil);
        const cp = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 2.2), texMat(textTex([couplet[idx % 3][sx > 0 ? 0 : 1]], { w: 64, h: 512, vertical: true, color: '#1d1a18', under: '#b92a22', font: '900 50px "Noto Sans CJK SC"', fade: 0.45, peel: 0.72, seed: idx * 3 + sx })));
        cp.position.set(sx * 1.5, 1.8, 0.31); g.add(cp);
      }
      const roofG = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.0), roofMat); roofG.position.set(0, 3.25, 0.1); roofG.rotation.x = 0.15; roofG.castShadow = true; g.add(roofG);
      const gate = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.6), texMat(gateTex(fu[(idx + 1) % 4], idx + 7))); gate.position.set(0, 1.3, -0.02); g.add(gate);
      const lintel = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.35), texMat(textTex(['出入平安'], { w: 512, h: 72, color: '#1d1a18', under: '#b92a22', font: '900 54px "Noto Sans CJK SC"', fade: 0.4, peel: 0.75, seed: idx }))); lintel.position.set(0, 2.85, 0.28); g.add(lintel);
      // old wall slogan, painted over (red ghosting through whitewash, no legible lettering)
      if (idx % 4 === 0 || idx % 4 === 2) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), texMat(textTex([idx % 4 ? 'xxxxxxx' : 'xxx xxx'], { w: 1024, h: 220, color: '#a8231c', under: '#e2dccb', fade: 0.3, peel: 0.63, seed: 90 + idx })));
        s.position.set(-3.6, 1.6, 0.16); g.add(s);
      }
      // house behind courtyard
      const hz = -7.5, HH = 3.3;
      const house = new THREE.Mesh(new THREE.BoxGeometry(L - 0.5, HH, 5.5), [std({ color: '#b9b2a4' }), std({ color: '#b9b2a4' }), std({ color: '#b9b2a4' }), std({ color: '#b9b2a4' }), facadeMat, std({ color: '#b9b2a4' })]);
      house.position.set(0, HH / 2, hz); house.castShadow = house.receiveShadow = true; g.add(house);
      const tri = new THREE.Shape(); tri.moveTo(-3.2, 0); tri.lineTo(3.2, 0); tri.lineTo(0, 1.7); tri.lineTo(-3.2, 0);
      const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: L, bevelEnabled: false }); roofGeo.rotateY(Math.PI / 2); roofGeo.translate(-L / 2, 0, 0);
      const roof = new THREE.Mesh(roofGeo, roofMat); roof.position.set(0, HH, hz); roof.castShadow = true; g.add(roof);
      const sh = solarHeater(idx + 30); sh.position.set(2.5, HH + 0.9, hz + 1.3); sh.rotation.y = Math.PI; sh.scale.setScalar(0.95); g.add(sh);
      // chimney + cooking smoke
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, 0.45), std({ color: '#7b5a48' })); ch.position.set(-3.5, HH + 1.3, hz + 0.6); ch.castShadow = true; g.add(ch);
      g.updateMatrixWorld(true);
      const cw = new THREE.Vector3(-3.5, HH + 2.15, hz + 0.6).applyMatrix4(g.matrixWorld);
      smokes.push(new Smoke(scene, { origin: [cw.x, cw.y, cw.z], count: 40, life: 11, rise: 1.0, grow: 7, size: 1.0, color: '#d2cec6', opacity: 0.7, wind: [-0.18, 0, -0.05], spread: 0.15, seed: idx + 5, tex: soft }));
      // corn column stacked by the wall (玉米垛)
      if (idx % 2 === 0) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 2.8, 16), cornMat); col.position.set(4.9, 1.4, 0.75); col.castShadow = true; g.add(col);
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.4, 16), cornMat); top.position.set(4.9, 3.0, 0.75); g.add(top);
      } else {
        for (let k = 0; k < 6; k++) { const c = cornString(1.4 + r() * 0.5, idx * 20 + k); c.position.set(3.2 + k * 0.3, 2.55, 0.28); g.add(c); }
      }
    }
  };
  let idx = 0;
  for (let z = 10; z > -90; z -= 13.6) { buildLot(-1, z, idx++); buildLot(1, z - 5, idx++); }

  // poplars behind the houses
  const H = 17; const bark = poplarBark(H, 1.2); const barkMat = std({ map: bark }); const crownMat = std({ vertexColors: true, flatShading: true });
  const tp = poplarGeos(201, H, { crownColor: '#5b6a40', width: 1.2, crownStart: 0.35 }); const tms = [];
  for (let i = 0; i < 40; i++) { const s = r() < 0.5 ? -1 : 1; tms.push(mtx(s * (19 + r() * 8), 0, 10 - r() * 100, r() * 6, 0.8 + r() * 0.35)); }
  scene.add(instanced(tp.trunk, barkMat, tms)); scene.add(instanced(tp.crown, crownMat, tms));

  // squatting men against the sunlit wall (left side, x<0 is in sun)
  const men = [
    person({ pose: 'squat', shirt: '#e6e1d3', pants: '#2b2f3a', cig: true, sleeves: 'none', arm: 'mouth' }),
    person({ pose: 'squat', shirt: '#56606c', pants: '#2e2e2e', cig: true, bald: true, sleeves: 'short' }),
    person({ pose: 'squat', shirt: '#2f3b4c', pants: '#1f2430', hair: '#8a8580' }),
  ];
  const menPos = [[-2.25, -15.5, 1.3], [-2.2, -16.6, 1.6], [-2.35, -17.9, 1.4]];
  men.forEach((m, i) => { m.position.set(menPos[i][0], 0, menPos[i][1]); m.rotation.y = menPos[i][2]; scene.add(m); });
  const cig = men.filter((m) => m.userData.ember).map((m, i) => { m.updateMatrixWorld(true); const p = new THREE.Vector3(); m.userData.ember.getWorldPosition(p); return new Smoke(scene, { origin: [p.x, p.y, p.z], count: 16, life: 4, rise: 0.22, grow: 5, size: 0.08, color: '#e0ddd8', opacity: 0.35, wind: [0.05, 0, 0.08], spread: 0.02, seed: 70 + i, tex: soft }); });
  // stool with palm fan and thermos, enamel mug
  const st = stool(); st.position.set(-2.2, 0, -19.2); scene.add(st);
  const fan = palmFan(); fan.position.set(-2.2, 0.29, -19.2); fan.rotation.set(-Math.PI / 2, 0, 0.6); scene.add(fan);
  const th = thermos('#c23b2c'); th.position.set(-2.35, 0, -14.5); scene.add(th);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 12), std({ color: '#efece2' })); mug.position.set(-2.1, 0.33, -19.1); mug.castShadow = true; scene.add(mug);
  const mugRim = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 4, 16), std({ color: '#274a8a' })); mugRim.rotation.x = Math.PI / 2; mugRim.position.set(-2.1, 0.375, -19.1); scene.add(mugRim);
  // old man sitting on a low stool across, fanning
  const sitter = person({ pose: 'sitLow', shirt: '#f0ede4', pants: '#34343c', hair: '#bdbab4', sleeves: 'none', arm: 'fan' }); sitter.scale.setScalar(0.95); sitter.position.set(2.15, 0, -24); sitter.rotation.y = -Math.PI / 2 + 0.3; scene.add(sitter);
  const st2 = stool('#5a3d22'); st2.position.set(2.2, 0, -24.1); st2.scale.setScalar(1.1); scene.add(st2);
  const fan2 = palmFan(); fan2.position.set(0, 0.3, 0.02); fan2.rotation.y = Math.PI / 2; sitter.userData.handR.add(fan2);
  // children, unattended
  const kid = person({ pose: 'stand', shirt: '#c43a2e', pants: '#2e3f78', scale: 0.62 }); kid.position.set(0.3, 0, -40); kid.rotation.y = 0.05; scene.add(kid);
  const kid2 = person({ pose: 'squat', shirt: '#e8c64c', pants: '#3a3a44', scale: 0.62 }); kid2.position.set(1.4, 0, -33); kid2.rotation.y = 2.5; scene.add(kid2);
  const bike = new THREE.Group();
  const tire = std({ color: '#141414' });
  for (const z of [-0.55, 0.55]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 6, 20), tire); w.position.set(0, 0.35, z); w.rotation.y = Math.PI / 2; bike.add(w); }
  const fr = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 1.0), std({ color: '#1c1c1c' })); fr.position.set(0, 0.62, 0); bike.add(fr);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.025, 0.025), std({ color: '#888' })); hb.position.set(0, 0.95, -0.5); bike.add(hb);
  bike.position.set(2.45, 0, -9); bike.rotation.z = 0.12; bike.traverse((o) => o.castShadow = true); scene.add(bike);

  // loudspeaker pole + wires across the lane
  const lp = loudspeakerPole({ h: 7.5 }); lp.position.set(-2.4, 0, -29); scene.add(lp);
  const pm = texMat(concreteTex({ seed: 44, size: 128, cracks: 2 }));
  for (const z of [-2, -56]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7.5, 8), pm); p.position.set(2.45, 3.75, z); p.castShadow = true; scene.add(p); }
  wire(scene, [-2.4, 7.1, -29], [2.45, 7.3, -2], 0.9); wire(scene, [-2.4, 7.0, -29], [2.45, 7.2, -56], 0.9);
  wire(scene, [-2.4, 6.8, -29], [2.45, 7.0, -2], 1.1); wire(scene, [2.45, 7.1, -2], [8, 6.9, 12], 0.6);
  wire(scene, [-2.4, 6.9, -29], [-9, 6.6, -40], 0.5);

  const pts = [[0.2, 0, 6], [0.3, 0, -4], [0.1, 0, -14], [0.0, 0, -24], [0, 0, -30]];
  const yaw = kf([[0, 0.0], [2, 0.08], [4.5, 0.55], [7.5, 0.9], [9.5, 0.3], [11, -0.35], [12.5, -0.2], [15, 0.0]]);
  const pitch = kf([[0, 0.05], [4.5, -0.05], [7.5, -0.2], [9.5, -0.05], [11, -0.05], [15, 0.0]]);
  const cam = pathCam(camera, pts, DUR, { eye: 1.65, bob: 0.018, stride: 0.75, lookAhead: 5, look: (t) => ({ yaw: yaw(t), pitch: pitch(t) }) });
  return (t) => {
    cam(t);
    sun.follow(camera.position);
    smokes.forEach((s) => s.update(t)); cig.forEach((s) => s.update(t));
    // old man fanning
    const a = Math.sin(t * 5.2) * 0.35;
    sitter.userData.handR.rotation.set(0.15, a, -0.25);
  };
}
