import { useEffect, useRef, useState } from 'react';
import './GroupChatDebugOverlay.css';

const getTextBounds = (
  element,
  overlayRect,
  scaleX,
  scaleY,
  excludePronunciation = false
) => {
  if (!element) return [];
  const rows = [];
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
        top: (rect.top - overlayRect.top) / scaleY,
        bottom: (rect.bottom - overlayRect.top) / scaleY,
        left: (rect.left - overlayRect.left) / scaleX,
        right: (rect.right - overlayRect.left) / scaleX
      };
      const row = rows.find(candidate => {
        const overlap = Math.min(bounds.bottom, candidate.bottom) -
          Math.max(bounds.top, candidate.top);
        return overlap > Math.min(
          bounds.bottom - bounds.top,
          candidate.bottom - candidate.top
        ) * 0.5;
      });

      if (row) {
        row.top = Math.min(row.top, bounds.top);
        row.bottom = Math.max(row.bottom, bounds.bottom);
        row.left = Math.min(row.left, bounds.left);
        row.right = Math.max(row.right, bounds.right);
      } else {
        rows.push(bounds);
      }
    });
  }

  return rows.map(row => ({
    top: row.top,
    left: row.left,
    width: row.right - row.left,
    height: row.bottom - row.top
  }));
};

const getCombinedBounds = (first, second) => {
  const left = Math.min(first.left, second.left);
  const top = Math.min(first.top, second.top);
  const right = Math.max(first.left + first.width, second.left + second.width);
  const bottom = Math.max(first.top + first.height, second.top + second.height);
  return { top, left, width: right - left, height: bottom - top };
};

const bubbleFrameStyleProperties = [
  '--chat-debug-bubble-left',
  '--chat-debug-bubble-top',
  '--chat-debug-bubble-width',
  '--chat-debug-bubble-height',
  '--chat-debug-bubble-padding-x',
  '--chat-debug-bubble-padding-y'
];

const setBubbleFrameStyle = (message, bounds) => {
  if (!message) return;
  const messageRect = message.getBoundingClientRect();
  const overlay = message.closest('.group-chat')?.querySelector('.group-chat-debug-overlay');
  if (!overlay) return;
  const overlayRect = overlay.getBoundingClientRect();
  const overlayScaleX = overlay.offsetWidth ? overlayRect.width / overlay.offsetWidth : 1;
  const overlayScaleY = overlay.offsetHeight ? overlayRect.height / overlay.offsetHeight : 1;
  const values = [
    (overlayRect.left + bounds.left * overlayScaleX - messageRect.left) / overlayScaleX,
    (overlayRect.top + bounds.top * overlayScaleY - messageRect.top) / overlayScaleY,
    bounds.width,
    bounds.height,
    'calc(1.2 * var(--chat-vh-unit))',
    'calc(1.2 * var(--chat-vh-unit))'
  ];

  bubbleFrameStyleProperties.forEach((property, index) => {
    const value = typeof values[index] === 'string'
      ? values[index]
      : `${(Math.round(values[index] * 100) / 100).toFixed(2)}px`;
    if (message.style.getPropertyValue(property) !== value) {
      message.style.setProperty(property, value);
    }
  });
};

const clearBubbleFrameStyle = message => {
  if (!message) return;
  bubbleFrameStyleProperties.forEach(property => {
    if (message.style.getPropertyValue(property)) {
      message.style.removeProperty(property);
    }
  });
};

const gapLabelsAreEqual = (first, second) => (
  first?.text === second?.text &&
  (first === null || second === null || (
    Math.abs(first.left - second.left) < 0.25 &&
    Math.abs(first.top - second.top) < 0.25
  ))
);

const boxesAreEqual = (first, second) => first.length === second.length &&
  first.every((box, index) => {
    const next = second[index];
    return box.id === next.id &&
      Math.abs(box.top - next.top) < 0.25 &&
      Math.abs(box.left - next.left) < 0.25 &&
      Math.abs(box.width - next.width) < 0.25 &&
      Math.abs(box.height - next.height) < 0.25;
  });

const GroupChatDebugOverlay = ({ showDebug = false }) => {
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
    const updateOverlay = () => {
      frameRef.current = null;
      if (disposed) return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const overlayRect = overlay.getBoundingClientRect();
      const scaleX = overlay.offsetWidth ? overlayRect.width / overlay.offsetWidth : 1;
      const scaleY = overlay.offsetHeight ? overlayRect.height / overlay.offsetHeight : 1;
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
      const visibleTurnSet = new Set(visibleTurns.map(({ turn }) => turn));
      turns.forEach(turn => {
        if (!visibleTurnSet.has(turn)) {
          clearBubbleFrameStyle(turn.querySelector('.group-chat-message'));
        }
      });
      visibleTurns.forEach(({ turn }, turnIndex) => {
        const drawDebugBoxes = turnIndex >= visibleTurns.length - 3;
        const lyricBoxes = [];
        const translationBoxes = [];
        const rowOutlines = [];
        const timestampBoxes = [];
        const artistBoxes = [];

        [
          {
            selector: '.chunk-translation, .live-translation',
            type: 'translation'
          },
          {
            selector: '.pronunciation-text',
            type: 'pronunciation'
          },
          {
            selector: '.group-chat-message-line time',
            type: 'timestamp'
          },
          {
            selector: '.group-chat-artist',
            type: 'artist'
          }
        ].forEach(({ selector, type }) => {
          turn.querySelectorAll(selector).forEach((element, elementIndex) => {
            getTextBounds(element, overlayRect, scaleX, scaleY)
              .forEach((bounds, rowIndex) => {
                const box = {
                  id: `${turnIndex}-${type}-${elementIndex}-${rowIndex}`,
                  ...bounds,
                  type
                };

                if (type === 'translation') {
                  translationBoxes.push(box);
                } else if (type === 'timestamp') {
                  timestampBoxes.push(box);
                } else if (type === 'artist') {
                  artistBoxes.push(box);
                } else {
                  lyricBoxes.push(box);
                  if (drawDebugBoxes) nextBoxes.push(box);
                }
              });
          });
        });

        const mainLayer = turn.querySelector('.main-lyrics-layer, .lyric-text-span');
        const mainRows = getTextBounds(
          mainLayer,
          overlayRect,
          scaleX,
          scaleY,
          true
        );
        const rowBounds = mainRows.map(row => ({ ...row }));

        const closestRowIndex = (rows, bounds) => {
          if (!rows.length) return -1;
          return rows.reduce((closest, row, index) => {
            const distance = Math.abs(
              row.top + row.height / 2 -
              bounds.top - bounds.height / 2
            );
            return !closest || distance < closest.distance
              ? { index, distance }
              : closest;
          }, null)?.index ?? -1;
        };

        [...turn.querySelectorAll('.pronunciation-text')].forEach(element => {
          const chunk = element.closest('.inline-cjk-chunk');
          const chunkMainRows = chunk
            ? getTextBounds(chunk, overlayRect, scaleX, scaleY, true)
            : [];
          const pronunciationRowBounds = getTextBounds(
            element,
            overlayRect,
            scaleX,
            scaleY
          );

          pronunciationRowBounds.forEach(pronunciation => {
            const chunkRowIndex = closestRowIndex(chunkMainRows, pronunciation);
            const rowIndex = closestRowIndex(
              mainRows,
              chunkRowIndex < 0 ? pronunciation : chunkMainRows[chunkRowIndex]
            );
            if (rowIndex < 0) return;
            rowBounds[rowIndex] = getCombinedBounds(rowBounds[rowIndex], pronunciation);
          });
        });

        mainRows.forEach((row, rowIndex) => {
          const mainBox = {
            id: `${turnIndex}-main-${rowIndex}`,
            ...row,
            type: 'main'
          };
          if (drawDebugBoxes) nextBoxes.push(mainBox);
          lyricBoxes.push(mainBox);

          const combined = rowBounds[rowIndex];
          const rowOutline = {
            id: `${turnIndex}-row-outline-${rowIndex}`,
            top: combined.top,
            left: combined.left,
            width: combined.width,
            height: combined.height,
            type: 'row-outline'
          };

          rowOutlines.push(rowOutline);
          if (drawDebugBoxes) nextBoxes.push(rowOutline);
          lyricBoxes.push(rowOutline);
        });

        translationBoxes.forEach(box => {
          if (drawDebugBoxes) nextBoxes.push(box);
          lyricBoxes.push(box);
        });

        const whiteOutline = lyricBoxes.length
          ? {
            id: `${turnIndex}-content-outline`,
            ...lyricBoxes.reduce(getCombinedBounds),
            type: 'content-outline'
          }
          : null;

        if (drawDebugBoxes && whiteOutline) nextBoxes.push(whiteOutline);
        if (drawDebugBoxes) {
          timestampBoxes.forEach(box => nextBoxes.push(box));
          artistBoxes.forEach(box => nextBoxes.push(box));
        }

        const outerOutlineBoxes = [
          ...(whiteOutline ? [whiteOutline] : []),
          ...timestampBoxes
        ];
        if (outerOutlineBoxes.length) {
          const bounds = outerOutlineBoxes.reduce(getCombinedBounds);
          if (drawDebugBoxes) {
            nextBoxes.push({
              id: `${turnIndex}-bubble-frame`,
              ...bounds,
              type: 'bubble-frame'
            });
          }
          setBubbleFrameStyle(turn.querySelector('.group-chat-message'), bounds);
        } else {
          clearBubbleFrameStyle(turn.querySelector('.group-chat-message'));
        }
      });
      const selectedTurns = visibleTurns.slice(-2);
      const previousTurn = selectedTurns.at(-2)?.turn ?? null;
      const activeTurn = selectedTurns.at(-1)?.turn ?? null;

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
            left: (overlayRect.width / scaleX) / 2,
            top: Math.max(
              12,
              Math.min(
                overlayRect.height / scaleY - 12,
                (betweenY - overlayRect.top) / scaleY
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
      frameRef.current = requestAnimationFrame(updateOverlay);
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(overlay);
    resizeObserver.observe(history);
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(history, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      characterData: true,
      childList: true,
      subtree: true
    });
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
      chat.querySelectorAll('.group-chat-message')
        .forEach(clearBubbleFrameStyle);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="group-chat-debug-overlay" ref={overlayRef} aria-hidden="true">
      {showDebug && boxes.map(box => (
        <div
          key={box.id}
          className={`group-chat-debug-box group-chat-debug-box-${box.type}`}
          style={{
            top: `${box.top}px`,
            left: `${box.left}px`,
            width: `${box.width}px`,
            height: `${box.height}px`
          }}
        />
      ))}
      {showDebug && gapLabel && (
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
