/* --- src/utils/colorUtils.js --- */

// Helper to convert HSL to HEX for the native HTML Color Picker
const hslToHex = (h, s, l) => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const getDistinctArtistColors = (rawLyrics, defaultArtist, featuredArtists = []) => {
  const artistColors = {};
  const discoveredNames = new Set();
  
  if (defaultArtist) {
    defaultArtist.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean).forEach(n => discoveredNames.add(n.trim()));
  }
  
  if (featuredArtists && featuredArtists.length > 0) {
    featuredArtists.forEach(f => {
      f.split(/\s*(?:,|&|\band\b|\+)\s*/i).filter(Boolean).forEach(n => discoveredNames.add(n.trim()));
    });
  }

  if (rawLyrics) {
    const lines = rawLyrics.split('\n').map(l => l.trim());
    const headerLines = lines.filter(l => l.startsWith('[') && l.endsWith(']'));
    
    headerLines.forEach(line => {
      const content = line.slice(1, -1);
      if (content.includes(':')) {
        const singersPart = content.split(':').slice(1).join(':').trim();
        const nakedNames = singersPart.replace(/<\/?[^>]+(>|$)/g, "").replace(/[_*~]/g, "");
        const splitNames = nakedNames.split(/\s*(?:,|&|\band\b)\s*/i).filter(Boolean);
        
        splitNames.forEach(name => {
          const cleanName = name.trim();
          if (cleanName.toLowerCase() !== 'both' && cleanName.toLowerCase() !== 'all') {
            discoveredNames.add(cleanName);
          }
        });
      }
    });
  }

  const artistArray = Array.from(discoveredNames);
  artistArray.forEach((artist, index) => {
    const hue = (index * (360 / artistArray.length) + 45) % 360;
    artistColors[artist] = hslToHex(hue, 90, 75);
  });

  return artistColors;
};