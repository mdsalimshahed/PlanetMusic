import { useEffect, useLayoutEffect, useRef } from 'react';

const useGroupChatPresentation = ({
  chatRef,
  activeLineIndices,
  chatState,
  playbackEnded,
  isPlaying,
  settings,
  setExpandedLineIndices,
  pendingScrollToLatestRef,
  pendingScrollBehaviorRef
}) => {
  const entranceAnimationsRef = useRef([]);
  const seenMessageLineIdsRef = useRef(null);
  const previousHistoryItemTopsRef = useRef(null);
  const historyGlideAnimationsRef = useRef(new Map());
  const scrollbarTookOverRef = useRef(false);
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
    const items = Array.from(content?.querySelectorAll(':scope > .group-chat-history-item') || []);
    const currentTops = new Map(items.map(item => [
      item.dataset.historyItemId,
      item.offsetTop
    ]));
    const previousTops = previousHistoryItemTopsRef.current;
    previousHistoryItemTopsRef.current = currentTops;
    if (!container) return;

    if (
      !previousTops ||
      settings?.disableAnimations ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) return;

    if (container.scrollHeight > container.clientHeight + 1) {
      scrollbarTookOverRef.current = true;
      historyGlideAnimationsRef.current.forEach(animation => animation.cancel());
      historyGlideAnimationsRef.current.clear();
      return;
    }

    if (scrollbarTookOverRef.current) return;
    const animations = items.flatMap(item => {
      const itemId = item.dataset.historyItemId;
      const previousTop = previousTops.get(itemId);
      const deltaY = previousTop - currentTops.get(itemId);
      if (previousTop == null || deltaY <= 1) return [];
      historyGlideAnimationsRef.current.get(itemId)?.cancel();
      const animation = item.animate(
        [
          { transform: `translateY(${deltaY}px)` },
          { transform: 'translateY(0)' }
        ],
        { duration: 420, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' }
      );
      historyGlideAnimationsRef.current.set(itemId, animation);
      return [{ itemId, animation }];
    });

    animations.forEach(({ itemId, animation }) => {
      animation.onfinish = () => {
        if (historyGlideAnimationsRef.current.get(itemId) === animation) {
          historyGlideAnimationsRef.current.delete(itemId);
        }
      };
    });
  }, [chatRef, chatState.messages.length, settings?.disableAnimations]);

  useEffect(() => () => {
    entranceAnimationsRef.current.forEach(animation => animation.cancel());
    historyGlideAnimationsRef.current.forEach(animation => animation.cancel());
    historyGlideAnimationsRef.current.clear();
  }, []);

  useLayoutEffect(() => {
    const container = chatRef.current;
    if (!container) return;

    const reduceMotion = settings?.disableAnimations ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduceMotion ? 'auto' : (
      pendingScrollToLatestRef.current ? pendingScrollBehaviorRef.current : 'smooth'
    );
    const shouldFollowPlayback = isPlaying && activeLineIndicesKey;
    if (!shouldFollowPlayback && !pendingScrollToLatestRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const styles = getComputedStyle(container);
      const visibleTop = containerRect.top + (parseFloat(styles.paddingTop) || 0);
      const visibleBottom = containerRect.bottom - (parseFloat(styles.paddingBottom) || 0);
      const hasScrollbar = container.scrollHeight > container.clientHeight + 1;
      if (hasScrollbar && !scrollbarTookOverRef.current) {
        scrollbarTookOverRef.current = true;
        historyGlideAnimationsRef.current.forEach(animation => animation.cancel());
        historyGlideAnimationsRef.current.clear();
      }
      const activeIndices = new Set(activeLineIndicesKey.split('\u0000'));
      const activeTurn = shouldFollowPlayback
        ? [...container.querySelectorAll('[data-chat-line-index]')]
          .filter(turn => activeIndices.has(turn.dataset.chatLineIndex))
          .pop()
        : null;
      const content = container.querySelector('.group-chat-history-content');
      const latestItem = content?.lastElementChild;
      const target = pendingScrollToLatestRef.current ? latestItem : activeTurn;
      if (!target) return;

      const targetRect = target.getBoundingClientRect();
      let scrollDelta;
      if (pendingScrollToLatestRef.current) {
        scrollDelta = targetRect.bottom + 12 - visibleBottom;
      } else if (targetRect.bottom > visibleBottom) {
        scrollDelta = targetRect.bottom + 12 - visibleBottom;
      } else if (targetRect.top < visibleTop) {
        scrollDelta = targetRect.top - visibleTop - 12;
      } else scrollDelta = 0;
      if (scrollDelta && hasScrollbar) {
        historyGlideAnimationsRef.current.forEach(animation => animation.cancel());
        historyGlideAnimationsRef.current.clear();
        container.scrollTo({
          top: Math.min(
            Math.max(0, container.scrollTop + scrollDelta),
            Math.max(0, container.scrollHeight - container.clientHeight)
          ),
          behavior
        });
      }
      pendingScrollToLatestRef.current = false;
      pendingScrollBehaviorRef.current = 'auto';
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeLineIndicesKey,
    chatState.messages.length,
    chatRef,
    isPlaying,
    playbackEnded,
    pendingScrollBehaviorRef,
    pendingScrollToLatestRef,
    settings?.disableAnimations
  ]);
};

export default useGroupChatPresentation;
