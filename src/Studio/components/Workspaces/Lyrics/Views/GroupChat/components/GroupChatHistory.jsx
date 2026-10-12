import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import GroupChatMessageChain from './GroupChatMessageChain.jsx';
import { getClockTime } from '../utils/groupChatUtils.js';

const GroupChatHistory = ({
  history,
  playbackTime,
  messageProps,
  containerRef
}) => {
  const [itemHeights, setItemHeights] = useState(() => new Map());
  const [compactedItems, setCompactedItems] = useState(() => new Set());
  const itemHeightsRef = useRef(itemHeights);
  const compactionTimersRef = useRef(new Map());

  useLayoutEffect(() => {
    itemHeightsRef.current = itemHeights;
  }, [itemHeights]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return undefined;
    const compactionTimers = compactionTimersRef.current;
    const heightObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(entries => {
        setItemHeights(previous => {
          let next = previous;
          entries.forEach(entry => {
            const item = entry.target.closest('[data-history-item-id]');
            const id = item?.dataset.historyItemId;
            const height = entry.target.offsetHeight;
            if (!id || !height || previous.get(id) === height) return;
            if (next === previous) next = new Map(previous);
            next.set(id, height);
          });
          return next;
        });
      });

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const { target } = entry;
        const id = target.dataset.historyItemId;
        if (!id) return;

        const pendingTimer = compactionTimers.get(id);
        if (entry.isIntersecting) {
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            compactionTimers.delete(id);
          }
          setCompactedItems(previous => {
            if (!previous.has(id)) return previous;
            const next = new Set(previous);
            next.delete(id);
            return next;
          });
          return;
        }

        if (pendingTimer) return;
        const timer = setTimeout(() => {
          compactionTimers.delete(id);
          const itemRect = target.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          const buffer = 240;
          const remainsOutsideBuffer = itemRect.bottom <= containerRect.top - buffer ||
            itemRect.top >= containerRect.bottom + buffer;
          if (!remainsOutsideBuffer) return;

          const height = itemHeightsRef.current.get(id) || target.offsetHeight;
          setItemHeights(previous => previous.get(id) === height
            ? previous
            : new Map(previous).set(id, height));
          setCompactedItems(previous => {
            if (previous.has(id)) return previous;
            const next = new Set(previous);
            next.add(id);
            return next;
          });
        }, 600);
        compactionTimers.set(id, timer);
      });
    }, { root: container, rootMargin: '240px 0px', threshold: 0.01 });

    const observeHistoryItems = node => {
      if (!(node instanceof Element)) return;
      if (node.matches('[data-history-compaction]')) observer.observe(node);
      const items = [
        ...(node.matches('[data-history-compaction]') ? [node] : []),
        ...node.querySelectorAll('[data-history-compaction]')
      ];
      items.forEach(item => {
        observer.observe(item);
        const chain = item.querySelector('.group-chat-chain');
        if (chain) heightObserver?.observe(chain);
      });
      if (node.matches('.group-chat-chain')) heightObserver?.observe(node);
      node.querySelectorAll('.group-chat-chain')
        .forEach(chain => heightObserver?.observe(chain));
    };
    observeHistoryItems(container);

    const mutationObserver = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(observeHistoryItems));
    });
    mutationObserver.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      heightObserver?.disconnect();
      compactionTimers.forEach(clearTimeout);
      compactionTimers.clear();
    };
  }, [containerRef]);

  return (
    <div className="group-chat-history-content">
      {history.map((item, itemIndex) => {
        if (item.type !== 'message-chain') {
          const { event } = item;
          return (
            <div
              className="group-chat-history-item"
              key={`${item.type}-${event.artist.name}-${event.time}`}
              data-history-item-id={`${item.type}-${event.artist.name}-${event.time}`}
            >
              <div className="group-chat-system-message" role="status">
                <span>{event.artist.name} {item.type === 'join' ? 'joined the chat' : 'left the chat'}</span>
                <time>{getClockTime(event.time, playbackTime)}</time>
              </div>
            </div>
          );
        }

        const id = `chain-${item.events[0].line.index}`;
        const itemHeight = itemHeights.get(id);
        const isCompacted = compactedItems.has(id);
        return (
          <div
            className={`group-chat-history-item${isCompacted ? ' is-history-compacted' : ''}`}
            key={id}
            data-history-item-id={id}
            data-history-compaction
            style={isCompacted && itemHeight
              ? { height: `${itemHeight}px` }
              : itemHeight
                ? { minHeight: `${itemHeight}px` }
                : undefined}
          >
            {isCompacted ? (
              <div className={`group-chat-compact-chain group-chat-compact-chain-${item.side}`}>
                {item.events.map(event => (
                  <div className="group-chat-compact-line" key={event.line.index}>
                    <span>{event.line.text || ''}</span>
                    <time>{getClockTime(event.time, playbackTime)}</time>
                  </div>
                ))}
                {item.artists.length > 0 && (
                  <span className="group-chat-compact-artists">{item.artists.join(', ')}</span>
                )}
              </div>
            ) : (
              <GroupChatMessageChain
                {...messageProps}
                group={item}
                itemIndex={itemIndex}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default GroupChatHistory;
