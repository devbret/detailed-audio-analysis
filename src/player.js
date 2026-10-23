import { formatTime, clamp } from "./format.js";

const VOLUME_KEY = "daa-volume";

export class Player {
  constructor({ audio, button, timeEl, volume, onTime }) {
    this.audio = audio;
    this.button = button;
    this.timeEl = timeEl;
    this.volume = volume;
    this.onTime = onTime;
    this.duration = 0;
    this.raf = 0;
    this.pendingSeek = null;
    this.loadToken = 0;
    this.objectUrl = null;
    let stored = 1;
    try {
      stored = Number(localStorage.getItem(VOLUME_KEY) ?? 1);
    } catch {}
    audio.volume = Number.isFinite(stored) ? clamp(stored, 0, 1) : 1;
    volume.value = String(audio.volume);
    button.addEventListener("click", () => this.toggle());
    volume.addEventListener("input", () => {
      audio.volume = Number(volume.value);
      try {
        localStorage.setItem(VOLUME_KEY, volume.value);
      } catch {}
    });
    audio.addEventListener("play", () => {
      this.updateButton();
      this.loop();
    });
    audio.addEventListener("pause", () => {
      cancelAnimationFrame(this.raf);
      this.updateButton();
      this.tick();
    });
    audio.addEventListener("ended", () => this.updateButton());
    audio.addEventListener("seeked", () => this.tick());
    audio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(audio.duration)) this.duration = audio.duration;
      if (this.pendingSeek != null) {
        audio.currentTime = clamp(this.pendingSeek, 0, this.duration || this.pendingSeek);
        this.pendingSeek = null;
      }
      this.tick();
    });
    audio.addEventListener("error", () => {
      this.button.disabled = true;
      this.timeEl.textContent = "Audio file not found";
    });
  }

  get playing() {
    return !this.audio.paused && !this.audio.ended;
  }

  get time() {
    if (this.pendingSeek != null) return this.pendingSeek;
    return this.audio.currentTime || 0;
  }

  load(src, duration) {
    this.audio.pause();
    this.pendingSeek = null;
    this.duration = duration || 0;
    this.button.disabled = false;
    const token = ++this.loadToken;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.audio.removeAttribute("src");
    this.audio.load();
    fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (token !== this.loadToken) return;
        this.objectUrl = URL.createObjectURL(blob);
        this.audio.src = this.objectUrl;
      })
      .catch(() => {
        if (token !== this.loadToken) return;
        this.audio.src = src;
      });
    this.updateButton();
    this.tick();
  }

  toggle() {
    if (this.playing) this.audio.pause();
    else this.audio.play().catch(() => {});
  }

  seek(t) {
    const target = clamp(t, 0, this.duration || t);
    if (this.audio.readyState < 1) this.pendingSeek = target;
    else this.audio.currentTime = target;
    this.tick();
  }

  loop() {
    cancelAnimationFrame(this.raf);
    const step = () => {
      this.tick();
      if (this.playing) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  tick() {
    const t = this.time;
    this.timeEl.textContent = `${formatTime(t)} / ${formatTime(this.duration)}`;
    if (this.onTime) this.onTime(t);
  }

  updateButton() {
    const playing = this.playing;
    this.button.textContent = playing ? "Pause" : "Play";
    this.button.setAttribute("aria-label", playing ? "Pause" : "Play");
  }
}
