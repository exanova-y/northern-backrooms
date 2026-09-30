"""Dry crowd soundtrack for scenes/market2.js (8 s): street market babble, vendors, cleaver, scooter beep,
footsteps; then muffled inside the grocery after the door. No reverb anywhere.  -> out/market_sound.wav"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 8.0
DOOR_T = 5.9
N = int(SR * DUR)
rng = np.random.default_rng(2026)
S = lambda s: int(round(s * SR))


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'low', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x)


def pan(m, p):
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)], 1)


VOWELS = [(800, 1200, 2500), (300, 2300, 3000), (330, 850, 2400), (500, 1800, 2600), (520, 920, 2500), (650, 1700, 2500), (400, 1600, 2600)]


def voice(n, r, f0, rate=5.0, busy=0.75, shout=False):
    """unintelligible speech: glottal buzz through moving formants, syllables grouped into phrases"""
    t = np.arange(n) / SR
    env = np.zeros(n); vowel_idx = np.zeros(n, dtype=int); cons = np.zeros(n)
    pos = r.uniform(0, 0.6)
    while pos < n / SR:
        if r.random() > busy: pos += r.uniform(0.3, 1.2); continue
        for _ in range(r.integers(2, 9)):  # a phrase
            d = r.uniform(0.09, 0.22) * (1.8 if shout else 1)
            i0, i1 = S(pos), min(n, S(pos + d))
            if i0 >= n: break
            k = np.arange(i1 - i0) / SR
            env[i0:i1] = np.maximum(env[i0:i1], np.sin(np.pi * k / d) ** 0.6 * r.uniform(0.6, 1.0))
            vowel_idx[i0:i1] = r.integers(0, len(VOWELS))
            if r.random() < 0.45: cons[i0:min(n, i0 + S(0.035))] = 1
            pos += d + r.uniform(0.0, 0.05)
        pos += r.uniform(0.15, 0.7)
    # intonation
    k = int(DUR * 3) + 4; pts = r.standard_normal(k)
    contour = np.interp(t, np.linspace(0, DUR, k), pts) * (0.12 if not shout else 0.2)
    f = f0 * (1 + contour) * (1 + 0.01 * np.sin(2 * np.pi * 5.5 * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    src = signal.sawtooth(ph, 0.1) + 0.3 * signal.square(ph, 0.3)
    out = np.zeros(n); block = 480
    zis = [np.zeros((1, 2)) for _ in range(3)]
    for b0 in range(0, n, block):
        v = VOWELS[vowel_idx[b0]]
        seg = src[b0:b0 + block]; acc = np.zeros(len(seg))
        for j, (fc, g) in enumerate(zip(v, (1.0, 0.6, 0.25))):
            sos = signal.butter(1, [fc * 0.86, fc * 1.14], 'band', fs=SR, output='sos')
            y, zis[j] = signal.sosfilt(sos, seg, zi=zis[j]); acc += y * g
        out[b0:b0 + block] = acc
    out = lp(out, 5000) * env
    out += bp(r.standard_normal(n), 3000, 7500) * cons * 0.12
    return out / (np.abs(out).max() + 1e-9)


outside = np.zeros((N, 2))
# distant crowd: many far voices, low-passed, spread
for v in range(34):
    male = rng.random() < 0.5
    vo = voice(N, rng, rng.uniform(95, 140) if male else rng.uniform(175, 250), busy=rng.uniform(0.5, 0.9))
    vo = lp(vo, rng.uniform(1800, 3200))
    outside += pan(vo * rng.uniform(0.04, 0.09), rng.uniform(-0.9, 0.9))
# near voices (people the camera passes)
for p0, gain in [(-0.6, 0.22), (0.5, 0.2), (-0.3, 0.17), (0.7, 0.18), (0.1, 0.14), (-0.8, 0.16)]:
    male = rng.random() < 0.5
    vo = voice(N, rng, rng.uniform(100, 135) if male else rng.uniform(185, 240), busy=0.7)
    outside += pan(vo * gain, p0)
# vendors hawking: the pork seller on the left, a woman selling on the right
tt = np.arange(N) / SR
v1 = voice(N, np.random.default_rng(7), 128, busy=0.95, shout=True) * np.clip((tt - 0.6) / 0.3, 0, 1) * np.clip((3.4 - tt) / 0.5, 0, 1)
outside += pan(v1 * 0.3, -0.55 - 0.3 * np.clip((tt - 1.5) / 2, 0, 1))
v2 = voice(N, np.random.default_rng(8), 232, busy=0.9, shout=True) * np.clip((tt - 3.2) / 0.3, 0, 1) * np.clip((5.6 - tt) / 0.5, 0, 1)
outside += pan(v2 * 0.22, 0.5)
# crowd footsteps / shuffles
for i in range(140):
    tc = rng.uniform(0, DUR); L = S(0.06); k = np.arange(L) / SR
    st = bp(rng.standard_normal(L), 700, 4000) * np.exp(-k / 0.012)
    i0 = S(tc)
    if i0 + L < N: outside[i0:i0 + L] += pan(st * rng.uniform(0.004, 0.015), rng.uniform(-1, 1))
# cleaver on the chopping block as we pass the pork stall
for tc in [1.9, 2.25, 2.6, 2.95, 3.3]:
    L = S(0.15); k = np.arange(L) / SR
    chop = bp(rng.standard_normal(L), 900, 6000) * np.exp(-k / 0.008) * 1.2 + np.sin(2 * np.pi * 175 * k) * np.exp(-k / 0.03) * 0.8 + np.sin(2 * np.pi * 620 * k) * np.exp(-k / 0.02) * 0.3
    i0 = S(tc); outside[i0:i0 + L] += pan(chop * 0.2, -0.75)
# plastic bag rustles
for tc in [0.9, 4.3]:
    L = S(0.5); k = np.arange(L) / SR
    cr = hp((rng.random(L) < 0.03) * rng.standard_normal(L), 2500) * np.sin(np.pi * k / 0.5)
    i0 = S(tc); outside[i0:i0 + L] += pan(cr * 0.06, 0.35)
# electric scooter beep-beep (dry, fairly close, right)
for tc, d in [(3.7, 0.12), (3.9, 0.16)]:
    L = S(d); k = np.arange(L) / SR
    b = signal.square(2 * np.pi * 1850 * k, 0.5) * np.minimum(1, k / 0.004) * np.minimum(1, (d - k) / 0.01)
    i0 = S(tc); outside[i0:i0 + L] += pan(bp(b, 900, 5000) * 0.12, 0.55)

# door transition: outside muffles and drops as we step into the shop
g = np.clip((tt - DOOR_T) / 0.45, 0, 1)
muff = np.stack([lp(outside[:, c], 900) for c in range(2)], 1)
outside = outside * (1 - g)[:, None] + muff * (0.3 * g)[:, None]

mix = outside
# our own footsteps: concrete outside, harder tile inside
for tf in np.arange(0.35, DUR, 0.47):
    L = S(0.09); k = np.arange(L) / SR
    inside = tf > DOOR_T
    stp = bp(rng.standard_normal(L), 900 if not inside else 1800, 5000 if not inside else 8000) * np.exp(-k / (0.014 if not inside else 0.008)) + np.sin(2 * np.pi * 90 * k) * np.exp(-k / 0.02) * 0.5
    i0 = S(tf)
    if i0 + L < N: mix[i0:i0 + L] += pan(stp * 0.07, rng.uniform(-0.1, 0.1))
# inside: fridge hum + fluorescent buzz + a couple of quiet voices
hum = (np.sin(2 * np.pi * 100 * tt) + 0.4 * np.sin(2 * np.pi * 200 * tt) + 0.15 * np.sin(2 * np.pi * 300 * tt)) * 0.03
buzz = bp(signal.sawtooth(2 * np.pi * 120 * tt), 1500, 4000) * 0.01
iv = voice(N, np.random.default_rng(12), 210, busy=0.6) * 0.07 + voice(N, np.random.default_rng(13), 118, busy=0.5) * 0.06
mix += pan((hum + buzz) * g, 0.3) + pan(iv * g, -0.2)

fade = np.ones(N); fade[:S(0.3)] = np.linspace(0, 1, S(0.3)); fade[-S(0.4):] = np.linspace(1, 0, S(0.4))
mix *= fade[:, None]
mix *= 10 ** (-19 / 20) / np.sqrt((mix[:S(DOOR_T)] ** 2).mean())
mix = np.tanh(mix * 1.1) / 1.1
mix *= min(1.0, 10 ** (-1 / 20) / np.abs(mix).max())
wavfile.write('out/market_sound.wav', SR, (mix * 32767).astype(np.int16))
print('ok', 20 * np.log10(np.sqrt((mix ** 2).mean())))
