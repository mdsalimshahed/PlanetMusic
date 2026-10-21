import assert from 'node:assert/strict';
import test from 'node:test';
import { getDetectedForeignLanguageNames } from '../src/Studio/utils/automatedTranslationUtils.js';

test('returns unique, readable names for detected foreign languages', () => {
  assert.deepEqual(
    getDetectedForeignLanguageNames([
      { lang: 'ja' },
      { lang: 'zh-CN' },
      { lang: 'ja' },
      { lang: 'en' },
      { lang: 'auto' }
    ]),
    ['Japanese', 'Chinese']
  );
});
