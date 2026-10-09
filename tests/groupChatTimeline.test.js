import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline,
  getActiveChatLines,
  getGroupChatState
} from '../src/Studio/components/Workspaces/Lyrics/Views/groupChatTimeline.js';

const timeline = buildGroupChatTimeline(
  [
    { singer: 'Ari', text: 'First line', color: '#ff0000' },
    { singer: 'Bea', text: 'Reply', color: '#00ff00' },
    { singer: 'Ari', text: 'Last line', color: '#ff0000' }
  ],
  [
    { start: 10, end: 12 },
    { start: 14, end: 16 },
    { start: 20, end: 22 }
  ],
  'Fallback'
);

test('builds persistent artist join, lyric, and leave events from synced lines', () => {
  assert.deepEqual(timeline.events.map(event => [event.type, event.time, event.artist?.name || event.line?.text]), [
    ['join', 6, 'Ari'],
    ['join', 10, 'Bea'],
    ['message', 10, 'First line'],
    ['message', 14, 'Reply'],
    ['message', 20, 'Last line'],
    ['leave', 24.5, 'Bea'],
    ['leave', 30.5, 'Ari']
  ].sort((first, second) => first[1] - second[1]));
});

test('shows artists online, typing before their next line, and chat history through seeks', () => {
  assert.deepEqual(getGroupChatState(timeline, 9).typingArtists, ['Ari']);
  assert.deepEqual(getGroupChatState(timeline, 9.1).typingArtists, ['Ari']);
  assert.deepEqual(getGroupChatState(timeline, 7.99).typingArtists, []);

  const atLine = getGroupChatState(timeline, 10);
  assert.deepEqual(atLine.artists.map(artist => artist.name), ['Ari', 'Bea']);
  assert.deepEqual(atLine.messages.filter(event => event.type === 'message').map(event => event.line.text), ['First line']);

  const afterBeaLeaves = getGroupChatState(timeline, 24.6);
  assert.deepEqual(afterBeaLeaves.artists.map(artist => artist.name), ['Ari']);
  assert.ok(afterBeaLeaves.messages.some(event => event.type === 'leave' && event.artist.name === 'Bea'));

  const seekBack = getGroupChatState(timeline, 11);
  assert.deepEqual(seekBack.messages.filter(event => event.type === 'message').map(event => event.line.text), ['First line']);
});

test('keeps typing prediction continuous across closely spaced lyric lines', () => {
  const quickLines = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'First' },
      { singer: 'Bea', text: 'Next' }
    ],
    [
      { start: 10, end: 10.5 },
      { start: 11.2, end: 11.8 }
    ],
    'Fallback'
  );

  assert.deepEqual(getGroupChatState(quickLines, 7.9).typingArtists, []);
  assert.deepEqual(getGroupChatState(quickLines, 8).typingArtists, ['Ari']);
  assert.deepEqual(getGroupChatState(quickLines, 9.1).typingArtists, ['Ari']);
  assert.deepEqual(getGroupChatState(quickLines, 9.5).typingArtists, ['Ari', 'Bea']);
  assert.deepEqual(getGroupChatState(quickLines, 10).typingArtists, ['Bea']);
  assert.deepEqual(getGroupChatState(quickLines, 10.1).typingArtists, ['Bea']);
  assert.deepEqual(getGroupChatState(quickLines, 10.3).typingArtists, ['Bea']);
  assert.deepEqual(getGroupChatState(quickLines, 11.2).typingArtists, []);
});

test('clusters multiple artists with lines inside the two-second window', () => {
  const clusteredLines = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'First' },
      { singer: 'Bea', text: 'Next' }
    ],
    [
      { start: 10, end: 10.4 },
      { start: 10.8, end: 11.2 }
    ],
    'Fallback'
  );

  assert.deepEqual(getGroupChatState(clusteredLines, 9.9).typingArtists, ['Ari', 'Bea']);
});

test('shows typing only during the two-second lead-in before a line', () => {
  const spacedLines = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'First' },
      { singer: 'Bea', text: 'Next' }
    ],
    [
      { start: 10, end: 10.5 },
      { start: 13, end: 13.5 }
    ],
    'Fallback'
  );

  assert.deepEqual(getGroupChatState(spacedLines, 8).typingArtists, ['Ari']);
  assert.deepEqual(getGroupChatState(spacedLines, 7.99).typingArtists, []);
  assert.deepEqual(getGroupChatState(spacedLines, 8.01).typingArtists, ['Ari']);
  assert.deepEqual(getGroupChatState(spacedLines, 10).typingArtists, []);
  assert.deepEqual(getGroupChatState(spacedLines, 11).typingArtists, ['Bea']);
  assert.deepEqual(getGroupChatState(spacedLines, 11.01).typingArtists, ['Bea']);
  assert.deepEqual(getGroupChatState(spacedLines, 12).typingArtists, ['Bea']);
  assert.deepEqual(getGroupChatState(spacedLines, 12.1).typingArtists, ['Bea']);
});

test('includes ad-lib artists in the upcoming typing activity window', () => {
  const splitLine = buildGroupChatTimeline(
    [{
      singer: 'Ari, Bea',
      text: 'Lead echo',
      segments: [
        { text: 'Lead ', artists: ['Ari'] },
        { text: 'echo', artists: ['Bea'] }
      ]
    }],
    [{
      start: 1,
      end: 4,
      isSplit: true,
      adlibs: [{
        text: 'echo',
        charStart: 5,
        charEnd: 9,
        start: 2,
        end: 2.5,
        singer: 'Bea',
        segments: [{ text: 'echo', artists: ['Bea'] }]
      }]
    }],
    'Fallback'
  );

  assert.deepEqual(getGroupChatState(splitLine, 0.01).typingArtists, ['Ari', 'Bea']);
  assert.deepEqual(getGroupChatState(splitLine, 1.5).typingArtists, ['Bea']);
  assert.deepEqual(getGroupChatState(splitLine, 2).typingArtists, []);
});

test('identifies only lyrics active at the current playback time', () => {
  assert.deepEqual(getActiveChatLines(timeline, 11).map(line => line.text), ['First line']);
  assert.deepEqual(getActiveChatLines(timeline, 12), []);
  assert.deepEqual(getActiveChatLines(timeline, 0), []);
});

test('retains the complete message history for scrolling', () => {
  const longTimeline = buildGroupChatTimeline(
    Array.from({ length: 35 }, (_, index) => ({
      singer: 'Ari',
      text: `Line ${index + 1}`
    })),
    Array.from({ length: 35 }, (_, index) => ({
      start: index + 1,
      end: index + 1.5
    })),
    'Fallback'
  );
  const state = getGroupChatState(longTimeline, 40);

  assert.equal(state.messages.filter(event => event.type === 'message').length, 35);
});

test('includes join and leave notices between grouped lyric messages', () => {
  const history = buildGroupChatHistory(getGroupChatState(timeline, 31).messages);

  assert.deepEqual(history.map(item => item.type), [
    'join',
    'join',
    'message-chain',
    'message-chain',
    'message-chain',
    'leave',
    'leave'
  ]);
  assert.equal(history[0].event.artist.name, 'Ari');
  assert.equal(history[5].event.artist.name, 'Bea');
});
