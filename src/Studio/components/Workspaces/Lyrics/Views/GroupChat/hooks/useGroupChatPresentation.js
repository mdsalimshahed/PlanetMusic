import { useEffect, useLayoutEffect, useRef } from 'react';

const getHistoryTargets = content => Array.from(content.children).flatMap(item => {
  const turns = Array.from(item.querySelectorAll('[data-chat-line-index]'));
  return turns.length
    ? turns.map(turn => ({
      id: `line-${turn.dataset.chatLineIndex}`,
      element: turn
    }))
    : [{
      id: `item-${item.dataset.historyItemId}`,
      element: item
    }];
});

const getHistoryPositions = content => new Map(
  getHistoryTargets(content).map(({ id, element }) => [
    id,
    element.getBoundingClientRect().top
  ])
);

const useGroupChatPresentation = ({
  chatRef,
  activeLineIndices,
  chatState,
  isPlaying,
  settings,
  setExpandedLineIndices,
  pendingScrollToLatestRef
}) => {
  const entranceAnimationsRef = useRef([]);
  const historyGlideAnimationsRef = useRef(new Map());
  const previousHistoryPositionsRef = useRef(null);
  const previousHistoryMessageCountRef = useRef(null);
  const seenMessageLineIdsRef = useRef(null);
  const followsLatestRef = useRef(true);
  const handledLatestHistoryUpdateRef = useRef(false);
  const activeLineIndicesKey = [...activeLineIndices].map(String).join('\u0000');
  const activeLineIndicesRef = useRef(new Set());

  useEffect(() => {
    activeLineIndicesRef.current = new Set(
      activeLineIndicesKey ? activeLineIndicesKey.split('\u0000') : []
    );
  }, [activeLineIndicesKey]);

  useEffect(() => {
    const container = chatRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(entries => {
      const leavingView = entries
        .filter(entry => !entry.isIntersecting)
        .map(entry => entry.target.dataset.chatLineIndex);
      if (!leavingView.length) return;

      setExpandedLineIndices(current => {
        const next = new Set(current);
        leavingView.forEach(index => {
          if (!activeLineIndicesRef.current.has(index)) next.delete(index);
        });
        return next.size === current.size ? current : next;
      });
    }, { root: container, threshold: 0.01 });

    container.querySelectorAll('[data-chat-line-index]').forEach(turn => observer.observe(turn));
    return () => observer.disconnect();
  }, [chatRef, chatState.messages.length, setExpandedLineIndices]);

  useEffect(() => {
    const container = chatRef.current;
    if (!container) return undefined;

    const handleWheel = event => {
      if (event.deltaY < 0) {
        followsLatestRef.current = false;
      } else if (event.deltaY > 0) {
        window.requestAnimationFrame(() => {
          followsLatestRef.current =
            container.scrollHeight - container.clientHeight - container.scrollTop <= 24;
        });
      }
    };
    let touchStartY = null;
    const handleTouchStart = event => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };
    const handleTouchMove = event => {
      const touchY = event.touches[0]?.clientY;
      if (touchStartY == null || touchY == null) return;
      if (touchY > touchStartY) {
        followsLatestRef.current = false;
      } else {
        window.requestAnimationFrame(() => {
          followsLatestRef.current =
            container.scrollHeight - container.clientHeight - container.scrollTop <= 24;
        });
      }
      touchStartY = touchY;
    };
    const handleKeyDown = event => {
      if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
        followsLatestRef.current = false;
      } else if (['ArrowDown', 'PageDown', 'End'].includes(event.key)) {
        window.requestAnimationFrame(() => {
          followsLatestRef.current =
            container.scrollHeight - container.clientHeight - container.scrollTop <= 24;
        });
      }
    };
    const updateHistoryPositions = () => {
      const content = container.querySelector('.group-chat-history-content');
      if (content) previousHistoryPositionsRef.current = getHistoryPositions(content);
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('scroll', updateHistoryPositions, { passive: true });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('scroll', updateHistoryPositions);
    };
  }, [chatRef]);

  useLayoutEffect(() => {
    const turns = Array.from(chatRef.current?.querySelectorAll('[data-chat-line-index]') || []);
    const currentIds = new Set(turns.map(turn => turn.dataset.chatLineIndex));
    const previousIds = seenMessageLineIdsRef.current;
    seenMessageLineIdsRef.current = currentIds;

    const newTurns = turns.filter(turn =>
      !previousIds?.has(turn.dataset.chatLineIndex)
    );
    if (
      settings?.disableAnimations ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) return undefined;

    const newAnimations = newTurns.flatMap((turn, index) => {
      const bubble = turn.querySelector('.group-chat-message');
      if (!bubble) return [];
      return [bubble.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 10px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        {
          duration: 380,
          delay: Math.min(index * 70, 420),
          easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)',
          fill: 'both'
        }
      )];
    });
    entranceAnimationsRef.current.push(...newAnimations);
    newAnimations.forEach(animation => {
      animation.onfinish = () => {
        animation.cancel();
        entranceAnimationsRef.current = entranceAnimationsRef.current
          .filter(current => current !== animation);
      };
    });
  }, [chatRef, chatState.messages.length, settings?.disableAnimations]);

  useLayoutEffect(() => {
    const container = chatRef.current;
    const content = container?.querySelector('.group-chat-history-content');
    if (!container || !content) return;

    const messageCount = chatState.messages.length;
    const previousMessageCount = previousHistoryMessageCountRef.current;
    const historyAdded = previousMessageCount != null && messageCount > previousMessageCount;
    handledLatestHistoryUpdateRef.current = historyAdded &&
      pendingScrollToLatestRef.current;
    if (previousMessageCount != null && messageCount < previousMessageCount) {
      historyGlideAnimationsRef.current.forEach(animation => animation.cancel());
      historyGlideAnimationsRef.current.clear();
      previousHistoryPositionsRef.current = null;
    }
    previousHistoryMessageCountRef.current = messageCount;

    const previousPositions = previousHistoryPositionsRef.current;
    if (historyAdded && pendingScrollToLatestRef.current) {
      container.scrollTop = container.scrollHeight - container.clientHeight;
      followsLatestRef.current = true;
      pendingScrollToLatestRef.current = false;
    }

    const targets = getHistoryTargets(content);
    const currentPositions = new Map(targets.map(({ id, element }) => [
      id,
      element.getBoundingClientRect().top
    ]));
    if (historyAdded && previousPositions) {
      const reduceMotion = settings?.disableAnimations ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) {
        targets.forEach(({ id, element }) => {
          const previousTop = previousPositions.get(id);
          const currentTop = currentPositions.get(id);
          if (previousTop == null || currentTop == null) return;
          const deltaY = previousTop - currentTop;
          if (Math.abs(deltaY) <= 1) return;

          historyGlideAnimationsRef.current.get(id)?.cancel();
          const animation = element.animate(
            [
              { transform: `translateY(${deltaY}px)` },
              { transform: 'translateY(0)' }
            ],
            {
              duration: 420,
              easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)'
            }
          );
          historyGlideAnimationsRef.current.set(id, animation);
          animation.onfinish = () => {
            if (historyGlideAnimationsRef.current.get(id) === animation) {
              historyGlideAnimationsRef.current.delete(id);
            }
          };
        });
      }
    }
    previousHistoryPositionsRef.current = currentPositions;
  });

  useLayoutEffect(() => {
    const container = chatRef.current;
    if (handledLatestHistoryUpdateRef.current) {
      handledLatestHistoryUpdateRef.current = false;
      return undefined;
    }
    if (!container || !followsLatestRef.current) return undefined;

    const shouldFollowPlayback = isPlaying && activeLineIndicesKey;
    if (!shouldFollowPlayback) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const styles = getComputedStyle(container);
      const visibleTop = containerRect.top + (parseFloat(styles.paddingTop) || 0);
      const visibleBottom = containerRect.bottom - (parseFloat(styles.paddingBottom) || 0);
      const activeIndices = new Set(activeLineIndicesKey.split('\u0000'));
      const activeTurn = [...container.querySelectorAll('[data-chat-line-index]')]
        .filter(turn => activeIndices.has(turn.dataset.chatLineIndex))
        .pop();
      if (!activeTurn) return;

      const targetRect = activeTurn.getBoundingClientRect();
      let scrollDelta = 0;
      if (targetRect.bottom > visibleBottom) {
        scrollDelta = targetRect.bottom + 12 - visibleBottom;
      } else if (targetRect.top < visibleTop) {
        scrollDelta = targetRect.top - visibleTop - 12;
      }
      if (scrollDelta) {
        container.scrollTo({
          top: Math.min(
            Math.max(0, container.scrollTop + scrollDelta),
            Math.max(0, container.scrollHeight - container.clientHeight)
          ),
          behavior: settings?.disableAnimations ||
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
            ? 'auto'
            : 'smooth'
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeLineIndicesKey, chatRef, isPlaying, settings?.disableAnimations]);

  useEffect(() => () => {
    entranceAnimationsRef.current.forEach(animation => animation.cancel());
    historyGlideAnimationsRef.current.forEach(animation => animation.cancel());
    historyGlideAnimationsRef.current.clear();
  }, []);
};

export default useGroupChatPresentation;
