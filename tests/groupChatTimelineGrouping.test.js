import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline,
  groupConsecutiveMessages
} from '../src/Studio/components/Workspaces/Lyrics/Views/groupChatTimeline.js';

const timeline = buildGroupChatTimeline(
  [
    { singer: 'Ari', text: 'First line', color: '#ff0000' },
    { singer: 'Bea', text: 'Reply', color: '#00ff00' },
    { singer: 'Ari', text: 'Last line', color: '#ff0000' }
  ],
  [{ start: 10, end: 12 }, { start: 14, end: 16 }, { start: 20, end: 22 }],
  'Fallback'
);

test('groups consecutive lyric lines from the same artist into one chat turn', () => {
  const groups = groupConsecutiveMessages(timeline.events);

  assert.deepEqual(groups.map(group => ({
    artists: group.artists,
    lines: group.events.map(event => event.line.text)
  })), [
    { artists: ['Ari'], lines: ['First line'] },
    { artists: ['Bea'], lines: ['Reply'] },
    { artists: ['Ari'], lines: ['Last line'] }
  ]);

  const repeatedArtist = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'One', translation: 'Uno' },
      { singer: 'Ari', text: 'Two' }
    ],
    [{ start: 1, end: 2, pronunciation: 'waan' }, { start: 3, end: 4 }],
    'Fallback'
  );
  const repeatedGroups = groupConsecutiveMessages(repeatedArtist.events);
  const repeatedHistory = buildGroupChatHistory(
    repeatedArtist.events.filter(event => event.type === 'message')
  );

  assert.equal(repeatedGroups.length, 1);
  assert.equal(repeatedGroups[0].events.length, 2);
  assert.equal(repeatedHistory.length, 1);
  assert.equal(repeatedHistory[0].events.length, 2);
  assert.ok(repeatedHistory.every(item => item.type === 'message-chain'));
  assert.ok(repeatedHistory.every(item => item.side === repeatedGroups[0].side));
  assert.equal(repeatedGroups[0].events[0].line.lyric.translation, 'Uno');
  assert.equal(repeatedGroups[0].events[0].line.savedNode.pronunciation, 'waan');
});

test('alternates sides when artists change and treats reordered duos as the same group', () => {
  const chat = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'Ari one' },
      { singer: 'Ari', text: 'Ari two' },
      { singer: 'Bea', text: 'Bea one' },
      { singer: 'Ari', text: 'Ari three' },
      { singer: 'Ari & Bea', text: 'Duo one' },
      { singer: 'Bea & Ari', text: 'Duo two' }
    ],
    [1, 2, 3, 4, 5, 6].map(start => ({ start })),
    'Fallback'
  );
  const groups = groupConsecutiveMessages(chat.events);

  assert.deepEqual(groups.map(group => group.side), ['left', 'right', 'left', 'right']);
  assert.deepEqual(groups[3].events.map(event => event.line.text), ['Duo one', 'Duo two']);

  const messageEvents = chat.events.filter(event => event.type === 'message');
  assert.deepEqual(
    groupConsecutiveMessages(messageEvents.slice(-3)).map(group => group.side),
    ['left', 'right']
  );
  assert.equal(messageEvents[0].line.chatSide, messageEvents[3].line.chatSide);
});

test('switches sides when an artist gap is much longer than their recent gaps', () => {
  const chat = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'First line' },
      { singer: 'Ari', text: 'Second line' },
      { singer: 'Ari', text: 'Third line' },
      { singer: 'Ari', text: 'Fourth line' }
    ],
    [
      { start: 1, end: 1.5 },
      { start: 2, end: 2.5 },
      { start: 3, end: 3.5 },
      { start: 6, end: 6.5 }
    ],
    'Fallback'
  );
  const groups = groupConsecutiveMessages(chat.events);

  assert.deepEqual(groups.map(group => ({
    side: group.side,
    lines: group.events.map(event => event.line.text)
  })), [
    { side: 'left', lines: ['First line', 'Second line', 'Third line'] },
    { side: 'right', lines: ['Fourth line'] }
  ]);
});

test('adapts the side-switch threshold to an artist with a slower regular pace', () => {
  const chat = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'First line' },
      { singer: 'Ari', text: 'Second line' },
      { singer: 'Ari', text: 'Third line' },
      { singer: 'Ari', text: 'Fourth line' },
      { singer: 'Ari', text: 'Fifth line' }
    ],
    [
      { start: 1, end: 2 },
      { start: 6, end: 7 },
      { start: 11, end: 12 },
      { start: 20, end: 21 },
      { start: 33, end: 34 }
    ],
    'Fallback'
  );
  const groups = groupConsecutiveMessages(chat.events);

  assert.deepEqual(groups.map(group => ({
    side: group.side,
    lines: group.events.map(event => event.line.text)
  })), [
    { side: 'left', lines: ['First line', 'Second line', 'Third line', 'Fourth line'] },
    { side: 'right', lines: ['Fifth line'] }
  ]);
});

test('keeps an artist on their side when they return after another artist speaks', () => {
  const chat = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'Ari first' },
      { singer: 'Bea', text: 'Bea replies' },
      { singer: 'Ari', text: 'Ari returns' }
    ],
    [
      { start: 1, end: 2 },
      { start: 2.5, end: 3 },
      { start: 4, end: 5 }
    ],
    'Fallback'
  );
  const groups = groupConsecutiveMessages(chat.events);

  assert.deepEqual(groups.map(group => ({
    side: group.side,
    lines: group.events.map(event => event.line.text)
  })), [
    { side: 'left', lines: ['Ari first'] },
    { side: 'right', lines: ['Bea replies'] },
    { side: 'left', lines: ['Ari returns'] }
  ]);
});

test('chains consecutive ad-libs from matching artist clusters', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Ari',
        text: 'First lead',
        segments: [{ text: 'First lead', artists: ['Ari'] }]
      },
      {
        singer: 'Bea',
        text: 'Second lead',
        segments: [{ text: 'Second lead', artists: ['Bea'] }]
      }
    ],
    [
      {
        start: 1,
        end: 1.5,
        isSplit: true,
        adlibs: [{
          text: 'First echo',
          start: 2,
          end: 2.3,
          segments: [{ text: 'First echo', artists: ['Echo', 'Harmony'] }]
        }]
      },
      {
        start: 1.7,
        end: 1.9,
        isSplit: true,
        adlibs: [{
          text: 'Second echo',
          start: 2.6,
          end: 2.9,
          segments: [{ text: 'Second echo', artists: ['Harmony', 'Echo'] }]
        }]
      }
    ],
    'Fallback'
  );
  const messages = chat.events.filter(event => event.type === 'message');
  const groups = groupConsecutiveMessages(messages);
  const adlibGroup = groups.find(group => group.events[0].line.isAdlib);
  const history = buildGroupChatHistory(messages);
  const adlibChain = history.find(item => (
    item.type === 'message-chain' && item.events[0].line.isAdlib
  ));

  assert.deepEqual(adlibGroup.events.map(event => event.line.text), [
    'First echo',
    'Second echo'
  ]);
  assert.equal(adlibGroup.events[0].line.chatSide, adlibGroup.events[1].line.chatSide);
  assert.deepEqual(adlibChain.events.map(event => event.line.text), [
    'First echo',
    'Second echo'
  ]);
  assert.deepEqual(adlibChain.artists, ['Echo', 'Harmony']);
});

test('places a following ad-lib artist lyric on the opposite side', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Ari',
        text: 'Ari lead',
        segments: [{ text: 'Ari lead', artists: ['Ari'] }]
      },
      {
        singer: 'Echo',
        text: 'Echo answer',
        segments: [{ text: 'Echo answer', artists: ['Echo'] }]
      }
    ],
    [
      {
        start: 1,
        end: 1.5,
        isSplit: true,
        adlibs: [{
          text: 'Echo ad-lib',
          start: 2,
          end: 2.5,
          segments: [{ text: 'Echo ad-lib', artists: ['Echo'] }]
        }]
      },
      { start: 3, end: 4 }
    ],
    'Fallback'
  );
  const adlib = chat.lines.find(line => line.isAdlib);
  const followingLine = chat.lines.find(line => line.text === 'Echo answer');

  assert.ok(adlib);
  assert.ok(followingLine);
  assert.deepEqual(adlib.artists, ['Echo']);
  assert.deepEqual(followingLine.artists, ['Echo']);
  assert.notEqual(adlib.chatSide, followingLine.chatSide);
});

test('switches sides when an ad-lib changes the consecutive artist', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Ari',
        text: 'Ari lead',
        segments: [{ text: 'Ari lead', artists: ['Ari'] }]
      },
      {
        singer: 'Jisoo',
        text: 'Jisoo reply',
        segments: [{ text: 'Jisoo reply', artists: ['Jisoo'] }]
      }
    ],
    [
      {
        start: 1,
        end: 1.5,
        isSplit: true,
        adlibs: [{
          text: 'Lisa ad-lib',
          start: 2,
          end: 2.5,
          segments: [{ text: 'Lisa ad-lib', artists: ['Lisa'] }]
        }]
      },
      { start: 3, end: 4 }
    ],
    'Fallback'
  );
  const adlib = chat.lines.find(line => line.isAdlib);
  const followingLine = chat.lines.find(line => line.text === 'Jisoo reply');

  assert.ok(adlib);
  assert.ok(followingLine);
  assert.notEqual(adlib.chatSide, followingLine.chatSide);
});
