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
