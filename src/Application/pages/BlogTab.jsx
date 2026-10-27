/* --- src/pages/BlogTab.jsx --- */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import './BlogTab.css';
import SelfPromoCard from '../components/Promos/SelfPromoCard.jsx';
import InFeedSponsor from '../components/Promos/InFeedSponsor.jsx';
import ConfirmModal from '../components/Modals/ConfirmModal.jsx';
import { renderMarkdown } from '../utils/markdownUtils.jsx';
import {
  getBlogPostPath,
  hasDuplicateBlogLinkTitle,
  slugifyBlogLinkTitle
} from '../utils/blogRoutes.js';
import { getProceduralGradient } from '../../utils/proceduralColors.js';
import BlogPostArtwork from './BlogPostArtwork.jsx';

const Icon = ({ name, size = 18 }) => {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { display: 'block', flexShrink: 0 }
  };

  switch (name) {
    case 'plus':
      return (
        <svg {...props}>
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      );
    case 'download':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      );
    case 'upload':
      return (
        <svg {...props}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
      );
    case 'download-single':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <polyline points="9 15 12 18 15 15"></polyline>
        </svg>
      );
    case 'close':
      return (
        <svg {...props}>
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      );
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      );
    case 'arrow-left':
      return (
        <svg {...props}>
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      );
    default:
      return null;
  }
};

const BlogAuthorAvatar = ({ post, className }) => {
  const placeholder = '/avatar-placeholder.svg';
  const src = post.isCustom
    ? post.authorAvatar?.trim() || placeholder
    : '/favicon.svg';

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={(event) => {
        if (event.currentTarget.getAttribute('src') !== placeholder) {
          event.currentTarget.src = placeholder;
        }
      }}
    />
  );
};

const BlogTab = ({ adsEnabled, initialPosts = [], initialChangelogMonths = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const subPath = params['*'] || '';
  const pathTokens = subPath.split('/').filter(Boolean);

  const isCustomRoute = ['custom-blog', 'custom', 'edit', 'write'].includes(pathTokens[0]);
  const isLegacyPostRoute = pathTokens[0] === 'post';
  const isPostRoute = pathTokens[0] === 'post' || pathTokens[1] === 'post';
  const isEditRoute = pathTokens[0] === 'edit' || pathTokens[1] === 'edit';
  const isWriteRoute = pathTokens[0] === 'write' || pathTokens[1] === 'write';
  const viewMode = isPostRoute ? 'reader' : (isWriteRoute || isEditRoute) ? 'studio' : 'grid';

  const isChangelog = pathTokens[0] === 'changelog';
  const changelogMonthSlug = pathTokens[1];
  const blogSection = isCustomRoute ? 'custom' : 'dev';
  const isKnownDocsRoute = pathTokens.length === 0
    || (pathTokens[0] === 'dev-blogs' && pathTokens.length === 1)
    || (pathTokens[0] === 'changelog' && pathTokens.length <= 2)
    || (pathTokens[0] === 'post' && pathTokens.length === 2)
    || (pathTokens[0] === 'dev-blog' && pathTokens[1] === 'post' && pathTokens.length === 3)
    || (
      ['custom-blog', 'custom'].includes(pathTokens[0])
      && (
        pathTokens.length === 1
        || (pathTokens[1] === 'post' && pathTokens.length === 3)
        || (pathTokens[1] === 'edit' && pathTokens.length === 3)
        || (pathTokens[1] === 'write' && pathTokens.length === 2)
      )
    )
    || (pathTokens[0] === 'edit' && pathTokens.length <= 2)
    || (pathTokens[0] === 'write' && pathTokens.length === 1);
  const activeArticleSlug = isPostRoute || isEditRoute
    ? pathTokens[0] === 'post' || pathTokens[0] === 'edit' ? pathTokens[1] : pathTokens[2]
    : null;
  const [changelogMonths, setChangelogMonths] = useState(initialChangelogMonths);
  const [changelogLoadError, setChangelogLoadError] = useState('');
  const requestedChangelogMonthIndex = changelogMonthSlug
    ? changelogMonths.findIndex(month => month.label.toLowerCase().replace(' ', '-') === changelogMonthSlug)
    : 0;
  const selectedChangelogMonthIndex = requestedChangelogMonthIndex < 0
    ? 0
    : requestedChangelogMonthIndex;
  const selectedChangelogMonth = changelogMonths[selectedChangelogMonthIndex];
  const selectedMonthCommitCount = selectedChangelogMonth?.entries.reduce((total, entry) => total + (entry.commits || 0), 0) || 0;

  useEffect(() => {
    if (!isChangelog || initialChangelogMonths.length > 0) return;

    fetch('/changelog.json')
      .then(response => {
        if (!response.ok) throw new Error(`Changelog request failed (${response.status})`);
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data) || data.length === 0 || data.some(month => !month?.label || !Array.isArray(month.entries))) {
          throw new Error('The public changelog data has an invalid format.');
        }
        setChangelogMonths(data.slice().reverse().map(month => ({
          ...month,
          entries: month.entries.slice().reverse()
        })));
      })
      .catch(error => {
        console.error('Could not load the public changelog.', error);
        setChangelogLoadError('The changelog could not be loaded. Please try again later.');
      });
  }, [isChangelog, initialChangelogMonths.length]);

  useEffect(() => {
    if (isChangelog && changelogMonths.length > 0 && changelogMonthSlug && requestedChangelogMonthIndex < 0) {
      navigate('/docs/changelog', { replace: true });
    }
  }, [isChangelog, changelogMonths.length, changelogMonthSlug, requestedChangelogMonthIndex, navigate]);

  useEffect(() => {
    const targetId = location.state?.focusBlogCardId;
    if (viewMode !== 'grid' || targetId === undefined || targetId === null) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      const card = Array.from(document.querySelectorAll('[data-blog-card-id]'))
        .find(element => element.dataset.blogCardId === String(targetId));
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      navigate(location.pathname, { replace: true, state: null });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [viewMode, location.pathname, location.state?.focusBlogCardId, navigate]);

  const [devPosts, setDevPosts] = useState(initialPosts);
  const [devPostsLoadError, setDevPostsLoadError] = useState('');
  const [areDevPostsLoaded, setAreDevPostsLoaded] = useState(initialPosts.length > 0);
  const [customPosts, setCustomPosts] = useState(() => {
    const saved = typeof window === 'undefined'
      ? null
      : localStorage.getItem('custom_blog_posts_storage');
    return saved
      ? JSON.parse(saved).map((post) => ({
        ...post,
        linkTitle: post.linkTitle || post.title || post.id || ''
      }))
      : [];
  });
  const editingPost = viewMode === 'studio' && activeArticleSlug
    ? customPosts.find((post) => (
      slugifyBlogLinkTitle(post.linkTitle || post.title || post.id) === activeArticleSlug
      || slugifyBlogLinkTitle(post.id) === activeArticleSlug
    )) || null
    : null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [postToDelete, setPostToDelete] = useState(null);
  const [linkTitleError, setLinkTitleError] = useState('');
  
  const bodyTextareaRef = useRef(null);
  const importFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    linkTitle: '',
    author: '',
    authorAvatar: '',
    category: 'Guides',
    readTime: '4 min read',
    summary: '',
    tags: '',
    heroImage: '',
    content: ''
  });
  const hasDuplicateLinkTitle = hasDuplicateBlogLinkTitle(customPosts, formData.linkTitle, editingPost?.id);

  useEffect(() => {
    if (initialPosts.length > 0) return undefined;

    fetch('/blog_posts.json')
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('No public blog_posts.json found');
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('The public blog post data has an invalid format.');
        setDevPosts(data);
        setAreDevPostsLoaded(true);
      })
      .catch((error) => {
        console.error('Could not load public blog posts.', error);
        setDevPostsLoadError('Articles could not be loaded. Please try again later.');
        setAreDevPostsLoaded(true);
      });
  }, [initialPosts.length]);

  useEffect(() => {
    localStorage.setItem('custom_blog_posts_storage', JSON.stringify(customPosts));
  }, [customPosts]);

  useEffect(() => {
    const syncImportedPosts = () => {
      const saved = JSON.parse(localStorage.getItem('custom_blog_posts_storage') || '[]');
      if (Array.isArray(saved)) setCustomPosts(saved);
    };
    window.addEventListener('planetmusic-custom-blogs-updated', syncImportedPosts);
    return () => window.removeEventListener('planetmusic-custom-blogs-updated', syncImportedPosts);
  }, []);

  useEffect(() => {
    if (viewMode === 'studio' && activeArticleSlug) {
      const postToEdit = editingPost;
      if (postToEdit) {
        setFormData({
          id: postToEdit.id,
          title: postToEdit.title || '',
          linkTitle: postToEdit.linkTitle || postToEdit.title || postToEdit.id || '',
          author: postToEdit.author || '',
          authorAvatar: postToEdit.authorAvatar || '',
          category: postToEdit.category || 'Guides',
          readTime: postToEdit.readTime || '4 min read',
          summary: postToEdit.summary || '',
          tags: Array.isArray(postToEdit.tags) ? postToEdit.tags.join(', ') : postToEdit.tags || '',
          heroImage: postToEdit.heroImage || '',
          content: postToEdit.content || ''
        });
      }
    } else if (viewMode === 'studio' && !activeArticleSlug) {
      setFormData({
        id: '',
        title: '',
        linkTitle: '',
        author: '',
        authorAvatar: '',
        category: 'Guides',
        readTime: '4 min read',
        summary: '',
        tags: '',
        heroImage: '',
        content: ''
      });
    }
  }, [viewMode, activeArticleSlug, customPosts, editingPost]);

  const currentFeed = blogSection === 'dev' ? devPosts : customPosts;
  const activePost = useMemo(() => {
    if (viewMode !== 'reader' || !activeArticleSlug) return null;
    if (blogSection === 'custom') {
      return customPosts.find((post) => (
        slugifyBlogLinkTitle(post.linkTitle || post.title || post.id) === activeArticleSlug
        || slugifyBlogLinkTitle(post.id) === activeArticleSlug
      )) || null;
    }
    return devPosts.find((post) => slugifyBlogLinkTitle(post.id) === activeArticleSlug)
      || (isLegacyPostRoute
        ? customPosts.find((post) => (
          slugifyBlogLinkTitle(post.linkTitle || post.title || post.id) === activeArticleSlug
          || slugifyBlogLinkTitle(post.id) === activeArticleSlug
        ))
        : null)
      || null;
  }, [viewMode, activeArticleSlug, blogSection, devPosts, customPosts, isLegacyPostRoute]);

  const categories = useMemo(() => {
    const list = new Set(currentFeed.map((p) => p.category).filter(Boolean));
    return ['All', ...Array.from(list)];
  }, [currentFeed]);

  const allCategorySuggestions = useMemo(() => {
    const list = new Set([...devPosts, ...customPosts].map((p) => p.category).filter(Boolean));
    const defaults = ['Guides', 'Music Notes', 'Personal', 'Reviews', 'Tech & Audio', 'Lyrics & Syncing', 'Translation Engine', 'Core Features'];
    defaults.forEach((d) => list.add(d));
    return Array.from(list);
  }, [devPosts, customPosts]);

  const filteredPosts = useMemo(() => {
    return currentFeed.filter((post) => {
      const matchCat = selectedCategory === 'All' || post.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (post.title && post.title.toLowerCase().includes(q)) ||
        (post.summary && post.summary.toLowerCase().includes(q)) ||
        (post.tags && post.tags.some((t) => t.toLowerCase().includes(q)));
      return matchCat && matchSearch;
    });
  }, [currentFeed, searchQuery, selectedCategory]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'linkTitle') setLinkTitleError('');
  };

  const handleOpenStudio = (postToEdit = null) => {
    if (postToEdit) {
      navigate(`/docs/custom-blog/edit/${slugifyBlogLinkTitle(postToEdit.linkTitle || postToEdit.title || postToEdit.id)}`);
    } else {
      navigate('/docs/custom-blog/write');
    }
  };

  const handleCloseStudio = () => {
    navigate(blogSection === 'custom' ? '/docs/custom-blog' : '/docs/dev-blogs');
  };

  const handleDeletePost = (e, postId) => {
    e.preventDefault();
    e.stopPropagation();
    const post = customPosts.find((item) => item.id === postId);
    if (post) setPostToDelete(post);
  };

  const confirmDeletePost = () => {
    if (!postToDelete) return;
    setCustomPosts((posts) => posts.filter((post) => post.id !== postToDelete.id));
    if (activePost?.id === postToDelete.id) navigate('/docs/custom-blog');
    setPostToDelete(null);
  };

  const handleSaveArticle = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.linkTitle || !formData.content) return alert('Title, link title, and content required');

    const linkSlug = slugifyBlogLinkTitle(formData.linkTitle);
    if (!linkSlug) {
      setLinkTitleError('Enter a link title containing at least one letter or number.');
      return;
    }
    if (hasDuplicateBlogLinkTitle(customPosts, linkSlug, editingPost?.id)) {
      setLinkTitleError('That link title is already used by another custom blog.');
      return;
    }
    setLinkTitleError('');

    const genId = editingPost?.id || formData.id.trim() || (
      customPosts.some((post) => post.id === linkSlug)
        ? `${linkSlug}-${Date.now()}`
        : linkSlug
    );

    const tagsArr = formData.tags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const articleObj = {
      ...formData,
      id: genId,
      linkTitle: linkSlug,
      author: formData.author.trim(),
      authorAvatar: formData.authorAvatar.trim(),
      category: formData.category.trim() || 'General',
      isCustom: true,
      date: editingPost?.date || new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      tags: tagsArr.length > 0 ? tagsArr : ['Personal']
    };

    if (editingPost) {
      setCustomPosts((prev) => prev.map((p) => (p.id === editingPost.id ? articleObj : p)));
    } else {
      setCustomPosts((prev) => [articleObj, ...prev]);
    }

    navigate('/docs/custom-blog');
  };

  const handleExportCurrent = () => {
    if (!formData.title && !formData.content) return alert('Workspace is empty');
    const genId =
      formData.id.trim() ||
      formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const tagsArr = formData.tags
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const payload = [
      {
        ...formData,
        id: genId || 'article-draft',
        category: formData.category.trim() || 'General',
        isCustom: true,
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        tags: tagsArr
      }
    ];

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${genId || 'custom_article'}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCustomAll = () => {
    if (customPosts.length === 0) return alert('No custom articles available to export');
    const blob = new Blob([JSON.stringify(customPosts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Custom_Blogs_Backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportCustom = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          const formattedImport = imported.map((post) => ({
            ...post,
            linkTitle: post.linkTitle || post.title || post.id || '',
            isCustom: true
          }));
          const merged = [...customPosts];
          formattedImport.forEach((item) => {
            const idx = merged.findIndex((post) => post.id === item.id);
            if (idx >= 0) merged[idx] = item;
            else merged.push(item);
          });
          const slugs = merged.map((post) => slugifyBlogLinkTitle(post.linkTitle || post.title || post.id));
          if (slugs.some((slug, index) => !slug || slugs.indexOf(slug) !== index)) {
            alert('Import cancelled: each custom blog must have a unique link title.');
            return;
          }
          setCustomPosts(merged);
          navigate('/docs/custom-blog');
          alert(`Successfully imported ${formattedImport.length} custom articles!`);
        } else {
          alert('Invalid blog JSON format.');
        }
      } catch (err) {
        alert('Failed to parse blog JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const insertMarkdown = (prefix, suffix = '') => {
    const el = bodyTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const txt = formData.content.substring(start, end) || 'text';
    const rep = `${prefix}${txt}${suffix}`;
    setFormData((prev) => ({
      ...prev,
      content: prev.content.substring(0, start) + rep + prev.content.substring(end)
    }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + txt.length);
    }, 50);
  };

  return (
    <section className="view-section blog-tab-container">
      <ConfirmModal
        isOpen={Boolean(postToDelete)}
        title="Delete Custom Article?"
        message={`“${postToDelete?.title || 'Untitled article'}” will be permanently removed from your Custom Vault.`}
        confirmText="Delete Article"
        cancelText="Keep Article"
        onConfirm={confirmDeletePost}
        onCancel={() => setPostToDelete(null)}
      />
      <div className={`blog-layout-wrapper ${viewMode === 'studio' ? 'studio-active' : ''}`}>
        <div className="blog-main-content">
          {!isKnownDocsRoute ? (
            <div className="blog-reader-view glass-panel" role="alert">
              <h1>Page not found</h1>
              <p>This PlanetMusic page doesn’t exist or may have moved.</p>
              <Link to="/docs/dev-blogs">Browse all guides</Link>
            </div>
          ) : viewMode === 'studio' ? (
            <div className="blog-studio-card glass-panel">
              <div className="blog-studio-header">
                <h2>{editingPost ? 'Edit Custom Article' : 'New Custom Article Workspace'}</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="blog-icon-btn"
                    onClick={handleExportCurrent}
                    title="Export Current Article (JSON)"
                  >
                    <Icon name="download-single" />
                  </button>
                  <button
                    className="blog-icon-btn close"
                    onClick={handleCloseStudio}
                    title="Close Workspace"
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>

              <div className="blog-studio-grid">
                <form onSubmit={handleSaveArticle} className="blog-studio-form">
                  <div className="blog-form-row">
                    <div className="blog-form-group flex-2">
                      <label>Title</label>
                      <input
                        type="text"
                        name="title"
                        className="blog-input"
                        placeholder="e.g., How to Sync Songs with Music"
                        value={formData.title}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    
                    <div className="blog-form-group flex-1">
                      <label>Category</label>
                      <input
                        type="text"
                        name="category"
                        className="blog-input"
                        list="category-suggestions"
                        placeholder="e.g., Lyrics & Syncing"
                        value={formData.category}
                        onChange={handleFormChange}
                        required
                      />
                      <datalist id="category-suggestions">
                        {allCategorySuggestions.map((cat) => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="blog-form-group">
                    <label htmlFor="custom-blog-link-title">Link title</label>
                    <input
                      id="custom-blog-link-title"
                      type="text"
                      name="linkTitle"
                      className="blog-input"
                      placeholder="e.g., my-guide-to-lyrics"
                      value={formData.linkTitle}
                      onChange={handleFormChange}
                      required
                      aria-invalid={Boolean(linkTitleError || hasDuplicateLinkTitle)}
                      aria-describedby={`custom-blog-link-title-help${linkTitleError || hasDuplicateLinkTitle ? ' custom-blog-link-title-warning' : ''}`}
                    />
                    <p id="custom-blog-link-title-help" className="setting-desc">
                      Article URL: /docs/custom-blog/post/{slugifyBlogLinkTitle(formData.linkTitle) || 'your-link-title'}
                    </p>
                    {(linkTitleError || hasDuplicateLinkTitle) && (
                      <div id="custom-blog-link-title-warning" className="blog-link-title-warning" role="alert">
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M12 3 22 20H2L12 3Z" />
                          <path d="M12 9v5m0 3h.01" />
                        </svg>
                        <span>{linkTitleError || 'That link title is already used by another custom blog.'}</span>
                      </div>
                    )}
                  </div>

                  <div className="blog-form-row">
                    <div className="blog-form-group flex-1">
                      <label htmlFor="custom-blog-author">Author name</label>
                      <input
                        id="custom-blog-author"
                        type="text"
                        name="author"
                        className="blog-input"
                        placeholder="Your name"
                        value={formData.author}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="blog-form-group flex-2">
                      <label htmlFor="custom-blog-author-avatar">Author avatar image URL</label>
                      <input
                        id="custom-blog-author-avatar"
                        type="url"
                        name="authorAvatar"
                        className="blog-input"
                        placeholder="https://example.com/avatar.png"
                        value={formData.authorAvatar}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>

                  <div className="blog-form-row">
                    <div className="blog-form-group flex-1">
                      <label>Read Time</label>
                      <input
                        type="text"
                        name="readTime"
                        className="blog-input"
                        placeholder="e.g., 4 min read"
                        value={formData.readTime}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="blog-form-group flex-2">
                      <label>Hashtags (Comma Separated)</label>
                      <input
                        type="text"
                        name="tags"
                        className="blog-input"
                        placeholder="e.g., Syncing, Timings, Adlibs"
                        value={formData.tags}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>

                  <div className="blog-form-group">
                    <label>Hero Image URL</label>
                    <input
                      type="text"
                      name="heroImage"
                      className="blog-input"
                      placeholder="https://..."
                      value={formData.heroImage}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="blog-form-group">
                    <label>Summary</label>
                    <textarea
                      name="summary"
                      className="blog-textarea short"
                      placeholder="Brief overview of your custom post..."
                      value={formData.summary}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="blog-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label>Content (Markdown)</label>
                      <div className="md-toolbar">
                        <button type="button" onClick={() => insertMarkdown('**', '**')} title="Bold">B</button>
                        <button type="button" onClick={() => insertMarkdown('*', '*')} title="Italic">I</button>
                        <button type="button" onClick={() => insertMarkdown('## ')} title="Heading 2">H2</button>
                        <button type="button" onClick={() => insertMarkdown('### ')} title="Heading 3">H3</button>
                        <button type="button" onClick={() => insertMarkdown('- ')} title="Unordered List">List</button>
                        <button type="button" onClick={() => insertMarkdown('> ')} title="Quote">Quote</button>
                        <button type="button" onClick={() => insertMarkdown('`', '`')} title="Code">Code</button>
                        <button type="button" onClick={() => insertMarkdown('\n---\n')} title="Horizontal Divider">---</button>
                      </div>
                    </div>
                    <textarea
                      ref={bodyTextareaRef}
                      name="content"
                      className="blog-textarea full"
                      placeholder="Write your custom article in Markdown..."
                      value={formData.content}
                      onChange={handleFormChange}
                      required
                    />
                  </div>

                  <div className="blog-studio-actions">
                    <button type="submit" className="blog-submit-btn">
                      {editingPost ? 'Update Article' : 'Save Custom Article'}
                    </button>
                  </div>
                </form>

                <div className="blog-markdown-preview-pane">
                  <span className="preview-pane-badge">Live Preview</span>
                  <div className="blog-article-body" style={{ marginTop: '16px' }}>
                    {formData.title && <h1 className="blog-article-title" style={{ backgroundImage: getProceduralGradient(`blog:editor-title:${formData.id || 'draft'}`) }}>{renderMarkdown(formData.title, `blog:editor:${formData.id || 'draft'}:title`)}</h1>}
                    {formData.summary && <p className="blog-article-summary">{renderMarkdown(formData.summary, `blog:editor:${formData.id || 'draft'}:summary`)}</p>}
                    {formData.heroImage && <img src={formData.heroImage} alt="" className="blog-article-hero-img" />}
                    <hr className="blog-divider" />
                    {formData.content ? renderMarkdown(formData.content, `blog:editor:${formData.id || 'draft'}:content`) : <p style={{ opacity: 0.5 }}>Your markdown preview will render here...</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : viewMode === 'reader' && activePost ? (
            <div className="blog-reader-view glass-panel">
              <button 
                className="blog-back-btn" 
                onClick={() => navigate(activePost.isCustom ? '/docs/custom-blog' : '/docs/dev-blogs', { state: { focusBlogCardId: activePost.id } })}
              >
                <Icon name="arrow-left" size={16} /> Back to Articles
              </button>
              
              <header className="blog-article-header">
                <div className="blog-meta-badge-row">
                  <span className="blog-category-badge">{activePost.category}</span>
                  {activePost.isCustom && (
                    <>
                      <span className="blog-meta-dot"> </span>
                      <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>[Custom]</span>
                    </>
                  )}
                </div>
                <h1 className="blog-article-title" style={{ backgroundImage: getProceduralGradient(`blog:article-title:${activePost.id}`) }}>{renderMarkdown(activePost.title, `blog:article:${activePost.id}:title`)}</h1>
                {(activePost.author || activePost.isCustom || activePost.date || activePost.readTime) && (
                  <div className="blog-article-byline">
                    {(activePost.author || activePost.isCustom) && (
                      <span className="blog-article-author">
                        <BlogAuthorAvatar post={activePost} className="blog-article-author-avatar" />
                        <span>By {activePost.isCustom ? (activePost.author || 'You') : 'PlanetMusic'}</span>
                      </span>
                    )}
                    {activePost.date && (
                      <>
                        {(activePost.author || activePost.isCustom) && <span className="blog-byline-dot" aria-hidden="true">·</span>}
                        <time>{activePost.date}</time>
                      </>
                    )}
                    {activePost.readTime && (
                      <>
                        {(activePost.author || activePost.isCustom || activePost.date) && <span className="blog-byline-dot" aria-hidden="true">·</span>}
                        <span>{activePost.readTime}</span>
                      </>
                    )}
                  </div>
                )}
                {activePost.heroImage && <img src={activePost.heroImage} alt="" className="blog-article-hero-img" />}
                {!activePost.heroImage && <BlogPostArtwork post={activePost} className="blog-article-artwork" />}
              </header>

              {activePost.tags && activePost.tags.length > 0 && (
                <div className="blog-tags-row">
                  {activePost.tags.map((t, idx) => (
                    <span key={idx} className="blog-tag">#{t}</span>
                  ))}
                </div>
              )}

              <hr className="blog-divider" />

              <article className="blog-article-body">{renderMarkdown(activePost.content, `blog:article:${activePost.id}:content`)}</article>

              <button 
                className="blog-back-btn bottom-back" 
                onClick={() => navigate(activePost.isCustom ? '/docs/custom-blog' : '/docs/dev-blogs', { state: { focusBlogCardId: activePost.id } })}
              >
                <Icon name="arrow-left" size={16} /> Back to Articles
              </button>

            </div>
          ) : viewMode === 'reader' && !areDevPostsLoaded ? (
            <div className="blog-reader-view glass-panel" role="status">
              <p>Loading article…</p>
            </div>
          ) : viewMode === 'reader' ? (
            <div className="blog-reader-view glass-panel" role={devPostsLoadError ? 'alert' : undefined}>
              <h1>{devPostsLoadError ? 'Articles are unavailable' : 'Article not found'}</h1>
              <p>
                {devPostsLoadError || 'This article may have been moved or the link may be incorrect.'}
              </p>
              <Link to="/docs/dev-blogs">Browse all guides</Link>
            </div>
          ) : (
            <div className="blog-grid-view">
              <div className="blog-hero glass-panel">
                <div className="blog-hero-top">
                  <div>
                    <h1 className="blog-hero-title" style={{ backgroundImage: getProceduralGradient('blog:documentation-heading') }}>Documentation & Blogs</h1>
                    <p className="blog-hero-sub">
                      {isChangelog
                        ? 'Browse PlanetMusic’s day-by-day development history. Choose a month to see the work recorded in Git.'
                        : blogSection === 'custom'
                          ? 'Custom articles are saved only in this browser. They are not published to the public site or included in search results.'
                          : 'Explore public PlanetMusic guides, each available as its own crawlable page. Custom articles stay private to the browser where they were created.'}
                    </p>
                  </div>
                  {!isChangelog && <div className="blog-hero-actions">
                    <button
                      className="blog-icon-btn action"
                      onClick={() => handleOpenStudio()}
                      title="Create Custom Article"
                    >
                      <Icon name="plus" />
                    </button>
                    {blogSection === 'custom' && customPosts.length > 0 && (
                      <button
                        className="blog-icon-btn"
                        onClick={handleExportCustomAll}
                        title="Export All Custom Articles (JSON)"
                      >
                        <Icon name="download" />
                      </button>
                    )}
                    <input
                      type="file"
                      accept=".json,application/json"
                      ref={importFileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleImportCustom}
                    />
                    <button
                      className="blog-icon-btn"
                      onClick={() => importFileInputRef.current?.click()}
                      title="Import Custom Articles (JSON)"
                    >
                      <Icon name="upload" />
                    </button>
                  </div>}
                </div>

                <div className="blog-section-tabs">
                  <button
                    className={`category-pill ${blogSection === 'dev' && !isChangelog ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory('All');
                      navigate('/docs/dev-blogs');
                    }}
                    aria-current={blogSection === 'dev' && !isChangelog ? 'page' : undefined}
                  >
                    Developer Blogs ({devPosts.length})
                  </button>
                  <button
                    className={`category-pill ${blogSection === 'custom' ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedCategory('All');
                      navigate('/docs/custom-blog');
                    }}
                    aria-current={blogSection === 'custom' ? 'page' : undefined}
                  >
                    Custom Blogs ({customPosts.length})
                  </button>
                  <button
                    className={`category-pill ${isChangelog ? 'active' : ''}`}
                    onClick={() => navigate('/docs/changelog')}
                    aria-current={isChangelog ? 'page' : undefined}
                  >
                    Changelog
                  </button>
                  <button
                    className={`category-pill ${location.pathname === '/privacy' ? 'active' : ''}`}
                    onClick={() => navigate('/privacy')}
                    aria-current={location.pathname === '/privacy' ? 'page' : undefined}
                  >
                    Privacy
                  </button>
                  <button
                    className={`category-pill ${location.pathname === '/docs/terms-of-service' ? 'active' : ''}`}
                    onClick={() => navigate('/docs/terms-of-service')}
                    aria-current={location.pathname === '/docs/terms-of-service' ? 'page' : undefined}
                  >
                    Terms of Service
                  </button>
                  <button
                    className={`category-pill ${location.pathname === '/docs/about-me' ? 'active' : ''}`}
                    onClick={() => navigate('/docs/about-me')}
                    aria-current={location.pathname === '/docs/about-me' ? 'page' : undefined}
                  >
                    About Me
                  </button>
                </div>

                {!isChangelog && <div className="blog-controls-row">
                  <div className="blog-search-box">
                    <Icon name="search" size={16} />
                    <input
                      type="text"
                      placeholder={`Search ${blogSection === 'dev' ? 'developer' : 'custom'} articles, tags, or topics...`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button className="blog-clear-search" onClick={() => setSearchQuery('')}>
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="blog-categories-pills">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>}
              </div>

              {isChangelog ? (
                <section className="changelog-panel glass-panel" aria-label="PlanetMusic changelog">
                  {changelogLoadError ? (
                    <p className="changelog-note" role="alert">{changelogLoadError}</p>
                  ) : !selectedChangelogMonth ? (
                    <p className="changelog-note" role="status">Loading changelog…</p>
                  ) : (
                    <>
                      <div className="changelog-month-selector">
                        <div className="changelog-month-heading">
                          <div className="changelog-month-current" aria-live="polite">
                            <h2
                              style={{
                                backgroundImage: getProceduralGradient(`changelog:month:${selectedChangelogMonth.label}`),
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text'
                              }}
                            >
                              {selectedChangelogMonth.label}
                            </h2>
                            <p>{selectedChangelogMonth.entries.length} timeline entries · {selectedMonthCommitCount} Git commits</p>
                          </div>
                        </div>
                        <label className="changelog-slider-label" htmlFor="changelog-month-slider">
                          Browse months
                        </label>
                        <input
                          id="changelog-month-slider"
                          className="changelog-month-slider"
                          type="range"
                          min="0"
                          max={changelogMonths.length - 1}
                          step="1"
                          value={selectedChangelogMonthIndex}
                          aria-valuetext={selectedChangelogMonth.label}
                          style={{ '--slider-progress': `${(selectedChangelogMonthIndex / Math.max(1, changelogMonths.length - 1)) * 100}%` }}
                          onInput={event => {
                            const month = changelogMonths[Number(event.target.value)];
                            const monthSlug = month.label.toLowerCase().replace(' ', '-');
                            navigate(`/docs/changelog/${monthSlug}`, { replace: true });
                          }}
                        />
                        <div className="changelog-month-ticks" aria-hidden="true">
                          {changelogMonths.map((month, index) => (
                            <span
                              className={index === selectedChangelogMonthIndex ? 'active' : ''}
                              key={month.label}
                              style={{ left: `${(index / Math.max(1, changelogMonths.length - 1)) * 100}%` }}
                            >
                              {month.label.slice(0, 3)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <ol className="changelog-timeline">
                        {selectedChangelogMonth.entries.map((entry, index, entries) => {
                          const nextEntry = entries[index + 1];
                          const hasDateGap = nextEntry
                            && Math.abs(Date.parse(`${nextEntry.date}T00:00:00Z`) - Date.parse(`${entry.date}T00:00:00Z`)) !== 86400000;
                          const summaryItems = entry.summary.split(/(?<=[.!?])\s+/).filter(Boolean);

                          return (
                            <li className={`changelog-entry ${hasDateGap ? 'has-date-gap' : ''}`} key={entry.date}>
                              <time className="changelog-date" dateTime={entry.date}>
                                {new Intl.DateTimeFormat(undefined, {
                                  weekday: 'long',
                                  month: 'long',
                                  day: 'numeric',
                                  timeZone: 'UTC'
                                }).format(new Date(`${entry.date}T12:00:00Z`))}
                              </time>
                              <div className="changelog-entry-content">
                                <ul>
                                  {summaryItems.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                                </ul>
                                <span className="changelog-commit-count">
                                  {entry.commits} {entry.commits === 1 ? 'commit' : 'commits'}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </>
                  )}
                </section>
              ) : filteredPosts.length > 0 ? (
                <div className="blog-cards-grid">
                  {filteredPosts.map((post, idx) => (
                    <React.Fragment key={post.id}>
                      <div className="blog-card-wrapper" data-blog-card-id={String(post.id)}>
                          <Link to={getBlogPostPath(post)} className="blog-card">
                            {post.heroImage && <img src={post.heroImage} alt="" className="blog-card-thumb" />}
                            {!post.heroImage && <BlogPostArtwork post={post} className="blog-card-artwork" />}
                            <div className="blog-card-top">
                              <span className="blog-category-badge">{post.category}</span>
                              <span className="blog-read-time">{post.readTime}</span>
                            </div>
                            <h3 
                              className="blog-card-title"
                              style={{
                                backgroundImage: getProceduralGradient(`blog:card-title:${post.id}`),
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                display: 'inline-block'
                              }}
                            >
                              {post.title}
                            </h3>
                            <p className="blog-card-summary">{post.summary}</p>
                            {(post.author || post.date || post.isCustom) && (
                              <div className="blog-card-byline">
                              {(post.author || post.isCustom) && (
                                <span className="blog-card-author">
                                  <BlogAuthorAvatar post={post} className="blog-card-author-avatar" />
                                  <span>By {post.isCustom ? (post.author || 'You') : 'PlanetMusic'}</span>
                                </span>
                              )}
                              {(post.author || post.isCustom) && post.date && <span className="blog-byline-dot" aria-hidden="true">·</span>}
                              {post.date && <time>{post.date}</time>}
                            </div>
                            )}
                            <div className="blog-card-bottom">
                              <div className="blog-card-tags">
                                {Array.isArray(post.tags) && post.tags.slice(0, 2).map((t, i) => (
                                  <span key={i} className="blog-mini-tag">#{t}</span>
                                ))}
                              </div>
                            </div>
                          </Link>
                          {blogSection === 'custom' && (
                            <div className="blog-card-admin-controls">
                              <button className="blog-admin-btn edit" onClick={() => handleOpenStudio(post)}>
                                Edit
                              </button>
                              <button className="blog-admin-btn delete" onClick={(e) => handleDeletePost(e, post.id)}>
                                Delete
                              </button>
                            </div>
                          )}
                      </div>
                      {adsEnabled && (idx + 1) % 4 === 0 && idx < filteredPosts.length - 1 && (
                        <InFeedSponsor
                          placement="blogFeed"
                          format="feed"
                          adClass="in-feed-blog-ad"
                          wrapperClass="blog-card dynamic-radius-override in-feed-blog-card"
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="blog-empty-box glass-panel">
                  <h3>No {blogSection === 'dev' ? 'developer' : 'custom'} articles found</h3>
                  <p style={{ color: 'var(--text-subdued)', marginBottom: '20px' }}>
                    {blogSection === 'custom' 
                      ? 'You haven\'t created any custom articles yet. Click the + button above to write one!' 
                      : 'Try searching for a different term.'}
                  </p>
                  {blogSection === 'custom' && (
                    <button className="blog-icon-btn action" style={{ margin: '0 auto' }} onClick={() => handleOpenStudio()} title="Write New Article">
                      <Icon name="plus" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className={`blog-sidebar ${viewMode === 'studio' ? 'studio-bottom' : ''}`}>
          {adsEnabled && (
            <>
              <SelfPromoCard
                placement="blogSidebar"
                format="sidebar"
                className={`glass-panel dynamic-radius-override page-sidebar-ad-large blog-sidebar-sponsor-large${viewMode === 'studio' ? ' studio-sidebar-ad' : ''}`}
              />
              <SelfPromoCard
                placement="blogStickySidebar"
                format="sidebar"
                className={`glass-panel dynamic-radius-override page-sidebar-ad-small blog-sidebar-sponsor-small${viewMode === 'studio' ? ' studio-sidebar-ad' : ''}`}
              />
            </>
          )}
        </aside>
      </div>
      {viewMode === 'grid' && adsEnabled && (
        <SelfPromoCard
          placement="blogFeedBottom"
          format="banner"
          className="glass-panel settings-promo-box dynamic-radius-override"
          style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
        />
      )}
      {viewMode === 'reader' && activePost && adsEnabled && (
        <SelfPromoCard
          placement="blogPostBottom"
          format="banner"
          className="glass-panel settings-promo-box dynamic-radius-override"
          style={{ maxWidth: '1400px', margin: '32px auto 0 auto' }}
        />
      )}
    </section>
  );
};

export default BlogTab;