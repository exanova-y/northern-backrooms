"""20 s soundtrack for the short cut: road | village | park | wedding (5 s each, hard cuts)."""
import math
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
SEG = 5.0
DURS = {'road': 5.0, 'village': 5.0, 'park': 5.0, 'wedding': 5.0, 'kyiv': 10.0, 'toronto': 5.0, 'waterloo': 5.0, 'flowers': 5.0}
TOT = sum(DURS.values())
N = int(SR * TOT)
rng = np.random.default_rng(11)
t_all = np.arange(N) / SR

# clip windows (source-clip seconds) for each 5 s segment
WIN = {'road': 6.0, 'village': 6.0, 'park': 8.0, 'wedding': 10.0}
ORDER = ['road', 'village', 'park', 'wedding', 'kyiv', 'toronto', 'waterloo', 'flowers']


def S(sec):
    return int(round(sec * SR))


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)


def pan(mono, p):
    """p in [-1,1] (scalar or array) -> stereo, equal power"""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], 1)


def smooth_curve(n, rate_hz, seed):
    r = np.random.default_rng(seed)
    k = int(n / SR * rate_hz) + 4
    pts = r.standard_normal(k)
    x = np.linspace(0, k - 3.001, n)
    i = np.floor(x).astype(int); f = x - i
    p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
    y = 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)
    return y / (np.abs(y).max() + 1e-9)


def reverb_ir(length=0.9, decay=0.25, early=(0.011, 0.019, 0.027, 0.041), seed=3, bright=4000):
    r = np.random.default_rng(seed)
    n = S(length)
    tail = r.standard_normal((n, 2)) * np.exp(-np.arange(n) / SR / decay)[:, None]
    tail = lp(tail.T, bright).T
    tail[:S(0.03)] *= np.linspace(0, 1, S(0.03))[:, None]
    ir = tail * 0.35
    ir[0] += 1.0
    for k, d in enumerate(early):
        ir[S(d), k % 2] += 0.55 - 0.08 * k
    return ir


def conv_st(x, ir, wet=0.5):
    y = np.stack([signal.fftconvolve(x[:, c], ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet) + y * wet


# ---------------------------------------------------------------- cicadas
def cicada(n, f0, pulse_hz, seed, level=1.0, p=0.0, swell=True):
    r = np.random.default_rng(seed)
    noise = r.standard_normal(n)
    tone = bp(noise, f0 * 0.93, f0 * 1.07, order=3)
    tone /= np.std(tone) + 1e-9
    body = bp(noise, f0 * 0.6, f0 * 1.6, order=1); body /= np.std(body) + 1e-9
    carrier = tone * 0.8 + body * 0.25
    # sharp tymbal pulse train with a little jitter
    tt = np.arange(n) / SR
    ph = 2 * np.pi * pulse_hz * tt + 0.6 * smooth_curve(n, 3, seed + 1)
    pulses = (0.5 + 0.5 * np.cos(ph)) ** 6
    env = np.ones(n)
    if swell:
        sw = 0.72 + 0.28 * smooth_curve(n, 0.45, seed + 2)
        env *= sw
    return pan(carrier * pulses * env * level, p)


def cicada_chorus(n, seed, count=5, base_level=1.0, freq=(4200, 6300), pulse=(110, 190)):
    r = np.random.default_rng(seed)
    out = np.zeros((n, 2))
    for k in range(count):
        f0 = r.uniform(*freq); ph = r.uniform(*pulse); p = r.uniform(-0.9, 0.9)
        lvl = base_level * r.uniform(0.35, 1.0)
        out += cicada(n, f0, ph, seed * 10 + k, lvl, p)
    # distant dense bed
    bed = bp(r.standard_normal(n), 3800, 6500, order=2)
    bed *= (0.5 + 0.5 * np.cos(2 * np.pi * 140 * np.arange(n) / SR)) ** 3
    out += pan(bed / np.std(bed) * 0.18 * base_level, 0.0)
    return out


# ---------------------------------------------------------------- wind
def wind_segment(n, seed, strength):
    r = np.random.default_rng(seed)
    g = np.clip(0.55 + 0.45 * smooth_curve(n, 0.6, seed), 0.15, 1.0)
    outs = []
    common = r.standard_normal(n)
    for c in range(2):
        w = 0.6 * common + 0.8 * r.standard_normal(n)
        low = bp(w, 180, 900, order=1); low /= np.std(low)
        hi = bp(w, 1500, 6000, order=2); hi /= np.std(hi)
        rum = lp(np.cumsum(r.standard_normal(n)), 90); rum = hp(rum, 15); rum /= np.abs(rum).max() + 1e-9
        gc = g if c == 0 else np.roll(g, S(0.3))
        outs.append(low * (0.3 + 0.7 * gc ** 1.5) + hi * 0.15 * gc ** 2 + rum * 0.8)
    return np.stack(outs, 1) * strength


# ---------------------------------------------------------------- road sounds
def tractor(n, seed, level, p):
    """distant single-cylinder diesel 'dong-dong-dong'"""
    r = np.random.default_rng(seed)
    out = np.zeros(n)
    t = 0.0; rate = 8.5
    while t < n / SR:
        i = S(t); L = S(0.09)
        if i + L < n:
            k = np.arange(L) / SR
            thump = np.sin(2 * np.pi * (62 + r.uniform(-4, 4)) * k) * np.exp(-k / 0.025)
            click = r.standard_normal(L) * np.exp(-k / 0.006) * 0.4
            out[i:i + L] += (thump + click) * r.uniform(0.75, 1.0)
        t += 1 / rate * r.uniform(0.93, 1.07)
    out = lp(out, 500)
    out /= np.abs(out).max() + 1e-9
    return pan(out * level, p)


def truck_pass(n, seed, level, t_peak, width=1.4):
    r = np.random.default_rng(seed)
    tt = np.arange(n) / SR
    env = np.exp(-0.5 * ((tt - t_peak) / width) ** 2)
    roar = lp(np.cumsum(r.standard_normal(n)), 380); roar = hp(roar, 30); roar /= np.std(roar)
    tyre = bp(r.standard_normal(n), 500, 2500); tyre /= np.std(tyre)
    # engine harmonics with doppler drop through the peak
    f = 48 * (1 + 0.06 * np.tanh(-(tt - t_peak) / 0.6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    eng = sum(np.sin(ph * h) / h for h in (1, 2, 3, 4, 6))
    mono = (roar * 0.8 + tyre * 0.35 + eng * 0.5) * env
    p = np.tanh((tt - t_peak) / 1.2) * 0.8
    return pan(mono * level, p)


def horn(n, seed, level, times, p=-0.4):
    out = np.zeros(n)
    for (t0, dur) in times:
        i, L = S(t0), S(dur)
        k = np.arange(L) / SR
        e = np.minimum(1, k / 0.01) * np.minimum(1, (dur - k) / 0.03)
        tone = signal.square(2 * np.pi * 415 * k, 0.5) + 0.8 * signal.square(2 * np.pi * 523 * k, 0.5)
        out[i:i + L] += tone * e
    out = bp(out, 300, 2200)
    out /= np.abs(out).max() + 1e-9
    st = pan(out * level, p)
    return conv_st(st, reverb_ir(1.6, 0.5, seed=seed, bright=2500), wet=0.7)


# ---------------------------------------------------------------- park: rusty swing creak (synced)
def creak(dur, f0, seed):
    r = np.random.default_rng(seed)
    L = S(dur); k = np.arange(L) / SR
    f = f0 * (1 - 0.18 * k / dur) + 25 * np.sin(2 * np.pi * 7 * k)
    ph = 2 * np.pi * np.cumsum(f) / SR
    # stick-slip: rough pulse train at the fundamental
    s = (np.sin(ph) > 0.6).astype(float) - 0.3
    s += 0.3 * np.sin(ph * 2) + 0.15 * np.sin(ph * 3.01)
    s = bp(s, 500, 4000)
    env = np.sin(np.pi * k / dur) ** 0.7 * (0.7 + 0.3 * r.random(L))
    return s * env


# ---------------------------------------------------------------- wedding: firecrackers (synced to flashes)
def hsh(i):
    v = math.sin(i * 12.9898 + 78.233) * 43758.5453
    return v - math.floor(v)


def bang(r, big):
    L = S(0.12); k = np.arange(L) / SR
    tau = r.uniform(0.004, 0.009) * (1.6 if big else 1)
    crack = r.standard_normal(L) * np.exp(-k / tau)
    crack = hp(crack, 700 if not big else 400, order=1)
    thump = np.sin(2 * np.pi * r.uniform(90, 160) * k) * np.exp(-k / (0.018 if big else 0.01))
    return crack + thump * (0.9 if big else 0.4)


# ---------------------------------------------------------------- dry bus horn
def bus_horn(blasts, f=(349.0, 440.0)):
    L = S(max(t0 + d for t0, d in blasts) + 0.05)
    out = np.zeros(L)
    for t0, d in blasts:
        n = S(d); k = np.arange(n) / SR
        env = np.minimum(1, k / 0.012) * np.minimum(1, (d - k) / 0.02)
        bend = 1 - 0.03 * np.exp(-k / 0.04)  # slight pitch settle at the attack
        tone = np.zeros(n)
        for fi in f:
            ph = 2 * np.pi * np.cumsum(fi * bend * (1 + 0.002 * np.sin(2 * np.pi * 6 * k))) / SR
            tone += signal.sawtooth(ph, 0.5) * 0.6 + signal.square(ph, 0.5) * 0.4
        out[S(t0):S(t0) + n] += tone * env
    out = bp(out, 180, 4500, order=2)
    out = np.tanh(out / np.abs(out).max() * 1.8)
    return out / np.abs(out).max()


# ================================================================= build
mix = np.zeros((N, 2))
segs = {}
acc = 0.0
for name in ORDER:
    segs[name] = (S(acc), S(acc + DURS[name])); acc += DURS[name]
n5 = S(SEG)


def put(name, x, gain=1.0, fade=0.02):
    if name not in segs: return  # scene not in the current cut
    a, b = segs[name]
    x = x[:b - a].copy()
    f = S(fade)
    x[:f] *= np.linspace(0, 1, f)[:, None]; x[-f:] *= np.linspace(1, 0, f)[:, None]
    mix[a:a + len(x)] += x * gain


# wind bed, continuous but with per-scene strength (smoothed)
wstr = np.zeros(N)
for name, s_ in zip(ORDER, [1.0, 0.45, 0.8, 0.35, 0.5, 0.45, 0.4, 0.35]):
    a, b = segs[name]; wstr[a:b] = s_
wstr = np.convolve(wstr, np.ones(S(0.15)) / S(0.15), 'same')
wbed = wind_segment(N, 5, 1.0)
wbed /= np.abs(wbed).max()
mix += wbed * wstr[:, None] * 0.22

# 1. ROAD: cicadas in the poplars, distant tractor, a truck passing on the far road, a far-off horn
road = cicada_chorus(n5, 21, count=4, base_level=0.14)
road += tractor(n5, 22, 0.16, -0.7)
road += truck_pass(n5, 23, 0.07, t_peak=3.3)
put('road', road)

# 2. VILLAGE: loud cicadas close in the trees, the old man's fan (fan angle = sin(5.2 t) * 0.35)
vil = cicada_chorus(n5, 31, count=6, base_level=0.2, freq=(4000, 6000))
t0 = WIN['village']
fan = np.zeros((n5, 2)); rr = np.random.default_rng(33)
k = 0
while True:
    # swish at each velocity peak of the fan: 5.2 t = k*pi
    tc = k * math.pi / 5.2 - t0
    k += 1
    if tc > SEG: break
    if tc < 0: continue
    L = S(0.22); kk = np.arange(L) / SR
    sw = bp(rr.standard_normal(L), 600, 3000) * np.sin(np.pi * kk / 0.22) ** 2
    near = max(0.0, (tc - 2.5) / 2.5)  # the fanning man comes into view late in the window
    i = S(tc)
    if i + L < n5: fan[i:i + L] += pan(sw * 0.05 * near, 0.5)
vil += fan
put('village', vil)

# 3. PARK: drier, sparser cicadas far off; the rusty swing creaks at each end of its arc (rot = sin(1.9 t) * 0.38)
park = cicada_chorus(n5, 41, count=3, base_level=0.06, freq=(3500, 5200), pulse=(80, 130))
t0 = WIN['park']
kk = 0
while True:
    tc = (math.pi / 2 + kk * math.pi) / 1.9 - t0
    kk += 1
    if tc > SEG: break
    if tc < -0.3: continue
    c = creak(0.42, 820 if kk % 2 else 690, 40 + kk)
    i = S(max(0, tc - 0.18))
    L = min(len(c), n5 - i)
    # swing set sits left of camera, closest around clip t = 9.5-11
    ct = tc + t0
    near = 0.5 + 0.5 * math.exp(-((ct - 10.2) / 1.6) ** 2)
    park[i:i + L] += pan(c[:L] * 0.05 * near, -0.55)
park = conv_st(park, reverb_ir(1.2, 0.35, seed=45, bright=3000), wet=0.25)
put('park', park)

# 4. WEDDING: pre-dawn, a few crickets; the firecracker string, one report per flash frame
wed = np.zeros((n5, 2))
cr = bp(np.random.default_rng(51).standard_normal(n5), 4200, 4700, order=3)
cr *= (np.sin(2 * np.pi * 30 * np.arange(n5) / SR) > 0.2) * ((np.arange(n5) / SR * 2.1) % 1 < 0.35)
wed += pan(cr / (np.std(cr) + 1e-9) * 0.01, 0.6)
t0 = WIN['wedding']
rw = np.random.default_rng(52)
crackle = np.zeros((n5 + S(0.3), 2))
for f in range(int(t0 * 24), int((t0 + SEG) * 24)):
    tt = f / 24
    u = (tt - 0.4) / 14.2
    if tt <= 0.4 or u >= 1: continue
    b = hsh(f * 1.7)
    inten = (12 + 70 * b ** 3) if b > 0.25 else 3
    # distance: burning point z = -30 + 25u, camera drifts from z~-1 to ~-4 over the window
    cz = -1 - 3 * (tt - t0) / SEG
    d = max(1.6, math.hypot(-30 + 25 * u - cz, 0.7))
    amp = min(1.0, 3.2 / d)
    fx = 0.7 + math.sin(u * 11) * 0.45 + math.sin(u * 3.1) * 0.3
    pn = float(np.clip(fx / 2.5, -1, 1))
    # 1-3 reports per frame (strings fire ~40/s), the flash-matched one on the frame
    nrep = 1 + int(rw.random() * 2.2)
    for j in range(nrep):
        big = j == 0 and inten > 30
        a = (inten / 82) if j == 0 else rw.uniform(0.15, 0.5)
        x = bang(rw, big) * a * amp
        i = S(tt - t0 + (0 if j == 0 else rw.uniform(0.004, 0.038)))
        crackle[i:i + len(x)] += pan(x, pn + rw.uniform(-0.15, 0.15))
crackle = crackle[:n5]
crackle = conv_st(crackle, reverb_ir(1.1, 0.3, early=(0.009, 0.013, 0.021, 0.033), seed=53, bright=5000), wet=0.4)
wed += crackle * 0.55
put('wedding', wed, fade=0.01)

# 5. KYIV: muffled snowy wind, metro train idling on the platform, distant city on the street
n10 = S(DURS['kyiv'])
rk = np.random.default_rng(61)
tk = np.arange(n10) / SR
hum = sum(np.sin(2 * np.pi * f * tk + rk.uniform(0, 6)) * a for f, a in [(100, 1), (200, 0.5), (300, 0.25), (1210, 0.05)])
hum = hum * (1 - np.clip((tk - 3.0) / 2.0, 0, 1))  # fades as we leave the platform
hiss = bp(rk.standard_normal(n10), 800, 3000); hiss /= np.std(hiss)
kyiv = pan(hum * 0.02 + hiss * 0.004 * (1 - np.clip((tk - 3) / 2, 0, 1)), 0.3)
city = lp(np.cumsum(rk.standard_normal(n10)), 250); city = hp(city, 25); city /= np.std(city)
kyiv += pan(city * 0.03 * np.clip((tk - 4.5) / 2.5, 0.15, 1), 0.0)
# a distant car swish through slush on the street
sw = bp(rk.standard_normal(n10), 300, 2500); sw /= np.std(sw)
kyiv += pan(sw * 0.02 * np.exp(-0.5 * ((tk - 8.6) / 0.7) ** 2), 0.4)
put('kyiv', kyiv)

# ---------------------------------------------------------------- helpers for walk/run sync (mirror lib.js pathCam easing)
def ease_frac(t, T, a):
    v = 1 / (T - a)
    if t < a: return v * t * t / (2 * a)
    if t > T - a: y = T - t; return 1 - v * y * y / (2 * a)
    return v * (t - a / 2)


def footfalls(T, ease, L, stride, offset=0.0):
    ts = np.linspace(0, T, S(T) // 40)
    d = np.array([ease_frac(t, T, ease) * L for t in ts])
    k = np.floor((d + offset) / stride)
    return ts[1:][np.diff(k) > 0]


def goose_honk(rr, f0):
    L = S(0.26); k = np.arange(L) / SR
    f = f0 * (0.72 + 0.5 * np.minimum(1, k / 0.05) - 0.12 * np.maximum(0, (k - 0.1) / 0.16))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = signal.sawtooth(ph) + 0.4 * signal.square(ph * 1.003)
    x = bp(x, 700, 2600, order=2) * 1.0 + bp(x, 250, 500, order=1) * 0.5
    env = np.minimum(1, k / 0.015) * np.exp(-np.maximum(0, k - 0.12) / 0.05)
    return x * env


# 6. LAKE ONTARIO: snow crunch footsteps, lapping water on the stones, geese honking overhead
n5o = S(DURS.get('ontario', 5.0))
ro = np.random.default_rng(71)
ont = np.zeros((n5o, 2))
for tf in footfalls(5.0, 0.6, 7.5, 0.75):
    L = S(0.16); k = np.arange(L) / SR
    grains = (ro.random(L) < 0.08) * ro.standard_normal(L)
    crunch = bp(grains, 1200, 6000) * np.exp(-k / 0.05) * 2.2 + lp(ro.standard_normal(L), 180) * np.exp(-k / 0.02) * 0.5
    i = S(tf)
    if i + L < n5o: ont[i:i + L] += pan(crunch * 0.22, ro.uniform(-0.15, 0.15))
tt = 0.2
while tt < 5.0:
    L = S(1.1); k = np.arange(L) / SR
    lap = bp(ro.standard_normal(L), 180, 1400) * (np.minimum(1, k / 0.18) * np.exp(-k / 0.35))
    spl = bp(ro.standard_normal(L), 2000, 7000) * np.exp(-np.maximum(0, k - 0.15) / 0.08) * (k > 0.12) * 0.4
    i = S(tt)
    seg = (lap + spl)[:max(0, min(L, n5o - i))]
    ont[i:i + len(seg)] += pan(seg * 0.18, 0.55)
    tt += ro.uniform(0.9, 1.8)
for j in range(9):
    tc = ro.uniform(0.2, 4.4); f0 = ro.uniform(340, 460)
    h = goose_honk(ro, f0)
    if ro.random() < 0.6: h = np.concatenate([h, np.zeros(S(0.05)), goose_honk(ro, f0 * 1.05)])
    i = S(tc); L = min(len(h), n5o - i)
    ont[i:i + L] += pan(lp(h, 3500)[:L] * 0.11, 0.6 - tc / 5 * 0.9)
put('ontario', ont)

# 7. FLOWER RUN: running footsteps (synced to the camera bob), wind rush, skylarks, a passing bee
n5f = S(DURS['flowers'])
rf = np.random.default_rng(81)
fl = np.zeros((n5f, 2))
zs = np.linspace(6, -19, 2000)
off = 7 * np.sin(zs * 0.012) + 3 * np.sin(zs * 0.03 + 1)
xs = -off
ys = 2.2 * np.sin(xs * 0.035 + 0.5) + 1.6 * np.sin(zs * 0.022) + 1.2 * np.sin((xs + zs) * 0.018)
RUNL = float(np.sum(np.sqrt(np.diff(xs) ** 2 + np.diff(ys) ** 2 + np.diff(zs) ** 2)))
for j, tf in enumerate(footfalls(5.0, 0.45, RUNL, 1.35)):
    L = S(0.14); k = np.arange(L) / SR
    thud = np.sin(2 * np.pi * rf.uniform(70, 95) * k) * np.exp(-k / 0.03)
    scuff = bp(rf.standard_normal(L), 600, 4000) * np.exp(-k / 0.035) * 0.35
    rustle = bp(rf.standard_normal(L), 2500, 8000) * np.exp(-k / 0.06) * 0.25
    i = S(tf)
    if i + L < n5f: fl[i:i + L] += pan((thud + scuff + rustle) * 0.5, 0.15 if j % 2 else -0.15)
tk = np.arange(n5f) / SR
rush = bp(rf.standard_normal(n5f), 250, 1800); rush /= np.std(rush)
fl += pan(rush * 0.05 * np.clip(tk / 0.6, 0, 1) * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * tk)), 0.0)
tt = 0.1
while tt < 4.8:  # skylark: bursts of rapid warbled chirps
    burst = rf.uniform(0.4, 1.0); t2 = tt; p = rf.uniform(-0.8, 0.8)
    while t2 < tt + burst:
        L = S(rf.uniform(0.02, 0.06)); k = np.arange(L) / SR
        f = rf.uniform(2600, 5800) * (1 + rf.uniform(-0.25, 0.25) * k / (L / SR))
        ch = np.sin(2 * np.pi * np.cumsum(f) / SR + 3 * np.sin(2 * np.pi * rf.uniform(30, 90) * k)) * np.sin(np.pi * k / (L / SR))
        i = S(t2)
        if i + L < n5f: fl[i:i + L] += pan(ch * 0.035, p)
        t2 += L / SR + rf.uniform(0.005, 0.03)
    tt += burst + rf.uniform(0.2, 0.7)
bee = np.sin(2 * np.pi * np.cumsum(215 + 12 * np.sin(2 * np.pi * 9 * tk)) / SR)
bee = bp(np.sign(bee) * 0.5 + bee, 180, 2500)
fl += pan(bee * 0.05 * np.exp(-0.5 * ((tk - 2.6) / 0.45) ** 2), np.tanh((tk - 2.6) * 2) * 0.8)
put('flowers', fl)

# 8. TORONTO RINK: skate strokes (synced to the camera sway), crowd murmur, the clock-tower bell
n5t = S(DURS['toronto'])
rt = np.random.default_rng(91)
tor = np.zeros((n5t, 2))
W = 2 * np.pi / 1.3
k = 0
while True:
    tc = (np.pi / 2 + k * np.pi) / W - 0.12
    k += 1
    if tc > 5.0: break
    if tc < 0: continue
    L = S(0.5); kk = np.arange(L) / SR
    scr = bp(rt.standard_normal(L), 1800, 7500) * np.minimum(1, kk / 0.25) * np.exp(-np.maximum(0, kk - 0.3) / 0.06)
    scr += bp(rt.standard_normal(L), 400, 1500) * np.exp(-kk / 0.2) * 0.3
    i = S(tc); seg = scr[:max(0, min(L, n5t - i))]
    tor[i:i + len(seg)] += pan(seg * 0.2, 0.35 if k % 2 else -0.35)
murmur = np.zeros(n5t)
for v in range(10):
    nz = bp(rt.standard_normal(n5t), 250, 2500)
    syl = (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(rt.uniform(3, 6) + 1.5 * smooth_curve(n5t, 2, 900 + v)) / SR)) ** 2
    murmur += nz / np.std(nz) * syl * rt.uniform(0.3, 1.0)
tor += pan(murmur / np.std(murmur) * 0.025, 0.0)
tk = np.arange(n5t) / SR
for tb in (0.5, 3.0):
    L = n5t - S(tb); kk = np.arange(L) / SR
    bell = sum(a * np.sin(2 * np.pi * 146.8 * rr_ * kk) * np.exp(-kk / d) for rr_, a, d in [(0.5, 0.8, 3.5), (1.0, 1.0, 2.5), (1.183, 0.6, 1.8), (1.506, 0.5, 1.4), (2.0, 0.45, 1.1), (2.514, 0.3, 0.8), (3.011, 0.2, 0.6)])
    bell *= np.minimum(1, kk / 0.004)
    tor[S(tb):] += pan(lp(bell, 3000) * 0.05, 0.25)
tor = conv_st(tor, reverb_ir(1.6, 0.6, early=(0.03, 0.05, 0.08, 0.11), seed=92, bright=3500), wet=0.35)
put('toronto', tor)

# 9. WATERLOO: footsteps on concrete, a car passing, geese honking on the lawn, the sidewalk goose hissing
n5w = S(DURS['waterloo'])
rw2 = np.random.default_rng(101)
wat = np.zeros((n5w, 2))
for tf in footfalls(5.0, 0.6, 116 * 0.052, 0.75):
    L = S(0.1); kk = np.arange(L) / SR
    stp = bp(rw2.standard_normal(L), 900, 5000) * np.exp(-kk / 0.012) * 0.8 + np.sin(2 * np.pi * 90 * kk) * np.exp(-kk / 0.02) * 0.5
    i = S(tf)
    if i + L < n5w: wat[i:i + L] += pan(stp * 0.18, rw2.uniform(-0.1, 0.1))
car = truck_pass(n5w, 102, 1.0, t_peak=2.4, width=0.8)
wat += car / np.abs(car).max() * 0.12 * np.array([1.0, 0.55])
for j in range(5):
    tc = rw2.uniform(0.1, 2.6); h = goose_honk(rw2, rw2.uniform(330, 440)); i = S(tc); L = min(len(h), n5w - i)
    wat[i:i + L] += pan(h[:L] * 0.07, rw2.uniform(0.3, 0.9))
L = S(1.3); kk = np.arange(L) / SR
hiss = bp(rw2.standard_normal(L), 1800, 8000) * (1 + 0.6 * np.sin(2 * np.pi * 38 * kk)) * np.minimum(1, kk / 0.08) * np.exp(-np.maximum(0, kk - 0.9) / 0.12)
i = S(3.3); wat[i:i + L] += pan(hiss * 0.1, 0.05)
tt = 0.3
while tt < 4.6:
    Lc = S(0.12); kk = np.arange(Lc) / SR
    f = rw2.uniform(2200, 3400) * (1 + 0.3 * np.sin(np.pi * kk / 0.12))
    ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * kk / 0.12)
    i = S(tt)
    if i + Lc < n5w: wat[i:i + Lc] += pan(ch * 0.02, -0.6)
    tt += rw2.uniform(0.15, 0.9)
put('waterloo', wat)

# master: per-scene loudness targets (RMS dBFS), smoothed gain, then soft limiter
TARGET = {'road': -22.0, 'village': -22.5, 'park': -24.0, 'wedding': -15.5, 'kyiv': -26.0, 'toronto': -23.5, 'waterloo': -21.5, 'flowers': -20.0}
gain = np.ones(N)
for name in ORDER:
    a, b = segs[name]
    rms = np.sqrt((mix[a:b] ** 2).mean())
    gain[a:b] = 10 ** (TARGET[name] / 20) / rms
gain = np.convolve(gain, np.ones(S(0.04)) / S(0.04), 'same')
mix *= gain[:, None]
# loud, dry bus horn on the road (added after balancing so it stays loud; no reverb)
a0 = segs['road'][0]
bh = bus_horn([(0.95, 0.62), (1.72, 0.28)])
mix[a0:a0 + len(bh)] += pan(bh * 10 ** (-3 / 20), -0.25)
mix = np.tanh(mix * 1.25) / 1.25
mix *= min(1.0, 10 ** (-1.0 / 20) / np.abs(mix).max())
wavfile.write('out/soundtrack.wav', SR, (mix * 32767).astype(np.int16))
for name in ORDER:
    a, b = segs[name]
    print(name, 'rms dBFS %.1f' % (20 * np.log10(np.sqrt((mix[a:b] ** 2).mean()) + 1e-12)))
