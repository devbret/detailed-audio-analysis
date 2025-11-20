# Detailed Audio Analyses And Visualizations

![The evolution of twenty audio features over time.](https://hosting.photobucket.com/bbcfb0d4-be20-44a0-94dc-65bff8947cf2/a84d0d1d-61a8-4052-8994-0ae013b16cd0.png)

Measure the evolution of onsets, timbre, loudness, chroma, tempo, spectral centroid, spectral bandwidth, zero crossing, spectral contrast, spectral rolloff, mel spectogram, tonnetz, harmonic energy, percussive energy, onset strength, pitch, harmonic ratio, novelty, spectral centroid velocity and spectral flux for any number of audio tracks. Then visualize and interact with your data over time.

## Set Up

### Programs Needed

- [Git](https://git-scm.com/downloads)
- [Python](https://www.python.org/downloads/) (When installing on Windows, make sure you check the ["Add python 3.xx to PATH"](https://hosting.photobucket.com/images/i/bernhoftbret/python.png) box.)

### Steps

1. Install the above programs.
2. Open a shell window (for Windows open PowerShell, for MacOS open Terminal and for Linux open your distro's terminal emulator).
3. Clone this repository using `git` by running the following command: `git clone git@github.com:devbret/detailed-audio-analysis.git`.
4. Navigate to the repo's directory by running: `cd detailed-audio-analysis`.
5. Install the needed dependencies for running the script by running: `pip install -r requirements.txt`.
6. Add the audio files you wish to analyze to the local audio folder.
7. Run the script with the command `python3 app.py`.
8. To view the audio analyses with the index.html file, you will need to run a local web server. To do this run: `python3 -m http.server`.

## Please Also Note

The JSON file this Python script outputs will be very, very large. And takes a prolonged period of time to generate. As an example, putting one Drum And Bass track through this program, produces almost 600 MB of data, and took sixty seconds to compute.

Also, your browser may have a difficult time loading and displaying excessively sized JSON files.
