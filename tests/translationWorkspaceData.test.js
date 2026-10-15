import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTranslationWorkspaceData } from '../src/Studio/utils/translationWorkspaceData.js';

test('uses sync text and parsed segment attribution without mutating the source rows', () => {
  const syncRow = {
    text: '_Godzilla, fire spitter_, monster',
    start: 2,
    end: 4,
    spacingText: '_Godzilla, fire spitter_, monster',
    segments: [{ text: 'old data', artists: ['Old Artist'] }]
  };
  const parsedSegments = [
    { text: 'Godzilla, fire spitter', artists: ['Eminem'] },
    { text: ', monster', artists: ['Juice WRLD'] }
  ];

  const rows = buildTranslationWorkspaceData(
    { artistName: 'Eminem', syncData: [syncRow] },
    {},
    {},
    [{ segments: parsedSegments }]
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayText, syncRow.text);
  assert.equal(rows[0].spacingText, syncRow.spacingText);
  assert.deepEqual(rows[0].segments, parsedSegments);
  assert.equal(rows[0]._meta.isAdlib, false);
  assert.deepEqual(syncRow.segments, [{ text: 'old data', artists: ['Old Artist'] }]);
});

test('creates translation-workspace main and ad-lib rows with source indices', () => {
  const rows = buildTranslationWorkspaceData(
    {
      artistName: 'Artist',
      syncData: [{
        text: 'Main line (ad-lib)',
        isSplit: true,
        adlibs: [{ text: '(ad-lib)', start: 3, end: 4 }]
      }]
    },
    {},
    {},
    [{ segments: [{ text: 'Main line (ad-lib)', artists: ['Artist'] }] }]
  );

  assert.deepEqual(rows.map(row => row._meta), [
    { isAdlib: false, lineIndex: 0 },
    { isAdlib: true, lineIndex: 0, adlibIndex: 0 }
  ]);
  assert.equal(rows[1].displayText, '(ad-lib)');
});

test('preserves source indices and skips malformed sync rows without crashing', () => {
  const rows = buildTranslationWorkspaceData(
    {
      syncData: [
        { text: 'First', start: 1, segments: 'invalid' },
        null,
        {
          text: 'Third',
          start: 3,
          isSplit: true,
          adlibs: [null, { text: 'Ad-lib', start: 4, segments: null }]
        }
      ]
    },
    {},
    {},
    []
  );

  assert.deepEqual(rows.map(row => row._meta), [
    { isAdlib: false, lineIndex: 0 },
    { isAdlib: false, lineIndex: 1 },
    { isAdlib: false, lineIndex: 2 },
    { isAdlib: true, lineIndex: 2, adlibIndex: 0 },
    { isAdlib: true, lineIndex: 2, adlibIndex: 1 }
  ]);
  assert.deepEqual(rows[0].segments, []);
  assert.equal(rows[2].displayText, 'Third');
  assert.deepEqual(rows[4].segments, []);
});
