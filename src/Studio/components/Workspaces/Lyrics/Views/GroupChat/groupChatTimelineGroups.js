export const groupConsecutiveMessages = events => {
  const messageEvents = events.filter(event => event.type === 'message');
  const groups = [];
  let previousSide;
  let previousWasAdlib = false;
  let previousArtistsKey;
  messageEvents.forEach(event => {
    const { line } = event;
    const artistsKey = line.artists
      .map(name => name.trim().toLocaleLowerCase())
      .sort()
      .join('\u0000');
    const previousGroup = groups[groups.length - 1];
    const previousLine = previousGroup?.events[previousGroup.events.length - 1].line;
    const switchesSide = line.isAdlib ||
      previousWasAdlib ||
      (previousSide && previousArtistsKey !== artistsKey);
    const side = switchesSide
      ? (previousSide === 'left' ? 'right' : 'left')
      : (previousSide || 'left');

    line.chatSide = side;
    previousSide = side;
    previousWasAdlib = Boolean(line.isAdlib);
    previousArtistsKey = artistsKey;
    if (
      previousGroup?.artistsKey === artistsKey &&
      previousGroup.side === side &&
      !line.isAdlib &&
      !previousLine?.isAdlib
    ) {
      previousGroup.events.push(event);
      return;
    }

    groups.push({ artistsKey, artists: line.artists, events: [event], side });
  });
  return groups;
};

export const buildGroupChatHistory = events => {
  const history = [];
  events.forEach(event => {
    if (event.type !== 'message') {
      history.push({ type: event.type, event });
      return;
    }

    const artistsKey = event.line.artists
      .map(name => name.trim().toLocaleLowerCase())
      .sort()
      .join('\u0000');
    history.push({
      type: 'message-chain',
      artistsKey,
      artists: event.line.artists,
      side: event.line.chatSide,
      events: [event]
    });
    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    const previousLine = previous?.type === 'message-chain'
      ? previous.events[previous.events.length - 1].line
      : null;
    const currentLine = event.line;
    if (
      previous?.type === 'message-chain' &&
      previous.artistsKey === current.artistsKey &&
      previous.side === current.side &&
      (
        (previousLine?.isAdlib && currentLine.isAdlib) ||
        (!previousLine?.isAdlib && !currentLine.isAdlib)
      )
    ) {
      previous.events.push(event);
      history.pop();
    }
  });
  return history;
};
