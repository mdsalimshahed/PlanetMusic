/* --- src/components/Player.jsx --- */
import React, { useRef, useState, useEffect } from 'react';
import { getAudioFile } from '../db';
import './Player.css';

const formatTime = (seconds) => {
  if (isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const Player = ({ currentTrack, setCurrentTrack }) => {
  const audioRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioSrc, setAudioSrc] = useState('');
  
  const [pendingSeek, setPendingSeek] = useState(null);
  
  const [volume, setVolume] = useState(() => {
    const savedVolume = localStorage.getItem('playerVolume');
    return savedVolume !== null ? parseFloat(savedVolume) : 1;
  });

  const emitPlayState = (playing, ended = false) => {
    window.dispatchEvent(new CustomEvent('globalPlayState', { detail: { isPlaying: playing, isEnded: ended } }));
  };

  useEffect(() => {
    if (!currentTrack) {
      setAudioSrc('');
      setPendingSeek(null); 
      emitPlayState(false, true);
      return;
    }

    const loadAudio = async () => {
      if (currentTrack.customLinks?.hasLocal) {
        const file = await getAudioFile(currentTrack.trackId);
        if (file) {
          setAudioSrc(URL.createObjectURL(file)); 
        } else {
          setAudioSrc(currentTrack.previewUrl);
        }
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
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  useEffect(() => {
    let animationFrameId;
    
    const tick = () => {
      if (audioRef.current && isPlaying) {
        const time = audioRef.current.currentTime;
        setProgress(time);
        window.dispatchEvent(new CustomEvent('globalTimeUpdate', { detail: time }));
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(tick);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      
      if (pendingSeek !== null) {
        audioRef.current.currentTime = pendingSeek;
        audioRef.current.play()
          .then(() => { setIsPlaying(true); emitPlayState(true, false); })
          .catch(() => {});
        setPendingSeek(null); 
      }
    }
  };

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      const isEnded = time >= duration && duration > 0;
      emitPlayState(isPlaying, isEnded);
    }
    setProgress(time);
    window.dispatchEvent(new CustomEvent('globalTimeUpdate', { detail: time }));
  };

  const handleVolumeChange = (e) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    localStorage.setItem('playerVolume', vol);
  };

  const closePlayer = () => {
    setCurrentTrack(null);
    setIsPlaying(false);
    emitPlayState(false, true);
  };

  if (!currentTrack) return null;

  return (
    <div className="global-player glass-panel-heavy">
      <audio 
        ref={audioRef}
        src={audioSrc} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => { setIsPlaying(false); emitPlayState(false, true); }}
        onPlay={() => { setIsPlaying(true); emitPlayState(true, false); }}
        onPause={() => { setIsPlaying(false); emitPlayState(false, false); }}
      />

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
          <p>{currentTrack.artistName}</p>
        </div>
      </div>
      
      <div className="player-center-controls">
        <div className="player-progress-container">
          <span className="time-text">{formatTime(progress)}</span>
          <input 
            type="range" 
            className="custom-slider progress-slider" 
            min="0" max={duration || 100} 
            value={progress} 
            onChange={handleSeek} 
            style={{ '--progress': `${(progress / (duration || 1)) * 100}%` }}
          />
          <span className="time-text">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player-right-controls">
        <span className="volume-icon">{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
        <input 
          type="range" 
          className="custom-slider volume-slider" 
          min="0" max="1" step="0.01" 
          value={volume} 
          onChange={handleVolumeChange} 
          style={{ '--progress': `${volume * 100}%` }}
        />
        <button className="close-player" onClick={closePlayer}>✕</button>
      </div>
    </div>
  );
};

export default Player;