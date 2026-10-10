import React from 'react';
import GroupChatLyricText from './GroupChatLyricText.jsx';
import { getArtistImage, getClockTime, getInitials } from '../utils/groupChatUtils.js';

const GroupChatMessageChain = ({
  group,
  itemIndex,
  artistByName,
  imageSources,
  masterPalette,
  liveParsedLyrics,
  handleLineClick,
  playbackTime,
  isPlayingCurrentSong
}) => {
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
        const isUncredited = group.artists.length === 0;
        const lyricLine = line.lyric ||
          liveParsedLyrics[line.sourceIndex ?? line.index] ||
          { text: line.text };
        const avatarCount = isUncredited ? 0 : group.artists.length;
        const avatarSlotWidth = isUncredited ? 0 : 34 + 22 * (avatarCount - 1);
        const bubbleShape = group.events.length === 1
          ? 'single'
          : (eventIndex === group.events.length - 1 ? 'last' : 'middle');
        const isLastMessage = eventIndex === group.events.length - 1;

        return (
          <div
            className={`group-chat-turn group-chat-turn-${group.side} group-chat-turn-${bubbleShape}${isUncredited ? ' group-chat-turn-uncredited' : ''}`}
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
              {isLastMessage && (
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
                className="group-chat-message"
              >
                <button
                  type="button"
                  className="group-chat-message-line"
                  onClick={() => handleLineClick(line.start)}
                  aria-label={group.artists.length
                    ? `${group.artists.join(', ')}: ${line.text}`
                    : line.text}
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
              {isLastMessage && group.artists.length > 0 && (
                <span className="group-chat-artist">
                  {group.artists.map((artistName, index) => (
                    <React.Fragment key={artistName}>
                      {index > 0 && <span className="group-chat-artist-separator">, </span>}
                      <span style={{ color: artistByName.get(artistName)?.color || color }}>
                        {artistName}
                      </span>
                    </React.Fragment>
                  ))}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default GroupChatMessageChain;
