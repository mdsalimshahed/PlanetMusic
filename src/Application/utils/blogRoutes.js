export const slugifyBlogLinkTitle = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

export const getBlogPostPath = (post) => {
  const slug = post.isCustom
    ? slugifyBlogLinkTitle(post.linkTitle || post.title || post.id)
    : slugifyBlogLinkTitle(post.id);
  const section = post.isCustom ? 'custom-blog' : 'dev-blog';
  return `/docs/${section}/post/${slug}`;
};

export const hasDuplicateBlogLinkTitle = (posts, linkTitle, excludedPostId) => {
  const slug = slugifyBlogLinkTitle(linkTitle);
  return Boolean(slug) && posts.some((post) => (
    post.id !== excludedPostId
    && slugifyBlogLinkTitle(post.linkTitle || post.title || post.id) === slug
  ));
};
