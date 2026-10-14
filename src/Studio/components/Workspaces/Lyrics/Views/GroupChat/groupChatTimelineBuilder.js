import { groupConsecutiveMessages } from './groupChatTimelineGroups.js';

const PRESENCE_LEAD_SECONDS = 4;
const PRESENCE_TRAIL_SECONDS = 8.5;

const hasTimestamp = value => (
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)))
);

const splitArtists = (singer, fallbackArtist) => {
  const names = (singer || fallbackArtist || '').split(/\s*(?:,|&|\band\b|\+)\s*/i);
  return [...new Set(names.map(name => name.trim()).filter(Boolean))];
};

const isWhiteColor = color => {
  if (typeof color !== 'string') return false;
  const normalized = color.trim().toLowerCase();
  if (normalized === 'white' || normalized === '#fff' || normalized === '#ffffff') return true;
  const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return Boolean(rgb && rgb.slice(1).every(channel => Number(channel) === 255));
};

const isWhiteMarkerSegment = segment =>
  isWhiteColor(segment.color) && !segment.isGradient && !segment.gradient;

const isWhiteMarkedAdlib = adlib => {
  if (isWhiteColor(adlib.color)) return true;
  const contentSegments = (adlib.segments || []).filter(segment =>
    (segment.text || '').trim()
  );
  return contentSegments.length > 0 &&
    contentSegments.every(isWhiteMarkerSegment);
};

const getAdlibArtists = (adlib, palette) => {
  const segments = adlib.segments || [];
  const whiteMarked = isWhiteMarkedAdlib(adlib);
  return getSegmentArtists(segments.map(segment => ({
    ...segment,
    artists: whiteMarked || isWhiteMarkerSegment(segment)
      ? (segment.artists || []).filter(artist => isWhiteColor(palette[artist]))
      : segment.artists
  })));
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

const hasTextOutsideRanges = (text, excludedRanges) => Array.from(text || '')
  .some((character, index) => (
    !/\s/u.test(character) &&
    !excludedRanges.some(range => index >= range.start && index < range.end)
  ));

const hasRenderableText = item => Boolean(
  item?.text?.trim() ||
  item?.translation?.trim() ||
  item?.pronunciation?.trim() ||
  item?.segments?.some(segment => segment.text?.trim())
);

export const buildGroupChatTimeline = (lyrics, syncData, fallbackArtist, palette = {}) => {
  const lines = (lyrics || []).flatMap((lyric, index) => {
    const sync = syncData?.[index];
    if (!hasTimestamp(sync?.start)) return [];

    const start = Number(sync.start);
    const end = hasTimestamp(sync.end) && Number(sync.end) >= start
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
    const hasMainContent = hasTextOutsideRanges(lyric.text, adlibRanges) ||
      hasTextOutsideRanges(
        (lyric.segments || []).map(segment => segment.text || '').join(''),
        adlibRanges
      ) ||
      [lyric.translation, lyric.pronunciation]
        .some(value => typeof value === 'string' && value.trim());
    const messages = hasMainContent
      ? [{
        type: 'message',
        time: start,
        line
      }]
      : [];

    adlibs.forEach((adlib, adlibIndex) => {
      if (!hasTimestamp(adlib.start) || !hasRenderableText(adlib)) return;
      const adlibStart = Number(adlib.start);
      const adlibEnd = hasTimestamp(adlib.end) && Number(adlib.end) >= adlibStart
        ? Number(adlib.end)
        : adlibStart;
      const adlibArtists = getAdlibArtists(adlib, palette);
      const artists = adlibArtists;
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
