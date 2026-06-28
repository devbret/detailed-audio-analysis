import os
import json
import librosa
import numpy as np
from tqdm import tqdm
import concurrent.futures

directory = "audio/"
output_file = "audio_analysis_enhanced.json"
HOP_LENGTH = 512

def series(values):
    return {"values": np.round(np.asarray(values, dtype=float), 6).tolist()}

def events(times, values):
    return {
        "times": np.round(np.asarray(times, dtype=float), 4).tolist(),
        "values": np.round(np.asarray(values, dtype=float), 6).tolist(),
    }

def compute_tempo(y, sr, hop_length=HOP_LENGTH):
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, aggregate=np.median)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop_length, units='frames')
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)
    instantaneous_tempo = 60.0 / np.diff(beat_times) if len(beat_times) > 1 else np.array([])
    return events(beat_times[:-1], instantaneous_tempo), float(np.atleast_1d(tempo)[0])

def analyze_audio(file_path, hop_length=HOP_LENGTH):
    y, sr = librosa.load(file_path)

    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, aggregate=np.median)
    novelty_vals = np.maximum(0, np.diff(onset_env))

    rms_energy = librosa.feature.rms(y=y, hop_length=hop_length)[0]

    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)

    mfccs = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop_length)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)

    beats, overall_tempo = compute_tempo(y, sr, hop_length=hop_length)

    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length)[0]
    zero_crossings = librosa.feature.zero_crossing_rate(y=y, hop_length=hop_length)[0]
    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=hop_length)
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]

    mel_spectrogram = librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop_length)
    mel_db = librosa.power_to_db(mel_spectrogram, ref=np.max)

    tonnetz = librosa.feature.tonnetz(y=y, sr=sr, hop_length=hop_length)

    harmonic, percussive = librosa.effects.hpss(y)
    harm_energy = librosa.feature.rms(y=harmonic, hop_length=hop_length)[0]
    perc_energy = librosa.feature.rms(y=percussive, hop_length=hop_length)[0]
    harmonic_ratio = harm_energy / (harm_energy + perc_energy + 1e-8)

    S = np.abs(librosa.stft(y, hop_length=hop_length))
    flux_vals = np.sqrt(np.sum(np.diff(S, axis=1) ** 2, axis=0))

    f0 = librosa.yin(
        y,
        fmin=librosa.note_to_hz('C2'),
        fmax=librosa.note_to_hz('C7'),
        sr=sr,
        frame_length=2048,
        hop_length=hop_length
    )

    centroid_delta = librosa.feature.delta(spectral_centroids)

    return {
        "sr": int(sr),
        "hop_length": hop_length,
        "duration": float(librosa.get_duration(y=y, sr=sr)),
        "overall_tempo": overall_tempo,
        "onsets": events(onset_times, np.ones(len(onset_times))),
        "onset_strength": series(onset_env),
        "novelty": series(novelty_vals),
        "loudness": series(rms_energy),
        "timbre": {f"mfcc{i+1}": series(m) for i, m in enumerate(mfccs)},
        "chroma": {f"chroma{i+1}": series(c) for i, c in enumerate(chroma)},
        "tempo": beats,
        "spectral_centroid": series(spectral_centroids),
        "spectral_bandwidth": series(spectral_bandwidth),
        "zero_crossing_rate": series(zero_crossings),
        "spectral_contrast": {f"contrast{i+1}": series(c) for i, c in enumerate(spectral_contrast)},
        "spectral_rolloff": series(spectral_rolloff),
        "mel_spectrogram": {f"mel{i+1}": series(m) for i, m in enumerate(mel_db)},
        "tonnetz": {f"tonnetz{i+1}": series(t) for i, t in enumerate(tonnetz)},
        "harmonics": series(harm_energy),
        "percussives": series(perc_energy),
        "harmonic_ratio": series(harmonic_ratio),
        "spectral_flux": series(flux_vals),
        "pitch": series(f0),
        "spectral_centroid_velocity": series(centroid_delta),
    }

def process_files(directory):
    analysis_results = {}
    files = [f for f in os.listdir(directory) if f.endswith((".mp3", ".wav"))]

    if not files:
        print(f"No audio files found in directory: {directory}")
        return analysis_results

    print(f"Found {len(files)} audio files in directory: {directory}")

    with concurrent.futures.ProcessPoolExecutor() as executor:
        futures = {executor.submit(analyze_audio, os.path.join(directory, filename)): filename for filename in files}
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(futures), desc="Analyzing audio files"):
            filename = futures[future]
            try:
                analysis_results[filename] = future.result()
            except Exception as e:
                print(f"Error analyzing {filename}: {e}")

    return analysis_results

def numpy_to_python(obj):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, np.generic):
        return float(obj)
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

def save_results(output_file, analysis_results):
    with open(output_file, 'w') as f:
        json.dump(analysis_results, f, separators=(",", ":"), default=numpy_to_python)
    print(f"Enhanced audio analysis completed. Results are saved in {output_file}")

if __name__ == "__main__":
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
    else:
        analysis_results = process_files(directory)
        if analysis_results:
            save_results(output_file, analysis_results)
