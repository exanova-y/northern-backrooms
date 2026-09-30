import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, mergeGeometries };

// ---------- deterministic randomness ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function Noise(seed) {
  const N = 256, r = rng(seed), g = new Float32Array(N * N);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[(y & 255) * N + (x & 255)];
  function vn(x, y, per = 256) {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const m = (v) => ((v % per) + per) % per;
    const a = at(m(x0), m(y0)), b = at(m(x0 + 1), m(y0)), c = at(m(x0), m(y0 + 1)), d = at(m(x0 + 1), m(y0 + 1));
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }
  function fbm(u, v, base = 4, oct = 5, gain = 0.5) {
    let s = 0, a = 1, n = 0, f = base;
    for (let o = 0; o < oct; o++) { s += a * vn(u * f, v * f, f); n += a; a *= gain; f *= 2; }
    return s / n;
  }
  return { vn, fbm };
}

// ---------- textures ----------
// fn(u,v,x,y) -> [r,g,b] (0..255) or [r,g,b,a]
export function pixTex(w, h, fn, { repeat = [1, 1], srgb = true, post = null, alpha = false } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (fn) {
    const img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = fn(x / w, y / h, x, y), i = (y * w + x) * 4;
      d[i] = p[0]; d[i + 1] = p[1]; d[i + 2] = p[2]; d[i + 3] = p.length > 3 ? p[3] : 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  if (post) post(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.userData.canvas = c;
  return t;
}
const hex = (h) => { const n = new THREE.Color(h).getHex(); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// peeling paint: top paint over under-layer, with stains
export function peelTex({ seed = 1, top = '#e9e3d2', under = '#a89c86', stain = '#6b5a3e', peel = 0.62, stainAmt = 0.5, size = 512, repeat = [1, 1], grime = 0.12, band = null } = {}) {
  const n = Noise(seed), n2 = Noise(seed + 7), T = hex(top), U = hex(under), S = hex(stain);
  const B = band ? hex(band.color) : null;
  return pixTex(size, size, (u, v) => {
    let base = T;
    if (B && v > band.from) base = B;
    const p = n.fbm(u, v, 4, 6);
    let c = p > peel ? mix3(U, mul3(U, 0.8), n2.fbm(u, v, 16, 3)) : base;
    // edge of peel darker line
    if (Math.abs(p - peel) < 0.012) c = mul3(c, 0.75);
    const s = n2.fbm(u + 0.3, v * 0.5, 2, 5);
    const drip = n.vn(u * 40, v * 3, 40);
    c = mix3(c, S, clamp((s - 0.55) * 2.2) * stainAmt * (0.6 + 0.4 * drip));
    const g = 1 - grime + grime * n.fbm(u, v, 32, 3) * 2;
    return mul3(c, clamp(g, 0.6, 1.1));
  }, { repeat });
}

export function concreteTex({ seed = 3, color = '#9c978c', size = 512, repeat = [1, 1], cracks = 14, moss = 0 } = {}) {
  const n = Noise(seed), C = hex(color), r = rng(seed + 1);
  return pixTex(size, size, (u, v) => {
    const a = n.fbm(u, v, 4, 6), b = n.fbm(u, v, 64, 2);
    let c = mul3(C, 0.75 + a * 0.5 + (b - 0.5) * 0.15);
    if (moss) c = mix3(c, [70, 80, 45], clamp((n.fbm(u + 0.5, v, 3, 4) - 0.6) * 4) * moss);
    return c;
  }, {
    repeat, post: (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(30,28,24,0.55)';
      for (let k = 0; k < cracks; k++) {
        let x = r() * w, y = r() * h, ang = r() * 6.28; ctx.lineWidth = 0.6 + r() * 1.4; ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 30; s++) { ang += (r() - 0.5) * 0.9; x += Math.cos(ang) * 6; y += Math.sin(ang) * 6; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
  });
}

export function asphaltTex({ seed = 5, size = 512, repeat = [1, 1], color = '#4a4845' } = {}) {
  const n = Noise(seed), r = rng(seed), C = hex(color);
  return pixTex(size, size, (u, v) => {
    const a = n.fbm(u, v, 4, 5), g = r();
    let c = mul3(C, 0.8 + a * 0.45 + (g - 0.5) * 0.25);
    const tar = n.fbm(u + 0.2, v + 0.7, 3, 4);
    if (tar > 0.66) c = mul3(c, 0.7);
    return c;
  }, {
    repeat, post: (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(20,20,20,0.45)';
      for (let k = 0; k < 6; k++) {
        let x = r() * w, y = r() * h, ang = r() * 6.28; ctx.lineWidth = 0.6 + r() * 0.6; ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 25; s++) { ang += (r() - 0.5) * 1.1; x += Math.cos(ang) * 5; y += Math.sin(ang) * 5; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    }
  });
}

// ground litter: seed shells, red firecracker paper, etc.
export function litter(ctx, w, h, seed, count, kind) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, a = r() * 6.28;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (kind === 'shell') {
      const L = 4 + r() * 3;
      ctx.fillStyle = r() < 0.8 ? '#1c1a18' : '#d8d2c0';
      ctx.beginPath(); ctx.ellipse(0, 0, L, L * 0.42, 0, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(230,225,210,0.8)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(-L * 0.8, -1); ctx.lineTo(L * 0.8, -1); ctx.moveTo(-L * 0.7, 1); ctx.lineTo(L * 0.7, 1); ctx.stroke();
    } else if (kind === 'red') {
      const s = 3 + r() * 7;
      const reds = ['#c21a14', '#a3140f', '#d9261b', '#8c1410', '#e0c9a8'];
      ctx.fillStyle = reds[Math.floor(r() * reds.length)];
      ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
    } else if (kind === 'butt') {
      ctx.fillStyle = '#e8dfc8'; ctx.fillRect(-4, -1.3, 6, 2.6); ctx.fillStyle = '#c98a3e'; ctx.fillRect(2, -1.3, 3, 2.6);
    } else if (kind === 'leaf') {
      ctx.fillStyle = r() < 0.5 ? '#6a6a30' : '#8a7a3a'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 3, 0, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }
}

export function dirtTex({ seed = 9, size = 512, repeat = [1, 1], color = '#8a7a62', shells = 0, red = 0, butts = 0, leaves = 0 } = {}) {
  const n = Noise(seed), C = hex(color), r = rng(seed + 3);
  return pixTex(size, size, (u, v) => {
    const a = n.fbm(u, v, 4, 6), g = r();
    return mul3(C, 0.75 + a * 0.45 + (g - 0.5) * 0.18);
  }, {
    repeat, post: (ctx, w, h) => {
      if (leaves) litter(ctx, w, h, seed + 40, leaves, 'leaf');
      if (shells) litter(ctx, w, h, seed + 10, shells, 'shell');
      if (butts) litter(ctx, w, h, seed + 20, butts, 'butt');
      if (red) litter(ctx, w, h, seed + 30, red, 'red');
    }
  });
}

export function tileTex({ seed = 11, size = 512, repeat = [1, 1], cols = 8, rows = 16, color = '#ecebe6', grout = '#9a978f', dirt = 0.35 } = {}) {
  const n = Noise(seed), r = rng(seed), C = hex(color), G = hex(grout);
  const jit = []; for (let i = 0; i < cols * rows; i++) jit.push(0.94 + r() * 0.08);
  return pixTex(size, size, (u, v) => {
    const cu = u * cols, cv = v * rows, fu = cu % 1, fv = cv % 1;
    const idx = Math.floor(cv) * cols + Math.floor(cu);
    let c = (fu < 0.05 || fv < 0.08) ? G : mul3(C, jit[idx]);
    // streaks down from top (rain dirt)
    const streak = n.vn(u * 60, v * 1.5, 60) * n.fbm(u, v, 2, 3);
    c = mix3(c, [120, 110, 90], clamp(streak * dirt * 1.6 * (1 - v * 0.3)));
    return c;
  }, { repeat });
}

export function rustTex({ seed = 13, size = 256, repeat = [1, 1], paint = '#3f6a8a', rust = 0.5 } = {}) {
  const n = Noise(seed), P = hex(paint);
  return pixTex(size, size, (u, v) => {
    const a = n.fbm(u, v, 4, 6);
    const R = mix3([110, 55, 25], [70, 35, 20], n.fbm(u, v, 32, 2));
    return a > 1 - rust ? R : mul3(P, 0.85 + 0.25 * a);
  }, { repeat });
}

export function textTex(lines, { w = 1024, h = 256, bg = null, color = '#b3261e', font = '900 180px "Noto Sans CJK SC"', fade = 0.35, seed = 17, under = '#d9d2c0', peel = 0.7, repeat = [1, 1], align = 'center', vertical = false } = {}) {
  const n = Noise(seed), U = hex(under);
  const bgTex = bg;
  return pixTex(w, h, (u, v) => {
    const a = n.fbm(u, v, 4, 5);
    return mul3(U, 0.8 + 0.3 * a);
  }, {
    repeat, post: (ctx) => {
      // no lettering: a slogan that was painted over, red ghosting through the whitewash in blocks
      const rr = rng(seed + 5);
      const block = (cx, cy, bw, bh) => {
        ctx.globalAlpha = 0.5 + rr() * 0.3; ctx.fillStyle = color;
        ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
        ctx.globalAlpha = 0.55 + rr() * 0.3; ctx.fillStyle = under;
        for (let k = 0; k < 5; k++) ctx.fillRect(cx - bw / 2 + rr() * bw * 0.7, cy - bh / 2 + rr() * bh * 0.7, bw * (0.2 + rr() * 0.4), bh * (0.15 + rr() * 0.3));
        ctx.globalAlpha = 1;
      };
      if (vertical) {
        const n = [...lines[0]].length; const step = h / n;
        for (let i = 0; i < n; i++) block(w / 2, step * (i + 0.5), w * 0.7, step * 0.72);
      } else {
        lines.forEach((ln, li) => { const n = [...ln.replace(/ /g, '')].length; const cy = h * (li + 0.5) / lines.length, bh = Math.min(h / lines.length * 0.7, (w * 0.86) / n * 0.85); const step = (w * 0.86) / n;
          for (let i = 0; i < n; i++) block(w * 0.07 + step * (i + 0.5), cy, step * 0.82, bh); });
      }
      // fade / peel the text
      const img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, a = n.fbm(x / w, y / h, 8, 5);
        const k = a > peel ? 1 : fade * (0.6 + 0.8 * n.vn(x / 9, y / 9));
        d[i] = lerp(d[i], U[0] * (0.8 + 0.3 * a), k); d[i + 1] = lerp(d[i + 1], U[1] * (0.8 + 0.3 * a), k); d[i + 2] = lerp(d[i + 2], U[2] * (0.8 + 0.3 * a), k);
      }
      ctx.putImageData(img, 0, 0);
    }
  });
}

export function softTex(size = 128, seed = 21) {
  const n = Noise(seed);
  return pixTex(size, size, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
    const a = clamp(1 - r) ** 1.6 * (0.55 + 0.45 * n.fbm(u, v, 4, 4));
    return [255, 255, 255, a * 255];
  }, { srgb: false });
}
export function glowTex(size = 64) {
  return pixTex(size, size, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5, r = Math.sqrt(dx * dx + dy * dy) * 2;
    const a = clamp(1 - r) ** 2.2;
    return [255, 255, 255, a * 255];
  }, { srgb: false });
}

// ---------- materials ----------
export const pbr = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
export const std = (o = {}) => { const { roughness, metalness, envMapIntensity, ...rest } = o; return new THREE.MeshLambertMaterial(rest); };
export function texMat(tex, o = {}) { return std({ map: tex, ...o }); }

// ---------- sky ----------
export function makeSky(scene, { top = '#b8b6ad', horizon = '#cfc6b0', bottom = '#b5ab96', radius = 900 } = {}) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(horizon) }, bot: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top,hor,bot; varying vec3 vP; void main(){ float h=vP.y; vec3 c = h>0.0 ? mix(hor, top, pow(clamp(h,0.0,1.0),0.6)) : mix(hor, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor=vec4(c,1.0);
      #include <colorspace_fragment>
    }`
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = -10; m.frustumCulled = false;
  scene.add(m);
  return m;
}

export function envFrom(renderer, colors) {
  const s = new THREE.Scene(); makeSky(s, { ...colors, radius: 10 });
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.02);
  return rt.texture;
}

// ---------- app ----------
export function setup({ w = 1280, h = 720, fov = 70, aa = true, soft = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: aa, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(w, h);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, w / h, 0.05, 1200);
  return { renderer, scene, camera, THREE };
}

// sun with shadow box that follows camera
export function makeSun(scene, { color = '#fff2dc', intensity = 1.6, dir = [0.5, 0.8, 0.3], box = 40, mapSize = 2048 } = {}) {
  const l = new THREE.DirectionalLight(color, intensity);
  l.castShadow = true; l.shadow.mapSize.set(mapSize, mapSize);
  const c = l.shadow.camera; c.left = -box; c.right = box; c.top = box; c.bottom = -box; c.near = 1; c.far = 400;
  l.shadow.bias = -0.0005; l.shadow.normalBias = 0.03; l.shadow.radius = 4;
  const d = new THREE.Vector3(...dir).normalize();
  scene.add(l); scene.add(l.target);
  l.follow = (p) => { l.target.position.copy(p); l.position.copy(p).addScaledVector(d, 150); };
  return l;
}

// camera along path, constant speed with eased start/end
export function pathCam(camera, pts, dur, { eye = 1.65, bob = 0.02, stride = 1.5, look = null, lookAhead = 4, ease = 1.2 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1] ?? 0, p[2])), false, 'centripetal');
  const L = curve.getLength();
  const tmp = new THREE.Vector3(), tgt = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  return (t) => {
    // eased time -> distance
    const e = ease / dur;
    let s;
    const f = (x) => { // piecewise: accel over `ease` seconds, cruise, decel
      const a = ease, T = dur; const v = 1 / (T - a);
      if (x < a) return v * x * x / (2 * a);
      if (x > T - a) { const y = T - x; return 1 - v * y * y / (2 * a); }
      return v * (x - a / 2);
    };
    s = clamp(f(clamp(t, 0, dur)));
    curve.getPointAt(s, tmp);
    const dist = s * L;
    camera.position.set(tmp.x, tmp.y + eye + Math.sin(dist / stride * Math.PI) * bob, tmp.z);
    const s2 = Math.min(1, s + lookAhead / L);
    curve.getPointAt(s2, tgt);
    if (s2 >= 1) { const tan = curve.getTangentAt(1); tgt.copy(tmp).addScaledVector(tan, lookAhead); }
    tgt.y = tmp.y + eye;
    camera.lookAt(tgt);
    if (look) {
      const { yaw = 0, pitch = 0, roll = 0 } = look(t);
      camera.rotateOnWorldAxis(Y, yaw); camera.rotateX(pitch); camera.rotateZ(roll);
    }
    return s;
  };
}
// keyframe helper: kf([[t,val],...])(t) smooth interpolation
export function kf(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t <= t1) return lerp(v0, v1, smooth(t0, t1, t));
    }
    return keys[keys.length - 1][1];
  };
}

// ---------- smoke ----------
export class Smoke {
  constructor(scene, { origin, count = 40, life = 8, rise = 0.8, grow = 3, size = 0.6, color = '#bdb8b0', opacity = 0.35, wind = [0.3, 0, 0], spread = 0.2, seed = 1, tex, light = true, dim = 1 }) {
    this.o = new THREE.Vector3(...origin); this.p = []; this.life = life; this.rise = rise; this.grow = grow; this.size = size; this.opacity = opacity; this.wind = new THREE.Vector3(...wind); this.spread = spread;
    const r = rng(seed);
    this.group = new THREE.Group(); scene.add(this.group);
    for (let i = 0; i < count; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, opacity: 0, fog: true, rotation: r() * 6.28 });
      const s = new THREE.Sprite(m); this.group.add(s);
      this.p.push({ s, ph: i / count, jx: (r() - 0.5), jz: (r() - 0.5), sw: r() * 6.28, spin: (r() - 0.5) * 0.3, k: 0.7 + r() * 0.6 });
    }
    this.enabled = true;
  }
  update(t, rate = 1) {
    for (const q of this.p) {
      const age = ((t / this.life + q.ph + 3) % 1);
      const a = age * this.life;
      const s = q.s;
      s.position.set(
        this.o.x + this.wind.x * a * a * 0.25 + q.jx * this.spread * (1 + a) + Math.sin(a * 0.8 + q.sw) * 0.15 * a,
        this.o.y + this.rise * a * (1 - age * 0.3),
        this.o.z + this.wind.z * a * a * 0.25 + q.jz * this.spread * (1 + a));
      const sc = this.size * (0.4 + this.grow * age) * q.k;
      s.scale.set(sc, sc, 1);
      s.material.opacity = this.opacity * smooth(0, 0.1, age) * (1 - smooth(0.45, 1, age)) * rate;
      s.material.rotation += 0; s.material.rotation = q.sw + q.spin * a;
      s.visible = this.enabled && s.material.opacity > 0.003;
    }
  }
}

// ---------- people (low poly, faceless, joint-based so limbs always connect) ----------
const _Y = new THREE.Vector3(0, 1, 0);
function limb(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = new THREE.Vector3().subVectors(B, A), L = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, L), 3, 8), mat);
  m.position.copy(A).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_Y, d.normalize());
  return m;
}
function ball(p, r, mat) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat); m.position.set(...p); return m; }
function shoe(ankle, mat, yaw = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.25), mat);
  m.position.set(ankle[0] + Math.sin(yaw) * 0.06, 0.035, ankle[2] + Math.cos(yaw) * 0.06); m.rotation.y = yaw; return m;
}
// joint sets, figure faces +z, feet on y=0. R = right side = +x
const POSES = {
  stand: {
    pelvis: [0, 0.97, 0], chest: [0, 1.36, 0], head: [0, 1.6, 0.01],
    hip: [0.095, 0.93, 0], knee: [0.1, 0.5, 0.02], ankle: [0.1, 0.08, -0.01],
    sh: [0.2, 1.42, 0], elbowL: [-0.24, 1.14, -0.02], wristL: [-0.25, 0.88, 0.03], elbowR: [0.24, 1.14, -0.02], wristR: [0.25, 0.88, 0.03],
  },
  // deep flat-footed squat, forearms resting on knees
  squat: {
    pelvis: [0, 0.36, -0.13], chest: [0, 0.76, 0.0], head: [0, 0.99, 0.09],
    hip: [0.1, 0.33, -0.12], knee: [0.17, 0.5, 0.22], ankle: [0.14, 0.08, 0.04],
    sh: [0.19, 0.8, 0.01], elbowL: [-0.19, 0.55, 0.26], wristL: [-0.1, 0.43, 0.46], elbowR: [0.19, 0.55, 0.26], wristR: [0.1, 0.43, 0.46],
  },
  sit: { // on a seat at ~0.45
    pelvis: [0, 0.5, -0.03], chest: [0, 0.9, -0.05], head: [0, 1.14, -0.03],
    hip: [0.1, 0.47, 0], knee: [0.11, 0.48, 0.42], ankle: [0.11, 0.08, 0.46],
    sh: [0.2, 0.95, -0.05], elbowL: [-0.23, 0.68, 0.02], wristL: [-0.15, 0.53, 0.26], elbowR: [0.23, 0.68, 0.02], wristR: [0.15, 0.53, 0.26],
  },
  sitLow: { // on a low stool (~0.3), knees up
    pelvis: [0, 0.35, -0.05], chest: [0, 0.76, -0.02], head: [0, 1.0, 0.02],
    hip: [0.1, 0.32, -0.02], knee: [0.14, 0.47, 0.34], ankle: [0.13, 0.07, 0.42],
    sh: [0.2, 0.81, -0.02], elbowL: [-0.2, 0.56, 0.18], wristL: [-0.13, 0.48, 0.38], elbowR: [0.23, 0.56, 0.1], wristR: [0.2, 0.52, 0.34],
  },
};
export function person({ pose = 'stand', shirt = '#e8e4d8', pants = '#2c3140', skin = '#b88a66', hair = '#1a1714', scale = 1, cig = false, bald = false, sleeves = 'long', arm = null, joints = null, skirt = null } = {}) {
  const g = new THREE.Group();
  const S = std({ color: shirt }), P = std({ color: pants }), K = std({ color: skin }), H = std({ color: hair }), Sh = std({ color: '#161616' });
  const J = JSON.parse(JSON.stringify(POSES[pose]));
  if (joints) Object.assign(J, joints);
  // right-arm variants
  if (arm === 'mouth') { J.elbowR = [0.21, 0.66, 0.24]; J.wristR = [0.06, 0.92, 0.2]; if (pose === 'stand') { J.elbowR = [0.24, 1.2, 0.1]; J.wristR = [0.07, 1.53, 0.14]; } }
  if (arm === 'fan') { J.elbowR = [0.26, 0.68, 0.14]; J.wristR = [0.18, 0.86, 0.3]; }
  const mir = (p) => [-p[0], p[1], p[2]];
  const upperArm = sleeves === 'none' ? K : S, foreArm = sleeves === 'long' ? S : K;
  // torso: a slightly flattened capsule from pelvis to chest
  const torso = limb(J.pelvis, J.chest, 0.15, S); torso.scale.set(1.3, 1, 0.82); g.add(torso);
  // shoulders + neck
  g.add(limb(mir(J.sh), J.sh, 0.05, S));
  const neckTop = [J.head[0], J.head[1] - 0.1, J.head[2]];
  g.add(limb([J.chest[0], J.chest[1] + 0.05, J.chest[2]], neckTop, 0.045, K));
  // head
  const kidK = scale < 0.8 ? 1.3 : 1; // children: bigger heads
  const hd = ball(J.head, 0.108 * kidK, K); hd.scale.set(0.95, 1.12, 1.02); g.add(hd);
  if (kidK > 1) { J.head = [J.head[0], J.head[1] + 0.02, J.head[2]]; hd.position.set(...J.head); }
  if (!bald) { const hr = new THREE.Mesh(new THREE.SphereGeometry(0.114 * kidK, 12, 8, 0, 6.29, 0, 1.5), H); hr.position.set(J.head[0], J.head[1] + 0.02, J.head[2] - 0.012); hr.rotation.x = -0.3; hr.scale.set(0.97, 1.08, 1.05); g.add(hr); }
  // legs
  for (const sd of [1, -1]) {
    const f = (p) => [p[0] * sd, p[1], p[2]];
    g.add(limb(f(J.hip), f(J.knee), 0.075, P), limb(f(J.knee), f(J.ankle), 0.062, P));
    g.add(ball(f(J.hip), 0.08, P));
    g.add(shoe(f(J.ankle), Sh, pose === 'squat' ? sd * 0.25 : sd * 0.08));
  }
  // arms
  const arms = [[J.sh, J.elbowR, J.wristR], [mir(J.sh), J.elbowL, J.wristL]];
  arms.forEach(([s0, e, w]) => {
    g.add(ball(s0, 0.052, upperArm), limb(s0, e, 0.048, upperArm), limb(e, w, 0.043, foreArm), ball(w, 0.045, K));
  });
  const handR = new THREE.Group(); handR.position.set(...J.wristR); g.add(handR); g.userData.handR = handR;
  g.userData.J = J;
  if (skirt) { // long skirt from the waist to the ankles
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, J.pelvis[1] - 0.08, 14, 1, true), std({ color: skirt, side: THREE.DoubleSide }));
    sk.position.set(J.pelvis[0], (J.pelvis[1] + 0.08) / 2 + 0.04, J.pelvis[2]); g.add(sk);
  }
  if (cig) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 5), std({ color: '#f2eee4' }));
    c.rotation.x = Math.PI / 2; c.position.set(-0.01, 0.0, 0.05); handR.add(c);
    const em = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff6a1a' }));
    em.position.set(-0.01, 0.0, 0.087); handR.add(em);
    g.userData.ember = em;
  }
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------- props ----------
export function loudspeakerPole({ h = 7.5, horns = 4, rust = true } = {}) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, h, 8), texMat(concreteTex({ seed: 31, color: '#8f8b82', size: 128, cracks: 3 })));
  pole.position.y = h / 2; pole.castShadow = true; g.add(pole);
  const hornMat = std({ color: '#b9bcb8', roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
  const inner = std({ color: '#222', side: THREE.BackSide });
  for (let i = 0; i < horns; i++) {
    const a = (i / horns) * Math.PI * 2 + 0.4;
    const hg = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.06, 0.62, 16, 1, true), hornMat);
    cone.rotation.x = Math.PI / 2; cone.position.z = 0.31; hg.add(cone);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10), hornMat); body.rotation.x = Math.PI / 2; body.position.z = -0.05; hg.add(body);
    hg.position.set(Math.sin(a) * 0.2, h - 0.35 - (i % 2) * 0.05, Math.cos(a) * 0.2);
    hg.rotation.y = a; hg.rotation.x = 0.18;
    hg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(hg);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), std({ color: '#555', metalness: 0.4 })); bar.position.y = h - 0.9; g.add(bar);
  return g;
}

// wires between points (sagging)
export function wire(scene, a, b, sag = 0.6, color = '#1d1d1d') {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16; const p = new THREE.Vector3().lerpVectors(new THREE.Vector3(...a), new THREE.Vector3(...b), t);
    p.y -= Math.sin(t * Math.PI) * sag; pts.push(p);
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.012, 3, false);
  const m = new THREE.Mesh(geo, std({ color })); scene.add(m); return m;
}

export function instanced(geo, mat, mats, { cast = true, receive = true } = {}) {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = cast; im.receiveShadow = receive; im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  return im;
}
export function mtx(x, y, z, ry = 0, s = 1, sy = null, rx = 0, rz = 0) {
  const m = new THREE.Matrix4();
  m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, sy ?? s, s));
  return m;
}

// poplar: returns {trunk, crown} geometries (crown vertex-colored)
export function poplarGeos(seed, H = 18, { crownColor = '#4d5c33', crownStart = 0.28, width = 1.5 } = {}) {
  const r = rng(seed);
  const trunk = new THREE.CylinderGeometry(0.09, 0.2, H, 7, 1); trunk.translate(0, H / 2, 0);
  const parts = [];
  const base = new THREE.Color(crownColor);
  const nClumps = 9;
  for (let i = 0; i < nClumps; i++) {
    const t = i / (nClumps - 1);
    const y = H * (crownStart + t * (0.95 - crownStart));
    const w = width * (0.55 + Math.sin(t * Math.PI * 0.85 + 0.25) * 0.6) * (0.8 + r() * 0.4);
    const g = new THREE.IcosahedronGeometry(1, 1);
    const pos = g.attributes.position;
    const sd = r() * 100;
    const hsh = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + sd) * 43758.5453; return v - Math.floor(v); };
    for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k); const f = 0.78 + hsh(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)) * 0.4; pos.setXYZ(k, x * f, y * f, z * f); }
    g.scale(w, H * 0.12 * (0.9 + r() * 0.4), w);
    g.translate((r() - 0.5) * 0.6, y, (r() - 0.5) * 0.6);
    const col = base.clone().offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08 + (t - 0.5) * 0.06);
    const cols = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) { const d = 0.85 + r() * 0.25; cols[k * 3] = col.r * d; cols[k * 3 + 1] = col.g * d; cols[k * 3 + 2] = col.b * d; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    parts.push(g);
  }
  const crown = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }));
  crown.computeVertexNormals();
  return { trunk, crown };
}
export function poplarBark(H = 18, lime = 1.3, seed = 41) {
  const n = Noise(seed), r = rng(seed);
  const limeV = lime / H;
  return pixTex(128, 1024, (u, v) => {
    const vv = 1 - v; // canvas y top = 0 -> v=1 at top of cylinder? CylinderGeometry uv v=1 at top
    const a = n.fbm(u, v * 8, 4, 4);
    if (vv < limeV + (n.vn(u * 12, 0) - 0.5) * 0.004) return mul3([228, 226, 214], 0.9 + a * 0.15);
    let c = mul3([112, 114, 98], 0.75 + a * 0.4);
    return c;
  }, {
    post: (ctx, w, h) => { // poplar "eyes"
      for (let i = 0; i < 70; i++) {
        const x = r() * w, y = r() * h * (1 - limeV) ; ctx.fillStyle = 'rgba(40,38,30,0.8)';
        ctx.beginPath(); ctx.ellipse(x, y, 5 + r() * 8, 2 + r() * 3, 0, 0, 6.28); ctx.fill();
      }
    }
  });
}

// solar water heater: angled tube array + tank on frame
export function solarHeater(seed = 1) {
  const g = new THREE.Group(), r = rng(seed);
  const glass = std({ color: '#1f2a33', roughness: 0.15, metalness: 0.6 });
  const tankMat = std({ color: '#c9ccc9', roughness: 0.35, metalness: 0.8 });
  const frame = std({ color: '#9a9d9a', roughness: 0.5, metalness: 0.7 });
  const W = 1.9, n = 14;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, W + 0.2, 14), tankMat);
  tank.rotation.z = Math.PI / 2; tank.position.set(0, 1.35, 0); g.add(tank);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + (i + 0.5) * W / n;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.8, 8), glass);
    tube.position.set(x, 0.72, 0.72); tube.rotation.x = 0.78; g.add(tube);
  }
  const leg = (x, z, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, 0.04), frame); m.position.set(x, h / 2, z); g.add(m); };
  leg(-W / 2, 0, 1.2); leg(W / 2, 0, 1.2); leg(-W / 2, 1.3, 0.15); leg(W / 2, 1.3, 0.15);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.04, 0.04), frame); rail.position.set(0, 0.1, 1.3); g.add(rail);
  // plumbing
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 5), std({ color: '#d6d2c6' })); pipe.position.set(W / 2 + 0.15, 0.7, 0); g.add(pipe);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// string of dried corn cobs hanging
export function cornString(len = 1.6, seed = 1, { hang = true } = {}) {
  const r = rng(seed);
  const geo = new THREE.SphereGeometry(0.045, 7, 5); geo.scale(1, 2.6, 1);
  const mats = [];
  const cols = [];
  const per = Math.floor(len / 0.07);
  for (let i = 0; i < per; i++) {
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * 6.28 + i * 0.7 + r() * 0.4;
      const y = -i * 0.07 - r() * 0.03;
      const rad = 0.06 * (1 - i / per * 0.3);
      mats.push(mtx(Math.sin(a) * rad, y - 0.1, Math.cos(a) * rad, a, 1, 1, Math.cos(a) * 0.35, -Math.sin(a) * 0.35));
      cols.push(new THREE.Color().setHSL(0.1 + r() * 0.03, 0.85, 0.42 + r() * 0.12));
    }
  }
  const im = instanced(geo, std({ color: '#ffffff', roughness: 0.75 }), mats);
  cols.forEach((c, i) => im.setColorAt(i, c));
  im.instanceColor.needsUpdate = true;
  return im;
}

// flat cardboard-ish sign
export function plane(w, h, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.receiveShadow = true; return m; }

// palm leaf fan (蒲扇)
export function palmFan() {
  const g = new THREE.Group();
  const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.2, 18), texMat(pixTex(128, 128, (u, v) => {
    const a = Math.atan2(v - 0.95, u - 0.5); const s = Math.sin(a * 60) * 0.5 + 0.5;
    return mul3([196, 170, 110], 0.8 + s * 0.25);
  }), { side: THREE.DoubleSide }));
  leaf.scale.set(1, 1.15, 1); g.add(leaf);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 4, 24), std({ color: '#6b4e2a' })); rim.scale.set(1, 1.15, 1); g.add(rim);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 5), std({ color: '#8a6a3a' })); handle.position.y = -0.3; g.add(handle);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
export function thermos(color = '#b8342a') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 14), std({ color, roughness: 0.4 })); body.position.y = 0.18; g.add(body);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.06, 14), std({ color: '#c9c3b0' })); top.position.y = 0.39; g.add(top);
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.04, 10), std({ color: '#9a7a50' })); cork.position.y = 0.43; g.add(cork);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function stool(color = '#6a4a2a') {
  const g = new THREE.Group(); const m = std({ color });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.24), m); top.position.y = 0.26; g.add(top);
  for (const [x, z] of [[-0.14, -0.09], [0.14, -0.09], [-0.14, 0.09], [0.14, 0.09]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.03), m); l.position.set(x, 0.13, z); g.add(l); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
