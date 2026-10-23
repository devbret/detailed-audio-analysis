import os
import re
import json
import math
import shutil
import librosa
import numpy as np
from tqdm import tqdm
import concurrent.futures

AUDIO_DIR = "audio"
DATA_DIR = "data"
HOP_LENGTH = 512
SCHEMA_VERSION = 2
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
TONNETZ_LABELS = ["P5 x", "P5 y", "m3 x", "m3 y", "M3 x", "M3 y"]


def finite_list(values, decimals):
    arr = np.round(np.asarray(values, dtype=float), decimals)
    out = arr.tolist()
    if not np.isfinite(arr).all():
        out = [v if math.isfinite(v) else None for v in out]
    return out


def series(values, decimals):
    return {"kind": "series", "values": finite_list(values, decimals)}


def events(times, values=None, decimals=2):
    out = {"kind": "events", "times": finite_list(times, 4)}
    if values is not None:
        out["values"] = finite_list(values, decimals)
    return out


def matrix(rows, decimals, labels=None, values=None, unit=None):
    out = {"kind": "matrix", "rows": [finite_list(r, decimals) for r in rows]}
    if labels is not None:
        out["row_labels"] = list(labels)
    if values is not None:
        out["row_values"] = finite_list(values, 1)
    if unit is not None:
        out["row_unit"] = unit
    return out


def hz_label(hz):
    return f"{hz / 1000:.3g}k" if hz >= 1000 else f"{hz:g}"


def contrast_labels(sr, fmin=200.0, n_bands=6):
    edges = [0.0] + [fmin * 2.0**i for i in range(n_bands + 1)]
    edges[-1] = min(edges[-1], sr / 2)
    return [f"{hz_label(lo)}-{hz_label(hi)}" for lo, hi in zip(edges[:-1], edges[1:])]


def slugify(name):
    stem = os.path.splitext(name)[0].lower()
    return re.sub(r"[^a-z0-9]+", "-", stem).strip("-") or "track"


def compute_beats(onset_env, sr, hop_length):
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop_length, units="frames")
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)
    bpm = 60.0 / np.diff(beat_times) if len(beat_times) > 1 else np.array([])
    return events(beat_times[:-1], bpm, 2), float(np.atleast_1d(tempo)[0])


def analyze_audio(file_path, hop_length=HOP_LENGTH):
    y, sr = librosa.load(file_path)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, aggregate=np.median)
    novelty = np.maximum(0, np.diff(onset_env))
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]

    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)

    mfccs = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop_length)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)

    beats, overall_tempo = compute_beats(onset_env, sr, hop_length)

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length)[0]
    zcr = librosa.feature.zero_crossing_rate(y=y, hop_length=hop_length)[0]
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=hop_length)
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]

    mel = librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop_length)
    mel_db = librosa.power_to_db(mel, ref=np.max)
    mel_hz = librosa.mel_frequencies(n_mels=mel.shape[0], fmin=0.0, fmax=sr / 2)

    tonnetz = librosa.feature.tonnetz(y=y, sr=sr, hop_length=hop_length)

    harmonic, percussive = librosa.effects.hpss(y)
    harm_energy = librosa.feature.rms(y=harmonic, hop_length=hop_length)[0]
    perc_energy = librosa.feature.rms(y=percussive, hop_length=hop_length)[0]
    harmonic_ratio = harm_energy / (harm_energy + perc_energy + 1e-8)

    S = np.abs(librosa.stft(y, hop_length=hop_length))
    flux = np.sqrt(np.sum(np.diff(S, axis=1) ** 2, axis=0))

    f0, _, _ = librosa.pyin(
        y,
        fmin=librosa.note_to_hz("C2"),
        fmax=librosa.note_to_hz("C7"),
        sr=sr,
        frame_length=2048,
        hop_length=hop_length,
    )

    centroid_delta = librosa.feature.delta(centroid)

    meta = {
        "sr": int(sr),
        "hop_length": hop_length,
        "duration": float(librosa.get_duration(y=y, sr=sr)),
        "frames": int(len(rms)),
        "overall_tempo": overall_tempo,
    }
    features = {
        "onsets": events(onset_times),
        "beats": beats,
        "onset_strength": series(onset_env, 3),
        "novelty": series(novelty, 3),
        "loudness": series(rms, 5),
        "timbre": matrix(mfccs, 2, labels=[str(i + 1) for i in range(len(mfccs))]),
        "chroma": matrix(chroma, 3, labels=NOTE_NAMES),
        "spectral_centroid": series(centroid, 1),
        "spectral_bandwidth": series(bandwidth, 1),
        "zero_crossing_rate": series(zcr, 4),
        "spectral_contrast": matrix(contrast, 2, labels=contrast_labels(sr), unit="Hz"),
        "spectral_rolloff": series(rolloff, 1),
        "mel_spectrogram": matrix(mel_db, 1, values=mel_hz, unit="Hz"),
        "tonnetz": matrix(tonnetz, 4, labels=TONNETZ_LABELS),
        "harmonics": series(harm_energy, 5),
        "percussives": series(perc_energy, 5),
        "harmonic_ratio": series(harmonic_ratio, 4),
        "spectral_flux": series(flux, 2),
        "pitch": series(f0, 2),
        "spectral_centroid_velocity": series(centroid_delta, 2),
    }
    return meta, features


def save_track(track_id, filename, meta, features):
    track_dir = os.path.join(DATA_DIR, track_id)
    if os.path.isdir(track_dir):
        shutil.rmtree(track_dir)
    os.makedirs(track_dir)
    for name, payload in features.items():
        with open(os.path.join(track_dir, f"{name}.json"), "w") as f:
            json.dump(payload, f, separators=(",", ":"), allow_nan=False)
    entry = {"id": track_id, "file": filename, **meta, "features": {}}
    for name, payload in features.items():
        info = {"kind": payload["kind"]}
        if payload["kind"] == "matrix":
            info["rows"] = len(payload["rows"])
        entry["features"][name] = info
    return entry


def previous_track_ids():
    path = os.path.join(DATA_DIR, "index.json")
    if not os.path.exists(path):
        return set()
    try:
        with open(path) as f:
            return {t["id"] for t in json.load(f).get("tracks", [])}
    except (OSError, ValueError, KeyError, TypeError):
        return set()


def save_index(entries):
    os.makedirs(DATA_DIR, exist_ok=True)
    current = {t["id"] for t in entries}
    for stale in previous_track_ids() - current:
        shutil.rmtree(os.path.join(DATA_DIR, stale), ignore_errors=True)
    index = {"schema_version": SCHEMA_VERSION, "tracks": sorted(entries, key=lambda t: t["file"].lower())}
    with open(os.path.join(DATA_DIR, "index.json"), "w") as f:
        json.dump(index, f, indent=2)


def assign_ids(files):
    ids = {}
    for filename in files:
        base = slugify(filename)
        track_id = base
        n = 2
        while track_id in ids.values():
            track_id = f"{base}-{n}"
            n += 1
        ids[filename] = track_id
    return ids


def process_files():
    files = sorted(f for f in os.listdir(AUDIO_DIR) if f.lower().endswith((".mp3", ".wav")))
    if not files:
        print(f"No audio files found in directory: {AUDIO_DIR}")
        return []

    print(f"Found {len(files)} audio files in directory: {AUDIO_DIR}")
    ids = assign_ids(files)
    entries = []

    with concurrent.futures.ProcessPoolExecutor() as executor:
        futures = {executor.submit(analyze_audio, os.path.join(AUDIO_DIR, filename)): filename for filename in files}
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc="Analyzing audio files"):
            filename = futures[future]
            try:
                meta, features = future.result()
            except Exception as e:
                print(f"Error analyzing {filename}: {e}")
                continue
            entries.append(save_track(ids[filename], filename, meta, features))

    return entries


if __name__ == "__main__":
    if not os.path.isdir(AUDIO_DIR):
        print(f"Directory {AUDIO_DIR} does not exist.")
    else:
        entries = process_files()
        if entries:
            save_index(entries)
            print(f"Audio analysis completed. Results are saved in {DATA_DIR}/")
