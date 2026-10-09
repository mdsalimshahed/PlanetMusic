import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { renderLine } from '../LyricsLineRenderer.jsx';
import {
  buildGroupChatHistory,
  buildGroupChatTimeline,
  getActiveChatLines,
  getGroupChatState
} from './groupChatTimeline.js';
import './GroupChatLyricsView.css';

const getClockTime = (eventTime, playbackTime) => {
  const timestamp = new Date(Date.now() + (eventTime - playbackTime) * 1000);
  return timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const getInitials = name => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0].toLocaleUpperCase())
  .join('');

const getArtistImage = (artist, imageSources) => {
  const matchingKey = Object.keys(imageSources).find(name => name.toLocaleLowerCase() === artist.toLocaleLowerCase());
  return matchingKey ? imageSources[matchingKey] : null;
};

const GroupChatLyricText = React.memo(({
  line,
  savedNode,
  masterPalette,
  isPlayingCurrentSong
}) => (
  <span className="group-chat-message-text">
    {renderLine(line, savedNode, true, masterPalette, isPlayingCurrentSong)}
  </span>
));

const getBubbleBorderPath = (width, height, side, shape) => {
  const left = 1;
  const top = 1;
  const right = Math.max(left + 1, width - 1);
  const bottom = Math.max(top + 1, height - 1);
  const groupedCorner = shape === 'middle' || shape === 'last' ? 8 : 6;
  const topLeft = Math.min(20, (right - left) / 2, (bottom - top) / 2);
  const topRight = topLeft;
  const bottomLeft = Math.min(side === 'left' ? groupedCorner : 20, topLeft);
  const bottomRight = Math.min(side === 'right' ? groupedCorner : 20, topLeft);

  return [
    `M ${left + topLeft} ${top}`,
    `H ${right - topRight}`,
    `Q ${right} ${top} ${right} ${top + topRight}`,
    `V ${bottom - bottomRight}`,
    `Q ${right} ${bottom} ${right - bottomRight} ${bottom}`,
    `H ${left + bottomLeft}`,
    `Q ${left} ${bottom} ${left} ${bottom - bottomLeft}`,
    `V ${top + topLeft}`,
    `Q ${left} ${top} ${left + topLeft} ${top}`,
    'Z'
  ].join(' ');
};

const ActiveBubbleBorder = ({ colors, side, shape }) => {
  const borderRef = useRef(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const gradientId = `chat-border-${React.useId().replace(/:/g, '')}`;
  const gradientColors = colors.length > 1 ? colors : [...colors, ...colors];

  useLayoutEffect(() => {
    const border = borderRef.current;
    if (!border) return undefined;

    const updateSize = () => {
      const { width, height } = border.getBoundingClientRect();
      setSize(current => (
        current.width === width && current.height === height
          ? current
          : { width: Math.max(1, width), height: Math.max(1, height) }
      ));
    };

    updateSize();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateSize);
    observer.observe(border);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={borderRef}
      className="group-chat-active-border"
      viewBox={`0 0 ${size.width} ${size.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={size.width}
          y2={size.height}
        >
          {gradientColors.map((color, index) => (
            <stop
              key={`${color}-${index}`}
              offset={`${gradientColors.length > 1 ? (index / (gradientColors.length - 1)) * 100 : 0}%`}
              stopColor={color}
            />
          ))}
        </linearGradient>
      </defs>
      <path
        d={getBubbleBorderPath(size.width, size.height, side, shape)}
        pathLength="100"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const GroupChatTypingIndicator = ({
  artistNames,
  artistByName,
  imageSources,
  isVisible
}) => {
  const artistNamesKey = artistNames.join('\u0000');
  const [displayArtists, setDisplayArtists] = useState(() => (
    artistNames.map(name => ({ name, isExiting: false }))
  ));
  const displayArtistsRef = useRef(displayArtists);
  const artistNamesKeyRef = useRef(artistNamesKey);

  useEffect(() => {
    if (artistNamesKeyRef.current === artistNamesKey) return undefined;
    artistNamesKeyRef.current = artistNamesKey;
    const nextNames = artistNamesKey ? artistNamesKey.split('\u0000') : [];
    const activeNames = new Set(nextNames);
    const exitingArtists = displayArtistsRef.current
      .filter(artist => !activeNames.has(artist.name))
      .map(artist => ({ ...artist, isExiting: true }));
    const nextArtists = exitingArtists.length
      ? displayArtistsRef.current.map(artist => (
        activeNames.has(artist.name)
          ? { name: artist.name, isExiting: false }
          : { ...artist, isExiting: true }
      ))
      : nextNames.map(name => ({ name, isExiting: false }));
    const renderedNames = new Set(nextArtists.map(artist => artist.name));
    nextNames.forEach(name => {
      if (!renderedNames.has(name)) nextArtists.push({ name, isExiting: false });
    });

    displayArtistsRef.current = nextArtists;
    setDisplayArtists(nextArtists);
    const exitTimer = setTimeout(() => {
      const remainingArtists = (artistNamesKeyRef.current
        ? artistNamesKeyRef.current.split('\u0000')
        : []).map(name => ({ name, isExiting: false }));
      displayArtistsRef.current = remainingArtists;
      setDisplayArtists(remainingArtists);
    }, 200);

    return () => clearTimeout(exitTimer);
  }, [artistNamesKey]);

  return (
    <div
      className={`group-chat-typing${isVisible ? ' is-visible' : ' is-exiting'}`}
      aria-label={`${artistNames.join(', ')} typing`}
    >
      <span className="group-chat-typing-avatars" aria-hidden="true">
        {displayArtists.map(({ name: artistName, isExiting }, index) => {
          const artist = artistByName.get(artistName);
          const image = getArtistImage(artistName, imageSources);
          return (
            <span
              className={`group-chat-typing-avatar${isExiting ? ' is-exiting' : ''}`}
              key={artistName}
              style={{
                '--artist-color': artist?.color || '#a8b4c7',
                '--avatar-index': index,
                '--avatar-count': displayArtists.length,
                '--typing-stagger': `${index * 70}ms`
              }}
            >
              <span>{getInitials(artistName)}</span>
              {image && (
                <img
                  src={image}
                  alt=""
                  onError={event => { event.currentTarget.hidden = true; }}
                />
              )}
            </span>
          );
        })}
      </span>
      <span className="group-chat-typing-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="group-chat-typing-names">
        {displayArtists.map(({ name, isExiting }, index) => (
          <React.Fragment key={name}>
            {index > 0 && <span className="group-chat-typing-separator">, </span>}
            <span
              className={`group-chat-typing-name${isExiting ? ' is-exiting' : ''}`}
              style={{ '--typing-stagger': `${index * 70}ms` }}
            >
              {name}
            </span>
          </React.Fragment>
        ))}
        <span className="group-chat-typing-label">typing</span>
      </span>
    </div>
  );
};

const ArtistPresenceAvatar = ({
  artist,
  artistIndex,
  isOnline,
  isDimmed,
  image
}) => {
  const [isVisible, setIsVisible] = useState(isOnline);

  useEffect(() => {
    if (isOnline) {
      const enterFrame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(enterFrame);
    }

    const exitTimer = setTimeout(
      () => setIsVisible(false),
      300 + artistIndex * 85
    );
    return () => clearTimeout(exitTimer);
  }, [artistIndex, isOnline]);

  if (!isVisible) return null;

  return (
    <span
      className={[
        'group-chat-participant',
        isOnline ? 'is-online' : 'is-offline',
        isDimmed ? 'is-dimmed' : ''
      ].filter(Boolean).join(' ')}
      style={{ '--artist-color': artist.color, '--presence-index': artistIndex }}
      aria-label={`${artist.name}, ${isDimmed ? 'inactive' : isOnline ? 'online' : 'offline'}`}
      aria-hidden={!isOnline}
    >
      <span className="group-chat-avatar" aria-hidden="true">
        <span>{getInitials(artist.name)}</span>
        {image && (
          <img
            src={image}
            alt=""
            onError={event => { event.currentTarget.hidden = true; }}
          />
        )}
      </span>
    </span>
  );
};

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
  const chatRef = useRef(null);
  const entranceAnimationsRef = useRef([]);
  const seenMessageLineIdsRef = useRef(null);
  const activeLineIndicesRef = useRef(new Set());
  const [playbackEnded, setPlaybackEnded] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(() => (
    isPlayingCurrentSong ? Math.max(0, (window.currentAudioTime || 0) - lyricsPlaybackOffsetSeconds) : 0
  ));
  const playbackTimeRef = useRef(playbackTime);
  const pendingScrollToLatestRef = useRef(false);
  const timeline = useMemo(() => buildGroupChatTimeline(
    liveParsedLyrics,
    selectedSong?.syncData,
    selectedSong?.artistName,
    masterPalette
  ), [liveParsedLyrics, selectedSong?.syncData, selectedSong?.artistName, masterPalette]);
  const chatState = getGroupChatState(timeline, playbackTime);
  const activeLineIndices = new Set(
    isPlayingCurrentSong
      ? getActiveChatLines(timeline, playbackTime).map(line => line.index)
      : []
  );
  const activeLineIndicesKey = [...activeLineIndices].map(String).join('\u0000');
  const [expandedLineIndices, setExpandedLineIndices] = useState(
    () => new Set([...activeLineIndices].map(String))
  );
  const lastLineEndByArtist = new Map();
  chatState.messages.forEach(event => {
    if (event.type !== 'message') return;
    event.line.artists.forEach(name => {
      lastLineEndByArtist.set(
        name,
        Math.max(lastLineEndByArtist.get(name) ?? Number.NEGATIVE_INFINITY, event.line.end)
      );
    });
  });
  const history = buildGroupChatHistory(chatState.messages);
  const hasMessages = history.some(item => item.type === 'message-chain');
  const typingNames = chatState.typingArtists.join(', ');
  const typingNamesRef = useRef(typingNames);
  const [displayTypingNames, setDisplayTypingNames] = useState('');
  const displayTypingNamesRef = useRef('');
  const [typingIndicatorVisible, setTypingIndicatorVisible] = useState(false);
  const typingVisibleRef = useRef(false);
  const typingExitTimerRef = useRef(null);

  useEffect(() => {
    activeLineIndicesRef.current = new Set(
      activeLineIndicesKey ? activeLineIndicesKey.split('\u0000') : []
    );
  }, [activeLineIndicesKey]);

  useEffect(() => {
    const container = chatRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(entries => {
      const leavingView = entries
        .filter(entry => !entry.isIntersecting)
        .map(entry => entry.target.dataset.chatLineIndex);
      if (!leavingView.length) return;

      setExpandedLineIndices(current => {
        const next = new Set(current);
        leavingView.forEach(index => {
          if (!activeLineIndicesRef.current.has(index)) next.delete(index);
        });
        return next.size === current.size ? current : next;
      });
    }, {
      root: container,
      threshold: 0.01
    });

    container.querySelectorAll('[data-chat-line-index]').forEach(turn => observer.observe(turn));
    return () => observer.disconnect();
  }, [chatState.messages.length]);

  useLayoutEffect(() => {
    const turns = Array.from(chatRef.current?.querySelectorAll('[data-chat-line-index]') || []);
    const currentIds = new Set(turns.map(turn => turn.dataset.chatLineIndex));
    const previousIds = seenMessageLineIdsRef.current;
    seenMessageLineIdsRef.current = currentIds;
    if (!previousIds) return undefined;

    const newTurns = turns.filter(turn => !previousIds.has(turn.dataset.chatLineIndex));
    if (
      !isPlaying ||
      settings?.disableAnimations ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }

    const newAnimations = newTurns.flatMap(turn => {
      const bubble = turn.querySelector('.group-chat-message');
      if (!bubble) return [];
      return [bubble.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 10px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        {
          duration: 340,
          easing: 'ease-out'
        }
      )];
    });
    entranceAnimationsRef.current.push(...newAnimations);
    newAnimations.forEach(animation => {
      animation.onfinish = () => {
        animation.cancel();
        entranceAnimationsRef.current = entranceAnimationsRef.current
          .filter(current => current !== animation);
      };
    });
  }, [chatState.messages.length, isPlaying, settings?.disableAnimations]);

  useEffect(() => () => {
    entranceAnimationsRef.current.forEach(animation => animation.cancel());
  }, []);

  useEffect(() => {
    let endedTimer = null;
    const updateTime = rawTime => {
      const time = Number.isFinite(rawTime) ? rawTime - lyricsPlaybackOffsetSeconds : 0;
      const nextTime = isPlayingCurrentSong ? Math.max(0, time) : 0;
      const previousTime = playbackTimeRef.current;
      const crossedEvents = nextTime > previousTime
        ? timeline.events.filter(event =>
          event.time > previousTime &&
          event.time <= nextTime
        )
        : [];
      const hasPresenceChanges = nextTime > previousTime &&
        crossedEvents.some(event => event.type === 'join' || event.type === 'leave');
      const hasMessageEvents = crossedEvents.some(event => event.type === 'message');
      const nextTypingNames = getGroupChatState(timeline, nextTime).typingArtists.join(', ');
      const typingChanged = nextTypingNames !== typingNamesRef.current;
      typingNamesRef.current = nextTypingNames;
      if (nextTypingNames) {
        if (typingExitTimerRef.current) {
          clearTimeout(typingExitTimerRef.current);
          typingExitTimerRef.current = null;
        }
        if (typingChanged || !typingVisibleRef.current) {
          displayTypingNamesRef.current = nextTypingNames;
          setDisplayTypingNames(nextTypingNames);
          typingVisibleRef.current = true;
          setTypingIndicatorVisible(true);
        }
      } else if (displayTypingNamesRef.current && typingVisibleRef.current) {
        typingVisibleRef.current = false;
        setTypingIndicatorVisible(false);
        if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
        typingExitTimerRef.current = setTimeout(() => {
          displayTypingNamesRef.current = '';
          setDisplayTypingNames('');
          typingExitTimerRef.current = null;
        }, 260);
      }
      const activeIndices = getActiveChatLines(timeline, nextTime).map(line => String(line.index));
      if (activeIndices.length) {
        setExpandedLineIndices(current => {
          const next = new Set(current);
          activeIndices.forEach(index => next.add(index));
          return next.size === current.size ? current : next;
        });
      }
      if (hasMessageEvents || hasPresenceChanges) {
        pendingScrollToLatestRef.current = true;
      }
      playbackTimeRef.current = nextTime;
      setPlaybackTime(nextTime);
    };
    const handleTimeUpdate = event => {
      if (endedTimer) clearTimeout(endedTimer);
      updateTime(event.detail);
    };
    const handlePlayState = event => {
      if (!event.detail?.isEnded || !isPlayingCurrentSong) {
        setPlaybackEnded(false);
        setExpandedLineIndices(current => {
          const activeIndices = getActiveChatLines(
            timeline,
            Math.max(0, (window.currentAudioTime || 0) - lyricsPlaybackOffsetSeconds)
          ).map(line => String(line.index));
          if (!activeIndices.length) return current;
          const next = new Set(current);
          activeIndices.forEach(index => next.add(index));
          return next.size === current.size ? current : next;
        });
        if (endedTimer) clearTimeout(endedTimer);
        if (!isPlayingCurrentSong) setPlaybackTime(0);
        return;
      }

      pendingScrollToLatestRef.current = true;
      setPlaybackEnded(true);
      setExpandedLineIndices(new Set());
      const endedAt = Math.max(0, (window.currentAudioTime || 0) - lyricsPlaybackOffsetSeconds);
      updateTime(window.currentAudioTime || 0);
      const finalOfflineTime = Math.max(endedAt, ...timeline.artists.map(artist => artist.offlineAt));
      if (finalOfflineTime > endedAt) {
        endedTimer = setTimeout(() => setPlaybackTime(finalOfflineTime), (finalOfflineTime - endedAt) * 1000);
      }
    };

    window.addEventListener('globalTimeUpdate', handleTimeUpdate);
    window.addEventListener('globalPlayState', handlePlayState);
    updateTime(window.currentAudioTime || 0);
    return () => {
      if (endedTimer) clearTimeout(endedTimer);
      if (typingExitTimerRef.current) clearTimeout(typingExitTimerRef.current);
      window.removeEventListener('globalTimeUpdate', handleTimeUpdate);
      window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [isPlayingCurrentSong, lyricsPlaybackOffsetSeconds, timeline]);

  useLayoutEffect(() => {
    const container = chatRef.current;
    if (!container || !pendingScrollToLatestRef.current) return;

    const reduceMotion = settings?.disableAnimations ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reduceMotion ? 'auto' : 'smooth'
    });
    pendingScrollToLatestRef.current = false;
  }, [chatState.messages.length, isPlaying, settings?.disableAnimations]);

  const artistByName = new Map(timeline.artists.map(artist => [artist.name, artist]));
  const imageSources = {
    ...(selectedSong?.artistImages || {}),
    ...(artistImages || {})
  };

  return (
    <section
      className={`group-chat ${settings?.disableAnimations ? 'group-chat-no-motion' : ''}`}
      aria-label="Lyrics group chat"
    >
      <header className="group-chat-header">
        <div className="group-chat-heading">
          <div className="group-chat-participants" aria-live="polite">
            {timeline.artists.map((artist, artistIndex) => {
              const isOnline = chatState.artists.some(activeArtist => activeArtist.name === artist.name);
              const lastLineEnd = lastLineEndByArtist.get(artist.name);
              return (
                <ArtistPresenceAvatar
                  key={artist.name}
                  artist={artist}
                  artistIndex={artistIndex}
                  isOnline={isOnline}
                  isDimmed={
                    lastLineEnd != null &&
                    playbackTime - lastLineEnd > 5
                  }
                  image={getArtistImage(artist.name, imageSources)}
                />
              );
            })}
          </div>
        </div>
      </header>

      <div className="group-chat-conversation">
        <div
          className="group-chat-history"
          ref={chatRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
        <div className="group-chat-history-content">
        {!hasMessages && (
          <p className="group-chat-empty">The group is waiting for the conversation to start.</p>
        )}
        {history.map((item, itemIndex) => {
          if (item.type !== 'message-chain') {
            const { event } = item;
            return (
              <div
                className="group-chat-system-message"
                key={`${item.type}-${event.artist.name}-${event.time}-${itemIndex}`}
                role="status"
              >
                <span>{event.artist.name} {item.type === 'join' ? 'joined the chat' : 'left the chat'}</span>
                <time>{getClockTime(event.time, playbackTime)}</time>
              </div>
            );
          }

          const group = item;
          const name = group.artists.join(', ');
          const firstLine = group.events[0].line;
          const color = artistByName.get(group.artists[0])?.color || firstLine.color;
          const artistColors = group.artists.map(artistName =>
            artistByName.get(artistName)?.color || color
          );
          return (
            <div
              className={`group-chat-chain group-chat-chain-${group.side}`}
              key={`chain-${firstLine.index}-${itemIndex}`}
              style={{ '--message-color': color }}
            >
              {group.events.map((event, eventIndex) => {
                const { line } = event;
                const isActive = activeLineIndices.has(line.index);
                const isExpanded = !playbackEnded &&
                  (isActive || expandedLineIndices.has(String(line.index)));
                const lyricLine = line.lyric || liveParsedLyrics[line.sourceIndex ?? line.index] || { text: line.text };
                const avatarCount = Math.max(1, group.artists.length);
                const avatarSlotWidth = 34 + 22 * (avatarCount - 1);
                const bubbleShape = group.events.length === 1
                  ? 'single'
                  : (eventIndex === group.events.length - 1 ? 'last' : 'middle');
                return (
                  <div
                    className={`group-chat-turn group-chat-turn-${group.side} group-chat-turn-${bubbleShape}`}
                    key={`turn-${line.index}`}
                    data-chat-line-index={line.index}
                  >
                    <span
                      className="group-chat-avatar-slot"
                      aria-hidden="true"
                      style={{
                        '--avatar-count': avatarCount,
                        '--avatar-slot-width': `${avatarSlotWidth}px`
                      }}
                    >
                      {eventIndex === group.events.length - 1 && (
                        <span className="group-chat-message-avatars">
                        {group.artists.map((artistName, index) => {
                          const image = getArtistImage(artistName, imageSources);
                          const artistColor = artistByName.get(artistName)?.color || color;
                          return (
                            <span
                              className="group-chat-message-avatar"
                              key={artistName}
                              style={{ '--artist-color': artistColor, '--avatar-index': index }}
                            >
                              <span>{getInitials(artistName || 'Artist')}</span>
                              {image && (
                                <img
                                  src={image}
                                  alt=""
                                  onError={imageEvent => { imageEvent.currentTarget.hidden = true; }}
                                />
                              )}
                            </span>
                          );
                        })}
                        </span>
                      )}
                    </span>
                    <div className="group-chat-bubble-stack">
                      <div
                        className={[
                          'group-chat-message',
                          isActive ? 'group-chat-message-active' : '',
                          isExpanded ? 'group-chat-message-expanded' : 'group-chat-message-shrunk'
                        ].filter(Boolean).join(' ')}
                      >
                        {isActive && (
                          <ActiveBubbleBorder
                            colors={artistColors}
                            side={group.side}
                            shape={bubbleShape}
                          />
                        )}
                        <button
                          type="button"
                          className="group-chat-message-line"
                          onClick={() => handleLineClick(line.start)}
                          aria-label={`${name}: ${line.text}`}
                        >
                          <GroupChatLyricText
                            line={lyricLine}
                            savedNode={line.savedNode}
                            masterPalette={masterPalette}
                            isPlayingCurrentSong={isPlayingCurrentSong}
                          />
                          <time>{getClockTime(event.time, playbackTime)}</time>
                        </button>
                      </div>
                      {eventIndex === group.events.length - 1 && (
                        <span className="group-chat-artist">
                          {group.artists.length
                            ? group.artists.map((artistName, index) => (
                              <React.Fragment key={artistName}>
                                {index > 0 && <span className="group-chat-artist-separator">, </span>}
                                <span style={{ color: artistByName.get(artistName)?.color || color }}>
                                  {artistName}
                                </span>
                              </React.Fragment>
                            ))
                            : 'Artist'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
      </div>
      <div
        className="group-chat-typing-footer"
        aria-hidden={!isPlaying || !displayTypingNames}
      >
        {isPlaying && displayTypingNames && (
          <GroupChatTypingIndicator
            artistNames={displayTypingNames.split(', ')}
            artistByName={artistByName}
            imageSources={imageSources}
            isVisible={typingIndicatorVisible}
          />
        )}
      </div>
    </section>
  );
};

export default React.memo(GroupChatLyricsView);
