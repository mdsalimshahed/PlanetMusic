/* --- src/components/AdlibDebug/adlibPlacementLogic.js --- */

// Exported so the tracker can do JIT DOM reading outside of the loop
export const getRelativeRect = (element, containerRect) => {
  if (!element) return null;

  // Extract tight text bounds to ignore 100% width block containers
  let minTop = Infinity, minLeft = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  let hasValidBounds = false;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  let node;
          
  while ((node = walker.nextNode())) {
    if (node.textContent.trim() !== '') {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = range.getClientRects();
                      
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        if (rect.width > 0 && rect.height > 0) {
          hasValidBounds = true;
          minTop = Math.min(minTop, rect.top);
          minLeft = Math.min(minLeft, rect.left);
          maxRight = Math.max(maxRight, rect.right);
          maxBottom = Math.max(maxBottom, rect.bottom);
        }
      }
    }
  }

  if (hasValidBounds) {
    return {
      top: minTop - containerRect.top,
      bottom: maxBottom - containerRect.top,
      left: minLeft - containerRect.left,
      right: maxRight - containerRect.left,
      width: maxRight - minLeft,
      height: maxBottom - minTop
    };
  }

  // Fallback to basic bounding box if no text nodes found
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
  masterNamesArray
) => {
  // 1. The Goldilocks Margins (Outer Safe Zones mirroring AdlibDebugOverlay)
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

  // 5. PURE RANDOM ALTERNATION: No memory, no seeds.
  let targetArea;
  if (intersectedAreas.length > 0) {
    const canvasMidY = containerRect.height / 2;
    const topZones = intersectedAreas.filter(a => a.top < canvasMidY);
    const bottomZones = intersectedAreas.filter(a => a.top >= canvasMidY);

    if (topZones.length > 0 && bottomZones.length > 0) {
      if (Math.random() > 0.5) {
        targetArea = topZones[Math.floor(Math.random() * topZones.length)];
      } else {
        targetArea = bottomZones[Math.floor(Math.random() * bottomZones.length)];
      }
    } else {
      targetArea = intersectedAreas[Math.floor(Math.random() * intersectedAreas.length)];
    }
  } else if (validCells.length > 0) {
    targetArea = validCells[Math.floor(Math.random() * validCells.length)];
  } else {
    targetArea = { left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom };
  }

  if (targetArea.width === undefined) targetArea.width = targetArea.right - targetArea.left;
  if (targetArea.height === undefined) targetArea.height = targetArea.bottom - targetArea.top;

  // --- SCALING AND WRAPPING LOGIC ---
  const tw = Math.max(10, targetArea.width);
  const th = Math.max(10, targetArea.height);
  
  const maxWidth = Math.max(50, tw * 0.95); 
  
  const requiredArea = adlibWidth * adlibHeight;
  const availableArea = tw * th;
  let scale = 1;

  if (requiredArea > availableArea) {
    scale = Math.max(0.35, Math.sqrt(availableArea / requiredArea));
  }

  // 6. GENERATE INNER SAFE ZONE
  const assumedWidth = Math.min(adlibWidth * scale, maxWidth);
  const wrapRatio = Math.max(1, (adlibWidth * scale) / maxWidth);
  const assumedHeight = (adlibHeight * scale) * wrapRatio;

  const padX = assumedWidth / 2;
  const padY = assumedHeight / 2;

  let innerLeft = targetArea.left + padX;
  let innerRight = targetArea.right - padX;
  let innerTop = targetArea.top + padY;
  let innerBottom = targetArea.bottom - padY;

  // Fallback if the target area is smaller than the ad-lib itself
  if (innerLeft > innerRight) {
    const mid = (targetArea.left + targetArea.right) / 2;
    innerLeft = innerRight = mid;
  }
  if (innerTop > innerBottom) {
    const mid = (targetArea.top + targetArea.bottom) / 2;
    innerTop = innerBottom = mid;
  }

  // Generate a random center point STRICTLY inside the Inner Safe Zone, totally on the fly
  const randomX = innerLeft + (Math.random() * (innerRight - innerLeft));
  const randomY = innerTop + (Math.random() * (innerBottom - innerTop));

  // 7. ROTATION PROFILING
  const canvasMidX = containerRect.width / 2;
  const canvasMidY = containerRect.height / 2;
  const rotMultiplier = (randomX - canvasMidX) / (canvasMidX || 1);
  const ySign = (randomY < canvasMidY) ? 1 : -1;

  let finalRotation = rotMultiplier * ySign * 18;
  const noise = (Math.random() * 10) - 5;
  finalRotation += noise;

  return {
    left: `${randomX}px`,
    top: `${randomY}px`,
    rot: finalRotation.toFixed(2),
    maxWidth: maxWidth.toFixed(1),
    scale: scale.toFixed(3)
  };
};