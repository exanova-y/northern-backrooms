# Northern Expansion Pack

First-person liminal walkthroughs in the style of LENINROOMS, built as low-poly three.js scenes. Everything is procedural: textures are painted in code, the people are simple jointed figures, and the audio is synthesized from noise and oscillators. There are no downloaded assets.

The reel is 45 seconds at 1600×900 and 24 fps:

| # | Scene (`scenes/…`) | Window used | What it is |
|---|---|---|---|
| 1 | `road.js` | 6–11 s | Smoggy poplar road, plastic-film fields, wheat drying on the asphalt, squatting smokers, blue three-wheeler |
| 2 | `village.js` | 6–11 s | Village lane: tiled houses, solar heaters, dried corn, cooking smoke, seed shells, men squatting, old man with a palm-leaf fan |
| 3 | `park.js` | 8–13 s | Defunct people's park: statue, dry fountain, rusty swings with kids, sunburst billboard, Ferris wheel in the smog |
| 4 | `wedding.js` | 10–15 s | Pre-dawn wedding: firecracker string burning toward the camera, inflatable arch, lanterns, smoke |
| 5 | `kyiv.js` | 0–10 s | Snowy Kyiv metro: bridge station, blue-and-yellow train, exit stairs under the polycarbonate canopy, old-town street |
| 6 | `toronto.js` | 0–5 s | Skating toward Old City Hall through the lattice arch in heavy snow |
| 7 | `waterloo.js` | 0–5 s | Campus ring road, Canada geese on the lawn and one hissing on the sidewalk, brick smokestack |
| 8 | `flowers.js` | 0–5 s | Running between rainbow tulip bands toward snowy mountains |

Other files in `scenes/`:
- `metro.js`: the autumn version of the Kyiv platform. It also exports the train builder.
- `ontario.js`: the Lake Ontario shoreline. It also exports the Canada goose.
- `figs.js`: a lineup of every figure pose, for checking the figures.

## Requirements

- Node 18+ and Python 3 with `numpy` and `scipy`.
- `ffmpeg` on your PATH.
- Chromium via Playwright (`npx playwright install chromium`). No GPU is needed, because it renders with SwiftShader.
- For the CJK font check on page load: any Noto CJK font. Without one it falls back silently.

```bash
npm install
npx playwright install chromium
pip install numpy scipy
```

## Usage

```bash
./build_reel.sh                        # render all windows, make the soundtrack, assemble out/northern_expansion_pack.mp4
SKIP_RENDER=1 ./build_reel.sh          # just re-assemble (e.g. after editing sound.py)
W=1920 H=1080 ./build_reel.sh          # another resolution

node render.mjs kyiv --stills 0.5,5,9.8 --aa 0 --fxaa 1 --w 1600 --h 900   # preview frames -> out/kyiv_<t>.jpg
node render.mjs toronto --fps 24 --aa 0 --fxaa 1 --w 1600 --h 900 --out out/toronto.mp4
```

The renderer caches frames in `out/frames/<scene>_<W>/`. An interrupted render resumes where it stopped. After you change a scene, delete that folder to re-render it. On a 2-core CPU a frame takes about 1 to 2.5 seconds.

## How it fits together

- **`index.html`** loads `scenes/<name>.js`. It exposes `window.renderAt(t)` and draws each frame through an FXAA pass.
- **`render.mjs`** serves the folder locally and drives headless Chromium. It renders deterministic frames at `t = i / fps` and pipes them to ffmpeg, which adds a vignette and light grain.
- **`lib.js`** is the shared toolkit:
  - seeded random numbers and value noise
  - procedural textures (peeling paint, concrete, asphalt, snow, tiles, rust, litter)
  - sky dome and a sun that casts shadows and follows the camera
  - `pathCam`, an eased camera glide along a spline with head bob and look keyframes
  - smoke sprites
  - jointed people (stand, squat, sit, low sit, with arm variants and cigarettes)
  - poplars, loudspeaker poles, solar heaters, corn strings, palm fans, thermoses, stools
- **Each scene** exports `DUR` and `build({renderer, scene, camera})`. `build` returns `update(t)`, and everything in the scene is a pure function of `t`.
- **`sound.py`** builds `out/soundtrack.wav` scene by scene. The sounds are timed to the picture by copying the scenes' own maths:
  - the wind bed
  - cicadas
  - tractor, truck and horn on the road
  - fan swishes
  - swing creaks at the ends of the swing's arc
  - firecracker bangs, one per flash frame (same hash as `wedding.js`)
  - Kyiv ambience
  - skate strokes (same sway rate as `toronto.js`)
  - bell tolls
  - footsteps from the `pathCam` easing
  - goose honks and hiss, car pass, skylarks, bee
  
  Each scene is mixed to a target loudness. The bus horn is added after that, so it stays loud and dry.
- **`wind.py`** is a standalone generator for the gusting wind track used in earlier cuts.

To add a scene, write `scenes/foo.js` in the same shape. Then add a line to `SCENES` in `build_reel.sh`, and add it to `ORDER` and `DURS` in `sound.py`, giving it its own block of sounds.

## Standalone clips (added later)

| Scene | Length | Render |
|---|---|---|
| `uzbek.js` | 5 s | looks down at plov, manti, samsa, then tilts up into the room |
| `market2.js` | 8 s | Shandong market street into the grocery (`market.js` is the older version and supplies its textures) |
| `arctic.js` | 5 s | Arctic port town seen from the hill road |
| `kotel.js` | 5 s | the Western Wall, close up |

```bash
node render.mjs market2 --fps 24 --aa 0 --fxaa 1 --w 1600 --h 900 --out out/clips/meat_market_silent.mp4
python3 scenes/market_sound2.py   # -> out/market_sound_v2.wav (yelling crowd, long calls; market_sound.py = v1)
ffmpeg -i out/clips/meat_market_silent.mp4 -i out/market_sound_v2.wav -c:v copy -c:a aac -shortest out/clips/meat_market.mp4
```
