import { useEffect, useRef, useState } from 'react';
import './GroupChatDebugOverlay.css';

const getOverlayMetrics = overlay => {
  const rect = overlay.getBoundingClientRect();
  return {
    rect,
    scaleX: rect.width && overlay.offsetWidth ? rect.width / overlay.offsetWidth : 1,
    scaleY: rect.height && overlay.offsetHeight ? rect.height / overlay.offsetHeight : 1
  };
};

const getLocalRect = (rect, metrics) => ({
  top: (rect.top - metrics.rect.top) / metrics.scaleY,
  left: (rect.left - metrics.rect.left) / metrics.scaleX,
  right: (rect.right - metrics.rect.left) / metrics.scaleX,
  bottom: (rect.bottom - metrics.rect.top) / metrics.scaleY
});

const getTextBounds = (element, metrics) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const bounds = [];
  let node;

  while ((node = walker.nextNode())) {
    if (!node.textContent.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.width && rect.height) bounds.push(getLocalRect(rect, metrics));
    }
  }

  if (!bounds.length) return null;
  const top = Math.min(...bounds.map(rect => rect.top));
  const left = Math.min(...bounds.map(rect => rect.left));
  const right = Math.max(...bounds.map(rect => rect.right));
  const bottom = Math.max(...bounds.map(rect => rect.bottom));
  return { top, left, width: right - left, height: bottom - top };
};

const getCombinedTextBounds = (elements, metrics) => {
  const bounds = [...elements]
    .map(element => getTextBounds(element, metrics))
    .filter(Boolean);
  if (!bounds.length) return null;

  const top = Math.min(...bounds.map(rect => rect.top));
  const left = Math.min(...bounds.map(rect => rect.left));
  const right = Math.max(...bounds.map(rect => rect.left + rect.width));
  const bottom = Math.max(...bounds.map(rect => rect.top + rect.height));
  return { top, left, width: right - left, height: bottom - top };
};

const getElementBounds = (element, metrics) => {
  const rect = getLocalRect(element.getBoundingClientRect(), metrics);
  return {
    top: rect.top,
    left: rect.left,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top
  };
};

const boxesAreEqual = (first, second) => first.length === second.length &&
  first.every((box, index) => (
    box.id === second[index].id &&
    box.type === second[index].type &&
    Math.abs(box.top - second[index].top) < 0.25 &&
    Math.abs(box.left - second[index].left) < 0.25 &&
    Math.abs(box.width - second[index].width) < 0.25 &&
    Math.abs(box.height - second[index].height) < 0.25
  ));

const gapLabelsAreEqual = (first, second) => (
  first?.text === second?.text &&
  (first === null || second === null || (
    Math.abs(first.left - second.left) < 0.25 &&
    Math.abs(first.top - second.top) < 0.25
  ))
);

const GroupChatDebugOverlay = () => {
  const overlayRef = useRef(null);
  const frameRef = useRef(null);
  const [boxes, setBoxes] = useState([]);
  const [gapLabel, setGapLabel] = useState(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    const chat = overlay?.closest('.group-chat');
    const history = chat?.querySelector('.group-chat-history');
    if (!overlay || !chat || !history) return undefined;

    const hasRunningHistoryAnimation = () => (
      [...history.querySelectorAll('.group-chat-history-item')]
        .some(item => item.getAnimations({ subtree: true })
          .some(animation => animation.playState === 'running'))
    );

    let disposed = false;
    const updateBoxes = () => {
      frameRef.current = null;
      if (disposed) return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const metrics = getOverlayMetrics(overlay);
      const nextBoxes = [];
      const turns = [...history.querySelectorAll('.group-chat-turn')];
      const historyRect = history?.getBoundingClientRect();
      const historyScaleY = history?.offsetHeight
        ? historyRect.height / history.offsetHeight
        : 1;
      const visibleTop = historyRect
        ? historyRect.top + history.clientTop * historyScaleY
        : Number.NEGATIVE_INFINITY;
      const visibleBottom = historyRect
        ? visibleTop + history.clientHeight * historyScaleY
        : Number.POSITIVE_INFINITY;
      const visibleTurns = turns.map(turn => {
        const rect = turn.getBoundingClientRect();
        return { turn, rect };
      }).filter(({ rect }) => (
        rect.height > 0 &&
        rect.bottom > visibleTop &&
        rect.top < visibleBottom
      )).sort((first, second) => first.rect.bottom - second.rect.bottom);
      const selectedTurns = visibleTurns.slice(-2);
      const previousTurn = selectedTurns.at(-2)?.turn ?? null;
      const activeTurn = selectedTurns.at(-1)?.turn ?? null;

      selectedTurns.forEach(({ turn }, turnIndex) => {
        const artistName = turn.querySelector('.group-chat-artist');
        if (artistName) {
          nextBoxes.push({
            id: `${turnIndex}-artist-frame`,
            ...getElementBounds(artistName, metrics),
            type: 'artist-frame'
          });
          const bounds = getTextBounds(artistName, metrics);
          if (bounds) {
            nextBoxes.push({
              id: `${turnIndex}-artist`,
              ...bounds,
              type: 'artist'
            });
          }
        }

        const addTextBox = (element, type, elementIndex = 0) => {
          const bounds = element instanceof Element
            ? getTextBounds(element, metrics)
            : getCombinedTextBounds(element, metrics);
          if (bounds) {
            nextBoxes.push({
              id: `${turnIndex}-${type}-${elementIndex}`,
              ...bounds,
              type
            });
          }
        };

        const addElementBox = (element, type, id) => {
          if (!element) return;
          nextBoxes.push({
            id,
            ...getElementBounds(element, metrics),
            type
          });
        };

        const message = turn.querySelector('.group-chat-message');
        if (message) {
          addElementBox(message, 'bubble', `${turnIndex}-bubble`);
        }

        const lyricSpans = turn.querySelectorAll('.lyric-text-span');
        if (lyricSpans.length) addTextBox(lyricSpans, 'main');

        turn.querySelectorAll('.chunk-translation, .live-translation')
          .forEach((element, index) => addTextBox(element, 'translation', index));
        turn.querySelectorAll('.pronunciation-text')
          .forEach((element, index) => addTextBox(element, 'pronunciation', index));

        const timestamp = turn.querySelector('.group-chat-message-line time');
        if (timestamp) addElementBox(timestamp, 'timestamp', `${turnIndex}-timestamp`);
      });

      let nextGapLabel = null;
      if (activeTurn && previousTurn) {
        const currentStart = Number(activeTurn.dataset.chatLineStart);
        const previousEnd = Number(previousTurn.dataset.chatLineEnd);
        if (Number.isFinite(currentStart) && Number.isFinite(previousEnd)) {
          const gap = currentStart - previousEnd;
          const previousRect = previousTurn.getBoundingClientRect();
          const activeRect = activeTurn.getBoundingClientRect();
          const betweenY = (previousRect.bottom + activeRect.top) / 2;
          nextGapLabel = {
            text: gap >= 0
              ? `Gap: ${gap.toFixed(2)}s`
              : `Overlap: ${Math.abs(gap).toFixed(2)}s`,
            left: (metrics.rect.width / metrics.scaleX) / 2,
            top: Math.max(
              12,
              Math.min(
                metrics.rect.height / metrics.scaleY - 12,
                (betweenY - metrics.rect.top) / metrics.scaleY
              )
            )
          };
        }
      }

      setBoxes(previous => (
        boxesAreEqual(previous, nextBoxes) ? previous : nextBoxes
      ));
      setGapLabel(previous => (
        gapLabelsAreEqual(previous, nextGapLabel) ? previous : nextGapLabel
      ));
      if (hasRunningHistoryAnimation()) scheduleUpdate();
    };

    function scheduleUpdate() {
      if (disposed || frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(updateBoxes);
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(overlay);
    resizeObserver.observe(history);
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(history, { childList: true, subtree: true });
    history.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('globalTimeUpdate', scheduleUpdate);
    scheduleUpdate();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      history.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('globalTimeUpdate', scheduleUpdate);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
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
      {gapLabel && (
        <div
          className="group-chat-debug-gap"
          style={{ top: `${gapLabel.top}px`, left: `${gapLabel.left}px` }}
        >
          {gapLabel.text}
        </div>
      )}
    </div>
  );
};

export default GroupChatDebugOverlay;
