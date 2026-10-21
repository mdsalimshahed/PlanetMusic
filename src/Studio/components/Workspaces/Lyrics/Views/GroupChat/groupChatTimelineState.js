export const ARTIST_ACTIVITY_WINDOW_SECONDS = 2;

export const getGroupChatState = (timeline, time) => {
  const currentTime = Number.isFinite(time) ? time : 0;
  const artists = timeline.artists.filter(artist =>
    currentTime >= artist.onlineAt && currentTime < artist.offlineAt
  );
  const messages = timeline.events.filter(event => event.time <= currentTime);
  const eligibleArtists = line =>
    line.artists.filter(name => artists.some(artist => artist.name === name));
  const upcomingLines = timeline.lines.filter(line =>
    line.start > currentTime &&
    line.start - currentTime <= ARTIST_ACTIVITY_WINDOW_SECONDS &&
    eligibleArtists(line).length > 0
  );
  const typingArtists = [...new Set(upcomingLines.flatMap(eligibleArtists))];

  return { artists, messages, typingArtists };
};

export const getActiveChatLines = (timeline, time) => {
  const currentTime = Number.isFinite(time) ? time : 0;
  return timeline.lines.filter(line =>
    line.end > line.start &&
    currentTime >= line.start &&
    currentTime < line.end
  );
};

export const getSingingArtistGroups = (timeline, time) => {
  const currentTime = Number.isFinite(time) ? time : 0;
  const mainArtists = new Set();
  const adlibArtists = new Set();
  const typingArtists = new Set();
  const mainArtistOrder = [];
  const adlibArtistOrder = [];
  const typingArtistOrder = [];
  const adlibArtistLastStartByName = new Map();

  timeline.lines.forEach(line => {
    const isActive = line.end > line.start &&
      currentTime >= line.start &&
      currentTime < line.end;
    const isAboutToSing = line.start > currentTime &&
      line.start - currentTime <= ARTIST_ACTIVITY_WINDOW_SECONDS;
    if (!isActive && !isAboutToSing) return;

    const artistGroup = line.isAdlib
      ? (isActive ? adlibArtists : typingArtists)
      : (isActive ? mainArtists : typingArtists);
    const artistOrder = line.isAdlib
      ? (isActive ? adlibArtistOrder : typingArtistOrder)
      : (isActive ? mainArtistOrder : typingArtistOrder);
    line.artists.forEach(name => {
      if (!artistGroup.has(name)) artistOrder.push(name);
      artistGroup.add(name);
      if (line.isAdlib && isActive) {
        adlibArtistLastStartByName.set(
          name,
          Math.max(adlibArtistLastStartByName.get(name) ?? Number.NEGATIVE_INFINITY, line.start)
        );
      }
    });
  });

  adlibArtistOrder.sort((first, second) =>
    adlibArtistLastStartByName.get(second) - adlibArtistLastStartByName.get(first)
  );

  return {
    mainArtists,
    adlibArtists,
    typingArtists,
    mainArtistOrder,
    adlibArtistOrder,
    typingArtistOrder
  };
};
