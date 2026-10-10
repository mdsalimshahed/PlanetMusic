import { useEffect, useRef, useState } from 'react';
import './GroupChatDebugOverlay.css';

const getTextBounds = (element, overlayRect) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const bounds = [];
  let node;

  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (!rect.width || !rect.height) continue;
      bounds.push({
        top: rect.top - overlayRect.top,
        left: rect.left - overlayRect.left,
        right: rect.right - overlayRect.left,
        bottom: rect.bottom - overlayRect.top
      });
    }
  }

  if (!bounds.length) return null;
  const top = Math.min(...bounds.map(rect => rect.top));
  const left = Math.min(...bounds.map(rect => rect.left));
  const right = Math.max(...bounds.map(rect => rect.right));
  const bottom = Math.max(...bounds.map(rect => rect.bottom));
  return { top, left, width: right - left, height: bottom - top };
};

const getCombinedTextBounds = (elements, overlayRect) => {
  const bounds = [...elements]
    .map(element => getTextBounds(element, overlayRect))
    .filter(Boolean);
  if (!bounds.length) return null;

  const top = Math.min(...bounds.map(rect => rect.top));
  const left = Math.min(...bounds.map(rect => rect.left));
  const right = Math.max(...bounds.map(rect => rect.left + rect.width));
  const bottom = Math.max(...bounds.map(rect => rect.top + rect.height));
  return { top, left, width: right - left, height: bottom - top };
};

const getCombinedElementBounds = (elements, overlayRect) => {
  const bounds = [...elements].map(element => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top - overlayRect.top,
      left: rect.left - overlayRect.left,
      right: rect.right - overlayRect.left,
      bottom: rect.bottom - overlayRect.top
    };
  }).filter(rect => rect.right > rect.left && rect.bottom > rect.top);
  if (!bounds.length) return null;

  const top = Math.min(...bounds.map(rect => rect.top));
  const left = Math.min(...bounds.map(rect => rect.left));
  const right = Math.max(...bounds.map(rect => rect.right));
  const bottom = Math.max(...bounds.map(rect => rect.bottom));
  return { top, left, width: right - left, height: bottom - top };
};

const GroupChatDebugOverlay = () => {
  const overlayRef = useRef(null);
  const frameRef = useRef(null);
  const [boxes, setBoxes] = useState([]);

  useEffect(() => {
    const updateBoxes = () => {
      const overlay = overlayRef.current;
      if (!overlay) return;
      const overlayRect = overlay.getBoundingClientRect();
      const nextBoxes = [];

      overlay.parentElement?.querySelectorAll('.group-chat-turn.is-chat-active').forEach((turn, turnIndex) => {
        const addTextBox = (element, type, elementIndex = 0) => {
          const bounds = element instanceof Element
            ? getTextBounds(element, overlayRect)
            : getCombinedTextBounds(element, overlayRect);
          if (!bounds) return;
          nextBoxes.push({
            id: `${turnIndex}-${type}-${elementIndex}`,
            ...bounds,
            type
          });
        };

        const lyricSpans = turn.querySelectorAll('.lyric-text-span');
        if (lyricSpans.length) addTextBox(lyricSpans, 'main');

        turn.querySelectorAll('.chunk-translation, .live-translation')
          .forEach((element, index) => addTextBox(element, 'translation', index));
        turn.querySelectorAll('.pronunciation-text')
          .forEach((element, index) => addTextBox(element, 'pronunciation', index));

        const timestamp = turn.querySelector('.group-chat-message-line time');
        if (timestamp) {
          const rect = timestamp.getBoundingClientRect();
          nextBoxes.push({
            id: `${turnIndex}-timestamp`,
            top: rect.top - overlayRect.top,
            left: rect.left - overlayRect.left,
            width: rect.width,
            height: rect.height,
            type: 'timestamp'
          });
        }
      });

      setBoxes(nextBoxes);
      frameRef.current = requestAnimationFrame(updateBoxes);
    };

    frameRef.current = requestAnimationFrame(updateBoxes);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="group-chat-debug-overlay" ref={overlayRef} aria-hidden="true">
      {boxes.map(box => (
        <div
          className={`group-chat-debug-box group-chat-debug-box-${box.type}`}
          key={box.id}
          style={{
            top: `${box.top}px`,
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`
          }}
        />
      ))}
    </div>
  );
};

export default GroupChatDebugOverlay;
