let currentAudio = null;
let updateTimeInterval = null;
let activeTimeDisplay = null;

const FEATURES = [
  {
    key: "onsets",
    label: "Onsets",
    color: "steelblue",
    chartType: "onset",
    event: true,
  },
  {
    key: "timbre",
    label: "Timbre",
    color: "rgba(50, 205, 50, 0.6)",
    band: "mfcc1",
  },
  { key: "loudness", label: "Loudness", color: "rgba(255, 215, 0, 0.6)" },
  {
    key: "chroma",
    label: "Chroma",
    color: "rgba(255, 0, 255, 0.6)",
    band: "chroma1",
  },
  { key: "tempo", label: "Tempo", color: "rgba(255, 69, 0, 0.6)", event: true },
  {
    key: "spectral_centroid",
    label: "Spectral Centroid",
    color: "rgba(0, 128, 128, 0.6)",
  },
  {
    key: "spectral_bandwidth",
    label: "Spectral Bandwidth",
    color: "rgba(75, 0, 130, 0.6)",
  },
  {
    key: "zero_crossing_rate",
    label: "Zero Crossing Rate",
    color: "rgba(123, 104, 238, 0.6)",
  },
  {
    key: "spectral_contrast",
    label: "Spectral Contrast",
    color: "rgba(255, 99, 71, 0.6)",
    band: "contrast1",
  },
  {
    key: "spectral_rolloff",
    label: "Spectral Rolloff",
    color: "rgba(255, 105, 180, 0.6)",
  },
  {
    key: "mel_spectrogram",
    label: "Mel Spectrogram",
    color: "rgba(0, 191, 255, 0.6)",
    band: "mel1",
  },
  {
    key: "tonnetz",
    label: "Tonnetz",
    color: "rgba(75, 0, 130, 0.6)",
    band: "tonnetz1",
  },
  {
    key: "harmonics",
    label: "Harmonic Energy",
    color: "rgba(34, 139, 34, 0.6)",
  },
  {
    key: "percussives",
    label: "Percussive Energy",
    color: "rgba(255, 140, 0, 0.6)",
  },
  {
    key: "spectral_flux",
    label: "Spectral Flux",
    color: "rgba(46, 139, 87, 0.6)",
  },
  {
    key: "onset_strength",
    label: "Onset Strength",
    color: "rgba(30, 144, 255, 0.6)",
  },
  { key: "pitch", label: "Pitch", color: "rgba(0, 255, 127, 0.6)" },
  {
    key: "harmonic_ratio",
    label: "Harmonic Ratio",
    color: "rgba(139, 0, 139, 0.6)",
  },
  { key: "novelty", label: "Novelty", color: "rgba(220, 20, 60, 0.6)" },
  {
    key: "spectral_centroid_velocity",
    label: "Spectral Centroid Velocity",
    color: "rgba(0, 206, 209, 0.6)",
  },
];

function buildSeries(featureData, hopLength, sr) {
  if (featureData.times) {
    return featureData.times.map((time, i) => ({
      time,
      value: featureData.values[i],
    }));
  }
  const dt = hopLength / sr;
  return featureData.values.map((value, i) => ({ time: i * dt, value }));
}

function drawChart(data, elementId, color, chartType, duration) {
  const margin = { top: 20, right: 30, bottom: 50, left: 0 },
    width = 7500 - margin.left - margin.right,
    height = 1000 - margin.top - margin.bottom;

  const svg = d3
    .select(`#${elementId}`)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().range([0, width]);
  let y = d3.scaleLinear().range([height, 0]);

  x.domain([0, duration]);

  const xAxis = d3
    .axisBottom(x)
    .ticks(100)
    .tickFormat((d) => {
      return d.toFixed(2);
    });

  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .append("text")
    .attr("fill", "#000")
    .attr("x", width / 2)
    .attr("y", margin.bottom - 10)
    .attr("text-anchor", "middle")
    .text("Time (s)");

  if (chartType === "line") {
    const minValue = d3.min(data, (d) => d.value) * 0.95;
    const maxValue = d3.max(data, (d) => d.value) * 1.05;
    y.domain([minValue, maxValue]);

    const line = d3
      .line()
      .x((d) => x(d.time))
      .y((d) => y(d.value));

    svg
      .append("path")
      .datum(data)
      .attr("class", "line")
      .style("stroke", color)
      .attr("d", line);
  } else if (chartType === "onset") {
    y.domain([0, 1]);
    data.forEach((d) => {
      svg
        .append("line")
        .attr("x1", x(d.time))
        .attr("x2", x(d.time))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", color)
        .attr("class", "onset-line");
    });
  }
}

function toggleChart(chartId) {
  const chart = document.getElementById(chartId);
  if (chart) {
    chart.style.display =
      chart.style.display === "none" || chart.style.display === ""
        ? "block"
        : "none";
  } else {
    console.log(`Chart with ID ${chartId} not found.`);
  }
}

function playAudio(
  audioSrc,
  progressBar,
  playButton,
  volumeSlider,
  timeDisplay,
) {
  if (activeTimeDisplay && activeTimeDisplay !== timeDisplay) {
    activeTimeDisplay.textContent = "0:00 / 0:00";
  }
  activeTimeDisplay = timeDisplay;

  if (updateTimeInterval) {
    clearInterval(updateTimeInterval);
  }
  updateTimeInterval = setInterval(() => {
    if (currentAudio) {
      timeDisplay.textContent = `${formatTime(currentAudio.currentTime)} / ${formatTime(
        currentAudio.duration,
      )}`;
    }
  }, 100);

  if (currentAudio && currentAudio.src !== audioSrc) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    progressBar.style.width = "0%";
  }

  if (!currentAudio || currentAudio.src !== audioSrc) {
    currentAudio = new Audio(audioSrc);
    currentAudio.volume = volumeSlider.value;
    currentAudio.addEventListener("timeupdate", () => {
      const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
      progressBar.style.width = `${progress.toFixed(2)}%`;
    });
    currentAudio.addEventListener("ended", () => {
      progressBar.style.width = "0%";
      playButton.textContent = "Play Audio";
      timeDisplay.textContent = "0:00 / 0:00";
      currentAudio = null;
      if (updateTimeInterval) {
        clearInterval(updateTimeInterval);
        updateTimeInterval = null;
      }
    });
  }

  currentAudio.play();
  playButton.textContent = "Playing...";
}

function stopAudio(progressBar, playButton, timeDisplay) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    progressBar.style.width = "0%";
    playButton.textContent = "Play Audio";
    currentAudio = null;
  }
  if (updateTimeInterval) {
    clearInterval(updateTimeInterval);
    updateTimeInterval = null;
  }
  timeDisplay.textContent = "0:00 / 0:00";
}

function changeVolume(volumeSlider) {
  if (currentAudio) {
    currentAudio.volume = volumeSlider.value;
  }
}

function setupProgressBar(progressBar) {
  progressBar.addEventListener("click", (e) => {
    if (currentAudio) {
      const rect = progressBar.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const width = rect.width;
      const clickPosition = offsetX / width;
      currentAudio.currentTime = clickPosition * currentAudio.duration;
    }
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

d3.json("audio_analysis_enhanced.json").then(function (allTracksData) {
  Object.keys(allTracksData).forEach((trackName, index) => {
    const trackData = allTracksData[trackName];
    const { sr, hop_length: hopLength, duration } = trackData;

    const containerDIV = d3
      .select("body")
      .append("div")
      .attr("class", "container");

    containerDIV.append("h2").text(trackName);

    const audioSrc = `audio/${trackName}`;

    const playButton = containerDIV
      .append("button")
      .attr("class", "toggle-button")
      .text("Play Audio");

    const stopButton = containerDIV
      .append("button")
      .attr("class", "toggle-button")
      .text("Stop Audio");

    const volumeSlider = containerDIV
      .append("input")
      .attr("type", "range")
      .attr("min", "0")
      .attr("max", "1")
      .attr("step", "0.01")
      .attr("value", "1")
      .attr("class", "volume-slider")
      .on("input", function () {
        changeVolume(this);
      });

    const timeDisplay = containerDIV
      .append("div")
      .attr("class", "time-display")
      .text("0:00 / 0:00");

    playButton.on("click", function () {
      playAudio(
        audioSrc,
        progressBar.node(),
        this,
        volumeSlider.node(),
        timeDisplay.node(),
      );
    });

    stopButton.on("click", function () {
      stopAudio(progressBar.node(), playButton.node(), timeDisplay.node());
    });

    const buttonsDiv = containerDIV.append("div").attr("class", "buttons");
    const chartContainerDiv = containerDIV
      .append("div")
      .attr("class", "chart-container");

    const progressBarContainer = chartContainerDiv
      .append("div")
      .attr("class", "progress-bar");

    const progressBar = progressBarContainer
      .append("div")
      .attr("class", "progress");

    setupProgressBar(progressBarContainer.node());

    FEATURES.forEach((feature) => {
      const chartId = `${feature.key}-chart-${index}`;

      buttonsDiv
        .append("button")
        .attr("class", "toggle-button")
        .style("background-color", feature.color)
        .text(`Toggle ${feature.label}`)
        .on("click", () => toggleChart(chartId));

      chartContainerDiv
        .append("div")
        .attr("id", chartId)
        .attr("class", "chart");

      const featureData = feature.band
        ? trackData[feature.key]?.[feature.band]
        : trackData[feature.key];
      if (!featureData) return;

      drawChart(
        buildSeries(featureData, hopLength, sr),
        chartId,
        feature.color,
        feature.chartType || "line",
        duration,
      );
    });
  });
});
