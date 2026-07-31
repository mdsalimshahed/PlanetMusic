/* --- src/components/AdlibDebug/adlibPlacementLogic.js --- */

// Deterministic pseudo-random generator so ad-libs always appear in the exact same spot on replays
const pseudoRandom = (seedStr) => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash++) * 10000;
  return x - Math.floor(x);
};

// Helper to get coordinates relative to the preview container
const getRelativeRect = (element, containerRect) => {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - containerRect.top,
    bottom: rect.bottom - containerRect.top,
    left: rect.left - containerRect.left,
    right: rect.right - containerRect.left,
    width: rect.width,
    height: rect.height
  };
};

export const generateSafeAdlibPosition = (
  adlibElement,
  rotationDeg,
  isMulti,
  cols,
  activeSingersList,
  masterNamesArray,
  seedKey
) => {
  const container = document.querySelector('.focused-lyrics-preview');
  if (!container || !adlibElement) return { left: '50%', top: '50%' };

  const containerRect = container.getBoundingClientRect();
  const lyricsNode = document.querySelector('.focused-line.active');
  const singerNode = document.querySelector('.singer-name-corner.visible');

  const cBox = getRelativeRect(lyricsNode, containerRect);
  const sBox = getRelativeRect(singerNode, containerRect);

  const adlibWidth = adlibElement.offsetWidth;
  const adlibHeight = adlibElement.offsetHeight;

  // 1. Calculate Axis-Aligned Bounding Box (AABB) of the rotated ad-lib
  const rad = rotationDeg * (Math.PI / 180);
  const aabbW = Math.abs(adlibWidth * Math.cos(rad)) + Math.abs(adlibHeight * Math.sin(rad));
  const aabbH = Math.abs(adlibWidth * Math.sin(rad)) + Math.abs(adlibHeight * Math.cos(rad));

  // 2. Container Safe Bounds
  const safeLeft = 0;
  const safeTop = 0;
  const safeRight = containerRect.width;
  const safeBottom = containerRect.height;

  // 3. Define Base Safe Zones
  const baseZones = [];
  if (cBox) {
    // Top Zone (Full Width)
    if (cBox.top > safeTop) {
      baseZones.push({ left: safeLeft, right: safeRight, top: safeTop, bottom: cBox.top });
    }
    
    // Bottom Zone (Full width ABOVE singer name)
    if (cBox.bottom < safeBottom) {
      const bTop = cBox.bottom;
      
      if (sBox && sBox.top < safeBottom) {
        // Zone A: Full width area ABOVE the singer name
        if (sBox.top > bTop) {
          baseZones.push({ left: safeLeft, right: safeRight, top: bTop, bottom: sBox.top });
        }
      } else {
        // No singer name, use entire bottom area
        baseZones.push({ left: safeLeft, right: safeRight, top: bTop, bottom: safeBottom });
      }
    }
  } else {
    // If no lyrics are present, whole screen is safe
    baseZones.push({ left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
  }

  // 4. Determine Valid Quadrants based on Active Singer
  const validCells = [];
  const colW = containerRect.width / cols;
  const rowH = containerRect.height / 2;

  const getArtistForCell = (idx) => {
    if (!masterNamesArray || masterNamesArray.length === 0) return null;
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    return masterNamesArray[(c + r) % masterNamesArray.length];
  };

  if (!isMulti || activeSingersList.length === 0) {
    validCells.push({ left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
  } else {
    for (let i = 0; i < cols * 2; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const artist = getArtistForCell(i);
      
      if (activeSingersList.includes(artist)) {
        validCells.push({
          left: c * colW,
          right: (c + 1) * colW,
          top: r * rowH,
          bottom: (r + 1) * rowH
        });
      }
    }
  }

  // 5. Intersect Base Zones with Valid Cells, then shrink by AABB to get the "Center-Point Safe Areas"
  const innerZones = [];
  
  baseZones.forEach(bz => {
    validCells.forEach(vc => {
      const ixLeft = Math.max(bz.left, vc.left);
      const ixRight = Math.min(bz.right, vc.right);
      const ixTop = Math.max(bz.top, vc.top);
      const ixBottom = Math.min(bz.bottom, vc.bottom);

      if (ixLeft < ixRight && ixTop < ixBottom) {
        const szWidth = ixRight - ixLeft;
        const szHeight = ixBottom - ixTop;

        if (aabbW > 0 && aabbH > 0) {
          const iLeft = ixLeft + aabbW / 2;
          const iTop = ixTop + aabbH / 2;
          const iWidth = szWidth - aabbW;
          const iHeight = szHeight - aabbH;

          if (iWidth >= 0 && iHeight >= 0) {
            innerZones.push({
              left: iLeft,
              top: iTop,
              width: iWidth,
              height: iHeight,
              area: iWidth * iHeight
            });
          }
        }
      }
    });
  });

  // 6. CHAOTIC PLACEMENT: Pick a random valid zone
  let finalX = containerRect.width / 2;
  let finalY = containerRect.height / 2;

  const randX = pseudoRandom(seedKey + '-x');
  const randY = pseudoRandom(seedKey + '-y');
  const randZone = pseudoRandom(seedKey + '-zone'); // Determines WHICH valid safe zone to use

  if (innerZones.length > 0) {
    // Sort just to keep array indices perfectly deterministic
    innerZones.sort((a, b) => b.area - a.area);
    
    // Pick a completely random zone to ensure chaotic distribution across top and bottom
    const zoneIndex = Math.floor(randZone * innerZones.length);
    const targetZone = innerZones[zoneIndex];

    finalX = targetZone.left + (randX * targetZone.width);
    finalY = targetZone.top + (randY * targetZone.height);
  } else if (validCells.length > 0) {
    // Fallback: Center of quadrant
    const fallback = validCells[Math.floor(randX * validCells.length)];
    finalX = fallback.left + (fallback.right - fallback.left) / 2;
    finalY = fallback.top + (fallback.bottom - fallback.top) / 2;
  }

  return {
    left: `${(finalX / containerRect.width) * 100}%`,
    top: `${(finalY / containerRect.height) * 100}%`
  };
};