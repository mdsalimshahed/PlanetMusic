/* --- src/components/Workspaces/Lyrics/LyricsDisplay.jsx --- */
import React, { useEffect, useMemo, useState } from 'react';
import LyricsEqualizer from './LyricsEqualizer.jsx';
import EditLyricsView from './Views/EditLyricsView.jsx';
import LiveLyricsView from './Views/LiveLyricsView.jsx';
import FocusedLyricsView from './Views/FocusedLyricsView.jsx';
import GroupChatLyricsView from './Views/GroupChatLyricsView.jsx';
import PlainLyricsView from './Views/PlainLyricsView.jsx';
import { getSyncWorkspaceLyrics } from './syncWorkspaceLyrics.js';
import './LyricsDisplay.css';

const LyricsDisplay = ({
    isEditing, customData, handleDataChange, setIsEditing, handleAutoSyncDatabases,
    isLrcFetching, hasValidSyncData,
    lyricsViewMode, liveParsedLyrics, handleLineClick, selectedSong, masterPalette, currentTrack,
    isPlaying, isSaved, settings, lyricsPlaybackOffsetSeconds, singerImages, globalArtistData,
   showGroupChatDebug, isSongModalReady, shouldAnimateLiveEntrance
}) => {
 const isPlayingCurrentSong = Boolean(
   currentTrack &&
   selectedSong &&
   String(currentTrack.trackId) === String(selectedSong.trackId)
 );
  const selectedTrackKey = selectedSong?.trackId == null
    ? null
    : String(selectedSong.trackId);
  const isLiveViewActive = !isEditing &&
    hasValidSyncData &&
    lyricsViewMode === 'live';
  const [mountedLiveTrackKey, setMountedLiveTrackKey] = useState(null);
  if (isLiveViewActive && mountedLiveTrackKey !== selectedTrackKey) {
    setMountedLiveTrackKey(selectedTrackKey);
  }
  const shouldKeepLiveViewMounted = selectedTrackKey !== null &&
    (isLiveViewActive || mountedLiveTrackKey === selectedTrackKey);
  const shouldAnimateCurrentLiveEntrance = shouldAnimateLiveEntrance &&
    !(isPlaying && isPlayingCurrentSong);
  const syncWorkspaceLyrics = useMemo(
    () => getSyncWorkspaceLyrics(selectedSong?.syncData),
    [selectedSong?.syncData]
  );
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
          syncWorkspaceLyrics={syncWorkspaceLyrics}
          selectedSong={selectedSong}
          masterPalette={masterPalette}
          isPlayingCurrentSong={isPlayingCurrentSong}
          handleLineClick={handleLineClick}
          settings={settings}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          lyricsPlaybackOffsetSeconds={lyricsPlaybackOffsetSeconds}
        />
      ) : hasValidSyncData && lyricsViewMode === 'live' ? null
      : hasValidSyncData && lyricsViewMode === 'group-chat' ? (
        <GroupChatLyricsView
          syncWorkspaceLyrics={syncWorkspaceLyrics}
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
          isSaved={isSaved}
          setIsEditing={setIsEditing}
          handleAutoSyncDatabases={handleAutoSyncDatabases}
          isLrcFetching={isLrcFetching}
        />
      )}

      {shouldKeepLiveViewMounted && hasValidSyncData && !isEditing && (
        <div
          className={`live-lyrics-view-slot${isLiveViewActive ? '' : ' is-hidden'}`}
          aria-hidden={!isLiveViewActive}
          inert={!isLiveViewActive}
        >
          <LiveLyricsView
            key={selectedTrackKey}
            syncWorkspaceLyrics={syncWorkspaceLyrics}
            selectedSong={selectedSong}
            masterPalette={masterPalette}
            isPlayingCurrentSong={isPlayingCurrentSong}
            handleLineClick={handleLineClick}
            settings={settings}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            lyricsPlaybackOffsetSeconds={lyricsPlaybackOffsetSeconds}
            isSongModalReady={isSongModalReady}
            shouldAnimateEntrance={shouldAnimateCurrentLiveEntrance}
            isViewActive={isLiveViewActive}
          />
        </div>
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