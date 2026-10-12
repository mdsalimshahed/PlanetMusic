import React, { useLayoutEffect, useRef, useState } from 'react';
import { getArtistImage, getInitials } from '../utils/groupChatUtils.js';

const AVATAR_MOVE_DURATION = 140;
const AVATAR_ENTER_DURATION = 180;
const AVATAR_EXIT_DURATION = 180;
const FADE_EASING_IN = 'ease-out';
const FADE_EASING_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';
const FLIP_ANIMATION_ID = 'typing-flip';
const AVATAR_MOVE_EASING = 'cubic-bezier(0.22, 0.8, 0.2, 1)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getElementPositions = (container, selector) => new Map(
  [...(container?.querySelectorAll(selector) || [])].map(element => [
    element.dataset.artistName,
    element.getBoundingClientRect()
  ])
);

const animateFlip = (element, previousPosition, duration) => {
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
      { transform: `translate(${offsetX}px, ${offsetY}px)` },
      { transform: 'translate(0, 0)' }
    ],
    { duration, easing: AVATAR_MOVE_EASING }
  );
  animation.id = FLIP_ANIMATION_ID;
  animation.onfinish = () => animation.cancel();
};

// One shared enter/exit fade so avatars and names always move identically.
const playFadeUp = element => {
  element.getAnimations().forEach(animation => animation.cancel());
  element.animate(
    [
      { opacity: 0, transform: 'translate3d(0, 4px, 0)' },
      { opacity: 1, transform: 'translate3d(0, 0, 0)' }
    ],
    { duration: AVATAR_ENTER_DURATION, easing: FADE_EASING_IN }
  );
};

const playFadeDown = element => {
  element.getAnimations().forEach(animation => animation.cancel());
  element.animate(
    [
      { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      { opacity: 0, transform: 'translate3d(0, 4px, 0)' }
    ],
    { duration: AVATAR_EXIT_DURATION, easing: FADE_EASING_OUT, fill: 'forwards' }
  );
};

const useArtistNamesKey = artistNames => artistNames.join('\u0000');

const GroupChatTypingAvatarCluster = ({
  artistNames,
  artistByName,
  imageSources
}) => {
  const namesKey = useArtistNamesKey(artistNames);
  const [avatars, setAvatars] = useState(() => (
    artistNames.map(name => ({ name, isExiting: false }))
  ));
  const avatarsRef = useRef(avatars);
  const namesKeyRef = useRef(namesKey);
  const clusterRef = useRef(null);
  const dotsRef = useRef(null);
  const lastDotsOffsetRef = useRef(null);
  const pendingTransitionRef = useRef(null);
  const previousStatesRef = useRef(new Map());

  useLayoutEffect(() => {
    if (namesKeyRef.current === namesKey) return;
    namesKeyRef.current = namesKey;

    const cluster = clusterRef.current;
    const bounds = cluster?.getBoundingClientRect();
    const positions = getElementPositions(
      cluster,
      '.group-chat-typing-avatar[data-artist-name]'
    );
    const activeNames = new Set(artistNames);
    const currentAvatars = avatarsRef.current;
    const retained = currentAvatars.filter(
      avatar => !avatar.isExiting && activeNames.has(avatar.name)
    );
    const retainedNames = new Set(retained.map(avatar => avatar.name));
    const added = artistNames
      .filter(name => !retainedNames.has(name))
      .map(name => ({ name, isExiting: false }));
    const exiting = currentAvatars
      .filter(avatar => !activeNames.has(avatar.name))
      .map(avatar => {
        if (avatar.isExiting) return avatar;
        const position = positions.get(avatar.name);
        return {
          ...avatar,
          isExiting: true,
          exitLeft: position ? position.left - (bounds?.left ?? 0) : 0,
          exitTop: position ? position.top - (bounds?.top ?? 0) : 0
        };
      });
    const nextAvatars = [...retained, ...added, ...exiting];

    pendingTransitionRef.current = {
      key: nextAvatars.map(({ name, isExiting }) => `${name}:${isExiting}`).join('|'),
      positions
    };
    avatarsRef.current = nextAvatars;
    setAvatars(nextAvatars);
  }, [artistNames, namesKey]);

  useLayoutEffect(() => {
    const pendingTransition = pendingTransitionRef.current;
    const currentKey = avatars.map(({ name, isExiting }) => `${name}:${isExiting}`).join('|');
    if (pendingTransition && pendingTransition.key !== currentKey) return;
    if (pendingTransition) pendingTransitionRef.current = null;

    const cluster = clusterRef.current;
    const previousPositions = pendingTransition?.positions;
    if (!cluster) return;

    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    const currentStates = new Map(avatars.map(({ name, isExiting }) => [name, isExiting]));

    cluster.querySelectorAll('.group-chat-typing-avatar[data-artist-name]').forEach(avatar => {
      const name = avatar.dataset.artistName;
      const isExiting = avatar.classList.contains('is-exiting');
      const wasExiting = previousStatesRef.current.get(name);
      const visual = avatar.querySelector('.group-chat-typing-avatar-visual');
      if (!visual || reduceMotion) return;

      if (isExiting && wasExiting !== true) {
        playFadeDown(visual);
      } else if (!isExiting && wasExiting !== false) {
        playFadeUp(visual);
      }
    });

    if (previousPositions && !reduceMotion) {
      cluster.querySelectorAll(
        '.group-chat-typing-avatar[data-artist-name]:not(.is-exiting)'
      ).forEach(avatar => {
        animateFlip(
          avatar,
          previousPositions.get(avatar.dataset.artistName),
          AVATAR_MOVE_DURATION
        );
      });
    }

    previousStatesRef.current = currentStates;
  }, [avatars]);

  // The typing dots sit right after the avatars, so they slide smoothly
  // when the cluster grows or shrinks instead of snapping.
  useLayoutEffect(() => {
    const dots = dotsRef.current;
    if (!dots) return;
    const next = { left: dots.offsetLeft, top: dots.offsetTop };
    const previous = lastDotsOffsetRef.current;
    lastDotsOffsetRef.current = next;
    if (!previous || window.matchMedia(REDUCED_MOTION_QUERY).matches) return;
    const offsetX = previous.left - next.left;
    const offsetY = previous.top - next.top;
    if (Math.abs(offsetX) < 1 && Math.abs(offsetY) < 1) return;
    dots.getAnimations().forEach(animation => animation.cancel());
    dots.animate(
      [
        { transform: `translate(${offsetX}px, ${offsetY}px)` },
        { transform: 'translate(0, 0)' }
      ],
      { duration: AVATAR_MOVE_DURATION, easing: AVATAR_MOVE_EASING }
    );
  }, [avatars]);

  useLayoutEffect(() => {
    if (!avatars.some(avatar => avatar.isExiting)) return undefined;
    const exitTimer = setTimeout(() => {
      const activeNames = new Set(
        (namesKeyRef.current ? namesKeyRef.current.split('\u0000') : [])
      );
      const remaining = avatarsRef.current.filter(
        avatar => !avatar.isExiting && activeNames.has(avatar.name)
      );
      avatarsRef.current = remaining;
      setAvatars(remaining);
    }, AVATAR_EXIT_DURATION);
    return () => clearTimeout(exitTimer);
  }, [avatars]);

  return (
    <>
    <span className="group-chat-typing-avatars" aria-hidden="true" ref={clusterRef}>
      {avatars.map(({ name, isExiting, exitLeft, exitTop }, index) => {
        const artist = artistByName.get(name);
        const image = getArtistImage(name, imageSources);
        return (
          <span
            className={`group-chat-typing-avatar${isExiting ? ' is-exiting' : ''}`}
            key={name}
            data-artist-name={name}
            style={{
              '--artist-color': artist?.color || '#a8b4c7',
              '--avatar-index': index,
              '--avatar-count': avatars.length,
              ...(isExiting ? {
                '--typing-exit-left': `${exitLeft}px`,
                '--typing-exit-top': `${exitTop}px`
              } : {})
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
      })}
    </span>
    <span className="group-chat-typing-dots" aria-hidden="true" ref={dotsRef}><i /><i /><i /></span>
    </>
  );
};

const GroupChatTypingNames = ({ artistNames, artistByName }) => {
  const namesKey = useArtistNamesKey(artistNames);
  const [artists, setArtists] = useState(() => (
    artistNames.map(name => ({ name, isExiting: false }))
  ));
  const artistsRef = useRef(artists);
  const namesKeyRef = useRef(namesKey);
  const namesRef = useRef(null);
  const labelRef = useRef(null);
  const pendingTransitionRef = useRef(null);
  const previousStatesRef = useRef(new Map());

  useLayoutEffect(() => {
    if (namesKeyRef.current === namesKey) return;
    namesKeyRef.current = namesKey;

    const container = namesRef.current;
    const bounds = container?.getBoundingClientRect();
    const positions = getElementPositions(
      container,
      '.group-chat-typing-name[data-artist-name]'
    );
    const activeNames = new Set(artistNames);
    const currentArtists = artistsRef.current;
    const retained = currentArtists.filter(
      artist => !artist.isExiting && activeNames.has(artist.name)
    );
    const retainedNames = new Set(retained.map(artist => artist.name));
    const added = artistNames
      .filter(name => !retainedNames.has(name))
      .map(name => ({ name, isExiting: false }));
    const stillLiving = currentArtists.filter(artist => !artist.isExiting);
    const exiting = currentArtists
      .filter(artist => !activeNames.has(artist.name))
      .map(artist => {
        if (artist.isExiting) return artist;
        // Pull the leaving name out of the text flow at its exact current spot
        // so the remaining names close the gap immediately.
        const position = positions.get(artist.name);
        const livingIndex = stillLiving.findIndex(item => item.name === artist.name);
        return {
          ...artist,
          isExiting: true,
          hadSeparator: livingIndex < stillLiving.length - 1,
          exitLeft: position ? position.left - (bounds?.left ?? 0) : 0,
          exitTop: position ? position.top - (bounds?.top ?? 0) : 0,
          exitWidth: position ? position.width : undefined
        };
      });
    const nextArtists = [...retained, ...added, ...exiting];

    pendingTransitionRef.current = {
      key: nextArtists.map(({ name, isExiting }) => `${name}:${isExiting}`).join('|'),
      positions,
      labelPosition: labelRef.current?.getBoundingClientRect() ?? null
    };
    artistsRef.current = nextArtists;
    setArtists(nextArtists);
  }, [artistNames, namesKey]);

  useLayoutEffect(() => {
    const pendingTransition = pendingTransitionRef.current;
    const currentKey = artists.map(({ name, isExiting }) => `${name}:${isExiting}`).join('|');
    if (pendingTransition && pendingTransition.key !== currentKey) return;
    if (pendingTransition) pendingTransitionRef.current = null;

    const container = namesRef.current;
    const currentStates = new Map(artists.map(({ name, isExiting }) => [name, isExiting]));
    const reduceMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;

    if (container && !reduceMotion) {
      // Same fade-up / fade-down as the avatars, driven by the same helpers.
      container.querySelectorAll('.group-chat-typing-name[data-artist-name]').forEach(name => {
        const isExiting = name.classList.contains('is-exiting');
        const wasExiting = previousStatesRef.current.get(name.dataset.artistName);
        if (isExiting && wasExiting !== true) playFadeDown(name);
        else if (!isExiting && wasExiting !== false) playFadeUp(name);
      });

      if (pendingTransition) {
        container.querySelectorAll(
          '.group-chat-typing-name[data-artist-name]:not(.is-exiting)'
        ).forEach(name => {
          animateFlip(
            name,
            pendingTransition.positions.get(name.dataset.artistName),
            AVATAR_MOVE_DURATION
          );
        });
        if (labelRef.current) {
          animateFlip(labelRef.current, pendingTransition.labelPosition, AVATAR_MOVE_DURATION);
        }
      }
    }

    previousStatesRef.current = currentStates;
  }, [artists]);

  useLayoutEffect(() => {
    if (!artists.some(artist => artist.isExiting)) return undefined;
    const exitTimer = setTimeout(() => {
      const activeNames = new Set(
        (namesKeyRef.current ? namesKeyRef.current.split('\u0000') : [])
      );
      const remaining = artistsRef.current.filter(
        artist => !artist.isExiting && activeNames.has(artist.name)
      );
      artistsRef.current = remaining;
      setArtists(remaining);
    }, AVATAR_EXIT_DURATION);
    return () => clearTimeout(exitTimer);
  }, [artists]);

  // Only names that are really still typing count for spacing and commas;
  // a fading name never takes up room in the sentence.
  const livingNames = artists.filter(artist => !artist.isExiting).map(artist => artist.name);
  const livingCount = livingNames.length;

  return (
    <span className="group-chat-typing-names" ref={namesRef}>
      {artists.map(({ name, isExiting, hadSeparator, exitLeft, exitTop, exitWidth }) => {
        const artist = artistByName.get(name);
        const livingIndex = livingNames.indexOf(name);
        const showSpace = !isExiting && livingIndex > 0;
        const showSeparator = isExiting ? hadSeparator : livingIndex < livingCount - 1;
        return (
          <React.Fragment key={name}>
            {showSpace && ' '}
            <span
              className={`group-chat-typing-name${isExiting ? ' is-exiting' : ''}`}
              data-artist-name={name}
              style={{
                '--artist-color': artist?.color || '#a8b4c7',
                ...(isExiting ? {
                  left: `${exitLeft}px`,
                  top: `${exitTop}px`,
                  width: exitWidth ? `${exitWidth}px` : undefined
                } : {})
              }}
            >
              {name.split(/(\s+)/u).map((part, partIndex) => (
                /\s/u.test(part)
                  ? part
                  : <span className="group-chat-typing-word" key={`${part}-${partIndex}`}>{part}</span>
              ))}
              {showSeparator && <span className="group-chat-typing-separator">,</span>}
            </span>
          </React.Fragment>
        );
      })}
      <span className="group-chat-typing-label" ref={labelRef}>typing</span>
    </span>
  );
};

const GroupChatTypingIndicator = ({
  artistNames,
  artistByName,
  imageSources,
  isVisible
}) => (
  <div
    className={`group-chat-typing${isVisible ? ' is-visible' : ' is-exiting'}`}
    aria-label={`${artistNames.join(', ')} typing`}
  >
    <GroupChatTypingAvatarCluster
      artistNames={artistNames}
      artistByName={artistByName}
      imageSources={imageSources}
    />
    <GroupChatTypingNames artistNames={artistNames} artistByName={artistByName} />
  </div>
);

export default GroupChatTypingIndicator;