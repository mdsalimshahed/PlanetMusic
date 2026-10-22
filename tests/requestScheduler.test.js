import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequestScheduler } from '../src/Studio/hooks/translation/utils/requestScheduler.js';

test('serializes requests and observes the configured minimum interval', async () => {
  const schedule = createRequestScheduler(25);
  const startedAt = [];
  let activeRequests = 0;
  let maxActiveRequests = 0;

  await Promise.all(Array.from({ length: 4 }, () => schedule(async () => {
    startedAt.push(Date.now());
    activeRequests++;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise(resolve => setTimeout(resolve, 5));
    activeRequests--;
  })));

  assert.equal(maxActiveRequests, 1);
  for (let index = 1; index < startedAt.length; index++) {
    assert.ok(startedAt[index] - startedAt[index - 1] >= 20);
  }
});

test('continues scheduling after a failed request', async () => {
  const schedule = createRequestScheduler(0);

  await assert.rejects(schedule(async () => {
    throw new Error('request failed');
  }), /request failed/);
  assert.equal(await schedule(async () => 'next request'), 'next request');
});

test('pauses queued requests after an upstream rate limit', async () => {
  const schedule = createRequestScheduler(0);
  const startedAt = [];

  await schedule(async () => {
    schedule.pause(40);
    startedAt.push(Date.now());
  });
  await schedule(async () => startedAt.push(Date.now()));

  assert.ok(startedAt[1] - startedAt[0] >= 35);
});
