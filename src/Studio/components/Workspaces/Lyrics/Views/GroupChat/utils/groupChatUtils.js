import { ARTIST_ACTIVITY_WINDOW_SECONDS } from '../groupChatTimelineState.js';

export const getClockTime = (eventTime, playbackTime) => {
  const timestamp = new Date(Date.now() + (eventTime - playbackTime) * 1000);
  return timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const getLyricLayoutKey = (
  line,
  lyricLine,
  settings,
  side,
  artistCount,
  layoutSignature
) =>
  JSON.stringify([
    line.index,
    line.text,
    line.translation,
    line.pronunciation,
    line.lyric?.text,
    line.lyric?.translation,
    line.lyric?.pronunciation,
    line.lyric?.segments?.map(segment => [
      segment.text,
      segment.color,
      segment.artists
    ]),
    line.savedNode?.translation,
    line.savedNode?.pronunciation,
    line.isAdlib,
    side,
    artistCount,
    settings?.groupChatLyricFontSize ?? 2.2,
    settings?.groupChatLineWrapWidth ?? 60,
    settings?.groupChatBubbleAvatarSize ?? 4.25,
    settings?.groupChatTimestampSize ?? 1.125,
    layoutSignature
  ]);

export const getInitials = name => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0].toLocaleUpperCase())
  .join('');

export const getArtistImage = (artist, imageSources) => {
  const matchingKey = Object.keys(imageSources).find(
    name => name.toLocaleLowerCase() === artist.toLocaleLowerCase()
  );
  return matchingKey ? imageSources[matchingKey] : null;
};

export const isArtistDimmed = ({
  artistName,
  onlineArtists,
  mainSingingArtists,
  adlibSingingArtists,
  typingArtists,
  lastLineEndByArtist,
  playbackTime
}) => {
  if (!onlineArtists.has(artistName)) return false;
  if (
    mainSingingArtists.has(artistName) ||
    adlibSingingArtists.has(artistName) ||
    typingArtists.has(artistName)
  ) return false;

  const lastLineEnd = lastLineEndByArtist.get(artistName);
  return lastLineEnd != null &&
    playbackTime - lastLineEnd > ARTIST_ACTIVITY_WINDOW_SECONDS;
};

export const orderGroupChatArtists = ({
  artists,
  onlineArtists,
  typingArtists,
  mainSingingArtists,
  adlibSingingArtists,
  mainSingingArtistOrder,
  adlibSingingArtistOrder,
  typingArtistOrder = [],
  lastLineEndByArtist,
  playbackTime
}) => {
  const isArtistActive = artist => {
    const lastLineEnd = lastLineEndByArtist.get(artist.name);
    return onlineArtists.has(artist.name) && (
      mainSingingArtists.has(artist.name) ||
      adlibSingingArtists.has(artist.name) ||
      typingArtists.has(artist.name) ||
      !(lastLineEnd != null &&
        playbackTime - lastLineEnd > ARTIST_ACTIVITY_WINDOW_SECONDS)
    );
  };
  const getInactiveAt = artist => {
    if (onlineArtists.has(artist.name)) {
      const lastLineEnd = lastLineEndByArtist.get(artist.name);
      return lastLineEnd == null
        ? Number.NEGATIVE_INFINITY
        : lastLineEnd + ARTIST_ACTIVITY_WINDOW_SECONDS;
    }
    return artist.offlineAt ?? Number.NEGATIVE_INFINITY;
  };
  const artistsByName = new Map(artists.map(artist => [artist.name, artist]));
  const addInOrder = (orderedNames, artistSet, excludedNames = new Set()) => {
    const ordered = [];
    const includedNames = new Set();
    orderedNames.forEach(name => {
      if (!artistSet.has(name) || excludedNames.has(name) || includedNames.has(name)) return;
      const artist = artistsByName.get(name);
      if (!artist) return;
      ordered.push(artist);
      includedNames.add(name);
    });
    return { ordered, includedNames };
  };

  const mainSingers = addInOrder(mainSingingArtistOrder, mainSingingArtists);
  const mainSingersWithoutOrder = [...artists].filter(artist => (
    mainSingingArtists.has(artist.name) &&
    !mainSingers.includedNames.has(artist.name)
  ));
  const adlibSingers = addInOrder(
    adlibSingingArtistOrder,
    adlibSingingArtists,
    mainSingingArtists
  );
  const adlibSingersWithoutOrder = [...artists].filter(artist => (
    adlibSingingArtists.has(artist.name) &&
    !mainSingingArtists.has(artist.name) &&
    !adlibSingers.includedNames.has(artist.name)
  ));
  const activeSingingNames = new Set([
    ...mainSingingArtists,
    ...adlibSingingArtists
  ]);
  const typingSingers = addInOrder(
    typingArtistOrder,
    typingArtists,
    activeSingingNames
  );
  const typingSingersWithoutOrder = [...artists].filter(artist => (
    typingArtists.has(artist.name) &&
    !activeSingingNames.has(artist.name) &&
    !typingSingers.includedNames.has(artist.name)
  ));
  const singingNames = new Set([
    ...activeSingingNames,
    ...typingArtists
  ]);
  const otherArtists = [...artists].filter(artist => !singingNames.has(artist.name)).sort((a, b) => {
    const activeDifference = Number(isArtistActive(b)) - Number(isArtistActive(a));
    if (activeDifference) return activeDifference;
    return getInactiveAt(b) - getInactiveAt(a);
  });
  const orderedMainSingers = [
    ...mainSingers.ordered,
    ...mainSingersWithoutOrder
  ];
  const orderedAdlibSingers = [
    ...adlibSingers.ordered,
    ...adlibSingersWithoutOrder
  ];
  const recentAdlibSinger = orderedAdlibSingers[0];
  const orderedActiveSingers = orderedMainSingers.length
    ? [
      orderedMainSingers[0],
      ...(recentAdlibSinger ? [recentAdlibSinger] : []),
      ...orderedMainSingers.slice(1),
      ...orderedAdlibSingers.slice(recentAdlibSinger ? 1 : 0)
    ]
    : orderedAdlibSingers;

  return [
    ...orderedActiveSingers,
    ...typingSingers.ordered,
    ...typingSingersWithoutOrder,
    ...otherArtists
  ];
};
