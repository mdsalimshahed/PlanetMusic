import { useLayoutEffect, useRef } from 'react';
import ArtistPresenceAvatar from './ArtistPresenceAvatar.jsx';
import { getArtistImage } from '../utils/groupChatUtils.js';

const GroupChatHeader = ({
  artists,
  onlineArtists,
  lastLineEndByArtist,
  playbackTime,
  imageSources,
  disableAnimations
}) => {
  const participantsRef = useRef(null);
  const previousPositionsRef = useRef(new Map());
  const isArtistActive = artist => {
    const lastLineEnd = lastLineEndByArtist.get(artist.name);
    return onlineArtists.has(artist.name) &&
      !(lastLineEnd != null && playbackTime - lastLineEnd > 5);
  };
  const activityOrderKey = JSON.stringify(artists.map(artist => [
    artist.name,
    isArtistActive(artist)
  ]));
  const orderedArtists = artists
    .map((artist, originalIndex) => ({ artist, originalIndex }))
    .sort((a, b) => Number(isArtistActive(b.artist)) - Number(isArtistActive(a.artist)));

  useLayoutEffect(() => {
    const container = participantsRef.current;
    if (!container) return;

    const currentPositions = new Map();
    const avatarElements = new Map();
    container.querySelectorAll('.group-chat-participant').forEach(participant => {
      const avatar = participant.querySelector('.group-chat-avatar');
      const artistName = participant.dataset.artistName;
      if (avatar && artistName) {
        currentPositions.set(artistName, avatar.getBoundingClientRect());
        avatarElements.set(artistName, avatar);
      }
    });

    if (!disableAnimations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentPositions.forEach((position, artistName) => {
        const previousPosition = previousPositionsRef.current.get(artistName);
        const avatar = avatarElements.get(artistName);
        if (!previousPosition || !avatar) return;
        const offsetX = previousPosition.left - position.left;
        const offsetY = previousPosition.top - position.top;
        if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) return;

        avatar.animate(
          [
            { transform: `translate(${offsetX}px, ${offsetY}px)` },
            { transform: 'translate(0, 0)' }
          ],
          { duration: 380, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' }
        );
      });
    }

    previousPositionsRef.current = currentPositions;
  }, [activityOrderKey, disableAnimations]);

  return (
    <header className="group-chat-header">
      <div className="group-chat-heading">
        <div className="group-chat-participants" aria-live="polite" ref={participantsRef}>
          {orderedArtists.map(({ artist, originalIndex }) => {
            const lastLineEnd = lastLineEndByArtist.get(artist.name);
            return (
              <ArtistPresenceAvatar
                key={artist.name}
                artist={artist}
                artistIndex={originalIndex}
                isOnline={onlineArtists.has(artist.name)}
                isDimmed={lastLineEnd != null && playbackTime - lastLineEnd > 5}
                image={getArtistImage(artist.name, imageSources)}
              />
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default GroupChatHeader;
