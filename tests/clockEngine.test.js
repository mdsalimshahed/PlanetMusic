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

test('uses requestAnimationFrame instead of a low-power frame-rate timer', () => {
  const previousWindow = globalThis.window;
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let scheduledFrame = null;
  globalThis.window = {
    currentAudioTime: 0,
    dispatchEvent() {}
  };
  globalThis.requestAnimationFrame = callback => {
    scheduledFrame = callback;
    return 1;
  };
  globalThis.cancelAnimationFrame = () => {};

  const clock = new ClockEngine();
  try {
    assert.equal(clock.tickInterval, 0);
    clock.start();
    assert.equal(typeof scheduledFrame, 'function');
  } finally {
    clock.pause();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousRequestAnimationFrame === undefined) delete globalThis.requestAnimationFrame;
    else globalThis.requestAnimationFrame = previousRequestAnimationFrame;
    if (previousCancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame;
    else globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
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
