/* --- src/components/Workspaces/Lyrics/Views/LiveLyricsView.jsx --- */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LyricLineWrapper } from '../LyricsLineRenderer.jsx';
import { buildAdlibTimeline, findAdlibBoundaryCursor, updateAdlibStateAtTime } from '../../../../utils/adlibTimeline.js';
import './LiveLyricsView.css';

const estimateLineHeight = (line, syncNode) => {
  const text = `${line?.text || ''}${syncNode?.translation || ''}${syncNode?.pronunciation || ''}`;
  const estimatedWrappedRows = Math.max(1, Math.ceil(text.length / 32));
  const extraAdlibRows = syncNode?.adlibs?.length ? 1 : 0;
  return (estimatedWrappedRows + extraAdlibRows) * 46;
};

const VirtualLiveLyricLine = memo(({
  line,
  lineIndex,
  syncNode,
  nextStart,
  root,
  isActive,
  onVisibilityChange,
  ...lineProps
}) => {
  const itemRef = useRef(null);
  const visibilityRef = useRef(false);
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined');
  const [measuredHeight, setMeasuredHeight] = useState(() => estimateLineHeight(line, syncNode));

  useLayoutEffect(() => {
    itemRef.current?.querySelector('.lyric-line-wrapper')?.classList.toggle('active', isActive);
  }, [isActive, isVisible]);

  useEffect(() => {
    const item = itemRef.current;
    if (!item) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      if (visibilityRef.current === visible) return;
      visibilityRef.current = visible;
      setIsVisible(visible);
      onVisibilityChange();
    }, { root, rootMargin: '500px 0px' });
    observer.observe(item);
    return () => observer.disconnect();
  }, [root, onVisibilityChange]);

  useEffect(() => {
    if (!isVisible && !isActive) return undefined;
    const item = itemRef.current;
    const lineNode = item?.querySelector('.lyric-line-wrapper');
    if (!lineNode || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height;
      if (height > 0) {
        setMeasuredHeight(current => Math.abs(current - height) > 1 ? height : current);
      }
    });
    observer.observe(lineNode);
    return () => observer.disconnect();
  }, [isVisible, isActive]);

  return (
    <div
      className="live-lyric-virtual-item"
      data-live-line-index={lineIndex}
      ref={itemRef}
      style={{ minHeight: `${measuredHeight}px` }}
    >
      {(isVisible || isActive) && (
        <LyricLineWrapper
          {...lineProps}
          lineObj={line}
          savedNode={syncNode}
          nextStart={nextStart}
        />
      )}
    </div>
  );
});

const LiveLyricsView = ({ liveParsedLyrics, selectedSong, masterPalette, isPlayingCurrentSong, isPlaying, handleLineClick, settings, currentTrack, lyricsPlaybackOffsetSeconds = 0 }) => {
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [visibleLineVersion, setVisibleLineVersion] = useState(0);
  const containerRef = useRef(null);
  const [containerNode, setContainerNode] = useState(null);
  const setContainer = useCallback(node => {
    containerRef.current = node;
    setContainerNode(node);
  }, []);
    const initialRevealTrackRef = useRef(null);
  const cachedLinesRef = useRef([]);
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
    const onVisibilityChange = useCallback(() => {
      setVisibleLineVersion(version => version + 1);
    }, []);

    const timedLines = useMemo(() => (syncList || [])
      .map((line, index) => ({
        index,
        start: parseFloat(line?.start),
        end: parseFloat(line?.end),
        nextStart: parseFloat(nextStarts[index])
      }))
      .filter(line => !isNaN(line.start))
      .sort((first, second) => first.start - second.start), [syncList, nextStarts]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const trackId = selectedSong?.trackId;
        if (!container || trackId == null || initialRevealTrackRef.current === trackId) return;
        if (isPlayingCurrentSong && isPlaying) {
            initialRevealTrackRef.current = trackId;
            return;
        }
        if (settings?.disableAnimations || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            initialRevealTrackRef.current = trackId;
            return;
        }

        const containerBounds = container.getBoundingClientRect();
        const visibleLines = Array.from(container.querySelectorAll('.lyric-line-wrapper')).filter(node => {
            const bounds = node.getBoundingClientRect();
            return bounds.height > 0 && bounds.bottom > containerBounds.top && bounds.top < containerBounds.bottom;
        });
        if (visibleLines.length === 0) return;

        visibleLines.forEach(node => node.classList.add('is-preparing-reveal'));
        let revealFrame = null;
        let cancelled = false;
        revealFrame = window.requestAnimationFrame(() => {
            revealFrame = null;
            if (cancelled) return;

            initialRevealTrackRef.current = trackId;
            visibleLines.forEach((node, index) => {
                if (!node.isConnected) return;
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
            visibleLines.forEach(node => node.classList.remove('is-preparing-reveal'));
        };
    }, [liveParsedLyrics, selectedSong?.trackId, settings?.disableAnimations, isPlayingCurrentSong, isPlaying, visibleLineVersion]);

  const handleTimeUpdate = useCallback((time) => {
    if (!isPlayingCurrentSong) return;
    
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
        setActiveLineIndex(newActiveIndex);
        if (pendingActiveFrameRef.current !== null) {
            window.cancelAnimationFrame(pendingActiveFrameRef.current);
            pendingActiveFrameRef.current = null;
        }
        pendingActiveNodeRef.current?.classList.remove('is-preparing-active');
        pendingActiveNodeRef.current = null;

        if (newActiveIndex !== -1) {
            const item = cachedLinesRef.current.find(line => line.index === newActiveIndex);
            const node = item?.node;
            if (node) {
              pendingActiveNodeRef.current = node;
              node.classList.add('is-preparing-active');
            }
            pendingActiveFrameRef.current = window.requestAnimationFrame(() => {
                pendingActiveFrameRef.current = null;
                if (activeLineIndexRef.current !== newActiveIndex) return;

                cachedLinesRef.current.forEach(line => {
                    if (line.index !== newActiveIndex && line.isActive) {
                        line.node.classList.remove('active');
                        line.isActive = false;
                    }
                });
                const activeNode = containerRef.current?.querySelector(
                  `[data-live-line-index="${newActiveIndex}"] .lyric-line-wrapper`
                );
                activeNode?.classList.remove('is-preparing-active');
                activeNode?.classList.add('active');
                const activeItem = cachedLinesRef.current.find(line => line.index === newActiveIndex);
                if (activeItem) activeItem.isActive = true;
                pendingActiveNodeRef.current = null;

                if (containerRef.current) {
                    const target = containerRef.current.querySelector(
                      `[data-live-line-index="${newActiveIndex}"]`
                    );
                    if (!target) return;
                    const offsetTop = target.offsetTop;
                    const scrollPos = offsetTop - (containerRef.current.clientHeight / 2) + (target.clientHeight / 2);
                    containerRef.current.scrollTo({
                       top: scrollPos,
                       behavior: settings?.disableAnimations ? 'auto' : 'smooth'
                    });
                }
            });
        } else if (previousActiveIndex !== -1) {
            cachedLinesRef.current.forEach(line => {
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
        cachedAdlibsRef.current.forEach(item => {
          if (item.node.isConnected) updateAdlibStateAtTime(item, time);
        });
        adlibCursorRef.current = findAdlibBoundaryCursor(adlibTimeline, time);
    } else {
        while (adlibCursorRef.current < adlibTimeline.length && adlibTimeline[adlibCursorRef.current].time <= time) {
            const item = adlibTimeline[adlibCursorRef.current].item;
            if (item.node.isConnected) updateAdlibStateAtTime(item, time);
            adlibCursorRef.current++;
        }
    }
    lastAdlibTimeRef.current = time;
  }, [isPlayingCurrentSong, settings?.disableAnimations, timedLines]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        cachedLinesRef.current = Array.from(containerRef.current.querySelectorAll('.lyric-line-wrapper')).map(node => ({
            node,
            index: parseInt(node.closest('[data-live-line-index]')?.dataset.liveLineIndex, 10),
            start: parseFloat(node.dataset.start),
            end: parseFloat(node.dataset.end),
            nextStart: parseFloat(node.dataset.nextStart),
            isActive: node.classList.contains('active')
        }));

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
  }, [liveParsedLyrics, selectedSong?.syncData, lyricsPlaybackOffsetSeconds, visibleLineVersion, activeLineIndex, isPlayingCurrentSong, handleTimeUpdate]);

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
        setActiveLineIndex(-1);
    };

    const clearAllActive = () => {
        clearActiveLines();
        cachedAdlibsRef.current.forEach(item => {
            if (item.node.isConnected && item.state !== 'hidden') {
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
      ref={setContainer}
      style={{ '--dyn-live-sync-gap': `${settings?.liveSyncLineGap ?? 16}px` }}
    >
      {liveParsedLyrics.map((line, index) => (
        <VirtualLiveLyricLine
          key={`${selectedSong?.trackId ?? 'track'}-${index}`}
          line={line}
          lineIndex={index}
          syncNode={syncList?.[index]}
          nextStart={nextStarts[index]}
          root={containerNode}
          isActive={activeLineIndex === index}
          onVisibilityChange={onVisibilityChange}
          viewMode="live"
          handleLineClick={handleLineClick}
          masterPalette={masterPalette}
          isPlayingCurrentSong={isPlayingCurrentSong}
        />
      ))}
    </div>
  );
};

export default LiveLyricsView;