import React, { useMemo, useRef, useState } from 'react';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline
} from '../groupChatTimeline.js';
import GroupChatHeader from './components/GroupChatHeader.jsx';
import GroupChatHistory from './components/GroupChatHistory.jsx';
import GroupChatTypingIndicator from './components/GroupChatTypingIndicator.jsx';
import GroupChatDebugOverlay from '../../../../../../Application/components/GroupChatDebug/GroupChatDebugOverlay.jsx';
import useGroupChatPlayback from './hooks/useGroupChatPlayback.js';
import useGroupChatPresentation from './hooks/useGroupChatPresentation.js';
import './styles/index.css';

const GroupChatLyricsView = ({
  liveParsedLyrics,
  selectedSong,
  masterPalette,
  artistImages,
  isPlayingCurrentSong,
  isPlaying,
  handleLineClick,
  lyricsPlaybackOffsetSeconds = 0,
  settings,
  showDebug = false
}) => {
  const pendingScrollToLatestRef = useRef(false);
  const pendingScrollBehaviorRef = useRef('auto');
  const chatRef = useRef(null);
  const [expandedLineIndices, setExpandedLineIndices] = useState(new Set());
  const timeline = useMemo(() => buildGroupChatTimeline(
    liveParsedLyrics,
    selectedSong?.syncData,
    selectedSong?.artistName,
    masterPalette
  ), [liveParsedLyrics, selectedSong?.syncData, selectedSong?.artistName, masterPalette]);
  const playback = useGroupChatPlayback({
    timeline,
    isPlayingCurrentSong,
    lyricsPlaybackOffsetSeconds,
    setExpandedLineIndices,
    pendingScrollToLatestRef,
    pendingScrollBehaviorRef
  });
  const activeLineIndices = playback.activeLineIndices;
  useGroupChatPresentation({
    chatRef,
    activeLineIndices,
    chatState: playback.chatState,
    playbackEnded: playback.playbackEnded,
    settings,
    setExpandedLineIndices,
    pendingScrollToLatestRef,
    pendingScrollBehaviorRef
  });

  const history = buildGroupChatHistory(playback.chatState.messages);
  const artistByName = new Map(timeline.artists.map(artist => [artist.name, artist]));
  const imageSources = {
    ...(selectedSong?.artistImages || {}),
    ...(artistImages || {})
  };
  const lastLineEndByArtist = new Map();
  playback.chatState.messages.forEach(event => {
    if (event.type !== 'message') return;
    event.line.artists.forEach(name => {
      lastLineEndByArtist.set(
        name,
        Math.max(lastLineEndByArtist.get(name) ?? Number.NEGATIVE_INFINITY, event.line.end)
      );
    });
  });
  const messageProps = {
    artistByName,
    imageSources,
    masterPalette,
    liveParsedLyrics,
    settings,
    activeLineIndices,
    showDebug,
    expandedLineIndices,
    playbackEnded: playback.playbackEnded,
    handleLineClick,
    playbackTime: playback.playbackTime,
    isPlayingCurrentSong
  };

  return (
    <section
      className={`group-chat ${settings?.disableAnimations ? 'group-chat-no-motion' : ''}`}
      aria-label="Lyrics group chat"
      style={{
        '--chat-heading-active-avatar-size': `${settings?.groupChatActiveAvatarSize ?? 5}cqi`,
        '--chat-heading-inactive-avatar-size': `${settings?.groupChatInactiveAvatarSize ?? 3.5}cqi`,
        '--chat-bubble-avatar-size': `${settings?.groupChatBubbleAvatarSize ?? 4.25}cqi`,
        '--chat-artist-name-size': `${settings?.groupChatArtistNameSize ?? 1.25}cqi`,
        '--chat-timestamp-size': `${settings?.groupChatTimestampSize ?? 1.125}cqi`,
        '--chat-notification-size': `${settings?.groupChatNotificationSize ?? 1.375}cqi`,
        '--chat-avatar-ring-thickness': `${settings?.groupChatAvatarRingThickness ?? 0.12}cqi`
      }}
      data-avatar-ring={settings?.groupChatAvatarRingEnabled !== false}
    >
      <GroupChatHeader
        artists={timeline.artists}
        onlineArtists={new Set(playback.chatState.artists.map(artist => artist.name))}
        lastLineEndByArtist={lastLineEndByArtist}
        playbackTime={playback.playbackTime}
        imageSources={imageSources}
        disableAnimations={settings?.disableAnimations}
      />
      <div className="group-chat-conversation">
        <div
          className="group-chat-history"
          ref={chatRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <GroupChatHistory
            history={history}
            playbackTime={playback.playbackTime}
            messageProps={messageProps}
          />
        </div>
      </div>
      <div
        className="group-chat-typing-footer"
        aria-hidden={!isPlaying || !playback.displayTypingNames}
      >
        {isPlaying && playback.displayTypingNames && (
          <GroupChatTypingIndicator
            artistNames={playback.displayTypingNames.split(', ')}
            artistByName={artistByName}
            imageSources={imageSources}
            isVisible={playback.typingIndicatorVisible}
          />
        )}
      </div>
      {showDebug && <GroupChatDebugOverlay />}
    </section>
  );
};

export default React.memo(GroupChatLyricsView);
