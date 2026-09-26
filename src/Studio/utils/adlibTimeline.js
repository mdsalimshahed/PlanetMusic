const END_BOUNDARY_EPSILON = 0.001;

export const buildAdlibTimeline = (items) => {
  const events = [];

  items.forEach(item => {
    if (isNaN(item.start)) return;
    events.push({ time: item.start, item });
    if (!isNaN(item.end)) {
      events.push({ time: item.end + END_BOUNDARY_EPSILON, item });
    }
  });

  return events.sort((first, second) => first.time - second.time);
};

export const findAdlibBoundaryCursor = (events, time) => {
  let low = 0;
  let high = events.length;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (events[middle].time <= time) low = middle + 1;
    else high = middle;
  }

  return low;
};

export const updateAdlibStateAtTime = (item, time) => {
  let targetState = 'hidden';
  if (!isNaN(item.start)) {
    if (time >= item.start && time <= item.end) targetState = 'active';
    else if (time >= item.start) targetState = 'visible';
  }

  if (item.state === targetState) return;

  const classList = item.node.classList;
  if (targetState === 'active') {
    classList.add('adlib-active');
    classList.remove('adlib-hidden', 'adlib-visible');
  } else if (targetState === 'visible') {
    classList.add('adlib-visible');
    classList.remove('adlib-hidden', 'adlib-active');
  } else {
    classList.add('adlib-hidden');
    classList.remove('adlib-active', 'adlib-visible');
  }
  item.state = targetState;
};