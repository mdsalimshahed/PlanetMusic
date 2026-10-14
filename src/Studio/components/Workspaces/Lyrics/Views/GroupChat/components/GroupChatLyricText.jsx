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

const getTextBoundingBox = elements => {
  const rects = [];
  elements.forEach(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach(rect => {
        if (rect.width && rect.height) rects.push(rect);
      });
    }
  });
  if (!rects.length) return null;
  return {
    left: Math.min(...rects.map(rect => rect.left)),
    right: Math.max(...rects.map(rect => rect.right))
  };
};

const getLayoutScale = element => {
  const layout = element?.closest('.group-chat-layout');
  if (!layout?.offsetWidth) return 1;
  const scale = layout.getBoundingClientRect().width / layout.offsetWidth;
  return scale > 0 ? scale : 1;
};

const GroupChatLyricText = React.memo(({
  line,
  savedNode,
  masterPalette,
  isPlayingCurrentSong,
  lyricFontSize,
  lineWrapWidthPercent,
  excludeAdlibs = true,
  precomputedLayout,
  onLayoutReady,
  layoutKey,
  lineIndex
}) => {
  const textRef = useRef(null);
  const [renderedGlyphWidth, setRenderedGlyphWidth] = useState(
    () => precomputedLayout?.renderedGlyphWidth || 0
  );
  const [translationReferenceWidth, setTranslationReferenceWidth] = useState(
    () => precomputedLayout?.translationReferenceWidth || 0
  );
  const [translationReferenceOffset, setTranslationReferenceOffset] = useState(
    () => precomputedLayout?.translationReferenceOffset || 0
  );
  const [wrapLayout, setWrapLayout] = useState({
    enabled: precomputedLayout?.enabled || false,
    width: precomputedLayout?.width || 0
  });
  const [measuredLayoutKey, setMeasuredLayoutKey] = useState(null);
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
    if (!precomputedLayout) return;
    setRenderedGlyphWidth(precomputedLayout.renderedGlyphWidth);
    setTranslationReferenceWidth(precomputedLayout.translationReferenceWidth);
    setTranslationReferenceOffset(precomputedLayout.translationReferenceOffset);
    setWrapLayout({
      enabled: precomputedLayout.enabled,
      width: precomputedLayout.width
    });
  }, [precomputedLayout]);

  useLayoutEffect(() => {
    const element = textRef.current;
    const canvas = element?.closest('.group-chat');
    if (!element || !canvas || !onLayoutReady) return undefined;

    const measureGlyphLayout = () => withStableScroll(element, () => {
      const layoutScale = getLayoutScale(element);
      const turn = element.closest('.group-chat-turn');
      const wasWrapEnabled = element.classList.contains('is-wrap-enabled');
      turn?.classList.add('is-measuring-glyphs');
      element.classList.remove('is-wrap-enabled');
      element.classList.add('is-measuring-glyphs');
      let mainGlyphWidth;
      let pronunciationGlyphWidth;
      let translationGlyphWidth;
      try {
        mainGlyphWidth = element
          .querySelector('.main-lyrics-layer')
          ?.getBoundingClientRect().width || 0;
        pronunciationGlyphWidth = getMaxTextLineWidth([
          ...element.querySelectorAll('.pronunciation-text')
        ]);
        translationGlyphWidth = element
          .querySelector('.chunk-translation')
          ?.getBoundingClientRect().width || 0;
      } finally {
        element.classList.remove('is-measuring-glyphs');
        turn?.classList.remove('is-measuring-glyphs');
        if (wasWrapEnabled) element.classList.add('is-wrap-enabled');
      }

      const canvasWidth = canvas.getBoundingClientRect().width / layoutScale;
      const avatarSlot = turn?.querySelector('.group-chat-avatar-slot');
      const message = element.closest('.group-chat-message');
      const turnStyles = turn ? getComputedStyle(turn) : null;
      const messageStyles = message ? getComputedStyle(message) : null;
      const availableContentWidth = turn
        ? Math.max(
          0,
          (turn.getBoundingClientRect().width -
            (avatarSlot?.getBoundingClientRect().width || 0)) / layoutScale -
            (parseFloat(turnStyles.columnGap) || 0) -
            (parseFloat(messageStyles.paddingLeft) || 0) -
            (parseFloat(messageStyles.paddingRight) || 0)
        )
        : canvasWidth;
      const wrapWidth = Math.min(
        canvasWidth * (lineWrapWidthPercent / 100),
        availableContentWidth
      );
      const glyphWidth = Math.max(mainGlyphWidth, pronunciationGlyphWidth);
      const shouldWrap = glyphWidth / layoutScale > wrapWidth ||
        translationGlyphWidth > glyphWidth;
      const width = Math.ceil(glyphWidth / layoutScale);
      setRenderedGlyphWidth(previous => (
        Math.abs(previous - width) < 1 ? previous : width
      ));
      setWrapLayout(previous => (
        previous.enabled === shouldWrap && Math.abs(previous.width - wrapWidth) < 1
          ? previous
          : { enabled: shouldWrap, width: wrapWidth }
      ));
      setMeasuredLayoutKey(layoutKey);
    });

    let cancelled = false;
    let measureFrame = null;
    document.fonts.ready.then(() => {
      if (!cancelled) measureFrame = window.requestAnimationFrame(measureGlyphLayout);
    });
    return () => {
      cancelled = true;
      if (measureFrame !== null) window.cancelAnimationFrame(measureFrame);
      element.classList.remove('is-measuring-glyphs');
    };
  }, [
    line,
    savedNode,
    lineWrapWidthPercent,
    lyricFontSize,
    layoutKey,
    onLayoutReady
  ]);

  useLayoutEffect(() => {
    const element = textRef.current;
    const message = element?.closest('.group-chat-message');
    if (!element || !message) return;

    if (!wrapLayout.enabled) {
      message.style.removeProperty('--chat-measured-bubble-width');
      return;
    }
    const layoutScale = getLayoutScale(element);
    const timestamp = message.querySelector('.group-chat-message-line time');
    const messageStyles = getComputedStyle(message);
    const textContentWidth = getMaxTextLineWidth([
      ...element.querySelectorAll(
        '.main-lyrics-layer .lyric-text-span, .pronunciation-text, .chunk-translation, .live-translation'
      )
    ]);
    const contentWidth = Math.max(
      textContentWidth,
      timestamp?.getBoundingClientRect().width || 0
    ) / layoutScale;
    const horizontalPadding =
      (parseFloat(messageStyles.paddingLeft) || 0) +
      (parseFloat(messageStyles.paddingRight) || 0);
    message.style.setProperty(
      '--chat-measured-bubble-width',
      `${Math.ceil(contentWidth + horizontalPadding)}px`
    );
  }, [
    precomputedLayout,
    renderedGlyphWidth,
    translationReferenceOffset,
    translationReferenceWidth,
    wrapLayout.enabled,
    wrapLayout.width,
    line,
    savedNode,
    layoutKey,
    lyricFontSize
  ]);

  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return undefined;

    const alignGlyphBoundary = () => {
      if (
        !wrapLayout.enabled ||
        !element.closest('.group-chat-turn-right')
      ) {
        element.style.removeProperty('--chat-glyph-boundary-offset');
        return;
      }

      const mainBounds = getTextBoundingBox([
        ...element.querySelectorAll('.main-lyrics-layer .lyric-text-span')
      ]);
      const timestamp = element
        .closest('.group-chat-message-line')
        ?.querySelector('time');
      if (!mainBounds || !timestamp) {
        element.style.removeProperty('--chat-glyph-boundary-offset');
        return;
      }

      const layoutScale = getLayoutScale(element);
      const currentOffset =
        parseFloat(element.style.getPropertyValue('--chat-glyph-boundary-offset')) || 0;
      const unshiftedRight = mainBounds.right - currentOffset * layoutScale;
      const offset = (timestamp.getBoundingClientRect().right - unshiftedRight) / layoutScale;
      if (
        Number.isFinite(offset) &&
        Math.abs(offset - currentOffset) > 0.25
      ) {
        element.style.setProperty('--chat-glyph-boundary-offset', `${offset}px`);
      }
    };

    alignGlyphBoundary();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(alignGlyphBoundary);
    [
      element,
      element.querySelector('.main-lyrics-layer'),
      element.closest('.group-chat-message-line')?.querySelector('time')
    ].filter(Boolean).forEach(target => resizeObserver?.observe(target));

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) alignGlyphBoundary();
    });
    window.addEventListener('resize', alignGlyphBoundary);

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      window.removeEventListener('resize', alignGlyphBoundary);
      element.style.removeProperty('--chat-glyph-boundary-offset');
    };
  }, [
    layoutKey,
    line,
    renderedGlyphWidth,
    savedNode,
    wrapLayout.enabled,
    wrapLayout.width
  ]);

  useLayoutEffect(() => {
    const element = textRef.current;
    const translation = element?.querySelector('.chunk-translation');
    if (!element || !translation || precomputedLayout) return;

    const mainBounds = getTextBoundingBox([
      ...element.querySelectorAll('.main-lyrics-layer .lyric-text-span')
    ]);
    const pronunciationBounds = getTextBoundingBox([
      ...element.querySelectorAll('.pronunciation-text')
    ]);
    const mainWidth = mainBounds ? mainBounds.right - mainBounds.left : 0;
    const pronunciationWidth = pronunciationBounds
      ? pronunciationBounds.right - pronunciationBounds.left
      : 0;
    const anchorBounds = pronunciationWidth > mainWidth
      ? pronunciationBounds
      : mainBounds;
    if (!anchorBounds) return;

    const layoutScale = getLayoutScale(element);
    const referenceWidth = Math.max(
      1,
      Math.floor((anchorBounds.right - anchorBounds.left) / layoutScale)
    );
    const translationStyles = getComputedStyle(translation);
    const currentLeftOffset = parseFloat(translationStyles.left) || 0;
    const translationBaseLeft =
      translation.getBoundingClientRect().left - currentLeftOffset * layoutScale;
    const targetLeft = (anchorBounds.left + anchorBounds.right) / 2 -
      (referenceWidth * layoutScale) / 2;
    const offset = (targetLeft - translationBaseLeft) / layoutScale;
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
    lyricFontSize,
    precomputedLayout
  ]);

  useLayoutEffect(() => {
    if (
      measuredLayoutKey !== layoutKey ||
      !wrapLayout.width ||
      !onLayoutReady
    ) return;
    onLayoutReady(lineIndex, layoutKey, {
      enabled: wrapLayout.enabled,
      width: wrapLayout.width,
      renderedGlyphWidth,
      translationReferenceWidth,
      translationReferenceOffset
    });
  }, [
    layoutKey,
    measuredLayoutKey,
    lineIndex,
    onLayoutReady,
    renderedGlyphWidth,
    translationReferenceOffset,
    translationReferenceWidth,
    wrapLayout.enabled,
    wrapLayout.width
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