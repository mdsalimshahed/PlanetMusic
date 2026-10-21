import assert from 'node:assert/strict';
import test from 'node:test';
import { getSyncWorkspaceLyrics } from '../src/Studio/components/Workspaces/Lyrics/syncWorkspaceLyrics.js';
import { usesCjkWordSpacing } from '../src/components/LyricsRenderer/textUtils.js';

test('returns only Sync workspace rows without parsing or fallback data', () => {
  const syncData = [
    { text: 'Synced lyric', segments: [{ text: 'Sync segment' }], start: 12 },
    { text: '', segments: [], start: 14 }
  ];

  assert.equal(getSyncWorkspaceLyrics(syncData), syncData);
});

test('returns no lyric rows when Sync workspace data is unavailable', () => {
  assert.deepEqual(getSyncWorkspaceLyrics(null), []);
  assert.deepEqual(getSyncWorkspaceLyrics(undefined), []);
});

test('detects Chinese and Japanese for saved auto-spacing chunk rendering', () => {
  assert.equal(usesCjkWordSpacing('ja', '歌詞'), true);
  assert.equal(usesCjkWordSpacing('zh-CN', '歌词'), true);
  assert.equal(usesCjkWordSpacing('auto', 'こんにちは'), true);
  assert.equal(usesCjkWordSpacing('auto', 'Hello there'), false);
  assert.equal(usesCjkWordSpacing('ko', '한국어'), false);
});
