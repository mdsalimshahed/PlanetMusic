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
  isMulti,
  cols,
  activeSingersList,
  masterNamesArray,
  seedKey
) => {
  const container = document.querySelector('.focused-lyrics-preview');
  if (!container || !adlibElement) return { left: '50%', top: '50%', rot: 0 };

  const containerRect = container.getBoundingClientRect();
  const lyricsNode = document.querySelector('.focused-line.active');
  const singerNode = document.querySelector('.singer-name-corner.visible');

  const cBox = getRelativeRect(lyricsNode, containerRect);
  const sBox = getRelativeRect(singerNode, containerRect);

  const adlibWidth = adlibElement.offsetWidth;
  const adlibHeight = adlibElement.offsetHeight;

  // 1. Container Safe Bounds
  const safeLeft = 0;
  const safeTop = 0;
  const safeRight = containerRect.width;
  const safeBottom = containerRect.height;

  // 2. Define Base Safe Zones
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
        if (sBox.top > bTop) {
          baseZones.push({ left: safeLeft, right: safeRight, top: bTop, bottom: sBox.top });
        }
      } else {
        baseZones.push({ left: safeLeft, right: safeRight, top: bTop, bottom: safeBottom });
      }
    }
  } else {
    baseZones.push({ left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
  }

  // 3. Determine Valid Quadrants based on Active Singer
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

  // 4. Intersect Base Zones with Valid Cells
  const intersectedAreas = [];
  baseZones.forEach(bz => {
    validCells.forEach(vc => {
      const ixLeft = Math.max(bz.left, vc.left);
      const ixRight = Math.min(bz.right, vc.right);
      const ixTop = Math.max(bz.top, vc.top);
      const ixBottom = Math.min(bz.bottom, vc.bottom);

      if (ixLeft < ixRight && ixTop < ixBottom) {
        intersectedAreas.push({
          left: ixLeft,
          right: ixRight,
          top: ixTop,
          bottom: ixBottom,
          width: ixRight - ixLeft,
          height: ixBottom - ixTop,
          area: (ixRight - ixLeft) * (ixBottom - ixTop)
        });
      }
    });
  });

  // 5. CHAOTIC PLACEMENT: Pick a random valid zone & raw coordinate
  const randX = pseudoRandom(seedKey + '-x');
  const randY = pseudoRandom(seedKey + '-y');
  const randZone = pseudoRandom(seedKey + '-zone');

  let targetArea;
  if (intersectedAreas.length > 0) {
    intersectedAreas.sort((a, b) => b.area - a.area);
    const zoneIndex = Math.floor(randZone * intersectedAreas.length);
    targetArea = intersectedAreas[zoneIndex];
  } else if (validCells.length > 0) {
    const fallback = validCells[Math.floor(randZone * validCells.length)];
    targetArea = { ...fallback, width: fallback.right - fallback.left, height: fallback.bottom - fallback.top };
  } else {
    targetArea = { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom, width: safeRight, height: safeBottom };
  }

  const rawX = targetArea.left + (randX * targetArea.width);
  const rawY = targetArea.top + (randY * targetArea.height);

  // 6. RADIAL CLOCK ROTATION LOGIC (Cartesian Multiplication)
  const centerX = containerRect.width / 2;
  const centerY = containerRect.height / 2;
  
  // X-Axis (-1 for Left, +1 for Right)
  const rotMultiplier = (rawX - centerX) / (centerX || 1); 
  
  // Y-Axis (+1 for Top half, -1 for Bottom half) [DOM coordinates inverted to Cartesian]
  const ySign = (rawY < centerY) ? 1 : -1;
  
  // (+X * -Y) = -18 (Minus) for Bottom-Right
  const baseRot = rotMultiplier * ySign * 18;
  
  // Add a slight organic variation (±4 degrees) so it's not perfectly rigid
  const randRotVar = (pseudoRandom(seedKey + '-rotvar') * 8) - 4;
  const finalRot = baseRot + randRotVar;

  // 7. Calculate AABB with the newly determined rotation
  const rad = finalRot * (Math.PI / 180);
  const aabbW = Math.abs(adlibWidth * Math.cos(rad)) + Math.abs(adlibHeight * Math.sin(rad));
  const aabbH = Math.abs(adlibWidth * Math.sin(rad)) + Math.abs(adlibHeight * Math.cos(rad));

  // 8. Clamp the coordinate so the AABB fits perfectly inside the target area
  let finalX = rawX;
  let finalY = rawY;

  const iLeft = targetArea.left + aabbW / 2;
  const iTop = targetArea.top + aabbH / 2;
  const iRight = targetArea.right - aabbW / 2;
  const iBottom = targetArea.bottom - aabbH / 2;

  if (iRight >= iLeft && iBottom >= iTop) {
    finalX = Math.max(iLeft, Math.min(iRight, finalX));
    finalY = Math.max(iTop, Math.min(iBottom, finalY));
  } else {
    finalX = targetArea.left + targetArea.width / 2;
    finalY = targetArea.top + targetArea.height / 2;
  }

  return {
    left: `${(finalX / containerRect.width) * 100}%`,
    top: `${(finalY / containerRect.height) * 100}%`,
    rot: finalRot
  };
};