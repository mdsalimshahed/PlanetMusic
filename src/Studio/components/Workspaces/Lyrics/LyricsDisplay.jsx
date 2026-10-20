/* --- src/components/Workspaces/Lyrics/LyricsDisplay.jsx --- */
import React, { useEffect, useState } from 'react';
import LyricsEqualizer from './LyricsEqualizer.jsx';
import EditLyricsView from './Views/EditLyricsView.jsx';
import LiveScrollLyricsView from './Views/LiveScrollLyricsView.jsx';
import FocusedLyricsView from './Views/FocusedLyricsView.jsx';
import GroupChatLyricsView from './Views/GroupChatLyricsView.jsx';
import PlainLyricsView from './Views/PlainLyricsView.jsx';
import './LyricsDisplay.css';

const LyricsDisplay = ({
    isEditing, customData, handleDataChange, hasValidSyncData,
    lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, isSongModalReady, masterPalette, currentTrack,
    isPlaying, settings, lyricsPlaybackOffsetSeconds, singerImages, globalArtistData,
    showGroupChatDebug, shouldAnimateLiveEntrance, onLiveEntranceAnimationComplete
}) => {
  const isPlayingCurrentSong = Boolean(currentTrack && selectedSong && currentTrack.trackId === selectedSong.trackId);
  const [activeSource, setActiveSource] = useState(() => {
    const source = window.globalActiveSource;
    return source?.trackId === selectedSong?.trackId ? source.source : null;
  });

  useEffect(() => {
    const handleSource = (event) => {
      const source = event.detail || {};
      setActiveSource(source.trackId === selectedSong?.trackId ? source.source : null);
    };
    window.addEventListener('globalActiveSource', handleSource);
    return () => window.removeEventListener('globalActiveSource', handleSource);
  }, [selectedSong?.trackId]);

  return (
    <>
      {isEditing ? (
        <EditLyricsView 
          customData={customData}
          handleDataChange={handleDataChange}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
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
          lyricsPlaybackOffsetSeconds={lyricsPlaybackOffsetSeconds}
        />
      ) : hasValidSyncData && lyricsViewMode === 'live' ? (
        <LiveScrollLyricsView
          key={selectedSong?.trackId}
          liveParsedLyrics={liveParsedLyrics}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
          isPlayingCurrentSong={isPlayingCurrentSong}
          handleLineClick={handleLineClick}
          settings={settings}
          isSongModalReady={isSongModalReady}
          lyricsPlaybackOffsetSeconds={lyricsPlaybackOffsetSeconds}
          shouldAnimateEntrance={shouldAnimateLiveEntrance}
          onEntranceAnimationComplete={onLiveEntranceAnimationComplete}
        />
      ) : hasValidSyncData && lyricsViewMode === 'group-chat' ? (
        <GroupChatLyricsView
          liveParsedLyrics={liveParsedLyrics}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
          artistImages={{
            ...(singerImages || {}),
            ...(globalArtistData?.images || {}),
            ...(customData?.artistImages || {})
          }}
          isPlayingCurrentSong={isPlayingCurrentSong}
          isPlaying={isPlaying}
          handleLineClick={handleLineClick}
          lyricsPlaybackOffsetSeconds={lyricsPlaybackOffsetSeconds}
          settings={settings}
          showDebug={showGroupChatDebug}
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
        activeSource={activeSource}
        isEditing={isEditing} 
      />
    </>
  );
};

export default React.memo(LyricsDisplay);