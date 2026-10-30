import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getGroupChatEventEndIndex,
  getGroupChatState,
  getActiveChatLines
} from '../groupChatTimelineState.js';

const TYPING_INDICATOR_UPDATE_MS = 500;
const TYPING_INDICATOR_EXIT_MS = 260;

const useGroupChatPlayback = ({
  timeline,
  isPlayingCurrentSong,
  lyricsPlaybackOffsetSeconds,
  setExpandedLineIndices,
  pendingScrollToLatestRef
}) => {
  const [playbackEnded, setPlaybackEnded] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(() => (
    isPlayingCurrentSong
      ? Math.max(0, (window.currentAudioTime || 0) - lyricsPlaybackOffsetSeconds)
      : 0
  ));
  const playbackTimeRef = useRef(playbackTime);
  const typingNamesRef = useRef('');
  const displayTypingNamesRef = useRef('');
  const typingVisibleRef = useRef(false);
  const typingExitTimerRef = useRef(null);
  const typingUpdateTimerRef = useRef(null);
  const pendingTypingNamesRef = useRef(null);
  const lastTypingUpdateAtRef = useRef(null);
  const [displayTypingNames, setDisplayTypingNames] = useState('');
  const [typingIndicatorVisible, setTypingIndicatorVisible] = useState(false);
  const visibleEventEndIndex = getGroupChatEventEndIndex(timeline, playbackTime);
  const visibleEvents = useMemo(
    () => timeline.events.slice(0, visibleEventEndIndex),
    [timeline, visibleEventEndIndex]
  );
  const chatState = useMemo(
    () => getGroupChatState(timeline, playbackTime, visibleEvents),
    [playbackTime, timeline, visibleEvents]
  );
  const activeLineIndices = useMemo(() => new Set(
    isPlayingCurrentSong
      ? getActiveChatLines(timeline, playbackTime).map(line => line.index)
      : []
  ), [isPlayingCurrentSong, timeline, playbackTime]);

  useEffect(() => {
    let endedTimer = null;
    const applyTypingNames = nextTypingNames => {
      if (nextTypingNames) {
        if (typingExitTimerRef.current) {
          clearTimeout(typingExitTimerRef.current);
          typingExitTimerRef.current = null;
        }
        if (
          nextTypingNames !== displayTypingNamesRef.current ||
          !typingVisibleRef.current
        ) {
          displayTypingNamesRef.current = nextTypingNames;
          setDisplayTypingNames(nextTypingNames);
          typingVisibleRef.current = true;
          setTypingIndicatorVisible(true);
        }
      } else if (displayTypingNamesRef.current && typingVisibleRef.current) {
        typingVisibleRef.current = false;
        setTypingIndicatorVisible(false);
        if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
        typingExitTimerRef.current = setTimeout(() => {
          displayTypingNamesRef.current = '';
          setDisplayTypingNames('');
          typingExitTimerRef.current = null;
        }, TYPING_INDICATOR_EXIT_MS);
      }
    };
    const updateTypingNames = nextTypingNames => {
      if (nextTypingNames === typingNamesRef.current) return;
      typingNamesRef.current = nextTypingNames;
      pendingTypingNamesRef.current = nextTypingNames;

      const now = performance.now();
      const elapsed = lastTypingUpdateAtRef.current == null
        ? TYPING_INDICATOR_UPDATE_MS
        : now - lastTypingUpdateAtRef.current;
      if (elapsed >= TYPING_INDICATOR_UPDATE_MS) {
        if (typingUpdateTimerRef.current) {
          clearTimeout(typingUpdateTimerRef.current);
          typingUpdateTimerRef.current = null;
        }
        const pendingNames = pendingTypingNamesRef.current;
        pendingTypingNamesRef.current = null;
        lastTypingUpdateAtRef.current = now;
        applyTypingNames(pendingNames);
        return;
      }

      if (typingUpdateTimerRef.current) return;
      typingUpdateTimerRef.current = setTimeout(() => {
        typingUpdateTimerRef.current = null;
        const pendingNames = pendingTypingNamesRef.current;
        pendingTypingNamesRef.current = null;
        lastTypingUpdateAtRef.current = performance.now();
        applyTypingNames(pendingNames);
      }, TYPING_INDICATOR_UPDATE_MS - elapsed);
    };

    const updateTime = rawTime => {
      const time = Number.isFinite(rawTime) ? rawTime - lyricsPlaybackOffsetSeconds : 0;
      const nextTime = isPlayingCurrentSong ? Math.max(0, time) : 0;
      const previousTime = playbackTimeRef.current;
      const previousEventIndex = getGroupChatEventEndIndex(timeline, previousTime);
      const nextEventIndex = getGroupChatEventEndIndex(timeline, nextTime);
      const crossedEvents = nextTime > previousTime && nextEventIndex > previousEventIndex
        ? timeline.events.slice(previousEventIndex, nextEventIndex)
        : [];
      const hasPresenceChanges = crossedEvents.some(
        event => event.type === 'join' || event.type === 'leave'
      );
      const hasMessageEvents = crossedEvents.some(event => event.type === 'message');
      const nextTypingNames = getGroupChatState(timeline, nextTime).typingArtists.join(', ');
      updateTypingNames(nextTypingNames);

      const activeIndices = getActiveChatLines(timeline, nextTime).map(line => String(line.index));
      if (activeIndices.length) {
        setExpandedLineIndices(current => {
          const next = new Set(current);
          activeIndices.forEach(index => next.add(index));
          return next.size === current.size ? current : next;
        });
      }
      if (hasMessageEvents || hasPresenceChanges) {
        pendingScrollToLatestRef.current = true;
      }
      playbackTimeRef.current = nextTime;
      if (
        crossedEvents.length ||
        Math.floor(nextTime * 10) !== Math.floor(previousTime * 10)
      ) {
        setPlaybackTime(nextTime);
      }
    };

    const handleTimeUpdate = event => {
      if (endedTimer) clearTimeout(endedTimer);
      updateTime(event.detail);
    };
    const handlePlayState = event => {
      if (!event.detail?.isEnded || !isPlayingCurrentSong) {
        setPlaybackEnded(false);
        setExpandedLineIndices(current => {
          const activeIndices = getActiveChatLines(
            timeline,
            Math.max(0, (window.currentAudioTime || 0) - lyricsPlaybackOffsetSeconds)
          ).map(line => String(line.index));
          if (!activeIndices.length) return current;
          const next = new Set(current);
          activeIndices.forEach(index => next.add(index));
          return next.size === current.size ? current : next;
        });
        if (endedTimer) clearTimeout(endedTimer);
        if (!isPlayingCurrentSong) setPlaybackTime(0);
        return;
      }

      pendingScrollToLatestRef.current = true;
      setPlaybackEnded(true);
      setExpandedLineIndices(new Set());
      const endedAt = Math.max(0, (window.currentAudioTime || 0) - lyricsPlaybackOffsetSeconds);
      updateTime(window.currentAudioTime || 0);
      const finalOfflineTime = Math.max(
        endedAt,
        ...timeline.artists.map(artist =>
          artist.notificationOfflineAt ?? artist.offlineAt
        )
      );
      if (finalOfflineTime > endedAt) {
        endedTimer = setTimeout(
          () => {
            pendingScrollToLatestRef.current = true;
            setPlaybackTime(finalOfflineTime);
          },
          (finalOfflineTime - endedAt) * 1000
        );
      }
    };

    window.addEventListener('globalTimeUpdate', handleTimeUpdate);
    window.addEventListener('globalPlayState', handlePlayState);
    updateTime(window.currentAudioTime || 0);
    return () => {
      if (endedTimer) clearTimeout(endedTimer);
      if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
      if (typingUpdateTimerRef.current) clearTimeout(typingUpdateTimerRef.current);
      window.removeEventListener('globalTimeUpdate', handleTimeUpdate);
      window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [
    isPlayingCurrentSong,
    lyricsPlaybackOffsetSeconds,
    pendingScrollToLatestRef,
    setExpandedLineIndices,
    timeline
  ]);

  return {
    chatState,
    activeLineIndices,
    displayTypingNames,
    playbackEnded,
    playbackTime,
    typingIndicatorVisible
  };
};

export default useGroupChatPlayback;
