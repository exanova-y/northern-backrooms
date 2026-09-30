"""Synthesize a gusting wind bed (stereo, 48 kHz) -> out/wind.wav"""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR, DUR = 48000, 60.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
t = np.arange(N) / SR


def smooth_noise(rate_hz, seed):
    """very slow random curve in ~[-1, 1]"""
    r = np.random.default_rng(seed)
    k = int(DUR * rate_hz) + 4
    pts = r.standard_normal(k)
    x = np.linspace(0, k - 3.001, N)
    i = np.floor(x).astype(int); f = x - i
    # cubic (Catmull-Rom) interpolation
    p0, p1, p2, p3 = pts[i], pts[i + 1], pts[i + 2], pts[i + 3]
    y = 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f ** 3)
    return y / (np.abs(y).max() + 1e-9)


def tv_bandpass(x, fc, q, block=256):
    """time-varying 2nd-order bandpass, coefficients updated per block"""
    y = np.zeros_like(x); zi = np.zeros((1, 2))
    for s in range(0, len(x), block):
        f = float(np.clip(fc[s], 40, SR / 2 - 100))
        sos = signal.butter(1, [f / (1 + 0.5 / q), f * (1 + 0.5 / q)], btype='band', fs=SR, output='sos')
        y[s:s + block], zi = signal.sosfilt(sos, x[s:s + block], zi=zi)
    return y


gust = smooth_noise(0.18, 1) * 0.6 + smooth_noise(0.5, 2) * 0.4
gust = np.clip(0.55 + 0.45 * gust, 0.12, 1.0)  # 0.12..1 intensity

chans = []
common = rng.standard_normal(N)
for ch in range(2):
    white = 0.6 * common + 0.8 * rng.standard_normal(N)
    # body of the wind: bandpass sweeping with gust strength
    fc = 260 + 520 * gust + 60 * smooth_noise(0.9, 10 + ch)
    body = tv_bandpass(white, fc, q=0.9)
    # higher airy hiss
    hiss = signal.sosfilt(signal.butter(2, [1500, 6000], btype='band', fs=SR, output='sos'), white)
    # faint whistle in the gusts (wires / poplar leaves)
    wf = 780 + 420 * smooth_noise(0.25, 20 + ch)
    whistle = tv_bandpass(rng.standard_normal(N), wf, q=14)
    # low rumble (brown noise, lowpassed)
    brown = signal.sosfilt(signal.butter(1, 8, 'high', fs=SR, output='sos'), np.cumsum(rng.standard_normal(N)))
    rumble = signal.sosfilt(signal.butter(2, 110, 'low', fs=SR, output='sos'), brown)
    rumble /= np.abs(rumble).max() + 1e-9
    g = gust if ch == 0 else np.roll(gust, int(0.35 * SR))  # gusts arrive slightly offset per ear
    mix = (body / np.std(body)) * (0.25 + 0.75 * g ** 1.6) \
        + (hiss / np.std(hiss)) * 0.18 * g ** 2 \
        + (whistle / np.std(whistle)) * 0.12 * np.clip(g - 0.55, 0, 1) * 2 \
        + rumble * 0.9 * (0.6 + 0.4 * g)
    chans.append(mix)

out = np.stack(chans, 1)
fade = np.ones(N); fi, fo = int(1.2 * SR), int(2.0 * SR)
fade[:fi] = np.linspace(0, 1, fi) ** 2; fade[-fo:] = np.linspace(1, 0, fo) ** 2
out *= fade[:, None]
out *= 10 ** (-4 / 20) / np.abs(out).max()  # peak -4 dBFS
wavfile.write('out/wind.wav', SR, (out * 32767).astype(np.int16))
print('ok', out.shape, 'rms dBFS', 20 * np.log10(np.sqrt((out ** 2).mean())))
