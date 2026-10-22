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

test('runs a bounded number of concurrent requests', async () => {
  const schedule = createRequestScheduler(0, 3);
  let activeRequests = 0;
  let maxActiveRequests = 0;

  await Promise.all(Array.from({ length: 8 }, () => schedule(async () => {
    activeRequests++;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    await new Promise(resolve => setTimeout(resolve, 10));
    activeRequests--;
  })));

  assert.equal(maxActiveRequests, 3);
});

test('allows an initial parallel burst before pacing queued requests', async () => {
  const schedule = createRequestScheduler(40, 3);
  const startedAt = [];

  await Promise.all(Array.from({ length: 4 }, () => schedule(async () => {
    startedAt.push(Date.now());
    await new Promise(resolve => setTimeout(resolve, 5));
  })));

  const firstThree = startedAt.slice(0, 3);
  assert.ok(Math.max(...firstThree) - Math.min(...firstThree) < 20);
  assert.ok(startedAt[3] - Math.min(...firstThree) >= 35);
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
