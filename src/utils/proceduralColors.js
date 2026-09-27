const GOLDEN_ANGLE = 137.50776405003785;

const hslToHex = (hue, saturation, lightness) => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = (1 - Math.abs((2 * lightness) / 100 - 1)) * saturation / 100;
  const section = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const match = lightness / 100 - chroma / 2;
  const channels = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];

  return `#${channels.map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
};

export const getProceduralColor = (index) => {
  return hslToHex(index * GOLDEN_ANGLE, 70, 64);
};

export const getProceduralGradient = (index) => {
  const hue = index * GOLDEN_ANGLE;
  const first = hslToHex(hue, 70, 64);
  const second = hslToHex(hue + 38, 72, 62);
  return `linear-gradient(135deg, ${first} 0%, ${second} 100%)`;
};