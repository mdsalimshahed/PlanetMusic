/* --- src/components/Core/Player.jsx --- */
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAudioFile } from '../../services/db';
import { extractYouTubeId } from '../../utils/songHelpers';
import { globalClock } from '../../utils/clockEngine';
import './Player.css';

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds === null) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const MarqueeText = ({ text, className }) => {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        setIsOverflowing(textRef.current.offsetWidth > containerRef.current.clientWidth + 2);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div 
      className={`marquee-container ${className}`} 
      ref={containerRef}
      style={{ 
        WebkitMaskImage: isOverflowing ? 'linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)' : 'none',
        maskImage: isOverflowing ? 'linear-gradient(to right, transparent, black 12px, black calc(100% - 12px), transparent)' : 'none'
      }}
    >
      <div className={`marquee-content ${isOverflowing ? 'animate-marquee' : ''}`}>
        <span ref={textRef} className="marquee-text">{text}</span>
        {isOverflowing && <span className="marquee-text gap-pl">{text}</span>}
      </div>
    </div>
  );
};

const Player = ({ currentTrack, setCurrentTrack, selectedSong, setSelectedSong, settings }) => {
  const audioRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const progressBarRef = useRef(null);
  const currentTimeRef = useRef(null);
  const trackIdRef = useRef(null);
  const activeSourceRef = useRef(null);
  const playIdRef = useRef(null);
  const ytLastPerfRef = useRef(0);
  const fallbackTimerRef = useRef(null);
  
  const lastPolledTimeRef = useRef(-1);
  const lastSyncTimeRef = useRef(0); // NEW: Tracks last time we polled native players
  const abortControllerRef = useRef(null);
  
  const audioCacheRef = useRef(new Map());
  const MAX_CACHE_SIZE = 5;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState(undefined);
  const [ytVideoId, setYtVideoId] = useState(null);
  const [ytPlayerReady, setYtPlayerReady] = useState(false);
  const [activeSource, setActiveSource] = useState(null);
  const [accentColor, setAccentColor] = useState('#ffffff');
  const [pendingSeek, setPendingSeek] = useState(null);
  const [hoverTime, setHoverTime] = useState(null);
  const [fallbackMessage, setFallbackMessage] = useState('');
  
  const [failedSources, setFailedSources] = useState([]);

  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem('playerVolume');
    return savedVolume !== null ? parseFloat(savedVolume) : 1;
  });

  const [isStacked, setIsStacked] = useState(window.innerWidth <= 900);
  const [slotNode, setSlotNode] = useState(null);

  useEffect(() => {
    globalClock.setEventName('globalTimeUpdate');
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      audioCacheRef.current.forEach(url => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setIsStacked(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedSong && isStacked) {
      setTimeout(() => setSlotNode(document.getElementById('mobile-player-slot')), 50);
    } else {
      setSlotNode(null);
    }
  }, [selectedSong, isStacked]);

  const emitPlayState = (playing, ended = false) => {
    if (playing) globalClock.start(window.currentAudioTime || 0);
    else globalClock.pause();
    window.dispatchEvent(new CustomEvent('globalPlayState', { detail: { isPlaying: playing, isEnded: ended } }));
  };

  const triggerFallbackMessage = (msg) => {
    setFallbackMessage(msg);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => setFallbackMessage(''), 4000);
  };

  useEffect(() => {
    const handlePauseGlobal = () => {
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
    if (!window.YT) {
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
    window.dispatchEvent(new CustomEvent('globalPlayerDidPlay'));
    
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      try {
        if (audioRef.current) audioRef.current.pause();
        ytLastPerfRef.current = performance.now();
        ytPlayerRef.current.playVideo();
        setIsPlaying(true);
        emitPlayState(true, false);
      } catch (err) {}
    } else if (audioRef.current) {
      initWebAudio();
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        emitPlayState(true, false);
      } catch (err) {}
    }
  };

  useEffect(() => {
    if (!currentTrack || !currentTrack.artworkUrl100) return;
    let img = new Image();
    img.crossOrigin = "Anonymous"; 
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 5; canvas.height = 5;
        ctx.drawImage(img, 0, 0, 5, 5);
        const data = ctx.getImageData(0, 0, 5, 5).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] > 127 && (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20)) {
            r += data[i]; g += data[i+1]; b += data[i+2]; count++;
          }
        }
        if (count > 0) {
          r = Math.min(255, Math.floor(r / count) + 30);
          g = Math.min(255, Math.floor(g / count) + 30);
          b = Math.min(255, Math.floor(b / count) + 30);
          setAccentColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch (e) {
        setAccentColor('#ffffff'); 
      } finally {
        img.onload = null; img.onerror = null; img.src = ''; img = null;
      }
    };
    img.onerror = () => {
      setAccentColor('#ffffff');
      img.onload = null; img.onerror = null; img.src = ''; img = null;
    };
    img.src = currentTrack.artworkUrl100;
  }, [currentTrack?.artworkUrl100]);

  useEffect(() => {
    setFailedSources([]);
  }, [currentTrack?.trackId, currentTrack?.playId, currentTrack?.forceSource]);

  useEffect(() => {
    if (!currentTrack) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (ytPlayerRef.current && ytPlayerReady) {
        try { ytPlayerRef.current.stopVideo(); } catch(e) {}
      }
      setAudioSrc(undefined);
      setYtVideoId(null);
      setPendingSeek(null);
      setIsPlaying(false);
      setIsBuffering(false);
      setActiveSource(null);
      setFallbackMessage('');
      activeSourceRef.current = null;
      playIdRef.current = null;
      lastPolledTimeRef.current = -1;
      globalClock.pause();
      globalClock.seek(0);
      emitPlayState(false, true);
      trackIdRef.current = null;
      if (progressBarRef.current) progressBarRef.current.value = 0;
      if (currentTimeRef.current) currentTimeRef.current.innerText = "0:00";
      return;
    }

    const trackId = currentTrack.trackId;
    const hasLocal = currentTrack.customLinks?.hasLocal;
    const dzUrl = currentTrack.customLinks?.deezer || '';
    const ytUrl = currentTrack.customLinks?.yt || currentTrack.yt || '';
    const extractedYtId = extractYouTubeId(ytUrl);
    const hasArl = Boolean(settings?.deezerArl?.trim());

    const getBestSource = (exclude = []) => {
      if (hasLocal && !exclude.includes('local')) return 'local';
      if (dzUrl && hasArl && !exclude.includes('deezer')) return 'deezer';
      if (extractedYtId && !exclude.includes('youtube')) return 'youtube';
      if (currentTrack.previewUrl && !exclude.includes('preview')) return 'preview';
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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (ytPlayerRef.current && ytPlayerReady) {
        try { ytPlayerRef.current.stopVideo(); } catch(e) {}
      }

      setIsPlaying(false);
      setIsBuffering(false);
      globalClock.pause();
      globalClock.seek(0);
      window.currentAudioTime = 0;
      if (progressBarRef.current) progressBarRef.current.value = 0;
      if (currentTimeRef.current) currentTimeRef.current.innerText = "0:00";
      
      trackIdRef.current = trackId;
      playIdRef.current = currentTrack.playId;
      lastPolledTimeRef.current = -1;
      setYtPlayerReady(false);

      const addToCache = (key, url) => {
        if (audioCacheRef.current.has(key)) return;
        if (audioCacheRef.current.size >= MAX_CACHE_SIZE) {
          const oldestKey = audioCacheRef.current.keys().next().value;
          URL.revokeObjectURL(audioCacheRef.current.get(oldestKey));
          audioCacheRef.current.delete(oldestKey);
        }
        audioCacheRef.current.set(key, url);
      };

      const loadAudio = async (source) => {
        if (!source) {
          setActiveSource(null);
          setAudioSrc(undefined);
          setYtVideoId(null);
          return;
        }

        activeSourceRef.current = source;

        if (source === 'youtube') {
          setAudioSrc(undefined);
          setYtVideoId(extractedYtId);
          setActiveSource('youtube');
        } else if (source === 'preview') {
          setYtVideoId(null);
          setAudioSrc(currentTrack.previewUrl);
          setActiveSource('preview');
        } else {
          setYtVideoId(null);

          if (source === 'local') {
            const file = await getAudioFile(trackId);
            if (file) {
              const url = URL.createObjectURL(file);
              addToCache(`local_${trackId}`, url);
              setAudioSrc(url);
              setActiveSource('local');
            } else {
              triggerFallbackMessage("Local audio missing. Falling back...");
              setFailedSources(prev => [...prev, 'local']);
            }
          } else if (source === 'deezer') {
            if (!hasArl) {
              triggerFallbackMessage("Deezer ARL required. Falling back...");
              setFailedSources(prev => [...prev, 'deezer']);
              return;
            }

            const cacheKey = `deezer_${trackId}`;
            if (audioCacheRef.current.has(cacheKey)) {
              setActiveSource('deezer');
              setAudioSrc(audioCacheRef.current.get(cacheKey));
              return;
            }
            
            setActiveSource('deezer');
            setIsBuffering(true);
            const controller = new AbortController();
            abortControllerRef.current = controller;
            
            try {
              const formData = new FormData();
              formData.append('session_id', `stream_${Date.now()}`);
              formData.append('url', dzUrl);
              formData.append('arl_token', settings?.deezerArl?.trim() || '');
              formData.append('quality', '1');
              formData.append('action', 'stream');
              formData.append('obfuscate', 'true');
              
              const response = await fetch('https://ytdownloader-jnt0.onrender.com/download-deezer', {
                method: 'POST',
                body: formData,
                signal: controller.signal
              });
              
              if (!response.ok) throw new Error("Deezer stream failed");
              
              const buffer = await response.arrayBuffer();
              const data = new Uint8Array(buffer);
              
              if (response.headers.get('X-Audio-Obfuscated') === 'true') {
                const OBFUSCATION_KEY = 0x5A;
                const limit = Math.min(data.length, 2048);
                for (let i = 0; i < limit; i++) {
                  data[i] ^= OBFUSCATION_KEY;
                }
              }

              const blob = new Blob([data], { type: 'audio/mpeg' });
              const url = URL.createObjectURL(blob);
              addToCache(cacheKey, url);
              
              if (!controller.signal.aborted) {
                setAudioSrc(url);
              }
            } catch (e) {
              if (e.name === 'AbortError') return;
              console.error("Deezer buffer error:", e);
              triggerFallbackMessage("Deezer stream failed. Falling back...");
              setFailedSources(prev => [...prev, 'deezer']);
            } finally {
              if (abortControllerRef.current === controller) {
                setIsBuffering(false);
              }
            }
          }
        }
      };

      loadAudio(intendedSource);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, settings?.deezerArl, failedSources]);

  useEffect(() => {
    if (!ytVideoId) return;
    let playerInstance = null;

    const initYTPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        setTimeout(initYTPlayer, 100);
        return;
      }
      const container = document.getElementById('yt-player-container');
      if (!container) return;
      
      container.innerHTML = '<div id="yt-player-target" style="width:100%;height:100%;"></div>';
      
      playerInstance = new window.YT.Player('yt-player-target', {
        videoId: ytVideoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: 1, playsinline: 1, rel: 0, enablejsapi: 1,
          suggestedQuality: 'small', origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            ytPlayerRef.current = event.target;
            setYtPlayerReady(true);
            try {
              if (typeof event.target.setPlaybackQuality === 'function') event.target.setPlaybackQuality('small');
              event.target.setVolume(volume * 100);
              const dur = event.target.getDuration();
              if (dur && !isNaN(dur)) setDuration(dur);
              
              if (pendingSeek !== null) {
                event.target.seekTo(pendingSeek, true);
                globalClock.seek(pendingSeek);
                setPendingSeek(null);
              }
              
              event.target.playVideo();
              setIsPlaying(true);
              emitPlayState(true, false);
            } catch (e) {}
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              const apiTime = ytPlayerRef.current?.getCurrentTime() || 0;
              globalClock.updateAnchor(apiTime, true);
              setIsPlaying(true);
              emitPlayState(true, false);
              
              if (ytPlayerRef.current) {
                if (typeof ytPlayerRef.current.setPlaybackQuality === 'function') ytPlayerRef.current.setPlaybackQuality('small');
                const dur = ytPlayerRef.current.getDuration();
                if (dur && !isNaN(dur)) setDuration(dur);
              }
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false); emitPlayState(false, false);
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false); emitPlayState(false, true);
            }
          },
          onError: (event) => {
            console.warn("YouTube Error Code:", event.data);
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
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
        try { ytPlayerRef.current.destroy(); } catch (e) {}
      }
      ytPlayerRef.current = null;
      setYtPlayerReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytVideoId]);

  // Sync clock time with UI
  useEffect(() => {
    let lastSecond = -1;
    const handleTimeUpdate = (e) => {
      const time = e.detail;
      const currentSecond = Math.floor(time);

      // 1. UPDATE VISUAL SLIDER AT 60FPS FOR BUTTERY SMOOTHNESS
      if (progressBarRef.current) {
        progressBarRef.current.value = time;
        progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
      }

      // 2. THROTTLE EXPENSIVE DOM TEXT RE-RENDERS TO 1FPS
      if (currentSecond !== lastSecond) {
        if (currentTimeRef.current) currentTimeRef.current.innerText = formatTime(time);
        lastSecond = currentSecond;
      }

      // DRIFT SYNC THROTTLE: Only cross-origin poll native players once every 2 seconds
      const now = performance.now();
      if (now - lastSyncTimeRef.current > 2000) {
        if (ytVideoId && ytPlayerRef.current && isPlaying) {
          try {
            const ytTime = ytPlayerRef.current.getCurrentTime();
            if (ytTime !== undefined && ytTime !== lastPolledTimeRef.current) {
              globalClock.updateAnchor(ytTime);
              lastPolledTimeRef.current = ytTime;
              lastSyncTimeRef.current = now;
            }
          } catch (err) {}
        } else if (audioRef.current && isPlaying) {
          const audioTime = audioRef.current.currentTime;
          if (audioTime !== lastPolledTimeRef.current) {
            globalClock.updateAnchor(audioTime);
            lastPolledTimeRef.current = audioTime;
            lastSyncTimeRef.current = now;
          }
        }
      }
    };
    
    window.addEventListener('globalTimeUpdate', handleTimeUpdate);
    return () => window.removeEventListener('globalTimeUpdate', handleTimeUpdate);
  }, [duration, ytVideoId, isPlaying]);

  useEffect(() => {
    if (!ytVideoId && audioSrc && audioRef.current) {
      audioRef.current.volume = volume;
      if (pendingSeek === null) attemptPlay();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioSrc, ytVideoId]);

  useEffect(() => {
    const handleSeekRequest = (e) => {
      const { time, track } = e.detail;
      
      if (!currentTrack || currentTrack.trackId !== track.trackId) {
        setCurrentTrack({ ...track, playId: Date.now() });
        setPendingSeek(time);
      } else {
        if (time !== null) {
          globalClock.seek(time);
          if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
            try {
              ytPlayerRef.current.seekTo(time, true);
              if (!isPlaying) ytPlayerRef.current.playVideo();
            } catch (err) {}
          } else if (audioRef.current) {
            audioRef.current.currentTime = time;
            if (!isPlaying) attemptPlay();
            else emitPlayState(true, false);
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
      try { ytPlayerRef.current.setVolume(volume * 100); } catch (e) {}
    } else if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, ytVideoId, ytPlayerReady]);

  const togglePlay = (e) => {
    if (e) e.stopPropagation();
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      try {
        if (isPlaying) {
          ytPlayerRef.current.pauseVideo();
          setIsPlaying(false);
          emitPlayState(false, false);
        } else {
          ytLastPerfRef.current = performance.now();
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          emitPlayState(true, false);
        }
      } catch (err) {}
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        emitPlayState(false, false);
      } else attemptPlay();
    }
  };

  const openModal = () => {
    if (currentTrack && setSelectedSong) setSelectedSong(currentTrack);
  };

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
          try { ytPlayerRef.current.seekTo(newTime, true); } catch (err) {}
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
          try { ytPlayerRef.current.seekTo(newTime, true); } catch (err) {}
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
    if (audioRef.current && !ytVideoId) {
      setDuration(audioRef.current.duration);
      if (pendingSeek !== null) {
        audioRef.current.currentTime = pendingSeek;
        globalClock.seek(pendingSeek);
        attemptPlay();
        setPendingSeek(null);
      }
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const time = Number(e.target.value);
    globalClock.seek(time);
    
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      try {
        ytPlayerRef.current.seekTo(time, true);
        const isEnded = time >= duration && duration > 0;
        emitPlayState(isPlaying, isEnded);
      } catch (err) {}
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    }
    
    if (progressBarRef.current) progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
    if (currentTimeRef.current) currentTimeRef.current.innerText = formatTime(time);
  };

  const handleContainerClick = (e) => {
    if (e.target === progressBarRef.current) return;
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const time = percent * duration;
    
    globalClock.seek(time);
    
    if (ytVideoId && ytPlayerRef.current && ytPlayerReady) {
      try {
        ytPlayerRef.current.seekTo(time, true);
        const isEnded = time >= duration && duration > 0;
        emitPlayState(isPlaying, isEnded);
      } catch (err) {}
    } else if (audioRef.current) {
      audioRef.current.currentTime = time;
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    }
    
    if (progressBarRef.current) {
      progressBarRef.current.value = time;
      progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
    }
    if (currentTimeRef.current) currentTimeRef.current.innerText = formatTime(time);
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
    setVolume(vol);
    localStorage.setItem('playerVolume', vol);
  };

  const closePlayer = (e) => {
    e.stopPropagation();
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
    setIsPlaying(false);
    setIsBuffering(false);
    globalClock.pause();
    emitPlayState(false, true);
  };

  const playerUI = currentTrack ? (
    <div 
      className={`global-player glass-panel-heavy ${slotNode ? 'stacked' : ''} ${!selectedSong ? 'centered-mode' : ''}`}
      onClick={openModal}
      style={{ '--player-accent': accentColor, cursor: 'pointer' }}
    >
      <div className="player-top-row">
        <div className="player-info">
          <div className="album-art-container" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
            <img 
              src={currentTrack.artworkUrl100?.replace('100x100', '100x100') || undefined} 
              alt="Album art" 
              className={`album-art ${isPlaying ? 'playing' : 'paused'}`}
            />
            <div className={`play-overlay ${!isPlaying ? 'show-play' : ''}`}>
              {isPlaying ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              )}
            </div>
          </div>
          <div className="player-text">
            <MarqueeText className="track-title" text={currentTrack.trackName} />
            <MarqueeText className="artist-name" text={currentTrack.artistName} />
            <p className="source-text">
              {fallbackMessage ? (
                <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{fallbackMessage}</span>
              ) : isBuffering ? (
                "Buffering Stream..."
              ) : (
                activeSource === 'youtube' ? "YT Music Stream" :
                activeSource === 'local' ? "Local Audio File" :
                activeSource === 'deezer' ? "Deezer HQ Stream" :
                activeSource === 'preview' ? "iTunes Preview (30s)" :
                "No Playable Source Available"
              )}
            </p>
          </div>
        </div>

        <div className="player-right-controls" onClick={(e) => e.stopPropagation()}>
          <div className="volume-container">
            <span className="volume-icon">
              {volume === 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
              ) : volume < 0.5 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              )}
            </span>
            <div className="volume-slider-wrapper">
              <div className="volume-tooltip" style={{ background: accentColor, color: '#000' }}>{Math.round(volume * 100)}%</div>
              <input 
                type="range" 
                className="custom-slider volume-slider"
                min="0" max="1" step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                style={{ '--progress': `${volume * 100}%` }}
              />
            </div>
          </div>
          
          <button className="close-player" onClick={closePlayer} title="Close Player">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="player-bottom-row" onClick={(e) => e.stopPropagation()}>
        <span className="time-text" ref={currentTimeRef}>0:00</span>
        <div 
          className="progress-container"
          onClick={handleContainerClick}
          onMouseMove={handleProgressMouseMove}
          onMouseLeave={handleProgressMouseLeave}
          onTouchStart={handleProgressMouseLeave}
        >
          <div 
            className="progress-tooltip" 
            style={{ 
              opacity: hoverTime !== null ? 1 : 0,
              left: hoverTime !== null ? `${(hoverTime / (duration || 1)) * 100}%` : '0%'
            }}
          >
            {formatTime(hoverTime || 0)}
          </div>
          <input 
            type="range" 
            className="custom-slider progress-slider"
            ref={progressBarRef}
            min="0" max={duration || 100}
            defaultValue="0"
            onChange={handleSeek}
            style={{ '--progress': `0%` }}
          />
        </div>
        <span className="time-text">{formatTime(duration)}</span>
      </div>
    </div>
  ) : null;

  return (
    <>
      <audio 
        ref={audioRef}
        crossOrigin="anonymous"
        src={audioSrc || undefined} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setIsPlaying(false); emitPlayState(false, true); }}
        onPlay={() => { setIsPlaying(true); emitPlayState(true, false); }}
        onPause={() => { setIsPlaying(false); emitPlayState(false, false); }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div 
        id="yt-player-container" 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0.01,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: -1
        }}
      ></div>
      {playerUI && (slotNode ? createPortal(playerUI, slotNode) : playerUI)}
    </>
  );
};

export default Player;