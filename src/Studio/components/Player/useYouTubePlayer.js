import { useEffect } from 'react';
import { loadYouTubeIframeApi } from './youtubeIframeApi.js';

export const useYouTubePlayer = runtime => {
  const { isSyncWorkspaceActive, selectedSong, setCurrentTrack,
    syncLoadRequestRef, sourceLoadGenerationRef, syncPlaybackRateRef, globalClock,
    ytVideoId, ytPlayerRef, setYtPlayerReady, setBuffering, pendingAutoplayRef,
    pendingSeekRef, pendingSeekShouldPlayRef, setPendingSeekValue, setDuration,
    isMuted, volume, seekYouTube, requestYouTubePlay, scheduleYouTubeFallback,
    ytPlaybackConfirmedRef, ytPendingSeekRef, ytSeekWasPlayingRef, ytHasPlayedRef,
    clearYouTubeSeekBufferTimeout, clearYouTubePlayTimeout, setIsPlaying,
    emitPlayState, setAudioSrc, setActiveSource, setFailedSources,
    triggerFallbackMessage, currentTrackIdRef, setYtVideoId } = runtime;

  useEffect(() => {
    if (!isSyncWorkspaceActive) return undefined;

    const handleSyncLoadTrack = (event) => {
      const { track, source, autoplay = false, playbackRate } = event.detail || {};
      if (!track || !source || !setCurrentTrack) return;
      if (!selectedSong || String(track.trackId) !== String(selectedSong.trackId)) return;

      const playId = `sync-${Date.now()}-${sourceLoadGenerationRef.current}`;
      const requestedRate = Number(playbackRate);
      if (Number.isFinite(requestedRate) && requestedRate > 0) {
        syncPlaybackRateRef.current = requestedRate;
        globalClock.setRate(requestedRate);
      }
      syncLoadRequestRef.current = { playId, autoplay: Boolean(autoplay) };
      setCurrentTrack({ ...track, forceSource: source, playId });
    };

    window.addEventListener('globalPlayerLoadTrack', handleSyncLoadTrack);
    return () => window.removeEventListener('globalPlayerLoadTrack', handleSyncLoadTrack);
  }, [
    isSyncWorkspaceActive, selectedSong?.trackId, selectedSong, setCurrentTrack,
    globalClock, sourceLoadGenerationRef, syncLoadRequestRef, syncPlaybackRateRef
  ]);

  useEffect(() => {
    if (!ytVideoId) return;
    let playerInstance = null;
    let cancelled = false;
    const playerGeneration = sourceLoadGenerationRef.current;
    const initYTPlayer = YT => {
      if (cancelled || playerGeneration !== sourceLoadGenerationRef.current) return;
      const container = document.getElementById('yt-player-container');
      if (!container) {
        triggerFallbackMessage('YouTube player container is unavailable. Falling back...');
        setFailedSources(previous => previous.includes('youtube')
          ? previous
          : [...previous, 'youtube']);
        return;
      }
      
      container.innerHTML = '<div id="yt-player-target" style="width:100%;height:100%;"></div>';
      const autoplayOnLoad = pendingAutoplayRef.current && pendingSeekRef.current === null;
      
      playerInstance = new YT.Player('yt-player-target', {
        videoId: ytVideoId,
        playerVars: {
          autoplay: autoplayOnLoad ? 1 : 0,
          playsinline: 1,
          rel: 0,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            if (cancelled || playerGeneration !== sourceLoadGenerationRef.current) {
              event.target.stopVideo();
              return;
            }
            ytPlayerRef.current = event.target;
            setYtPlayerReady(true);
            try {
              event.target.setVolume((isMuted ? 0 : volume) * 100);
              if (typeof event.target.setPlaybackRate === 'function') {
                event.target.setPlaybackRate(syncPlaybackRateRef.current);
              }
              const dur = event.target.getDuration();
              if (dur && !isNaN(dur)) setDuration(dur);
              
              let shouldPlay = pendingAutoplayRef.current;
              if (pendingSeekRef.current !== null) {
                seekYouTube(pendingSeekRef.current, event.target);
                globalClock.seek(pendingSeekRef.current);
                shouldPlay = shouldPlay && pendingSeekShouldPlayRef.current;
                pendingSeekShouldPlayRef.current = true;
                setPendingSeekValue(null);
              } else if (!shouldPlay) {
                setBuffering(false);
                event.target.pauseVideo();
                ytPlaybackConfirmedRef.current = false;
                setIsPlaying(false);
                emitPlayState(false, false);
              }
              if (shouldPlay) {
                setBuffering(true);
                if (autoplayOnLoad) scheduleYouTubeFallback();
                else requestYouTubePlay(event.target);
              }
            } catch (error) {
              console.warn('Could not initialize YouTube playback:', error);
            }
          },
          onStateChange: (event) => {
            if (cancelled || playerGeneration !== sourceLoadGenerationRef.current) {
              if (event.data === YT.PlayerState.PLAYING) event.target.stopVideo();
              return;
            }
            if (event.data === YT.PlayerState.PLAYING) {
              ytHasPlayedRef.current = true;
              clearYouTubeSeekBufferTimeout();
              ytSeekWasPlayingRef.current = false;
              if (!pendingAutoplayRef.current) {
                if (ytPendingSeekRef.current !== null) {
                  let seekedTime = Number.NaN;
                  try {
                    seekedTime = event.target.getCurrentTime();
                  } catch (error) {
                    console.warn('Could not read YouTube time after paused seek:', error);
                  }
                  const targetTime = ytPendingSeekRef.current;
                  const anchorTime = Number.isFinite(seekedTime) &&
                    Math.abs(seekedTime - targetTime) <= 0.75
                    ? seekedTime
                    : targetTime;
                  globalClock.updateAnchor(anchorTime, true);
                  if (anchorTime === seekedTime) ytPendingSeekRef.current = null;
                  setBuffering(false);
                  ytPlaybackConfirmedRef.current = false;
                  setIsPlaying(false);
                  event.target.pauseVideo();
                  emitPlayState(false, false);
                  return;
                }
                event.target.pauseVideo();
                return;
              }
              clearYouTubePlayTimeout();
              let apiTime = Number.NaN;
              try {
                apiTime = event.target.getCurrentTime();
              } catch (error) {
                console.warn('Could not read YouTube time after playback started:', error);
              }
              const pendingSeekTime = ytPendingSeekRef.current;
              const anchorTime = pendingSeekTime !== null &&
                (!Number.isFinite(apiTime) || Math.abs(apiTime - pendingSeekTime) > 0.75)
                ? pendingSeekTime
                : Number.isFinite(apiTime)
                  ? apiTime
                  : globalClock.getCurrentTime();
              if (pendingSeekTime !== null && anchorTime === apiTime) {
                ytPendingSeekRef.current = null;
              }
              if (!ytPlaybackConfirmedRef.current && Number.isFinite(anchorTime)) {
                globalClock.updateAnchor(anchorTime, true);
              }
              ytPlaybackConfirmedRef.current = true;
              setBuffering(false);
              setIsPlaying(true);
              emitPlayState(true, false);
              
              if (ytPlayerRef.current) {
                const dur = ytPlayerRef.current.getDuration();
                if (dur && !isNaN(dur)) setDuration(dur);
              }
            } else if (event.data === YT.PlayerState.BUFFERING) {
              if (!pendingAutoplayRef.current) {
                if (ytPendingSeekRef.current !== null) return;
                event.target.pauseVideo();
                return;
              }
              if (ytSeekWasPlayingRef.current) return;
              if (ytPlaybackConfirmedRef.current) {
                try {
                  const bufferedTime = event.target.getCurrentTime();
                  if (Number.isFinite(bufferedTime)) globalClock.updateAnchor(bufferedTime, true);
                } catch (error) {
                  console.warn('Could not read YouTube time while buffering:', error);
                }
              }
              setBuffering(true);
              ytPlaybackConfirmedRef.current = false;
              setIsPlaying(false);
              emitPlayState(false, false);
              scheduleYouTubeFallback();
            } else if (event.data === YT.PlayerState.PAUSED) {
              clearYouTubeSeekBufferTimeout();
              ytSeekWasPlayingRef.current = false;
              if (pendingAutoplayRef.current) return;
              clearYouTubePlayTimeout();
              if (ytPendingSeekRef.current !== null) {
                try {
                  const pausedTime = event.target.getCurrentTime();
                  if (Number.isFinite(pausedTime)) {
                    globalClock.updateAnchor(pausedTime, true);
                    if (Math.abs(pausedTime - ytPendingSeekRef.current) <= 0.75) {
                      ytPendingSeekRef.current = null;
                    }
                  }
                } catch (error) {
                  console.warn('Could not read YouTube time after paused seek:', error);
                }
              }
              if (ytPlaybackConfirmedRef.current) {
                try {
                  const pausedTime = event.target.getCurrentTime();
                  if (Number.isFinite(pausedTime)) globalClock.updateAnchor(pausedTime, true);
                } catch (error) {
                  console.warn('Could not read YouTube time after pausing:', error);
                }
              }
              ytPlaybackConfirmedRef.current = false;
              setBuffering(false);
              setIsPlaying(false); emitPlayState(false, false);
            } else if (event.data === YT.PlayerState.ENDED) {
              clearYouTubePlayTimeout();
              ytPlaybackConfirmedRef.current = false;
              pendingAutoplayRef.current = false;
              setBuffering(false);
              setIsPlaying(false); emitPlayState(false, true);
              window.dispatchEvent(new CustomEvent('globalTrackEnded', {
                detail: { trackId: currentTrackIdRef.current }
              }));
            }
          },
          onError: (event) => {
            if (cancelled || playerGeneration !== sourceLoadGenerationRef.current) return;
            clearYouTubePlayTimeout();
            sourceLoadGenerationRef.current += 1;
            console.warn("YouTube Error Code:", event.data);
            ytPlaybackConfirmedRef.current = false;
            setIsPlaying(false);
            globalClock.pause();
            emitPlayState(false, false);
            setBuffering(false);
            setYtVideoId(null);
            setYtPlayerReady(false);
            setAudioSrc(undefined);
            setActiveSource(null);
            triggerFallbackMessage("YouTube stream unavailable. Falling back...");
            setFailedSources(prev => [...prev, 'youtube']);
          }
        }
      });
    };
    loadYouTubeIframeApi()
      .then(initYTPlayer)
      .catch(error => {
        if (cancelled || playerGeneration !== sourceLoadGenerationRef.current) return;
        console.warn('Could not initialize YouTube playback:', error);
        setBuffering(false);
        triggerFallbackMessage('YouTube player did not become ready. Falling back...');
        setFailedSources(previous => previous.includes('youtube')
          ? previous
          : [...previous, 'youtube']);
      });
    return () => {
      cancelled = true;
      clearYouTubePlayTimeout();
      if (playerInstance && typeof playerInstance.destroy === 'function') {
        try {
          playerInstance.destroy();
        } catch (error) {
          console.warn('Could not destroy the YouTube player:', error);
        }
      }
      if (ytPlayerRef.current === playerInstance) {
        ytPlayerRef.current = null;
      }
      setYtPlayerReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytVideoId]);
};
