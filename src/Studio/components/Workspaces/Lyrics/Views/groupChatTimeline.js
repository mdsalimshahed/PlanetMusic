const PRESENCE_LEAD_SECONDS = 4;
const PRESENCE_TRAIL_SECONDS = 3.5;
const TYPING_LEAD_SECONDS = 2;

const splitArtists = (singer, fallbackArtist) => {
  const names = (singer || fallbackArtist || '').split(/\s*(?:,|&|\band\b|\+)\s*/i);
  return [...new Set(names.map(name => name.trim()).filter(Boolean))];
};

const getSegmentArtists = (segments, excludedRanges = []) => {
  const artists = new Set();
  let segmentStart = 0;
  (segments || []).forEach(segment => {
    const text = Array.from(segment.text || '');
    text.forEach((character, index) => {
      const charIndex = segmentStart + index;
      const isExcluded = excludedRanges.some(range =>
        charIndex >= range.start && charIndex < range.end
      );
      if (!isExcluded && !/^[\s\p{P}\p{S}]$/u.test(character)) {
        segment.artists?.forEach(artist => artists.add(artist));
      }
    });
    segmentStart += text.length;
  });
  return [...artists];
};

export const buildGroupChatTimeline = (lyrics, syncData, fallbackArtist, palette = {}) => {
  const lines = (lyrics || []).flatMap((lyric, index) => {
    const sync = syncData?.[index];
    if (sync?.start == null || !Number.isFinite(Number(sync.start))) return [];

    const start = Number(sync.start);
    const end = sync.end != null && Number.isFinite(Number(sync.end)) && Number(sync.end) >= start
      ? Number(sync.end)
      : start;

    const adlibs = sync?.isSplit && Array.isArray(sync.adlibs) ? sync.adlibs : [];
    const adlibRanges = adlibs.map(adlib => ({ start: adlib.charStart, end: adlib.charEnd }))
      .filter(range => Number.isFinite(range.start) && Number.isFinite(range.end));
    const mainArtists = getSegmentArtists(lyric.segments, adlibRanges);
    const lineArtists = mainArtists.length ? mainArtists : splitArtists(lyric.singer, fallbackArtist);
    const line = {
      index,
      sourceIndex: index,
      start,
      end,
      text: lyric.text || '',
      artists: lineArtists,
      color: lyric.color || '#ffffff',
      lyric,
      savedNode: sync
    };
    const messages = [{
      type: 'message',
      time: start,
      line
    }];

    adlibs.forEach((adlib, adlibIndex) => {
      const adlibStart = Number.isFinite(Number(adlib.start)) ? Number(adlib.start) : start;
      const adlibEnd = Number.isFinite(Number(adlib.end)) && Number(adlib.end) >= adlibStart
        ? Number(adlib.end)
        : adlibStart;
      const adlibArtists = getSegmentArtists(adlib.segments);
      const artists = adlibArtists.length
        ? adlibArtists
        : splitArtists(adlib.singer, fallbackArtist);
      if (!artists.length) return;
      messages.push({
        type: 'message',
        time: adlibStart,
        line: {
          index: `${index}-adlib-${adlibIndex}`,
          sourceIndex: index,
          start: adlibStart,
          end: adlibEnd,
          text: adlib.text || '',
          artists,
          color: adlib.color || lyric.color || '#ffffff',
          lyric: adlib,
          savedNode: adlib,
          isAdlib: true
        }
      });
    });

    return messages;
  }).sort((first, second) => first.time - second.time);

  const artistMap = new Map();
  const messages = lines;
  messages.forEach(event => {
    const line = event.line;
    line.artists.forEach(name => {
      const key = name.toLocaleLowerCase();
      const existing = artistMap.get(key);
      if (existing) {
        existing.firstLineStart = Math.min(existing.firstLineStart, event.time);
        existing.lastLineEnd = Math.max(existing.lastLineEnd, line.end);
      } else {
        artistMap.set(key, {
          name,
          color: palette[name] || line.color || '#ffffff',
          firstLineStart: event.time,
          lastLineEnd: line.end
        });
      }
    });
  });

  messages.forEach(event => {
    event.line.artists = event.line.artists.map(name => artistMap.get(name.toLocaleLowerCase()).name);
  });

  groupConsecutiveMessages(messages).forEach(group => {
    group.events.forEach(event => {
      event.line.chatSide = group.side;
    });
  });

  const artists = [...artistMap.values()].map(artist => ({
    ...artist,
    onlineAt: artist.firstLineStart - PRESENCE_LEAD_SECONDS,
    offlineAt: artist.lastLineEnd + PRESENCE_TRAIL_SECONDS
  }));

  const events = artists.flatMap(artist => [
    {
      type: 'join',
      time: Math.max(0, artist.onlineAt),
      artist
    },
    {
      type: 'leave',
      time: artist.offlineAt,
      artist
    }
  ]);

  events.push(...messages);
  events.sort((first, second) => first.time - second.time);

  return { artists, events, lines: messages.map(event => ({ ...event.line, start: event.time })) };
};

export const groupConsecutiveMessages = events => {
  const groups = [];
  const sideByArtistKey = new Map();
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

    if (
      previousGroup?.artistsKey === artistsKey &&
      !event.line.isAdlib &&
      !previousEvent?.line.isAdlib
    ) {
      previousGroup.events.push(event);
      mainSideByLineIndex.set(event.line.index, previousGroup.side);
      return;
    }

    if (side) {
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
    groups.push({ artistsKey, artists: event.line.artists, events: [event], side });
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

export const getGroupChatState = (timeline, time) => {
  const currentTime = Number.isFinite(time) ? time : 0;
  const artists = timeline.artists.filter(artist =>
    currentTime >= artist.onlineAt && currentTime < artist.offlineAt
  );
  const messages = timeline.events.filter(event => event.time <= currentTime);
  const nextLine = timeline.lines.find(line =>
    line.start > currentTime &&
    line.start - currentTime <= TYPING_LEAD_SECONDS &&
    line.artists.some(name => artists.some(artist => artist.name === name))
  );
  const typingArtists = nextLine
    ? nextLine.artists.filter(name => artists.some(artist => artist.name === name))
    : [];

  return { artists, messages: messages.slice(-24), typingArtists };
};

export const getActiveChatLines = (timeline, time) => {
  const currentTime = Number.isFinite(time) ? time : 0;
  return timeline.lines.filter(line =>
    line.end > line.start &&
    currentTime >= line.start &&
    currentTime < line.end
  );
};
