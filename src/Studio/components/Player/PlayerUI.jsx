/* --- src/Studio/components/Player/PlayerUI.jsx --- */
import React, { useRef, useState, useEffect } from 'react';
import { toSmartPunctuation } from '../../../utils/smartPunctuation.js';
import { formatPreciseTime } from '../../utils/songHelpers.js';

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
  const displayText = toSmartPunctuation(text);

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
        <span ref={textRef} className="marquee-text">{displayText}</span>
        {isOverflowing && <span className="marquee-text gap-pl">{displayText}</span>}
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
      <p className={`source-text ${isBuffering ? 'is-buffering' : ''}`}>
        {fallbackMessage ? (
          <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{fallbackMessage}</span>
        ) : isBuffering ? (
          <span className="buffering-status" role="status" aria-live="polite">
            <span>Buffering stream</span>
            <span className="buffering-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </span>
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

export const PlayerControls = ({
  volume, isMuted, handleVolumeChange, toggleMute, closePlayer, accentColor, isSyncWorkspaceActive
}) => (
  <div className={`player-right-controls ${isSyncWorkspaceActive ? 'sync-player-controls' : ''}`} onClick={(e) => e.stopPropagation()}>
    <div className={`volume-container ${isSyncWorkspaceActive ? 'sync-volume-container' : ''}`}>
      <button
        type="button"
        className="volume-icon"
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        aria-pressed={isMuted}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
        ) : volume < 0.5 ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
        )}
      </button>
      <div className="volume-slider-wrapper">
        {!isSyncWorkspaceActive && (
          <div className="volume-tooltip" style={{ background: accentColor, color: '#000' }}>
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </div>
        )}
        <input
          type="range"
          className="custom-slider volume-slider"
          min="0" max="1" step="0.01"
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          style={{ '--progress': `${(isMuted ? 0 : volume) * 100}%` }}
        />
      </div>
      {isSyncWorkspaceActive && (
        <span className="sync-volume-percentage" aria-live="polite">
          {Math.round((isMuted ? 0 : volume) * 100)}%
        </span>
      )}
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
  progressBarRef, currentTimeRef, isPrecise
}) => {
  const formatDisplayTime = isPrecise ? formatPreciseTime : formatTime;

  useEffect(() => {
    if (currentTimeRef.current) {
      currentTimeRef.current.innerText = formatDisplayTime(window.currentAudioTime || 0);
    }
  }, [formatDisplayTime, currentTimeRef]);

  return (
    <div className="player-bottom-row" onClick={(e) => e.stopPropagation()}>
      <span className="time-text" ref={currentTimeRef}>{formatDisplayTime(0)}</span>
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
          {formatDisplayTime(hoverTime || 0)}
        </div>
        <input
          type="range"
          className="custom-slider progress-slider"
          ref={progressBarRef}
          min="0" max={duration || 100}
          step={isPrecise ? 0.001 : undefined}
          defaultValue="0"
          onChange={handleSeek}
          style={{ '--progress': `0%` }}
        />
      </div>
      <span className="time-text">{formatDisplayTime(duration)}</span>
    </div>
  );
};

const PlayerUI = ({
  currentTrack, selectedSong, slotNode, isSyncWorkspaceActive, accentColor, openModal,
  isPlaying, togglePlay, fallbackMessage, isBuffering, activeSource,
  volume, isMuted, handleVolumeChange, toggleMute, closePlayer,
  duration, hoverTime, handleSeek, handleContainerClick, handleProgressMouseMove, handleProgressMouseLeave,
  progressBarRef, currentTimeRef, isPrecise
}) => {
  if (!currentTrack) return null;

  return (
    <div
      className={`global-player glass-panel-heavy ${slotNode ? 'stacked' : ''} ${isSyncWorkspaceActive ? 'sync-docked' : ''} ${!selectedSong ? 'centered-mode' : ''}`}
      onClick={isSyncWorkspaceActive ? undefined : openModal}
      style={{ '--player-accent': accentColor, cursor: isSyncWorkspaceActive ? 'default' : 'pointer' }}
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
          isMuted={isMuted}
          handleVolumeChange={handleVolumeChange}
          toggleMute={toggleMute}
          closePlayer={closePlayer}
          accentColor={accentColor}
          isSyncWorkspaceActive={isSyncWorkspaceActive}
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
        isPrecise={isPrecise}
      />
    </div>
  );
};

export default PlayerUI;