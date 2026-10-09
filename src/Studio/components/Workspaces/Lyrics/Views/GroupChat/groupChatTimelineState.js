const TYPING_ACTIVITY_WINDOW_SECONDS = 2;

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
    line.start - currentTime <= TYPING_ACTIVITY_WINDOW_SECONDS &&
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
