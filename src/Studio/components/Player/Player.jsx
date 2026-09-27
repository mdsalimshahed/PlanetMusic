/* --- src/Studio/components/Player/Player.jsx --- */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePlayerLogic } from './usePlayerLogic.js';
import PlayerUI from './PlayerUI.jsx';
import './Player.css';

const Player = ({ onPlaybackVisualChange, ...props }) => {
  const { refs, state, handlers } = usePlayerLogic(props);

  useEffect(() => {
    onPlaybackVisualChange?.({
      isPlaying: state.isPlaying,
      albumAccentColor: state.currentTrack?.artworkUrl100 && state.accentArtworkUrl === state.currentTrack.artworkUrl100
        ? state.accentColor
        : null
    });
  }, [onPlaybackVisualChange, state.isPlaying, state.currentTrack, state.accentArtworkUrl, state.accentColor]);

  const playerUI = state.currentTrack ? (
    <PlayerUI
      currentTrack={state.currentTrack}
      selectedSong={state.selectedSong}
      isStacked={state.isStacked}
      slotNode={state.slotNode}
      accentColor={state.accentColor}
      isPlaying={state.isPlaying}
      togglePlay={handlers.togglePlay}
      fallbackMessage={state.fallbackMessage}
      isBuffering={state.isBuffering}
      activeSource={state.activeSource}
      volume={state.volume}
      isMuted={state.isMuted}
      handleVolumeChange={handlers.handleVolumeChange}
      toggleMute={handlers.toggleMute}
      closePlayer={handlers.closePlayer}
      duration={state.duration}
      hoverTime={state.hoverTime}
      handleSeek={handlers.handleSeek}
      handleContainerClick={handlers.handleContainerClick}
      handleProgressMouseMove={handlers.handleProgressMouseMove}
      handleProgressMouseLeave={handlers.handleProgressMouseLeave}
      progressBarRef={refs.progressBarRef}
      currentTimeRef={refs.currentTimeRef}
      openModal={handlers.openModal}
    />
  ) : null;

  return (
    <>
      <audio
        ref={refs.audioRef}
        crossOrigin="anonymous"
        src={state.audioSrc || undefined}
        onLoadedMetadata={handlers.handleLoadedMetadata}
        onEnded={handlers.handleAudioEnded}
        onPlay={handlers.handleAudioPlay}
        onPause={handlers.handleAudioPause}
        onContextMenu={handlers.handleAudioContextMenu}
      />
      
      <div
        id="yt-player-container"
        style={{
          position: 'fixed',
          top: 0,
          left: '-220px',
          width: '200px',
          height: '200px',
          opacity: 0.01,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: -1
        }}
      ></div>
      
      {playerUI && (state.slotNode ? createPortal(playerUI, state.slotNode) : playerUI)}
    </>
  );
};

export default Player;