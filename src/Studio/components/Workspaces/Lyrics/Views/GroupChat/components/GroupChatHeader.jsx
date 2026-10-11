import { useLayoutEffect, useRef } from 'react';
import ArtistPresenceAvatar from './ArtistPresenceAvatar.jsx';
import { getArtistImage } from '../utils/groupChatUtils.js';

const GroupChatHeader = ({
  artists,
  onlineArtists,
  typingArtists,
  lastLineEndByArtist,
  playbackTime,
  imageSources,
  disableAnimations,
  inactiveScale
}) => {
  const participantsRef = useRef(null);
  const previousPositionsRef = useRef(new Map());
  const isArtistTyping = artist => typingArtists.has(artist.name);
  const isArtistActive = artist => {
    const lastLineEnd = lastLineEndByArtist.get(artist.name);
    return onlineArtists.has(artist.name) && (
      isArtistTyping(artist) ||
      !(lastLineEnd != null && playbackTime - lastLineEnd > 5)
    );
  };
  const orderedArtists = [...artists].sort((a, b) => {
    const activeDifference = Number(isArtistActive(b)) - Number(isArtistActive(a));
    if (activeDifference) return activeDifference;

    const getInactiveAt = artist => {
      if (onlineArtists.has(artist.name)) {
        const lastLineEnd = lastLineEndByArtist.get(artist.name);
        return lastLineEnd == null ? Number.NEGATIVE_INFINITY : lastLineEnd + 5;
      }
      return artist.offlineAt ?? Number.NEGATIVE_INFINITY;
    };
    return getInactiveAt(b) - getInactiveAt(a);
  });
  const layoutKey = JSON.stringify(orderedArtists.map(artist => [
    artist.name,
    onlineArtists.has(artist.name),
    isArtistActive(artist)
  ]));

  useLayoutEffect(() => {
    const container = participantsRef.current;
    if (!container) return;

    const currentPositions = new Map();
    const avatarElements = new Map();
    container.querySelectorAll('.group-chat-participant').forEach(participant => {
      const motionWrapper = participant.querySelector('.group-chat-avatar-motion');
      const artistName = participant.dataset.artistName;
      if (motionWrapper && artistName) {
        currentPositions.set(artistName, {
          left: participant.offsetLeft,
          top: participant.offsetTop
        });
        avatarElements.set(artistName, motionWrapper);
      }
    });

    if (!disableAnimations && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentPositions.forEach((position, artistName) => {
        const previousPosition = previousPositionsRef.current.get(artistName);
        const avatar = avatarElements.get(artistName);
        if (!previousPosition || !avatar) return;
        const offsetX = previousPosition.left - position.left;
        if (Math.abs(offsetX) < 1) return;

        avatar.getAnimations().forEach(animation => animation.cancel());
        avatar.animate(
          [
            { transform: `translateX(${offsetX}px)` },
            { transform: 'translate(0, 0)' }
          ],
          { duration: 560, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)' }
        );
      });
    }

    previousPositionsRef.current = currentPositions;
  }, [layoutKey, disableAnimations, inactiveScale]);

  return (
    <header className="group-chat-header">
      <div className="group-chat-heading">
        <div className="group-chat-participants" aria-live="polite" ref={participantsRef}>
          {orderedArtists.map(artist => {
            const lastLineEnd = lastLineEndByArtist.get(artist.name);
            return (
              <ArtistPresenceAvatar
                key={artist.name}
                artist={artist}
                isOnline={onlineArtists.has(artist.name)}
                isDimmed={
                  !isArtistTyping(artist) &&
                  lastLineEnd != null &&
                  playbackTime - lastLineEnd > 5
                }
                image={getArtistImage(artist.name, imageSources)}
                inactiveScale={inactiveScale}
                disableAnimations={disableAnimations}
              />
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default GroupChatHeader;
