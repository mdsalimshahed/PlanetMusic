import React, { useLayoutEffect, useRef } from 'react';
import { renderLine } from '../../../LyricsLineRenderer.jsx';
import { isRTLLanguage } from '../../../../../../../components/LyricsRenderer/textUtils.js';

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
  excludeAdlibs = true
}) => {
  const textRef = useRef(null);
  const isRTL = isRTLLanguage(line.text || '');

  useLayoutEffect(() => {
    const element = textRef.current;
    const translation = element?.querySelector(
      '.chunk-translation.main-live-translation'
    );
    const mainLyrics = element?.querySelector('.main-lyrics-layer');
    if (!element || !translation || !mainLyrics) return undefined;

    const alignTranslation = () => {
      translation.style.removeProperty('--chat-translation-offset-x');
      const mainRows = getTextLineBounds(mainLyrics, true);
      if (!mainRows.length) return;

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

      const layoutScale = getLayoutScale(element);
      const wrapWidth = (redRow.right - redRow.left) / layoutScale;
      translation.style.setProperty(
        '--chat-translation-wrap-width',
        `${wrapWidth}px`
      );
      const translationRow = getTextLineBounds(translation)[0];
      if (!translationRow) return;

      const translationCenter = (translationRow.left + translationRow.right) / 2;
      const redRowCenter = (redRow.left + redRow.right) / 2;
      translation.style.setProperty(
        '--chat-translation-offset-x',
        `${(redRowCenter - translationCenter) / layoutScale}px`
      );
    };

    alignTranslation();
    const resizeObserver = new ResizeObserver(alignTranslation);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
      translation.style.removeProperty('--chat-translation-offset-x');
      translation.style.removeProperty('--chat-translation-wrap-width');
    };
  }, [line, savedNode]);

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
  }, [line, savedNode]);

  const renderClassName = [
    'group-chat-message-text',
    isRTL ? 'group-chat-message-text-rtl' : '',
    'is-wrap-enabled'
  ].filter(Boolean).join(' ');

  return (
    <span
      ref={textRef}
      className={renderClassName}
      dir={isRTL ? 'rtl' : 'ltr'}
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