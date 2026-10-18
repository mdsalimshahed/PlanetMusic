/* --- src/components/Workspaces/Lyrics/Views/LiveLyricsView.jsx --- */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import './LiveLyricsView.css';

const LIVE_LYRIC_RENDER_BATCH_SIZE = 2;

const getInitialViewportLineCount = (container, lines, syncData) => {
  const containerStyle = getComputedStyle(container);
  const paddingTop = parseFloat(containerStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(containerStyle.paddingBottom) || 0;
  const gap = parseFloat(containerStyle.rowGap) || 0;
  const contentHeight = Math.max(0, container.clientHeight - paddingTop - paddingBottom);
  const width = Math.max(1, container.clientWidth - (parseFloat(containerStyle.paddingLeft) || 0) - (parseFloat(containerStyle.paddingRight) || 0));
  const configuredFontSize = parseFloat(containerStyle.getPropertyValue('--dyn-live-sync-font-size')) || 34;
  const isMobile = window.innerWidth <= 900;
  const minimumFontSize = isMobile ? 14 : 16;
  const preferredFontSize = isMobile
    ? container.clientWidth * 0.055
    : Math.min(window.innerWidth * 0.05, container.clientWidth * 0.1);
  const fontSize = Math.min(configuredFontSize, Math.max(minimumFontSize, preferredFontSize));
  const context = document.createElement('canvas').getContext('2d');
  if (context) context.font = `700 ${fontSize}px ${containerStyle.fontFamily}`;

  const textWidth = text => context
    ? context.measureText(text).width
    : text.length * fontSize * 0.55;
  const getWrappedRows = text => {
    const words = String(text || '').split(/(\s+)/).filter(Boolean);
    let rows = 1;
    let rowWidth = 0;
    words.forEach(word => {
      const wordWidth = textWidth(word);
      if (rowWidth > 0 && rowWidth + wordWidth > width) {
        rows++;
        rowWidth = wordWidth;
      } else {
        rowWidth += wordWidth;
      }
    });
    return Math.max(rows, Math.ceil(textWidth(text) / width));
  };

  let estimatedHeight = 0;
  let visibleLineCount = 0;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const syncLine = syncData?.[index];
    const mainRows = getWrappedRows(line?.text);
    const extraRows = Number(Boolean(syncLine?.translation)) +
      Number(Boolean(syncLine?.pronunciation)) +
      Number((syncLine?.adlibs?.length || 0) > 0);
    estimatedHeight += (mainRows + extraRows * 0.65) * fontSize * 1.35 + gap;
    visibleLineCount = index + 1;
    if (estimatedHeight >= contentHeight) break;
  }

  return Math.min(lines.length, visibleLineCount + 3);
};

const LiveLyricsView = ({ liveParsedLyrics, selectedSong, masterPalette, isPlayingCurrentSong, isPlaying, handleLineClick, settings, currentTrack, lyricsPlaybackOffsetSeconds = 0 }) => {
  const [renderProgress, setRenderProgress] = useState({
    trackId: null,
    count: 0
  });
  const renderProgressRef = useRef(renderProgress);
  const containerRef = useRef(null);
  const revealedLinesRef = useRef(new WeakSet());
  const cachedLinesRef = useRef([]);
    const timedLinesRef = useRef([]);
  const cachedAdlibsRef = useRef([]);
    const adlibTimelineRef = useRef([]);
    const adlibCursorRef = useRef(0);
    const lastAdlibTimeRef = useRef(null);
    const activeLineIndexRef = useRef(-1);
    const pendingActiveFrameRef = useRef(null);
    const pendingActiveNodeRef = useRef(null);
    const previousSelectedTrackIdRef = useRef(
      selectedSong?.trackId == null ? null : String(selectedSong.trackId)
    );
    const syncList = selectedSong?.syncData;
    const renderedLineCount = renderProgress.trackId === selectedSong?.trackId
      ? Math.min(renderProgress.count, liveParsedLyrics.length)
      : 0;
    useLayoutEffect(() => {
      renderProgressRef.current = renderProgress;
    }, [renderProgress]);
    useLayoutEffect(() => {
      const container = containerRef.current;
      const trackId = selectedSong?.trackId;
      if (!container || trackId == null || liveParsedLyrics.length === 0) return;
      if (renderProgress.trackId === trackId) return;

      setRenderProgress({
        trackId,
        count: Math.min(
          getInitialViewportLineCount(container, liveParsedLyrics, syncList),
          LIVE_LYRIC_RENDER_BATCH_SIZE
        )
      });
    }, [liveParsedLyrics, selectedSong?.trackId, syncList, renderProgress.trackId]);

    useEffect(() => {
      const trackId = selectedSong?.trackId;
      if (trackId == null || liveParsedLyrics.length === 0) return undefined;
      let frame = null;
      const appendNextBatch = () => {
        const current = renderProgressRef.current;
        if (current.trackId !== trackId || current.count >= liveParsedLyrics.length) return;

        const nextProgress = {
          trackId,
          count: Math.min(
            current.count + LIVE_LYRIC_RENDER_BATCH_SIZE,
            liveParsedLyrics.length
          )
        };
        renderProgressRef.current = nextProgress;
        setRenderProgress(nextProgress);
        if (nextProgress.count < liveParsedLyrics.length) {
          frame = window.requestAnimationFrame(appendNextBatch);
        }
      };
      frame = window.requestAnimationFrame(appendNextBatch);
      return () => {
        if (frame !== null) window.cancelAnimationFrame(frame);
      };
    }, [liveParsedLyrics.length, selectedSong?.trackId]);
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

    useLayoutEffect(() => {
        const container = containerRef.current;
        const trackId = selectedSong?.trackId;
        if (!container || trackId == null) return;

        const containerBounds = container.getBoundingClientRect();
        const mountedLines = Array.from(container.querySelectorAll('.lyric-line-wrapper'));
        const visibleLines = mountedLines.filter(node => {
            const bounds = node.getBoundingClientRect();
            return bounds.height > 0 &&
                bounds.bottom > containerBounds.top &&
                bounds.top < containerBounds.bottom &&
                bounds.bottom > 0 &&
                bounds.top < window.innerHeight;
        });
        if (visibleLines.length === 0) return;
        const revealLines = visibleLines.filter(node => !revealedLinesRef.current.has(node));
        if (revealLines.length === 0) return;
        if (
            (isPlayingCurrentSong && isPlaying) ||
            settings?.disableAnimations ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            revealLines.forEach(node => revealedLinesRef.current.add(node));
            return;
        }

        revealLines.forEach(node => node.classList.add('is-preparing-reveal'));
        let revealFrame = null;
        let cancelled = false;
        revealFrame = window.requestAnimationFrame(() => {
            revealFrame = null;
            if (cancelled) return;

            revealLines.forEach((node, index) => {
                if (!node.isConnected) return;
                revealedLinesRef.current.add(node);
                node.style.setProperty('--initial-reveal-delay', `${index * 55}ms`);
                const finishReveal = (event) => {
                    if (event.target !== node) return;
                    node.classList.add('has-revealed');
                    node.classList.remove('initial-reveal');
                    node.style.removeProperty('--initial-reveal-delay');
                    node.removeEventListener('animationend', finishReveal);
                };
                node.addEventListener('animationend', finishReveal);
                node.classList.remove('is-preparing-reveal');
                node.classList.add('initial-reveal');
            });
        });

        return () => {
            cancelled = true;
            if (revealFrame !== null) window.cancelAnimationFrame(revealFrame);
            revealLines.forEach(node => node.classList.remove('is-preparing-reveal'));
        };
    }, [liveParsedLyrics, selectedSong?.trackId, settings?.disableAnimations, isPlayingCurrentSong, isPlaying, renderedLineCount]);

  const handleTimeUpdate = useCallback((time) => {
    if (!isPlayingCurrentSong) return;
    
    const lines = cachedLinesRef.current;
    const timedLines = timedLinesRef.current;
    let low = 0;
    let high = timedLines.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (timedLines[middle].start <= time) low = middle + 1;
        else high = middle;
    }

    let newActiveIndex = -1;
    for (let i = low - 1; i >= 0; i--) {
        const candidate = timedLines[i];
        const isBeforeEnd = isNaN(candidate.end) || time <= candidate.end;
        const isBeforeNext = isNaN(candidate.nextStart) || time < candidate.nextStart;
        if (isBeforeEnd && isBeforeNext) {
            newActiveIndex = candidate.index;
            break;
        }
    }

    const previousActiveIndex = activeLineIndexRef.current;
    if (previousActiveIndex !== newActiveIndex) {
        if (pendingActiveFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingActiveFrameRef.current);
            pendingActiveFrameRef.current = null;
        }
        pendingActiveNodeRef.current?.classList.remove('is-preparing-active');
        pendingActiveNodeRef.current = null;

        if (newActiveIndex !== -1) {
            const item = lines[newActiveIndex];
            pendingActiveNodeRef.current = item.node;
            item.node.classList.add('is-preparing-active');
            pendingActiveFrameRef.current = window.requestAnimationFrame(() => {
                pendingActiveFrameRef.current = null;
                if (pendingActiveNodeRef.current !== item.node || !item.node.isConnected) return;

                lines.forEach(line => {
                    if (line.isActive && line.node !== item.node) {
                        line.node.classList.remove('active');
                        line.isActive = false;
                    }
                });
                item.node.classList.remove('is-preparing-active');
                item.node.classList.add('active');
                item.isActive = true;
                pendingActiveNodeRef.current = null;

                if (containerRef.current) {
                    const offsetTop = item.node.offsetTop;
                    const scrollPos = offsetTop - (containerRef.current.clientHeight / 2) + (item.node.clientHeight / 2);
                    containerRef.current.scrollTo({
                       top: scrollPos,
                       behavior: settings?.disableAnimations ? 'auto' : 'smooth'
                    });
                }
            });
        } else if (previousActiveIndex !== -1) {
            lines.forEach(line => {
                if (!line.isActive) return;
                line.node.classList.remove('active');
                line.isActive = false;
            });
        }
        activeLineIndexRef.current = newActiveIndex;
    }

    const adlibTimeline = adlibTimelineRef.current;
    const lastAdlibTime = lastAdlibTimeRef.current;
    if (lastAdlibTime === null || time < lastAdlibTime) {
        cachedAdlibsRef.current.forEach(item => updateAdlibStateAtTime(item, time));
        adlibCursorRef.current = findAdlibBoundaryCursor(adlibTimeline, time);
    } else {
        while (adlibCursorRef.current < adlibTimeline.length && adlibTimeline[adlibCursorRef.current].time <= time) {
            updateAdlibStateAtTime(adlibTimeline[adlibCursorRef.current].item, time);
            adlibCursorRef.current++;
        }
    }
    lastAdlibTimeRef.current = time;
  }, [isPlayingCurrentSong, settings?.disableAnimations]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => ({
            node,
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            nextStart: parseFloat(node.dataset.nextStart),
            isActive: node.classList.contains('active')
        }));
        timedLinesRef.current = cachedLinesRef.current
          .map((line, index) => ({ ...line, index }))
          .filter(line => !isNaN(line.start))
          .sort((first, second) => first.start - second.start);
        activeLineIndexRef.current = cachedLinesRef.current.findIndex(line => line.isActive);

        cachedAdlibsRef.current = Array.from(containerRef.current.querySelectorAll('.adlib-node')).map(node => ({
          node,
          start: parseFloat(node.dataset.start),
          end: parseFloat(node.dataset.end),
          state: node.classList.contains('adlib-active') ? 'active' : (node.classList.contains('adlib-visible') ? 'visible' : 'hidden')
        }));
        adlibTimelineRef.current = buildAdlibTimeline(cachedAdlibsRef.current);
        adlibCursorRef.current = 0;
        lastAdlibTimeRef.current = null;

        if (isPlayingCurrentSong && typeof window.currentAudioTime === 'number') {
          handleTimeUpdate(window.currentAudioTime - lyricsPlaybackOffsetSeconds);
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [liveParsedLyrics, selectedSong?.syncData, lyricsPlaybackOffsetSeconds, renderedLineCount, isPlayingCurrentSong, handleTimeUpdate]);

  useEffect(() => {
    const clearActiveLines = () => {
        if (pendingActiveFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingActiveFrameRef.current);
            pendingActiveFrameRef.current = null;
        }
        pendingActiveNodeRef.current?.classList.remove('is-preparing-active');
        pendingActiveNodeRef.current = null;
        cachedLinesRef.current.forEach(item => {
            if (item.isActive) {
                item.node.classList.remove('active');
                item.isActive = false;
            }
        });
        activeLineIndexRef.current = -1;
    };

    const clearAllActive = () => {
        clearActiveLines();
        cachedAdlibsRef.current.forEach(item => {
            if (item.state !== 'hidden') {
                item.node.classList.add('adlib-hidden');
                item.node.classList.remove('adlib-active', 'adlib-visible');
                item.state = 'hidden';
            }
        });
        adlibCursorRef.current = 0;
        lastAdlibTimeRef.current = null;
    };

    const handleTimeEvent = (e) => handleTimeUpdate(e.detail - lyricsPlaybackOffsetSeconds);
    const handlePlayState = (e) => {
        if (e.detail.isEnded) {
            clearActiveLines();
        }
    };

    window.addEventListener('globalTimeUpdate', handleTimeEvent);
    window.addEventListener('globalPlayState', handlePlayState);

    const selectedTrackId = selectedSong?.trackId == null ? null : String(selectedSong.trackId);
    const selectedTrackChanged = previousSelectedTrackIdRef.current !== selectedTrackId;
    previousSelectedTrackIdRef.current = selectedTrackId;

    if (isPlayingCurrentSong) {
        const initialTime = currentTrack ? (window.currentAudioTime || 0) : 0;
        handleTimeUpdate(initialTime - lyricsPlaybackOffsetSeconds);
    } else if (currentTrack || selectedTrackChanged) {
        clearAllActive();
    }

    return () => {
        window.removeEventListener('globalTimeUpdate', handleTimeEvent);
        window.removeEventListener('globalPlayState', handlePlayState);
        if (pendingActiveFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingActiveFrameRef.current);
            pendingActiveFrameRef.current = null;
        }
        pendingActiveNodeRef.current?.classList.remove('is-preparing-active');
        pendingActiveNodeRef.current = null;
    };
    }, [isPlayingCurrentSong, currentTrack, selectedSong?.trackId, settings?.disableAnimations, lyricsPlaybackOffsetSeconds, handleTimeUpdate]);

  return (
    <div
      className="live-lyrics-preview"
      ref={containerRef}
      style={{ '--dyn-live-sync-gap': `${settings?.liveSyncLineGap ?? 16}px` }}
    >
      {liveParsedLyrics.slice(0, renderedLineCount).map((line, i) => {
        return (
            <LyricLineWrapper
              key={i}
              lineObj={line}
              savedNode={syncList?.[i]}
              nextStart={nextStarts[i]}
              viewMode="live"
              handleLineClick={handleLineClick}
              masterPalette={masterPalette}
              isPlayingCurrentSong={isPlayingCurrentSong}
            />
        )
      })}
    </div>
  );
};

export default LiveLyricsView;