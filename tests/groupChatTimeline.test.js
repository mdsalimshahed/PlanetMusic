import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline,
  getActiveChatLines,
  getGroupChatState,
  groupConsecutiveMessages
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
    ['leave', 19.5, 'Bea'],
    ['leave', 25.5, 'Ari']
  ].sort((first, second) => first[1] - second[1]));
});

test('shows artists online, typing before their next line, and chat history through seeks', () => {
  assert.deepEqual(getGroupChatState(timeline, 9).typingArtists, ['Ari']);

  const atLine = getGroupChatState(timeline, 10);
  assert.deepEqual(atLine.artists.map(artist => artist.name), ['Ari', 'Bea']);
  assert.deepEqual(atLine.messages.filter(event => event.type === 'message').map(event => event.line.text), ['First line']);

  const afterBeaLeaves = getGroupChatState(timeline, 19.6);
  assert.deepEqual(afterBeaLeaves.artists.map(artist => artist.name), ['Ari']);
  assert.ok(afterBeaLeaves.messages.some(event => event.type === 'leave' && event.artist.name === 'Bea'));

  const seekBack = getGroupChatState(timeline, 11);
  assert.deepEqual(seekBack.messages.filter(event => event.type === 'message').map(event => event.line.text), ['First line']);
});

test('identifies only lyrics active at the current playback time', () => {
  assert.deepEqual(getActiveChatLines(timeline, 11).map(line => line.text), ['First line']);
  assert.deepEqual(getActiveChatLines(timeline, 12), []);
  assert.deepEqual(getActiveChatLines(timeline, 0), []);
});

test('includes join and leave notices between grouped lyric messages', () => {
  const history = buildGroupChatHistory(getGroupChatState(timeline, 30).messages);

  assert.deepEqual(history.map(item => item.type), [
    'join',
    'join',
    'message-chain',
    'message-chain',
    'leave',
    'message-chain',
    'leave'
  ]);
  assert.equal(history[0].event.artist.name, 'Ari');
  assert.equal(history[4].event.artist.name, 'Bea');
});

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

test('splits ad-lib-only artists into their own chat bubbles', () => {
  const splitLine = buildGroupChatTimeline(
    [{
      singer: 'Ari, Bea',
      text: 'Lead (echo)',
      segments: [
        { text: 'Lead ', artists: ['Ari'] },
        { text: '(echo)', artists: ['Bea'] }
      ]
    }],
    [{
      start: 1,
      end: 4,
      isSplit: true,
      adlibs: [{
        text: 'echo',
        charStart: 5,
        charEnd: 11,
        start: 2,
        end: 3,
        singer: 'Bea',
        segments: [{ text: 'echo', artists: ['Bea'] }],
        translation: 'echo translation',
        pronunciation: 'echo pronunciation'
      }]
    }],
    'Fallback',
    { Ari: '#ff0000', Bea: '#0000ff' }
  );
  const lineMessages = splitLine.events.filter(event => event.type === 'message');
  const groups = groupConsecutiveMessages(lineMessages);

  assert.deepEqual(
    getActiveChatLines(splitLine, 2.5).map(line => line.text),
    ['Lead (echo)', 'echo']
  );
  assert.equal(lineMessages.length, 2);
  assert.deepEqual(lineMessages.map(event => event.line.artists), [['Ari'], ['Bea']]);
  assert.deepEqual(lineMessages.map(event => event.line.isAdlib || false), [false, true]);
  assert.equal(lineMessages[1].line.lyric.translation, 'echo translation');
  assert.equal(lineMessages[1].line.savedNode.pronunciation, 'echo pronunciation');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].side, 'left');
  assert.equal(groups[1].side, 'right');
  assert.equal(lineMessages[0].line.chatSide, groups[0].side);
  assert.equal(lineMessages[1].line.chatSide, groups[1].side);

  const sameArtistSplit = buildGroupChatTimeline(
    [{
      singer: 'Ari',
      text: 'Lead echo',
      segments: [{ text: 'Lead echo', artists: ['Ari'] }]
    }],
    [{
      start: 1,
      isSplit: true,
      adlibs: [{
        text: 'echo',
        charStart: 5,
        charEnd: 9,
        start: 2,
        singer: 'Ari',
        segments: [{ text: 'echo', artists: ['Ari'] }]
      }]
    }],
    'Fallback'
  );
  const sameArtistGroups = groupConsecutiveMessages(
    sameArtistSplit.events.filter(event => event.type === 'message')
  );
  assert.equal(sameArtistGroups.length, 2);
});
