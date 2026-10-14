import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGroupChatTimeline,
  getActiveChatLines,
  getGroupChatState,
  groupConsecutiveMessages
} from '../src/Studio/components/Workspaces/Lyrics/Views/groupChatTimeline.js';

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

  assert.deepEqual(getGroupChatState(splitLine, 1.2).typingArtists, ['Bea']);
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

test('omits lyrics and ad-libs without explicit valid start timings', () => {
  const chat = buildGroupChatTimeline(
    [
      { singer: 'Ari', text: 'No timing' },
      { singer: 'Ari', text: 'Has timing' }
    ],
    [
      {
        start: '',
        isSplit: true,
        adlibs: [{ text: 'also untimed', start: 1 }]
      },
      {
        start: 2,
        end: 3,
        isSplit: true,
        adlibs: [
          { text: 'null start', start: null },
          { text: 'missing start' },
          { text: 'blank start', start: '' },
          { text: 'boolean start', start: false },
          { text: 'valid ad-lib', start: 2.5, end: 2.75 }
        ]
      }
    ],
    'Fallback'
  );
  const messages = chat.events.filter(event => event.type === 'message');

  assert.deepEqual(messages.map(event => event.line.text), ['Has timing', 'valid ad-lib']);
  assert.deepEqual(chat.lines.map(line => line.text), ['Has timing', 'valid ad-lib']);
});

test('keeps an ad-lib opposite its source lyric even when it starts first', () => {
  const chat = buildGroupChatTimeline(
    [{
      singer: 'Ari',
      text: 'Lead echo',
      segments: [{ text: 'Lead echo', artists: ['Ari'] }]
    }],
    [{
      start: 2,
      end: 4,
      isSplit: true,
      adlibs: [{
        text: 'echo',
        start: 1,
        end: 1.5,
        singer: 'Ari',
        segments: [{ text: 'echo', artists: ['Ari'] }]
      }]
    }],
    'Fallback'
  );
  const mainLine = chat.lines.find(line => !line.isAdlib);
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.ok(mainLine);
  assert.ok(adlib);
  assert.notEqual(adlib.chatSide, mainLine.chatSide);
});

test('treats white-marked ad-libs as uncredited without explicit segment attribution', () => {
  const chat = buildGroupChatTimeline(
    [{
      singer: 'Ari',
      text: 'Lead echo',
      segments: [
        { text: 'Lead ', artists: ['Ari'], color: '#ff0000' },
        { text: 'echo', artists: ['Bea'], color: '#ffffff' }
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
        segments: [{ text: 'echo', artists: ['Bea'], color: '#ffffff' }]
      }]
    }],
    'Fallback',
    { Ari: '#ff0000', Bea: '#0000ff' }
  );
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.deepEqual(adlib.artists, []);
  assert.deepEqual(chat.artists.map(artist => artist.name), ['Ari']);
});

test('does not use a parser-inherited singer when an ad-lib has no attributed segments', () => {
  const chat = buildGroupChatTimeline(
    [{ singer: 'Eminem', text: 'Main (Hey, hey)' }],
    [{
      start: 1,
      end: 4,
      isSplit: true,
      adlibs: [{
        text: 'Hey, hey',
        start: 2,
        end: 2.5,
        singer: 'Eminem',
        segments: []
      }]
    }],
    'Eminem',
    { Eminem: '#ff1744' }
  );
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.deepEqual(adlib.artists, []);
});

test('white ad-lib marker overrides stale non-white segment artist attribution', () => {
  const chat = buildGroupChatTimeline(
    [{
      singer: 'Eminem',
      text: 'In AA with an AK (Hey, hey)',
      segments: [{ text: 'In AA with an AK (Hey, hey)', artists: ['Eminem'], color: '#ff1744' }]
    }],
    [{
      start: 1,
      end: 4,
      isSplit: true,
      adlibs: [{
        text: 'Hey, hey',
        start: 2,
        end: 2.5,
        singer: 'Eminem',
        color: '#ffffff',
        segments: [{ text: 'Hey, hey', artists: ['Eminem'], color: '#ff1744' }]
      }]
    }],
    'Eminem',
    { Eminem: '#ff1744' }
  );
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.deepEqual(adlib.artists, []);
  assert.deepEqual(chat.artists.map(artist => artist.name), ['Eminem']);
});

test('preserves explicit attribution for an intentionally white artist', () => {
  const chat = buildGroupChatTimeline(
    [{
      singer: 'Ari, Bea',
      text: 'Lead echo',
      segments: [
        { text: 'Lead ', artists: ['Ari'], color: '#ff0000' },
        { text: 'echo', artists: ['Bea'], color: '#ffffff' }
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
        color: '#ffffff',
        segments: [{ text: 'echo', artists: ['Bea'], color: '#ffffff' }]
      }]
    }],
    'Fallback',
    { Ari: '#ff0000', Bea: '#ffffff' }
  );
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.deepEqual(adlib.artists, ['Bea']);
  assert.deepEqual(chat.artists.map(artist => artist.name), ['Ari', 'Bea']);
});

test('preserves ad-lib artists on white gradient segments', () => {
  const chat = buildGroupChatTimeline(
    [{
      singer: 'Suzuka, Kanon, Mizyu, Rin',
      text: 'Lead (echo)',
      segments: [
        { text: 'Lead ', artists: ['Suzuka'], color: '#ff0000' },
        {
          text: '(echo)',
          artists: ['Kanon', 'Mizyu', 'Rin'],
          color: '#ffffff',
          isGradient: true,
          gradient: 'linear-gradient(90deg, #86e7f9, #ae86f9)'
        }
      ]
    }],
    [{
      start: 1,
      end: 4,
      isSplit: true,
      adlibs: [{
        text: '(echo)',
        charStart: 5,
        charEnd: 11,
        start: 2,
        end: 2.5,
        singer: 'Kanon, Mizyu, Rin',
        segments: [{
          text: '(echo)',
          artists: ['Kanon', 'Mizyu', 'Rin'],
          color: '#ffffff',
          isGradient: true,
          gradient: 'linear-gradient(90deg, #86e7f9, #ae86f9)'
        }]
      }]
    }],
    'ATARASHII GAKKO!',
    { Suzuka: '#ff0000', Kanon: '#00ff00', Mizyu: '#0000ff', Rin: '#ff00ff' }
  );
  const adlib = chat.lines.find(line => line.isAdlib);

  assert.deepEqual(adlib.artists, ['Kanon', 'Mizyu', 'Rin']);
});

test('shows the ad-lib artist typing when their bubble is within the activity window', () => {
  const chat = buildGroupChatTimeline(
    [
      {
        singer: 'Ari, Bea',
        text: 'Lead echo',
        segments: [
          { text: 'Lead ', artists: ['Ari'] },
          { text: 'echo', artists: ['Bea'] }
        ]
      },
      { singer: 'Ari', text: 'Next line' }
    ],
    [
      {
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
      },
      { start: 3, end: 5 }
    ],
    'Fallback'
  );

  assert.deepEqual(getGroupChatState(chat, 1.2).typingArtists, ['Bea', 'Ari']);
});
