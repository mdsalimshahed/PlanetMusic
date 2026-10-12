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

const getMaxTextLineBounds = (elements) => {
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
  return lineRects.reduce((widest, rect) => (
    !widest || rect.right - rect.left > widest.right - widest.left
      ? rect
      : widest
  ), null);
};

const getMaxTextLineWidth = (elements) => {
  const bounds = getMaxTextLineBounds(elements);
  return bounds ? bounds.right - bounds.left : 0;
};

const GroupChatLyricText = React.memo(({
  line,
  savedNode,
  masterPalette,
  isPlayingCurrentSong,
  lyricFontSize,
  lineWrapWidthPercent,
  excludeAdlibs = true
}) => {
  const textRef = useRef(null);
  const [renderedGlyphWidth, setRenderedGlyphWidth] = useState(0);
  const [translationReferenceWidth, setTranslationReferenceWidth] = useState(0);
  const [translationReferenceOffset, setTranslationReferenceOffset] = useState(0);
  const [wrapLayout, setWrapLayout] = useState({
    enabled: false,
    width: 0
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
      const turn = element.closest('.group-chat-turn');
      const wasWrapEnabled = element.classList.contains('is-wrap-enabled');
      turn?.classList.add('is-measuring-glyphs');
      element.classList.remove('is-wrap-enabled');
      element.classList.add('is-measuring-glyphs');
      let mainGlyphWidth;
      try {
        const mainGlyphs = [...element.querySelectorAll('.main-lyrics-layer .lyric-text-span')];
        mainGlyphWidth = getMaxTextLineWidth(mainGlyphs);
      } finally {
        element.classList.remove('is-measuring-glyphs');
        turn?.classList.remove('is-measuring-glyphs');
        if (wasWrapEnabled) element.classList.add('is-wrap-enabled');
      }

      const canvasWidth = canvas.getBoundingClientRect().width;
      const avatarSlot = turn?.querySelector('.group-chat-avatar-slot');
      const message = element.closest('.group-chat-message');
      const turnStyles = turn ? getComputedStyle(turn) : null;
      const messageStyles = message ? getComputedStyle(message) : null;
      const availableContentWidth = turn
        ? Math.max(
          0,
          turn.getBoundingClientRect().width -
            (avatarSlot?.getBoundingClientRect().width || 0) -
            (parseFloat(turnStyles.columnGap) || 0) -
            (parseFloat(messageStyles.paddingLeft) || 0) -
            (parseFloat(messageStyles.paddingRight) || 0)
        )
        : canvasWidth;
      const wrapWidth = Math.min(
        canvasWidth * (lineWrapWidthPercent / 100),
        availableContentWidth
      );
      const shouldWrap = mainGlyphWidth > wrapWidth;
      const displayedGlyphWidth = getMaxTextLineWidth([
        ...element.querySelectorAll('.main-lyrics-layer .lyric-text-span')
      ]);
      const width = Math.ceil(
        wasWrapEnabled === shouldWrap ? displayedGlyphWidth : mainGlyphWidth
      );
      setRenderedGlyphWidth(previous => (
        Math.abs(previous - width) < 1 ? previous : width
      ));
      setWrapLayout(previous => (
        previous.enabled === shouldWrap && Math.abs(previous.width - wrapWidth) < 1
          ? previous
          : { enabled: shouldWrap, width: wrapWidth }
      ));
    });

    measureGlyphLayout();
    const resizeObserver = new ResizeObserver(measureGlyphLayout);
    resizeObserver.observe(canvas);
    const contentObserver = new MutationObserver(measureGlyphLayout);
    contentObserver.observe(element, {
      childList: true,
      characterData: true,
      subtree: true
    });
    document.fonts.addEventListener('loadingdone', measureGlyphLayout);
    return () => {
      resizeObserver.disconnect();
      contentObserver.disconnect();
      document.fonts.removeEventListener('loadingdone', measureGlyphLayout);
      element.classList.remove('is-measuring-glyphs');
    };
  }, [line, savedNode, lineWrapWidthPercent, lyricFontSize]);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;

    const mainGlyphs = [...element.querySelectorAll('.main-lyrics-layer .lyric-text-span')];
    const width = Math.ceil(getMaxTextLineWidth(mainGlyphs));
    setRenderedGlyphWidth(previous => (
      Math.abs(previous - width) < 1 ? previous : width
    ));
  }, [wrapLayout.enabled, wrapLayout.width, line, savedNode, lyricFontSize]);

  useLayoutEffect(() => {
    const element = textRef.current;
    const translation = element?.querySelector('.chunk-translation');
    if (!element || !translation) return;

    const anchorBounds = getMaxTextLineBounds([
      ...element.querySelectorAll(
        '.main-lyrics-layer .lyric-text-span, .pronunciation-text'
      )
    ]);
    if (!anchorBounds) return;

    const referenceWidth = Math.ceil(anchorBounds.right - anchorBounds.left);
    const translationStyles = getComputedStyle(translation);
    const currentLeftOffset = parseFloat(translationStyles.left) || 0;
    const translationBaseLeft = translation.getBoundingClientRect().left - currentLeftOffset;
    const targetLeft = (anchorBounds.left + anchorBounds.right - referenceWidth) / 2;
    const offset = targetLeft - translationBaseLeft;
    setTranslationReferenceWidth(previous => (
      Math.abs(previous - referenceWidth) < 1 ? previous : referenceWidth
    ));
    setTranslationReferenceOffset(previous => (
      Math.abs(previous - offset) < 0.1 ? previous : offset
    ));
  }, [
    renderedGlyphWidth,
    translationReferenceWidth,
    translationReferenceOffset,
    wrapLayout.enabled,
    wrapLayout.width,
    line,
    savedNode,
    lyricFontSize
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
        '--chat-rendered-glyph-width': renderedGlyphWidth
          ? `${renderedGlyphWidth}px`
          : '100%',
        '--chat-translation-left-offset': `${translationReferenceOffset}px`,
        '--chat-wrap-width': `${wrapLayout.width}px`,
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