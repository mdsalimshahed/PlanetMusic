import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getArtistImage, getInitials } from '../utils/groupChatUtils.js';

/*
  Typing indicator ("A, B typing" with an avatar cluster).

  This file only decides WHO is on screen and in WHICH phase. All motion
  (durations, easings, distances) lives in styles/groupChatTyping.css.

  Phases of one artist:
    present  - was there when the indicator appeared (the row's own fade handles it)
    entering - just started typing: fades UP from below
    exiting  - stopped typing: fades DOWN to below, then is removed

  Avatars and names are rendered from the SAME list, so they can never disagree.
*/

const FALLBACK_COLOR = '#a8b4c7';
const FALLBACK_EXIT_MS = 180;
const AVATAR_MOVE_MS = 220;
const AVATAR_MOVE_EASING = 'cubic-bezier(0.22, 0.8, 0.2, 1)';
const FLIP_ANIMATION_ID = 'typing-avatar-flip';

const getAvatarPositions = container => new Map(
  [...(container?.querySelectorAll('.group-chat-typing-avatar[data-artist-name]') || [])]
    .map(element => [element.dataset.artistName, element.getBoundingClientRect()])
);

const animateFlip = (element, previousPosition) => {
  if (!previousPosition) return;
  const currentPosition = element.getBoundingClientRect();
  const offsetX = previousPosition.left - currentPosition.left;
  const offsetY = previousPosition.top - currentPosition.top;
  if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) return;

  element.getAnimations()
    .filter(animation => animation.id === FLIP_ANIMATION_ID)
    .forEach(animation => animation.cancel());
  const animation = element.animate(
    [
      { transform: `translate3d(${offsetX}px, ${offsetY}px, 0)` },
      { transform: 'translate3d(0, 0, 0)' }
    ],
    { duration: AVATAR_MOVE_MS, easing: AVATAR_MOVE_EASING }
  );
  animation.id = FLIP_ANIMATION_ID;
  animation.onfinish = () => animation.cancel();
};

const reconcile = (items, activeNames) => {
  const active = new Set(activeNames);
  const known = new Set(items.map(item => item.name));
  const living = items.filter(item => item.phase !== 'exiting');

  const next = items.map(item => {
    if (active.has(item.name)) {
      // Typing again while still fading out: bring it back.
      return item.phase === 'exiting' ? { name: item.name, phase: 'entering' } : item;
    }
    if (item.phase === 'exiting') return item;
    return {
      name: item.name,
      phase: 'exiting',
      exitIndex: living.indexOf(item),
      // Remember if a comma followed this name, so it fades out unchanged.
      hadSeparator: living.indexOf(item) < living.length - 1
    };
  });

  activeNames.forEach(name => {
    if (!known.has(name)) next.push({ name, phase: 'entering' });
  });
  return next;
};

const useTypingPresence = (artistNames, avatarsRef) => {
  const namesKey = artistNames.join('\u0000');
  const [presence, setPresence] = useState(() => ({
    namesKey,
    items: artistNames.map(name => ({ name, phase: 'present' }))
  }));
  const namesKeyRef = useRef(namesKey);
  const previousPositionsRef = useRef(null);

  useLayoutEffect(() => {
    if (namesKeyRef.current === namesKey) return;
    namesKeyRef.current = namesKey;

    const nextItems = reconcile(presence.items, artistNames);
    previousPositionsRef.current = {
      positions: getAvatarPositions(avatarsRef.current),
      items: nextItems
    };
    setPresence({ namesKey, items: nextItems });
  }, [artistNames, avatarsRef, namesKey, presence]);

  const finishExit = useCallback(name => {
    setPresence(state => ({
      ...state,
      items: state.items.filter(item => item.name !== name || item.phase !== 'exiting')
    }));
  }, []);

  return [presence.items, finishExit, previousPositionsRef];
};

// Removes an exiting artist once its CSS exit has played. The duration is read
// from the stylesheet, so CSS stays the single source of truth.
const useExitTimers = (rowRef, items, finishExit) => {
  const timersRef = useRef(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    const exiting = new Set(
      items.filter(item => item.phase === 'exiting').map(item => item.name)
    );

    timers.forEach((timerId, name) => {
      if (exiting.has(name)) return;
      clearTimeout(timerId);
      timers.delete(name);
    });

    exiting.forEach(name => {
      if (timers.has(name)) return;
      const cssValue = rowRef.current
        ? getComputedStyle(rowRef.current).getPropertyValue('--typing-exit-ms')
        : '';
      const exitMs = parseFloat(cssValue) || FALLBACK_EXIT_MS;
      timers.set(name, setTimeout(() => {
        timers.delete(name);
        finishExit(name);
      }, exitMs));
    });
  }, [items, finishExit, rowRef]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);
};

const TypingAvatar = ({ name, phase, index, count, color, image }) => (
  <span
    className={`group-chat-typing-avatar is-${phase}`}
    data-artist-name={name}
    style={{
      '--artist-color': color,
      '--avatar-index': index,
      '--avatar-count': count
    }}
  >
    <span className="group-chat-typing-avatar-visual">
      <span>{getInitials(name)}</span>
      {image && (
        <img src={image} alt="" onError={event => { event.currentTarget.hidden = true; }} />
      )}
    </span>
  </span>
);

const TypingName = ({ name, phase, showSeparator, color }) => (
  <span
    className={`group-chat-typing-name is-${phase}`}
    data-artist-name={name}
    style={{ '--artist-color': color }}
  >
    {name}
    {showSeparator && <span className="group-chat-typing-separator">,</span>}
  </span>
);

const GroupChatTypingIndicator = ({
  artistNames,
  artistByName,
  imageSources,
  isVisible
}) => {
  const rowRef = useRef(null);
  const avatarsRef = useRef(null);
  const uniqueArtistNames = [...new Set(artistNames)];
  const [items, finishExit, previousPositionsRef] = useTypingPresence(uniqueArtistNames, avatarsRef);
  useExitTimers(rowRef, items, finishExit);

  const livingItems = items.filter(item => item.phase !== 'exiting');
  const livingNames = livingItems.map(item => item.name);
  const livingIndexByName = new Map(livingNames.map((name, index) => [name, index]));

  useLayoutEffect(() => {
    const pendingTransition = previousPositionsRef.current;
    if (!pendingTransition || pendingTransition.items !== items) return;
    previousPositionsRef.current = null;

    if (rowRef.current?.closest('.group-chat-no-motion')) return;

    avatarsRef.current
      ?.querySelectorAll('.group-chat-typing-avatar:not(.is-exiting)')
      .forEach(avatar => animateFlip(
        avatar,
        pendingTransition.positions.get(avatar.dataset.artistName)
      ));
  }, [items, previousPositionsRef]);

  return (
    <div
      ref={rowRef}
      className={`group-chat-typing${isVisible ? ' is-visible' : ' is-exiting'}`}
      aria-label={`${uniqueArtistNames.join(', ')} typing`}
    >
      <span className="group-chat-typing-avatars" aria-hidden="true" ref={avatarsRef}>
        {items.map(({ name, phase, exitIndex }) => (
          <TypingAvatar
            key={name}
            name={name}
            phase={phase}
            index={phase === 'exiting' ? exitIndex : livingIndexByName.get(name)}
            count={livingItems.length}
            color={artistByName.get(name)?.color || FALLBACK_COLOR}
            image={getArtistImage(name, imageSources)}
          />
        ))}
      </span>
      <span className="group-chat-typing-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="group-chat-typing-names">
        {items.map(({ name, phase, hadSeparator }) => (
          <TypingName
            key={name}
            name={name}
            phase={phase}
            showSeparator={
              phase === 'exiting'
                ? Boolean(hadSeparator)
                : livingNames.indexOf(name) < livingNames.length - 1
            }
            color={artistByName.get(name)?.color || FALLBACK_COLOR}
          />
        ))}
        <span className="group-chat-typing-label">typing</span>
      </span>
    </div>
  );
};

export default GroupChatTypingIndicator;