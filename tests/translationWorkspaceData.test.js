import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTranslationWorkspaceData,
  findNextTranslationImportTarget
} from '../src/Studio/utils/translationWorkspaceData.js';

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

test('matches imported lyrics in order while skipping empty standalone main rows', () => {
  const workspaceData = [
    { displayText: 'Opening line' },
    { displayText: '' },
    { displayText: '(standalone ad-lib)' },
    { displayText: 'Following line' }
  ];

  const adlibIndex = findNextTranslationImportTarget(
    workspaceData,
    '(standalone ad-lib)',
    1
  );
  const followingIndex = findNextTranslationImportTarget(
    workspaceData,
    ' Following   line ',
    adlibIndex + 1
  );

  assert.equal(adlibIndex, 2);
  assert.equal(followingIndex, 3);
  assert.equal(findNextTranslationImportTarget(workspaceData, '', 1), -1);
});

test('matches repeated imported lyrics against successive workspace rows', () => {
  const workspaceData = [
    { displayText: 'Repeated line' },
    { displayText: 'Repeated line' }
  ];

  const firstIndex = findNextTranslationImportTarget(workspaceData, 'Repeated line');
  const secondIndex = findNextTranslationImportTarget(workspaceData, 'Repeated line', firstIndex + 1);

  assert.equal(firstIndex, 0);
  assert.equal(secondIndex, 1);
});

test('matches accented, decomposed, and confusable lyric characters during import', () => {
  const workspaceData = [
    { displayText: 'No fuе el destino' },
    { displayText: 'El camión ya salió' }
  ];

  assert.equal(
    findNextTranslationImportTarget(workspaceData, 'No fue el destino'),
    0
  );
  assert.equal(
    findNextTranslationImportTarget(workspaceData, 'El camion ya salio', 1),
    1
  );
  assert.equal(
    findNextTranslationImportTarget(workspaceData, 'El camio\u0301n ya salio\u0301', 1),
    1
  );
});

test('prefers the ad-lib row when the full main lyric is also represented as an ad-lib', () => {
  const rows = buildTranslationWorkspaceData(
    {
      syncData: [{
        text: '(Todo por debajo ‘el agua, submarino)',
        isSplit: true,
        adlibs: [{ text: '(Todo por debajo ‘el agua, submarino)' }]
      }]
    },
    {},
    {},
    []
  );

  assert.equal(rows[0].displayText, rows[1].displayText);
  assert.equal(
    findNextTranslationImportTarget(rows, '(Todo por debajo el agua, submarino)'),
    1
  );
});

test('maps a full-line ad-lib when its parent main lyric is empty', () => {
  const rows = buildTranslationWorkspaceData(
    {
      syncData: [{
        text: '',
        translation: 'must not be shown',
        isSplit: true,
        adlibs: [{
          text: '(Todo por debajo ‘el agua, submarino)',
          translation: 'Everything below the water, submarine'
        }]
      }]
    },
    {},
    {},
    []
  );

  assert.equal(rows[0].displayText, '');
  assert.equal(rows[0].translation, '');
  assert.equal(rows[1].translation, 'Everything below the water, submarine');
  assert.equal(
    findNextTranslationImportTarget(rows, '(Todo por debajo el agua, submarino)'),
    1
  );
});

test('clears saved pronunciation for Latin lyrics containing a confusable glyph', () => {
  const [row] = buildTranslationWorkspaceData(
    {
      syncData: [{
        text: 'No fuе el destino',
        lang: 'es',
        pronunciation: JSON.stringify({ full: 'No fue el destino', chunks: [] })
      }]
    },
    {},
    {},
    []
  );

  assert.equal(row.displayPron, '');
  assert.equal(row.pronunciation, '');
});
