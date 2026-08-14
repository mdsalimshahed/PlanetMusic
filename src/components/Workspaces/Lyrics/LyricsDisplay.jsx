/* --- src/components/Workspaces/Lyrics/LyricsDisplay.jsx --- */
import React from 'react';
import LyricsEqualizer from './LyricsEqualizer';
import EditLyricsView from './Views/EditLyricsView';
import LiveLyricsView from './Views/LiveLyricsView';
import FocusedLyricsView from './Views/FocusedLyricsView';
import PlainLyricsView from './Views/PlainLyricsView';
import './LyricsDisplay.css';

const LyricsDisplay = ({
    isEditing, customData, handleDataChange, hasValidSyncData,
    lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, masterPalette, currentTrack,
    isPlaying, settings 
}) => {
  const isPlayingCurrentSong = Boolean(currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId);

  return (
    <>
      {isEditing ? (
        <EditLyricsView 
          customData={customData}
          handleDataChange={handleDataChange}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
        />
      ) : hasValidSyncData && lyricsViewMode === 'live' ? (
        <LiveLyricsView 
          liveParsedLyrics={liveParsedLyrics}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
          isPlayingCurrentSong={isPlayingCurrentSong}
          handleLineClick={handleLineClick}
          settings={settings}
          currentTrack={currentTrack}
        />
      ) : hasValidSyncData && lyricsViewMode === 'focused' ? (
        <FocusedLyricsView 
          liveParsedLyrics={liveParsedLyrics}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
          isPlayingCurrentSong={isPlayingCurrentSong}
          handleLineClick={handleLineClick}
          settings={settings}
          currentTrack={currentTrack}
        />
      ) : (
        <PlainLyricsView 
          liveParsedLyrics={liveParsedLyrics}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
        />
      )}
      
      <LyricsEqualizer 
        isPlaying={isPlaying} 
        isPlayingCurrentSong={isPlayingCurrentSong} 
        disableAnimations={settings?.disableAnimations} 
        isEditing={isEditing} 
      />
    </>
  );
};

export default LyricsDisplay;