import { useEffect } from 'react';

export const usePlayerClockSync = runtime => {
  const {
    duration, ytVideoId, isPlaying, isSyncWorkspaceActive, formatPlayerTime,
    progressBarRef, currentTimeRef, lastSyncTimeRef, ytPlaybackConfirmedRef,
    ytPendingSeekRef, ytPlayerRef, lastPolledTimeRef, globalClock, audioRef,
    audioSrc, isMuted, volume, syncPlaybackRateRef, pendingSeek,
    pendingAutoplayRef, attemptPlay, emitPlayState
  } = runtime;

  useEffect(() => {
    let lastSecond = -1;
    const updateSeekPosition = (time) => {
      if (!Number.isFinite(time)) return;
      if (progressBarRef.current) {
        progressBarRef.current.value = time;
        progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
      }
      if (currentTimeRef.current) {
        currentTimeRef.current.innerText = formatPlayerTime(time);
      }
    };
    const handleTimeUpdate = (e) => {
      if (ytVideoId && !ytPlaybackConfirmedRef.current) return;
      const time = e.detail;
      const currentSecond = Math.floor(time);
      if (progressBarRef.current) {
        progressBarRef.current.value = time;
        progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
      }
      if (currentSecond !== lastSecond || isSyncWorkspaceActive) {
        if (currentTimeRef.current) currentTimeRef.current.innerText = formatPlayerTime(time);
        lastSecond = currentSecond;
      }
      const now = performance.now();
      const syncInterval = ytVideoId && ytPendingSeekRef.current !== null ? 250 : 2000;
      if (now - lastSyncTimeRef.current > syncInterval) {
        lastSyncTimeRef.current = now;
        if (ytVideoId && ytPlayerRef.current && isPlaying) {
          try {
            const ytTime = ytPlayerRef.current.getCurrentTime();
            if (Number.isFinite(ytTime) && ytTime !== lastPolledTimeRef.current) {
              if (ytPendingSeekRef.current !== null) {
                if (Number.isFinite(ytTime) && Math.abs(ytTime - ytPendingSeekRef.current) <= 0.75) {
                  ytPendingSeekRef.current = null;
                  globalClock.updateAnchor(ytTime, true);
                }
              } else {
                globalClock.updateAnchor(ytTime);
              }
              lastPolledTimeRef.current = ytTime;
            }
          } catch (error) {
            console.warn('Could not sync YouTube playback time:', error);
          }
        } else if (audioRef.current && isPlaying) {
          const audioTime = audioRef.current.currentTime;
          if (Number.isFinite(audioTime) && audioTime !== lastPolledTimeRef.current) {
            globalClock.updateAnchor(audioTime);
            lastPolledTimeRef.current = audioTime;
          }
        }
      }
    };
    const handleTimeSeek = (e) => updateSeekPosition(Number(e.detail));
    
    window.addEventListener('globalTimeUpdate', handleTimeUpdate);
    window.addEventListener('globalTimeSeek', handleTimeSeek);
    return () => {
      window.removeEventListener('globalTimeUpdate', handleTimeUpdate);
      window.removeEventListener('globalTimeSeek', handleTimeSeek);
    };
  }, [
    duration, ytVideoId, isPlaying, isSyncWorkspaceActive, formatPlayerTime,
    progressBarRef, currentTimeRef, lastSyncTimeRef, ytPlaybackConfirmedRef,
    ytPendingSeekRef, ytPlayerRef, lastPolledTimeRef, globalClock, audioRef
  ]);

  useEffect(() => {
    if (!ytVideoId && audioSrc && audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = syncPlaybackRateRef.current;
      if (pendingSeek === null) {
        if (pendingAutoplayRef.current) attemptPlay();
        else emitPlayState(false, false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, ytVideoId]);
};
