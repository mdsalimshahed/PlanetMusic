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

test('switches sides for statistical same-artist gap outliers', () => {
  const chat = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'First line' },
      { singer: 'Ari', text: 'Second line' },
      { singer: 'Ari', text: 'Third line' },
      { singer: 'Ari', text: 'Fourth line' },
      { singer: 'Ari', text: 'Fifth line' },
      { singer: 'Ari', text: 'Sixth line' }
    ],
    [
      { start: 1, end: 1.1 },
      { start: 1.3, end: 1.4 },
      { start: 1.6, end: 1.7 },
      { start: 1.9, end: 2 },
      { start: 2.2, end: 2.3 },
      { start: 5.3, end: 5.4 }
    ],
    'Fallback'
  );
  const groups = groupConsecutiveMessages(chat.events);

  assert.deepEqual(groups.map(group => ({
    side: group.side,
    lines: group.events.map(event => event.line.text)
  })), [
    {
      side: 'left',
      lines: ['First line', 'Second line', 'Third line', 'Fourth line', 'Fifth line']
    },
    {
      side: 'right',
      lines: ['Sixth line']
    }
  ]);
});

test('does not use timing outliers for multi-artist songs', () => {
  const chat = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'First line' },
      { singer: 'Ari', text: 'Second line' },
      { singer: 'Ari', text: 'Third line' },
      { singer: 'Ari', text: 'Fourth line' },
      { singer: 'Ari', text: 'Fifth line' },
      { singer: 'Ari', text: 'Sixth line' },
      { singer: 'Bea', text: 'Bea line' }
    ],
    [
      { start: 1, end: 1.1 },
      { start: 1.3, end: 1.4 },
      { start: 1.6, end: 1.7 },
      { start: 1.9, end: 2 },
      { start: 2.2, end: 2.3 },
      { start: 5.3, end: 5.4 },
      { start: 5.6, end: 5.7 }
    ],
    'Fallback'
  );
  const groups = groupConsecutiveMessages(chat.events);

  assert.deepEqual(groups.map(group => ({
    side: group.side,
    lines: group.events.map(event => event.line.text)
  })), [
    {
      side: 'left',
      lines: [
        'First line', 'Second line', 'Third line',
        'Fourth line', 'Fifth line', 'Sixth line'
      ]
    },
    { side: 'right', lines: ['Bea line'] }
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

test('keeps consecutive ad-libs from the same reordered artist cluster on one side', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Ari',
        text: 'First lead',
        segments: [{ text: 'First lead', artists: ['Ari'] }]
      },
      {
        singer: 'Ari',
        text: 'Second lead',
        segments: [{ text: 'Second lead', artists: ['Ari'] }]
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
  const adlibGroups = groups.filter(group => group.events[0].line.isAdlib);
  const history = buildGroupChatHistory(messages);
  const adlibHistory = history.filter(item => (
    item.type === 'message-chain' && item.events[0].line.isAdlib
  ));

  assert.equal(adlibGroups.length, 2);
  assert.equal(adlibGroups[0].side, adlibGroups[1].side);
  assert.deepEqual(adlibHistory.map(item => item.events.map(event => event.line.text)), [[
    'First echo',
    'Second echo'
  ]]);
  assert.deepEqual(adlibHistory.map(item => item.artists), [['Echo', 'Harmony']]);
});

test('keeps consecutive ad-libs from one artist on the same side', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Ari',
        text: 'Ari lead',
        segments: [{ text: 'Ari lead', artists: ['Ari'] }]
      },
      {
        singer: 'Bea',
        text: 'Bea reply',
        segments: [{ text: 'Bea reply', artists: ['Bea'] }]
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
          segments: [{ text: 'First echo', artists: ['Echo'] }]
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
          segments: [{ text: 'Second echo', artists: ['Echo'] }]
        }]
      }
    ],
    'Fallback'
  );
  const ari = chat.lines.find(line => line.text === 'Ari lead');
  const bea = chat.lines.find(line => line.text === 'Bea reply');
  const firstAdlib = chat.lines.find(line => line.text === 'First echo');
  const secondAdlib = chat.lines.find(line => line.text === 'Second echo');

  assert.ok(ari);
  assert.ok(bea);
  assert.ok(firstAdlib);
  assert.ok(secondAdlib);
  assert.notEqual(firstAdlib.chatSide, bea.chatSide);
  assert.equal(firstAdlib.chatSide, ari.chatSide);
  assert.equal(firstAdlib.chatSide, secondAdlib.chatSide);
  assert.equal(secondAdlib.chatSide, ari.chatSide);
});

test('places following bubbles opposite the preceding ad-lib', () => {
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
          text: 'Marty first ad-lib',
          start: 1.4,
          end: 1.7,
          segments: [{ text: 'Marty first ad-lib', artists: ['Marty'] }]
        }]
      },
      {
        start: 2,
        end: 2.5,
        isSplit: true,
        adlibs: [{
          text: 'Echo source ad-lib',
          start: 2.6,
          end: 2.9,
          segments: [{ text: 'Echo source ad-lib', artists: ['Echo'] }]
        }]
      }
    ],
    'Fallback'
  );
  const sourceLine = chat.lines.find(line => line.text === 'Echo answer');
  const firstAdlib = chat.lines.find(line => line.text === 'Marty first ad-lib');
  const sourceAdlib = chat.lines.find(line => line.text === 'Echo source ad-lib');
  const ari = chat.lines.find(line => line.text === 'Ari lead');

  assert.ok(ari);
  assert.ok(sourceLine);
  assert.ok(firstAdlib);
  assert.ok(sourceAdlib);
  assert.notEqual(ari.chatSide, firstAdlib.chatSide);
  assert.notEqual(firstAdlib.chatSide, sourceLine.chatSide);
  assert.notEqual(sourceLine.chatSide, sourceAdlib.chatSide);
});

test('places following same-artist main lyrics opposite ad-libs', () => {
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
      },
      {
        singer: 'Echo',
        text: 'Echo continues',
        segments: [{ text: 'Echo continues', artists: ['Echo'] }]
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
      { start: 3, end: 4 },
      { start: 4.5, end: 5 }
    ],
    'Fallback'
  );
  const adlib = chat.lines.find(line => line.isAdlib);
  const followingLine = chat.lines.find(line => line.text === 'Echo answer');
  const continuedLine = chat.lines.find(line => line.text === 'Echo continues');

  assert.ok(adlib);
  assert.ok(followingLine);
  assert.ok(continuedLine);
  assert.deepEqual(adlib.artists, ['Echo']);
  assert.deepEqual(followingLine.artists, ['Echo']);
  assert.notEqual(adlib.chatSide, chat.lines.find(line => line.text === 'Ari lead').chatSide);
  assert.notEqual(followingLine.chatSide, adlib.chatSide);
  assert.equal(followingLine.chatSide, continuedLine.chatSide);
});

test('keeps consecutive same-artist lyrics together with an ad-lib', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Marty',
        text: 'First Marty line',
        segments: [{ text: 'First Marty line', artists: ['Marty'] }]
      },
      {
        singer: 'Marty',
        text: 'Second Marty line',
        segments: [{ text: 'Second Marty line', artists: ['Marty'] }]
      }
    ],
    [
      { start: 1, end: 1.5 },
      {
        start: 2,
        end: 2.5,
        isSplit: true,
        adlibs: [{
          text: 'Marty echo',
          start: 2.6,
          end: 2.9,
          segments: [{ text: 'Marty echo', artists: ['Marty'] }]
        }]
      }
    ],
    'Fallback'
  );
  const firstLine = chat.lines.find(line => line.text === 'First Marty line');
  const secondLine = chat.lines.find(line => line.text === 'Second Marty line');
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.ok(firstLine);
  assert.ok(secondLine);
  assert.ok(adlib);
  assert.equal(firstLine.chatSide, secondLine.chatSide);
  assert.notEqual(secondLine.chatSide, adlib.chatSide);
});

test('does not let an ad-lib change main-lyric side assignment', () => {
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
  const sourceLine = chat.lines.find(line => line.text === 'Ari lead');
  const followingLine = chat.lines.find(line => line.text === 'Jisoo reply');

  assert.ok(adlib);
  assert.ok(sourceLine);
  assert.ok(followingLine);
  assert.notEqual(adlib.chatSide, sourceLine.chatSide);
  assert.notEqual(followingLine.chatSide, adlib.chatSide);
});

test('places an ad-lib opposite the immediately previous artist group', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Ari',
        text: 'Ari lead',
        segments: [{ text: 'Ari lead', artists: ['Ari'] }]
      },
      {
        singer: 'Bea',
        text: 'Bea reply',
        segments: [{ text: 'Bea reply', artists: ['Bea'] }]
      }
    ],
    [
      {
        start: 1,
        end: 1.5,
        isSplit: true,
        adlibs: [{
          text: 'Echo ad-lib',
          start: 2.4,
          end: 2.8,
          segments: [{ text: 'Echo ad-lib', artists: ['Echo'] }]
        }]
      },
      { start: 2, end: 2.5 }
    ],
    'Fallback'
  );
  const ari = chat.lines.find(line => line.text === 'Ari lead');
  const bea = chat.lines.find(line => line.text === 'Bea reply');
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.ok(ari);
  assert.ok(bea);
  assert.ok(adlib);
  assert.equal(ari.chatSide, adlib.chatSide);
  assert.notEqual(adlib.chatSide, bea.chatSide);
});
