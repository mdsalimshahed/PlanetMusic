import React, { useLayoutEffect, useRef, useState } from 'react';
import { renderLine } from '../../../LyricsLineRenderer.jsx';
import { isRTLLanguage } from '../../../../../../../components/LyricsRenderer/textUtils.js';

// The glyph measuring below temporarily switches the bubble into "measuring" classes
// (unwrapped / shrunk) and forces a layout. While the bubble is briefly shorter, the
// browser CLAMPS the chat's scrollTop to the shorter scroll range and does NOT restore it
// when the bubble grows back - so the avatar + artist name of the newest (taller, wrapped)
// bubble end up scrolled out of view. Remember the scroll position and put it back.
const withStableScroll = (element, measure) => {
  const scroller = element?.closest?.('.group-chat-history');
  const top = scroller ? scroller.scrollTop : 0;
  try {
    return measure();
  } finally {
    if (scroller && scroller.scrollTop !== top) scroller.scrollTop = top;
  }
};

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

const getTextRight = elements => {
  let right = Number.NEGATIVE_INFINITY;
  elements.forEach(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach(rect => {
        if (rect.width && rect.height) right = Math.max(right, rect.right);
      });
    }
  });
  return Number.isFinite(right) ? right : null;
};

const getGlyphOffset = element => {
  element.classList.add('is-measuring-alignment');
  let glyphRight;
  try {
    glyphRight = getTextRight([
      ...element.querySelectorAll('.main-lyrics-layer .lyric-text-span'),
      ...element.querySelectorAll('.pronunciation-text')
    ]);
  } finally {
    element.classList.remove('is-measuring-alignment');
  }

  const timestamp = element.closest('.group-chat-message-line')?.querySelector('time');
  return element.closest('.group-chat-turn-right') && timestamp && glyphRight != null
    ? timestamp.getBoundingClientRect().right - glyphRight
    : 0;
};

const GroupChatLyricText = React.memo(({
  line,
  savedNode,
  masterPalette,
  isPlayingCurrentSong,
  excludeAdlibs = true
}) => {
  const textRef = useRef(null);
  const [translationReferenceWidth, setTranslationReferenceWidth] = useState(0);
  const [glyphOffset, setGlyphOffset] = useState(0);
  const [wrapLayout, setWrapLayout] = useState({
    enabled: false,
    width: 0,
    contentWidth: 0
  });
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
    const canvas = element?.closest('.group-chat');
    if (!element || !canvas) return undefined;

    const measureGlyphLayout = () => withStableScroll(element, () => {
      element.classList.add('is-measuring-glyphs');
      let mainGlyphWidth;
      let pronunciationWidth;
      try {
        const mainGlyphs = [...element.querySelectorAll('.main-lyrics-layer .lyric-text-span')];
        const pronunciationGlyphs = [...element.querySelectorAll('.pronunciation-text')];
        mainGlyphWidth = getMaxTextLineWidth(mainGlyphs);
        pronunciationWidth = getMaxTextLineWidth(pronunciationGlyphs);
      } finally {
        element.classList.remove('is-measuring-glyphs');
      }

      const wrapWidth = canvas.getBoundingClientRect().width * 0.6;
      const shouldWrap = mainGlyphWidth > wrapWidth;
      const width = Math.ceil(Math.max(mainGlyphWidth, pronunciationWidth));
      setTranslationReferenceWidth(previous => (
        Math.abs(previous - width) < 1 ? previous : width
      ));
      setWrapLayout(previous => (
        previous.enabled === shouldWrap && Math.abs(previous.width - wrapWidth) < 1
          ? previous
          : { enabled: shouldWrap, width: wrapWidth, contentWidth: 0 }
      ));
      const offset = getGlyphOffset(element);
      setGlyphOffset(previous => (
        Math.abs(previous - offset) < 0.5 ? previous : offset
      ));
    });

    measureGlyphLayout();
    const observer = new ResizeObserver(measureGlyphLayout);
    observer.observe(canvas);
    observer.observe(element);
    const messageLine = element.closest('.group-chat-message-line');
    if (messageLine) observer.observe(messageLine);
    return () => {
      observer.disconnect();
      element.classList.remove('is-measuring-glyphs');
    };
  }, [line, savedNode]);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) {
      setGlyphOffset(0);
      return undefined;
    }

    withStableScroll(element, () => {
      let contentWidth = wrapLayout.contentWidth;
      const mainGlyphs = [...element.querySelectorAll('.main-lyrics-layer .lyric-text-span')];
      const pronunciationGlyphs = [...element.querySelectorAll('.pronunciation-text')];
      if (wrapLayout.enabled) {
        contentWidth = Math.ceil(Math.max(
          getMaxTextLineWidth(mainGlyphs),
          getMaxTextLineWidth(pronunciationGlyphs)
        )) + 1;
        setWrapLayout(previous => (
          previous.enabled && Math.abs(previous.contentWidth - contentWidth) >= 1
            ? { ...previous, contentWidth }
            : previous
        ));
      }
      const offset = getGlyphOffset(element);
      setGlyphOffset(previous => (
        Math.abs(previous - offset) < 0.5 ? previous : offset
      ));
    });
    return undefined;
  }, [
    wrapLayout.enabled,
    wrapLayout.width,
    wrapLayout.contentWidth,
    line,
    savedNode
  ]);

  const renderClassName = [
    'group-chat-message-text',
    isRTL ? 'group-chat-message-text-rtl' : '',
    wrapLayout.enabled ? 'is-wrap-enabled' : ''
  ].filter(Boolean).join(' ');

  return (
    <span
      ref={textRef}
      className={renderClassName}
      dir={isRTL ? 'rtl' : 'ltr'}
      style={{
        '--chat-translation-reference-width': translationReferenceWidth
          ? `${translationReferenceWidth}px`
          : '100%',
        '--chat-wrap-width': `${wrapLayout.width}px`,
        '--chat-visible-content-width': wrapLayout.contentWidth
          ? `${wrapLayout.contentWidth}px`
          : 'max-content',
        '--chat-glyph-offset': `${glyphOffset}px`
      }}
    >
      {renderLine(
        displayLine,
        displaySavedNode,
        false,
        masterPalette,
        isPlayingCurrentSong,
        { excludeAdlibs }
      )}
    </span>
  );
});

export default GroupChatLyricText;