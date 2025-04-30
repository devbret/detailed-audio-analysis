let currentAudio = null;
let updateTimeInterval = null;
let timeDisplay;

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
  } else if (chartType === "tempo") {
    y.domain([0, 1]);
    data.forEach((d) => {
      svg
        .append("line")
        .attr("x1", x(d.time))
        .attr("x2", x(d.time))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", color)
        .attr("class", "tempo-line");
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

function playAudio(audioSrc, progressBar, playButton, volumeSlider) {
  if (updateTimeInterval) {
    clearInterval(updateTimeInterval);
  }
  updateTimeInterval = setInterval(() => {
    if (currentAudio) {
      timeDisplay.text(
        `${formatTime(currentAudio.currentTime)} / ${formatTime(
          currentAudio.duration
        )}`
      );
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

function stopAudio(progressBar, playButton) {
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
  document.querySelector(".time-display").innerText = "0:00 / 0:00";
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
    const onsetsChartId = `onsets-chart-${index}`;
    const timbreChartId = `timbre-chart-${index}`;
    const loudnessChartId = `loudness-chart-${index}`;
    const chromaChartId = `chroma-chart-${index}`;
    const tempoChartId = `tempo-chart-${index}`;
    const spectralCentroidChartId = `spectral-centroid-chart-${index}`;
    const spectralBandwidthChartId = `spectral-bandwidth-chart-${index}`;
    const zeroCrossingChartId = `zero-crossing-chart-${index}`;
    const spectralContrastChartId = `spectral-contrast-chart-${index}`;
    const spectralRolloffChartId = `spectral-rolloff-chart-${index}`;
    const melSpectrogramChartId = `mel-spectrogram-chart-${index}`;
    const tonnetzChartId = `tonnetz-chart-${index}`;
    const harmonicEnergyChartId = `harmonic-energy-chart-${index}`;
    const percussiveEnergyChartId = `percussive-energy-chart-${index}`;
    const spectralFluxChartId = `spectral-flux-chart-${index}`;
    const onsetStrengthChartId = `onset-strength-chart-${index}`;

    const containerDIV = d3
      .select("body")
      .append("div")
      .attr("class", "container");

    containerDIV.append("h2").text(trackName);

    const audioSrc = `audio/${trackName}`;
    const playButton = containerDIV
      .append("button")
      .attr("class", "toggle-button")
      .text("Play Audio")
      .on("click", function () {
        playAudio(audioSrc, progressBar.node(), this, volumeSlider.node());
      });

    const stopButton = containerDIV
      .append("button")
      .attr("class", "toggle-button")
      .text("Stop Audio")
      .on("click", function () {
        stopAudio(progressBar.node(), playButton.node());
      });

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

    timeDisplay = containerDIV
      .append("div")
      .attr("class", "time-display")
      .text("0:00 / 0:00");

    const buttonsDiv = containerDIV.append("div").attr("class", "buttons");
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button onsets-button")
      .text("Toggle Onsets")
      .on("click", () => toggleChart(onsetsChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button timbre-button")
      .text("Toggle Timbre")
      .on("click", () => toggleChart(timbreChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button loudness-button")
      .text("Toggle Loudness")
      .on("click", () => toggleChart(loudnessChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button chroma-button")
      .text("Toggle Chroma")
      .on("click", () => toggleChart(chromaChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button tempo-button")
      .text("Toggle Tempo")
      .on("click", () => toggleChart(tempoChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button spectral-centroid-button")
      .text("Toggle Spectral Centroid")
      .on("click", () => toggleChart(spectralCentroidChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button spectral-bandwidth-button")
      .text("Toggle Spectral Bandwidth")
      .on("click", () => toggleChart(spectralBandwidthChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button zero-crossing-button")
      .text("Toggle Zero Crossing Rate")
      .on("click", () => toggleChart(zeroCrossingChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button spectral-contrast-button")
      .text("Toggle Spectral Contrast")
      .on("click", () => toggleChart(spectralContrastChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button spectral-rolloff-button")
      .text("Toggle Spectral Rolloff")
      .on("click", () => toggleChart(spectralRolloffChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button mel-spectrogram-button")
      .text("Toggle Mel Spectrogram")
      .on("click", () => toggleChart(melSpectrogramChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button tonnetz-button")
      .text("Toggle Tonnetz")
      .on("click", () => toggleChart(tonnetzChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button harmonic-energy-button")
      .text("Toggle Harmonic Energy")
      .on("click", () => toggleChart(harmonicEnergyChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button percussive-energy-button")
      .text("Toggle Percussive Energy")
      .on("click", () => toggleChart(percussiveEnergyChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button spectral-flux-button")
      .text("Toggle Spectral Flux")
      .on("click", () => toggleChart(spectralFluxChartId));
    buttonsDiv
      .append("button")
      .attr("class", "toggle-button onset-strength-button")
      .text("Toggle Onset Strength")
      .on("click", () => toggleChart(onsetStrengthChartId));

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

    const onsetsDiv = chartContainerDiv
      .append("div")
      .attr("id", onsetsChartId)
      .attr("class", "chart");
    const timbreDiv = chartContainerDiv
      .append("div")
      .attr("id", timbreChartId)
      .attr("class", "chart");
    const loudnessDiv = chartContainerDiv
      .append("div")
      .attr("id", loudnessChartId)
      .attr("class", "chart");
    const chromaDiv = chartContainerDiv
      .append("div")
      .attr("id", chromaChartId)
      .attr("class", "chart");
    const tempoDiv = chartContainerDiv
      .append("div")
      .attr("id", tempoChartId)
      .attr("class", "chart");
    const spectralCentroidDiv = chartContainerDiv
      .append("div")
      .attr("id", spectralCentroidChartId)
      .attr("class", "chart");
    const spectralBandwidthDiv = chartContainerDiv
      .append("div")
      .attr("id", spectralBandwidthChartId)
      .attr("class", "chart");
    const zeroCrossingDiv = chartContainerDiv
      .append("div")
      .attr("id", zeroCrossingChartId)
      .attr("class", "chart");
    const spectralContrastDiv = chartContainerDiv
      .append("div")
      .attr("id", spectralContrastChartId)
      .attr("class", "chart");
    const spectralRolloffDiv = chartContainerDiv
      .append("div")
      .attr("id", spectralRolloffChartId)
      .attr("class", "chart");
    const melSpectrogramDiv = chartContainerDiv
      .append("div")
      .attr("id", melSpectrogramChartId)
      .attr("class", "chart");
    const tonnetzDiv = chartContainerDiv
      .append("div")
      .attr("id", tonnetzChartId)
      .attr("class", "chart");
    const harmonicEnergyDiv = chartContainerDiv
      .append("div")
      .attr("id", harmonicEnergyChartId)
      .attr("class", "chart");
    const percussiveEnergyDiv = chartContainerDiv
      .append("div")
      .attr("id", percussiveEnergyChartId)
      .attr("class", "chart");
    const spectralFluxDiv = chartContainerDiv
      .append("div")
      .attr("id", spectralFluxChartId)
      .attr("class", "chart");
    const onsetStrengthDiv = chartContainerDiv
      .append("div")
      .attr("id", onsetStrengthChartId)
      .attr("class", "chart");

    const preloadAudio = new Audio(audioSrc);
    preloadAudio.addEventListener("loadedmetadata", () => {
      const duration = preloadAudio.duration;
      drawChart(
        trackData.onsets,
        onsetsChartId,
        "steelblue",
        "onset",
        duration
      );
      drawChart(
        trackData.timbre[0].mfcc1,
        timbreChartId,
        "rgba(50, 205, 50, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.loudness,
        loudnessChartId,
        "rgba(255, 215, 0, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.chroma[0].chroma1,
        chromaChartId,
        "rgba(255, 0, 255, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.tempo,
        tempoChartId,
        "rgba(255, 69, 0, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.spectral_centroid,
        spectralCentroidChartId,
        "rgba(0, 128, 128, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.spectral_bandwidth,
        spectralBandwidthChartId,
        "rgba(75, 0, 130, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.zero_crossing_rate,
        zeroCrossingChartId,
        "rgba(123, 104, 238, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.spectral_contrast[0].contrast1,
        spectralContrastChartId,
        "rgba(255, 99, 71, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.spectral_rolloff,
        spectralRolloffChartId,
        "rgba(255, 105, 180, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.mel_spectrogram[0].mel1,
        melSpectrogramChartId,
        "rgba(0, 191, 255, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.tonnetz[0].tonnetz1,
        tonnetzChartId,
        "rgba(75, 0, 130, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.harmonics,
        harmonicEnergyChartId,
        "rgba(34, 139, 34, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.percussives,
        percussiveEnergyChartId,
        "rgba(255, 140, 0, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.spectral_flux,
        spectralFluxChartId,
        "rgba(46, 139, 87, 0.6)",
        "line",
        duration
      );
      drawChart(
        trackData.onset_strength,
        onsetStrengthChartId,
        "rgba(30, 144, 255, 0.6)",
        "line",
        duration
      );
    });
  });
});
