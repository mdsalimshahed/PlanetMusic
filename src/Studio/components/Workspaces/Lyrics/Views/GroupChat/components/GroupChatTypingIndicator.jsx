import React, { useEffect, useRef, useState } from 'react';
import { getArtistImage, getInitials } from '../utils/groupChatUtils.js';

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
      .filter(artist => !activeNames.has(artist.name));
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
        {displayArtists.map(({ name, isExiting }, index) => {
          const artist = artistByName.get(name);
          const image = getArtistImage(name, imageSources);
          return (
            <span
              className={`group-chat-typing-avatar${isExiting ? ' is-exiting' : ''}`}
              key={name}
              style={{
                '--artist-color': artist?.color || '#a8b4c7',
                '--avatar-index': index,
                '--avatar-count': displayArtists.length,
                '--typing-stagger': `${index * 70}ms`
              }}
            >
              <span>{getInitials(name)}</span>
              {image && (
                <img src={image} alt="" onError={event => { event.currentTarget.hidden = true; }} />
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

export default GroupChatTypingIndicator;
