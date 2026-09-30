"""Market crowd v2 (8 s, synced to scenes/market2.js): yelling hawkers, a looping megaphone slogan,
grannies bargaining and calling out, bright crowd chatter. Dry: no reverb.  -> out/market_sound_v2.wav"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 8.0
DOOR_T = 5.9
N = int(SR * DUR)
S = lambda s: int(round(s * SR))
T = np.arange(N) / SR
R = np.random.default_rng(88)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)


def pan(m, p):
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], 1)


# shouted vowels: raised F1, strong F3/F4
V = {'a': (950, 1500, 2700, 3600), 'e': (650, 1950, 2750, 3700), 'i': (380, 2450, 3150, 3900),
     'o': (650, 1050, 2600, 3500), 'u': (430, 950, 2500, 3500), 'r': (600, 1450, 2350, 3400), 'ai': (820, 1750, 2750, 3700)}
VK = list(V)


class Voice:
    """syllable-level voice: each syllable = (t0, dur, vowel, pitch_start, pitch_end, amp, consonant)"""
    def __init__(self, f0, fscale=1.0, rough=0.0, bright=1.0, seed=0):
        self.f0, self.fs, self.rough, self.bright = f0, fscale, rough, bright
        self.r = np.random.default_rng(seed)
        self.syl = []

    def add(self, t0, dur, v, p0, p1, amp=1.0, cons=None):
        self.syl.append((t0, dur, v, p0, p1, amp, cons))

    def render(self):
        r = self.r
        f0 = np.full(N, self.f0); amp = np.zeros(N); cons_env = np.zeros(N); cons_band = np.zeros((N, 2))
        F = np.zeros((N, 4)); F[:] = V['a']
        last = V['a']
        for (t0, d, v, p0, p1, a, c) in sorted(self.syl):
            i0, i1 = S(t0), min(N, S(t0 + d))
            if i0 >= N or i1 <= i0: continue
            k = np.linspace(0, 1, i1 - i0)
            # pitch glide; long syllables get a shouted rise-then-fall
            glide = p0 + (p1 - p0) * k
            if d > 0.35: glide = glide + 0.12 * np.sin(np.pi * np.minimum(1, k * 1.6))
            f0[i0:i1] = self.f0 * glide
            env = np.minimum(1, k * d / 0.02) * np.minimum(1, (1 - k) * d / (0.06 if d > 0.3 else 0.025))
            amp[i0:i1] = np.maximum(amp[i0:i1], env * a)
            tgt = np.array(V[v]) * self.fs
            blend = np.minimum(1, k * d / 0.04)[:, None]
            F[i0:i1] = np.array(last) * (1 - blend) + tgt * blend
            last = tgt
            if c:
                L = min(S(0.07 if c in ('sh', 's', 'ch') else 0.02), N - i0)
                cons_env[max(0, i0 - L // 2):max(0, i0 - L // 2) + L] = 1.0
                cons_band[max(0, i0 - L // 2):max(0, i0 - L // 2) + L] = {'sh': (2200, 5500), 's': (4500, 9500), 'ch': (2000, 6500), 'd': (400, 5000), 'b': (200, 3000)}[c]
        # jitter / shimmer / tremolo (grannies are rough and wobbly)
        jit = 1 + (0.004 + 0.02 * self.rough) * lp(r.standard_normal(N), 40) * 8 + 0.03 * self.rough * np.sin(2 * np.pi * 5.8 * T)
        ph = 2 * np.pi * np.cumsum(f0 * jit) / SR
        frac = (ph / (2 * np.pi)) % 1
        src = (1 - frac) ** (3 + 3 * self.bright) - 1 / (4 + 3 * self.bright)   # sharp glottal closure = bright
        src += 0.06 * r.standard_normal(N) * (1 + self.rough)                   # breath / rasp
        out = np.zeros(N); zis = [np.zeros((1, 2)) for _ in range(4)]; B = 240
        bw = (0.09, 0.07, 0.06, 0.06); gains = (1.0, 0.85, 0.55 * self.bright, 0.35 * self.bright)
        for b0 in range(0, N, B):
            if amp[b0:b0 + B].max() < 1e-4:
                for j in range(4): zis[j] *= 0.5
                continue
            seg = src[b0:b0 + B]; acc = np.zeros(len(seg))
            for j in range(4):
                fc = float(np.clip(F[b0, j], 150, 9000))
                sos = signal.butter(1, [fc * (1 - bw[j]), fc * (1 + bw[j])], 'band', fs=SR, output='sos')
                y, zis[j] = signal.sosfilt(sos, seg, zi=zis[j]); acc += y * gains[j]
            out[b0:b0 + B] = acc
        out *= amp * (1 + 0.15 * self.rough * lp(r.standard_normal(N), 25) * 6)
        # consonants
        noise = r.standard_normal(N); cons = np.zeros(N)
        for lo, hi in {(2200, 5500), (4500, 9500), (2000, 6500), (400, 5000), (200, 3000)}:
            m = (cons_band[:, 0] == lo) * cons_env
            if m.any(): cons += bp(noise, lo, hi) * m
        out = out / (np.abs(out).max() + 1e-9) + cons * 0.25
        out = hp(out, 90)
        return out / (np.abs(out).max() + 1e-9)


def slogan(v, start, end, period, template, jitter=0.03):
    """a hawker's call: same rhythm and melody every time, with a long drawn-out last syllable"""
    t = start
    while t < end:
        tt = t
        for (d, vw, p0, p1, a, c) in template:
            v.add(tt + v.r.uniform(-jitter, jitter), d * v.r.uniform(0.93, 1.07), vw, p0, p1, a, c)
            tt += d + 0.015
        t += period * v.r.uniform(0.95, 1.08)


def chatter(v, start, end, rate=1.0, hi=1.25, lo=0.85, busy=0.8, excl=0.15):
    r = v.r; t = start
    while t < end:
        if r.random() > busy: t += r.uniform(0.2, 0.6); continue
        n = r.integers(3, 10)
        for i in range(n):
            d = r.uniform(0.07, 0.16) / rate
            p = r.uniform(lo, hi); v.add(t, d, VK[r.integers(len(VK))], p, p * r.uniform(0.92, 1.08), r.uniform(0.7, 1.0), [None, None, 'sh', 's', 'ch', 'd', 'b'][r.integers(7)])
            t += d + 0.01
        if r.random() < excl:  # an exclamation: "aiya~"
            v.add(t, 0.12, 'ai', 1.35, 1.5, 1.0, None); v.add(t + 0.13, 0.42, 'a', 1.55, 1.05, 1.0, None); t += 0.6
        t += r.uniform(0.08, 0.35)


mix = np.zeros((N, 2))

# 1. pork seller, left: loud yelled slogan, we pass him at ~3-4.5 s
m1 = Voice(165, 1.0, rough=0.2, bright=1.4, seed=1)
slogan(m1, 0.4, 7.6, 2.1, [(0.13, 'a', 1.2, 1.25, 1.0, 'd'), (0.13, 'i', 1.3, 1.3, 0.9, 'sh'), (0.16, 'o', 1.25, 1.2, 1.0, None), (0.12, 'e', 1.15, 1.2, 0.9, 'ch'), (0.62, 'a', 1.45, 0.95, 1.0, 'd')])
g1 = 0.28 + 0.4 * np.exp(-0.5 * ((T - 3.9) / 1.1) ** 2)
mix += pan(m1.render() * g1, np.clip(-0.35 - 0.12 * T, -0.95, 0))

# 2. battery megaphone on a vegetable stall, right, looping the same recorded slogan
mg = Voice(150, 1.0, rough=0.1, bright=1.2, seed=2)
slogan(mg, 0.0, 8.0, 1.75, [(0.1, 'i', 1.1, 1.1, 1.0, 's'), (0.1, 'a', 1.2, 1.2, 1.0, 'b'), (0.1, 'u', 1.1, 1.1, 0.9, 'sh'), (0.1, 'a', 1.25, 1.2, 1.0, 'd'), (0.12, 'i', 1.3, 1.3, 1.0, 'ch'), (0.45, 'ai', 1.3, 1.0, 1.0, None)], jitter=0.0)
meg = mg.render(); meg = bp(meg, 480, 3800, 3); meg = np.tanh(meg / np.abs(meg).max() * 5); meg = bp(meg, 400, 4200)
mix += pan(meg / np.abs(meg).max() * (0.16 + 0.1 * np.exp(-0.5 * ((T - 1.2) / 1.3) ** 2)), 0.45)

# 3. granny haggling with the woman selling red goods (right), alternating, overlapping
gr = Voice(330, 1.18, rough=1.0, bright=1.3, seed=3)
ve = Voice(245, 1.12, rough=0.2, bright=1.2, seed=4)
t = 0.9
while t < 6.2:
    s0 = t; chatter_end = t + R.uniform(0.5, 0.9)
    chatter(gr, s0, chatter_end, rate=1.2, hi=1.35, lo=0.95, busy=1.0, excl=0.35)
    t = chatter_end + R.uniform(-0.1, 0.05)
    ce = t + R.uniform(0.45, 0.8)
    chatter(ve, t, ce, rate=1.25, hi=1.3, lo=0.95, busy=1.0, excl=0.2)
    t = ce + R.uniform(-0.08, 0.1)
gpan = np.clip(0.2 + 0.12 * T, 0, 0.9)
mix += pan(gr.render() * (0.3 + 0.15 * np.exp(-0.5 * ((T - 2.4) / 1.2) ** 2)), gpan)
mix += pan(ve.render() * 0.24, gpan + 0.1)

# 4. another granny calling out to someone down the street (long high "wei~ ... aiyo~")
g2 = Voice(360, 1.2, rough=1.2, bright=1.2, seed=5)
for t0 in (1.6, 4.9):
    g2.add(t0, 0.1, 'e', 1.3, 1.45, 1.0, None); g2.add(t0 + 0.11, 0.55, 'i', 1.55, 1.15, 1.0, None)
    g2.add(t0 + 0.8, 0.12, 'ai', 1.3, 1.5, 0.9, None); g2.add(t0 + 0.93, 0.5, 'o', 1.5, 1.0, 0.9, None)
mix += pan(g2.render() * 0.2, -0.25)

# 5. a man further down yelling a price slogan
m2 = Voice(175, 1.0, rough=0.3, bright=1.3, seed=6)
slogan(m2, 0.2, 8.0, 2.6, [(0.15, 'e', 1.2, 1.25, 1.0, 'sh'), (0.15, 'a', 1.3, 1.3, 1.0, 'b'), (0.5, 'u', 1.4, 1.0, 1.0, 'ch')])
mix += pan(lp(m2.render(), 7000) * 0.13, -0.7)

# 5b. LONG yells layered over the short ones: drawn-out hawking calls held for 1-2 s
def long_call(v, t0, pickup, hold, vowel, p_top, p_end, amp=1.0, cons='d'):
    t = t0
    for (d, vw, p) in pickup:  # quick lead-in syllables
        v.add(t, d, vw, p, p * 1.03, amp * 0.9, cons); t += d + 0.012
    v.add(t, hold, vowel, p_top, p_end, amp, None)  # the long held yell, rise then long fall
    return t + hold


L1 = Voice(172, 1.0, rough=0.35, bright=1.5, seed=21)          # man, mid-left
long_call(L1, 0.25, [(0.12, 'e', 1.25)], 1.6, 'a', 1.55, 1.05)
long_call(L1, 2.55, [(0.11, 'i', 1.3), (0.11, 'a', 1.35)], 1.9, 'ai', 1.6, 1.0)
long_call(L1, 5.25, [(0.12, 'o', 1.3)], 1.5, 'a', 1.5, 1.1)
mix += pan(L1.render() * 0.26, -0.45)

L2 = Voice(188, 1.0, rough=0.4, bright=1.4, seed=22)           # man further down, right
long_call(L2, 1.15, [(0.13, 'a', 1.2)], 2.0, 'o', 1.5, 0.95, cons='sh')
long_call(L2, 4.35, [(0.12, 'u', 1.25), (0.12, 'a', 1.3)], 2.2, 'a', 1.55, 0.95, cons='b')
long_call(L2, 7.05, [(0.12, 'e', 1.2)], 0.85, 'a', 1.45, 1.2)
mix += pan(lp(L2.render(), 8500) * 0.2, 0.7)

L3 = Voice(352, 1.2, rough=1.3, bright=1.3, seed=23)           # granny, high and wobbly "wei~~~"
long_call(L3, 0.8, [(0.1, 'e', 1.3)], 1.3, 'i', 1.5, 1.1, cons=None)
long_call(L3, 3.4, [(0.1, 'ai', 1.35)], 1.6, 'e', 1.55, 1.05, cons=None)
long_call(L3, 6.2, [(0.1, 'e', 1.3)], 1.4, 'o', 1.45, 1.0, cons=None)
mix += pan(L3.render() * 0.22, 0.25)

L4 = Voice(262, 1.12, rough=0.3, bright=1.3, seed=24)          # woman vendor, sing-song two-note call
for t0 in (2.0, 5.6):
    t = long_call(L4, t0, [(0.12, 'a', 1.2), (0.12, 'i', 1.3)], 0.75, 'ai', 1.45, 1.35, cons='ch')
    long_call(L4, t + 0.05, [], 1.1, 'a', 1.2, 0.9)
mix += pan(L4.render() * 0.2, 0.5)

# 6. bright crowd bed: many people talking loudly
for v in range(18):
    kind = R.random()
    f0 = R.uniform(115, 150) if kind < 0.4 else (R.uniform(300, 360) if kind < 0.65 else R.uniform(200, 260))
    vo = Voice(f0, 1.0 if f0 < 170 else 1.15, rough=0.8 if f0 > 290 else 0.2, bright=1.0, seed=100 + v)
    chatter(vo, R.uniform(0, 0.5), 8.0, rate=R.uniform(0.9, 1.2), hi=1.3, lo=0.9, busy=R.uniform(0.5, 0.85), excl=0.2)
    mix += pan(lp(vo.render(), 8000) * R.uniform(0.05, 0.1), R.uniform(-0.95, 0.95))

# non-voice: cleaver on the block (left, as we pass), scooter beep, shuffles, our footsteps
for tc in [3.2, 3.5, 3.8, 4.1, 4.4]:
    L = S(0.15); k = np.arange(L) / SR
    chop = bp(R.standard_normal(L), 900, 6000) * np.exp(-k / 0.008) * 1.2 + np.sin(2 * np.pi * 175 * k) * np.exp(-k / 0.03) * 0.8
    i0 = S(tc); mix[i0:i0 + L] += pan(chop * 0.22, -0.8)
for tc, d in [(3.7, 0.12), (3.9, 0.16)]:
    L = S(d); k = np.arange(L) / SR
    b = signal.square(2 * np.pi * 1850 * k, 0.5) * np.minimum(1, k / 0.004) * np.minimum(1, (d - k) / 0.01)
    i0 = S(tc); mix[i0:i0 + L] += pan(bp(b, 900, 5000) * 0.1, 0.55)
for i in range(120):
    tc = R.uniform(0, DUR); L = S(0.06); k = np.arange(L) / SR
    i0 = S(tc)
    if i0 + L < N: mix[i0:i0 + L] += pan(bp(R.standard_normal(L), 700, 4000) * np.exp(-k / 0.012) * R.uniform(0.004, 0.012), R.uniform(-1, 1))

# stepping into the shop: the street stays clear, just a bit quieter (no muffling)
g = np.clip((T - DOOR_T) / 0.45, 0, 1)
mix *= (1 - 0.45 * g)[:, None]
for tf in np.arange(0.35, DUR, 0.47):
    L = S(0.09); k = np.arange(L) / SR; inside = tf > DOOR_T
    stp = bp(R.standard_normal(L), 900 if not inside else 1800, 5000 if not inside else 8000) * np.exp(-k / (0.014 if not inside else 0.008)) + np.sin(2 * np.pi * 90 * k) * np.exp(-k / 0.02) * 0.5
    i0 = S(tf)
    if i0 + L < N: mix[i0:i0 + L] += pan(stp * 0.06, 0)
hum = (np.sin(2 * np.pi * 100 * T) + 0.4 * np.sin(2 * np.pi * 200 * T)) * 0.02
mix += pan(hum * g, 0.3)
# a clerk shouting a price inside
ck = Voice(250, 1.12, rough=0.3, bright=1.3, seed=9)
ck.add(6.5, 0.12, 'e', 1.2, 1.25, 1, 'sh'); ck.add(6.63, 0.12, 'a', 1.3, 1.3, 1, 'b'); ck.add(6.76, 0.45, 'ai', 1.4, 1.0, 1, None)
mix += pan(ck.render() * 0.2 * g, 0.4)

fade = np.ones(N); fade[:S(0.25)] = np.linspace(0, 1, S(0.25)); fade[-S(0.35):] = np.linspace(1, 0, S(0.35))
mix *= fade[:, None]
mix *= 10 ** (-16 / 20) / np.sqrt((mix[:S(DOOR_T)] ** 2).mean())
mix = np.tanh(mix * 1.2) / 1.2
mix *= min(1.0, 10 ** (-1 / 20) / np.abs(mix).max())
wavfile.write('out/market_sound_v2.wav', SR, (mix * 32767).astype(np.int16))
print('ok rms', 20 * np.log10(np.sqrt((mix ** 2).mean())))
