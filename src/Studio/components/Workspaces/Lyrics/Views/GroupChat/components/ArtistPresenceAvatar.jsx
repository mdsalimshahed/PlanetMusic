import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getInitials } from '../utils/groupChatUtils.js';

const ArtistPresenceAvatar = ({
  artist,
  isOnline,
  isDimmed,
  image,
  inactiveScale,
  disableAnimations
}) => {
  const [isVisible, setIsVisible] = useState(isOnline);
  const participantRef = useRef(null);
  const avatarRef = useRef(null);
  const previousActiveRef = useRef(isOnline && !isDimmed);
  const previousOnlineRef = useRef(false);
  const isActive = isOnline && !isDimmed;

  useEffect(() => {
    if (isOnline) {
      if (isVisible) return undefined;
      const frame = window.requestAnimationFrame(() => setIsVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }

    const exitTimer = setTimeout(() => setIsVisible(false), 300);
    return () => clearTimeout(exitTimer);
  }, [isOnline, isVisible]);

  useLayoutEffect(() => {
    const wasOnline = previousOnlineRef.current;
    previousOnlineRef.current = isOnline;
    if (!isOnline || wasOnline || disableAnimations) return;

    const participant = participantRef.current;
    if (!participant) return;

    const animation = participant.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 300, easing: 'ease-out' }
    );
    animation.onfinish = () => animation.cancel();
  }, [disableAnimations, isOnline]);

  useLayoutEffect(() => {
    const wasActive = previousActiveRef.current;
    if (!isOnline) return;
    previousActiveRef.current = isActive;

    const avatar = avatarRef.current;
    if (!avatar) return;

    const runningAnimations = avatar.getAnimations();
    if (wasActive === isActive && !disableAnimations) return;

    const currentTransform = runningAnimations.length
      ? window.getComputedStyle(avatar).transform
      : `scale(${wasActive ? 1 : inactiveScale})`;
    runningAnimations.forEach(animation => animation.cancel());

    if (
      wasActive === isActive ||
      disableAnimations
    ) {
      return;
    }

    avatar.animate(
      [
        { transform: currentTransform },
        { transform: `scale(${isActive ? 1 : inactiveScale})` }
      ],
      { duration: 520, easing: 'cubic-bezier(0.22, 0.8, 0.2, 1)', fill: 'forwards' }
    );
  }, [disableAnimations, inactiveScale, isActive, isOnline]);

  if (!isVisible && !isOnline) return null;

  return (
    <span
      className={[
        'group-chat-participant',
        isOnline ? 'is-online' : 'is-offline',
        isActive ? 'is-active' : 'is-inactive',
        isDimmed ? 'is-dimmed' : ''
      ].filter(Boolean).join(' ')}
      ref={participantRef}
      style={{ '--artist-color': artist.color }}
      data-artist-name={artist.name}
      aria-label={`${artist.name}, ${isDimmed ? 'inactive' : isOnline ? 'online' : 'offline'}`}
      aria-hidden={!isOnline}
    >
      <span className="group-chat-avatar-motion" aria-hidden="true">
        <span className="group-chat-avatar" ref={avatarRef}>
          <span>{getInitials(artist.name)}</span>
          {image && (
            <img src={image} alt="" onError={event => { event.currentTarget.hidden = true; }} />
          )}
        </span>
      </span>
    </span>
  );
};

export default ArtistPresenceAvatar;
