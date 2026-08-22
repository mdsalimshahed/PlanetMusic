/* --- src/Studio/components/Player/PlayerUI.jsx --- */
import React, { useRef, useState, useEffect } from 'react';

// Exported for the logic hook to use when updating the raw DOM refs
export const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds === null) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const MarqueeText = ({ text, className }) => {
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

export const PlayerInfo = ({ currentTrack, isPlaying, togglePlay, fallbackMessage, isBuffering, activeSource }) => (
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
);

export const PlayerControls = ({ volume, handleVolumeChange, closePlayer, accentColor }) => (
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
);

export const PlayerProgress = ({
  duration, hoverTime, handleSeek, handleContainerClick,
  handleProgressMouseMove, handleProgressMouseLeave,
  progressBarRef, currentTimeRef
}) => (
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
);

const PlayerUI = ({
  currentTrack, selectedSong, isStacked, slotNode, accentColor, openModal,
  isPlaying, togglePlay, fallbackMessage, isBuffering, activeSource,
  volume, handleVolumeChange, closePlayer,
  duration, hoverTime, handleSeek, handleContainerClick, handleProgressMouseMove, handleProgressMouseLeave,
  progressBarRef, currentTimeRef
}) => {
  if (!currentTrack) return null;

  return (
    <div
      className={`global-player glass-panel-heavy ${slotNode ? 'stacked' : ''} ${!selectedSong ? 'centered-mode' : ''}`}
      onClick={openModal}
      style={{ '--player-accent': accentColor, cursor: 'pointer' }}
    >
      <div className="player-top-row">
        <PlayerInfo
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          fallbackMessage={fallbackMessage}
          isBuffering={isBuffering}
          activeSource={activeSource}
        />
        <PlayerControls
          volume={volume}
          handleVolumeChange={handleVolumeChange}
          closePlayer={closePlayer}
          accentColor={accentColor}
        />
      </div>
      <PlayerProgress
        duration={duration}
        hoverTime={hoverTime}
        handleSeek={handleSeek}
        handleContainerClick={handleContainerClick}
        handleProgressMouseMove={handleProgressMouseMove}
        handleProgressMouseLeave={handleProgressMouseLeave}
        progressBarRef={progressBarRef}
        currentTimeRef={currentTimeRef}
      />
    </div>
  );
};

export default PlayerUI;