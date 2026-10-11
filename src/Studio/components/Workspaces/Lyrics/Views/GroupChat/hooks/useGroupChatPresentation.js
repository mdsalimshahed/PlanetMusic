import { useEffect, useLayoutEffect, useRef } from 'react';

const useGroupChatPresentation = ({
  chatRef,
  activeLineIndices,
  chatState,
  playbackEnded,
  settings,
  setExpandedLineIndices,
  pendingScrollToLatestRef,
  pendingScrollBehaviorRef
}) => {
  const entranceAnimationsRef = useRef([]);
  const seenMessageLineIdsRef = useRef(null);
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

  useEffect(() => () => {
    entranceAnimationsRef.current.forEach(animation => animation.cancel());
  }, []);

  useLayoutEffect(() => {
    const container = chatRef.current;
    if (!container || !pendingScrollToLatestRef.current) return;

    const reduceMotion = settings?.disableAnimations ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduceMotion ? 'auto' : pendingScrollBehaviorRef.current;
    pendingScrollToLatestRef.current = false;
    pendingScrollBehaviorRef.current = 'auto';

    const frame = window.requestAnimationFrame(() => {
      const content = container.querySelector('.group-chat-history-content');
      const latestItem = content?.lastElementChild;
      if (!latestItem) return;

      const target = latestItem.querySelector('[data-chat-line-index]:last-of-type') || latestItem;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const bottomPadding = parseFloat(getComputedStyle(container).paddingBottom) || 0;
      const visibleBottom = containerRect.bottom - bottomPadding;
      const scrollDelta = targetRect.bottom + 12 - visibleBottom;
      if (scrollDelta > 0) {
        container.scrollTo({
          top: Math.min(
            container.scrollTop + scrollDelta,
            container.scrollHeight - container.clientHeight
          ),
          behavior
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    chatState.messages.length,
    chatRef,
    playbackEnded,
    pendingScrollBehaviorRef,
    pendingScrollToLatestRef,
    settings?.disableAnimations
  ]);
};

export default useGroupChatPresentation;
