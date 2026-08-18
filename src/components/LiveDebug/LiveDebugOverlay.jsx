/* --- src/components/LiveDebug/LiveDebugOverlay.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './LiveDebugOverlay.css';

const getLineTextBoundsList = (element, overlayRect) => {
  const lineGroups = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent.trim() !== '') {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.width > 0 && rect.height > 0) {
          const rTop = rect.top - overlayRect.top;
          const rBottom = rect.bottom - overlayRect.top;
          const rLeft = rect.left - overlayRect.left;
          const rRight = rect.right - overlayRect.left;
          // Group rects that belong to the same wrapped line (>50% vertical overlap)
          let matchedGroup = lineGroups.find(group => {
            const verticalOverlap = Math.min(rBottom, group.bottom) - Math.max(rTop, group.top);
            const minHeight = Math.min(rect.height, group.bottom - group.top);
            return verticalOverlap > minHeight * 0.5;
          });
          if (matchedGroup) {
            matchedGroup.top = Math.min(matchedGroup.top, rTop);
            matchedGroup.bottom = Math.max(matchedGroup.bottom, rBottom);
            matchedGroup.left = Math.min(matchedGroup.left, rLeft);
            matchedGroup.right = Math.max(matchedGroup.right, rRight);
          } else {
            lineGroups.push({
              top: rTop,
              bottom: rBottom,
              left: rLeft,
              right: rRight
            });
          }
        }
      }
    }
  }
  return lineGroups.map(g => ({
    top: g.top,
    left: g.left,
    width: g.right - g.left,
    height: g.bottom - g.top
  }));
};

const LiveDebugOverlay = () => {
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const [boxes, setBoxes] = useState([]);
  const [parallelLines, setParallelLines] = useState([]);

  useEffect(() => {
    const trackLiveLyrics = () => {
      if (!overlayRef.current) return;
      const overlayRect = overlayRef.current.getBoundingClientRect();

      // 1. Locate the currently active line element in the DOM
      const activeLineNode = document.querySelector('.preview-line.active');
      const targetNodes = [];
      if (activeLineNode) {
        // Line above active line (if present)
        if (activeLineNode.previousElementSibling && activeLineNode.previousElementSibling.classList.contains('preview-line')) {
          targetNodes.push(activeLineNode.previousElementSibling);
        }

        // Active line
        targetNodes.push(activeLineNode);

        // Line below active line (if present)
        if (activeLineNode.nextElementSibling && activeLineNode.nextElementSibling.classList.contains('preview-line')) {
          targetNodes.push(activeLineNode.nextElementSibling);
        }
      }

      const newBoxes = [];
      const newParallelLines = [];

      targetNodes.forEach((lineNode, index) => {
        const lineRect = lineNode.getBoundingClientRect();
        if (lineRect.bottom < 0 || lineRect.top > overlayRect.bottom) return;

        // 2. Identify ad-lib nodes inside this line (if any)
        const adlibNodes = Array.from(lineNode.querySelectorAll('.adlib-container, .adlib-node'));

        // 3. Primary main parent lyrics bounding box (surrounds ONLY the main text)
        const mainLyricSpans = Array.from(lineNode.querySelectorAll('.lyric-text-span')).filter(
          spanNode => !adlibNodes.some(adlib => adlib.contains(spanNode))
        );

        if (mainLyricSpans.length > 0) {
          let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
          let hasValidMain = false;
          mainLyricSpans.forEach(spanNode => {
            const lineBoundsList = getLineTextBoundsList(spanNode, overlayRect);
            lineBoundsList.forEach(bounds => {
              hasValidMain = true;
              minTop = Math.min(minTop, bounds.top);
              minLeft = Math.min(minLeft, bounds.left);
              maxRight = Math.max(maxRight, bounds.left + bounds.width);
              maxBottom = Math.max(maxBottom, bounds.top + bounds.height);
            });
          });

          if (hasValidMain) {
            newBoxes.push({
              id: `primary-main-line-${index}`,
              top: minTop,
              left: minLeft,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              color: '#facc15',
              fillColor: 'rgba(250, 204, 21, 0.15)'
            });

            // 3b. Parallel lines extending from top-right and bottom-right vertices to the edge of the overlay
            newParallelLines.push({
              id: `parallel-top-${index}`,
              x1: maxRight,
              y1: minTop,
              x2: overlayRect.width,
              y2: minTop,
              color: '#facc15'
            });

            newParallelLines.push({
              id: `parallel-bottom-${index}`,
              x1: maxRight,
              y1: maxBottom,
              x2: overlayRect.width,
              y2: maxBottom,
              color: '#facc15'
            });
          }
        }

        // 4. FULL PARENT UNIT ENCLOSING BOX (Red dashed line encapsulating main text + translation + pronunciation)
        const parentUnitElements = Array.from(
          lineNode.querySelectorAll('.lyric-text-span, .chunk-translation, .live-translation, .pronunciation-text')
        ).filter(el => !adlibNodes.some(adlib => adlib.contains(el)));

        if (parentUnitElements.length > 0) {
          let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
          let hasValidParentUnit = false;
          parentUnitElements.forEach(el => {
            const lineBoundsList = getLineTextBoundsList(el, overlayRect);
            lineBoundsList.forEach(bounds => {
              hasValidParentUnit = true;
              minTop = Math.min(minTop, bounds.top);
              minLeft = Math.min(minLeft, bounds.left);
              maxRight = Math.max(maxRight, bounds.left + bounds.width);
              maxBottom = Math.max(maxBottom, bounds.top + bounds.height);
            });
          });
          if (hasValidParentUnit) {
            newBoxes.push({
              id: `full-parent-unit-${index}`,
              top: minTop,
              left: minLeft,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              color: '#ef4444',
              fillColor: 'rgba(239, 68, 68, 0.08)'
            });
          }
        }

        // 5. Physically separate bounding boxes for EACH ad-lib node
        adlibNodes.forEach((adlibNode, aIdx) => {
          // Yellow box for ad-lib main text
          const adlibMainSpans = Array.from(adlibNode.querySelectorAll('.lyric-text-span')).filter(
            span => !span.closest('.pronunciation-text') && !span.closest('.chunk-translation') && !span.closest('.live-translation')
          );

          let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
          let hasValidAdlib = false;

          const spansToMeasure = adlibMainSpans.length > 0 ? adlibMainSpans : [adlibNode];
          spansToMeasure.forEach(aSpan => {
            const lineBoundsList = getLineTextBoundsList(aSpan, overlayRect);
            lineBoundsList.forEach(bounds => {
              hasValidAdlib = true;
              minTop = Math.min(minTop, bounds.top);
              minLeft = Math.min(minLeft, bounds.left);
              maxRight = Math.max(maxRight, bounds.left + bounds.width);
              maxBottom = Math.max(maxBottom, bounds.top + bounds.height);
            });
          });

          if (hasValidAdlib) {
            newBoxes.push({
              id: `adlib-line-${index}-${aIdx}`,
              top: minTop,
              left: minLeft,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              color: '#facc15',
              fillColor: 'rgba(250, 204, 21, 0.15)'
            });
          }

          // FULL ADLIB UNIT ENCLOSING BOX (Red dashed line encapsulating ad-lib text + translation + pronunciation)
          const adlibUnitElements = Array.from(
            adlibNode.querySelectorAll('.lyric-text-span, .primary-text, .chunk-translation, .live-translation, .pronunciation-text')
          );

          let aUnitMinTop = Infinity, aUnitMinLeft = Infinity, aUnitMaxRight = -Infinity, aUnitMaxBottom = -Infinity;
          let hasValidAdlibUnit = false;

          adlibUnitElements.forEach(el => {
            const lineBoundsList = getLineTextBoundsList(el, overlayRect);
            lineBoundsList.forEach(bounds => {
              hasValidAdlibUnit = true;
              aUnitMinTop = Math.min(aUnitMinTop, bounds.top);
              aUnitMinLeft = Math.min(aUnitMinLeft, bounds.left);
              aUnitMaxRight = Math.max(aUnitMaxRight, bounds.left + bounds.width);
              aUnitMaxBottom = Math.max(aUnitMaxBottom, bounds.top + bounds.height);
            });
          });

          if (hasValidAdlibUnit) {
            newBoxes.push({
              id: `full-adlib-unit-${index}-${aIdx}`,
              top: aUnitMinTop,
              left: aUnitMinLeft,
              width: aUnitMaxRight - aUnitMinLeft,
              height: aUnitMaxBottom - aUnitMinTop,
              color: '#ef4444',
              fillColor: 'rgba(239, 68, 68, 0.08)'
            });
          }
        });

        // 6. Gradient Mask Layer bounding box
        const gradientLayers = Array.from(lineNode.querySelectorAll('.segment-mask-span[style*="backgroundImage"], .segment-mask-span[style*="background-image"]'));
        gradientLayers.forEach((gradNode, gIdx) => {
          const lineBoundsList = getLineTextBoundsList(gradNode, overlayRect);
          lineBoundsList.forEach((bounds, bIdx) => {
            newBoxes.push({
              id: `grad-${index}-${gIdx}-line-${bIdx}`,
              ...bounds,
              color: '#f97316',
              fillColor: 'rgba(249, 115, 22, 0.18)'
            });
          });
        });

        // 7. Translation bounding boxes (Blue border and fill)
        const translations = Array.from(lineNode.querySelectorAll('.chunk-translation, .live-translation'));
        translations.forEach((trans, tIdx) => {
          const lineBoundsList = getLineTextBoundsList(trans, overlayRect);
          lineBoundsList.forEach((bounds, bIdx) => {
            newBoxes.push({
              id: `trans-${index}-${tIdx}-line-${bIdx}`,
              ...bounds,
              color: '#00bbf9',
              fillColor: 'rgba(0, 187, 249, 0.12)'
            });
          });
        });

        // 8. Full Encapsulating Pronunciation Block Bounding Box (GREEN border and fill)
        const pronElements = Array.from(lineNode.querySelectorAll('.pronunciation-text'));
        if (pronElements.length > 0) {
          let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
          let hasValidPron = false;
          pronElements.forEach(pronEl => {
            const lineBoundsList = getLineTextBoundsList(pronEl, overlayRect);
            lineBoundsList.forEach(bounds => {
              hasValidPron = true;
              minTop = Math.min(minTop, bounds.top);
              minLeft = Math.min(minLeft, bounds.left);
              maxRight = Math.max(maxRight, bounds.left + bounds.width);
              maxBottom = Math.max(maxBottom, bounds.top + bounds.height);
            });
          });
          if (hasValidPron) {
            newBoxes.push({
              id: `full-pron-block-${index}`,
              top: minTop,
              left: minLeft,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              color: '#4ade80',
              fillColor: 'rgba(74, 222, 128, 0.15)'
            });
          }
        }

        // 9. Individual Pronunciation Chunks Bounding Box (PINK border and fill)
        pronElements.forEach((pronChunk, pIdx) => {
          const lineBoundsList = getLineTextBoundsList(pronChunk, overlayRect);
          lineBoundsList.forEach((bounds, bIdx) => {
            newBoxes.push({
              id: `pron-chunk-${index}-${pIdx}-line-${bIdx}`,
              ...bounds,
              color: '#f15bb5',
              fillColor: 'rgba(241, 91, 181, 0.12)'
            });
          });
        });
      });

      setBoxes(newBoxes);
      setParallelLines(newParallelLines);
      rafRef.current = requestAnimationFrame(trackLiveLyrics);
    };

    rafRef.current = requestAnimationFrame(trackLiveLyrics);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="live-debug-overlay" ref={overlayRef}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10004 }}>
        {parallelLines.map(line => (
          <line
            key={line.id}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ))}
      </svg>
      {boxes.map(box => (
        <div
          key={box.id}
          className="live-debug-box"
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