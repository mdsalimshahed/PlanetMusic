import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTimedLineData,
  findActiveLineIndex,
  getAnchoredScrollTop,
  getCombinedVerticalBounds,
  getCenteredScrollTop
} from '../src/Studio/components/Workspaces/Lyrics/Views/liveLyricsUtils.js';

test('precomputes sorted lyric timing data from sync data', () => {
  const syncData = [
    { start: '11', end: '13' },
    { start: '5', end: '8' },
    { start: null, end: null }
  ];
  const nextStarts = ['NaN', '11', 'NaN'];

  assert.deepEqual(buildTimedLineData(syncData, nextStarts), [
    { index: 1, start: 5, end: 8, nextStart: 11 },
    { index: 0, start: 11, end: 13, nextStart: Number.NaN }
  ]);
});

test('keeps a lyric active throughout its complete timestamp interval', () => {
  const timedLines = [
    { index: 0, start: 5, end: 8, nextStart: 11 },
    { index: 1, start: 11, end: 13, nextStart: Number.NaN }
  ];

  [5, 5.1, 6, 7, 8].forEach(time => {
    assert.equal(findActiveLineIndex(timedLines, time), 0);
  });
  assert.equal(findActiveLineIndex(timedLines, 8.01), -1);
  assert.equal(findActiveLineIndex(timedLines, 11), 1);
});

test('centers active lines when the scroll range allows it', () => {
  assert.equal(getCenteredScrollTop({
    scrollTop: 0,
    viewportTop: 100,
    viewportHeight: 400,
    activeTop: 360,
    activeHeight: 40,
    maxScrollTop: 1000
  }), 80);
});

test('anchors the main lyric top at a fixed viewport offset', () => {
  assert.equal(getAnchoredScrollTop({
    scrollTop: 200,
    viewportTop: 0,
    activeTop: 360,
    targetOffset: 205,
    maxScrollTop: 1000
  }), 355);
});

test('clamps the active lyric anchor at scroll boundaries', () => {
  const anchor = {
    scrollTop: 0,
    viewportTop: 0,
    targetOffset: 205,
    maxScrollTop: 900
  };
  assert.equal(getAnchoredScrollTop({ ...anchor, activeTop: 100 }), 0);
  assert.equal(getAnchoredScrollTop({
    ...anchor,
    scrollTop: 900,
    activeTop: 300
  }), 900);
});

test('keeps first and last lines within the scroll boundaries', () => {
  const viewport = {
    scrollTop: 0,
    viewportTop: 100,
    viewportHeight: 400,
    activeHeight: 40
  };

  assert.equal(getCenteredScrollTop({
    ...viewport,
    activeTop: 120,
    maxScrollTop: 1000
  }), 0);
  assert.equal(getCenteredScrollTop({
    ...viewport,
    scrollTop: 900,
    activeTop: 800,
    maxScrollTop: 900
  }), 900);
});

test('includes translations and pronunciation extending beyond the lyric line box', () => {
  assert.deepEqual(getCombinedVerticalBounds([
    { top: 200, bottom: 240 },
    { top: 174, bottom: 192 },
    { top: 244, bottom: 260 }
  ]), {
    top: 174,
    bottom: 260,
    height: 86
  });
});
