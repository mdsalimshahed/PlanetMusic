/* --- src/components/LiveDebug/LiveDebugOverlay.jsx --- */
import { useEffect, useRef, useState } from 'react';
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
    const pronunciationRows = getLineTextBoundsList(
      chunk.querySelector('.pronunciation-text'),
      overlayRect
    );
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
        adlibNode.querySelector(':scope > .adlib-live-translation'),
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

    getMainSegmentBounds(lineNode, overlayRect).forEach(({ id, bounds }) => {
      addBox(boxes, id, bounds, '#ff3030', 'transparent', 'live-debug-box-outline');
    });
  });

  return boxes;
};

const LiveDebugOverlay = () => {
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const [boxes, setBoxes] = useState([]);

  useEffect(() => {
    const trackLiveLyrics = () => {
      if (!overlayRef.current) return;
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const activeLineNode = document.querySelector('.preview-line.active');
      const targetNodes = activeLineNode ? [activeLineNode] : [];

      setBoxes(buildBoxesForLines(targetNodes, overlayRect));
      rafRef.current = requestAnimationFrame(trackLiveLyrics);
    };

    rafRef.current = requestAnimationFrame(trackLiveLyrics);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="live-debug-overlay" ref={overlayRef}>
      {boxes.map(box => (
        <div
          key={box.id}
          className={`live-debug-box${box.className ? ` ${box.className}` : ''}`}
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
