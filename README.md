# Detailed Audio Analyses And Visualizations

![Timbre, loudness, onset and energy over time for numerous DNB tracks.](https://hosting.photobucket.com/images/i/bernhoftbret/updated-detailed-audio-analysis-ui.jpg)

Measure the evolution of onsets, timbre, loudness, chroma, tempo, spectral centroid, spectral bandwidth, zero crossing and spectral contrast for any number of audio tracks. Then visualize that data over time.

## Set Up

### Programs Needed

-   [Git](https://git-scm.com/downloads)
-   [Python](https://www.python.org/downloads/) (When installing on Windows, make sure you check the ["Add python 3.xx to PATH"](https://hosting.photobucket.com/images/i/bernhoftbret/python.png) box.)

### Steps

1. Install the above programs.
2. Open a shell window (For Windows open PowerShell, for MacOS open Terminal & for Linux open your distro's terminal emulator).
3. Clone this repository using `git` by running the following command; `git clone https://github.com/devbret/detailed-audio-analysis`.
4. Navigate to the repo's directory by running; `cd detailed-audio-analysis`.
5. Install the needed dependencies for running the script by running; `pip install -r requirements.txt`.
6. Add the audio files you wish to analyze to the local audio folder.
7. Run the script with the command `python app.py`.
8. To view the audio analyses with the index.html file, you will need to run a local web server. To do this run `python -m http.server`.

## Please Also Note

The JSON file that the Python script outputs will be very, very large. In my experience, putting one Drum And Bass track through this program, produces over 100 MB of data. The JSON file that produced the image attached to this repo was 345.3 MB, consisting of analyses from only three DNB tracks.
