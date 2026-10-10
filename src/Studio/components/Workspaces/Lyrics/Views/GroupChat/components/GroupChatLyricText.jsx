import React, { useLayoutEffect, useRef, useState } from 'react';
import { renderLine } from '../../../LyricsLineRenderer.jsx';
import { isRTLLanguage } from '../../../../../../../components/LyricsRenderer/textUtils.js';

const getMaxTextLineWidth = (elements) => {
  const lineRects = [];
  elements.forEach(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach(rect => {
        if (!rect.width || !rect.height) return;
        const line = lineRects.find(item => {
          const overlap = Math.min(item.bottom, rect.bottom) - Math.max(item.top, rect.top);
          return overlap > Math.min(item.bottom - item.top, rect.height) * 0.5;
        });
        if (line) {
          line.left = Math.min(line.left, rect.left);
          line.right = Math.max(line.right, rect.right);
          line.top = Math.min(line.top, rect.top);
          line.bottom = Math.max(line.bottom, rect.bottom);
        } else {
          lineRects.push({
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom
          });
        }
      });
    }
  });
  return lineRects.reduce((width, rect) => Math.max(width, rect.right - rect.left), 0);
};

const GroupChatLyricText = React.memo(({
  line,
  savedNode,
  masterPalette,
  isPlayingCurrentSong
}) => {
  const textRef = useRef(null);
  const [translationReferenceWidth, setTranslationReferenceWidth] = useState(0);
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

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    const measureReferenceWidth = () => {
      const mainGlyphs = [...element.querySelectorAll('.lyric-text-span')];
      const pronunciationGlyphs = [...element.querySelectorAll('.pronunciation-text')];
      const width = Math.ceil(Math.max(
        getMaxTextLineWidth(mainGlyphs),
        getMaxTextLineWidth(pronunciationGlyphs)
      ));
      setTranslationReferenceWidth(previous => (
        Math.abs(previous - width) < 1 ? previous : width
      ));
    };

    measureReferenceWidth();
    const observer = new ResizeObserver(measureReferenceWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [line, savedNode]);

  return (
    <span
      ref={textRef}
      className={`group-chat-message-text${isRTL ? ' group-chat-message-text-rtl' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={translationReferenceWidth
        ? { '--chat-translation-reference-width': `${translationReferenceWidth}px` }
        : undefined}
    >
      {renderLine(displayLine, displaySavedNode, true, masterPalette, isPlayingCurrentSong)}
    </span>
  );
});

export default GroupChatLyricText;
