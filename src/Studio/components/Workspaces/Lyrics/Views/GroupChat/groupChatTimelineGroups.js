const RECENT_GAP_SAMPLE_LIMIT = 5;
const GAP_OUTLIER_MULTIPLIER = 2.5;
const MIN_ADAPTIVE_GAP_THRESHOLD_SECONDS = 1.5;
const DEFAULT_GAP_THRESHOLD_SECONDS = 5;

const getMedian = values => {
  const sortedValues = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2
    ? sortedValues[middle]
    : (sortedValues[middle - 1] + sortedValues[middle]) / 2;
};

const getGapThreshold = recentGaps => recentGaps.length
  ? Math.max(
    MIN_ADAPTIVE_GAP_THRESHOLD_SECONDS,
    getMedian(recentGaps) * GAP_OUTLIER_MULTIPLIER
  )
  : DEFAULT_GAP_THRESHOLD_SECONDS;

const getMainMessageGroups = events => {
  const groups = [];
  const latestEventByArtistKey = new Map();
  const recentGapsByArtistKey = new Map();
  let nextSide = 'left';
  events.filter(event => event.type === 'message').forEach(event => {
    const artistsKey = event.line.artists
      .map(name => name.trim().toLocaleLowerCase())
      .sort()
      .join('\u0000');
    const previousGroup = groups[groups.length - 1];
    const previousArtistEvent = latestEventByArtistKey.get(artistsKey);
    const artistGap = previousArtistEvent
      ? Math.max(0, event.time - previousArtistEvent.end)
      : 0;
    const recentGaps = recentGapsByArtistKey.get(artistsKey) || [];
    const artistReturnedAfterBreak = previousArtistEvent &&
      artistGap > getGapThreshold(recentGaps);

    if (
      artistsKey &&
      previousGroup?.artistsKey === artistsKey &&
      !artistReturnedAfterBreak
    ) {
      previousGroup.events.push(event);
      latestEventByArtistKey.set(artistsKey, {
        end: event.line.end ?? event.time,
        side: previousGroup.side
      });
      recentGapsByArtistKey.set(artistsKey, [
        ...recentGaps,
        artistGap
      ].slice(-RECENT_GAP_SAMPLE_LIMIT));
      return;
    }

    let side;
    if (!artistsKey) {
      side = previousGroup
        ? (previousGroup.side === 'left' ? 'right' : 'left')
        : nextSide;
    } else if (previousGroup && previousGroup.artistsKey !== artistsKey) {
      side = previousGroup.side === 'left' ? 'right' : 'left';
    } else if (previousArtistEvent && artistReturnedAfterBreak) {
      side = previousArtistEvent.side === 'left' ? 'right' : 'left';
    } else if (previousArtistEvent) {
      side = previousArtistEvent.side;
    } else {
      side = nextSide;
    }
    nextSide = side === 'left' ? 'right' : 'left';
    groups.push({ artistsKey, artists: event.line.artists, events: [event], side });
    if (artistsKey) {
      latestEventByArtistKey.set(artistsKey, {
        end: event.line.end ?? event.time,
        side
      });
      if (previousArtistEvent) {
        recentGapsByArtistKey.set(artistsKey, [
          ...recentGaps,
          artistGap
        ].slice(-RECENT_GAP_SAMPLE_LIMIT));
      }
    }
  });
  return groups;
};

export const groupConsecutiveMessages = events => {
  const messageEvents = events.filter(event => event.type === 'message');
  const mainGroups = getMainMessageGroups(
    messageEvents.filter(event => !event.line.isAdlib)
  );
  const mainSideByLineIndex = new Map();
  mainGroups.forEach(group => {
    group.events.forEach(event => mainSideByLineIndex.set(event.line.index, group.side));
  });

  const groups = [];
  messageEvents.forEach(event => {
    const { line } = event;
    const artistsKey = line.artists
      .map(name => name.trim().toLocaleLowerCase())
      .sort()
      .join('\u0000');
    const previousGroup = groups[groups.length - 1];
    const sourceMainSide = mainSideByLineIndex.get(line.sourceIndex);
    const previousLine = previousGroup?.events[previousGroup.events.length - 1].line;
    const continuesAdlibChain = line.isAdlib &&
      previousLine?.isAdlib &&
      previousGroup.artistsKey === artistsKey;
    const side = continuesAdlibChain
      ? previousGroup.side
      : line.isAdlib
        ? ((sourceMainSide || previousGroup?.side || 'left') === 'left' ? 'right' : 'left')
        : mainSideByLineIndex.get(line.index) || 'left';

    line.chatSide = side;
    if (
      previousGroup?.artistsKey === artistsKey &&
      previousGroup.side === side &&
      (continuesAdlibChain || (!line.isAdlib && !previousLine?.isAdlib))
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
