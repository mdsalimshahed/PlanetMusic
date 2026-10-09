import { groupConsecutiveMessages } from './groupChatTimelineGroups.js';

const PRESENCE_LEAD_SECONDS = 4;
const PRESENCE_TRAIL_SECONDS = 8.5;

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
    const lineArtists = lyric.singer
      ? (mainArtists.length ? mainArtists : splitArtists(lyric.singer, fallbackArtist))
      : [];
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
      const artists = adlib.singer
        ? (adlibArtists.length ? adlibArtists : splitArtists(adlib.singer, fallbackArtist))
        : [];
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
