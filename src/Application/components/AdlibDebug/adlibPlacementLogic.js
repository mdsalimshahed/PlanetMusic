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

export const getAdlibCenterBounds = (area, width, height, containerRect) => {
  const safeRadius = Math.hypot(width, height) / 2;
  const padX = containerRect.width * 0.01;
  const padY = containerRect.height * 0.01;
  let left = area.left + safeRadius + padX;
  let right = area.right - safeRadius - padX;
  let top = area.top + safeRadius + padY;
  let bottom = area.bottom - safeRadius - padY;
  if (left > right) left = right = (area.left + area.right) / 2;
  if (top > bottom) top = bottom = (area.top + area.bottom) / 2;
  return { left, right, top, bottom };
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
  occupiedPlacements = []
) => {
  // 1. The Goldilocks Margins
  const isMoreThanThree = masterNamesArray && masterNamesArray.length > 3;
  const EDGE_PAD_X = containerRect.width * ((masterNamesArray && masterNamesArray.length > 2) ? 0.04 : 0.08);
  const EDGE_PAD_Y = containerRect.height * (isMoreThanThree ? 0.04 : 0.08);
  const LYRIC_PAD = containerRect.height * 0.0625;
  const SINGER_PAD = containerRect.height * 0.05;
  const MAX_DIST = isMoreThanThree ? Infinity : containerRect.height * 0.4;

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
    const fullBottom = sBox ? Math.min(safeBottom, sBox.top - SINGER_PAD) : safeBottom;
    if (fullBottom > safeTop) {
      baseZones.push({ type: 'Full', left: safeLeft, right: safeRight, top: safeTop, bottom: fullBottom });
    }
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
    validCells.push({ quadIdx: 0, left: safeLeft, right: safeRight, top: safeTop, bottom: safeBottom });
  } else {
    for (let i = 0; i < cols * 2; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const artist = getArtistForCell(i);
      
      if (activeSingersList.includes(artist)) {
        // Let outer cells use the safe inset while keeping their labels on-canvas.
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
          zoneId: `${bz.type}-${vc.quadIdx}`,
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

  // 5. Prefer an unoccupied quadrant, then an unoccupied safe zone.
  const candidateAreas = intersectedAreas.length > 0
    ? intersectedAreas
    : cBox ? [] : validCells.map(vc => ({ ...vc, zoneId: `Cell-${vc.quadIdx}` }));

  const unoccupiedQuadrantAreas = candidateAreas.filter(area =>
    !occupiedPlacements.some(placement => placement.quadIdx === area.quadIdx)
  );
  const availableAreas = unoccupiedQuadrantAreas.length > 0
    ? unoccupiedQuadrantAreas
    : candidateAreas.filter(area => !occupiedPlacements.some(placement => placement.zoneId === area.zoneId));
  if (availableAreas.length === 0) return null;

  const canvasMidX = containerRect.width / 2;
  const canvasMidY = containerRect.height / 2;
  const getCenterDistance = (area) => Math.hypot(
    (area.left + area.right) / 2 - canvasMidX,
    (area.top + area.bottom) / 2 - canvasMidY
  );
  const getAreaSize = (area) => (area.right - area.left) * (area.bottom - area.top);
  const targetArea = [...availableAreas].sort((first, second) =>
    getAreaSize(second) - getAreaSize(first) || getCenterDistance(first) - getCenterDistance(second)
  )[0];

  const areaWidth = targetArea.right - targetArea.left;
  const areaHeight = targetArea.bottom - targetArea.top;
  const availableWidth = areaWidth * 0.95;
  const availableHeight = areaHeight * 0.95;
  const areaCenterX = (targetArea.left + targetArea.right) / 2;
  const areaCenterY = (targetArea.top + targetArea.bottom) / 2;
  const rotMultiplier = (areaCenterX - canvasMidX) / (canvasMidX || 1);
  const ySign = areaCenterY < canvasMidY ? 1 : -1;
  const finalRotation = rotMultiplier * ySign * 18 + (Math.random() * 10) - 5;
  const rotationRadians = finalRotation * Math.PI / 180;
  const cosRotation = Math.abs(Math.cos(rotationRadians));
  const sinRotation = Math.abs(Math.sin(rotationRadians));
  const getRotatedBounds = (width, height, scale) => ({
    width: (width * cosRotation + height * sinRotation) * scale,
    height: (width * sinRotation + height * cosRotation) * scale
  });
  const collidesWith = (box, centerX, centerY, width, height) => box &&
    centerX + width / 2 > box.left &&
    centerX - width / 2 < box.right &&
    centerY + height / 2 > box.top &&
    centerY - height / 2 < box.bottom;
  const fitsArea = (width, height, scale) => {
    const bounds = getRotatedBounds(width, height, scale);
    return bounds.width <= availableWidth && bounds.height <= availableHeight;
  };

  const originalMaxWidth = node.style.getPropertyValue('--adlib-max-width');
  const originalMaxWidthPriority = node.style.getPropertyPriority('--adlib-max-width');
  const originalWidth = node.style.getPropertyValue('width');
  const originalWidthPriority = node.style.getPropertyPriority('width');
  const originalCssMaxWidth = node.style.getPropertyValue('max-width');
  const originalCssMaxWidthPriority = node.style.getPropertyPriority('max-width');
  const setTemporaryMaxWidth = (value) => {
    node.style.setProperty('--adlib-max-width', value);
    node.style.setProperty('max-width', value, 'important');
  };
  node.style.setProperty('width', 'max-content', 'important');

  // Preserve the configured size and wrap only if the line cannot fit naturally.
  setTemporaryMaxWidth('none');
  const naturalWidth = node.scrollWidth;
  const naturalHeight = node.scrollHeight;
  let measuredWidth = naturalWidth;
  let measuredHeight = naturalHeight;
  let maxWidth = 'none';

  // Wrapping gets the first chance to fit the complete ad-lib inside its box.
  if (!fitsArea(naturalWidth, naturalHeight, 1)) {
    const wrapWidth = availableWidth;
    maxWidth = `${wrapWidth}px`;
    setTemporaryMaxWidth(maxWidth);
    measuredWidth = node.scrollWidth;
    measuredHeight = node.scrollHeight;
  }

  // Scaling is the last resort, after the full line has had a chance to wrap.
  const restoreProperty = (property, value, priority) => {
    if (value) node.style.setProperty(property, value, priority);
    else node.style.removeProperty(property);
  };
  const restoreMeasurementStyles = () => {
    restoreProperty('--adlib-max-width', originalMaxWidth, originalMaxWidthPriority);
    restoreProperty('width', originalWidth, originalWidthPriority);
    restoreProperty('max-width', originalCssMaxWidth, originalCssMaxWidthPriority);
  };
  const fitsWithoutCollision = (scale) => {
    const bounds = getRotatedBounds(measuredWidth, measuredHeight, scale);
    return bounds.width <= availableWidth &&
      bounds.height <= availableHeight &&
      !collidesWith(cBox, areaCenterX, areaCenterY, bounds.width, bounds.height) &&
      !collidesWith(sBox, areaCenterX, areaCenterY, bounds.width, bounds.height);
  };

  let scale = 1;
  while (!fitsWithoutCollision(scale) && scale > 0.01) {
    scale = Math.round((scale - 0.01) * 100) / 100;
  }
  if (!fitsWithoutCollision(scale)) {
    restoreMeasurementStyles();
    return null;
  }
  restoreMeasurementStyles();

  const centerBounds = getAdlibCenterBounds(
    targetArea,
    measuredWidth * scale,
    measuredHeight * scale,
    containerRect
  );
  const centerX = centerBounds.left + Math.random() * (centerBounds.right - centerBounds.left);
  const centerY = centerBounds.top + Math.random() * (centerBounds.bottom - centerBounds.top);

  const finalWidth = measuredWidth * scale;
  const finalHeight = measuredHeight * scale;
  const finalRotatedWidth = finalWidth * cosRotation + finalHeight * sinRotation;
  const finalRotatedHeight = finalWidth * sinRotation + finalHeight * cosRotation;
  return {
    left: `${centerX}px`,
    top: `${centerY}px`,
    rot: finalRotation.toFixed(2),
    maxWidth,
    scale: scale.toFixed(2),
    quadIdx: targetArea.quadIdx,
    zoneId: targetArea.zoneId,
    debugZone: {
      left: centerX - finalRotatedWidth / 2,
      top: centerY - finalRotatedHeight / 2,
      width: Math.max(1, finalRotatedWidth),
      height: Math.max(1, finalRotatedHeight)
    }
  };
};