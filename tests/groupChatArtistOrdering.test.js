import assert from 'node:assert/strict';
import test from 'node:test';
import { getSingingArtistGroups } from '../src/Studio/components/Workspaces/Lyrics/Views/groupChatTimeline.js';
import {
  isArtistDimmed,
  orderGroupChatArtists
} from '../src/Studio/components/Workspaces/Lyrics/Views/GroupChat/utils/groupChatUtils.js';

test('places the most recent adlib beside the first main-line singer', () => {
  const artists = [
    { name: 'Main A' },
    { name: 'Adlib' },
    { name: 'Main B' },
    { name: 'Main C' },
    { name: 'Other active' }
  ];
  const ordered = orderGroupChatArtists({
    artists,
    onlineArtists: new Set(artists.map(artist => artist.name)),
    typingArtists: new Set(),
    mainSingingArtists: new Set(['Main A', 'Main B', 'Main C']),
    adlibSingingArtists: new Set(['Adlib']),
    mainSingingArtistOrder: ['Main C', 'Main A', 'Main B'],
    adlibSingingArtistOrder: ['Adlib'],
    lastLineEndByArtist: new Map([
      ['Main A', 1],
      ['Main B', 2],
      ['Main C', 3],
      ['Adlib', 20],
      ['Other active', 18]
    ]),
    playbackTime: 10
  });

  assert.deepEqual(
    ordered.map(artist => artist.name),
    ['Main C', 'Adlib', 'Main A', 'Main B', 'Other active']
  );
});

test('keeps adlibs adjacent to the first main singer as activity timestamps change', () => {
  const artists = [
    { name: 'Main A' },
    { name: 'Adlib' },
    { name: 'Main B' }
  ];
  const order = lastLineEndByArtist => orderGroupChatArtists({
    artists,
    onlineArtists: new Set(artists.map(artist => artist.name)),
    typingArtists: new Set(),
    mainSingingArtists: new Set(['Main A', 'Main B']),
    adlibSingingArtists: new Set(['Adlib']),
    mainSingingArtistOrder: ['Main A', 'Main B'],
    adlibSingingArtistOrder: ['Adlib'],
    lastLineEndByArtist: new Map(lastLineEndByArtist),
    playbackTime: 10
  }).map(artist => artist.name);

  assert.deepEqual(order([
    ['Main A', 11],
    ['Main B', 14],
    ['Adlib', 30]
  ]), ['Main A', 'Adlib', 'Main B']);
  assert.deepEqual(order([
    ['Main A', 30],
    ['Main B', 11],
    ['Adlib', 14]
  ]), ['Main A', 'Adlib', 'Main B']);
});

test('places the most recently active adlib singer beside the first main singer', () => {
  const timeline = {
    lines: [
      { start: 8, end: 11, artists: ['Earlier adlib'], isAdlib: true },
      { start: 7, end: 12, artists: ['Main'] },
      { start: 9, end: 11, artists: ['Recent adlib'], isAdlib: true }
    ]
  };
  const groups = getSingingArtistGroups(timeline, 10);
  const artists = ['Main', 'Earlier adlib', 'Recent adlib']
    .map(name => ({ name }));
  const ordered = orderGroupChatArtists({
    artists,
    onlineArtists: new Set(artists.map(artist => artist.name)),
    typingArtists: groups.typingArtists,
    mainSingingArtists: groups.mainArtists,
    adlibSingingArtists: groups.adlibArtists,
    mainSingingArtistOrder: groups.mainArtistOrder,
    adlibSingingArtistOrder: groups.adlibArtistOrder,
    typingArtistOrder: groups.typingArtistOrder,
    lastLineEndByArtist: new Map(),
    playbackTime: 10
  });

  assert.deepEqual(groups.adlibArtistOrder, ['Recent adlib', 'Earlier adlib']);
  assert.deepEqual(
    ordered.map(artist => artist.name),
    ['Main', 'Recent adlib', 'Earlier adlib']
  );
});

test('moves a finished main line into typing priority until the next line starts', () => {
  const timeline = {
    lines: [
      {
        start: 88,
        end: 89.64,
        artists: ['Main A', 'Main B', 'Main C']
      },
      {
        start: 89.5,
        end: 90.1,
        artists: ['Adlib'],
        isAdlib: true
      },
      {
        start: 89.724,
        end: 91,
        artists: ['Main A', 'Main B', 'Main C']
      }
    ]
  };

  const groups = getSingingArtistGroups(timeline, 89.644);
  assert.deepEqual(groups.mainArtistOrder, []);
  assert.deepEqual(groups.adlibArtistOrder, ['Adlib']);
  assert.deepEqual(groups.typingArtistOrder, ['Main A', 'Main B', 'Main C']);
});

test('removes a main singer from active priority as soon as the line ends', () => {
  const groups = getSingingArtistGroups({
    lines: [{ start: 10, end: 12, artists: ['Finished singer'] }]
  }, 12);

  assert.deepEqual(groups.mainArtistOrder, []);
  assert.deepEqual(groups.typingArtistOrder, []);
});

test('places an actively singing adlib before artists who are only typing', () => {
  const artists = [
    { name: 'Typing main' },
    { name: 'Active adlib' },
    { name: 'Active main' }
  ];
  const ordered = orderGroupChatArtists({
    artists,
    onlineArtists: new Set(artists.map(artist => artist.name)),
    typingArtists: new Set(['Typing main']),
    mainSingingArtists: new Set(['Active main']),
    adlibSingingArtists: new Set(['Active adlib']),
    mainSingingArtistOrder: ['Active main'],
    adlibSingingArtistOrder: ['Active adlib'],
    typingArtistOrder: ['Typing main'],
    lastLineEndByArtist: new Map(),
    playbackTime: 10
  });

  assert.deepEqual(
    ordered.map(artist => artist.name),
    ['Active main', 'Active adlib', 'Typing main']
  );
});

test('keeps a first-appearance artist full-size until more than two seconds inactive', () => {
  const state = {
    artistName: 'New artist',
    onlineArtists: new Set(['New artist']),
    mainSingingArtists: new Set(),
    adlibSingingArtists: new Set(),
    typingArtists: new Set(),
    lastLineEndByArtist: new Map(),
    playbackTime: 10
  };

  assert.equal(isArtistDimmed(state), false);
  assert.equal(isArtistDimmed({
    ...state,
    lastLineEndByArtist: new Map([['New artist', 8]]),
    playbackTime: 10
  }), false);
  assert.equal(isArtistDimmed({
    ...state,
    lastLineEndByArtist: new Map([['New artist', 7.99]]),
    playbackTime: 10
  }), true);
  assert.equal(isArtistDimmed({
    ...state,
    lastLineEndByArtist: new Map([['New artist', 7]]),
    typingArtists: new Set(['New artist']),
    playbackTime: 10
  }), false);
});
