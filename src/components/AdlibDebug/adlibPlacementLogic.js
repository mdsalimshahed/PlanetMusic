/* --- src/components/AdlibDebug/adlibPlacementLogic.js --- */

// Deterministic pseudo-random generator
export const pseudoRandom = (seedStr) => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const x = Math.sin(hash++) * 10000;
  return x - Math.floor(x);
};

// Exported so the tracker can do JIT DOM reading outside of the loop
export const getRelativeRect = (element, containerRect) => {
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
  adlibWidth,
  adlibHeight,
  containerRect,
  cBox,
  sBox,
  isMulti,
  cols,
  activeSingersList,
  masterNamesArray,
  seedKey,
  globalIndex,
  sessionSeed
) => {
  // 1. The Goldilocks Margins (Outer Safe Zones)
  const EDGE_PAD_X = Math.max(30, containerRect.width * 0.08); 
  const EDGE_PAD_Y = Math.max(30, containerRect.height * 0.08); 
  const LYRIC_PAD = 25; 
  const SINGER_PAD = 20; 
  const MAX_DIST = 160; 

  const safeLeft = EDGE_PAD_X;
  const safeRight = containerRect.width - EDGE_PAD_X;
  const safeTop = EDGE_PAD_Y;
  const safeBottom = containerRect.height - EDGE_PAD_Y;

  // 2. Define Base Safe Zones
  const baseZones = [];
  if (cBox) {
    if (cBox.top > safeTop) {
      const bottomEdge = cBox.top - LYRIC_PAD;
      const topEdge = Math.max(safeTop, bottomEdge - MAX_DIST);
      if (bottomEdge > topEdge) {
        baseZones.push({ type: 'Top', left: safeLeft, right: safeRight, top: topEdge, bottom: bottomEdge });
      }
    }
    
    if (cBox.bottom < safeBottom) {
      const topEdge = cBox.bottom + LYRIC_PAD;
      let bottomEdge = Math.min(safeBottom, topEdge + MAX_DIST);
      
      if (sBox && sBox.top < safeBottom) {
        const sTopAdjusted = sBox.top - SINGER_PAD;
        if (sTopAdjusted > topEdge) {
          bottomEdge = Math.min(bottomEdge, sTopAdjusted);
          baseZones.push({ type: 'Bottom', left: safeLeft, right: safeRight, top: topEdge, bottom: bottomEdge });
        }
      } else {
        if (bottomEdge > topEdge) {
          baseZones.push({ type: 'Bottom', left: safeLeft, right: safeRight, top: topEdge, bottom: bottomEdge });
        }
      }
    }
  } else {
    baseZones.push({ type: 'Full', left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
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
          height: ixBottom - ixTop
        });
      }
    });
  });

  // 5. CHAOTIC ALTERNATION: Strictly alternate Top/Bottom using globalIndex
  let targetArea;
  if (intersectedAreas.length > 0) {
    const canvasMidY = containerRect.height / 2;
    
    const topZones = intersectedAreas.filter(a => a.top < canvasMidY).sort((a, b) => a.left - b.left);
    const bottomZones = intersectedAreas.filter(a => a.top >= canvasMidY).sort((a, b) => a.left - b.left);

    const sessionOffset = Math.floor(pseudoRandom(sessionSeed) * 10);
    const effectiveIndex = globalIndex + sessionOffset;

    if (topZones.length > 0 && bottomZones.length > 0) {
      if (effectiveIndex % 2 === 0) {
        targetArea = topZones[Math.floor(effectiveIndex / 2) % topZones.length];
      } else {
        targetArea = bottomZones[Math.floor(effectiveIndex / 2) % bottomZones.length];
      }
    } else {
      intersectedAreas.sort((a, b) => (a.top - b.top) || (a.left - b.left));
      targetArea = intersectedAreas[effectiveIndex % intersectedAreas.length];
    }
  } else if (validCells.length > 0) {
    const fallback = validCells[Math.floor(pseudoRandom(seedKey) * validCells.length)];
    targetArea = fallback;
  } else {
    targetArea = { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom };
  }

  // 6. GENERATE INNER SAFE ZONE (Prevents Center Placement from Bleeding Edges)
  // We inset the target area by half the ad-lib's dimensions, plus a 20% buffer to protect it during rotation.
  const padX = (adlibWidth / 2) * 1.2;
  const padY = (adlibHeight / 2) * 1.2;

  let innerLeft = targetArea.left + padX;
  let innerRight = targetArea.right - padX;
  let innerTop = targetArea.top + padY;
  let innerBottom = targetArea.bottom - padY;

  // Fallback: If the target area is smaller than the ad-lib itself, force it to center within the area
  if (innerLeft > innerRight) {
    const mid = (targetArea.left + targetArea.right) / 2;
    innerLeft = mid;
    innerRight = mid;
  }
  if (innerTop > innerBottom) {
    const mid = (targetArea.top + targetArea.bottom) / 2;
    innerTop = mid;
    innerBottom = mid;
  }

  // Generate a random center point STRICTLY inside the Inner Safe Zone
  const randomX = pseudoRandom(seedKey + 'x');
  const randomY = pseudoRandom(seedKey + 'y');

  const finalX = innerLeft + (randomX * (innerRight - innerLeft));
  const finalY = innerTop + (randomY * (innerBottom - innerTop));

  // 7. Calculate Dynamic Rotation based on distance from center
  const canvasMidX = containerRect.width / 2;
  const canvasMidY = containerRect.height / 2;
  const rotMultiplier = (finalX - canvasMidX) / (canvasMidX || 1);
  const ySign = (finalY < canvasMidY) ? 1 : -1;
  const rot = rotMultiplier * ySign * 18;

  return {
    left: `${finalX}px`,
    top: `${finalY}px`,
    rot: rot
  };
};