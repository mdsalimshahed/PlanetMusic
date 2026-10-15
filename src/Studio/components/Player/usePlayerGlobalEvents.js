import { useEffect } from 'react';

export const isSameTrackSourceForSeek = (currentTrack, requestedTrack, activeSource) => Boolean(
  currentTrack &&
  requestedTrack &&
  currentTrack.trackId != null &&
  requestedTrack.trackId != null &&
  String(currentTrack.trackId) === String(requestedTrack.trackId) &&
  (!requestedTrack.forceSource || activeSource === requestedTrack.forceSource)
);

export const usePlayerGlobalEvents = (runtime, handlers) => {
  const {
    currentTrack, setCurrentTrack, isPlaying, ytVideoId, ytPlayerReady,
    sourceLoadGenerationRef, clearYouTubePlayTimeout, clearAudioWaitTimeout,
    abortControllerRef, audioRef, deezerObjectUrlRef, ytPlayerRef, setBuffering,
    setIsPlaying, setAudioSrc, setYtVideoId, setActiveSource, activeSourceRef,
    globalClock, emitPlayState, pendingSeekShouldPlayRef, setPendingSeekValue,
    bufferingRef, pendingAutoplayRef,
    seekYouTube, requestYouTubePlay, attemptPlay, volume, setVolume, isMuted,
    setIsMuted, duration
  } = runtime;
  const { togglePlay } = handlers;

  useEffect(() => {
    const handleSeekRequest = (e) => {
      const { time, track } = e.detail;
      
      const hasSameTrack = isSameTrackSourceForSeek(
        currentTrack,
        track,
        activeSourceRef.current
      );

      if (!hasSameTrack) {
        sourceLoadGenerationRef.current += 1;
        clearYouTubePlayTimeout();
        clearAudioWaitTimeout();
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        if (deezerObjectUrlRef.current) {
          URL.revokeObjectURL(deezerObjectUrlRef.current);
          deezerObjectUrlRef.current = null;
        }
        if (ytPlayerRef.current && ytPlayerReady) {
          try {
            ytPlayerRef.current.stopVideo();
          } catch (error) {
            console.warn('Could not stop YouTube before switching tracks:', error);
          }
        }
        setBuffering(true);
        setIsPlaying(false);
        setAudioSrc(undefined);
        setYtVideoId(null);
        setActiveSource(null);
        activeSourceRef.current = null;
        globalClock.pause();
        globalClock.seek(0);
        emitPlayState(false, false);
        setCurrentTrack({ ...track, playId: Date.now() });
        pendingSeekShouldPlayRef.current = true;
        setPendingSeekValue(time);
      } else {
        if (time !== null) {
          const canSeekCurrentSource = ytVideoId
            ? Boolean(ytPlayerRef.current && ytPlayerReady)
            : Boolean(audioRef.current && audioRef.current.readyState > 0);
          if (bufferingRef.current && !canSeekCurrentSource) {
            pendingAutoplayRef.current = true;
            pendingSeekShouldPlayRef.current = true;
            setPendingSeekValue(time);
            return;
          }
          pendingAutoplayRef.current = true;
          pendingSeekShouldPlayRef.current = true;
          globalClock.seek(time);
          if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
            seekYouTube(time);
            if (!isPlaying) requestYouTubePlay(ytPlayerRef.current);
          } else if (audioRef.current) {
            audioRef.current.currentTime = time;
            if (!isPlaying) attemptPlay();
          }
        }
      }
    };
    
    window.addEventListener('globalSeekRequest', handleSeekRequest);
    return () => window.removeEventListener('globalSeekRequest', handleSeekRequest);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, isPlaying, ytVideoId, ytPlayerReady, setCurrentTrack]);

  useEffect(() => {
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      try {
        ytPlayerRef.current.setVolume((isMuted ? 0 : volume) * 100);
      } catch (error) {
        console.warn('Could not update YouTube volume:', error);
      }
    } else if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, ytVideoId, ytPlayerReady, audioRef, ytPlayerRef]);

  useEffect(() => {
    const handleSharedVolumeChange = (event) => {
      const nextVolume = Number(event.detail?.volume);
      if (Number.isFinite(nextVolume) && nextVolume > 0) setVolume(nextVolume);
      if (typeof event.detail?.isMuted === 'boolean') setIsMuted(event.detail.isMuted);
    };
    window.addEventListener('playerVolumeChange', handleSharedVolumeChange);
    return () => window.removeEventListener('playerVolumeChange', handleSharedVolumeChange);
  }, [setIsMuted, setVolume]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (!currentTrack) return;
      if (document.querySelector('.sync-mode-container')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const cur = window.currentAudioTime || 0;
        const newTime = Math.max(0, cur - 5);
        globalClock.seek(newTime);
        if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
          seekYouTube(newTime);
        } else if (audioRef.current) {
          audioRef.current.currentTime = newTime;
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const cur = window.currentAudioTime || 0;
        const maxTime = duration || 100;
        const newTime = Math.min(maxTime, cur + 5);
        globalClock.seek(newTime);
        if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
          seekYouTube(newTime);
        } else if (audioRef.current) {
          audioRef.current.currentTime = newTime;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, duration, currentTrack, ytVideoId, ytPlayerReady, audioRef, ytPlayerRef]);
};
