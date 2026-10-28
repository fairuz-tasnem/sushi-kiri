"""Original synthesized Sushi Kiri audio. Requires numpy and ffmpeg; no samples.
Run from any directory with: python scripts/generate_audio.py
"""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / 'public/game-assets/audio'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(471)


def pitch(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def pluck(midi, seconds, volume=1):
    t = np.arange(int(RATE * seconds)) / RATE
    f = pitch(midi)
    # Soft mallet/plucked-string timbre; quick attack, no hard sample edges.
    env = (1 - np.exp(-t * 180)) * np.exp(-t * 6 / seconds)
    signal = np.sin(2 * np.pi * f * t) + .24 * np.sin(2 * np.pi * f * 2 * t) + .08 * np.sin(2 * np.pi * f * 3 * t)
    return volume * env * signal


def place(track, sound, start):
    index = int(start * RATE)
    # Wrap reverb tails into the beginning for a seamless loop.
    indices = (index + np.arange(len(sound))) % len(track)
    np.add.at(track, indices, sound)


def save(name, signal, peak=.7):
    maximum = max(.001, float(np.max(np.abs(signal))))
    signal = signal / maximum * peak
    with tempfile.NamedTemporaryFile(suffix='.wav') as temp:
        with wave.open(temp.name, 'wb') as w:
            w.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            w.writeframes((np.clip(signal, -1, 1) * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', temp.name, '-c:a', 'libvorbis', '-q:a', '3', str(OUT / (name + '.ogg'))], check=True)


def music(name, bpm, energetic):
    beat = 60 / bpm
    track = np.zeros(round(RATE * beat * 32))
    # Eight-bar D-pentatonic phrase over D, G, Bm, A; original motif.
    roots = [50, 50, 55, 55, 47, 47, 57, 57]
    phrases = [[74, 78, 81, 78], [76, 74, 69, 0], [79, 81, 83, 81], [78, 76, 74, 0],
               [78, 81, 86, 83], [81, 78, 76, 0], [76, 81, 78, 76], [74, 69, 74, 0]]
    for bar, root in enumerate(roots):
        for step, note in enumerate(phrases[bar]):
            if note:
                sound = pluck(note, beat * 1.6, .20)
                start = (bar * 4 + step) * beat
                place(track, sound, start)
                place(track, sound * .15, start + beat * .75)
        for step in [0, 2]:
            place(track, pluck(root, beat * 1.4, .22), (bar * 4 + step) * beat)
        if energetic:
            for step in range(8):
                t = np.arange(int(RATE * .05)) / RATE
                tick = rng.normal(0, 1, len(t)) * np.exp(-t * 100) * .018
                place(track, tick, (bar * 4 + step / 2) * beat)
            for step in [1, 3]:
                place(track, pluck(86, .07, .035), (bar * 4 + step) * beat)
    save(name, track, .38)


# Slow pentatonic plucks over a soft breath-like pad: original calm menu bed.
track = np.zeros(RATE * 32)
for i, note in enumerate([62, 69, 74, 66, 69, 76, 74, 69]):
    place(track, pluck(note, 3.2, .15), i * 4)
    place(track, pluck(note + 12, 2.2, .035), i * 4 + .7)
t = np.arange(len(track)) / RATE
for note in [50, 57, 62]:
    track += .014 * np.sin(2 * np.pi * pitch(note) * t) * np.sin(np.pi * t / 32) ** 2
save('bgm-menu', track, .3)
# Short airy slice: differentiated from the lower hazard thud.
t = np.arange(int(RATE * .16)) / RATE
noise = rng.normal(0, 1, len(t))
noise = np.convolve(noise, np.ones(4) / 4, 'same')
# Slicing uses the user-supplied rubber-pop.mp3.
# Pitch-falling pop for buttons.
t = np.arange(int(RATE * .08)) / RATE
save('ui-click', np.sin(2 * np.pi * (800 * t - 2800 * t * t)) * (1 - np.exp(-t * 500)) * np.exp(-t * 65), .38)
for name, notes, spacing, duration in [
    ('soy-bonus', [81, 86, 90], .075, .4),
    ('exit', [81, 74], .14, .5),
    ('game-start', [69, 74, 81], .11, .45),
    ('wasabi-hit', [42, 38], .07, .22),
]:
    track = np.zeros(int(RATE * (len(notes) * spacing + duration)))
    for i, note in enumerate(notes):
        sound = pluck(note, duration, .5)
        start = int(i * spacing * RATE)
        track[start:start + len(sound)] += sound
    save(name, track, .5)
print('Created', len(list(OUT.glob('*.ogg'))), 'original audio assets.')
