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

const isVisibleInContainer = (element, container) => {
  const elementBounds = element.getBoundingClientRect();
  const containerBounds = container.getBoundingClientRect();
  const visibleLeft = containerBounds.left + container.clientLeft;
  const visibleTop = containerBounds.top + container.clientTop;
  const visibleRight = visibleLeft + container.clientWidth;
  const visibleBottom = visibleTop + container.clientHeight;

  return elementBounds.width > 0 &&
    elementBounds.height > 0 &&
    elementBounds.right > visibleLeft &&
    elementBounds.left < visibleRight &&
    elementBounds.bottom > visibleTop &&
    elementBounds.top < visibleBottom;
};

// Where scrollTop must be for the LAST message to sit fully above the bottom padding.
// Uses layout geometry (offsetTop/offsetHeight), NOT scrollHeight, because scrollHeight
// also counts in-flight transform animations (FLIP glide / entrance) and overshoots.
const getBottomScrollTop = (container, content) => {
  const paddingBottom = parseFloat(getComputedStyle(container).paddingBottom) || 0;
  return Math.max(
    0,
    content.offsetTop + content.offsetHeight + paddingBottom - container.clientHeight
  );
};

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
  const historyGlideDeltasRef = useRef(new Map());
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

  // FIX (2/2): keep the chat glued to the newest message no matter what changes the layout
  // after React commits - a bubble re-measuring itself, wrapping, fonts loading, the window
  // being resized... Whenever we are "following the latest message" and the content/viewport
  // changes size, or the browser moves the scroll position UP on its own (clamping), snap
  // back to the bottom. ResizeObserver/scroll callbacks run before paint, so there is no
  // visible flicker. If the user scrolled up themselves, followsLatestRef is already false
  // (wheel / touch / keyboard handlers above), so we never fight them.
  useEffect(() => {
    const container = chatRef.current;
    const content = container?.querySelector('.group-chat-history-content');
    if (!container || !content || typeof ResizeObserver === 'undefined') return undefined;

    let lastScrollTop = container.scrollTop;

    const pinToBottom = () => {
      const target = getBottomScrollTop(container, content);
      const shift = target - container.scrollTop;
      if (Math.abs(shift) < 1) return;
      container.scrollTop = target;
      lastScrollTop = container.scrollTop;

      // Old bubbles may be mid-glide from positions computed before this extra shift;
      // re-aim them so they still start where they visually were (no one-frame jump).
      historyGlideAnimationsRef.current.forEach((animation, id) => {
        const deltaY = historyGlideDeltasRef.current.get(id);
        if (deltaY == null || !animation.effect?.setKeyframes) return;
        const nextDelta = deltaY + shift;
        historyGlideDeltasRef.current.set(id, nextDelta);
        try {
          animation.effect.setKeyframes([
            { transform: `translateY(${nextDelta}px)` },
            { transform: 'translateY(0)' }
          ]);
        } catch {
          /* older browsers: the glide just finishes from its original offset */
        }
      });
    };

    const handleResize = () => {
      if (followsLatestRef.current) pinToBottom();
    };
    const handleScroll = () => {
      const top = container.scrollTop;
      const movedUp = top < lastScrollTop - 0.5;
      lastScrollTop = top;
      if (movedUp && followsLatestRef.current) pinToBottom();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(content);
    observer.observe(container);
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [chatRef]);

  useLayoutEffect(() => {
    const container = chatRef.current;
    if (!container) return undefined;

    const animateNewTurns = () => {
      const turns = Array.from(container.querySelectorAll('[data-chat-line-index]'));
      const previousIds = seenMessageLineIdsRef.current;
      const seenIds = new Set(previousIds || []);

      const newTurns = turns.filter(turn => (
        !previousIds?.has(turn.dataset.chatLineIndex) &&
        isVisibleInContainer(turn, container)
      ));
      turns.forEach(turn => seenIds.add(turn.dataset.chatLineIndex));
      seenMessageLineIdsRef.current = seenIds;
      if (settings?.disableAnimations) return;

      const newAnimations = newTurns.flatMap((turn, index) => {
        const bubble = turn.querySelector('.group-chat-message');
        if (!bubble) return [];
        const travel = parseFloat(
          getComputedStyle(bubble.closest('.group-chat'))
            .getPropertyValue('--chat-vh-unit')
        );
        return [bubble.animate(
          [
            { opacity: 0, transform: `translate3d(0, ${travel}px, 0)` },
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
    };

    animateNewTurns();
    const observer = new MutationObserver(animateNewTurns);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
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
      historyGlideDeltasRef.current.clear();
      previousHistoryPositionsRef.current = null;
    }
    previousHistoryMessageCountRef.current = messageCount;

    const previousPositions = previousHistoryPositionsRef.current;
    if (historyAdded && pendingScrollToLatestRef.current) {
      container.scrollTop = getBottomScrollTop(container, content);
      followsLatestRef.current = true;
      pendingScrollToLatestRef.current = false;
    }

    const targets = getHistoryTargets(content)
      .filter(({ element }) => isVisibleInContainer(element, container));
    const currentPositions = new Map(targets.map(({ id, element }) => [
      id,
      element.getBoundingClientRect().top
    ]));
    if (historyAdded && previousPositions) {
      if (!settings?.disableAnimations) {
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
          historyGlideDeltasRef.current.set(id, deltaY);
          animation.onfinish = () => {
            if (historyGlideAnimationsRef.current.get(id) === animation) {
              historyGlideAnimationsRef.current.delete(id);
              historyGlideDeltasRef.current.delete(id);
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
      const layout = container.closest('.group-chat-layout');
      const layoutScale = layout?.offsetWidth
        ? layout.getBoundingClientRect().width / layout.offsetWidth
        : 1;
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
        scrollDelta = (targetRect.bottom + 12 - visibleBottom) / layoutScale;
      } else if (targetRect.top < visibleTop) {
        scrollDelta = (targetRect.top - visibleTop - 12) / layoutScale;
      }
      if (scrollDelta) {
        container.scrollTo({
          top: Math.min(
            Math.max(0, container.scrollTop + scrollDelta),
            Math.max(0, container.scrollHeight - container.clientHeight)
          ),
          behavior: settings?.disableAnimations
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
    historyGlideDeltasRef.current.clear();
  }, []);
};

export default useGroupChatPresentation;