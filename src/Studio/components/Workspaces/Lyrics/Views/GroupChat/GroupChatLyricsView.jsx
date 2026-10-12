import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const activeAvatarSize = settings?.groupChatActiveAvatarSize ?? 5;
  const inactiveAvatarSize = settings?.groupChatInactiveAvatarSize ?? 3.5;
  const lineWrapWidth = settings?.groupChatLineWrapWidth ?? 60;
  const pendingScrollToLatestRef = useRef(false);
  const chatRef = useRef(null);
  const chatLayoutRef = useRef(null);
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
    pendingScrollToLatestRef
  });
  const activeLineIndices = playback.activeLineIndices;
  useGroupChatPresentation({
    chatRef,
    activeLineIndices,
    chatState: playback.chatState,
    settings,
    setExpandedLineIndices,
    pendingScrollToLatestRef
  });

  useLayoutEffect(() => {
    const chat = chatLayoutRef.current?.parentElement;
    const layout = chatLayoutRef.current;
    if (!chat || !layout) return undefined;

    const updateScale = () => {
      const bounds = chat.getBoundingClientRect();
      const width = Math.max(
        0,
        Math.min(bounds.right, window.innerWidth) - Math.max(bounds.left, 0)
      );
      const splitRatio = Number.parseFloat(
        getComputedStyle(chat).getPropertyValue('--dyn-modal-split')
      );
      const leftSplit = Number.isFinite(splitRatio) ? splitRatio : 50;
      const rightSplit = 100 - leftSplit;
      const designAspectRatio = (16 / 9) * (rightSplit / 100);
      const designHeight = width / designAspectRatio;
      const verticalUnit = designHeight / 100;
      const horizontalUnit = verticalUnit * (16 / 9);

      layout.style.width = '100%';
      layout.style.height = '100%';
      layout.style.transform = 'none';
      chat.style.setProperty('--chat-vh-unit', `${verticalUnit}px`);
      chat.style.setProperty('--chat-horizontal-unit', `${horizontalUnit}px`);
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(chat);
    window.addEventListener('resize', updateScale);
    updateScale();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, []);

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
      className={`group-chat${showDebug ? ' group-chat-debug-view' : ''}${settings?.disableAnimations ? ' group-chat-no-motion' : ''}`}
      aria-label="Lyrics group chat"
      style={{
        '--chat-heading-active-avatar-size': `calc(${activeAvatarSize} * var(--chat-vh-unit, 1vh))`,
        '--chat-heading-inactive-avatar-size': `calc(${inactiveAvatarSize} * var(--chat-vh-unit, 1vh))`,
        '--chat-heading-inactive-avatar-scale': inactiveAvatarSize / activeAvatarSize,
        '--chat-line-wrap-width': `${lineWrapWidth}cqw`,
        '--chat-bubble-horizontal-padding': 'calc(var(--chat-horizontal-unit) * 1.1)',
        '--chat-bubble-avatar-size': `calc(${settings?.groupChatBubbleAvatarSize ?? 4.25} * var(--chat-vh-unit, 1vh))`,
        '--chat-lyric-font-size': `calc(${settings?.groupChatLyricFontSize ?? 2.2} * var(--chat-vh-unit, 1vh))`,
        '--chat-typing-font-size': `calc(${settings?.groupChatTypingFontSize ?? 1.1} * var(--chat-vh-unit, 1vh))`,
        '--chat-typing-avatar-size': `calc(${settings?.groupChatTypingAvatarSize ?? 2.4} * var(--chat-vh-unit, 1vh))`,
        '--chat-artist-name-size': `calc(${settings?.groupChatArtistNameSize ?? 1.25} * var(--chat-vh-unit, 1vh))`,
        '--chat-timestamp-size': `calc(${settings?.groupChatTimestampSize ?? 1.125} * var(--chat-vh-unit, 1vh))`,
        '--chat-notification-size': `calc(${settings?.groupChatNotificationSize ?? 1.375} * var(--chat-vh-unit, 1vh))`,
        '--chat-avatar-ring-thickness': `calc(${settings?.groupChatAvatarRingThickness ?? 0.12} * var(--chat-vh-unit, 1vh))`
      }}
      data-avatar-ring={settings?.groupChatAvatarRingEnabled !== false}
    >
      <div className="group-chat-layout" ref={chatLayoutRef}>
        <GroupChatHeader
          artists={timeline.artists}
          onlineArtists={new Set(playback.chatState.artists.map(artist => artist.name))}
          typingArtists={new Set(playback.chatState.typingArtists)}
          lastLineEndByArtist={lastLineEndByArtist}
          playbackTime={playback.playbackTime}
          imageSources={imageSources}
          disableAnimations={settings?.disableAnimations}
          inactiveScale={inactiveAvatarSize / activeAvatarSize}
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
              containerRef={chatRef}
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
      </div>
    </section>
  );
};

export default React.memo(GroupChatLyricsView);
