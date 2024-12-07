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

    rms_energy = librosa.feature.rms(y=y)[0]
    loudness = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(energy)} for i, energy in enumerate(rms_energy)]

    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    onsets = [{"time": time, "value": 1} for time in onset_times]

    hop_length = 512
    mfccs = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop_length)
    timbre = [{"mfcc{}".format(i+1): [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(mfcc_val)} for j, mfcc_val in enumerate(mfcc)]} for i, mfcc in enumerate(mfccs)]

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    chroma_over_time = [{"chroma{}".format(i+1): [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(chroma_val[j])} for j in range(len(chroma_val))]} for i, chroma_val in enumerate(chroma)]

    beats, overall_tempo = compute_tempo(y, sr, hop_length=hop_length)

    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_centroid = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(centroid)} for i, centroid in enumerate(spectral_centroids)]

    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    bandwidth = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(bandwidth_val)} for i, bandwidth_val in enumerate(spectral_bandwidth)]

    zero_crossings = librosa.feature.zero_crossing_rate(y=y)[0]
    zero_crossing = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(zero)} for i, zero in enumerate(zero_crossings)]

    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    contrast = [{"contrast{}".format(i+1): [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(contrast_val[j])} for j in range(len(contrast_val))]} for i, contrast_val in enumerate(spectral_contrast)]

    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    rolloff = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(rolloff_val)} for i, rolloff_val in enumerate(spectral_rolloff)]

    mel_spectrogram = librosa.feature.melspectrogram(y=y, sr=sr)
    mel_spectrogram_db = librosa.power_to_db(mel_spectrogram, ref=np.max)
    mel_spec = [{"mel{}".format(i+1): [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(mel_val)} for j, mel_val in enumerate(mel)]} for i, mel in enumerate(mel_spectrogram_db)]

    tonnetz = librosa.feature.tonnetz(y=y, sr=sr)
    tonnetz_over_time = [{"tonnetz{}".format(i+1): [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(tonnetz_val[j])} for j in range(len(tonnetz_val))]} for i, tonnetz_val in enumerate(tonnetz)]

    harmonic, percussive = librosa.effects.hpss(y)
    harmonic_energy = librosa.feature.rms(y=harmonic)[0]
    percussive_energy = librosa.feature.rms(y=percussive)[0]
    harmonics = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(energy)} for i, energy in enumerate(harmonic_energy)]
    percussives = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(energy)} for i, energy in enumerate(percussive_energy)]

    return {
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
        "percussives": percussives
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
