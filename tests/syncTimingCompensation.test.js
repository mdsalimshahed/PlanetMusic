import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySyncTimingCompensation,
  getSyncTimingCompensationKey
} from '../src/Studio/utils/syncTimingCompensation.js';

test('compensates captured starts and ends while preserving existing timings', () => {
  const data = [
    { start: 2, end: 4, adlibs: [{ start: 2.5, end: 3 }] },
    { start: 4.1, end: 6, adlibs: [] },
    { start: 7, end: 8, adlibs: [] }
  ];
  const pendingFields = new Set([
    getSyncTimingCompensationKey(0, null, 'start'),
    getSyncTimingCompensationKey(0, null, 'end'),
    getSyncTimingCompensationKey(0, 0, 'start'),
    getSyncTimingCompensationKey(0, 0, 'end'),
    getSyncTimingCompensationKey(1, null, 'start'),
    getSyncTimingCompensationKey(1, null, 'end')
  ]);

  const compensated = applySyncTimingCompensation(data, 200, pendingFields);

  assert.deepEqual(compensated, [
    { start: 1.8, end: 3.8, adlibs: [{ start: 2.3, end: 2.8 }] },
    { start: 3.9, end: 5.8, adlibs: [] },
    { start: 7, end: 8, adlibs: [] }
  ]);
  assert.ok(compensated[0].end <= compensated[1].start);
  assert.deepEqual(data[0], { start: 2, end: 4, adlibs: [{ start: 2.5, end: 3 }] });
});

test('does not shift uncaptured timestamps or move adjusted times below zero', () => {
  const data = [{ start: 0.1, end: 1, adlibs: [] }];
  const pendingFields = new Set([
    getSyncTimingCompensationKey(0, null, 'start')
  ]);

  assert.deepEqual(applySyncTimingCompensation(data, 200, pendingFields), [
    { start: 0, end: 1, adlibs: [] }
  ]);
});
