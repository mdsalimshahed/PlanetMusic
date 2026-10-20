import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import {
  buildAdlibTimeline,
  findAdlibBoundaryCursor,
  updateAdlibStateAtTime
} from '../../../../utils/adlibTimeline.js';
import {
  buildTimedLineData,
  findActiveLineIndex,
  getCenteredScrollTop
} from './liveLyricsUtils.js';
import './LiveLyricsView.css';
import './LiveScrollLyricsView.css';

const LiveScrollLyricsView = ({
  liveParsedLyrics,
  selectedSong,
  masterPalette,
  isPlayingCurrentSong,
  handleLineClick,
  settings,
  isSongModalReady = true,
  lyricsPlaybackOffsetSeconds = 0,
  shouldAnimateEntrance = false,
  onEntranceAnimationComplete
}) => {
  const containerRef = useRef(null);
  const linesRef = useRef([]);
  const timedLinesRef = useRef([]);
  const adlibsRef = useRef([]);
  const adlibTimelineRef = useRef([]);
  const adlibCursorRef = useRef(0);
  const lastTimeRef = useRef(null);
  const activeLineRef = useRef(-1);
  const pendingCenterTargetRef = useRef(null);
  const syncList = selectedSong?.syncData;

  const nextStarts = useMemo(() => {
    const syncData = syncList || [];
    const result = Array(syncData.length).fill('NaN');
    let nextStart = 'NaN';
    for (let index = syncData.length - 1; index >= 0; index--) {
      result[index] = nextStart;
      if (syncData[index]?.start != null) nextStart = syncData[index].start;
    }
    return result;
  }, [syncList]);
  const timedLineData = useMemo(
    () => buildTimedLineData(syncList, nextStarts),
    [syncList, nextStarts]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const positionMainTranslations = () => {
      const measurements = Array.from(
        container.querySelectorAll('.main-live-translation')
      ).flatMap(translation => {
        const line = translation.closest('.live-scroll-line');
        const core = line?.querySelector('.core-chunks');
        const parent = translation.parentElement;
        if (!line || !core || !parent) return [];

        const lineScaleX = line.offsetWidth
          ? line.getBoundingClientRect().width / line.offsetWidth
          : 1;
        const coreBounds = core.getBoundingClientRect();
        const parentBounds = parent.getBoundingClientRect();
        if (!lineScaleX || coreBounds.width === 0) return [];

        const width = coreBounds.width / lineScaleX;
        const offset = (
          (coreBounds.left + coreBounds.right) / 2 - parentBounds.left
        ) / lineScaleX - width / 2;
        return [{ translation, width, offset }];
      });

      measurements.forEach(({ translation, width, offset }) => {
        translation.style.width = `${width}px`;
        translation.style.setProperty(
          '--live-scroll-translation-offset-x',
          `${offset}px`
        );
      });
    };

    positionMainTranslations();
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(positionMainTranslations);
    resizeObserver?.observe(container);
    document.fonts?.ready.then(positionMainTranslations);

    return () => {
      resizeObserver?.disconnect();
      container.querySelectorAll('.main-live-translation').forEach(translation => {
        translation.style.removeProperty('width');
        translation.style.removeProperty('--live-scroll-translation-offset-x');
      });
    };
  }, [liveParsedLyrics, selectedSong?.trackId]);

  const centerActiveLine = useCallback(node => {
    const container = containerRef.current;
    if (!container || !node) return;
    const containerBounds = container.getBoundingClientRect();
    const contentBounds = [
      node.getBoundingClientRect(),
      ...Array.from(node.querySelectorAll([
        '.adlib-node > .primary-text',
        '.adlib-node > .adlib-live-translation',
        '.adlib-node > .pronunciation-text'
      ].join(', ')), element => element.getBoundingClientRect())
    ];
    const activeTop = Math.min(...contentBounds.map(bounds => bounds.top));
    const activeBottom = Math.max(...contentBounds.map(bounds => bounds.bottom));
    const target = getCenteredScrollTop({
      scrollTop: container.scrollTop,
      viewportTop: containerBounds.top + container.clientTop,
      viewportHeight: container.clientHeight,
      activeTop,
      activeHeight: activeBottom - activeTop,
      maxScrollTop: container.scrollHeight - container.clientHeight
    });
    if (Math.abs(target - container.scrollTop) < 1) return;

    const pendingTarget = pendingCenterTargetRef.current;
    if (pendingTarget && Math.abs(pendingTarget.top - target) < 1) return;
    if (pendingTarget) window.clearTimeout(pendingTarget.timeout);
    const timeout = window.setTimeout(() => {
      pendingCenterTargetRef.current = null;
    }, 800);
    pendingCenterTargetRef.current = { top: target, timeout };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.scrollTop = target;
      window.clearTimeout(timeout);
      pendingCenterTargetRef.current = null;
    } else {
      container.scrollTo({ top: target, behavior: 'smooth' });
    }
  }, []);

  const updateAtTime = useCallback(time => {
    const lines = linesRef.current;
    const nextActiveIndex = findActiveLineIndex(timedLinesRef.current, time);
    if (activeLineRef.current !== nextActiveIndex) {
      const previous = lines[activeLineRef.current];
      previous?.classList.remove('active');
      const next = lines[nextActiveIndex];
      next?.classList.add('active');
      activeLineRef.current = nextActiveIndex;
      if (next) centerActiveLine(next);
    }

    const timeline = adlibTimelineRef.current;
    if (lastTimeRef.current === null || time < lastTimeRef.current) {
      adlibsRef.current.forEach(item => updateAdlibStateAtTime(item, time));
      adlibCursorRef.current = findAdlibBoundaryCursor(timeline, time);
    } else {
      while (
        adlibCursorRef.current < timeline.length &&
        timeline[adlibCursorRef.current].time <= time
      ) {
        updateAdlibStateAtTime(timeline[adlibCursorRef.current].item, time);
        adlibCursorRef.current++;
      }
    }
    lastTimeRef.current = time;
  }, [centerActiveLine]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    linesRef.current = Array.from(
      container.querySelectorAll('.lyric-line-wrapper')
    );
    timedLinesRef.current = timedLineData
      .filter(line => linesRef.current[line.index])
      .map(line => ({ ...line, node: linesRef.current[line.index] }));
    adlibsRef.current = Array.from(
      container.querySelectorAll('.adlib-node')
    ).map(node => ({
      node,
      start: parseFloat(node.dataset.start),
      end: parseFloat(node.dataset.end),
      state: node.classList.contains('adlib-active')
        ? 'active'
        : node.classList.contains('adlib-visible') ? 'visible' : 'hidden'
    }));
    adlibTimelineRef.current = buildAdlibTimeline(adlibsRef.current);
    adlibCursorRef.current = 0;
    lastTimeRef.current = null;
    activeLineRef.current = linesRef.current.findIndex(
      line => line.classList.contains('active')
    );
    if (isPlayingCurrentSong) {
      updateAtTime(
        (typeof window.currentAudioTime === 'number' ? window.currentAudioTime : 0) -
          lyricsPlaybackOffsetSeconds
      );
    } else {
      adlibsRef.current.forEach(item => {
        item.node.classList.add('adlib-visible');
        item.node.classList.remove('adlib-hidden', 'adlib-active');
        item.state = 'visible';
      });
    }
  }, [
    isPlayingCurrentSong,
    liveParsedLyrics,
    lyricsPlaybackOffsetSeconds,
    selectedSong?.trackId,
    syncList,
    timedLineData,
    updateAtTime
  ]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (
      !container ||
      !shouldAnimateEntrance ||
      !isSongModalReady ||
      liveParsedLyrics.length === 0
    ) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.classList.remove('live-scroll-entrance-pending');
      onEntranceAnimationComplete?.(selectedSong?.trackId);
      return undefined;
    }

    let revealTimeout = null;
    let fallbackTimeout = null;
    let revealFrame = null;
    let cancelled = false;
    let revealed = false;
    let preparedLines = new Set();
    const getVisibleLines = () => {
      const bounds = container.getBoundingClientRect();
      return new Set(Array.from(container.querySelectorAll('.live-scroll-line'))
        .filter(line => {
          const lineBounds = line.getBoundingClientRect();
          return lineBounds.height > 0 &&
            lineBounds.bottom > bounds.top &&
            lineBounds.top < bounds.bottom;
        }));
    };
    const prepareVisibleLines = () => {
      const visibleLines = getVisibleLines();
      preparedLines.forEach(line => {
        if (!visibleLines.has(line)) line.classList.remove('is-preparing-reveal');
      });
      visibleLines.forEach(line => line.classList.add('is-preparing-reveal'));
      preparedLines = visibleLines;
      return visibleLines;
    };
    const finishReveal = line => {
      line.classList.add('has-revealed');
      line.classList.remove('initial-reveal', 'is-preparing-reveal');
      line.style.removeProperty('--initial-reveal-delay');
      line.removeEventListener('animationend', handleAnimationEnd);
    };
    const handleAnimationEnd = event => {
      if (event.target !== event.currentTarget) return;
      finishReveal(event.currentTarget);
      if (!container.querySelector('.initial-reveal')) {
        if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout);
        fallbackTimeout = null;
        onEntranceAnimationComplete?.(selectedSong?.trackId);
      }
    };
    const revealVisibleLines = () => {
      if (revealed || cancelled) return;
      const pending = pendingCenterTargetRef.current;
      if (pending && Math.abs(container.scrollTop - pending.top) > 1) {
        revealTimeout = window.setTimeout(revealVisibleLines, 100);
        return;
      }

      const visibleLines = Array.from(prepareVisibleLines());
      if (visibleLines.length === 0) {
        revealTimeout = window.setTimeout(revealVisibleLines, 100);
        return;
      }

      revealed = true;
      revealFrame = window.requestAnimationFrame(() => {
        revealFrame = null;
        if (cancelled) return;
        container.classList.remove('live-scroll-entrance-pending');
        visibleLines.forEach((line, index) => {
          line.style.setProperty('--initial-reveal-delay', `${index * 55}ms`);
          line.addEventListener('animationend', handleAnimationEnd);
          line.classList.remove('is-preparing-reveal');
          line.classList.add('initial-reveal');
        });
        fallbackTimeout = window.setTimeout(() => {
          visibleLines.forEach(finishReveal);
          onEntranceAnimationComplete?.(selectedSong?.trackId);
        }, 260 + Math.max(0, visibleLines.length - 1) * 55 + 100);
      });
    };
    prepareVisibleLines();
    revealVisibleLines();
    revealVisibleLines();
    return () => {
      cancelled = true;
      if (revealTimeout !== null) window.clearTimeout(revealTimeout);
      if (fallbackTimeout !== null) window.clearTimeout(fallbackTimeout);
      if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
      container.querySelectorAll('.initial-reveal').forEach(finishReveal);
      preparedLines.forEach(line => line.classList.remove('is-preparing-reveal'));
    };
  }, [
    isSongModalReady,
    liveParsedLyrics,
    onEntranceAnimationComplete,
    selectedSong?.trackId,
    shouldAnimateEntrance
  ]);

  useEffect(() => {
    const onTime = event => {
      if (isPlayingCurrentSong) {
        updateAtTime(event.detail - lyricsPlaybackOffsetSeconds);
      }
    };
    const onPlayState = event => {
      if (event.detail?.isEnded) {
        linesRef.current[activeLineRef.current]?.classList.remove('active');
        activeLineRef.current = -1;
      }
    };
    window.addEventListener('globalTimeUpdate', onTime);
    window.addEventListener('globalPlayState', onPlayState);
    return () => {
      window.removeEventListener('globalTimeUpdate', onTime);
      window.removeEventListener('globalPlayState', onPlayState);
    };
  }, [isPlayingCurrentSong, lyricsPlaybackOffsetSeconds, updateAtTime]);

  useEffect(() => () => {
    const pending = pendingCenterTargetRef.current;
    if (pending) window.clearTimeout(pending.timeout);
  }, []);

  return (
    <div
      ref={containerRef}
      className={[
        'live-lyrics-preview',
        'live-scroll-preview',
        shouldAnimateEntrance
          ? 'live-scroll-entrance-pending'
          : ''
      ].filter(Boolean).join(' ')}
      style={{ '--dyn-live-sync-gap': settings?.liveSyncLineGap ?? 16 }}
    >
      {liveParsedLyrics.map((line, index) => (
        <LyricLineWrapper
          key={index}
          lineObj={line}
          savedNode={syncList?.[index]}
          nextStart={nextStarts[index]}
          viewMode="live-scroll"
          handleLineClick={handleLineClick}
          masterPalette={masterPalette}
          isPlayingCurrentSong={false}
          lineIndex={index}
        />
      ))}
    </div>
  );
};

export default LiveScrollLyricsView;
