import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatPreciseTime } from '../../utils/songHelpers.js';
import { formatTime } from './PlayerUI.jsx';

export const usePlayerState = ({ currentTrack, selectedSong, isSyncWorkspaceActive }) => {
  const audioRef = useRef(null);
  const audioSrcRef = useRef(undefined);
  const ytPlayerRef = useRef(null);
  const ytPlaybackConfirmedRef = useRef(false);
  const ytHasPlayedRef = useRef(false);
  const ytPendingSeekRef = useRef(null);
  const ytSeekWasPlayingRef = useRef(false);
  const audioPlaybackConfirmedRef = useRef(false);
  const ytPlayTimeoutRef = useRef(null);
  const ytSeekBufferTimeoutRef = useRef(null);
  const audioWaitTimeoutRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const progressBarRef = useRef(null);
  const currentTimeRef = useRef(null);
  const trackIdRef = useRef(null);
  const currentTrackIdRef = useRef(currentTrack?.trackId ?? null);
  const activeSourceRef = useRef(null);
  const playIdRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const lastPolledTimeRef = useRef(-1);
  const lastSyncTimeRef = useRef(0);
  const abortControllerRef = useRef(null);
  const sourceLoadGenerationRef = useRef(0);
  const bufferingRef = useRef(false);
  const deezerObjectUrlRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const syncLoadRequestRef = useRef(null);
  const syncPlaybackRateRef = useRef(1);
  const pendingAutoplayRef = useRef(true);
  const pendingSeekShouldPlayRef = useRef(true);
  const pendingSeekRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState(undefined);
  const [ytVideoId, setYtVideoId] = useState(null);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);
  const [activeSource, setActiveSource] = useState(null);
  const [accentColor, setAccentColor] = useState('#ffffff');
  const [accentArtworkUrl, setAccentArtworkUrl] = useState(null);
  const [pendingSeek, setPendingSeek] = useState(null);
  const [hoverTime, setHoverTime] = useState(null);
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [deezerStatus, setDeezerStatus] = useState(null);
  const [failedSources, setFailedSources] = useState([]);
  const [volume, setVolume] = useState(() => {
    const savedVolume = Number(localStorage.getItem('playerVolume'));
    return Number.isFinite(savedVolume) && savedVolume > 0 ? savedVolume : 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    const savedMuteState = localStorage.getItem('playerMuted');
    const savedVolume = localStorage.getItem('playerVolume');
    return savedMuteState !== null
      ? savedMuteState === 'true'
      : savedVolume !== null && Number(savedVolume) === 0;
  });
  const [isStacked, setIsStacked] = useState(window.innerWidth <= 900);
  const [slotNode, setSlotNode] = useState(null);

  const formatPlayerTime = isSyncWorkspaceActive ? formatPreciseTime : formatTime;
  const setPendingSeekValue = time => {
    pendingSeekRef.current = time;
    setPendingSeek(time);
  };

  useLayoutEffect(() => {
    currentTrackIdRef.current = currentTrack?.trackId ?? null;
  }, [currentTrack?.trackId]);

  useLayoutEffect(() => {
    audioSrcRef.current = audioSrc;
  }, [audioSrc]);

  useEffect(() => {
    const handleResize = () => setIsStacked(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isSyncWorkspaceActive) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlotNode(document.getElementById('sync-player-slot'));
    } else if (selectedSong && isStacked) {
      setSlotNode(document.getElementById('mobile-player-slot'));
    } else {
      setSlotNode(null);
    }
  }, [selectedSong, isStacked, isSyncWorkspaceActive]);

  return {
    audioRef,
    audioSrcRef,
    ytPlayerRef,
    ytPlaybackConfirmedRef,
    ytHasPlayedRef,
    ytPendingSeekRef,
    ytSeekWasPlayingRef,
    audioPlaybackConfirmedRef,
    ytPlayTimeoutRef,
    ytSeekBufferTimeoutRef,
    audioWaitTimeoutRef,
    audioCtxRef,
    analyserRef,
    sourceRef,
    progressBarRef,
    currentTimeRef,
    trackIdRef,
    currentTrackIdRef,
    activeSourceRef,
    playIdRef,
    fallbackTimerRef,
    lastPolledTimeRef,
    lastSyncTimeRef,
    abortControllerRef,
    sourceLoadGenerationRef,
    bufferingRef,
    deezerObjectUrlRef,
    audioCacheRef,
    syncLoadRequestRef,
    syncPlaybackRateRef,
    pendingAutoplayRef,
    pendingSeekShouldPlayRef,
    pendingSeekRef,
    isPlaying,
    setIsPlaying,
    isBuffering,
    setIsBuffering,
    duration,
    setDuration,
    audioSrc,
    setAudioSrc,
    ytVideoId,
    setYtVideoId,
    ytPlayerReady,
    setYtPlayerReady,
    activeSource,
    setActiveSource,
    accentColor,
    setAccentColor,
    accentArtworkUrl,
    setAccentArtworkUrl,
    pendingSeek,
    setPendingSeekValue,
    hoverTime,
    setHoverTime,
    fallbackMessage,
    setFallbackMessage,
    deezerStatus,
    setDeezerStatus,
    failedSources,
    setFailedSources,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    isStacked,
    slotNode,
    setSlotNode,
    formatPlayerTime
  };
};
