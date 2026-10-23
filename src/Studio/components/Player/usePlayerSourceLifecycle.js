import { useEffect } from 'react';
import { getAudioFile } from '../../../Application/services/db.js';
import { getCachedDeezerAudioBlob, getDeezerAudioBlob } from '../../../Application/services/deezerAudioCache.js';
import {
  resolvePlayerSource,
  shouldStartYouTubeWhileDeezerLoads
} from './resolvePlayerSource.js';

export const usePlayerSourceLifecycle = runtime => {
  const { currentTrack, selectedSong, settings, isSyncWorkspaceActive, isZenMode,
    failedSources, setFailedSources, sourceLoadGenerationRef,
    clearYouTubePlayTimeout, clearAudioWaitTimeout, ytPendingSeekRef,
    pendingAutoplayRef, ytPlaybackConfirmedRef, audioPlaybackConfirmedRef,
    abortControllerRef, audioRef, deezerObjectUrlRef, ytPlayerRef, ytPlayerReady,
    setAudioSrc, setYtVideoId, setPendingSeekValue, setIsPlaying, setBuffering,
    setActiveSource, setDeezerStatus, activeSourceRef, playIdRef,
    lastPolledTimeRef, globalClock, emitPlayState, progressBarRef,
    currentTimeRef, formatPlayerTime, triggerFallbackMessage, audioCacheRef,
    pendingSeekRef, pendingSeekShouldPlayRef, pendingSeek, audioSrc, setDuration,
    setFallbackMessage, setYtPlayerReady, trackIdRef, syncLoadRequestRef,
    ytVideoId, ytHasPlayedRef, lastSyncTimeRef, MAX_CACHE_SIZE,
    scheduleYouTubeFallback } = runtime;

  useEffect(() => {
    setFailedSources([]);
  }, [currentTrack?.trackId, currentTrack?.playId, currentTrack?.forceSource, setFailedSources]);

  useEffect(() => {
    if (!currentTrack) {
      sourceLoadGenerationRef.current += 1;
      clearYouTubePlayTimeout();
      clearAudioWaitTimeout();
      ytPendingSeekRef.current = null;
      pendingAutoplayRef.current = false;
      ytPlaybackConfirmedRef.current = false;
      audioPlaybackConfirmedRef.current = false;
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
          console.warn('Could not stop YouTube while clearing the player:', error);
        }
      }
      setAudioSrc(undefined);
      setYtVideoId(null);
      setPendingSeekValue(null);
      setIsPlaying(false);
      setBuffering(false);
      setActiveSource(null);
      setFallbackMessage('');
      setDeezerStatus(null);
      activeSourceRef.current = null;
      ytPlaybackConfirmedRef.current = false;
      playIdRef.current = null;
      lastPolledTimeRef.current = -1;
      globalClock.pause();
      globalClock.seek(0);
      emitPlayState(false, true);
      trackIdRef.current = null;
      if (progressBarRef.current) progressBarRef.current.value = 0;
      if (currentTimeRef.current) currentTimeRef.current.innerText = formatPlayerTime(0);
      return;
    }
    if (
      isSyncWorkspaceActive &&
      (!selectedSong || String(currentTrack.trackId) !== String(selectedSong.trackId))
    ) {
      sourceLoadGenerationRef.current += 1;
      clearYouTubePlayTimeout();
      clearAudioWaitTimeout();
      pendingAutoplayRef.current = false;
      ytPlaybackConfirmedRef.current = false;
      ytPendingSeekRef.current = null;
      audioPlaybackConfirmedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (audioRef.current) audioRef.current.pause();
      if (ytPlayerRef.current && ytPlayerReady) {
        try {
          ytPlayerRef.current.stopVideo();
        } catch (error) {
          console.warn('Could not stop YouTube while leaving sync playback:', error);
        }
      }
      setAudioSrc(undefined);
      setYtVideoId(null);
      setIsPlaying(false);
      setBuffering(false);
      setActiveSource(null);
      setDeezerStatus(null);
      activeSourceRef.current = null;
      trackIdRef.current = null;
      globalClock.pause();
      emitPlayState(false, false);
      return;
    }
    const {
      trackId, dzUrl, extractedYtId, intendedSource
    } = resolvePlayerSource(
      currentTrack,
      failedSources,
      isSyncWorkspaceActive,
      settings?.deezerArl,
      settings?.deezerArlValid
    );

    const isNewPlayAction = currentTrack.playId && currentTrack.playId !== playIdRef.current;
    const trackChanged = trackId !== trackIdRef.current;
    const sourceChanged = intendedSource !== activeSourceRef.current;

    if (trackChanged || sourceChanged || isNewPlayAction) {
      const pendingSyncLoadRequest = syncLoadRequestRef.current;
      syncLoadRequestRef.current = null;
      const syncLoadRequest = isSyncWorkspaceActive &&
        pendingSyncLoadRequest?.playId === currentTrack.playId
        ? pendingSyncLoadRequest
        : null;
      const isSourceSwitch = !trackChanged && sourceChanged;
      if (trackChanged) setDuration(0);
      let switchTime = isSourceSwitch ? globalClock.getCurrentTime() : 0;
      let shouldResumeSourceSwitch = false;
      if (isSourceSwitch) {
        if (pendingSeekRef.current !== null) switchTime = pendingSeekRef.current;
        if (ytVideoId && ytPlayerRef.current && ytPlayerReady && ytPlaybackConfirmedRef.current) {
          try {
            const playerTime = ytPlayerRef.current.getCurrentTime();
            if (Number.isFinite(playerTime)) switchTime = playerTime;
          } catch (error) {
            console.warn('Could not read YouTube time during source switch:', error);
          }
        } else if (
          !ytVideoId &&
          audioSrc &&
          audioPlaybackConfirmedRef.current &&
          Number.isFinite(audioRef.current?.currentTime)
        ) {
          switchTime = audioRef.current.currentTime;
        }
        shouldResumeSourceSwitch = window.globalIsAudioPlaying === true || pendingAutoplayRef.current;
      }
      pendingAutoplayRef.current = isSourceSwitch
        ? shouldResumeSourceSwitch
        : isSyncWorkspaceActive
          ? Boolean(syncLoadRequest?.autoplay)
          : true;
      if (isSourceSwitch) {
        pendingSeekShouldPlayRef.current = shouldResumeSourceSwitch;
        setPendingSeekValue(switchTime);
      }
      const sourceLoadGeneration = ++sourceLoadGenerationRef.current;
      if (trackChanged || sourceChanged || isNewPlayAction) ytHasPlayedRef.current = false;
      setDeezerStatus(null);
      clearYouTubePlayTimeout();
      clearAudioWaitTimeout();
      ytPendingSeekRef.current = null;
      audioPlaybackConfirmedRef.current = false;
      lastSyncTimeRef.current = 0;
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
          console.warn('Could not stop YouTube before loading a new source:', error);
        }
      }
      setIsPlaying(false);
      setBuffering(true);
      ytPlaybackConfirmedRef.current = false;
      globalClock.pause();
      globalClock.seek(isSourceSwitch ? switchTime : 0);
      window.currentAudioTime = isSourceSwitch ? switchTime : 0;
      emitPlayState(false, false);
      if (progressBarRef.current) progressBarRef.current.value = isSourceSwitch ? switchTime : 0;
      if (currentTimeRef.current) {
        currentTimeRef.current.innerText = formatPlayerTime(isSourceSwitch ? switchTime : 0);
      }
      
      trackIdRef.current = trackId;
      playIdRef.current = currentTrack.playId;
      lastPolledTimeRef.current = -1;
      setYtPlayerReady(false);

      const addToCache = (key, url) => {
        if (audioCacheRef.current.has(key)) {
          URL.revokeObjectURL(url);
          return audioCacheRef.current.get(key);
        }
        if (audioCacheRef.current.size >= MAX_CACHE_SIZE) {
          const oldestKey = audioCacheRef.current.keys().next().value;
          URL.revokeObjectURL(audioCacheRef.current.get(oldestKey));
          audioCacheRef.current.delete(oldestKey);
        }
        audioCacheRef.current.set(key, url);
        return url;
      };

      const loadAudio = async (source) => {
        if (!source) {
          activeSourceRef.current = null;
          setActiveSource(null);
          setAudioSrc(undefined);
          setYtVideoId(null);
          setBuffering(false);
          setDuration(0);
          if (isZenMode) {
            window.dispatchEvent(new CustomEvent('globalZenTrackUnavailable', {
              detail: { trackId: currentTrack?.trackId ?? null }
            }));
          }
          return;
        }
        activeSourceRef.current = source;

        if (source === 'youtube') {
          setAudioSrc(undefined);
          setYtVideoId(extractedYtId);
          setActiveSource('youtube');
          setBuffering(true);
          if (pendingAutoplayRef.current) scheduleYouTubeFallback();
        } else if (source === 'preview') {
          setYtVideoId(null);
          setBuffering(false);
          setAudioSrc(currentTrack.previewUrl);
          setActiveSource('preview');
        } else {
          setYtVideoId(null);
          if (source === 'local') {
            const file = await getAudioFile(trackId);
            if (sourceLoadGeneration !== sourceLoadGenerationRef.current) return;
            if (file) {
              const url = addToCache(`local_${trackId}`, URL.createObjectURL(file));
              setBuffering(false);
              setAudioSrc(url);
              setActiveSource('local');
            } else {
              triggerFallbackMessage("Local audio missing. Falling back...");
              setFailedSources(prev => [...prev, 'local']);
            }
          } else if (source === 'deezer') {
            const cachedBlob = await getCachedDeezerAudioBlob(dzUrl);
            if (sourceLoadGeneration !== sourceLoadGenerationRef.current) return;

            if (cachedBlob) {
              const url = URL.createObjectURL(cachedBlob);
              deezerObjectUrlRef.current = url;
              activeSourceRef.current = 'deezer';
              setYtVideoId(null);
              setActiveSource('deezer');
              setBuffering(false);
              setAudioSrc(url);
              return;
            }

            if (shouldStartYouTubeWhileDeezerLoads(extractedYtId, failedSources)) {
              activeSourceRef.current = 'youtube';
              setYtVideoId(extractedYtId);
              setActiveSource('youtube');
              setBuffering(false);
              setDeezerStatus({
                stage: 'connecting',
                message: 'Playing on YouTube while Deezer loads'
              });

              const controller = new AbortController();
              abortControllerRef.current = controller;
              const reportDeezerProgress = progress => {
                if (
                  sourceLoadGeneration === sourceLoadGenerationRef.current &&
                  !controller.signal.aborted
                ) {
                  setDeezerStatus({
                    ...progress,
                    message: `Playing on YouTube while Deezer loads · ${progress.message}`
                  });
                }
              };
              getDeezerAudioBlob(
                dzUrl,
                settings?.deezerArl?.trim() || '',
                controller.signal,
                reportDeezerProgress
              )
                .then(blob => {
                  if (
                    sourceLoadGeneration !== sourceLoadGenerationRef.current ||
                    controller.signal.aborted ||
                    activeSourceRef.current !== 'youtube'
                  ) return;

                  setDeezerStatus(null);
                  let switchTime = pendingSeekRef.current !== null
                    ? pendingSeekRef.current
                    : Number(window.currentAudioTime) || 0;
                  if (
                    ytPlaybackConfirmedRef.current &&
                    ytPlayerRef.current &&
                    typeof ytPlayerRef.current.getCurrentTime === 'function'
                  ) {
                    try {
                      const playerTime = ytPlayerRef.current.getCurrentTime();
                      if (Number.isFinite(playerTime)) switchTime = playerTime;
                    } catch {
                      switchTime = Number(window.currentAudioTime) || 0;
                    }
                  }
                  const shouldResume = window.globalIsAudioPlaying === true || pendingSeek !== null;
                  const url = URL.createObjectURL(blob);
                  deezerObjectUrlRef.current = url;
                  activeSourceRef.current = 'deezer';
                  pendingSeekShouldPlayRef.current = shouldResume;
                  setPendingSeekValue(switchTime);
                  setYtVideoId(null);
                  setAudioSrc(url);
                  setActiveSource('deezer');
                  setBuffering(false);
                  setIsPlaying(false);
                  globalClock.pause();
                  globalClock.seek(switchTime);
                  window.currentAudioTime = switchTime;
                  emitPlayState(false, false);
                })
                .catch(error => {
                  if (error.name !== 'AbortError' && sourceLoadGeneration === sourceLoadGenerationRef.current) {
                    setDeezerStatus(null);
                    triggerFallbackMessage("Deezer stream failed. Continuing with YouTube...");
                  }
                })
                .finally(() => {
                  if (abortControllerRef.current === controller) abortControllerRef.current = null;
                });
              return;
            }

            setActiveSource('deezer');
            setBuffering(true);
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const reportDeezerProgress = progress => {
              if (
                sourceLoadGeneration === sourceLoadGenerationRef.current &&
                !controller.signal.aborted
              ) {
                setDeezerStatus(progress);
              }
            };
            
            try {
              const blob = await getDeezerAudioBlob(
                dzUrl,
                settings?.deezerArl?.trim() || '',
                controller.signal,
                reportDeezerProgress
              );
              if (sourceLoadGeneration !== sourceLoadGenerationRef.current || controller.signal.aborted) return;
              setDeezerStatus(null);
              const url = URL.createObjectURL(blob);
              deezerObjectUrlRef.current = url;
              if (!controller.signal.aborted) {
                setAudioSrc(url);
              }
            } catch (e) {
              if (e.name === 'AbortError') return;
              console.error("Deezer buffer error:", e);
              setDeezerStatus(null);
              triggerFallbackMessage("Deezer stream failed. Falling back...");
              setFailedSources(prev => [...prev, 'deezer']);
            } finally {
              if (abortControllerRef.current === controller) {
                setBuffering(false);
              }
            }
          }
        }
      };
      loadAudio(intendedSource);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTrack,
    settings?.deezerArl,
    settings?.deezerArlValid,
    failedSources,
    isSyncWorkspaceActive,
    isZenMode,
    selectedSong?.trackId
  ]);
};
