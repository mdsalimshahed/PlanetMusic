/* --- src/components/LiveDebug/LiveDebugOverlay.jsx --- */
import React, { useEffect, useRef, useState } from 'react';
import './LiveDebugOverlay.css';

// Utility to calculate the exact bounding box of the rendered text nodes, ignoring 100% width block containers
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
      
      const lineNodes = Array.from(document.querySelectorAll('.preview-line'));
      const newBoxes = [];

      lineNodes.forEach((lineNode, index) => {
        const lineRect = lineNode.getBoundingClientRect();
        
        // Performance optimization: Skip calculations if the line is off-screen
        if (lineRect.bottom < 0 || lineRect.top > overlayRect.bottom) return;

        // 1. Box for the entire line wrapper
        newBoxes.push({
          id: `line-${index}`,
          top: lineRect.top - overlayRect.top,
          left: lineRect.left - overlayRect.left,
          width: lineRect.width,
          height: lineRect.height,
          color: 'rgba(251, 191, 36, 0.3)' // Dimmer yellow for wrapper
        });

        // 2. Box for the primary text
        const primaryText = lineNode.querySelector('.primary-text');
        if (primaryText) {
          const tightBounds = getTightTextBounds(primaryText, overlayRect);
          if (tightBounds) {
            newBoxes.push({
              id: `primary-${index}`,
              ...tightBounds,
              color: '#4ade80' // Green
            });
          }
        }

        // 3. Boxes for translations
        const translations = Array.from(lineNode.querySelectorAll('.chunk-translation, .live-translation'));
        translations.forEach((trans, tIdx) => {
          const tightBounds = getTightTextBounds(trans, overlayRect);
          if (tightBounds) {
            newBoxes.push({
              id: `trans-${index}-${tIdx}`,
              ...tightBounds,
              color: '#00bbf9' // Blue
            });
          }
        });

        // 4. Boxes for pronunciations
        const pronunciations = Array.from(lineNode.querySelectorAll('.pronunciation-text'));
        pronunciations.forEach((pron, pIdx) => {
          const tightBounds = getTightTextBounds(pron, overlayRect);
          if (tightBounds) {
            newBoxes.push({
              id: `pron-${index}-${pIdx}`,
              ...tightBounds,
              color: '#f15bb5' // Pink
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
      <div className="live-debug-hud">
        <strong>Live Lyrics Debug</strong><br/>
        <span style={{ color: 'rgba(251, 191, 36, 0.8)' }}>Line Wrapper</span> | 
        <span style={{ color: '#4ade80' }}> Primary Text</span> | 
        <span style={{ color: '#00bbf9' }}> Translation</span> | 
        <span style={{ color: '#f15bb5' }}> Pronunciation</span>
      </div>
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