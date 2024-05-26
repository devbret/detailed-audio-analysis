import os
import json
import librosa
import numpy as np

directory = "path/to/audio/files"

output_file = "audio_analysis_enhanced.json"

def analyze_audio(file_path):
    y, sr = librosa.load(file_path)

    rms_energy = librosa.feature.rms(y=y)[0]
    loudness = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(energy)} for i, energy in enumerate(rms_energy)]

    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    onsets = [{"time": time, "value": 1} for time in onset_times]

    hop_length = 512
    mfccs = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop_length)
    timbre = []
    for i, mfcc in enumerate(mfccs):
        mfcc_over_time = [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(mfcc_val)} for j, mfcc_val in enumerate(mfcc)]
        timbre.append({"mfcc{}".format(i+1): mfcc_over_time})

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop_length)
    chroma_over_time = []
    for i, chroma_val in enumerate(chroma):
        chroma_val_over_time = [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(chroma_val[j])} for j in range(len(chroma_val))]
        chroma_over_time.append({"chroma{}".format(i+1): chroma_val_over_time})

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    beats = [{"time": time, "value": tempo} for time in beat_times]

    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_centroid = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(centroid)} for i, centroid in enumerate(spectral_centroids)]

    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
    bandwidth = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(bandwidth_val)} for i, bandwidth_val in enumerate(spectral_bandwidth)]

    zero_crossings = librosa.feature.zero_crossing_rate(y=y)[0]
    zero_crossing = [{"time": librosa.frames_to_time(i, sr=sr), "value": float(zero)} for i, zero in enumerate(zero_crossings)]

    spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
    contrast = []
    for i, contrast_val in enumerate(spectral_contrast):
        contrast_val_over_time = [{"time": librosa.frames_to_time(j, sr=sr, hop_length=hop_length), "value": float(contrast_val[j])} for j in range(len(contrast_val))]
        contrast.append({"contrast{}".format(i+1): contrast_val_over_time})

    return {
        "onsets": onsets,
        "timbre": timbre,
        "loudness": loudness,
        "chroma": chroma_over_time,
        "tempo": beats,
        "spectral_centroid": spectral_centroid,
        "spectral_bandwidth": bandwidth,
        "zero_crossing_rate": zero_crossing,
        "spectral_contrast": contrast
    }

analysis_results = {}

for filename in os.listdir(directory):
    if filename.endswith(".mp3") or filename.endswith(".wav"):
        print(f"Analyzing {filename}...")
        file_path = os.path.join(directory, filename)
        analysis_results[filename] = analyze_audio(file_path)

with open(output_file, 'w') as f:
    json.dump(analysis_results, f, indent=4)

print(f"Enhanced audio analysis completed. Results are saved in {output_file}")
