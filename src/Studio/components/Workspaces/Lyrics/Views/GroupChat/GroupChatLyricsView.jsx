import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline
} from '../groupChatTimeline.js';
import GroupChatHeader from './components/GroupChatHeader.jsx';
import GroupChatHistory from './components/GroupChatHistory.jsx';
import GroupChatMessageChain from './components/GroupChatMessageChain.jsx';
import GroupChatTypingIndicator from './components/GroupChatTypingIndicator.jsx';
import GroupChatDebugOverlay from '../../../../../../Application/components/GroupChatDebug/GroupChatDebugOverlay.jsx';
import useGroupChatPlayback from './hooks/useGroupChatPlayback.js';
import useGroupChatPresentation from './hooks/useGroupChatPresentation.js';
import './styles/index.css';

const PREMEASUREMENT_BATCH_SIZE = 24;

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
  const [precomputedLayouts, setPrecomputedLayouts] = useState(() => new Map());
  const [previouslyShownLines, setPreviouslyShownLines] = useState(() => new Set());
  const [layoutSignature, setLayoutSignature] = useState('');
  const [premeasurementProgress, setPremeasurementProgress] = useState({
    layoutKey: null,
    messageEvents: null,
    start: 0
  });
  const premeasurementProgressRef = useRef({
    layoutKey: null,
    messageEvents: null,
    start: -1,
    expected: new Set(),
    completed: new Set(),
    advanced: false
  });
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
      const width = bounds.width;
      const splitRatio = Number.parseFloat(
        getComputedStyle(chat).getPropertyValue('--dyn-modal-split')
      );
      const leftSplit = Number.isFinite(splitRatio) ? splitRatio : 50;
      const rightSplit = 100 - leftSplit;
      const designAspectRatio = (16 / 9) * (rightSplit / 100);
      const designHeight = width / designAspectRatio;
      const verticalUnit = designHeight / 100;
      const horizontalUnit = verticalUnit * (16 / 9);
      const nextSignature = `${width.toFixed(2)}:${verticalUnit.toFixed(4)}:${horizontalUnit.toFixed(4)}`;

      layout.style.width = '100%';
      layout.style.height = '100%';
      layout.style.transform = 'none';
      chat.style.setProperty('--chat-vh-unit', `${verticalUnit}px`);
      chat.style.setProperty('--chat-horizontal-unit', `${horizontalUnit}px`);
      setLayoutSignature(previous => (
        previous === nextSignature ? previous : nextSignature
      ));
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
  const messageEvents = useMemo(
    () => timeline.events.filter(event => event.type === 'message'),
    [timeline.events]
  );
  const premeasurementLayoutKey = JSON.stringify([
    layoutSignature,
    settings?.groupChatLyricFontSize ?? 2.2,
    settings?.groupChatLineWrapWidth ?? 60,
    settings?.groupChatBubbleAvatarSize ?? 4.25,
    settings?.groupChatTimestampSize ?? 1.125
  ]);
  const progressMatchesCurrentLayout = (
    premeasurementProgress.layoutKey === premeasurementLayoutKey &&
    premeasurementProgress.messageEvents === messageEvents
  );
  const premeasurementBatchStart = progressMatchesCurrentLayout
    ? premeasurementProgress.start
    : 0;
  const premeasurementBatch = useMemo(
    () => messageEvents.slice(
      premeasurementBatchStart,
      premeasurementBatchStart + PREMEASUREMENT_BATCH_SIZE
    ),
    [messageEvents, premeasurementBatchStart]
  );
  const expectedPremeasurementLines = useMemo(
    () => new Set(premeasurementBatch.map(event => event.line.index)),
    [premeasurementBatch]
  );
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
    isPlayingCurrentSong,
    layoutSignature
  };
  const handleLayoutReady = useCallback((lineIndex, key, layout) => {
    setPrecomputedLayouts(previous => {
      const current = previous.get(lineIndex);
      if (
        current?.key === key &&
        current.enabled === layout.enabled &&
        current.width === layout.width &&
        current.renderedGlyphWidth === layout.renderedGlyphWidth &&
        current.translationReferenceWidth === layout.translationReferenceWidth &&
        current.translationReferenceOffset === layout.translationReferenceOffset
      ) return previous;
      const next = new Map(previous);
      next.set(lineIndex, { ...layout, key });
      return next;
    });
    let batch = premeasurementProgressRef.current;
    if (
      batch.layoutKey !== premeasurementLayoutKey ||
      batch.messageEvents !== messageEvents ||
      batch.start !== premeasurementBatchStart
    ) {
      batch = {
        layoutKey: premeasurementLayoutKey,
        messageEvents,
        start: premeasurementBatchStart,
        expected: expectedPremeasurementLines,
        completed: new Set(),
        advanced: false
      };
      premeasurementProgressRef.current = batch;
    }
    if (!batch.expected.has(lineIndex) || batch.advanced) return;
    batch.completed.add(lineIndex);
    if (batch.completed.size === batch.expected.size) {
      batch.advanced = true;
      setPremeasurementProgress({
        layoutKey: premeasurementLayoutKey,
        messageEvents,
        start: batch.start + batch.expected.size
      });
    }
  }, [
    expectedPremeasurementLines,
    messageEvents,
    premeasurementBatchStart,
    premeasurementLayoutKey
  ]);
  const handleLineShown = useCallback(lineIndex => {
    setPreviouslyShownLines(previous => {
      if (previous.has(lineIndex)) return previous;
      const next = new Set(previous);
      next.add(lineIndex);
      return next;
    });
  }, []);
  return (
    <section
      className={`group-chat${showDebug ? ' group-chat-debug-view' : ''}${settings?.disableAnimations ? ' group-chat-no-motion' : ''}`}
      aria-label="Lyrics group chat"
      style={{
        '--chat-heading-active-avatar-size': `calc(${activeAvatarSize} * var(--chat-vh-unit, 1vh))`,
        '--chat-heading-inactive-avatar-size': `calc(${inactiveAvatarSize} * var(--chat-vh-unit, 1vh))`,
        '--chat-heading-inactive-avatar-scale': inactiveAvatarSize / activeAvatarSize,
        '--chat-line-wrap-width': `${lineWrapWidth}cqw`,
        '--chat-bubble-horizontal-padding': 'calc(var(--chat-horizontal-unit) * 0.75)',
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
              precomputedLayouts={precomputedLayouts}
              previouslyShownLines={previouslyShownLines}
              onLineShown={handleLineShown}
              containerRef={chatRef}
            />
          </div>
        </div>
        <div className="group-chat-premeasurement" aria-hidden="true">
          {premeasurementBatch.map((event, itemIndex) => {
            const group = {
              side: event.line.chatSide || 'left',
              artists: event.line.artists,
              events: [event]
            };
            return (
              <div className="group-chat-history-item" key={event.line.index}>
                <GroupChatMessageChain
                  {...messageProps}
                  group={group}
                  itemIndex={itemIndex}
                  showDebug={false}
                  isPremeasurement
                  onLayoutReady={handleLayoutReady}
                  layoutSignature={layoutSignature}
                />
              </div>
            );
          })}
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
        {showDebug && (
          <GroupChatDebugOverlay activeLineIndices={activeLineIndices} />
        )}
      </div>
    </section>
  );
};

export default React.memo(GroupChatLyricsView);
