import { useEffect } from 'react';

const ARTWORK_COLOR_CACHE_LIMIT = 500;
const artworkColorCache = new Map();

const extractArtworkColor = (artworkUrl) => new Promise(resolve => {
  const image = new Image();
  image.crossOrigin = 'Anonymous';

  const finish = color => {
    image.onload = null;
    image.onerror = null;
    image.src = '';
    resolve(color);
  };

  image.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Could not create artwork color sampling context');
      canvas.width = 7;
      canvas.height = 7;
      context.drawImage(image, 0, 0, 7, 7);
      const data = context.getImageData(0, 0, 7, 7).data;
      const colorBuckets = new Map();

      for (let index = 0; index < data.length; index += 4) {
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const alpha = data[index + 3];
        const brightness = Math.max(red, green, blue);
        if (alpha <= 127 || brightness < 28 || brightness > 248) continue;

        const bucketKey = [red, green, blue].map(value => Math.floor(value / 32)).join(':');
        const bucket = colorBuckets.get(bucketKey) || { red: 0, green: 0, blue: 0, count: 0 };
        bucket.red += red;
        bucket.green += green;
        bucket.blue += blue;
        bucket.count += 1;
        colorBuckets.set(bucketKey, bucket);
      }

      const colorsByFrequency = [...colorBuckets.values()].sort((first, second) => second.count - first.count);
      const getAverageRgb = bucket => [
        Math.round(bucket.red / bucket.count),
        Math.round(bucket.green / bucket.count),
        Math.round(bucket.blue / bucket.count)
      ];
      const getLuminance = rgb => {
        const channels = rgb.map(value => {
          const normalized = value / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const brightenToLuminance = (rgb, targetLuminance) => {
        let lowerMix = 0;
        let upperMix = 1;
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const mix = (lowerMix + upperMix) / 2;
          const candidate = rgb.map(channel => Math.round(channel + (255 - channel) * mix));
          if (getLuminance(candidate) >= targetLuminance) upperMix = mix;
          else lowerMix = mix;
        }
        return rgb.map(channel => Math.round(channel + (255 - channel) * upperMix));
      };

      const dominantColor = colorsByFrequency[0];
      if (!dominantColor) {
        finish('#ffffff');
        return;
      }

      const dominantRgb = getAverageRgb(dominantColor);
      const dominantLuminance = getLuminance(dominantRgb);
      const brighterAlternative = dominantLuminance < 0.2
        ? colorsByFrequency.find(bucket => {
          const luminance = getLuminance(getAverageRgb(bucket));
          return luminance >= 0.2 && luminance <= 0.72;
        })
        : null;
      const selectedRgb = brighterAlternative
        ? getAverageRgb(brighterAlternative)
        : dominantLuminance < 0.2
          ? brightenToLuminance(dominantRgb, 0.22)
          : dominantRgb;
      finish(`rgb(${selectedRgb[0]}, ${selectedRgb[1]}, ${selectedRgb[2]})`);
    } catch {
      finish('#ffffff');
    }
  };

  image.onerror = () => finish('#ffffff');
  image.src = artworkUrl;
});

const getCachedArtworkColor = artworkUrl => {
  let colorPromise = artworkColorCache.get(artworkUrl);
  if (colorPromise) {
    artworkColorCache.delete(artworkUrl);
    artworkColorCache.set(artworkUrl, colorPromise);
    return colorPromise;
  }

  colorPromise = extractArtworkColor(artworkUrl);
  artworkColorCache.set(artworkUrl, colorPromise);
  if (artworkColorCache.size > ARTWORK_COLOR_CACHE_LIMIT) {
    artworkColorCache.delete(artworkColorCache.keys().next().value);
  }
  return colorPromise;
};

export const usePlayerArtwork = ({ currentTrack, isPlaying, isBuffering, setAccentColor, setAccentArtworkUrl }) => {
  useEffect(() => {
    const artworkUrl = currentTrack?.artworkUrl100;
    if (!artworkUrl || !isPlaying || isBuffering) {
      setAccentArtworkUrl(null);
      return;
    }

    let isCurrentArtwork = true;
    setAccentArtworkUrl(null);
    getCachedArtworkColor(artworkUrl).then(color => {
      if (!isCurrentArtwork) return;
      setAccentColor(color);
      setAccentArtworkUrl(artworkUrl);
    });

    return () => {
      isCurrentArtwork = false;
    };
  }, [currentTrack?.artworkUrl100, isPlaying, isBuffering, setAccentArtworkUrl, setAccentColor]);
};
