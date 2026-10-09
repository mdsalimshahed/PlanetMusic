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

const ArtistPresenceAvatar = ({ artist, artistIndex, isOnline, image }) => {
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
      className={`group-chat-participant${isOnline ? ' is-online' : ' is-offline'}`}
      style={{ '--artist-color': artist.color, '--presence-index': artistIndex }}
      aria-label={`${artist.name}, ${isOnline ? 'online' : 'offline'}`}
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
  const [playbackTime, setPlaybackTime] = useState(() => (
    isPlayingCurrentSong ? Math.max(0, (window.currentAudioTime || 0) - lyricsPlaybackOffsetSeconds) : 0
  ));
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
  const history = buildGroupChatHistory(chatState.messages);
  const hasMessages = history.some(item => item.type === 'message-chain');
  const typingNames = chatState.typingArtists.join(', ');
  const latestMessage = chatState.messages[chatState.messages.length - 1];
  const latestMessageType = latestMessage?.type;
  const latestMessageTime = latestMessage?.time;
  const previousLatestMessageRef = useRef(latestMessage);

  useEffect(() => {
    if (latestMessage === previousLatestMessageRef.current) return undefined;
    previousLatestMessageRef.current = latestMessage;
    if (!isPlaying || latestMessage?.type !== 'message') return undefined;

    const turn = Array.from(
      chatRef.current?.querySelectorAll('[data-chat-line-index]') || []
    ).find(element => element.dataset.chatLineIndex === String(latestMessage.line.index));
    if (!turn) return undefined;

    turn.classList.remove('group-chat-turn-entering');
    void turn.offsetWidth;
    turn.classList.add('group-chat-turn-entering');
    const enterTimer = setTimeout(() => {
      turn.classList.remove('group-chat-turn-entering');
    }, 380);
    return () => {
      clearTimeout(enterTimer);
      turn.classList.remove('group-chat-turn-entering');
    };
  }, [isPlaying, latestMessage]);

  useEffect(() => {
    let endedTimer = null;
    const updateTime = rawTime => {
      const time = Number.isFinite(rawTime) ? rawTime - lyricsPlaybackOffsetSeconds : 0;
      setPlaybackTime(isPlayingCurrentSong ? Math.max(0, time) : 0);
    };
    const handleTimeUpdate = event => {
      if (endedTimer) clearTimeout(endedTimer);
      updateTime(event.detail);
    };
    const handlePlayState = event => {
      if (!event.detail?.isEnded || !isPlayingCurrentSong) {
        if (endedTimer) clearTimeout(endedTimer);
        if (!isPlayingCurrentSong) setPlaybackTime(0);
        return;
      }

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
      window.removeEventListener('globalTimeUpdate', handleTimeUpdate);
      window.removeEventListener('globalPlayState', handlePlayState);
    };
  }, [isPlayingCurrentSong, lyricsPlaybackOffsetSeconds, timeline]);

  useLayoutEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatState.messages.length, latestMessageType, latestMessageTime, typingNames]);

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
              return (
                <ArtistPresenceAvatar
                  key={artist.name}
                  artist={artist}
                  artistIndex={artistIndex}
                  isOnline={isOnline}
                  image={getArtistImage(artist.name, imageSources)}
                />
              );
            })}
          </div>
        </div>
      </header>

      <div className="group-chat-history" ref={chatRef} role="log" aria-live="polite" aria-relevant="additions">
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
          return (
            <div
              className={`group-chat-chain group-chat-chain-${group.side}`}
              key={`chain-${firstLine.index}-${itemIndex}`}
              style={{ '--message-color': color }}
            >
              {group.events.map((event, eventIndex) => {
                const { line } = event;
                const isActive = activeLineIndices.has(line.index);
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
                        className={`group-chat-message${isActive ? ' group-chat-message-active' : ''}`}
                        style={isActive ? {
                          '--bubble-progress': `${Math.min(
                            100,
                            ((playbackTime - line.start) / (line.end - line.start)) * 100
                          )}%`
                        } : undefined}
                      >
                        <button
                          type="button"
                          className="group-chat-message-line"
                          onClick={() => handleLineClick(line.start)}
                          aria-label={`${name}: ${line.text}`}
                        >
                          <span className="group-chat-message-text">
                            {renderLine(lyricLine, line.savedNode, true, masterPalette, isPlayingCurrentSong)}
                          </span>
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
        {isPlaying && chatState.typingArtists.length > 0 && (
          <div className="group-chat-typing" key={typingNames} aria-label={`${typingNames} typing`}>
            <span className="group-chat-typing-avatar" style={{ '--artist-color': artistByName.get(chatState.typingArtists[0])?.color || '#a8b4c7' }}>
              <span>{getInitials(chatState.typingArtists[0])}</span>
              {getArtistImage(chatState.typingArtists[0], imageSources) && (
                <img
                  src={getArtistImage(chatState.typingArtists[0], imageSources)}
                  alt=""
                  onError={event => { event.currentTarget.hidden = true; }}
                />
              )}
            </span>
            <span className="group-chat-typing-dots" aria-hidden="true"><i /><i /><i /></span>
            <span>{typingNames} typing</span>
          </div>
        )}
      </div>
    </section>
  );
};

export default React.memo(GroupChatLyricsView);
