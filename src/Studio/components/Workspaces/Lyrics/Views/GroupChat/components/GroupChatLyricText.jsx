import React from 'react';
import { renderLine } from '../../../LyricsLineRenderer.jsx';
import { isRTLLanguage } from '../../../../../../../components/LyricsRenderer/textUtils.js';

const GroupChatLyricText = React.memo(({
  line,
  savedNode,
  masterPalette,
  isPlayingCurrentSong
}) => {
  const isRTL = isRTLLanguage(line.text || '');
  const stripParentheses = value =>
    typeof value === 'string' ? value.replace(/[()（）]/g, '') : value;
  const displayLine = {
    ...line,
    translation: stripParentheses(line.translation),
    pronunciation: stripParentheses(line.pronunciation)
  };
  const displaySavedNode = savedNode ? {
    ...savedNode,
    translation: stripParentheses(savedNode.translation),
    pronunciation: stripParentheses(savedNode.pronunciation)
  } : savedNode;

  return (
    <span
      className={`group-chat-message-text${isRTL ? ' group-chat-message-text-rtl' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {renderLine(displayLine, displaySavedNode, true, masterPalette, isPlayingCurrentSong)}
    </span>
  );
});

export default GroupChatLyricText;
