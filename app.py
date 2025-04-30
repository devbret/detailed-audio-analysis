import os
import json
import librosa
import numpy as np
from tqdm import tqdm
import concurrent.futures

directory = "audio/"
output_file = "audio_analysis_enhanced.json"

def compute_tempo(y, sr, hop_length=1):
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, aggregate=np.median)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop_length, units='frames')
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)
    beat_tempo = []
    for i, beat_time in enumerate(beat_times[:-1]):
        next_beat_time = beat_times[i + 1]
        instantaneous_tempo = 60.0 / (next_beat_time - beat_time)
        beat_tempo.append({"time": beat_time, "value": instantaneous_tempo})
    return beat_tempo, tempo

def analyze_audio(file_path):
    y, sr = librosa.load(file_path)

    # Hop length for frame-based features
    hop_length = 512

    # Onset strength envelope (for visualization)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length, aggregate=np.median)
    onset_strength = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(val)} for i, val in enumerate(onset_env)]

    # RMS loudness
    rms_energy = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    loudness = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(energy)} for i, energy in enumerate(rms_energy)]

    # Onset events (binary)
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, hop_length=hop_length)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr, hop_length=hop_length)
    onsets = [{"time": t, "value": 1} for t in onset_times]

    # MFCC (timbre)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop_length)
    timbre = [{f"mfcc{i+1}": [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(m)} for j, m in enumerate(mfcc)]} for i, mfcc in enumerate(mfccs)]

    # Chroma
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    chroma_over_time = [{f"chroma{i+1}": [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(v)} for j, v in enumerate(chroma_val)]} for i, chroma_val in enumerate(chroma)]

    # Tempo and beat-based tempo
    beats, overall_tempo = compute_tempo(y, sr, hop_length=hop_length)

    # Spectral features
    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
    spectral_centroid = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(c)} for i, c in enumerate(spectral_centroids)]

    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length)[0]
    bandwidth = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(b)} for i, b in enumerate(spectral_bandwidth)]

    zero_crossings = librosa.feature.zero_crossing_rate(y=y, hop_length=hop_length)[0]
    zero_crossing = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(z)} for i, z in enumerate(zero_crossings)]

    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=hop_length)
    contrast = [{f"contrast{i+1}": [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(v)} for j, v in enumerate(cval)]} for i, cval in enumerate(spectral_contrast)]

    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]
    rolloff = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(r)} for i, r in enumerate(spectral_rolloff)]

    mel_spectrogram = librosa.feature.melspectrogram(y=y, sr=sr, hop_length=hop_length)
    mel_db = librosa.power_to_db(mel_spectrogram, ref=np.max)
    mel_spec = [{f"mel{i+1}": [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(v)} for j, v in enumerate(m)]} for i, m in enumerate(mel_db)]

    tonnetz = librosa.feature.tonnetz(y=y, sr=sr, hop_length=hop_length)
    tonnetz_over_time = [{f"tonnetz{i+1}": [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(v)} for j, v in enumerate(tval)]} for i, tval in enumerate(tonnetz)]

    # Harmonic-percussive separation
    harmonic, percussive = librosa.effects.hpss(y)
    harm_energy = librosa.feature.rms(y=harmonic, hop_length=hop_length)[0]
    perc_energy = librosa.feature.rms(y=percussive, hop_length=hop_length)[0]
    harmonics = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(e)} for i, e in enumerate(harm_energy)]
    percussives = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(e)} for i, e in enumerate(perc_energy)]

    # Spectral flux
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    flux_vals = np.sqrt(np.sum(np.diff(S, axis=1)**2, axis=0))
    flux = [{"time": librosa.frames_to_time(i, sr=sr, hop_length=hop_length), "value": float(v)} for i, v in enumerate(flux_vals)]

    return {
        "onset_strength": onset_strength,
        "onsets": onsets,
        "timbre": timbre,
        "loudness": loudness,
        "chroma": chroma_over_time,
        "tempo": beats,
        "overall_tempo": overall_tempo,
        "spectral_centroid": spectral_centroid,
        "spectral_bandwidth": bandwidth,
        "zero_crossing_rate": zero_crossing,
        "spectral_contrast": contrast,
        "spectral_rolloff": rolloff,
        "mel_spectrogram": mel_spec,
        "tonnetz": tonnetz_over_time,
        "harmonics": harmonics,
        "percussives": percussives,
        "spectral_flux": flux,
    }

def process_files(directory):
    analysis_results = {}
    files = [f for f in os.listdir(directory) if f.endswith(".mp3") or f.endswith(".wav")]

    if not files:
        print(f"No audio files found in directory: {directory}")
        return analysis_results

    print(f"Found {len(files)} audio files in directory: {directory}")

    with concurrent.futures.ThreadPoolExecutor() as executor:
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
        json.dump(analysis_results, f, indent=4, default=numpy_to_python)
    print(f"Enhanced audio analysis completed. Results are saved in {output_file}")

if __name__ == "__main__":
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
    else:
        analysis_results = process_files(directory)
        if analysis_results:
            save_results(output_file, analysis_results)
