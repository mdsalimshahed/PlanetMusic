/* --- src/Studio/components/Player/usePlayerLogic.js --- */
import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { getAudioFile } from '../../../Application/services/db.js';
import { getCachedDeezerAudioBlob, getDeezerAudioBlob } from '../../../Application/services/deezerAudioCache.js';
import { extractYouTubeId } from '../../utils/songHelpers.js';
import { globalClock } from '../../utils/clockEngine.js';
import { formatPreciseTime } from '../../utils/songHelpers.js';
import { formatTime } from './PlayerUI.jsx';

const YOUTUBE_START_TIMEOUT_MS = 5000;

export const usePlayerLogic = ({ currentTrack, setCurrentTrack, selectedSong, setSelectedSong, settings, isSyncWorkspaceActive = false, isZenMode = false }) => {
  const audioRef = useRef(null);
  const audioSrcRef = useRef(undefined);
  const ytPlayerRef = useRef(null);
  const ytPlaybackConfirmedRef = useRef(false);
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
  const MAX_CACHE_SIZE = 5;

  useLayoutEffect(() => {
    currentTrackIdRef.current = currentTrack?.trackId ?? null;
  }, [currentTrack?.trackId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState(undefined);
  const [ytVideoId, setYtVideoId] = useState(null);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);
  const pendingSeekShouldPlayRef = useRef(true);
  const [activeSource, setActiveSource] = useState(null);
  const [accentColor, setAccentColor] = useState('#ffffff');
  const [accentArtworkUrl, setAccentArtworkUrl] = useState(null);
  const [pendingSeek, setPendingSeek] = useState(null);
  const pendingSeekRef = useRef(null);
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
  const setPendingSeekValue = (time) => {
    pendingSeekRef.current = time;
    setPendingSeek(time);
  };

  useLayoutEffect(() => {
    audioSrcRef.current = audioSrc;
  }, [audioSrc]);

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

  useEffect(() => {
    const handleResize = () => setIsStacked(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isSyncWorkspaceActive) {
      setSlotNode(document.getElementById('sync-player-slot'));
    } else if (selectedSong && isStacked) {
      setSlotNode(document.getElementById('mobile-player-slot'));
    } else {
      setSlotNode(null);
    }
  }, [selectedSong, isStacked, isSyncWorkspaceActive]);

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
      sourceLoadGenerationRef.current += 1;
      setIsPlaying(false);
      setBuffering(false);
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
        try { ytPlayerRef.current.pauseVideo(); } catch (e) {}
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
    const hasApiScript = Array.from(document.scripts).some(script =>
      script.src === 'https://www.youtube.com/iframe_api'
    );
    if (!window.YT && !hasApiScript) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }
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

  useEffect(() => {
    const artworkUrl = currentTrack?.artworkUrl100;
    if (!artworkUrl) {
      setAccentArtworkUrl(null);
      return;
    }

    let isCurrentArtwork = true;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    setAccentArtworkUrl(null);
    img.onload = () => {
      if (!isCurrentArtwork) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 7;
        canvas.height = 7;
        ctx.drawImage(img, 0, 0, 7, 7);
        const data = ctx.getImageData(0, 0, 7, 7).data;
        const colorBuckets = new Map();

        for (let i = 0; i < data.length; i += 4) {
          const [red, green, blue, alpha] = data.slice(i, i + 4);
          const brightness = Math.max(red, green, blue);
          if (alpha <= 127 || brightness < 28 || brightness > 248) continue;

          const bucketKey = [red, green, blue].map(value => Math.floor(value / 32)).join(':');
          const bucket = colorBuckets.get(bucketKey) || { red: 0, green: 0, blue: 0, count: 0 };
          bucket.red += red;
          bucket.green += green;
          bucket.blue += blue;
          bucket.count += 1;
          colorBuckets.set(bucketKey, bucket);
        }

        const colorsByFrequency = [...colorBuckets.values()].sort((a, b) => b.count - a.count);
        const getAverageRgb = (bucket) => [
          Math.round(bucket.red / bucket.count),
          Math.round(bucket.green / bucket.count),
          Math.round(bucket.blue / bucket.count)
        ];
        const getLuminance = (rgb) => {
          const channels = rgb.map(value => {
            const normalized = value / 255;
            return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        };
        const brightenToLuminance = (rgb, targetLuminance) => {
          let lowerMix = 0;
          let upperMix = 1;
          for (let attempt = 0; attempt < 12; attempt += 1) {
            const mix = (lowerMix + upperMix) / 2;
            const candidate = rgb.map(channel => Math.round(channel + (255 - channel) * mix));
            if (getLuminance(candidate) >= targetLuminance) upperMix = mix;
            else lowerMix = mix;
          }
          return rgb.map(channel => Math.round(channel + (255 - channel) * upperMix));
        };

        const dominantColor = colorsByFrequency[0];
        if (dominantColor) {
          const dominantLuminance = getLuminance(getAverageRgb(dominantColor));
          const brighterAlternative = dominantLuminance < 0.2
            ? colorsByFrequency.find(bucket => {
              const luminance = getLuminance(getAverageRgb(bucket));
              return luminance >= 0.2 && luminance <= 0.72;
            })
            : null;
          const dominantRgb = getAverageRgb(dominantColor);
          const selectedRgb = brighterAlternative
            ? getAverageRgb(brighterAlternative)
            : dominantLuminance < 0.2
              ? brightenToLuminance(dominantRgb, 0.22)
              : dominantRgb;
          const [red, green, blue] = selectedRgb;
          setAccentColor(`rgb(${red}, ${green}, ${blue})`);
          setAccentArtworkUrl(artworkUrl);
        }
      } catch (e) {
        setAccentColor('#ffffff');
      } finally {
        img.onload = null; img.onerror = null; img.src = '';
      }
    };
    img.onerror = () => {
      if (isCurrentArtwork) setAccentColor('#ffffff');
      img.onload = null; img.onerror = null; img.src = '';
    };
    img.src = artworkUrl;

    return () => {
      isCurrentArtwork = false;
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };
  }, [currentTrack?.artworkUrl100]);

  useEffect(() => {
    setFailedSources([]);
  }, [currentTrack?.trackId, currentTrack?.playId, currentTrack?.forceSource]);

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
        try { ytPlayerRef.current.stopVideo(); } catch(e) {}
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
        try { ytPlayerRef.current.stopVideo(); } catch (err) {}
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
    const trackId = currentTrack.trackId;
    const hasLocal = currentTrack.customLinks?.hasLocal;
    const dzUrl = currentTrack.customLinks?.deezer || '';
    const ytUrl = currentTrack.customLinks?.yt || currentTrack.yt || '';
    const extractedYtId = extractYouTubeId(ytUrl);
    const hasArl = Boolean(settings?.deezerArl?.trim());

    const getBestSource = (exclude = []) => {
      if (dzUrl && !exclude.includes('deezer')) return 'deezer';
      if (hasLocal && !exclude.includes('local')) return 'local';
      if (extractedYtId && !exclude.includes('youtube')) return 'youtube';
      if (!isSyncWorkspaceActive && currentTrack.previewUrl && !exclude.includes('preview')) return 'preview';
      return null;
    };

    let intendedSource = null;
    if (currentTrack.forceSource && !failedSources.includes(currentTrack.forceSource)) {
      if (currentTrack.forceSource === 'local' && hasLocal) intendedSource = 'local';
      else if (currentTrack.forceSource === 'deezer' && dzUrl) intendedSource = 'deezer';
      else if (currentTrack.forceSource === 'youtube' && extractedYtId) intendedSource = 'youtube';
    }
    
    if (!intendedSource) {
      intendedSource = getBestSource(failedSources);
    }

    const isNewPlayAction = currentTrack.playId && currentTrack.playId !== playIdRef.current;
    const trackChanged = trackId !== trackIdRef.current;
    const sourceChanged = intendedSource !== activeSourceRef.current;

    if (trackChanged || sourceChanged || isNewPlayAction) {
      const syncLoadRequest = syncLoadRequestRef.current;
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
      pendingAutoplayRef.current = syncLoadRequest?.playId === currentTrack.playId
        ? syncLoadRequest.autoplay
        : isSourceSwitch
          ? shouldResumeSourceSwitch
          : !isSyncWorkspaceActive;
      if (isSourceSwitch) {
        pendingSeekShouldPlayRef.current = shouldResumeSourceSwitch;
        setPendingSeekValue(switchTime);
      }
      const sourceLoadGeneration = ++sourceLoadGenerationRef.current;
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
        try { ytPlayerRef.current.stopVideo(); } catch(e) {}
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

            if (!hasArl) {
              triggerFallbackMessage("Deezer ARL required. Falling back...");
              setFailedSources(prev => [...prev, 'deezer']);
              return;
            }

            if (currentTrack.forceSource !== 'deezer' && extractedYtId && !failedSources.includes('youtube')) {
              activeSourceRef.current = 'youtube';
              setYtVideoId(extractedYtId);
              setActiveSource('youtube');
              setBuffering(false);

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
                  let switchTime = Number(window.currentAudioTime) || 0;
                  if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
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
  }, [currentTrack, settings?.deezerArl, failedSources, isSyncWorkspaceActive, isZenMode, selectedSong?.trackId]);

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
  }, [isSyncWorkspaceActive, selectedSong?.trackId, setCurrentTrack]);

  useEffect(() => {
    if (!ytVideoId) return;
    let playerInstance = null;
    let cancelled = false;
    let apiReadyTimer = null;
    let apiReadyAttempts = 0;
    const initYTPlayer = () => {
      if (cancelled) return;
      if (!window.YT || !window.YT.Player) {
        if (apiReadyAttempts >= 100) {
          setBuffering(false);
          triggerFallbackMessage('YouTube player did not become ready. Falling back...');
          setFailedSources(previous => previous.includes('youtube')
            ? previous
            : [...previous, 'youtube']);
          return;
        }
        apiReadyAttempts += 1;
        apiReadyTimer = setTimeout(initYTPlayer, 100);
        return;
      }
      const container = document.getElementById('yt-player-container');
      if (!container) {
        triggerFallbackMessage('YouTube player container is unavailable. Falling back...');
        setFailedSources(previous => previous.includes('youtube')
          ? previous
          : [...previous, 'youtube']);
        return;
      }
      
      container.innerHTML = '<div id="yt-player-target" style="width:100%;height:100%;"></div>';
      const playerGeneration = sourceLoadGenerationRef.current;
      
      playerInstance = new window.YT.Player('yt-player-target', {
        videoId: ytVideoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
        autoplay: pendingAutoplayRef.current ? 1 : 0,
        playsinline: 1,
        rel: 0,
        enablejsapi: 1,
        suggestedQuality: 'small',
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
              if (typeof event.target.setPlaybackQuality === 'function') event.target.setPlaybackQuality('small');
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
              }
              if (shouldPlay) {
                setBuffering(true);
                requestYouTubePlay(event.target);
              } else {
                setBuffering(false);
                event.target.pauseVideo();
                ytPlaybackConfirmedRef.current = false;
                setIsPlaying(false);
                emitPlayState(false, false);
              }
            } catch (e) {}
          },
          onStateChange: (event) => {
            if (cancelled || playerGeneration !== sourceLoadGenerationRef.current) {
              if (event.data === window.YT.PlayerState.PLAYING) event.target.stopVideo();
              return;
            }
            if (event.data === window.YT.PlayerState.PLAYING) {
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
                if (typeof ytPlayerRef.current.setPlaybackQuality === 'function') ytPlayerRef.current.setPlaybackQuality('small');
                const dur = ytPlayerRef.current.getDuration();
                if (dur && !isNaN(dur)) setDuration(dur);
              }
            } else if (event.data === window.YT.PlayerState.BUFFERING) {
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
            } else if (event.data === window.YT.PlayerState.PAUSED) {
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
            } else if (event.data === window.YT.PlayerState.ENDED) {
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
    initYTPlayer();
    return () => {
      cancelled = true;
      if (apiReadyTimer !== null) clearTimeout(apiReadyTimer);
      clearYouTubePlayTimeout();
      if (playerInstance && typeof playerInstance.destroy === 'function') {
        try { playerInstance.destroy(); } catch (e) {}
      }
      if (ytPlayerRef.current === playerInstance) {
        ytPlayerRef.current = null;
      }
      setYtPlayerReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytVideoId]);

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
          } catch (err) {}
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
  }, [duration, ytVideoId, isPlaying, isSyncWorkspaceActive, formatPlayerTime]);

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

  useEffect(() => {
    const handleSeekRequest = (e) => {
      const { time, track } = e.detail;
      
      const hasSameTrack = Boolean(
        currentTrack &&
        track &&
        currentTrack.trackId != null &&
        track.trackId != null &&
        String(currentTrack.trackId) === String(track.trackId)
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
          try { ytPlayerRef.current.stopVideo(); } catch (err) {}
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
            pendingSeekShouldPlayRef.current = pendingAutoplayRef.current;
            setPendingSeekValue(time);
            return;
          }
          globalClock.seek(time);
          if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
            seekYouTube(time);
            if (pendingAutoplayRef.current && !isPlaying) requestYouTubePlay(ytPlayerRef.current);
          } else if (audioRef.current) {
            audioRef.current.currentTime = time;
            if (pendingAutoplayRef.current && !isPlaying) attemptPlay();
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
      try { ytPlayerRef.current.setVolume((isMuted ? 0 : volume) * 100); } catch (e) {}
    } else if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, ytVideoId, ytPlayerReady]);

  useEffect(() => {
    const handleSharedVolumeChange = (event) => {
      const nextVolume = Number(event.detail?.volume);
      if (Number.isFinite(nextVolume) && nextVolume > 0) setVolume(nextVolume);
      if (typeof event.detail?.isMuted === 'boolean') setIsMuted(event.detail.isMuted);
    };
    window.addEventListener('playerVolumeChange', handleSharedVolumeChange);
    return () => window.removeEventListener('playerVolumeChange', handleSharedVolumeChange);
  }, []);

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
  }, [isPlaying, duration, currentTrack, ytVideoId, ytPlayerReady]);

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
      try { ytPlayerRef.current.stopVideo(); } catch (e) {}
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
        try { ytPlayerRef.current.pauseVideo(); } catch (err) {}
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
      } catch (err) {}
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
        try { ytPlayerRef.current.pauseVideo(); } catch (err) {}
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
          try { ytPlayerRef.current.setPlaybackRate(nextRate); } catch (err) {}
        } else if (audioRef.current) {
          audioRef.current.playbackRate = nextRate;
        }
      }
    };

    window.addEventListener('globalPlayerCommand', handlePlayerCommand);
    return () => window.removeEventListener('globalPlayerCommand', handlePlayerCommand);
  }, [isSyncWorkspaceActive, currentTrack, isPlaying, ytVideoId, ytPlayerReady, togglePlay]);

  const openModal = () => {
    if (currentTrack && setSelectedSong) {
      if (selectedSong && String(selectedSong.trackId) === String(currentTrack.trackId)) {
        return; 
      }
      setSelectedSong(currentTrack);
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
    }
  };
};