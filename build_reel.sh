#!/usr/bin/env bash
# Renders every scene window, generates the soundtrack and assembles the reel.
# Usage:  ./build_reel.sh            (render + sound + assemble)
#         SKIP_RENDER=1 ./build_reel.sh   (re-assemble from existing frames)
#         W=1920 H=1080 ./build_reel.sh   (other resolution)
set -euo pipefail
cd "$(dirname "$0")"
W=${W:-1600}; H=${H:-900}; FPS=24
OPTS="--fps $FPS --aa 0 --fxaa 1 --w $W --h $H"

# name  start(s)  length(s)   -- order = order in the reel; keep in sync with ORDER/DURS in sound.py
SCENES=(
  "road 6 5"
  "village 6 5"
  "park 8 5"
  "wedding 10 5"
  "kyiv 0 10"
  "toronto 0 5"
  "waterloo 0 5"
  "flowers 0 5"
)

if [ -z "${SKIP_RENDER:-}" ]; then
  for s in "${SCENES[@]}"; do
    set -- $s
    node render.mjs "$1" $OPTS --from "$2" --to "$(( $2 + $3 ))" --out "out/clip_$1.mp4"
  done
fi

python3 sound.py   # -> out/soundtrack.wav

inputs=(); filt=""; labels=""; total=0; i=0
for s in "${SCENES[@]}"; do
  set -- $s
  inputs+=(-framerate "$FPS" -start_number "$(( $2 * FPS ))" -i "out/frames/$1_${W}/%05d.jpg")
  filt+="[$i:v]trim=end_frame=$(( $3 * FPS )),setpts=PTS-STARTPTS[v$i];"
  labels+="[v$i]"; total=$(( total + $3 )); i=$(( i + 1 ))
done
fade_v=$(python3 -c "print($total - 0.6)"); fade_a=$(python3 -c "print($total - 1.2)")
filt+="${labels}concat=n=$i:v=1:a=0,vignette=PI/5,noise=alls=5:allf=t,fade=t=in:st=0:d=0.4,fade=t=out:st=${fade_v}:d=0.6,format=yuv420p[v];"
filt+="[$i:a]afade=t=out:st=${fade_a}:d=1.2[a]"

ffmpeg -v error -y "${inputs[@]}" -i out/soundtrack.wav -filter_complex "$filt" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 24 -c:a aac -b:a 160k -movflags +faststart \
  -shortest out/northern_expansion_pack.mp4
echo "wrote out/northern_expansion_pack.mp4 (${total}s)"
