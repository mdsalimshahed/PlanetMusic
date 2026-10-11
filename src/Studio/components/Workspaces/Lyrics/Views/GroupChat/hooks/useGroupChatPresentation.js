import { useEffect, useLayoutEffect, useRef } from 'react';

const getTranslateY = element => {
  const transform = getComputedStyle(element).transform;
  const matrix = transform.match(/^matrix\((.+)\)$/);
  if (matrix) return Number(matrix[1].split(',')[5]) || 0;
  const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
  if (matrix3d) return Number(matrix3d[1].split(',')[13]) || 0;
  return 0;
};

const useGroupChatPresentation = ({
  chatRef,
  activeLineIndices,
  chatState,
  settings,
  setExpandedLineIndices
}) => {
  const entranceAnimationsRef = useRef([]);
  const seenMessageLineIdsRef = useRef(null);
  const previousHistoryLayoutRef = useRef(null);
  const previousHistoryMessageCountRef = useRef(null);
  const historyGlideAnimationRef = useRef(null);
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
    if (!container || !content) return;

    const messageCount = chatState.messages.length;
    const previousMessageCount = previousHistoryMessageCountRef.current;
    if (previousMessageCount != null && messageCount < previousMessageCount) {
      historyGlideAnimationRef.current?.cancel();
      historyGlideAnimationRef.current = null;
      content.style.transform = '';
      previousHistoryLayoutRef.current = null;
    }
    previousHistoryMessageCountRef.current = messageCount;
    const paddingBottom = Number.parseFloat(getComputedStyle(container).paddingBottom) || 0;
    if (container.scrollTop) container.scrollTop = 0;
    const contentHeight = content.offsetHeight;
    const layoutTop = content.offsetTop;
    const destinationTop = container.clientHeight - paddingBottom - contentHeight;
    const destinationTransform = destinationTop - layoutTop;
    const previousLayout = previousHistoryLayoutRef.current;

    if (!previousLayout) {
      content.style.transform = destinationTransform
        ? `translateY(${destinationTransform}px)`
        : '';
      previousHistoryLayoutRef.current = { layoutTop, contentHeight, destinationTop };
      return;
    }

    if (
      previousLayout.contentHeight === contentHeight &&
      previousLayout.layoutTop === layoutTop &&
      previousLayout.destinationTop === destinationTop
    ) return;

    const activeAnimation = historyGlideAnimationRef.current;
    const currentTransform = getTranslateY(content);
    const previousVisualTop = previousLayout.layoutTop + currentTransform;
    activeAnimation?.cancel();
    historyGlideAnimationRef.current = null;
    const startTransform = previousVisualTop - layoutTop;
    previousHistoryLayoutRef.current = { layoutTop, contentHeight, destinationTop };

    if (
      settings?.disableAnimations ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
      Math.abs(destinationTransform - startTransform) <= 1
    ) {
      content.style.transform = destinationTransform
        ? `translateY(${destinationTransform}px)`
        : '';
      return;
    }

    const animation = content.animate(
      [
        { transform: `translateY(${startTransform}px)` },
        { transform: `translateY(${destinationTransform}px)` }
      ],
      {
        duration: 420,
        easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
        fill: 'forwards'
      }
    );
    historyGlideAnimationRef.current = animation;
    animation.onfinish = () => {
      if (historyGlideAnimationRef.current !== animation) return;
      content.style.transform = destinationTransform
        ? `translateY(${destinationTransform}px)`
        : '';
      animation.cancel();
      historyGlideAnimationRef.current = null;
    };
  });

  useEffect(() => () => {
    entranceAnimationsRef.current.forEach(animation => animation.cancel());
    historyGlideAnimationRef.current?.cancel();
  }, []);
};

export default useGroupChatPresentation;
