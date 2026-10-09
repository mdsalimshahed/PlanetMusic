export const getClockTime = (eventTime, playbackTime) => {
  const timestamp = new Date(Date.now() + (eventTime - playbackTime) * 1000);
  return timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

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
