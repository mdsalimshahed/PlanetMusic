import assert from 'node:assert/strict';
import test from 'node:test';
import { updateAdlibStateAtTime } from '../src/Studio/utils/adlibTimeline.js';

const createAdlib = (start, end, state = 'hidden') => {
  const classes = new Set([`adlib-${state}`]);
  return {
    start,
    end,
    state,
    node: {
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name)
      }
    },
    classes
  };
};

test('live mode keeps an ad-lib active after its end time', () => {
  const item = createAdlib(4, 6);

  updateAdlibStateAtTime(item, 4, { persistActive: true });
  assert.equal(item.state, 'active');
  updateAdlibStateAtTime(item, 9, { persistActive: true });

  assert.equal(item.state, 'active');
  assert.equal(item.classes.has('adlib-active'), true);
  assert.equal(item.classes.has('adlib-visible'), false);
});

test('live mode still hides ad-libs until their start time', () => {
  const item = createAdlib(4, 6);

  updateAdlibStateAtTime(item, 3, { persistActive: true });

  assert.equal(item.state, 'hidden');
  assert.equal(item.classes.has('adlib-hidden'), true);
});

test('other lyric modes keep the existing post-ad-lib visible state', () => {
  const item = createAdlib(4, 6);

  updateAdlibStateAtTime(item, 4);
  updateAdlibStateAtTime(item, 7);

  assert.equal(item.state, 'visible');
  assert.equal(item.classes.has('adlib-visible'), true);
  assert.equal(item.classes.has('adlib-active'), false);
});
