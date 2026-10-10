import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { renderLine } from '../../../LyricsLineRenderer.jsx';
import { isRTLLanguage } from '../../../../../../../components/LyricsRenderer/textUtils.js';

const measureGlyphWidth = (element) => {
  const glyphs = element.querySelectorAll('.lyric-text-span');
  const targetElements = glyphs.length
    ? glyphs
    : element.querySelectorAll('.main-lyrics-layer');
  const lineBounds = [];

  targetElements.forEach(target => {
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach(rect => {
        if (!rect.width || !rect.height) return;
        const line = lineBounds.find(item => {
          const overlap = Math.min(item.bottom, rect.bottom) - Math.max(item.top, rect.top);
          return overlap > Math.min(item.bottom - item.top, rect.height) * 0.5;
        });
        if (line) {
          line.left = Math.min(line.left, rect.left);
          line.right = Math.max(line.right, rect.right);
          line.top = Math.min(line.top, rect.top);
          line.bottom = Math.max(line.bottom, rect.bottom);
        } else {
          lineBounds.push({
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom
          });
        }
      });
    }
  });

  return lineBounds.reduce((width, line) => Math.max(width, line.right - line.left), 0);
};

const GroupChatLyricText = React.memo(({
  line,
  savedNode,
  masterPalette,
  isPlayingCurrentSong
}) => {
  const textRef = useRef(null);
  const [glyphWidth, setGlyphWidth] = useState(0);
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

  const updateGlyphWidth = useCallback(() => {
    const nextWidth = textRef.current ? Math.ceil(measureGlyphWidth(textRef.current)) : 0;
    setGlyphWidth(previous => (
      Math.abs(previous - nextWidth) < 1 ? previous : nextWidth
    ));
  }, []);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;
    updateGlyphWidth();
    const observer = new ResizeObserver(updateGlyphWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [line, savedNode, updateGlyphWidth]);

  return (
    <span
      ref={textRef}
      className={`group-chat-message-text${isRTL ? ' group-chat-message-text-rtl' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={glyphWidth ? { '--chat-rendered-glyph-width': `${glyphWidth}px` } : undefined}
    >
      {renderLine(displayLine, displaySavedNode, true, masterPalette, isPlayingCurrentSong)}
    </span>
  );
});

export default GroupChatLyricText;
