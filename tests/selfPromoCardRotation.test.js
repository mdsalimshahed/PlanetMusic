import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activeCreatives,
  chooseCreative
} from '../src/Application/components/Promos/selfPromoCardRotation.js';

test('keeps each visible slot assigned to its selected promo product', () => {
  activeCreatives.clear();

  const firstCard = chooseCreative(0, 'first-card');
  const secondCard = chooseCreative(1, 'second-card');

  assert.equal(firstCard.promoIndex, 0);
  assert.equal(secondCard.promoIndex, 1);

  activeCreatives.set('first-card', firstCard);
  activeCreatives.set('second-card', secondCard);
  assert.equal(chooseCreative(0, 'first-card').promoIndex, 0);
  assert.equal(chooseCreative(1, 'second-card').promoIndex, 1);

  activeCreatives.clear();
});
