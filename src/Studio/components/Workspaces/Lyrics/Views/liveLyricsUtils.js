export const buildTimedLineData = (syncData, nextStarts) => (syncData || [])
  .map((line, index) => ({
    index,
    start: parseFloat(line?.start),
    end: parseFloat(line?.end),
    nextStart: parseFloat(nextStarts[index])
  }))
  .filter(line => !Number.isNaN(line.start))
  .sort((first, second) => first.start - second.start);

export const findCurrentLineIndex = (timedLines, time) => {
  let low = 0;
  let high = timedLines.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (timedLines[middle].start <= time) low = middle + 1;
    else high = middle;
  }

  return low > 0 ? timedLines[low - 1].index : -1;
};

export const findActiveLineIndex = (timedLines, time) => {
  let low = 0;
  let high = timedLines.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (timedLines[middle].start <= time) low = middle + 1;
    else high = middle;
  }

  for (let index = low - 1; index >= 0; index--) {
    const line = timedLines[index];
    const isBeforeEnd = !Number.isFinite(line.end) || time <= line.end;
    const isBeforeNext = !Number.isFinite(line.nextStart) || time < line.nextStart;
    if (isBeforeEnd && isBeforeNext) return line.index;
  }

  return -1;
};

export const getCenteredScrollTop = ({
  scrollTop,
  viewportTop,
  viewportHeight,
  activeTop,
  activeHeight,
  maxScrollTop
}) => {
  const centeredScrollTop = scrollTop + activeTop + activeHeight / 2 -
    (viewportTop + viewportHeight / 2);
  return Math.max(0, Math.min(centeredScrollTop, maxScrollTop));
};

export const getCombinedVerticalBounds = rects => {
  const visibleRects = rects.filter(rect =>
    Number.isFinite(rect?.top) &&
    Number.isFinite(rect?.bottom) &&
    rect.bottom > rect.top
  );
  if (visibleRects.length === 0) return null;

  const top = Math.min(...visibleRects.map(rect => rect.top));
  const bottom = Math.max(...visibleRects.map(rect => rect.bottom));
  return { top, bottom, height: bottom - top };
};
