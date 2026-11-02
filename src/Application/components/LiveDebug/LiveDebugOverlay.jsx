/* --- src/components/LiveDebug/LiveDebugOverlay.jsx --- */
import { useLayoutEffect, useRef, useState } from 'react';
import './LiveDebugOverlay.css';

const getLineTextBoundsList = (element, overlayRect, excludePronunciation = false) => {
  if (!element) return [];
  const lineGroups = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: textNode => (
      excludePronunciation &&
      textNode.parentElement?.closest('.pronunciation-text')
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
      if (rect.width <= 0 || rect.height <= 0) return;

      const bounds = {
        top: rect.top - overlayRect.top,
        bottom: rect.bottom - overlayRect.top,
        left: rect.left - overlayRect.left,
        right: rect.right - overlayRect.left
      };
      const matchedGroup = lineGroups.find(group => {
        const verticalOverlap = Math.min(bounds.bottom, group.bottom) -
          Math.max(bounds.top, group.top);
        const minHeight = Math.min(
          bounds.bottom - bounds.top,
          group.bottom - group.top
        );
        return verticalOverlap > minHeight * 0.5;
      });

      if (matchedGroup) {
        matchedGroup.top = Math.min(matchedGroup.top, bounds.top);
        matchedGroup.bottom = Math.max(matchedGroup.bottom, bounds.bottom);
        matchedGroup.left = Math.min(matchedGroup.left, bounds.left);
        matchedGroup.right = Math.max(matchedGroup.right, bounds.right);
      } else {
        lineGroups.push(bounds);
      }
    });
  }

  return lineGroups.map(group => ({
    top: group.top,
    left: group.left,
    width: group.right - group.left,
    height: group.bottom - group.top,
    right: group.right,
    bottom: group.bottom
  }));
};

const boundsForRects = rects => {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map(rect => rect.left));
  const right = Math.max(...rects.map(rect => rect.right));
  const top = Math.min(...rects.map(rect => rect.top));
  const bottom = Math.max(...rects.map(rect => rect.bottom));
  return { left, right, top, bottom, width: right - left, height: bottom - top };
};

const rowsShareHorizontalLine = (first, second) => {
  const verticalOverlap = Math.min(first.bottom, second.bottom) -
    Math.max(first.top, second.top);
  return verticalOverlap > Math.min(first.height, second.height) * 0.5;
};

const mergeBounds = (first, second) => {
  const left = Math.min(first.left, second.left);
  const right = Math.max(first.right, second.right);
  const top = Math.min(first.top, second.top);
  const bottom = Math.max(first.bottom, second.bottom);
  return { left, right, top, bottom, width: right - left, height: bottom - top };
};

const getClosestRowIndex = (rows, target) => rows.reduce((closest, row, index) => {
  const distance = Math.abs(
    (row.top + row.bottom) / 2 - (target.top + target.bottom) / 2
  );
  return !closest || distance < closest.distance
    ? { index, distance }
    : closest;
}, null)?.index;

const padBounds = (bounds, padding) => ({
  left: bounds.left - padding,
  right: bounds.right + padding,
  top: bounds.top - padding,
  bottom: bounds.bottom + padding,
  width: bounds.width + padding * 2,
  height: bounds.height + padding * 2
});

const addBox = (boxes, id, bounds, color, fillColor, className = '') => {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
  boxes.push({ id, ...bounds, color, fillColor, className });
};

const getMainSegmentBounds = (lineNode, overlayRect) => {
  const result = [];
  lineNode.querySelectorAll('.core-chunks').forEach((chunk, chunkIndex) => {
    const mainLayer = chunk.querySelector('.main-lyrics-layer');
    if (!mainLayer) return;

    const mainRows = getLineTextBoundsList(mainLayer, overlayRect, true);
    const pronunciationRows = Array.from(
      chunk.querySelectorAll('.pronunciation-text')
    ).flatMap(pronunciation => getLineTextBoundsList(pronunciation, overlayRect));
    if (mainRows.length === 0) return;

    const rowRects = mainRows.map(row => ({ ...row }));
    pronunciationRows.forEach(pronunciation => {
      const closestMainRow = rowRects.reduce((closest, row, index) => {
        const distance = Math.abs(
          (row.top + row.bottom) / 2 -
          (pronunciation.top + pronunciation.bottom) / 2
        );
        return !closest || distance < closest.distance
          ? { index, distance }
          : closest;
      }, null);

      if (closestMainRow) {
        const row = rowRects[closestMainRow.index];
        row.left = Math.min(row.left, pronunciation.left);
        row.right = Math.max(row.right, pronunciation.right);
        row.top = Math.min(row.top, pronunciation.top);
        row.bottom = Math.max(row.bottom, pronunciation.bottom);
        row.width = row.right - row.left;
        row.height = row.bottom - row.top;
      }
    });

    rowRects.forEach((row, rowIndex) => {
      result.push({
        id: `main-segment-${chunkIndex}-${rowIndex}`,
        bounds: row
      });
    });
  });
  return result;
};

const buildBoxesForLines = (targetNodes, overlayRect) => {
  const boxes = [];

  targetNodes.forEach((lineNode, lineIndex) => {
    const lineRect = lineNode.getBoundingClientRect();
    if (lineRect.bottom < overlayRect.top || lineRect.top > overlayRect.bottom) return;

    const mainGlyphLayer = lineNode.querySelector('.main-lyrics-layer');
    const mainGlyphRows = getLineTextBoundsList(mainGlyphLayer, overlayRect, true);
    const lineBounds = {
      left: lineRect.left - overlayRect.left,
      right: lineRect.right - overlayRect.left
    };
    const isRtl = mainGlyphLayer && getComputedStyle(mainGlyphLayer).direction === 'rtl';
    mainGlyphRows.forEach((bounds, rowIndex) => {
      addBox(
        boxes,
        `primary-line-${lineIndex}-${rowIndex}`,
        bounds,
        '#facc15',
        'rgba(250, 204, 21, 0.15)'
      );

      const guideLeft = isRtl ? lineBounds.left : bounds.right;
      const guideRight = isRtl ? bounds.left : lineBounds.right;
      if (guideRight > guideLeft) {
        boxes.push({
          id: `main-baseline-guide-${lineIndex}-${rowIndex}`,
          top: bounds.bottom,
          left: guideLeft,
          width: guideRight - guideLeft,
          height: 0,
          color: 'rgba(250, 204, 21, 0.45)',
          fillColor: 'transparent',
          className: 'live-debug-alignment-guide'
        });
      }
    });

    lineNode.querySelectorAll('.adlib-node').forEach((adlibNode, adlibIndex) => {
      const glyphLayer = adlibNode.querySelector(':scope > .primary-text');
      getLineTextBoundsList(glyphLayer, overlayRect, true).forEach((bounds, rowIndex) => {
        addBox(
          boxes,
          `adlib-glyph-${lineIndex}-${adlibIndex}-${rowIndex}`,
          bounds,
          '#facc15',
          'rgba(250, 204, 21, 0.15)'
        );

        const guideLeft = isRtl ? lineBounds.left : bounds.right;
        const guideRight = isRtl ? bounds.left : lineBounds.right;
        if (guideRight > guideLeft) {
          boxes.push({
            id: `adlib-baseline-guide-${lineIndex}-${adlibIndex}-${rowIndex}`,
            top: bounds.bottom,
            left: guideLeft,
            width: guideRight - guideLeft,
            height: 0,
            color: 'rgba(250, 204, 21, 0.45)',
            fillColor: 'transparent',
            className: 'live-debug-alignment-guide'
          });
        }
      });

      const structureElements = [
        adlibNode.querySelector(':scope > .primary-text'),
        adlibNode.querySelector(':scope > .pronunciation-text')
      ].filter(Boolean);
      const structureBounds = boundsForRects(structureElements.flatMap(element =>
        getLineTextBoundsList(element, overlayRect)
      ));
      addBox(
        boxes,
        `adlib-structure-${lineIndex}-${adlibIndex}`,
        structureBounds,
        '#ff3030',
        'transparent',
        'live-debug-box-outline'
      );
      const fullAdlibElements = [
        ...structureElements,
        adlibNode.querySelector(':scope > .adlib-live-translation')
      ].filter(Boolean);
      const fullAdlibBounds = boundsForRects(fullAdlibElements.flatMap(element =>
        getLineTextBoundsList(element, overlayRect)
      ));
      addBox(
        boxes,
        `adlib-full-structure-${lineIndex}-${adlibIndex}`,
        fullAdlibBounds,
        '#ffffff',
        'transparent',
        'live-debug-adlib-full-outline'
      );
    });

    const gradientLayers = Array.from(lineNode.querySelectorAll(
      '.segment-mask-span[style*="backgroundImage"], .segment-mask-span[style*="background-image"]'
    ));
    gradientLayers.forEach((gradient, gradientIndex) => {
      getLineTextBoundsList(gradient, overlayRect).forEach((bounds, rowIndex) => {
        addBox(
          boxes,
          `grad-${lineIndex}-${gradientIndex}-line-${rowIndex}`,
          bounds,
          '#f97316',
          'rgba(249, 115, 22, 0.18)'
        );
      });
    });

    Array.from(lineNode.querySelectorAll('.chunk-translation, .live-translation'))
      .forEach((translation, translationIndex) => {
        getLineTextBoundsList(translation, overlayRect).forEach((bounds, rowIndex) => {
          addBox(
            boxes,
            `trans-${lineIndex}-${translationIndex}-line-${rowIndex}`,
            bounds,
            '#00bbf9',
            'rgba(0, 187, 249, 0.12)'
          );
        });
      });

    Array.from(lineNode.querySelectorAll('.pronunciation-text'))
      .forEach((pronunciation, pronunciationIndex) => {
        getLineTextBoundsList(pronunciation, overlayRect).forEach((bounds, rowIndex) => {
          addBox(
            boxes,
            `pron-chunk-${lineIndex}-${pronunciationIndex}-line-${rowIndex}`,
            bounds,
            '#c084fc',
            'rgba(192, 132, 252, 0.12)'
          );
        });
      });

      const mainSegments = getMainSegmentBounds(lineNode, overlayRect);
      const translationRows = getLineTextBoundsList(
        lineNode.querySelector('.main-live-translation'),
        overlayRect
      );
      const translationsBySegment = mainSegments.map(() => []);
      const mainSegmentBounds = mainSegments.map(segment => segment.bounds);
      translationRows.forEach(translation => {
        const segmentIndex = getClosestRowIndex(
          mainSegmentBounds, translation
        );
        if (segmentIndex !== undefined) {
          translationsBySegment[segmentIndex].push(translation);
        }
      });
      const horizontalRows = [];
      mainSegments.forEach(({ id, bounds }, segmentIndex) => {
        const lineSegmentId = `line-${lineIndex}-${id}`;
        const redBounds = padBounds(bounds, 3);
        const whiteBounds = boundsForRects([
          redBounds,
          ...translationsBySegment[segmentIndex]
        ]);
        addBox(
          boxes,
          lineSegmentId,
          redBounds,
          '#ff3030',
          'transparent',
          'live-debug-box-outline'
        );
        addBox(
          boxes,
          `active-row-outline-${lineSegmentId}`,
          whiteBounds,
          '#ffffff',
          'transparent',
          'live-debug-active-row-outline'
        );
        horizontalRows.push({
          id: `main-${lineSegmentId}`,
          glyphRows: [bounds],
          bounds: whiteBounds
        });
      });

    lineNode.querySelectorAll('.adlib-node').forEach((adlibNode, adlibIndex) => {
      const glyphLayer = adlibNode.querySelector(':scope > .primary-text');
      const glyphRows = getLineTextBoundsList(glyphLayer, overlayRect, true);
      if (glyphRows.length === 0) return;
      const fullAdlibElements = [
        glyphLayer,
        adlibNode.querySelector(':scope > .pronunciation-text'),
        adlibNode.querySelector(':scope > .adlib-live-translation')
      ].filter(Boolean);
      const fullAdlibBounds = boundsForRects(fullAdlibElements.flatMap(element =>
        getLineTextBoundsList(element, overlayRect)
      ));
      if (fullAdlibBounds) {
        horizontalRows.push({
          id: `adlib-${lineIndex}-${adlibIndex}`,
          glyphRows,
          bounds: fullAdlibBounds
        });
      }
    });

    const mergedRows = [];
    horizontalRows.forEach(row => {
      const matchingRows = mergedRows.filter(merged => (
        row.glyphRows.some(glyphRow => (
          merged.glyphRows.some(mergedGlyphRow => (
            rowsShareHorizontalLine(glyphRow, mergedGlyphRow)
          ))
        ))
      ));
      if (matchingRows.length === 0) {
        mergedRows.push({
          id: row.id,
          glyphRows: [...row.glyphRows],
          bounds: row.bounds
        });
        return;
      }

      const firstMatch = matchingRows[0];
      firstMatch.id = `${firstMatch.id}-${row.id}`;
      firstMatch.glyphRows.push(...row.glyphRows);
      firstMatch.bounds = mergeBounds(firstMatch.bounds, row.bounds);
      matchingRows.slice(1).forEach(matched => {
        firstMatch.glyphRows.push(...matched.glyphRows);
        firstMatch.bounds = mergeBounds(firstMatch.bounds, matched.bounds);
        mergedRows.splice(mergedRows.indexOf(matched), 1);
      });
    });
    mergedRows.forEach((row, rowIndex) => {
      addBox(
        boxes,
        `horizontal-row-${lineIndex}-${rowIndex}`,
        row.bounds,
        '#22c55e',
        'transparent',
        'live-debug-horizontal-row'
      );
    });
  });

  return boxes;
};

const haveBoxesChanged = (previous, next) => (
  previous.length !== next.length ||
  next.some((box, index) => {
    const oldBox = previous[index];
    return !oldBox ||
      oldBox.id !== box.id ||
      oldBox.top !== box.top ||
      oldBox.left !== box.left ||
      oldBox.width !== box.width ||
      oldBox.height !== box.height ||
      oldBox.color !== box.color ||
      oldBox.fillColor !== box.fillColor ||
      oldBox.className !== box.className;
  })
);

const LiveDebugOverlay = () => {
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const observedLinesRef = useRef(new Set());
  const [boxes, setBoxes] = useState([]);

  useLayoutEffect(() => {
    const trackLiveLyrics = () => {
      rafRef.current = null;
      if (!overlayRef.current) return;
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const activeLineNode = document.querySelector(
        '.live-lyrics-preview .preview-line.active'
      );
      const lineNodes = Array.from(
        document.querySelectorAll('.live-lyrics-preview .preview-line')
      );
      const activeLineIndex = lineNodes.indexOf(activeLineNode);
      const targetNodes = activeLineIndex < 0
        ? []
        : lineNodes.slice(
          Math.max(0, activeLineIndex - 1),
          activeLineIndex + 2
        );
      const targetLineSet = new Set(targetNodes);
      observedLinesRef.current.forEach(line => {
        if (!targetLineSet.has(line)) resizeObserverRef.current?.unobserve(line);
      });
      targetLineSet.forEach(line => {
        if (!observedLinesRef.current.has(line)) {
          resizeObserverRef.current?.observe(line);
        }
      });
      observedLinesRef.current = targetLineSet;

      const nextBoxes = buildBoxesForLines(targetNodes, overlayRect);
      setBoxes(previous => (
        haveBoxesChanged(previous, nextBoxes) ? nextBoxes : previous
      ));
    };

    const scheduleTrack = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(trackLiveLyrics);
    };
    const observedLines = new Set();
    const observeLine = line => {
      if (observedLines.has(line)) return;
      observedLines.add(line);
      mutationObserver.observe(line, { attributes: true, attributeFilter: ['class'] });
    };
    const lineContainer = overlayRef.current?.parentElement;
    const handleLineChanges = mutations => {
      let shouldTrack = false;
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes') {
          shouldTrack = true;
          return;
        }
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof Element)) return;
          if (node.matches('.preview-line')) observeLine(node);
          node.querySelectorAll('.preview-line').forEach(observeLine);
          shouldTrack = true;
        });
        if (mutation.removedNodes.length > 0) shouldTrack = true;
      });
      if (shouldTrack) scheduleTrack();
    };
    const handleTransition = event => {
      if (event.target instanceof Element && event.target.closest('.preview-line.active')) {
        scheduleTrack();
      }
    };
    const mutationObserver = new MutationObserver(handleLineChanges);
    document.querySelectorAll('.live-lyrics-preview .preview-line').forEach(observeLine);
    if (lineContainer) {
      mutationObserver.observe(lineContainer, { childList: true, subtree: true });
    }
    resizeObserverRef.current = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleTrack);
    if (overlayRef.current) resizeObserverRef.current?.observe(overlayRef.current);

    window.addEventListener('resize', scheduleTrack);
    window.addEventListener('scroll', scheduleTrack, true);
    document.addEventListener('transitionrun', handleTransition, true);
    document.addEventListener('transitionend', handleTransition, true);
    trackLiveLyrics();

    return () => {
      mutationObserver.disconnect();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      observedLinesRef.current.clear();
      window.removeEventListener('resize', scheduleTrack);
      window.removeEventListener('scroll', scheduleTrack, true);
      document.removeEventListener('transitionrun', handleTransition, true);
      document.removeEventListener('transitionend', handleTransition, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="live-debug-overlay" ref={overlayRef}>
      {boxes.map(box => (
        <div
          key={box.id}
          className={`live-debug-box${box.className ? ` ${box.className}` : ''}`}
          data-debug-box-id={box.id}
          style={{
            top: `${box.top}px`,
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            borderColor: box.color,
            backgroundColor: box.fillColor
          }}
        />
      ))}
    </div>
  );
};

export default LiveDebugOverlay;
