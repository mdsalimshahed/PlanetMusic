/* --- src/Application/components/AdlibDebug/adlibPlacementLogic.js --- */

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

export const getCollisionSafeZones = (width, height, lyricsBox, singerBox) => {
  const edgePadX = Math.max(8, Math.min(28, width * 0.05));
  const edgePadY = Math.max(8, Math.min(28, height * 0.05));
  let zones = [{
    left: edgePadX,
    right: width - edgePadX,
    top: edgePadY,
    bottom: height - edgePadY
  }];
  const obstacles = [
    lyricsBox && { box: lyricsBox, padding: 25 },
    singerBox && { box: singerBox, padding: 20 }
  ].filter(Boolean);

  obstacles.forEach(({ box, padding }) => {
    const obstacle = {
      left: box.left - padding,
      right: box.right + padding,
      top: box.top - padding,
      bottom: box.bottom + padding
    };
    zones = zones.flatMap(zone => {
      const left = Math.max(zone.left, obstacle.left);
      const right = Math.min(zone.right, obstacle.right);
      const top = Math.max(zone.top, obstacle.top);
      const bottom = Math.min(zone.bottom, obstacle.bottom);
      if (left >= right || top >= bottom) return [zone];

      return [
        { left: zone.left, right: zone.right, top: zone.top, bottom: top },
        { left: zone.left, right: zone.right, top: bottom, bottom: zone.bottom },
        { left: zone.left, right: left, top, bottom },
        { left: right, right: zone.right, top, bottom }
      ].filter(piece => piece.left < piece.right && piece.top < piece.bottom);
    });
  });

  return zones.map((zone, index) => ({
    ...zone,
    zoneId: `Safe-${index}`,
    width: zone.right - zone.left,
    height: zone.bottom - zone.top
  }));
};

export const generateSafeAdlibPosition = (
  node,
  containerRect,
  cBox,
  sBox,
  isMulti,
  cols,
  activeSingersList,
  masterNamesArray,
  lastZoneId = null
) => {
  const edgePadX = Math.max(8, Math.min(28, containerRect.width * 0.05));
  const edgePadY = Math.max(8, Math.min(28, containerRect.height * 0.05));

  const safeLeft = edgePadX;
  const safeRight = containerRect.width - edgePadX;
  const safeTop = edgePadY;
  const safeBottom = containerRect.height - edgePadY;

  const baseZones = getCollisionSafeZones(containerRect.width, containerRect.height, cBox, sBox);

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

  if (!isMulti) {
    validCells.push({ quadIdx: 0, left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
  } else {
    for (let i = 0; i < cols * 2; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const artist = getArtistForCell(i);
      
      const normalizedArtist = String(artist || '').trim().toLocaleLowerCase();
      const matchesActiveSinger = activeSingersList.some(
        singer => String(singer || '').trim().toLocaleLowerCase() === normalizedArtist
      );

      if (matchesActiveSinger) {
        // Expand the outer cells to span across the negative padding space!
        const cellLeft = c === 0 ? safeLeft : c * colW;
        const cellRight = c === cols - 1 ? safeRight : (c + 1) * colW;
        const cellTop = r === 0 ? safeTop : r * rowH;
        const cellBottom = r === 1 ? safeBottom : (r + 1) * rowH;
        validCells.push({
          quadIdx: i,
          left: cellLeft,
          right: cellRight,
          top: cellTop,
          bottom: cellBottom
        });
      }
    }

    // Missing or stale singer metadata must not send an ad-lib across the full canvas.
    if (validCells.length === 0 && cols > 0) {
      const cellRight = cols === 1 ? safeRight : colW;
      validCells.push({
        quadIdx: 0,
        left: safeLeft,
        right: cellRight,
        top: safeTop,
        bottom: rowH
      });
    }
  }

  // 4. Intersect collision-free areas with the active artists' cells.
  const intersectedAreas = [];
  baseZones.forEach(bz => {
    validCells.forEach(vc => {
      const ixLeft = Math.max(bz.left, vc.left);
      const ixRight = Math.min(bz.right, vc.right);
      const ixTop = Math.max(bz.top, vc.top);
      const ixBottom = Math.min(bz.bottom, vc.bottom);
      
      if (ixLeft < ixRight && ixTop < ixBottom) {
        intersectedAreas.push({
          zoneId: `${bz.zoneId}-${vc.quadIdx}`,
          quadIdx: vc.quadIdx,
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

  // Do not fall back to a cell that overlaps a lyric or singer obstacle.
  if (intersectedAreas.length === 0) return null;

  const candidateAreas = intersectedAreas;

  // Preserve the renderer's width while measuring each candidate zone.
  const originalMaxWidth = node.style.getPropertyValue('--adlib-max-width');
  const originalWidth = node.style.getPropertyValue('width');

  const measuredCandidates = [];

  // 6. Try wrapping at the configured font size before considering any shrink.
  candidateAreas.forEach(area => {
    area.width = area.width || (area.right - area.left);
    area.height = area.height || (area.bottom - area.top);
    const tw = Math.max(20, area.width);
    const th = Math.max(20, area.height);
    
    // Normal wrapping limits for standard display
    const currentMaxWidth = tw * 0.96; 
    node.style.setProperty('--adlib-max-width', `${currentMaxWidth}px`);
    node.style.setProperty('width', `${currentMaxWidth}px`, 'important');
    node.style.setProperty('max-width', `${currentMaxWidth}px`, 'important');
    
    // Measure the full-size text after the browser wraps it to this area.
    const actualWidth = node.scrollWidth;
    const actualHeight = node.scrollHeight;
    measuredCandidates.push({
      area,
      actualWidth,
      actualHeight,
      maxWidth: currentMaxWidth,
      fitsAtConfiguredSize: actualWidth <= tw && actualHeight <= th
    });
  });

  // Reset node to original state
  if (originalMaxWidth) node.style.setProperty('--adlib-max-width', originalMaxWidth);
  else node.style.removeProperty('--adlib-max-width');
  if (originalWidth) node.style.setProperty('width', originalWidth);
  else node.style.removeProperty('width');
  node.style.removeProperty('max-width');

  const fullSizeCandidates = measuredCandidates.filter(candidate => candidate.fitsAtConfiguredSize);
  const artistCount = masterNamesArray ? masterNamesArray.length : 1;
  let bestCandidates;
  if (artistCount >= 4) {
    const largestArea = Math.max(...measuredCandidates.map(candidate => candidate.area.width * candidate.area.height));
    bestCandidates = measuredCandidates
      .filter(candidate => Math.abs(candidate.area.width * candidate.area.height - largestArea) < 0.5)
      .map(candidate => ({ ...candidate, scale: 1 }));
  } else if (fullSizeCandidates.length > 0) {
    bestCandidates = fullSizeCandidates.map(candidate => ({ ...candidate, scale: 1 }));
  } else {
    // Keep the configured font size and choose the area with the best wrapped fit.
    const candidatesToRank = measuredCandidates;
    let bestFitScore = -Infinity;
    bestCandidates = [];
    candidatesToRank.forEach(candidate => {
      const fitScore = Math.min(
        candidate.area.width / candidate.actualWidth,
        candidate.area.height / candidate.actualHeight
      );
      const result = { ...candidate, scale: 1 };
      if (fitScore > bestFitScore) {
        bestFitScore = fitScore;
        bestCandidates = [result];
      } else if (Math.abs(fitScore - bestFitScore) < 0.001) {
        bestCandidates.push(result);
      }
    });
  }

  // 7. SELECT THE OPTIMAL QUADRANT (STRICT NO-CONSECUTIVE REPEAT RULE)
  let chosen;
  let validCandidates = bestCandidates;

  // STRICT RULE: Divert consecutive ad-libs away from the exact same physical space if 4 or fewer artists
  if (lastZoneId !== null && bestCandidates.length > 1 && artistCount <= 4) {
    const filtered = bestCandidates.filter(c => c.area.zoneId !== lastZoneId);
    if (filtered.length > 0) {
      validCandidates = filtered;
    }
  }

  const canvasMidY = containerRect.height / 2;
  const topZones = validCandidates.filter(c => c.area.top < canvasMidY);
  const bottomZones = validCandidates.filter(c => c.area.top >= canvasMidY);

  // If multiple valid quadrants offer the identical best scale, alternate randomly to keep it dynamic
  if (topZones.length > 0 && bottomZones.length > 0) {
    if (Math.random() > 0.5) {
      chosen = topZones[Math.floor(Math.random() * topZones.length)];
    } else {
      chosen = bottomZones[Math.floor(Math.random() * bottomZones.length)];
    }
  } else {
    chosen = validCandidates[Math.floor(Math.random() * validCandidates.length)];
  }

  const targetArea = chosen.area;
  const maxWidth = chosen.maxWidth;
  const visualWidth = chosen.actualWidth;
  const visualHeight = chosen.actualHeight;

  // Reserve space for the largest possible angle without shrinking the text for it.
  const maxRotationRadians = 10 * Math.PI / 180;
  const maxAngleWidth = visualWidth * Math.cos(maxRotationRadians) + visualHeight * Math.sin(maxRotationRadians);
  const maxAngleHeight = visualWidth * Math.sin(maxRotationRadians) + visualHeight * Math.cos(maxRotationRadians);
  const padX = maxAngleWidth / 2 + 5;
  const padY = maxAngleHeight / 2 + 5;

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
  const canvasMidX = containerRect.width / 2;
  const rotMultiplier = (randomX - canvasMidX) / (canvasMidX || 1);
  const ySign = (randomY < canvasMidY) ? 1 : -1;
  let finalRotation = rotMultiplier * ySign * 8;
  const noise = (Math.random() * 4) - 2;
  finalRotation += noise;
  const rotationRadians = finalRotation * Math.PI / 180;
  const rotatedWidth = visualWidth * Math.abs(Math.cos(rotationRadians)) + visualHeight * Math.abs(Math.sin(rotationRadians));
  const rotatedHeight = visualWidth * Math.abs(Math.sin(rotationRadians)) + visualHeight * Math.abs(Math.cos(rotationRadians));
  let scale = 1;
  for (let step = 1; step <= 200; step++) {
    const candidateScale = 1 - step * 0.005;
    if (rotatedWidth * candidateScale <= targetArea.width && rotatedHeight * candidateScale <= targetArea.height) {
      scale = candidateScale;
      break;
    }
  }

  return {
    left: `${randomX}px`,
    top: `${randomY}px`,
    rot: finalRotation.toFixed(2),
    maxWidth: maxWidth.toFixed(1),
    scale: scale.toFixed(3),
    quadIdx: targetArea.quadIdx,
    zoneId: targetArea.zoneId,
    debugZone: {
      left: innerLeft,
      top: innerTop,
      width: Math.max(1, innerRight - innerLeft),
      height: Math.max(1, innerBottom - innerTop)
    }
  };
};