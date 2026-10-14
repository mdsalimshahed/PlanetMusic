import assert from 'node:assert/strict';
import test from 'node:test';
import { ClockEngine } from '../src/Studio/utils/clockEngine.js';

test('starting a paused clock resumes from its anchored position', () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    currentAudioTime: 0,
    dispatchEvent() {}
  };

  const clock = new ClockEngine();
  clock.tickInterval = 100000;
  clock.anchorTime = 37.5;

  try {
    clock.start();
    assert.equal(clock.anchorTime, 37.5);
    assert.ok(Math.abs(globalThis.window.currentAudioTime - 37.5) < 0.01);
    clock.pause();
    assert.equal(globalThis.window.currentAudioTime, clock.anchorTime);
  } finally {
    clock.pause();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('invalid media times and playback rates do not corrupt the clock', () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    currentAudioTime: 12,
    dispatchEvent() {}
  };

  const clock = new ClockEngine();
  clock.anchorTime = 12;

  try {
    clock.updateAnchor(Number.NaN, true);
    clock.seek(Number.POSITIVE_INFINITY);
    clock.setRate(0);

    assert.equal(clock.anchorTime, 12);
    assert.equal(clock.playbackRate, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
