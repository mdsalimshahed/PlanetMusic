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

  return (
    <span
      className={`group-chat-message-text${isRTL ? ' group-chat-message-text-rtl' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {renderLine(line, savedNode, true, masterPalette, isPlayingCurrentSong)}
    </span>
  );
});

export default GroupChatLyricText;
