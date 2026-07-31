/* --- src/components/Player.jsx --- */
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getAudioFile } from '../db';
import './Player.css';

const formatTime = (seconds) => {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const Player = ({ currentTrack, setCurrentTrack, selectedSong, setSelectedSong }) => {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const progressBarRef = useRef(null);
  const currentTimeRef = useRef(null);

  const trackIdRef = useRef(null);
  const localRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState(undefined);
  const [accentColor, setAccentColor] = useState('#ffffff'); 
  const [pendingSeek, setPendingSeek] = useState(null);

  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem('playerVolume');
    return savedVolume !== null ? parseFloat(savedVolume) : 1;
  });

  const [isStacked, setIsStacked] = useState(window.innerWidth <= 900);
  const [slotNode, setSlotNode] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsStacked(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (selectedSong && isStacked) {
      setTimeout(() => {
        setSlotNode(document.getElementById('mobile-player-slot'));
      }, 50);
    } else {
      setSlotNode(null);
    }
  }, [selectedSong, isStacked]);

  const emitPlayState = (playing, ended = false) => {
    window.dispatchEvent(new CustomEvent('globalPlayState', { detail: { isPlaying: playing, isEnded: ended } }));
  };

  useEffect(() => {
    const handlePauseGlobal = () => {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        setIsPlaying(false);
        emitPlayState(false, false);
      }
    };
    window.addEventListener('pauseGlobalPlayer', handlePauseGlobal);
    return () => window.removeEventListener('pauseGlobalPlayer', handlePauseGlobal);
  }, []);

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

  const attemptPlay = async () => {
    if (!audioRef.current) return;
    initWebAudio();
    try {
      window.dispatchEvent(new CustomEvent('globalPlayerDidPlay'));
      await audioRef.current.play();
      setIsPlaying(true);
      emitPlayState(true, false);
    } catch (err) {
      console.log("Autoplay prevented:", err);
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
        canvas.width = 5;
        canvas.height = 5;
        ctx.drawImage(img, 0, 0, 5, 5);
        
        const data = ctx.getImageData(0, 0, 5, 5).data;
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          if (data[i+3] > 127 && (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20)) {
            r += data[i];
            g += data[i+1];
            b += data[i+2];
            count++;
          }
        }
        
        if (count > 0) {
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          
          const boost = 30; 
          r = Math.min(255, r + boost);
          g = Math.min(255, g + boost);
          b = Math.min(255, b + boost);
          setAccentColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch (e) {
        setAccentColor('#ffffff'); 
      } finally {
        img.onload = null;
        img.onerror = null;
        img.src = '';
        img = null;
      }
    };
    img.onerror = () => {
      setAccentColor('#ffffff');
      img.onload = null;
      img.onerror = null;
      img.src = '';
      img = null;
    };
    img.src = currentTrack.artworkUrl100;
  }, [currentTrack?.artworkUrl100]);

  useEffect(() => {
    if (!currentTrack) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setAudioSrc(undefined);
      setPendingSeek(null);
      setIsPlaying(false);
      emitPlayState(false, true);
      window.currentAudioTime = 0;
      trackIdRef.current = null;
      localRef.current = null;
      if (progressBarRef.current) progressBarRef.current.value = 0;
      if (currentTimeRef.current) currentTimeRef.current.innerText = "0:00";
      return;
    }

    const trackId = currentTrack.trackId;
    const hasLocal = currentTrack.customLinks?.hasLocal;

    if (trackId !== trackIdRef.current || hasLocal !== localRef.current) {
      trackIdRef.current = trackId;
      localRef.current = hasLocal;

      const loadAudio = async () => {
        if (hasLocal) {
          const file = await getAudioFile(trackId);
          setAudioSrc(file ? URL.createObjectURL(file) : currentTrack.previewUrl);
        } else {
          setAudioSrc(currentTrack.previewUrl);
        }
      };
      loadAudio();
    }
  }, [currentTrack]);

  useEffect(() => {
    if (audioSrc && audioRef.current) {
      audioRef.current.volume = volume;
      if (pendingSeek === null) {
        attemptPlay();
      }
    }
  }, [audioSrc]);

  useEffect(() => {
    const handleSeekRequest = (e) => {
      const { time, track } = e.detail;
      
      if (!currentTrack || currentTrack.trackId !== track.trackId) {
        setCurrentTrack(track);
        setPendingSeek(time); 
      } else {
        if (audioRef.current && time !== null) {
          audioRef.current.currentTime = time;
          window.currentAudioTime = time;
          if (!isPlaying) {
            attemptPlay();
          } else {
            emitPlayState(true, false);
          }
        }
      }
    };
    
    window.addEventListener('globalSeekRequest', handleSeekRequest);
    return () => window.removeEventListener('globalSeekRequest', handleSeekRequest);
  }, [currentTrack, isPlaying, setCurrentTrack]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const togglePlay = (e) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      emitPlayState(false, false);
    } else attemptPlay();
  };

  const openModal = () => {
    if (currentTrack && setSelectedSong) setSelectedSong(currentTrack);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (!audioRef.current || !currentTrack) return;
      
      if (document.querySelector('.sync-mode-container')) return;

      if (e.code === 'Space') {
        e.preventDefault(); 
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const newTime = Math.max(0, audioRef.current.currentTime - 5);
        audioRef.current.currentTime = newTime;
        window.currentAudioTime = newTime;
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const maxTime = duration || audioRef.current.duration;
        const newTime = Math.min(maxTime, audioRef.current.currentTime + 5);
        audioRef.current.currentTime = newTime;
        window.currentAudioTime = newTime;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, currentTrack]);

  useEffect(() => {
    let animationFrameId;
    let lastSecond = -1;
    let lastEventTime = 0;
    
    const tick = (timestamp) => {
      if (audioRef.current && isPlaying) {
        const time = audioRef.current.currentTime;
        window.currentAudioTime = time;
        
        // Update slider and emit global time at ~30 FPS for smooth rendering
        if (timestamp - lastEventTime > 33) {
          if (progressBarRef.current) {
            progressBarRef.current.value = time;
            const dur = duration || audioRef.current.duration || 1;
            progressBarRef.current.style.setProperty('--progress', `${(time / dur) * 100}%`);
          }
          window.dispatchEvent(new CustomEvent('globalTimeUpdate', { detail: time }));
          lastEventTime = timestamp;
        }

        // Only update raw text format once a second to avoid expensive repaints
        const currentSecond = Math.floor(time);
        if (currentSecond !== lastSecond) {
          if (currentTimeRef.current) {
            currentTimeRef.current.innerText = formatTime(time);
          }
          lastSecond = currentSecond;
        }
      }
      
      if (isPlaying) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, duration]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      window.currentAudioTime = audioRef.current.currentTime;
      if (pendingSeek !== null) {
        audioRef.current.currentTime = pendingSeek;
        window.currentAudioTime = pendingSeek;
        attemptPlay();
        setPendingSeek(null); 
      }
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      window.currentAudioTime = time;
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    }
    
    if (progressBarRef.current) {
      progressBarRef.current.style.setProperty('--progress', `${(time / (duration || 1)) * 100}%`);
    }
    if (currentTimeRef.current) {
      currentTimeRef.current.innerText = formatTime(time);
    }
    window.dispatchEvent(new CustomEvent('globalTimeUpdate', { detail: time }));
  };

  const handleVolumeChange = (e) => {
    e.stopPropagation();
    const vol = Number(e.target.value);
    setVolume(vol);
    localStorage.setItem('playerVolume', vol);
  };

  const closePlayer = (e) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause(); 
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    emitPlayState(false, true);
  };

  const playerUI = currentTrack ? (
    <div 
      className={`global-player glass-panel-heavy ${slotNode ? 'stacked' : ''}`} 
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
            <h4 title={currentTrack.trackName}>{currentTrack.trackName}</h4>
            <p title={currentTrack.artistName}>{currentTrack.artistName}</p>
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
        <input 
          type="range" 
          className="custom-slider progress-slider" 
          ref={progressBarRef}
          min="0" max={duration || 100} 
          defaultValue="0"
          onChange={handleSeek} 
          style={{ '--progress': `0%` }}
        />
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
      />
      {playerUI && (slotNode ? createPortal(playerUI, slotNode) : playerUI)}
    </>
  );
};

export default Player;