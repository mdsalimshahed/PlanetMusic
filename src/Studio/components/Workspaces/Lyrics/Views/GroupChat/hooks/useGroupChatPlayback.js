import { useEffect, useRef, useState } from 'react';
import { getGroupChatState, getActiveChatLines } from '../groupChatTimelineState.js';

const useGroupChatPlayback = ({
  timeline,
  isPlayingCurrentSong,
  lyricsPlaybackOffsetSeconds,
  setExpandedLineIndices,
  pendingScrollToLatestRef,
  pendingScrollBehaviorRef
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
  const [displayTypingNames, setDisplayTypingNames] = useState('');
  const [typingIndicatorVisible, setTypingIndicatorVisible] = useState(false);
  const chatState = getGroupChatState(timeline, playbackTime);
  const activeLineIndices = new Set(
    isPlayingCurrentSong
      ? getActiveChatLines(timeline, playbackTime).map(line => line.index)
      : []
  );

  useEffect(() => {
    let endedTimer = null;
    const updateTime = rawTime => {
      const time = Number.isFinite(rawTime) ? rawTime - lyricsPlaybackOffsetSeconds : 0;
      const nextTime = isPlayingCurrentSong ? Math.max(0, time) : 0;
      const previousTime = playbackTimeRef.current;
      const crossedEvents = nextTime > previousTime
        ? timeline.events.filter(event => event.time > previousTime && event.time <= nextTime)
        : [];
      const hasPresenceChanges = crossedEvents.some(
        event => event.type === 'join' || event.type === 'leave'
      );
      const hasMessageEvents = crossedEvents.some(event => event.type === 'message');
      const nextTypingNames = getGroupChatState(timeline, nextTime).typingArtists.join(', ');
      const typingChanged = nextTypingNames !== typingNamesRef.current;
      typingNamesRef.current = nextTypingNames;

      if (nextTypingNames) {
        if (typingExitTimerRef.current) {
          clearTimeout(typingExitTimerRef.current);
          typingExitTimerRef.current = null;
        }
        if (typingChanged || !typingVisibleRef.current) {
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
        }, 260);
      }

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
        pendingScrollBehaviorRef.current = hasMessageEvents ? 'smooth' : 'auto';
      }
      playbackTimeRef.current = nextTime;
      setPlaybackTime(nextTime);
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
      const finalOfflineTime = Math.max(endedAt, ...timeline.artists.map(artist => artist.offlineAt));
      if (finalOfflineTime > endedAt) {
        endedTimer = setTimeout(
          () => setPlaybackTime(finalOfflineTime),
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
      window.removeEventListener('globalTimeUpdate', handleTimeUpdate);
      window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [
    isPlayingCurrentSong,
    lyricsPlaybackOffsetSeconds,
    pendingScrollBehaviorRef,
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
