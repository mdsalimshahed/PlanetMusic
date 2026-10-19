import { useEffect } from 'react';

export const usePlayerControls = runtime => {
  const {
    currentTrack, setCurrentTrack, selectedSong, setSelectedSong,
    isSyncWorkspaceActive, globalClock, formatPlayerTime,
    duration, setDuration, isPlaying, ytVideoId, ytPlayerRef, ytPlayerReady,
    syncPlaybackRateRef, bufferingRef, ytPlaybackConfirmedRef,
    audioRef, progressBarRef, currentTimeRef, abortControllerRef,
    setIsPlaying, setBuffering, setPendingSeekValue,
    pendingSeekRef, pendingSeekShouldPlayRef, pendingAutoplayRef,
    clearYouTubePlayTimeout, clearAudioWaitTimeout, seekYouTube,
    emitPlayState, attemptPlay,
    requestYouTubePlay, setHoverTime, volume, setVolume, isMuted,
    setIsMuted, activeSourceRef, audioPlaybackConfirmedRef,
    isCurrentAudioElement, scheduleAudioFallback, triggerFallbackMessage,
    setFailedSources, sourceLoadGenerationRef
  } = runtime;

  const handleLoadedMetadata = () => {
    if (isCurrentAudioElement() && !ytVideoId) {
      const mediaDuration = audioRef.current.duration;
      if (Number.isFinite(mediaDuration)) setDuration(mediaDuration);
      audioRef.current.playbackRate = syncPlaybackRateRef.current;
      if (pendingSeekRef.current !== null) {
        audioRef.current.currentTime = pendingSeekRef.current;
        globalClock.seek(pendingSeekRef.current);
        const shouldPlay = pendingAutoplayRef.current && pendingSeekShouldPlayRef.current;
        pendingSeekShouldPlayRef.current = true;
        if (shouldPlay) attemptPlay();
        else emitPlayState(false, false);
        setPendingSeekValue(null);
      }
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const time = Number(e.target.value);
    globalClock.seek(time);
    
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      seekYouTube(time);
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    }
    
    if (progressBarRef.current) progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
    if (currentTimeRef.current) currentTimeRef.current.innerText = formatPlayerTime(time);
  };

  const handleContainerClick = (e) => {
    if (e.target === progressBarRef.current) return;
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const time = percent * duration;
    
    globalClock.seek(time);
    
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      seekYouTube(time);
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    }
    
    if (progressBarRef.current) {
      progressBarRef.current.value = time;
      progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
    }
    if (currentTimeRef.current) currentTimeRef.current.innerText = formatPlayerTime(time);
  };

  const handleProgressMouseMove = (e) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setHoverTime(percent * duration);
    progressBarRef.current.style.setProperty('--hover-progress', `${percent * 100}%`);
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
    if (progressBarRef.current) progressBarRef.current.style.setProperty('--hover-progress', `0%`);
  };

  const handleVolumeChange = (e) => {
    e.stopPropagation();
    const vol = Number(e.target.value);
    if (vol === 0) {
      setIsMuted(true);
      localStorage.setItem('playerMuted', 'true');
      window.dispatchEvent(new CustomEvent('playerVolumeChange', { detail: { volume, isMuted: true } }));
      return;
    }
    setVolume(vol);
    localStorage.setItem('playerVolume', vol);
    setIsMuted(false);
    localStorage.setItem('playerMuted', 'false');
    window.dispatchEvent(new CustomEvent('playerVolumeChange', { detail: { volume: vol, isMuted: false } }));
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localStorage.setItem('playerMuted', String(nextMuted));
    if (volume > 0) localStorage.setItem('playerVolume', volume);
    window.dispatchEvent(new CustomEvent('playerVolumeChange', { detail: { volume, isMuted: nextMuted } }));
  };

  const closePlayer = (e) => {
    e.stopPropagation();
    clearAudioWaitTimeout();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      try {
        ytPlayerRef.current.stopVideo();
      } catch (error) {
        console.warn('Could not stop YouTube while closing the player:', error);
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentTrack(null);
    pendingAutoplayRef.current = false;
    ytPlaybackConfirmedRef.current = false;
    clearYouTubePlayTimeout();
    setIsPlaying(false);
    setBuffering(false);
    globalClock.pause();
    emitPlayState(false, true);
  };

  const togglePlay = (e) => {
    if (e) e.stopPropagation();
    const shouldPause = isPlaying || pendingAutoplayRef.current;
    if (shouldPause) {
      pendingAutoplayRef.current = false;
      ytPlaybackConfirmedRef.current = false;
      clearYouTubePlayTimeout();
      clearAudioWaitTimeout();
      if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (error) {
          console.warn('Could not pause YouTube playback:', error);
        }
      } else if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      setBuffering(false);
      setIsPlaying(false);
      emitPlayState(false, false);
      return;
    }

    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      try {
        requestYouTubePlay(ytPlayerRef.current);
      } catch (error) {
        console.warn('Could not request YouTube playback:', error);
      }
    } else if (ytVideoId) {
      requestYouTubePlay();
    } else if (audioRef.current) attemptPlay();
    else pendingAutoplayRef.current = true;
  };

  useEffect(() => {
    if (!isSyncWorkspaceActive) return undefined;

    const isCurrentSyncTrack = (trackId) => (
      trackId == null ||
      (currentTrack?.trackId != null && String(trackId) === String(currentTrack.trackId))
    );

    const seekTo = (time) => {
      if (!Number.isFinite(time) || time < 0) return;
      globalClock.seek(time);
      pendingSeekShouldPlayRef.current = false;

      if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
        seekYouTube(time);
        setPendingSeekValue(null);
      } else if (!ytVideoId && audioRef.current?.readyState > 0) {
        audioRef.current.currentTime = time;
        setPendingSeekValue(null);
      } else {
        setPendingSeekValue(time);
      }
    };

    const pausePlayback = () => {
      pendingAutoplayRef.current = false;
      ytPlaybackConfirmedRef.current = false;
      clearYouTubePlayTimeout();
      clearAudioWaitTimeout();
      setBuffering(false);
      if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (error) {
          console.warn('Could not pause YouTube playback for a sync command:', error);
        }
      } else if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      emitPlayState(false, false);
    };

    const handlePlayerCommand = (event) => {
      const { type, trackId, time, rate } = event.detail || {};
      if (!isCurrentSyncTrack(trackId)) return;

      if (type === 'toggle') {
        togglePlay();
      } else if (type === 'seek') {
        seekTo(Number(time));
      } else if (type === 'pause') {
        pausePlayback();
      } else if (type === 'pauseSeek') {
        pausePlayback();
        seekTo(Number(time));
      } else if (type === 'rate' && Number.isFinite(Number(rate)) && Number(rate) > 0) {
        const nextRate = Number(rate);
        syncPlaybackRateRef.current = nextRate;
        globalClock.setRate(nextRate);
        if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
          try {
            ytPlayerRef.current.setPlaybackRate(nextRate);
          } catch (error) {
            console.warn('Could not set YouTube playback rate:', error);
          }
        } else if (audioRef.current) {
          audioRef.current.playbackRate = nextRate;
        }
      }
    };

    window.addEventListener('globalPlayerCommand', handlePlayerCommand);
    return () => window.removeEventListener('globalPlayerCommand', handlePlayerCommand);
  }, [
    isSyncWorkspaceActive, currentTrack, isPlaying, ytVideoId, ytPlayerReady,
    togglePlay, audioRef, clearAudioWaitTimeout, clearYouTubePlayTimeout,
    emitPlayState, globalClock, pendingAutoplayRef, pendingSeekShouldPlayRef,
    seekYouTube, setBuffering, setIsPlaying, setPendingSeekValue,
    syncPlaybackRateRef, ytPlaybackConfirmedRef, ytPlayerRef
  ]);

  const openModal = () => {
    if (currentTrack && setSelectedSong) {
      if (selectedSong && String(selectedSong.trackId) === String(currentTrack.trackId)) {
        return; 
      }
      setSelectedSong(currentTrack, { skipLiveEntrance: true });
    }
  };

  const handleAudioEnded = () => {
    if (!isCurrentAudioElement() || !audioRef.current.ended) return;
    clearAudioWaitTimeout();
    audioPlaybackConfirmedRef.current = false;
    pendingAutoplayRef.current = false;
    setBuffering(false);
    setIsPlaying(false);
    emitPlayState(false, true);
    window.dispatchEvent(new CustomEvent('globalTrackEnded', {
      detail: { trackId: currentTrack?.trackId ?? null }
    }));
  };
  const handleAudioPlay = () => {
    if (!isCurrentAudioElement() || audioRef.current.paused) return;
    if (!pendingAutoplayRef.current) {
      audioRef.current?.pause();
    }
  };
  const handleAudioPlaying = () => {
    if (!isCurrentAudioElement() || audioRef.current.paused) return;
    if (!pendingAutoplayRef.current) {
      audioRef.current?.pause();
      return;
    }
    clearAudioWaitTimeout();
    if (audioPlaybackConfirmedRef.current && !bufferingRef.current) return;
    audioPlaybackConfirmedRef.current = true;
    setBuffering(false);
    const audioTime = audioRef.current.currentTime;
    if (Number.isFinite(audioTime)) globalClock.updateAnchor(audioTime, true);
    setIsPlaying(true);
    emitPlayState(true, false);
  };
  const handleAudioWaiting = () => {
    if (
      !isCurrentAudioElement() ||
      audioRef.current.paused ||
      audioRef.current.seeking ||
      !pendingAutoplayRef.current
    ) return;
    audioPlaybackConfirmedRef.current = false;
    setBuffering(true);
    const audioTime = audioRef.current.currentTime;
    if (Number.isFinite(audioTime)) globalClock.updateAnchor(audioTime, true);
    setIsPlaying(false);
    emitPlayState(false, false);
    scheduleAudioFallback();
  };
  const handleAudioError = (event) => {
    if (!isCurrentAudioElement()) return;
    clearAudioWaitTimeout();
    const failedSource = activeSourceRef.current;
    if (!failedSource) return;
    sourceLoadGenerationRef.current += 1;
    activeSourceRef.current = null;
    console.error('Audio source failed:', event.currentTarget.error);
    audioPlaybackConfirmedRef.current = false;
    setBuffering(false);
    setIsPlaying(false);
    globalClock.pause();
    emitPlayState(false, false);
    triggerFallbackMessage('Audio source failed. Falling back...');
    setFailedSources(previous => previous.includes(failedSource)
      ? previous
      : [...previous, failedSource]);
  };
  const handleAudioPause = () => {
    if (!isCurrentAudioElement() || !audioRef.current.paused || pendingAutoplayRef.current) return;
    clearAudioWaitTimeout();
    audioPlaybackConfirmedRef.current = false;
    setBuffering(false);
    const audioTime = audioRef.current.currentTime;
    if (Number.isFinite(audioTime)) globalClock.updateAnchor(audioTime, true);
    setIsPlaying(false);
    emitPlayState(false, false);
  };
  const handleAudioContextMenu = (e) => e.preventDefault();

  return {
    handleLoadedMetadata,
    handleSeek,
    handleContainerClick,
    handleProgressMouseMove,
    handleProgressMouseLeave,
    handleVolumeChange,
    toggleMute,
    closePlayer,
    togglePlay,
    openModal,
    handleAudioEnded,
    handleAudioPlay,
    handleAudioPlaying,
    handleAudioWaiting,
    handleAudioError,
    handleAudioPause,
    handleAudioContextMenu
  };
};
