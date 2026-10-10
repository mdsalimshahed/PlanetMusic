import { useEffect, useState } from 'react';
import { getInitials } from '../utils/groupChatUtils.js';

const ArtistPresenceAvatar = ({ artist, artistIndex, isOnline, isDimmed, image }) => {
  const [isVisible, setIsVisible] = useState(isOnline);
  const isActive = isOnline && !isDimmed;

  useEffect(() => {
    if (isOnline) {
      const enterFrame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(enterFrame);
    }

    const exitTimer = setTimeout(() => setIsVisible(false), 300 + artistIndex * 85);
    return () => clearTimeout(exitTimer);
  }, [artistIndex, isOnline]);

  if (!isVisible) return null;

  return (
    <span
      className={[
        'group-chat-participant',
        isOnline ? 'is-online' : 'is-offline',
        isActive ? 'is-active' : 'is-inactive',
        isDimmed ? 'is-dimmed' : ''
      ].filter(Boolean).join(' ')}
      style={{ '--artist-color': artist.color, '--presence-index': artistIndex }}
      data-artist-name={artist.name}
      aria-label={`${artist.name}, ${isDimmed ? 'inactive' : isOnline ? 'online' : 'offline'}`}
      aria-hidden={!isOnline}
    >
      <span className="group-chat-avatar" aria-hidden="true">
        <span>{getInitials(artist.name)}</span>
        {image && (
          <img src={image} alt="" onError={event => { event.currentTarget.hidden = true; }} />
        )}
      </span>
    </span>
  );
};

export default ArtistPresenceAvatar;
