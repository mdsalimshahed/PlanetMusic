/* --- src/components/SyncWorkspace.jsx --- */
import React from 'react';
import { formatPreciseTime } from '../utils/songHelpers';

const SyncWorkspace = ({
  syncData, activeSyncIndex, setActiveSyncIndex, syncProgress, syncDuration, setSyncDuration,
  isSyncPlaying, toggleSyncPlay, handleSyncSeek, playbackRate, handleSpeedChange,
  syncAudioRef, syncAudioSrc, handleSyncTimeUpdate, setIsSyncPlaying, activeLineRef
}) => {
  
  // Reliably capture audio length even if the file is instantly cached
  const handleAudioLoaded = (e) => {
    if (e.target.readyState > 0) {
      setSyncDuration(e.target.duration || 0);
    }
  };

  return (
    <div className="sync-mode-container">
      <div className="sync-player glass-panel">
        <button className="sync-play-btn" onClick={toggleSyncPlay}>{isSyncPlaying ? '⏸' : '▶'}</button>
        <span className="precise-time">{formatPreciseTime(syncProgress)}</span>
        <input 
          type="range" className="custom-slider sync-slider" 
          min="0" max={syncDuration || 1} step="0.001" 
          value={syncProgress} onChange={handleSyncSeek} 
        />
        <span className="precise-time">{formatPreciseTime(syncDuration)}</span>
      </div>

      <div className="sync-speed-deck glass-panel">
        <div className="speed-label-container">
          <span>Speed: <strong>{playbackRate.toFixed(2)}x</strong></span>
          {playbackRate !== 1.0 && (
            <button className="speed-reset-btn" onClick={() => handleSpeedChange({ target: { value: 1.0 }})}>Reset</button>
          )}
        </div>
        <input 
          type="range" className="custom-slider speed-slider" 
          min="0.5" max="2.0" step="0.05" 
          value={playbackRate} onChange={handleSpeedChange} 
        />
        <div className="speed-ticks">
          <span>0.5x</span><span>1.0x</span><span>1.5x</span><span>2.0x</span>
        </div>
      </div>

      <div className="sync-lines-container">
        {syncData.map((line, i) => {
          const isRecording = line.start !== null && line.end === null;
          const isSynced = line.start !== null && line.end !== null;
          
          return (
            <div 
              key={i}
              ref={i === activeSyncIndex ? activeLineRef : null}
              className={`sync-line ${i === activeSyncIndex ? 'active' : ''} ${isRecording ? 'recording' : ''} ${isSynced ? 'synced' : ''}`}
              onClick={() => {
                setActiveSyncIndex(i);
                if (line.start !== null && syncAudioRef.current) syncAudioRef.current.currentTime = line.start;
              }}
            >
              <div className="sync-text-wrapper">
                <span className="sync-text" style={line.isGradient ? { backgroundImage: line.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: line.color }}>
                  {line.text}
                </span>
                {line.pronunciation && <span className="sync-pronunciation">{line.pronunciation}</span>}
              </div>
              <span className="sync-time">{formatPreciseTime(line.start)} - {formatPreciseTime(line.end)}</span>
            </div>
          );
        })}
      </div>

      {/* AUDIO ELEMENT FIX: Double binding onDurationChange & onLoadedMetadata */}
      <audio 
        ref={syncAudioRef} 
        src={syncAudioSrc}
        onTimeUpdate={handleSyncTimeUpdate}
        onLoadedMetadata={handleAudioLoaded}
        onDurationChange={handleAudioLoaded}
        onEnded={() => setIsSyncPlaying(false)}
        onPlay={() => setIsSyncPlaying(true)}
        onPause={() => setIsSyncPlaying(false)}
      />
    </div>
  );
};

export default SyncWorkspace;