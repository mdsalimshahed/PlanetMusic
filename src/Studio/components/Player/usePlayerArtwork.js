import { useEffect } from 'react';

export const usePlayerArtwork = ({ currentTrack, setAccentColor, setAccentArtworkUrl }) => {
  useEffect(() => {
    const artworkUrl = currentTrack?.artworkUrl100;
    if (!artworkUrl) {
      setAccentArtworkUrl(null);
      return;
    }

    let isCurrentArtwork = true;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    setAccentArtworkUrl(null);
    img.onload = () => {
      if (!isCurrentArtwork) return;
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = 7;
        canvas.height = 7;
        ctx.drawImage(img, 0, 0, 7, 7);
        const data = ctx.getImageData(0, 0, 7, 7).data;
        const colorBuckets = new Map();

        for (let i = 0; i < data.length; i += 4) {
          const [red, green, blue, alpha] = data.slice(i, i + 4);
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

        const colorsByFrequency = [...colorBuckets.values()].sort((a, b) => b.count - a.count);
        const getAverageRgb = (bucket) => [
          Math.round(bucket.red / bucket.count),
          Math.round(bucket.green / bucket.count),
          Math.round(bucket.blue / bucket.count)
        ];
        const getLuminance = (rgb) => {
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
        if (dominantColor) {
          const dominantLuminance = getLuminance(getAverageRgb(dominantColor));
          const brighterAlternative = dominantLuminance < 0.2
            ? colorsByFrequency.find(bucket => {
              const luminance = getLuminance(getAverageRgb(bucket));
              return luminance >= 0.2 && luminance <= 0.72;
            })
            : null;
          const dominantRgb = getAverageRgb(dominantColor);
          const selectedRgb = brighterAlternative
            ? getAverageRgb(brighterAlternative)
            : dominantLuminance < 0.2
              ? brightenToLuminance(dominantRgb, 0.22)
              : dominantRgb;
          const [red, green, blue] = selectedRgb;
          setAccentColor(`rgb(${red}, ${green}, ${blue})`);
          setAccentArtworkUrl(artworkUrl);
        }
      } catch {
        setAccentColor('#ffffff');
      } finally {
        img.onload = null; img.onerror = null; img.src = '';
      }
    };
    img.onerror = () => {
      if (isCurrentArtwork) setAccentColor('#ffffff');
      img.onload = null; img.onerror = null; img.src = '';
    };
    img.src = artworkUrl;

    return () => {
      isCurrentArtwork = false;
      img.onload = null;
      img.onerror = null;
      img.src = '';
    };
  }, [currentTrack?.artworkUrl100, setAccentArtworkUrl, setAccentColor]);
};
