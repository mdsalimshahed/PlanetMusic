import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterAndSortByTitleMatch,
  mergeOnlineSearchResults,
  norm
} from '../src/Application/utils/searchEngine.js';

test('merges matching iTunes and Deezer tracks into one playable result', () => {
  const itunes = [{
    trackId: 123,
    trackName: 'Deja Vu',
    artistName: 'Beyonce',
    collectionName: 'B’Day',
    sourceNames: ['iTunes']
  }];
  const deezer = [{
    id: 456,
    title: 'Déjà Vu',
    artist: 'Beyoncé',
    album: 'B’Day',
    cover: 'https://example.com/cover.jpg',
    link: 'https://www.deezer.com/track/456',
    duration: 200
  }];

  const deezerFirst = mergeOnlineSearchResults([], deezer);
  const itunesFirst = mergeOnlineSearchResults(itunes, []);
  const combinedFromEitherOrder = mergeOnlineSearchResults(itunes, deezer);

  assert.deepEqual(deezerFirst[0].sourceNames, ['Deezer']);
  assert.deepEqual(itunesFirst[0].sourceNames, ['iTunes']);
  assert.equal(combinedFromEitherOrder.length, 1);
  assert.deepEqual(combinedFromEitherOrder[0].sourceNames, ['iTunes', 'Deezer']);
  assert.equal(combinedFromEitherOrder[0].customLinks.deezer, 'https://www.deezer.com/track/456');
});

test('keeps unique Deezer search results and removes duplicate provider IDs', () => {
  const results = mergeOnlineSearchResults(
    [
      { trackId: 1, trackName: 'Song A', artistName: 'Artist A' },
      { trackId: 1, trackName: 'Song A', artistName: 'Artist A' }
    ],
    [
      { id: 2, title: 'Song B', artist: 'Artist B', link: 'https://www.deezer.com/track/2' },
      { id: 2, title: 'Song B', artist: 'Artist B', link: 'https://www.deezer.com/track/2' }
    ]
  );

  assert.equal(results.length, 2);
  assert.equal(results[1].trackId, 'dz_2');
  assert.deepEqual(results[1].sourceNames, ['Deezer']);
  assert.equal(results[1].customLinks.deezer, 'https://www.deezer.com/track/2');
});

test('normalizes accented letters for title and artist search matching', () => {
  assert.equal(norm('Beyoncé - Déjà Vu'), 'beyonce deja vu');
  assert.equal(
    filterAndSortByTitleMatch(
      [{ trackName: 'Déjà Vu', artistName: 'Beyoncé' }],
      'beyonce deja vu'
    ).length,
    1
  );
});
