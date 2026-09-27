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

  // 5. Choose the available area whose center is closest to the canvas center.
  const candidateAreas = intersectedAreas.length > 0
    ? intersectedAreas
    : cBox ? [] : validCells.map(vc => ({ ...vc, zoneId: `Cell-${vc.quadIdx}` }));

  if (candidateAreas.length === 0) return null;

  const canvasMidX = containerRect.width / 2;
  const canvasMidY = containerRect.height / 2;
  const getCenterDistance = (area) => Math.hypot(
    (area.left + area.right) / 2 - canvasMidX,
    (area.top + area.bottom) / 2 - canvasMidY
  );
  const nearestDistance = Math.min(...candidateAreas.map(getCenterDistance));
  const centralAreas = candidateAreas.filter(area => getCenterDistance(area) <= nearestDistance + containerRect.height * 0.001);
  const getAreaSize = (area) => (area.right - area.left) * (area.bottom - area.top);
  const targetArea = (lastZoneId !== null
    ? centralAreas.find(area => area.zoneId !== lastZoneId)
    : null) || centralAreas.sort((first, second) =>
    getAreaSize(second) - getAreaSize(first)
  )[0];

  const areaWidth = targetArea.right - targetArea.left;
  const areaHeight = targetArea.bottom - targetArea.top;
  const availableWidth = areaWidth * 0.95;
  const availableHeight = areaHeight * 0.95;
  const centerX = (targetArea.left + targetArea.right) / 2;
  const centerY = (targetArea.top + targetArea.bottom) / 2;
  const rotMultiplier = (centerX - canvasMidX) / (canvasMidX || 1);
  const ySign = centerY < canvasMidY ? 1 : -1;
  const finalRotation = rotMultiplier * ySign * 18 + (Math.random() * 10) - 5;
  const rotationRadians = finalRotation * Math.PI / 180;
  const cosRotation = Math.abs(Math.cos(rotationRadians));
  const sinRotation = Math.abs(Math.sin(rotationRadians));
  const fitsArea = (width, height, scale) => {
    const rotatedWidth = (width * cosRotation + height * sinRotation) * scale;
    const rotatedHeight = (width * sinRotation + height * cosRotation) * scale;
    return rotatedWidth <= availableWidth && rotatedHeight <= availableHeight;
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

  // First preserve the settings size and natural one-line layout.
  setTemporaryMaxWidth('none');
  const naturalWidth = node.scrollWidth;
  const naturalHeight = node.scrollHeight;
  let measuredWidth = naturalWidth;
  let measuredHeight = naturalHeight;
  let maxWidth = 'none';

  // Wrap only when the natural layout cannot fit at the configured size.
  if (!fitsArea(naturalWidth, naturalHeight, 1)) {
    const wrapWidth = Math.min(availableWidth, naturalWidth * 0.9);
    maxWidth = `${wrapWidth}px`;
    setTemporaryMaxWidth(maxWidth);
    measuredWidth = node.scrollWidth;
    measuredHeight = node.scrollHeight;
  }

  // Reduce the rendered size by 0.1% per step only after wrapping still fails.
  let scale = 1;
  while (!fitsArea(measuredWidth, measuredHeight, scale) && scale > Number.EPSILON) {
    scale *= 0.999;
  }

  const restoreProperty = (property, value, priority) => {
    if (value) node.style.setProperty(property, value, priority);
    else node.style.removeProperty(property);
  };
  restoreProperty('--adlib-max-width', originalMaxWidth, originalMaxWidthPriority);
  restoreProperty('width', originalWidth, originalWidthPriority);
  restoreProperty('max-width', originalCssMaxWidth, originalCssMaxWidthPriority);

  const fittedWidth = measuredWidth * scale;
  const fittedHeight = measuredHeight * scale;
  return {
    left: `${centerX}px`,
    top: `${centerY}px`,
    rot: finalRotation.toFixed(2),
    maxWidth,
    scale: scale.toFixed(6),
    quadIdx: targetArea.quadIdx,
    zoneId: targetArea.zoneId,
    debugZone: {
      left: centerX - fittedWidth / 2,
      top: centerY - fittedHeight / 2,
      width: Math.max(1, fittedWidth),
      height: Math.max(1, fittedHeight)
    }
  };
};