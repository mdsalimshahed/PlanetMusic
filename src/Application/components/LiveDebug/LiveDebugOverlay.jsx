/* --- src/components/LiveDebug/LiveDebugOverlay.jsx --- */
import { useEffect, useRef, useState } from 'react';
import './LiveDebugOverlay.css';

const getLineTextBoundsList = (element, overlayRect, excludePronunciation = false) => {
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

      targetNodes.forEach((lineNode, index) => {
        const lineRect = lineNode.getBoundingClientRect();
        if (lineRect.bottom < 0 || lineRect.top > overlayRect.bottom) return;

        const addGlyphBox = (glyphSpans, id) => {
          if (glyphSpans.length === 0) return;
          let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
          let hasValidMain = false;

          glyphSpans.forEach(spanNode => {
            const lineBoundsList = getLineTextBoundsList(spanNode, overlayRect, true);
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
              id,
              top: minTop,
              left: minLeft,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              color: '#facc15',
              fillColor: 'rgba(250, 204, 21, 0.15)'
            });
          }
        };

        addGlyphBox(
          Array.from(lineNode.querySelectorAll('.main-lyrics-layer .lyric-text-span')),
          `primary-full-line-${index}`
        );
        lineNode.querySelectorAll('.adlib-node').forEach((adlibNode, adlibIdx) => {
          addGlyphBox(
            Array.from(adlibNode.querySelectorAll('.lyric-text-span')),
            `adlib-glyph-${index}-${adlibIdx}`
          );
        });

        // Gradient Mask Layer bounding box (Orange shaded box covering the full line whenever a gradient mask is applied)
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

        // Translation bounding boxes (Blue border and fill)
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

        const pronElements = Array.from(lineNode.querySelectorAll('.pronunciation-text'));

        // Individual pronunciation bounding boxes (purple)
        pronElements.forEach((pronChunk, pIdx) => {
          const lineBoundsList = getLineTextBoundsList(pronChunk, overlayRect);
          lineBoundsList.forEach((bounds, bIdx) => {
            newBoxes.push({
              id: `pron-chunk-${index}-${pIdx}-line-${bIdx}`,
              ...bounds,
              color: '#c084fc',
              fillColor: 'rgba(192, 132, 252, 0.12)'
            });
          });
        });
      });

      setBoxes(newBoxes);
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