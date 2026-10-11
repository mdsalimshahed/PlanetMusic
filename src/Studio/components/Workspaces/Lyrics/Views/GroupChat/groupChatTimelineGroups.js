export const groupConsecutiveMessages = events => {
  const groups = [];
  const sideByArtistKey = new Map();
  const latestEventByArtistKey = new Map();
  const mainSideByLineIndex = new Map();
  let nextSide = 'left';
  events.filter(event => event.type === 'message').forEach(event => {
    const artistsKey = event.line.artists
      .map(name => name.trim().toLocaleLowerCase())
      .sort()
      .join('\u0000');
    let side = event.line.chatSide;
    const previousGroup = groups[groups.length - 1];
    const previousEvent = previousGroup?.events[previousGroup.events.length - 1];
    const previousArtistEvent = latestEventByArtistKey.get(artistsKey);
    const artistGap = previousArtistEvent
      ? event.time - previousArtistEvent.end
      : 0;
    const artistReturnedAfterBreak = artistGap > 5;

    if (
      previousGroup?.artistsKey === artistsKey &&
      !artistReturnedAfterBreak &&
      !event.line.isAdlib &&
      !previousEvent?.line.isAdlib
    ) {
      previousGroup.events.push(event);
      mainSideByLineIndex.set(event.line.index, previousGroup.side);
      latestEventByArtistKey.set(artistsKey, {
        end: event.line.end ?? event.time,
        side: previousGroup.side
      });
      return;
    }

    if (!artistsKey) {
      side = previousGroup
        ? (previousGroup.side === 'left' ? 'right' : 'left')
        : nextSide;
    } else if (!event.line.isAdlib && artistReturnedAfterBreak) {
      const previousSide = previousArtistEvent.side;
      side = previousSide === 'left' ? 'right' : 'left';
    } else if (side) {
      if (!event.line.isAdlib) mainSideByLineIndex.set(event.line.index, side);
    } else if (event.line.isAdlib) {
      const mainSide = mainSideByLineIndex.get(event.line.sourceIndex);
      const stableArtistSide = sideByArtistKey.get(artistsKey) || nextSide;
      side = mainSide
        ? (mainSide === 'left' ? 'right' : 'left')
        : (stableArtistSide === 'left' ? 'right' : 'left');
    } else if (previousGroup?.artistsKey === artistsKey && !previousEvent?.line.isAdlib) {
      previousGroup.events.push(event);
      mainSideByLineIndex.set(event.line.index, previousGroup.side);
      return;
    } else {
      side = sideByArtistKey.get(artistsKey);
      if (!side) {
        side = nextSide;
        sideByArtistKey.set(artistsKey, side);
      }
      mainSideByLineIndex.set(event.line.index, side);
    }
    nextSide = side === 'left' ? 'right' : 'left';
    if (artistsKey && !event.line.isAdlib) sideByArtistKey.set(artistsKey, side);
    groups.push({ artistsKey, artists: event.line.artists, events: [event], side });
    if (artistsKey) {
      latestEventByArtistKey.set(artistsKey, {
        end: event.line.end ?? event.time,
        side: event.line.isAdlib
          ? (mainSideByLineIndex.get(event.line.sourceIndex) === 'left' ? 'right' : 'left')
          : side
      });
    }
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
    if (
      previous?.type === 'message-chain' &&
      previous.artistsKey === current.artistsKey &&
      previous.side === current.side &&
      !previous.events[previous.events.length - 1].line.isAdlib &&
      !event.line.isAdlib
    ) {
      previous.events.push(event);
      history.pop();
    }
  });
  return history;
};
