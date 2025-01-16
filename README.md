# Detailed Audio Analyses And Visualizations

![The evolution of fifteen metrics over time for a single DNB track.](https://hosting.photobucket.com/images/i/bernhoftbret/detailed-audio-analyses-and-visualizations-enhanced-ui-colored-buttons-dnb.jpg)

Measure the evolution of onsets, timbre, loudness, chroma, tempo, spectral centroid, spectral bandwidth, zero crossing, spectral contrast, spectral rolloff, mel spectogram, tonnetz, harmonic energy, percussive energy and spectral flux for any number of audio tracks. Then visualize and interact with your data over time.

## Set Up

### Programs Needed

- [Git](https://git-scm.com/downloads)
- [Python](https://www.python.org/downloads/) (When installing on Windows, make sure you check the ["Add python 3.xx to PATH"](https://hosting.photobucket.com/images/i/bernhoftbret/python.png) box.)

### Steps

1. Install the above programs.
2. Open a shell window (for Windows open PowerShell, for MacOS open Terminal and for Linux open your distro's terminal emulator).
3. Clone this repository using `git` by running the following command: `git clone https://github.com/devbret/detailed-audio-analysis`.
4. Navigate to the repo's directory by running: `cd detailed-audio-analysis`.
5. Install the needed dependencies for running the script by running: `pip install -r requirements.txt`.
6. Add the audio files you wish to analyze to the local audio folder.
7. Run the script with the command `python3 app.py`.
8. To view the audio analyses with the index.html file, you will need to run a local web server. To do this run: `python3 -m http.server`.

## Please Also Note

The JSON file that this Python script outputs will be very, very large. And will take a prolonged period of time to generate. As an example, putting one Drum And Bass track through this program, produces almost 500 MB of data, and took eight minutes to process.

Also, your browser may have a difficult time loading and displaying excessively sized JSON files.
