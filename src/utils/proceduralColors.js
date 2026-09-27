const GOLDEN_ANGLE = 137.50776405003785;
const REFRESH_HUE_OFFSET = Math.random() * 360;
const colorAssignments = new Map();
const usedColors = new Set();
let nextHueIndex = 0;

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

export const getProceduralColor = (key) => {
  const colorKey = String(key);
  if (colorAssignments.has(colorKey)) return colorAssignments.get(colorKey);

  let color;
  do {
    color = hslToHex(REFRESH_HUE_OFFSET + nextHueIndex * GOLDEN_ANGLE, 70, 64);
    nextHueIndex += 1;
  } while (usedColors.has(color));

  colorAssignments.set(colorKey, color);
  usedColors.add(color);
  return color;
};

export const getProceduralGradient = (key) => {
  const first = getProceduralColor(`${key}:start`);
  const second = getProceduralColor(`${key}:end`);
  return `linear-gradient(135deg, ${first} 0%, ${second} 100%)`;
};