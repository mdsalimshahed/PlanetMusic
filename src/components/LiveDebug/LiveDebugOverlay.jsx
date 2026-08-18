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

        // Primary main lyrics bounding box (Yellow border and fill encapsulating the entire main parent line)
        const mainLyricSpans = Array.from(lineNode.querySelectorAll('.lyric-text-span'));
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
              id: `primary-full-line-${index}`,
              top: minTop,
              left: minLeft,
              width: maxRight - minLeft,
              height: maxBottom - minTop,
              color: '#facc15',
              fillColor: 'rgba(250, 204, 21, 0.15)'
            });
          }
        }

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

        // Full Encapsulating Pronunciation Block Bounding Box (GREEN border and fill)
        const pronElements = Array.from(lineNode.querySelectorAll('.pronunciation-text'));

        if (pronElements.length > 0) {
          // Calculate an overarching green bounding box that encapsulates all pronunciation chunks in the line
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

        // Individual Pronunciation Chunks Bounding Box (PINK border and fill)
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