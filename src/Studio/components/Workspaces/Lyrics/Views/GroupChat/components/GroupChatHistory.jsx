import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import GroupChatMessageChain from './GroupChatMessageChain.jsx';
import { getClockTime } from '../utils/groupChatUtils.js';

const estimateItemHeight = item => (
  item.type === 'message-chain'
    ? Math.max(72, item.events.length * 76 + 24)
    : 36
);

const GroupChatHistoryItem = ({
  id,
  estimatedHeight,
  isActive,
  children
}) => {
  const itemRef = useRef(null);
  const heightRef = useRef(estimatedHeight);
  const [placeholderHeight, setPlaceholderHeight] = useState(estimatedHeight);
  const [isNearViewport, setIsNearViewport] = useState(
    () => typeof IntersectionObserver === 'undefined'
  );
  const shouldRender = isNearViewport || isActive;

  useEffect(() => {
    const element = itemRef.current;
    const root = element?.closest('.group-chat-history');
    if (!element || !root || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) {
        heightRef.current = entry.target.offsetHeight || heightRef.current;
        setPlaceholderHeight(previous => (
          previous === heightRef.current ? previous : heightRef.current
        ));
      }
      setIsNearViewport(entry.isIntersecting);
    }, { root, rootMargin: '200px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!shouldRender) return undefined;
    const element = itemRef.current;
    if (!element) return undefined;

    const updateHeight = () => {
      heightRef.current = element.offsetHeight || heightRef.current;
    };
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    return () => observer.disconnect();
  }, [isActive, shouldRender]);

  return (
    <div
      className="group-chat-history-item"
      ref={itemRef}
      data-history-item-id={id}
      data-chat-history-rendered={shouldRender ? 'true' : 'false'}
      style={shouldRender ? undefined : { height: `${placeholderHeight}px` }}
    >
      {shouldRender ? children : null}
    </div>
  );
};

const GroupChatHistory = ({
  history,
  playbackTime,
  messageProps
}) => {
  const [initialSystemMessageIds] = useState(() => (
    new Set(
      history
        .filter(item => item.type !== 'message-chain')
        .map(item => `${item.type}-${item.event.artist.name}-${item.event.time}`)
    )
  ));

  return (
    <div className="group-chat-history-content">
      {history.map((item, itemIndex) => {
        if (item.type !== 'message-chain') {
          const { event } = item;
          return (
            <GroupChatHistoryItem
              key={`${item.type}-${event.artist.name}-${event.time}`}
              id={`${item.type}-${event.artist.name}-${event.time}`}
              estimatedHeight={estimateItemHeight(item)}
              isActive={false}
            >
              <div
                className={`group-chat-system-message${initialSystemMessageIds.has(`${item.type}-${event.artist.name}-${event.time}`) ? ' is-initial' : ''}`}
                role="status"
              >
                <span>{event.artist.name} {item.type === 'join' ? 'joined the chat' : 'left the chat'}</span>
                <time>{getClockTime(event.time, playbackTime)}</time>
              </div>
            </GroupChatHistoryItem>
          );
        }

        const id = `chain-${item.events[0].line.index}`;
        const isActive = item.events.some(event => (
          messageProps.activeLineIndices.has(event.line.index)
        ));
        return (
          <GroupChatHistoryItem
            key={id}
            id={id}
            estimatedHeight={estimateItemHeight(item)}
            isActive={isActive}
          >
            <GroupChatMessageChain
              {...messageProps}
              group={item}
              itemIndex={itemIndex}
            />
          </GroupChatHistoryItem>
        );
      })}
    </div>
  );
};

export default GroupChatHistory;
