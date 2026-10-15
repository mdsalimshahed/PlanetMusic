import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cacheArlVerification,
  getCachedArlVerification
} from '../src/Application/services/deezerArlVerificationCache.js';

test('caches failed ARL checks so the same token does not need to be checked again', () => {
  const invalidArl = `invalid-${Date.now()}`;

  assert.equal(getCachedArlVerification(invalidArl), null);
  cacheArlVerification(invalidArl, 'error');
  assert.equal(getCachedArlVerification(invalidArl), 'error');
});

test('keeps verification results isolated for different ARL values', () => {
  const suffix = Date.now();
  const invalidArl = `invalid-${suffix}`;
  const validArl = `valid-${suffix}`;

  cacheArlVerification(invalidArl, 'error');
  cacheArlVerification(validArl, 'success');

  assert.equal(getCachedArlVerification(invalidArl), 'error');
  assert.equal(getCachedArlVerification(validArl), 'success');
});

test('does not cache empty values or incomplete verification outcomes', () => {
  const arl = `pending-${Date.now()}`;

  cacheArlVerification('', 'error');
  cacheArlVerification(arl, null);

  assert.equal(getCachedArlVerification(''), null);
  assert.equal(getCachedArlVerification(arl), null);
});
