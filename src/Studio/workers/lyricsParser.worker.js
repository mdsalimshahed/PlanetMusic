import { parseLyrics } from '../utils/lyricsUtils.js';

self.onmessage = ({ data }) => {
  const { requestId, trackId, rawLyrics, artistName, masterPalette } = data;
  self.postMessage({
    requestId,
    trackId,
    lyrics: parseLyrics(rawLyrics, artistName, masterPalette)
  });
};
