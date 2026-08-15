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
  node,
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

  targetArea.width = targetArea.width || (targetArea.right - targetArea.left);
  targetArea.height = targetArea.height || (targetArea.bottom - targetArea.top);

  // --- 6. NATIVE BROWSER SIZING & SCALING ---
  const tw = Math.max(20, targetArea.width);
  const th = Math.max(20, targetArea.height);
  
  // We cap the CSS maximum width slightly below the quadrant width to ensure natural wrapping
  const maxWidth = tw * 0.95; 

  // Temporarily force the browser to apply the maxWidth restriction to our node
  const originalMaxWidth = node.style.getPropertyValue('--adlib-max-width');
  node.style.setProperty('--adlib-max-width', `${maxWidth}px`);
  
  // Read the exact physical dimensions required by the text *after* natural browser wrapping
  const actualWidth = node.scrollWidth;
  const actualHeight = node.scrollHeight;

  // Reset immediately to avoid side effects before the tracker officially applies the final CSS state
  if (originalMaxWidth) node.style.setProperty('--adlib-max-width', originalMaxWidth);
  else node.style.removeProperty('--adlib-max-width');

  // If an unbreakable word bursts the maxWidth, or the wrapped block is too tall, scale it down mathematically.
  let scale = 1;
  if (actualWidth > maxWidth) {
    scale = maxWidth / actualWidth;
  }
  if (actualHeight * scale > th * 0.95) {
    scale = (th * 0.95) / actualHeight;
  }
  
  // Clamp scale so text doesn't disappear entirely
  scale = Math.max(0.2, scale);

  const visualWidth = actualWidth * scale;
  const visualHeight = actualHeight * scale;

  // 7. GENERATE INNER SAFE ZONE
  // Adding 10% extra padding to the visual box ensures the corners don't clip out when rotated
  const padX = (visualWidth / 2) * 1.1; 
  const padY = (visualHeight / 2) * 1.1;

  let innerLeft = targetArea.left + padX;
  let innerRight = targetArea.right - padX;
  let innerTop = targetArea.top + padY;
  let innerBottom = targetArea.bottom - padY;

  // Fallback if the target area is smaller than the ad-lib itself (forces center alignment)
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

  // 8. ROTATION PROFILING
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