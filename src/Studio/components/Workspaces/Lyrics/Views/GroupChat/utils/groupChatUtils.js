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
