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
  
  // Progress is detached from React state for extreme performance
  const progressBarRef = useRef(null);
  const currentTimeRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState('');
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
      setAudioSrc('');
      setPendingSeek(null); 
      emitPlayState(false, true);
      window.currentAudioTime = 0;
      if (progressBarRef.current) progressBarRef.current.value = 0;
      if (currentTimeRef.current) currentTimeRef.current.innerText = "0:00";
      return;
    }

    const loadAudio = async () => {
      if (currentTrack.customLinks?.hasLocal) {
        const file = await getAudioFile(currentTrack.trackId);
        setAudioSrc(file ? URL.createObjectURL(file) : currentTrack.previewUrl);
      } else {
        setAudioSrc(currentTrack.previewUrl);
      }
    };
    loadAudio();
  }, [currentTrack]);

  useEffect(() => {
    if (audioSrc && audioRef.current) {
      audioRef.current.volume = volume;
      if (pendingSeek === null) {
        audioRef.current.play()
          .then(() => { setIsPlaying(true); emitPlayState(true, false); })
          .catch(err => console.log("Autoplay prevented:", err));
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
            audioRef.current.play()
              .then(() => { setIsPlaying(true); emitPlayState(true, false); })
              .catch(() => {});
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
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const openModal = () => {
    if (currentTrack && setSelectedSong) setSelectedSong(currentTrack);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (!audioRef.current || !currentTrack) return;

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

  // CRITICAL FLICKER FIX: Replaced RequestAnimationFrame with a stable 50ms (20fps) setInterval loop.
  // This guarantees silky smooth visuals without overlapping logic loops causing frantic flashing.
  useEffect(() => {
    let intervalId;
    let lastSecond = -1;
    
    const tick = () => {
      if (audioRef.current && isPlaying) {
        const time = audioRef.current.currentTime;
        window.currentAudioTime = time;
        
        if (progressBarRef.current) {
          progressBarRef.current.value = time;
          const dur = duration || audioRef.current.duration || 1;
          progressBarRef.current.style.setProperty('--progress', `${(time / dur) * 100}%`);
        }
        
        const currentSecond = Math.floor(time);
        if (currentSecond !== lastSecond && currentTimeRef.current) {
          currentTimeRef.current.innerText = formatTime(time);
          lastSecond = currentSecond;
        }

        window.dispatchEvent(new CustomEvent('globalTimeUpdate', { detail: time }));
      }
    };

    if (isPlaying) {
      intervalId = setInterval(tick, 50);
    }

    return () => clearInterval(intervalId);
  }, [isPlaying, duration]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      window.currentAudioTime = audioRef.current.currentTime;
      if (pendingSeek !== null) {
        audioRef.current.currentTime = pendingSeek;
        window.currentAudioTime = pendingSeek;
        audioRef.current.play()
          .then(() => { setIsPlaying(true); emitPlayState(true, false); })
          .catch(() => {});
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
    setCurrentTrack(null);
    setIsPlaying(false);
    emitPlayState(false, true);
  };

  if (!currentTrack) return null;

  const playerUI = (
    <div 
      className={`global-player glass-panel-heavy ${slotNode ? 'stacked' : ''}`} 
      onClick={openModal}
      style={{ '--player-accent': accentColor, cursor: 'pointer' }}
    >
      <div className="player-top-row">
        <div className="player-info">
          <div className="album-art-container" onClick={togglePlay} title={isPlaying ? "Pause" : "Play"}>
            <img 
              src={currentTrack.artworkUrl100?.replace('100x100', '100x100')} 
              alt="Album art" 
              className={`album-art ${isPlaying ? 'playing' : 'paused'}`}
            />
            <div className={`play-overlay ${!isPlaying ? 'show-play' : ''}`}>
              {isPlaying ? '⏸' : '▶'}
            </div>
          </div>
          <div className="player-text">
            <h4 title={currentTrack.trackName}>{currentTrack.trackName}</h4>
            <p title={currentTrack.artistName}>{currentTrack.artistName}</p>
          </div>
        </div>

        <div className="player-right-controls" onClick={(e) => e.stopPropagation()}>
          <div className="volume-container">
            <span className="volume-icon">{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
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
          <button className="close-player" onClick={closePlayer}>✕</button>
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
  );

  return (
    <>
      <audio 
        ref={audioRef}
        src={audioSrc} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setIsPlaying(false); emitPlayState(false, true); }}
        onPlay={() => { setIsPlaying(true); emitPlayState(true, false); }}
        onPause={() => { setIsPlaying(false); emitPlayState(false, false); }}
      />
      {slotNode ? createPortal(playerUI, slotNode) : playerUI}
    </>
  );
};

export default Player;