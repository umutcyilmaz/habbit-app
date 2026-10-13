"""Process verified Freesound HQ MP3 derivatives (see audio-sources.md).
Usage: python prepare-relaxing-audio.py /path/to/verified/downloads
Temporary build dependencies: numpy, imageio-ffmpeg. Not app dependencies.
"""
import sys, subprocess, wave, hashlib, json
from pathlib import Path
import numpy as np
import imageio_ffmpeg
source = Path(sys.argv[1])
target = Path('src/features/relaxing-sounds/assets')
manifest = {}
for name in ['ocean', 'rain', 'fire', 'forest']:
    original = source / (name + '.mp3')
    raw = subprocess.check_output([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', str(original), '-t', '42', '-f', 'f32le', '-ac', '2', '-ar', '22050', '-'])
    a = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).copy()
    n = 2 * 22050
    # End blends into the removed beginning; output starts at that blend's end.
    weights = np.linspace(0, 1, n, endpoint=False)[:, None]
    a[-n:] = a[-n:] * (1-weights) + a[:n] * weights
    a = a[n:]
    a *= .60 / max(float(np.max(np.abs(a))), .001)
    out = target / (name + '.wav')
    with wave.open(str(out), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(22050)
        w.writeframes((np.clip(a, -1, 1) * 32767).astype('<i2').tobytes())
    manifest[name] = {'downloadSha256': hashlib.sha256(original.read_bytes()).hexdigest(), 'bundledSha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'seconds': len(a)/22050, 'bytes': out.stat().st_size, 'peak': .60, 'seamMaxSampleDelta': float(np.max(np.abs(a[-1]-a[0])))}
Path('docs/qa/relaxing-sounds/audio-assets.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest, indent=2))
