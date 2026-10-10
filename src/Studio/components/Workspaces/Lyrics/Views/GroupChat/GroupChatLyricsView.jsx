import React, { useMemo, useRef, useState } from 'react';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline
} from '../groupChatTimeline.js';
import GroupChatHeader from './components/GroupChatHeader.jsx';
import GroupChatHistory from './components/GroupChatHistory.jsx';
import GroupChatTypingIndicator from './components/GroupChatTypingIndicator.jsx';
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
  settings
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
    >
      <GroupChatHeader
        artists={timeline.artists}
        onlineArtists={new Set(playback.chatState.artists.map(artist => artist.name))}
        lastLineEndByArtist={lastLineEndByArtist}
        playbackTime={playback.playbackTime}
        imageSources={imageSources}
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
            hasMessages={history.some(item => item.type === 'message-chain')}
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
    </section>
  );
};

export default React.memo(GroupChatLyricsView);
