import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline,
  getSingingArtistGroups
} from '../groupChatTimeline.js';
import GroupChatHeader from './components/GroupChatHeader.jsx';
import GroupChatHistory from './components/GroupChatHistory.jsx';
import GroupChatMessageChain from './components/GroupChatMessageChain.jsx';
import GroupChatTypingIndicator from './components/GroupChatTypingIndicator.jsx';
import GroupChatDebugOverlay from '../../../../../../Application/components/GroupChatDebug/GroupChatDebugOverlay.jsx';
import useGroupChatPlayback from './hooks/useGroupChatPlayback.js';
import useGroupChatPresentation from './hooks/useGroupChatPresentation.js';
import './styles/index.css';

const PREMEASUREMENT_BATCH_SIZE = 6;

const GroupChatLyricsView = ({
  syncWorkspaceLyrics,
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
  const premeasurementTaskRef = useRef(null);
  const [expandedLineIndices, setExpandedLineIndices] = useState(new Set());
  const [precomputedLayouts, setPrecomputedLayouts] = useState(() => new Map());
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
    syncWorkspaceLyrics,
    selectedSong?.syncData,
    selectedSong?.artistName,
    masterPalette
  ), [syncWorkspaceLyrics, selectedSong?.syncData, selectedSong?.artistName, masterPalette]);
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

  const history = useMemo(
    () => buildGroupChatHistory(playback.chatState.messages),
    [playback.chatState.messages]
  );
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
  const artistByName = useMemo(
    () => new Map(timeline.artists.map(artist => [artist.name, artist])),
    [timeline.artists]
  );
  const imageSources = useMemo(() => ({
    ...(selectedSong?.artistImages || {}),
    ...(artistImages || {})
  }), [artistImages, selectedSong?.artistImages]);
  const lastLineEndByArtist = useMemo(() => {
    const lastLineEnd = new Map();
    playback.chatState.messages.forEach(event => {
      if (event.type !== 'message') return;
      event.line.artists.forEach(name => {
        lastLineEnd.set(
          name,
          Math.max(lastLineEnd.get(name) ?? Number.NEGATIVE_INFINITY, event.line.end)
        );
      });
    });
    return lastLineEnd;
  }, [playback.chatState.messages]);
  const singingArtists = useMemo(
    () => getSingingArtistGroups(timeline, playback.playbackTime),
    [playback.playbackTime, timeline]
  );
  const {
    mainArtists: mainSingingArtists,
    adlibArtists: adlibSingingArtists,
    typingArtistOrder,
    mainArtistOrder: mainSingingArtistOrder,
    adlibArtistOrder: adlibSingingArtistOrder
  } = singingArtists;
  const messageProps = useMemo(() => ({
    artistByName,
    imageSources,
    masterPalette,
    settings,
    activeLineIndices,
    showDebug,
    expandedLineIndices,
    playbackEnded: playback.playbackEnded,
    handleLineClick,
    playbackTime: playback.playbackTime,
    isPlayingCurrentSong,
    layoutSignature
  }), [
    activeLineIndices,
    artistByName,
    expandedLineIndices,
    handleLineClick,
    imageSources,
    isPlayingCurrentSong,
    layoutSignature,
    masterPalette,
    playback.playbackEnded,
    playback.playbackTime,
    settings,
    showDebug
  ]);
  const cancelPremeasurementTask = useCallback(() => {
    const task = premeasurementTaskRef.current;
    if (!task) return;
    if (task.type === 'idle' && window.cancelIdleCallback) {
      window.cancelIdleCallback(task.id);
    } else {
      window.clearTimeout(task.id);
    }
    premeasurementTaskRef.current = null;
  }, []);
  useEffect(() => cancelPremeasurementTask, [cancelPremeasurementTask]);
  const handleLayoutReady = useCallback((lineIndex, key, layout) => {
    setPrecomputedLayouts(previous => {
      const current = previous.get(lineIndex);
      if (
        current?.key === key &&
        current.enabled === layout.enabled &&
        current.width === layout.width &&
        current.renderedGlyphWidth === layout.renderedGlyphWidth
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
      const advanceBatch = () => {
        premeasurementTaskRef.current = null;
        setPremeasurementProgress({
          layoutKey: premeasurementLayoutKey,
          messageEvents,
          start: batch.start + batch.expected.size
        });
      };
      if (window.requestIdleCallback) {
        const id = window.requestIdleCallback(advanceBatch, { timeout: 250 });
        premeasurementTaskRef.current = { type: 'idle', id };
      } else {
        const id = window.setTimeout(advanceBatch, 50);
        premeasurementTaskRef.current = { type: 'timeout', id };
      }
    }
  }, [
    expectedPremeasurementLines,
    messageEvents,
    premeasurementBatchStart,
    premeasurementLayoutKey
  ]);
  return (
    <section
      className={`group-chat${showDebug ? ' group-chat-debug-view' : ''}`}
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
          mainSingingArtists={mainSingingArtists}
          adlibSingingArtists={adlibSingingArtists}
          typingArtistOrder={typingArtistOrder}
          mainSingingArtistOrder={mainSingingArtistOrder}
          adlibSingingArtistOrder={adlibSingingArtistOrder}
          lastLineEndByArtist={lastLineEndByArtist}
          playbackTime={playback.playbackTime}
          imageSources={imageSources}
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
          aria-hidden={!isPlaying || !playback.typingIndicatorVisible}
        >
          {playback.displayTypingNames && (
            <GroupChatTypingIndicator
              artistNames={playback.displayTypingNames.split(', ')}
              artistByName={artistByName}
              imageSources={imageSources}
              isVisible={isPlaying && playback.typingIndicatorVisible}
            />
          )}
        </div>
        <GroupChatDebugOverlay showDebug={showDebug} />
      </div>
    </section>
  );
};

export default React.memo(GroupChatLyricsView);
