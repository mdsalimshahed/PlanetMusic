import { useEffect, useLayoutEffect, useRef } from 'react';
import ArtistPresenceAvatar from './ArtistPresenceAvatar.jsx';
import {
  getArtistImage,
  isArtistDimmed,
  orderGroupChatArtists
} from '../utils/groupChatUtils.js';
import { finishAnimationAtCurrentStyles } from '../utils/finishAnimation.js';

const animateParticipantPositions = (container, previousPositionsRef) => {
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

  currentPositions.forEach((position, artistName) => {
    const previousPosition = previousPositionsRef.current.get(artistName);
    const avatar = avatarElements.get(artistName);
    if (!previousPosition || !avatar) return;
    const offsetX = previousPosition.left - position.left;
    if (Math.abs(offsetX) < 1) return;

    avatar.getAnimations().forEach(animation => animation.cancel());
    const animation = avatar.animate(
      [
        { transform: `translateX(${offsetX}px)` },
        { transform: 'translate(0, 0)' }
      ],
      {
        duration: 560,
        easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)',
        fill: 'both'
      }
    );
    animation.onfinish = () => finishAnimationAtCurrentStyles(animation);
  });

  previousPositionsRef.current = currentPositions;
};

const GroupChatHeader = ({
  artists,
  onlineArtists,
  typingArtists,
  mainSingingArtists,
  adlibSingingArtists,
  typingArtistOrder,
  mainSingingArtistOrder,
  adlibSingingArtistOrder,
  lastLineEndByArtist,
  playbackTime,
  imageSources,
  inactiveScale
}) => {
  const participantsRef = useRef(null);
  const previousPositionsRef = useRef(new Map());
  const orderedArtists = orderGroupChatArtists({
    artists,
    onlineArtists,
    typingArtists,
    mainSingingArtists,
    adlibSingingArtists,
    typingArtistOrder,
    mainSingingArtistOrder,
    adlibSingingArtistOrder,
    lastLineEndByArtist,
    playbackTime
  });
  const layoutKey = JSON.stringify(orderedArtists.map(artist => [
    artist.name,
    onlineArtists.has(artist.name),
    onlineArtists.has(artist.name) && !isArtistDimmed({
      artistName: artist.name,
      onlineArtists,
      mainSingingArtists,
      adlibSingingArtists,
      typingArtists,
      lastLineEndByArtist,
      playbackTime
    })
  ]));

  useLayoutEffect(() => {
    const container = participantsRef.current;
    if (!container) return;
    animateParticipantPositions(container, previousPositionsRef);
  }, [layoutKey, inactiveScale]);

  useEffect(() => {
    const container = participantsRef.current;
    if (!container || typeof MutationObserver === 'undefined') return undefined;

    const observer = new MutationObserver(records => {
      if (!records.some(record => record.removedNodes.length > 0)) return;
      animateParticipantPositions(container, previousPositionsRef);
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <header className="group-chat-header">
      <div className="group-chat-heading">
        <div className="group-chat-participants" aria-live="polite" ref={participantsRef}>
          {orderedArtists.map(artist => (
            <ArtistPresenceAvatar
              key={artist.name}
              artist={artist}
              isOnline={onlineArtists.has(artist.name)}
              isDimmed={isArtistDimmed({
                artistName: artist.name,
                onlineArtists,
                mainSingingArtists,
                adlibSingingArtists,
                typingArtists,
                lastLineEndByArtist,
                playbackTime
              })}
              image={getArtistImage(artist.name, imageSources)}
              inactiveScale={inactiveScale}
            />
          ))}
        </div>
      </div>
    </header>
  );
};

export default GroupChatHeader;
