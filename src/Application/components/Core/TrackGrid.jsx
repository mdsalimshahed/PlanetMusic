/* --- src/Application/components/Core/TrackGrid.jsx --- */
import './TrackGrid.css';
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SongCard from './SongCard.jsx';
import InFeedSponsor from '../Promos/InFeedSponsor.jsx';

const adPlacementSessionSeed = Math.floor(Math.random() * 0x100000000);

const getRandomGridEntries = (items, columnCount, itemSequence) => {
  if (columnCount === 0) return [];
  let seed = adPlacementSessionSeed;
  for (let index = 0; index < itemSequence.length; index += 1) {
    seed = Math.imul(seed ^ itemSequence.charCodeAt(index), 16777619) >>> 0;
  }

  const nextRandom = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const entries = (columnCount === 2 ? [] : items.slice(0, columnCount)).map((song, index) => ({
    type: 'track',
    song,
    index
  }));
  if (columnCount === 2) {
    let songIndex = 0;
    let adIndex = 0;

    while (songIndex < items.length) {
      const blockEnd = Math.min(songIndex + 6, items.length);
      while (songIndex < blockEnd) {
        entries.push({
          type: 'track',
          song: items[songIndex],
          index: songIndex
        });
        songIndex += 1;
      }

      if (songIndex < items.length) {
        const adEntry = { type: 'ad', key: `vault-promo-${adIndex}` };
        adIndex += 1;
        const trackEntry = {
          type: 'track',
          song: items[songIndex],
          index: songIndex
        };
        songIndex += 1;
        if (nextRandom() < 0.5) {
          entries.push(adEntry, trackEntry);
        } else {
          entries.push(trackEntry, adEntry);
        }
      }
    }

    return entries;
  }

  let songIndex = entries.length;
  let adIndex = 0;
  const songsPerRow = Math.max(1, columnCount - 1);
  const usedAdColumns = new Set();
  let previousAdColumn = null;

  while (songIndex < items.length) {
    const rowSongCount = Math.min(songsPerRow, items.length - songIndex);
    const possibleColumns = Array.from({ length: rowSongCount + 1 }, (_, index) => index);
    let availableColumns = possibleColumns.filter((column) => (
      !usedAdColumns.has(column) && column !== previousAdColumn
    ));
    if (availableColumns.length === 0) {
      usedAdColumns.clear();
      availableColumns = possibleColumns.filter((column) => column !== previousAdColumn);
    }
    const adColumn = availableColumns[Math.floor(nextRandom() * availableColumns.length)];
    usedAdColumns.add(adColumn);
    previousAdColumn = adColumn;

    for (let column = 0; column <= rowSongCount; column += 1) {
      if (column === adColumn) {
        entries.push({ type: 'ad', key: `vault-promo-${adIndex}` });
        adIndex += 1;
      }
      if (column < rowSongCount) {
        entries.push({
          type: 'track',
          song: items[songIndex],
          index: songIndex
        });
        songIndex += 1;
      }
    }
  }

  return entries;
};

const TrackGrid = memo(({ items, library, setSelectedSong, setCurrentTrack, adsEnabled }) => {
  const gridRef = useRef(null);
  const [columnCount, setColumnCount] = useState(0);
  const itemSequence = useMemo(
    () => items.map((song) => song.trackId).join('\u001f'),
    [items]
  );
  const savedTrackIds = useMemo(
    () => new Set(library.map((song) => song.trackId)),
    [library]
  );

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const updateColumnCount = () => {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      setColumnCount((current) => (current === columns ? current : columns));
    };

    updateColumnCount();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const gridEntries = useMemo(
    () => getRandomGridEntries(items, columnCount, itemSequence),
    [columnCount, itemSequence, items]
  );

  return (
    <div className="track-grid" ref={gridRef}>
      {gridEntries.map((entry, gridIndex) => {
        const staggerDelay = Math.min(gridIndex * 0.05, 1.5);
        if (entry.type === 'ad') {
          return adsEnabled ? (
            <InFeedSponsor
              key={entry.key}
              placement="trackGrid"
              wrapperClass="track-grid-item dynamic-radius-override"
              wrapperStyle={{ animationDelay: `${staggerDelay}s` }}
            />
          ) : null;
        }

        return (
          <div
            key={`${entry.song.trackId}-${entry.index}`}
            className="track-grid-item"
            style={{ animationDelay: `${staggerDelay}s` }}
          >
            <SongCard
              song={entry.song}
              isSaved={savedTrackIds.has(entry.song.trackId)}
              setSelectedSong={setSelectedSong}
              setCurrentTrack={setCurrentTrack}
            />
          </div>
        );
      })}
    </div>
  );
});

export default TrackGrid;