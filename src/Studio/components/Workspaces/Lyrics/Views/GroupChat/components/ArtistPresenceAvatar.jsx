import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getInitials } from '../utils/groupChatUtils.js';

const ArtistPresenceAvatar = ({
  artist,
  isOnline,
  isDimmed,
  image,
  inactiveScale
}) => {
  const [isVisible, setIsVisible] = useState(isOnline);
  const participantRef = useRef(null);
  const opacityAnimationRef = useRef(null);
  const hasAppearedRef = useRef(false);
  const pendingFadeInRef = useRef(isOnline);
  const avatarRef = useRef(null);
  const wasOnlineRef = useRef(isOnline);
  const previousActiveRef = useRef(isOnline && !isDimmed);
  const isActive = isOnline && !isDimmed;

  useEffect(() => {
    if (!isOnline || isVisible) return undefined;
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [isOnline, isVisible]);

  useLayoutEffect(() => {
    if (!isOnline) {
      hasAppearedRef.current = false;
      return;
    }

    if (!hasAppearedRef.current) {
      hasAppearedRef.current = true;
      pendingFadeInRef.current = true;
    }
    const participant = participantRef.current;
    if (!participant) return;

    const runningAnimation = opacityAnimationRef.current;
    if (!pendingFadeInRef.current && !runningAnimation) return;
    const fromOpacity = runningAnimation
      ? Number(window.getComputedStyle(participant).opacity)
      : 0;
    if (runningAnimation) {
      runningAnimation.onfinish = null;
      runningAnimation.cancel();
      opacityAnimationRef.current = null;
    }
    pendingFadeInRef.current = false;
    const animation = participant.animate(
      [{ opacity: fromOpacity }, { opacity: 1 }],
      { duration: 300, easing: 'ease', fill: 'both' }
    );
    opacityAnimationRef.current = animation;
    animation.onfinish = () => {
      if (opacityAnimationRef.current !== animation) return;
      opacityAnimationRef.current = null;
      animation.cancel();
    };
  }, [isOnline, isVisible]);

  useLayoutEffect(() => {
    if (isOnline || !isVisible) return;

    const participant = participantRef.current;
    if (!participant) return;

    const runningAnimation = opacityAnimationRef.current;
    const fromOpacity = runningAnimation
      ? Number(window.getComputedStyle(participant).opacity)
      : 1;
    if (runningAnimation) {
      runningAnimation.onfinish = null;
      runningAnimation.cancel();
    }

    const animation = participant.animate(
      [{ opacity: fromOpacity }, { opacity: 0 }],
      { duration: 300, easing: 'ease', fill: 'both' }
    );
    opacityAnimationRef.current = animation;
    animation.onfinish = () => {
      if (opacityAnimationRef.current !== animation) return;
      opacityAnimationRef.current = null;
      setIsVisible(false);
    };
  }, [isOnline, isVisible]);

  useLayoutEffect(() => () => {
    const animation = opacityAnimationRef.current;
    if (!animation) return;
    animation.onfinish = null;
    animation.cancel();
    opacityAnimationRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const wasOnline = wasOnlineRef.current;
    const wasActive = previousActiveRef.current;
    if (!isOnline) {
      wasOnlineRef.current = false;
      return;
    }
    wasOnlineRef.current = true;
    previousActiveRef.current = isActive;

    const avatar = avatarRef.current;
    if (!avatar) return;

    const runningAnimations = avatar.getAnimations();
    if (wasActive === isActive) return;

    const currentTransform = runningAnimations.length
      ? window.getComputedStyle(avatar).transform
      : `scale(${wasActive ? 1 : inactiveScale})`;
    runningAnimations.forEach(animation => animation.cancel());

    if (
      !wasOnline ||
      wasActive === isActive
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
  }, [inactiveScale, isActive, isOnline]);

  if (!isVisible && !isOnline) return null;

  return (
    <span
      ref={participantRef}
      className={[
        'group-chat-participant',
        isOnline ? 'is-online' : 'is-offline',
        isActive ? 'is-active' : 'is-inactive',
        isDimmed ? 'is-dimmed' : ''
      ].filter(Boolean).join(' ')}
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
