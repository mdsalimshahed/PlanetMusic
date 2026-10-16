import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBlogPostPath,
  hasDuplicateBlogLinkTitle,
  slugifyBlogLinkTitle
} from '../src/Application/utils/blogRoutes.js';

test('creates stable slugs from custom blog link titles', () => {
  assert.equal(slugifyBlogLinkTitle('  My First Blog!  '), 'my-first-blog');
  assert.equal(slugifyBlogLinkTitle('Café Notes'), 'cafe-notes');
});

test('uses separate developer and custom article URL namespaces', () => {
  assert.equal(
    getBlogPostPath({ id: 'syncing-guide' }),
    '/docs/dev-blog/post/syncing-guide'
  );
  assert.equal(
    getBlogPostPath({ id: 'internal-id', isCustom: true, linkTitle: 'My Guide' }),
    '/docs/custom-blog/post/my-guide'
  );
});

test('rejects duplicate custom link titles after slug normalization but permits the edited post', () => {
  const posts = [
    { id: 'first', linkTitle: 'my-guide' },
    { id: 'second', linkTitle: 'another-guide' }
  ];

  assert.equal(hasDuplicateBlogLinkTitle(posts, 'My Guide!'), true);
  assert.equal(hasDuplicateBlogLinkTitle(posts, 'My Updated Guide', 'first'), false);
  assert.equal(hasDuplicateBlogLinkTitle(posts, '', 'first'), false);
});
