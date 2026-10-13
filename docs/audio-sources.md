# Bloom relaxing sounds — sources and redistribution

Verified 2026-10-13 from each original Freesound upload page, including its CC0 link.
All four recordings are dedicated under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Commercial use, modification and redistribution are permitted. Attribution is not
required by CC0; the credits below are retained voluntarily. No account, copyrighted
music, unverified mirror, or proprietary stock-audio license was used.

| Bundled recording | Original title / author | Original upload and license evidence | Downloaded Freesound HQ derivative |
| --- | --- | --- | --- |
| `ocean.wav` | Ocean waves crushing on the chilean shore. — **felix.blume** | [Freesound #155641](https://freesound.org/people/felix.blume/sounds/155641/) | [HQ MP3](https://cdn.freesound.org/previews/155/155641_1661766-hq.mp3) |
| `rain.wav` | rain against window 2 — **bastipictures** | [Freesound #243781](https://freesound.org/people/bastipictures/sounds/243781/) | [HQ MP3](https://cdn.freesound.org/previews/243/243781_997601-hq.mp3) |
| `fire.wav` | Fireplace — **tripjazz** | [Freesound #394754](https://freesound.org/people/tripjazz/sounds/394754/) | [HQ MP3](https://cdn.freesound.org/previews/394/394754_7473420-hq.mp3) |
| `forest.wav` | Crickets Night 2 — **PhilllChabbb** | [Freesound #245834](https://freesound.org/people/PhilllChabbb/sounds/245834/) | [HQ MP3](https://cdn.freesound.org/previews/245/245834_4205952-hq.mp3) |

The HQ MP3 derivatives are served directly by Freesound and carry the upload's CC0
dedication. The repository contains processed WAVs, not the unmodified uploads.
License-relevant HTML snippets and retrieval/source hashes are preserved in
[license evidence](qa/relaxing-sounds/license-evidence.json). Check that evidence
and the original pages when replacing a recording; a similarly named file is not
proof of permission.

Processing: decode up to the first 42 seconds; convert to stereo 22,050 Hz 16-bit PCM;
blend the last two seconds into the first two seconds and remove the overlapped
beginning; normalize peak amplitude to 0.60. Final durations are 40 seconds for
ocean, rain and forest, and about 23.228 seconds for fireplace. PCM avoids MP3 encoder
padding at loop boundaries. `scripts/prepare-relaxing-audio.py` reproduces these
changes with temporary NumPy/imageio-ffmpeg dependencies. No processing tool is an
application dependency. [Asset manifest](qa/relaxing-sounds/audio-assets.json)
records exact download/output hashes, durations, byte sizes and seam sample deltas.

The forest recording is a night cricket ambience, not a verified recording made
inside a forest; no additional synthetic wind or invented recording provenance is
claimed. The visual theme and reference descriptive copy are preserved separately
from source provenance. All audio is bundled and plays offline in packaged builds;
the app never contacts Freesound during playback.
