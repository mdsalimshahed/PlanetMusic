/* --- src/utils/clockEngine.js --- */

/**
 * High-Precision Interpolated Clock Engine
 * Bridges YouTube API time update gaps with local performance.now() ticking.
 */
class ClockEngine {
  constructor() {
    this.anchorTime = 0;       // Audio time in seconds reported by player
    this.anchorPerf = 0;       // performance.now() timestamp when anchor was set
    this.playbackRate = 1.0;
    this.isPlaying = false;
    this.eventName = 'globalTimeUpdate';
    this.animFrameId = null;
  }

  setEventName(name) {
    this.eventName = name;
  }

  setRate(rate) {
    if (this.isPlaying) {
      // Recalculate anchor at current exact position before rate changes
      this.anchorTime = this.getCurrentTime();
      this.anchorPerf = performance.now();
    }
    this.playbackRate = rate;
  }

  // Called when YouTube or Audio emits a position update
  updateAnchor(playerTime, forceReset = false) {
    const now = performance.now();
    if (!this.isPlaying || forceReset) {
      this.anchorTime = playerTime;
      this.anchorPerf = now;
      return;
    }

    const currentEstimated = this.getCurrentTime();
    const drift = Math.abs(currentEstimated - playerTime);

    // If drift is over 150ms (e.g. user seeks or video buffers), snap anchor immediately.
    // Otherwise, ignore tiny postMessage jitter to maintain smooth local ticking.
    if (drift > 0.15) {
      this.anchorTime = playerTime;
      this.anchorPerf = now;
    }
  }

  getCurrentTime() {
    if (!this.isPlaying) return this.anchorTime;
    const elapsed = (performance.now() - this.anchorPerf) / 1000;
    return Math.max(0, this.anchorTime + (elapsed * this.playbackRate));
  }

  start(initialTime = 0) {
    this.anchorTime = initialTime;
    this.anchorPerf = performance.now();
    this.isPlaying = true;
    this.tick();
  }

  pause() {
    if (this.isPlaying) {
      this.anchorTime = this.getCurrentTime();
      this.anchorPerf = performance.now();
      this.isPlaying = false;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  seek(time) {
    this.anchorTime = time;
    this.anchorPerf = performance.now();
    window.currentAudioTime = time;
    window.dispatchEvent(new CustomEvent(this.eventName, { detail: time }));
  }

  tick = () => {
    if (!this.isPlaying) return;

    const time = this.getCurrentTime();
    window.currentAudioTime = time;

    window.dispatchEvent(new CustomEvent(this.eventName, { detail: time }));
    this.animFrameId = requestAnimationFrame(this.tick);
  };
}

export const globalClock = new ClockEngine();
export const workspaceClock = new ClockEngine();