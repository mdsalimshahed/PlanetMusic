/* --- src/components/LiveDebug/LiveDebugOverlay.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './LiveDebugOverlay.css';

const getTightTextBounds = (element, overlayRect) => {
  let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  let hasValidBounds = false;
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
          hasValidBounds = true;
          minTop = Math.min(minTop, rect.top);
          minLeft = Math.min(minLeft, rect.left);
          maxRight = Math.max(maxRight, rect.right);
          maxBottom = Math.max(maxBottom, rect.bottom);
        }
      }
    }
  }
  
  if (hasValidBounds) {
    return {
      top: minTop - overlayRect.top,
      left: minLeft - overlayRect.left,
      width: maxRight - minLeft,
      height: maxBottom - minTop
    };
  }
  return null;
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

        // Primary text bounding box
        const primaryText = lineNode.querySelector('.primary-text');
        if (primaryText) {
          const tightBounds = getTightTextBounds(primaryText, overlayRect);
          if (tightBounds) {
            newBoxes.push({
              id: `primary-${index}`,
              ...tightBounds,
              color: '#4ade80'
            });
          }
        }

        // Translation bounding boxes
        const translations = Array.from(lineNode.querySelectorAll('.chunk-translation, .live-translation'));
        translations.forEach((trans, tIdx) => {
          const tightBounds = getTightTextBounds(trans, overlayRect);
          if (tightBounds) {
            newBoxes.push({
              id: `trans-${index}-${tIdx}`,
              ...tightBounds,
              color: '#00bbf9'
            });
          }
        });

        // Pronunciation bounding boxes
        const pronunciations = Array.from(lineNode.querySelectorAll('.pronunciation-text'));
        pronunciations.forEach((pron, pIdx) => {
          const tightBounds = getTightTextBounds(pron, overlayRect);
          if (tightBounds) {
            newBoxes.push({
              id: `pron-${index}-${pIdx}`,
              ...tightBounds,
              color: '#f15bb5'
            });
          }
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
            borderColor: box.color
          }}
        />
      ))}
    </div>
  );
};

export default LiveDebugOverlay;