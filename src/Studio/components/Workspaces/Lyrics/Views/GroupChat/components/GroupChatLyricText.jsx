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

const getTextLineBounds = (element, excludePronunciation = false) => {
  if (!element) return [];
  const rows = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: textNode => (
      excludePronunciation && textNode.parentElement?.closest('.pronunciation-text')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    )
  });
  let node;

  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    [...range.getClientRects()].forEach(rect => {
      if (!rect.width || !rect.height) return;
      const row = rows.find(candidate => {
        const overlap = Math.min(candidate.bottom, rect.bottom) -
          Math.max(candidate.top, rect.top);
        return overlap > Math.min(candidate.bottom - candidate.top, rect.height) * 0.5;
      });

      if (row) {
        row.left = Math.min(row.left, rect.left);
        row.right = Math.max(row.right, rect.right);
        row.top = Math.min(row.top, rect.top);
        row.bottom = Math.max(row.bottom, rect.bottom);
      } else {
        rows.push({
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        });
      }
    });
  }

  return rows.sort((first, second) => first.top - second.top);
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
  isAdlib = false,
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
  const [wrapLayout, setWrapLayout] = useState({
    enabled: precomputedLayout?.enabled || false,
    width: precomputedLayout?.width || 0
  });
  const [measuredLayoutKey, setMeasuredLayoutKey] = useState(null);
  const isRTL = isRTLLanguage(line.text || '');

  useLayoutEffect(() => {
    if (!precomputedLayout) return;
    setRenderedGlyphWidth(precomputedLayout.renderedGlyphWidth);
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
      const hasLongHyphenatedWord = Boolean(
        element.querySelector('.hyphenated-word-group.is-long-hyphenated')
      );
      const shouldWrap = hasLongHyphenatedWord ||
        glyphWidth / layoutScale > wrapWidth ||
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
    if (
      measuredLayoutKey !== layoutKey ||
      !wrapLayout.width ||
      !onLayoutReady
    ) return;
    onLayoutReady(lineIndex, layoutKey, {
      enabled: wrapLayout.enabled,
      width: wrapLayout.width,
      renderedGlyphWidth
    });
  }, [
    layoutKey,
    measuredLayoutKey,
    lineIndex,
    onLayoutReady,
    renderedGlyphWidth,
    wrapLayout.enabled,
    wrapLayout.width
  ]);

  useLayoutEffect(() => {
    const element = textRef.current;
    const translation = element?.querySelector(
      '.chunk-translation.main-live-translation'
    );
    const mainLyrics = element?.querySelector('.main-lyrics-layer');
    if (!element || !translation || !mainLyrics) return undefined;

    const alignTranslation = () => {
      translation.style.removeProperty('--chat-translation-offset-x');
      const translationRow = getTextLineBounds(translation)[0];
      const mainRows = getTextLineBounds(mainLyrics, true);
      if (!translationRow || !mainRows.length) return;

      const redRow = { ...mainRows[0] };
      const closestMainRowIndex = bounds => mainRows.reduce((closest, row, index) => {
        const distance = Math.abs(
          row.top + (row.bottom - row.top) / 2 -
          bounds.top - (bounds.bottom - bounds.top) / 2
        );
        return !closest || distance < closest.distance
          ? { index, distance }
          : closest;
      }, null)?.index ?? -1;

      element.querySelectorAll('.pronunciation-text').forEach(pronunciation => {
        getTextLineBounds(pronunciation).forEach(row => {
          if (closestMainRowIndex(row) !== 0) return;
          redRow.left = Math.min(redRow.left, row.left);
          redRow.right = Math.max(redRow.right, row.right);
          redRow.top = Math.min(redRow.top, row.top);
          redRow.bottom = Math.max(redRow.bottom, row.bottom);
        });
      });

      const translationCenter = (translationRow.left + translationRow.right) / 2;
      const redRowCenter = (redRow.left + redRow.right) / 2;
      translation.style.setProperty(
        '--chat-translation-offset-x',
        `${(redRowCenter - translationCenter) / getLayoutScale(element)}px`
      );
    };

    alignTranslation();
    const resizeObserver = new ResizeObserver(alignTranslation);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      translation.style.removeProperty('--chat-translation-offset-x');
    };
  }, [line, savedNode, layoutKey, wrapLayout.enabled, wrapLayout.width]);

  useLayoutEffect(() => {
    const element = textRef.current;
    const turn = element?.closest('.group-chat-turn');
    const timestamp = turn?.querySelector('.group-chat-message-line time');
    if (!element || !turn || !timestamp) return undefined;

    const alignTextToTimestamp = () => {
      element.style.removeProperty('translate');
      const contentRows = getTextLineBounds(element);
      const timestampRows = getTextLineBounds(timestamp);
      if (!contentRows.length || !timestampRows.length) return;

      const contentBounds = contentRows.reduce((bounds, row) => ({
        left: Math.min(bounds.left, row.left),
        right: Math.max(bounds.right, row.right)
      }), { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY });
      const timestampBounds = timestampRows.reduce((bounds, row) => ({
        left: Math.min(bounds.left, row.left),
        right: Math.max(bounds.right, row.right)
      }), { left: Number.POSITIVE_INFINITY, right: Number.NEGATIVE_INFINITY });
      const offset = turn.classList.contains('group-chat-turn-right')
        ? timestampBounds.right - contentBounds.right
        : timestampBounds.left - contentBounds.left;

      element.style.translate = `${offset / getLayoutScale(element)}px 0`;
    };

    let cancelled = false;
    alignTextToTimestamp();
    const resizeObserver = new ResizeObserver(alignTextToTimestamp);
    resizeObserver.observe(element);
    resizeObserver.observe(timestamp);
    document.fonts.ready.then(() => {
      if (!cancelled) alignTextToTimestamp();
    });
    window.addEventListener('resize', alignTextToTimestamp);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      window.removeEventListener('resize', alignTextToTimestamp);
      element.style.removeProperty('translate');
    };
  }, [line, savedNode, layoutKey, wrapLayout.enabled, wrapLayout.width]);

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
        '--chat-rendered-glyph-width': renderedGlyphWidth
          ? `${renderedGlyphWidth}px`
          : '100%',
        '--chat-wrap-width': `${wrapLayout.width}px`
      }}
    >
      {renderLine(
        line,
        savedNode,
        false,
        masterPalette,
        isPlayingCurrentSong,
        {
          excludeAdlibs,
          focusedMainLyrics: true,
          isAdlib,
          preserveText: true,
          renderSyncChunks: true
        }
      )}
    </span>
  );
});

export default GroupChatLyricText;