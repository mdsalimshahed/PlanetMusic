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

test('keeps each artist group on a stable side and treats reordered duos as the same group', () => {
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
