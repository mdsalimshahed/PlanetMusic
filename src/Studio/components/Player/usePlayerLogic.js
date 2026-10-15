/* --- src/Studio/components/Player/usePlayerLogic.js --- */
import { useEffect } from 'react';
import { globalClock } from '../../utils/clockEngine.js';
import { loadYouTubeIframeApi } from './youtubeIframeApi.js';
import { usePlayerState } from './usePlayerState.js';
import { usePlayerControls } from './usePlayerControls.js';
import { usePlayerArtwork } from './usePlayerArtwork.js';
import { usePlayerSourceLifecycle } from './usePlayerSourceLifecycle.js';
import { useYouTubePlayer } from './useYouTubePlayer.js';
import { usePlayerClockSync } from './usePlayerClockSync.js';
import { usePlayerGlobalEvents } from './usePlayerGlobalEvents.js';

const YOUTUBE_START_TIMEOUT_MS = 5000;

export const usePlayerLogic = ({ currentTrack, setCurrentTrack, selectedSong, setSelectedSong, settings, isSyncWorkspaceActive = false, isZenMode = false }) => {
  const playerState = usePlayerState({ currentTrack, selectedSong, isSyncWorkspaceActive });
  const {
    audioRef, audioSrcRef, ytPlayerRef, ytPlaybackConfirmedRef, ytPendingSeekRef,
    ytSeekWasPlayingRef, ytPlayTimeoutRef, ytSeekBufferTimeoutRef,
    audioWaitTimeoutRef, audioCtxRef, analyserRef, sourceRef, progressBarRef,
    currentTimeRef, activeSourceRef, fallbackTimerRef, lastPolledTimeRef,
    lastSyncTimeRef, sourceLoadGenerationRef, bufferingRef, deezerObjectUrlRef,
    audioCacheRef, pendingAutoplayRef, ytHasPlayedRef, setFailedSources,
    abortControllerRef, isPlaying, setIsPlaying, isBuffering,
    setIsBuffering, duration, audioSrc, ytVideoId, ytPlayerReady, activeSource,
    accentColor, setAccentColor, accentArtworkUrl, setAccentArtworkUrl,
    hoverTime, fallbackMessage, setFallbackMessage, deezerStatus, volume,
    isMuted, isStacked, slotNode
  } = playerState;
  const MAX_CACHE_SIZE = 5;

  useEffect(() => {
    globalClock.setEventName('globalTimeUpdate');
  }, []);

  useEffect(() => {
    const audioElement = audioRef.current;
    const audioCache = audioCacheRef.current;
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      clearAudioWaitTimeout();
      globalClock.pause();
      audioElement?.pause();
      if (deezerObjectUrlRef.current) URL.revokeObjectURL(deezerObjectUrlRef.current);
      audioCache.forEach(url => URL.revokeObjectURL(url));
      audioCache.clear();
    };
  }, []);


  const emitPlayState = (playing, ended = false) => {
    window.globalIsAudioPlaying = playing; // <-- FIX: Persist play state globally for components mounting later
    if (playing) {
      if (!globalClock.isPlaying) {
        const startTime = globalClock.getCurrentTime();
        globalClock.start(startTime);
        lastPolledTimeRef.current = startTime;
        lastSyncTimeRef.current = performance.now();
      }
    } else {
      globalClock.pause();
    }
    window.dispatchEvent(new CustomEvent('globalPlayState', {
      detail: { trackId: currentTrack?.trackId ?? null, isPlaying: playing, isEnded: ended }
    }));
  };

  const setBuffering = (buffering) => {
    bufferingRef.current = buffering;
    setIsBuffering(buffering);
  };

  const isCurrentAudioElement = () => {
    const audio = audioRef.current;
    const expectedSrc = audioSrcRef.current;
    if (!audio || !expectedSrc || !activeSourceRef.current || activeSourceRef.current === 'youtube') {
      return false;
    }
    return Boolean(
      audio.src === new URL(expectedSrc, document.baseURI).href
    );
  };

  const seekYouTube = (time, player = ytPlayerRef.current) => {
    if (!player || !Number.isFinite(time) || time < 0) return false;
    const wasPlaying = ytPlaybackConfirmedRef.current;
    ytPendingSeekRef.current = time;
    ytSeekWasPlayingRef.current = wasPlaying;
    try {
      player.seekTo(time, true);
      clearYouTubeSeekBufferTimeout();
      if (wasPlaying) {
        ytSeekBufferTimeoutRef.current = setTimeout(() => {
          ytSeekBufferTimeoutRef.current = null;
          if (!ytSeekWasPlayingRef.current) return;
          try {
            if (player.getPlayerState() !== window.YT.PlayerState.BUFFERING) return;
          } catch (error) {
            console.warn('Could not check YouTube state after seeking:', error);
          }
          ytSeekWasPlayingRef.current = false;
          setBuffering(true);
          ytPlaybackConfirmedRef.current = false;
          setIsPlaying(false);
          emitPlayState(false, false);
          scheduleYouTubeFallback();
        }, 1200);
      }
      return true;
    } catch (error) {
      ytPendingSeekRef.current = null;
      ytSeekWasPlayingRef.current = false;
      clearYouTubeSeekBufferTimeout();
      console.warn('YouTube seek failed:', error);
      return false;
    }
  };

  const clearYouTubePlayTimeout = () => {
    if (ytPlayTimeoutRef.current !== null) {
      clearTimeout(ytPlayTimeoutRef.current);
      ytPlayTimeoutRef.current = null;
    }
  };

  const clearYouTubeSeekBufferTimeout = () => {
    if (ytSeekBufferTimeoutRef.current !== null) {
      clearTimeout(ytSeekBufferTimeoutRef.current);
      ytSeekBufferTimeoutRef.current = null;
    }
  };

  function clearAudioWaitTimeout() {
    if (audioWaitTimeoutRef.current !== null) {
      clearTimeout(audioWaitTimeoutRef.current);
      audioWaitTimeoutRef.current = null;
    }
  }

  const triggerFallbackMessage = (msg) => {
    setFallbackMessage(msg);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setFallbackMessage(''), 4000);
  };

  const scheduleYouTubeFallback = () => {
    if (ytPlayTimeoutRef.current !== null) return;
    clearYouTubePlayTimeout();
    const generation = sourceLoadGenerationRef.current;
    ytPlayTimeoutRef.current = setTimeout(() => {
      ytPlayTimeoutRef.current = null;
      if (
        generation !== sourceLoadGenerationRef.current ||
        !pendingAutoplayRef.current ||
        ytPlaybackConfirmedRef.current
      ) return;
      setBuffering(false);
      setIsPlaying(false);
      if (!ytHasPlayedRef.current) {
        pendingAutoplayRef.current = false;
        triggerFallbackMessage('Click play to start YouTube playback.');
        return;
      }
      sourceLoadGenerationRef.current += 1;
      triggerFallbackMessage('YouTube did not start in time. Falling back...');
      setFailedSources(previous => previous.includes('youtube')
        ? previous
        : [...previous, 'youtube']);
    }, YOUTUBE_START_TIMEOUT_MS);
  };

  const scheduleAudioFallback = () => {
    if (audioWaitTimeoutRef.current !== null) return;
    clearAudioWaitTimeout();
    const generation = sourceLoadGenerationRef.current;
    const source = activeSourceRef.current;
    audioWaitTimeoutRef.current = setTimeout(() => {
      audioWaitTimeoutRef.current = null;
      if (
        generation !== sourceLoadGenerationRef.current ||
        source !== activeSourceRef.current ||
        !pendingAutoplayRef.current ||
        !bufferingRef.current
      ) return;
      setBuffering(false);
      setIsPlaying(false);
      globalClock.pause();
      emitPlayState(false, false);
      triggerFallbackMessage('Audio source stalled. Falling back...');
      setFailedSources(previous => previous.includes(source)
        ? previous
        : [...previous, source]);
    }, 8000);
  };

  const requestYouTubePlay = (player = ytPlayerRef.current) => {
    pendingAutoplayRef.current = true;
    setBuffering(true);
    clearYouTubePlayTimeout();
    scheduleYouTubeFallback();
    if (!player) return;
    try {
      player.playVideo();
    } catch (error) {
      clearYouTubePlayTimeout();
      sourceLoadGenerationRef.current += 1;
      setIsPlaying(false);
      setBuffering(false);
      console.warn('YouTube play request failed:', error);
      triggerFallbackMessage('YouTube playback could not start. Falling back...');
      setFailedSources(previous => previous.includes('youtube')
        ? previous
        : [...previous, 'youtube']);
    }
  };

  useEffect(() => {
    window.globalActiveSource = {
      source: activeSource,
      trackId: currentTrack?.trackId ?? null
    };
    window.dispatchEvent(new CustomEvent('globalActiveSource', {
      detail: { source: activeSource, trackId: currentTrack?.trackId ?? null }
    }));
  }, [activeSource, currentTrack?.trackId]);

  useEffect(() => {
    const handlePauseGlobal = () => {
      pendingAutoplayRef.current = false;
      ytPlaybackConfirmedRef.current = false;
      clearYouTubePlayTimeout();
      clearAudioWaitTimeout();
      setBuffering(false);
      if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (error) {
          console.warn('Could not pause YouTube playback:', error);
        }
      } else if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      emitPlayState(false, false);
    };
    window.addEventListener('pauseGlobalPlayer', handlePauseGlobal);
    return () => window.removeEventListener('pauseGlobalPlayer', handlePauseGlobal);
  }, [ytVideoId, ytPlayerReady]);

  const initWebAudio = () => {
    try {
      if (!audioCtxRef.current && audioRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 128;
        
        window.globalAudioAnalyser = analyserRef.current;
        window.globalFreqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      }
      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (e) {
      console.warn("Web Audio API could not initialize:", e);
    }
  };

  useEffect(() => {
    if (!window.globalFreqData) window.globalFreqData = new Uint8Array(64);
  }, []);

  useEffect(() => {
    loadYouTubeIframeApi().catch(error => {
      console.warn('Could not load the YouTube IFrame API:', error);
    });
  }, []);

  const attemptPlay = async () => {
    pendingAutoplayRef.current = true;
    window.dispatchEvent(new CustomEvent('globalPlayerDidPlay'));
    
    if (ytVideoId) {
      if (ytPlayerRef.current && ytPlayerReady) {
        try {
          if (audioRef.current) audioRef.current.pause();
          requestYouTubePlay(ytPlayerRef.current);
        } catch (error) {
          console.warn('Could not request YouTube playback:', error);
        }
      } else {
        setBuffering(true);
      }
      return;
    }

    if (bufferingRef.current) return;
    if (audioRef.current) {
      initWebAudio();
      try {
        await audioRef.current.play();
      } catch (error) {
        if (pendingAutoplayRef.current && error?.name !== 'AbortError') {
          pendingAutoplayRef.current = false;
          setIsPlaying(false);
          emitPlayState(false, false);
          triggerFallbackMessage('Playback could not start. Press play to retry.');
        }
      }
    }
  };

  const playerRuntime = {
    ...playerState,
    currentTrack,
    setCurrentTrack,
    selectedSong,
    setSelectedSong,
    settings,
    isSyncWorkspaceActive,
    isZenMode,
    globalClock,
    MAX_CACHE_SIZE,
    YOUTUBE_START_TIMEOUT_MS,
    emitPlayState,
    setBuffering,
    isCurrentAudioElement,
    seekYouTube,
    clearYouTubePlayTimeout,
    clearYouTubeSeekBufferTimeout,
    clearAudioWaitTimeout,
    triggerFallbackMessage,
    scheduleYouTubeFallback,
    scheduleAudioFallback,
    requestYouTubePlay,
    initWebAudio,
    attemptPlay
  };

  usePlayerArtwork({ currentTrack, setAccentColor, setAccentArtworkUrl });

  usePlayerSourceLifecycle(playerRuntime);

  useYouTubePlayer(playerRuntime);

  usePlayerClockSync(playerRuntime);

  const playerHandlers = usePlayerControls(playerRuntime);
  usePlayerGlobalEvents(playerRuntime, playerHandlers);


  return {
    refs: {
      audioRef,
      ytPlayerRef,
      progressBarRef,
      currentTimeRef
    },
    state: {
      currentTrack,
      selectedSong,
      isPlaying,
      isBuffering,
      duration,
      audioSrc,
      ytVideoId,
      ytPlayerReady,
      activeSource,
      accentColor,
      accentArtworkUrl,
      hoverTime,
      fallbackMessage,
      deezerStatus,
      volume,
      isMuted,
      isStacked,
      slotNode,
      isSyncWorkspaceActive
    },
    handlers: {
      ...playerHandlers
    }
  };
};